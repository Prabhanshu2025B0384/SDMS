import hashlib
import os
import tempfile
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import get_current_user
from app.core.storage import get_storage_file, save_storage_file
from app.database import AsyncSessionLocal, get_db
from app.models import AuditLog, Case, Document, DocumentVersion, User
from app.services.extraction import process_document_pipeline

router = APIRouter(prefix="/documents", tags=["Documents"])


def calculate_sha256(file_bytes: bytes) -> str:
    sha256_hash = hashlib.sha256()
    sha256_hash.update(file_bytes)
    return sha256_hash.hexdigest()


async def process_document_background(
    document_id: str, 
    version_id: str,
    file_bytes: bytes,
    user_id: str
):
    """
    Background task to run text extraction and AI metadata processing, then update the DB.
    Uses its own isolated database session.
    """
    temp_path = None
    try:
        # Create OS-safe temporary file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_bytes)
            temp_path = tmp.name

        # Run extraction pipeline
        extracted = process_document_pipeline(temp_path)

        # Use fresh async session for background execution
        async with AsyncSessionLocal() as session:
            # Update DocumentVersion
            ver_result = await session.execute(
                select(DocumentVersion).where(DocumentVersion.id == version_id)
            )
            version = ver_result.scalar_one_or_none()
            if version:
                version.raw_ocr_text = extracted.get("raw_ocr_text", "")
                version.structured_data = extracted.get("structured_data", {})
                
            # Update Document
            doc_result = await session.execute(
                select(Document).where(Document.id == document_id)
            )
            doc = doc_result.scalar_one_or_none()
            if doc:
                doc.status = "READY"
                # Store composite searchable text for universal cross-db search
                doc.search_vector = f"{doc.title} {doc.document_type} {extracted.get('raw_ocr_text', '')}"
                
            await session.commit()
            print(f"Successfully processed document {document_id} to status READY")

    except Exception as e:
        print(f"Background processing error for document {document_id}: {e}")
        try:
            async with AsyncSessionLocal() as session:
                doc_result = await session.execute(
                    select(Document).where(Document.id == document_id)
                )
                doc = doc_result.scalar_one_or_none()
                if doc:
                    doc.status = "READY" # Even on extraction warning, keep document accessible
                    await session.commit()
        except Exception as inner_e:
            print(f"Failed to update document status: {inner_e}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.get("/")
async def get_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "Admin":
        query = select(Document).order_by(Document.created_at.desc())
    else:
        from app.models import CaseAssignment
        from sqlalchemy import or_
        assigned_case_ids_subquery = select(CaseAssignment.case_id).where(CaseAssignment.user_id == current_user.id)
        query = select(Document).join(Case).where(
            or_(
                Case.owning_officer_id == current_user.id,
                Document.case_id.in_(assigned_case_ids_subquery)
            )
        ).order_by(Document.created_at.desc())
        
    result = await db.execute(query)
    docs = result.scalars().all()
    
    return [
        {
            "id": str(doc.id),
            "title": doc.title,
            "document_type": doc.document_type,
            "status": doc.status,
            "case_id": str(doc.case_id),
            "created_at": doc.created_at.isoformat() if doc.created_at else None
        }
        for doc in docs
    ]



@router.get("/{document_id}")
async def get_document_details(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Get latest version details
    ver_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == document_id).order_by(DocumentVersion.created_at.desc())
    )
    latest_version = ver_result.scalars().first()
    
    return {
        "id": str(doc.id),
        "title": doc.title,
        "document_type": doc.document_type,
        "status": doc.status,
        "case_id": str(doc.case_id),
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "raw_ocr_text": latest_version.raw_ocr_text if latest_version else None,
        "structured_data": latest_version.structured_data if latest_version else {},
        "file_hash": latest_version.file_hash if latest_version else None,
        "version_number": latest_version.version_number if latest_version else "1.0"
    }


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    ver_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == document_id).order_by(DocumentVersion.created_at.desc())
    )
    latest_version = ver_result.scalars().first()
    if not latest_version:
        raise HTTPException(status_code=404, detail="Document version not found")
        
    try:
        file_bytes = get_storage_file(latest_version.storage_path)
        filename = f"{doc.title.replace(' ', '_')}.pdf"
        return Response(
            content=file_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"File could not be retrieved: {e}")


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    case_id: str = Form(...),
    title: str = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    case_result = await db.execute(select(Case).where(Case.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found. Please select a valid case.")
        
    from app.core.authorization import check_case_upload_permission
    await check_case_upload_permission(db, case, current_user)



    file_bytes = await file.read()
    file_hash = calculate_sha256(file_bytes)
    
    # 1. Create Document Record
    new_doc_id = uuid.uuid4()
    new_doc = Document(
        id=new_doc_id,
        case_id=case.id,
        title=title,
        document_type=document_type,
        status="PROCESSING",
        search_vector=f"{title} {document_type}"
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)
    
    # 2. Create DocumentVersion Record
    version_number = "1.0"
    storage_path = f"{case.id}/{new_doc.id}/{version_number}.pdf"
    
    # Save file to storage
    try:
        save_storage_file(storage_path, file_bytes)
    except Exception as e:
        await db.delete(new_doc)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to store file: {e}")

    new_version_id = uuid.uuid4()
    new_version = DocumentVersion(
        id=new_version_id,
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
    
    # 4. Kick off Background Task for OCR + Metadata Extraction
    background_tasks.add_task(
        process_document_background,
        document_id=str(new_doc.id),
        version_id=str(new_version.id),
        file_bytes=file_bytes,
        user_id=str(current_user.id)
    )
    
    # 5. Audit Log
    audit = AuditLog(
        user_id=current_user.id,
        action="UPLOAD",
        document_id=new_doc.id,
        case_id=case.id,
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

