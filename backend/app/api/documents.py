from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import hashlib
import io
import os

from app.database import get_db
from app.models import User, Document, DocumentVersion
from app.schemas.document import UploadResponse, DocumentResponse
from app.core.security import get_current_user
from app.core.authorization import RoleChecker, verify_case_access
from app.core.minio_client import get_minio_client
from app.core.config import settings
from app.services.extraction import process_document

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

@router.post("/cases/{case_id}/documents", response_model=UploadResponse)
async def upload_document(
    case_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(RoleChecker(["Investigating Officer", "Senior Officer", "Admin"]))
):
    # Verify access to case
    case = await verify_case_access(case_id, user, db)
    
    # 1. File Validation
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds the 50MB limit")
        
    # 2. SHA-256 Calculation
    sha256_hash = hashlib.sha256(contents).hexdigest()
    
    # 3. Store in MinIO
    minio_client = get_minio_client()
    object_name = f"{case_id}/{uuid.uuid4()}.pdf"
    
    try:
        minio_client.put_object(
            bucket_name=settings.MINIO_BUCKET_NAME,
            object_name=object_name,
            data=io.BytesIO(contents),
            length=len(contents),
            content_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to store document")
        
    # 4. Database records
    new_doc = Document(
        case_id=case_id,
        status="PROCESSING"
    )
    db.add(new_doc)
    await db.flush() # flush to get new_doc.id
    
    new_version = DocumentVersion(
        document_id=new_doc.id,
        version_number=1,
        minio_object_path=object_name,
        sha256_hash=sha256_hash,
        creator_id=user.id,
        workflow_status="DRAFT"
    )
    db.add(new_version)
    await db.flush() # flush to get new_version.id
    
    new_doc.current_version_id = new_version.id
    await db.commit()
    
    # Trigger background task for OCR + AI Extraction
    background_tasks.add_task(process_document, new_doc.id, new_version.id)
    
    return UploadResponse(document_id=new_doc.id, status="PROCESSING")

@router.post("/documents/{document_id}/versions", response_model=UploadResponse)
async def upload_new_version(
    document_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(RoleChecker(["Investigating Officer", "Senior Officer", "Admin"]))
):
    from app.core.authorization import verify_document_access
    from sqlalchemy.future import select
    from sqlalchemy import func
    
    # 1. Verify access to document
    doc = await verify_document_access(document_id, user, db)
    
    # 2. File Validation
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds the 50MB limit")
        
    # 3. SHA-256 Calculation
    sha256_hash = hashlib.sha256(contents).hexdigest()
    
    # 4. Get next version number
    result = await db.execute(select(func.max(DocumentVersion.version_number)).where(DocumentVersion.document_id == document_id))
    max_version = result.scalar() or 0
    next_version = max_version + 1
    
    # 5. Store in MinIO
    minio_client = get_minio_client()
    object_name = f"{doc.case_id}/{uuid.uuid4()}.pdf"
    
    try:
        minio_client.put_object(
            bucket_name=settings.MINIO_BUCKET_NAME,
            object_name=object_name,
            data=io.BytesIO(contents),
            length=len(contents),
            content_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to store document")
        
    # 6. Database records
    new_version = DocumentVersion(
        document_id=doc.id,
        version_number=next_version,
        minio_object_path=object_name,
        sha256_hash=sha256_hash,
        creator_id=user.id,
        workflow_status="DRAFT"
    )
    db.add(new_version)
    await db.flush()
    
    doc.current_version_id = new_version.id
    doc.status = "PROCESSING"
    await db.commit()
    
    # Trigger background task for OCR + AI Extraction
    background_tasks.add_task(process_document, doc.id, new_version.id)
    
    return UploadResponse(document_id=doc.id, status="PROCESSING")

@router.post("/versions/{version_id}/approve")
async def approve_version(
    version_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(RoleChecker(["Senior Officer", "Admin", "Prosecutor"]))
):
    from sqlalchemy.future import select
    from app.services.audit import create_audit_log
    
    # 1. Fetch version
    result = await db.execute(select(DocumentVersion).where(DocumentVersion.id == version_id))
    version = result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
        
    # 2. Enforce constraint: Creator cannot approve their own document
    if version.creator_id == user.id:
        await create_audit_log(db, "APPROVE_VERSION", "DENIED", user.id, version.document.case_id, version.document_id, version.id, {"reason": "Self-approval attempted"})
        await db.commit()
        raise HTTPException(status_code=403, detail="You cannot approve a document version you created")
        
    # 3. Approve
    version.workflow_status = "APPROVED"
    
    # 4. Audit
    await create_audit_log(db, "APPROVE_VERSION", "SUCCESS", user.id, version.document.case_id, version.document_id, version.id)
    
    await db.commit()
    return {"status": "success", "workflow_status": "APPROVED"}

@router.post("/documents/{document_id}/retry", response_model=UploadResponse)
async def retry_processing(
    document_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(RoleChecker(["Investigating Officer", "Senior Officer", "Admin"]))
):
    from sqlalchemy.future import select
    from app.core.authorization import verify_document_access
    from app.services.audit import create_audit_log
    
    # Verify access
    doc = await verify_document_access(document_id, user, db)
    
    if doc.status != "PROCESSING_FAILED":
        raise HTTPException(status_code=400, detail="Only failed documents can be retried")
        
    # Re-queue
    doc.status = "PROCESSING"
    await create_audit_log(db, "RETRY_PROCESSING", "SUCCESS", user.id, doc.case_id, doc.id, doc.current_version_id)
    await db.commit()
    
    background_tasks.add_task(process_document, doc.id, doc.current_version_id)
    
    return UploadResponse(document_id=doc.id, status="PROCESSING")

