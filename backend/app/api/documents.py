import hashlib
import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import get_current_user
from app.core.storage import get_storage_client
from app.database import get_db
from app.models import AuditLog, Document, DocumentVersion, User
from app.services.extraction import process_document_pipeline

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.get("/")
async def get_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "Admin":
        query = select(Document)
    else:
        from app.models import Case
        query = select(Document).join(Case).where(Case.owning_officer_id == current_user.id)
        
    result = await db.execute(query)
    docs = result.scalars().all()
    
    return [
        {
            "id": str(doc.id),
            "title": doc.title,
            "document_type": doc.document_type,
            "status": doc.status,
            "case_id": str(doc.case_id)
        }
        for doc in docs
    ]

def calculate_sha256(file_bytes: bytes) -> str:
    sha256_hash = hashlib.sha256()
    sha256_hash.update(file_bytes)
    return sha256_hash.hexdigest()

async def process_document_background(
    db: AsyncSession, 
    document_id: uuid.UUID, 
    version_id: uuid.UUID,
    file_bytes: bytes,
    user_id: uuid.UUID
):
    """
    Background task to run OCR and local AI extraction, then update the DB.
    """
    try:
        # Save temp file for OCR
        temp_path = f"/tmp/{version_id}.pdf"
        with open(temp_path, "wb") as f:
            f.write(file_bytes)
            
        # Run pipeline
        extracted = process_document_pipeline(temp_path)
        os.remove(temp_path)
        
        # Update Version with text and JSON
        result = await db.execute(select(DocumentVersion).where(DocumentVersion.id == version_id))
        version = result.scalar_one_or_none()
        if version:
            version.raw_ocr_text = extracted["raw_ocr_text"]
            version.structured_data = extracted["structured_data"]
            
            # Update Document status
            doc_result = await db.execute(select(Document).where(Document.id == document_id))
            doc = doc_result.scalar_one_or_none()
            if doc:
                doc.status = "READY"
                # Update tsvector search column (this requires raw SQL in production for tsvector)
                # But we will handle the tsvector trigger at the DB level, or update here.
            
            await db.commit()
            
    except Exception as e:
        print(f"Background processing failed: {e}")
        doc_result = await db.execute(select(Document).where(Document.id == document_id))
        doc = doc_result.scalar_one_or_none()
        if doc:
            doc.status = "PROCESSING_FAILED"
            await db.commit()

@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    case_id: uuid.UUID,
    title: str,
    document_type: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    from app.models import Case
    case_result = await db.execute(select(Case).where(Case.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    if current_user.role != "Admin" and case.owning_officer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to upload documents to this case")

    file_bytes = await file.read()
    file_hash = calculate_sha256(file_bytes)
    
    # 1. Create Document Record
    new_doc = Document(
        case_id=case_id,
        title=title,
        document_type=document_type,
        status="PROCESSING"
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)
    
    # 2. Create DocumentVersion Record
    version_number = "1.0"
    storage_path = f"{case_id}/{new_doc.id}/{version_number}.pdf"
    
    new_version = DocumentVersion(
        document_id=new_doc.id,
        version_number=version_number,
        storage_path=storage_path,
        file_hash=file_hash,
        created_by=current_user.id
    )
    db.add(new_version)
    await db.commit()
    await db.refresh(new_version)
    
    # 3. Link current version
    new_doc.current_version_id = new_version.id
    await db.commit()
    
    # 4. Upload to Ceph / S3
    s3_client = get_storage_client()
    try:
        s3_client.put_object(
            Bucket=settings.CEPH_BUCKET_NAME,
            Key=storage_path,
            Body=file_bytes,
            ContentType='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to storage: {e!s}")
        
    # 5. Kick off Background Task for OCR + LLM
    background_tasks.add_task(
        process_document_background,
        db=db,
        document_id=new_doc.id,
        version_id=new_version.id,
        file_bytes=file_bytes,
        user_id=current_user.id
    )
    
    # 6. Audit Log
    audit = AuditLog(
        user_id=current_user.id,
        action="UPLOAD",
        document_id=new_doc.id,
        case_id=case_id,
        result="SUCCESS",
        current_hash=file_hash
    )
    db.add(audit)
    await db.commit()
    
    return {
        "message": "Upload started successfully",
        "document_id": str(new_doc.id),
        "status": "PROCESSING"
    }
