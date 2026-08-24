import hashlib
import os
import tempfile
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.core.config import settings
from app.core.security import get_current_user
from app.core.storage import get_storage_file, save_storage_file
from app.database import AsyncSessionLocal, get_db
from app.models import AuditLog, Case, Document, DocumentPermission, DocumentVersion, User
from app.services.extraction import process_document_pipeline

router = APIRouter(prefix="/documents", tags=["Documents"])


def calculate_sha256(file_bytes: bytes) -> str:
    sha256_hash = hashlib.sha256()
    sha256_hash.update(file_bytes)
    return sha256_hash.hexdigest()


async def log_document_action(
    db: AsyncSession,
    user_id,
    action: str,
    document_id,
    case_id=None,
    result: str = "SUCCESS",
    details: dict = None
):
    from app.core.audit import log_audit_event
    await log_audit_event(
        db=db,
        action=action,
        user_id=user_id,
        document_id=document_id,
        case_id=case_id,
        result=result,
        details=details or {}
    )
    await db.commit()


async def process_document_background(
    document_id: str,
    version_id: str,
    file_bytes: bytes,
    user_id: str
):
    """Background task to run text extraction and AI metadata processing."""
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_bytes)
            temp_path = tmp.name

        extracted = process_document_pipeline(temp_path)

        async with AsyncSessionLocal() as session:
            ver_result = await session.execute(
                select(DocumentVersion).where(DocumentVersion.id == version_id)
            )
            version = ver_result.scalar_one_or_none()
            if version:
                version.raw_ocr_text = extracted.get("raw_ocr_text", "")
                version.structured_data = extracted.get("structured_data", {})
                await session.commit()

            doc_result = await session.execute(
                select(Document).where(Document.id == document_id)
            )
            doc = doc_result.scalar_one_or_none()
            if doc:
                from app.models import ApprovalRequest, Notification
                # Combine title, type, OCR text, and structured metadata for search
                meta = extracted.get('structured_data', {})
                meta_text = " ".join(str(v) for v in meta.values() if v) if isinstance(meta, dict) else ""
                search_text = f"{doc.title} {doc.document_type} {meta_text} {extracted.get('raw_ocr_text', '')}"
                doc.search_vector = func.to_tsvector('english', search_text)
                
                # Check for pending approval request
                req_result = await session.execute(
                    select(ApprovalRequest).where(ApprovalRequest.document_id == doc.id, ApprovalRequest.status == "PENDING")
                )
                approval_req = req_result.scalar_one_or_none()
                
                if approval_req:
                    doc.status = "SUBMITTED"
                    # Notify reviewer
                    notification = Notification(
                        id=uuid.uuid4(),
                        user_id=approval_req.reviewer_id,
                        message=f"Document '{doc.title}' has been submitted to you for review.",
                        link=f"/documents?id={doc.id}"
                    )
                    session.add(notification)
                else:
                    doc.status = "READY"
                    
                await session.commit()
                print(f"Successfully processed document {document_id} to status {doc.status}")
    except Exception as e:
        print(f"Background processing error for {document_id}: {e}")
        try:
            async with AsyncSessionLocal() as session:
                doc_result = await session.execute(select(Document).where(Document.id == document_id))
                doc = doc_result.scalar_one_or_none()
                if doc:
                    doc.status = "PROCESSING_FAILED"
                    doc.failure_reason = str(e)
                    await session.commit()
        except Exception as inner_e:
            print(f"Failed to update document status: {inner_e}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


# ─── GET DOCUMENTS ──────────────────────────────────────────────────────────

@router.get("/shared")
async def get_shared_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all documents explicitly shared with the current user."""
    query = (
        select(DocumentPermission, Document, User, Case)
        .join(Document, DocumentPermission.document_id == Document.id)
        .join(User, DocumentPermission.granted_by == User.id)
        .join(Case, Document.case_id == Case.id)
        .where(DocumentPermission.user_id == current_user.id)
        .order_by(DocumentPermission.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()
    
    return [
        {
            "id": str(doc.id),
            "title": doc.title,
            "document_type": doc.document_type,
            "classification_level": doc.classification_level or 1,
            "status": doc.status,
            "case_id": str(case.id),
            "case_number": case.case_number,
            "shared_by": user.email,
            "permission_type": perm.permission_type,
            "shared_at": perm.created_at.isoformat() if perm.created_at else None
        }
        for perm, doc, user, case in rows
    ]

@router.get("/")
async def get_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Document).join(Case, Document.case_id == Case.id)
    
    from app.core.authorization import get_authorized_document_filter
    auth_filter = get_authorized_document_filter(current_user)
    if auth_filter is not True:
        query = query.where(auth_filter)
        
    query = query.order_by(Document.created_at.desc())

    result = await db.execute(query)
    docs = result.scalars().all()

    return [
        {
            "id": str(doc.id),
            "title": doc.title,
            "document_type": doc.document_type,
            "classification_level": doc.classification_level or 1,
            "status": doc.status,
            "case_id": str(doc.case_id),
            "created_at": doc.created_at.isoformat() if doc.created_at else None
        }
        for doc in docs
    ]


# ─── PENDING REVIEWS ────────────────────────────────────────────────────────

@router.get("/pending-reviews")
async def get_pending_reviews(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models import ApprovalRequest, Document
    query = select(ApprovalRequest, Document, User)\
        .join(Document, Document.id == ApprovalRequest.document_id)\
        .join(User, User.id == ApprovalRequest.requester_id)\
        .where(
            ApprovalRequest.reviewer_id == current_user.id,
            ApprovalRequest.status == "PENDING"
        )\
        .order_by(ApprovalRequest.created_at.desc())
        
    result = await db.execute(query)
    rows = result.all()
    
    return [
        {
            "id": str(req.id),
            "document_id": str(doc.id),
            "title": doc.title,
            "document_type": doc.document_type,
            "classification_level": doc.classification_level,
            "requester_email": user.email,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "status": req.status,
            "document_status": doc.status
        }
        for req, doc, user in rows
    ]


# ─── GET DOCUMENT DETAILS ────────────────────────────────────────────────────

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

    # Check access
    from app.core.authorization import check_document_access
    await check_document_access(db, doc, current_user, required_action="VIEW")

    # Log VIEW event
    await log_document_action(db, current_user.id, "DOCUMENT_VIEWED", doc.id, doc.case_id,
                              details={"title": doc.title, "user_email": current_user.email})

    ver_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.id == doc.current_version_id)
    )
    latest_version = ver_result.scalars().first()

    return {
        "id": str(doc.id),
        "title": doc.title,
        "document_type": doc.document_type,
        "classification_level": doc.classification_level or 1,
        "status": doc.status,
        "failure_reason": doc.failure_reason,
        "case_id": str(doc.case_id),
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "raw_ocr_text": latest_version.raw_ocr_text if latest_version else None,
        "structured_data": latest_version.structured_data if latest_version else {},
        "file_hash": latest_version.file_hash if latest_version else None,
        "version_number": latest_version.version_number if latest_version else "1.0"
    }


# ─── DOWNLOAD DOCUMENT ───────────────────────────────────────────────────────

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

    # Check access with DOWNLOAD permission
    from app.core.authorization import check_document_access
    await check_document_access(db, doc, current_user, required_action="DOWNLOAD")

    ver_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.id == doc.current_version_id)
    )
    latest_version = ver_result.scalars().first()
    if not latest_version:
        raise HTTPException(status_code=404, detail="Document version not found")

    try:
        file_bytes = get_storage_file(latest_version.storage_path)
        # Log DOWNLOAD event
        await log_document_action(db, current_user.id, "DOCUMENT_DOWNLOADED", doc.id, doc.case_id,
                                  details={"title": doc.title, "user_email": current_user.email, "version_number": latest_version.version_number})
        filename = f"{doc.title.replace(' ', '_')}.pdf"
        return Response(
            content=file_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"File could not be retrieved: {e}")


# ─── DOCUMENT PERMISSIONS (SHARING) ──────────────────────────────────────────

class SharePayload(BaseModel):
    user_ids: List[str]
    permission_type: Optional[str] = "VIEW"  # VIEW, DOWNLOAD, EDIT


@router.get("/{document_id}/permissions")
async def get_document_permissions(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    perms_result = await db.execute(
        select(DocumentPermission).where(DocumentPermission.document_id == document_id)
    )
    perms = perms_result.scalars().all()

    # Load user details
    users_result = await db.execute(select(User))
    users_map = {str(u.id): {"email": u.email, "role": u.role, "clearance_level": u.clearance_level} for u in users_result.scalars().all()}

    return [
        {
            "id": str(p.id),
            "user_id": str(p.user_id),
            "user_email": users_map.get(str(p.user_id), {}).get("email", "Unknown"),
            "user_role": users_map.get(str(p.user_id), {}).get("role", "Unknown"),
            "user_clearance": users_map.get(str(p.user_id), {}).get("clearance_level", 1),
            "permission_type": p.permission_type,
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in perms
    ]


@router.post("/{document_id}/permissions")
async def share_document(
    document_id: str,
    payload: SharePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Only Admin or case owner can share
    if current_user.role != "Admin":
        case_result = await db.execute(select(Case).where(Case.id == doc.case_id))
        case = case_result.scalar_one_or_none()
        if not case or str(case.owning_officer_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Only the case owner or Admin can share this document.")

    results = []
    from app.models import Notification
    
    for uid in payload.user_ids:
        # Check if permission already exists
        existing = await db.execute(
            select(DocumentPermission).where(
                DocumentPermission.document_id == doc.id,
                DocumentPermission.user_id == uid
            )
        )
        existing_perm = existing.scalar_one_or_none()
        if existing_perm:
            # Update existing permission
            existing_perm.permission_type = payload.permission_type
            results.append({"user_id": uid, "action": "updated", "permission_type": payload.permission_type})
            
            notification = Notification(
                id=uuid.uuid4(),
                user_id=uid,
                message=f"Your access to '{doc.title}' was updated to {payload.permission_type} by {current_user.email}.",
                link=f"/documents?id={doc.id}"
            )
            db.add(notification)
        else:
            new_perm = DocumentPermission(
                id=uuid.uuid4(),
                document_id=doc.id,
                user_id=uid,
                permission_type=payload.permission_type,
                granted_by=current_user.id,
                created_at=datetime.utcnow()
            )
            db.add(new_perm)
            results.append({"user_id": uid, "action": "granted", "permission_type": payload.permission_type})
            
            notification = Notification(
                id=uuid.uuid4(),
                user_id=uid,
                message=f"You received {payload.permission_type} access to '{doc.title}' from {current_user.email}.",
                link=f"/shared-documents?id={doc.id}"
            )
            db.add(notification)

    await db.commit()

    # Audit log
    await log_document_action(db, current_user.id, "DOCUMENT_SHARED", doc.id, doc.case_id,
                              details={"shared_with": payload.user_ids, "permission": payload.permission_type})

    return {"message": f"Permissions updated for {len(payload.user_ids)} user(s).", "results": results}


@router.delete("/{document_id}/permissions/{user_id}")
async def revoke_document_permission(
    document_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Admin":
        result = await db.execute(select(Document).where(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if doc:
            case_result = await db.execute(select(Case).where(Case.id == doc.case_id))
            case = case_result.scalar_one_or_none()
            if not case or str(case.owning_officer_id) != str(current_user.id):
                raise HTTPException(status_code=403, detail="Only the case owner or Admin can revoke permissions.")

    perm_result = await db.execute(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.user_id == user_id
        )
    )
    perm = perm_result.scalar_one_or_none()
    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found")

    await db.delete(perm)
    await db.commit()
    return {"message": "Permission revoked successfully."}


# ─── UPLOAD DOCUMENT ─────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    case_id: str = Form(...),
    title: str = Form(...),
    document_type: str = Form(...),
    classification_level: int = Form(default=1),
    reviewer_id: Optional[str] = Form(None),
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

    if reviewer_id:
        reviewer_result = await db.execute(select(User).where(User.id == reviewer_id))
        reviewer = reviewer_result.scalar_one_or_none()
        if not reviewer or not reviewer.is_active or reviewer.is_deleted:
            raise HTTPException(status_code=400, detail="Selected reviewer is invalid or inactive.")
        if (reviewer.clearance_level or 1) < classification_level:
            raise HTTPException(status_code=400, detail="Reviewer clearance level is lower than the document classification.")

    file_bytes = await file.read()
    file_hash = calculate_sha256(file_bytes)

    # Create Document Record
    new_doc_id = uuid.uuid4()
    new_doc = Document(
        id=new_doc_id,
        case_id=case.id,
        title=title,
        document_type=document_type,
        classification_level=max(1, min(5, classification_level)),
        status="PROCESSING",
        search_vector=func.to_tsvector('english', f"{title} {document_type}")
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)

    # Create DocumentVersion Record
    version_number = "1.0"
    storage_path = f"{case.id}/{new_doc.id}/{version_number}.pdf"

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

    new_doc.current_version_id = new_version.id
    await db.commit()

    if reviewer_id:
        from app.models import ApprovalRequest
        approval_req = ApprovalRequest(
            id=uuid.uuid4(),
            document_id=new_doc.id,
            requester_id=current_user.id,
            reviewer_id=reviewer.id,
            status="PENDING"
        )
        db.add(approval_req)
        await db.commit()

    # Kick off Background Task
    background_tasks.add_task(
        process_document_background,
        document_id=str(new_doc.id),
        version_id=str(new_version.id),
        file_bytes=file_bytes,
        user_id=str(current_user.id)
    )

    # Audit Log
    from app.core.audit import log_audit_event
    await log_audit_event(
        db=db,
        action="DOCUMENT_UPLOADED",
        user_id=current_user.id,
        document_id=new_doc.id,
        case_id=case.id,
        details={"title": title, "classification_level": classification_level, "user_email": current_user.email, "version_number": "1.0", "reviewer_id": reviewer_id}
    )
    await db.commit()

    return {
        "message": "Upload started successfully",
        "document_id": str(new_doc.id),
        "status": "PROCESSING"
    }


# ─── VERSIONS ────────────────────────────────────────────────────────────────

@router.post("/{document_id}/versions")
async def create_document_version(
    background_tasks: BackgroundTasks,
    document_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    from app.core.authorization import check_document_access
    await check_document_access(db, doc, current_user, required_action="EDIT")
    
    if doc.status in ["LOCKED", "PROCESSING"]:
        raise HTTPException(status_code=400, detail=f"Cannot edit document in status: {doc.status}")
        
    # Get current latest version number
    ver_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.id == doc.current_version_id)
    )
    versions = ver_result.scalars().all()
    latest_version_num = float(versions[0].version_number) if versions else 0.0
    new_version_num = f"{latest_version_num + 1.0:.1f}"
    
    file_bytes = await file.read()
    file_hash = calculate_sha256(file_bytes)
    
    storage_path = f"{doc.case_id}/{doc.id}/{new_version_num}.pdf"
    try:
        save_storage_file(storage_path, file_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store file: {e}")
        
    new_version_id = uuid.uuid4()
    new_version = DocumentVersion(
        id=new_version_id,
        document_id=doc.id,
        version_number=new_version_num,
        storage_path=storage_path,
        file_hash=file_hash,
        created_by=current_user.id
    )
    db.add(new_version)
    
    doc.current_version_id = new_version.id
    doc.status = "PROCESSING"
    await db.commit()
    await db.refresh(new_version)
    
    background_tasks.add_task(
        process_document_background,
        document_id=str(doc.id),
        version_id=str(new_version.id),
        file_bytes=file_bytes,
        user_id=str(current_user.id)
    )
    
    await log_document_action(db, current_user.id, "DOCUMENT_VERSION_UPLOADED", doc.id, doc.case_id,
                              details={"version_number": new_version_num, "user_email": current_user.email})
                              
    return {"message": "New version created successfully", "version_id": str(new_version.id), "status": "PROCESSING"}


@router.get("/{document_id}/versions")
async def get_document_versions(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    from app.core.authorization import check_document_access
    await check_document_access(db, doc, current_user, required_action="VIEW")
    
    ver_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == document_id).order_by(DocumentVersion.version_number.desc())
    )
    versions = ver_result.scalars().all()
    
    users_result = await db.execute(select(User))
    users_map = {str(u.id): u.email for u in users_result.scalars().all()}
    
    from app.models import DocumentSignature
    sig_result = await db.execute(select(DocumentSignature).where(DocumentSignature.document_version_id.in_([v.id for v in versions])))
    signed_version_ids = {str(sig.document_version_id) for sig in sig_result.scalars().all()}
    
    return [
        {
            "id": str(v.id),
            "version_number": v.version_number,
            "created_at": v.created_at.isoformat() if hasattr(v, 'created_at') and v.created_at else None,
            "created_by": users_map.get(str(v.created_by), "Unknown"),
            "file_hash": v.file_hash,
            "is_tampered": v.is_tampered,
            "is_current": str(v.id) == str(doc.current_version_id),
            "is_signed": str(v.id) in signed_version_ids
        }
        for v in versions
    ]


@router.post("/{document_id}/versions/{version_id}/restore")
async def restore_document_version(
    background_tasks: BackgroundTasks,
    document_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    from app.core.authorization import check_document_access
    await check_document_access(db, doc, current_user, required_action="EDIT")
    
    if doc.status in ["LOCKED", "PROCESSING"]:
        raise HTTPException(status_code=400, detail=f"Cannot edit document in status: {doc.status}")
        
    ver_result = await db.execute(select(DocumentVersion).where(DocumentVersion.id == version_id))
    old_version = ver_result.scalar_one_or_none()
    if not old_version or str(old_version.document_id) != document_id:
        raise HTTPException(status_code=404, detail="Version not found")
        
    try:
        file_bytes = get_storage_file(old_version.storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not retrieve old version file: {e}")
        
    all_ver_res = await db.execute(
        select(DocumentVersion).where(DocumentVersion.id == doc.current_version_id)
    )
    versions = all_ver_res.scalars().all()
    latest_version_num = float(versions[0].version_number) if versions else 0.0
    new_version_num = f"{latest_version_num + 1.0:.1f}"
    
    storage_path = f"{doc.case_id}/{doc.id}/{new_version_num}.pdf"
    try:
        save_storage_file(storage_path, file_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store file: {e}")
    
    new_version = DocumentVersion(
        id=uuid.uuid4(),
        document_id=doc.id,
        version_number=new_version_num,
        storage_path=storage_path,
        file_hash=old_version.file_hash,
        created_by=current_user.id
    )
    db.add(new_version)
    
    doc.current_version_id = new_version.id
    doc.status = "PROCESSING"
    await db.commit()
    await db.refresh(new_version)
    
    background_tasks.add_task(
        process_document_background,
        document_id=str(doc.id),
        version_id=str(new_version.id),
        file_bytes=file_bytes,
        user_id=str(current_user.id)
    )
    
    await log_document_action(db, current_user.id, "DOCUMENT_RESTORED", doc.id, doc.case_id,
                              details={"source_version": old_version.version_number, "new_version": new_version_num})
                              
    return {"message": "Version restored successfully", "new_version_id": str(new_version.id), "status": "PROCESSING"}


# ─── WORKFLOW / STATUS ────────────────────────────────────────────────────────

class StatusPayload(BaseModel):
    status: str
    reason: Optional[str] = None
    reviewer_id: Optional[str] = None


@router.post("/{document_id}/status")
async def update_document_status(
    document_id: str,
    payload: StatusPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    from app.core.authorization import ROLE_PERMISSIONS, check_document_access
    await check_document_access(db, doc, current_user, required_action="EDIT")
    user_perms = ROLE_PERMISSIONS.get(current_user.role, [])
    
    # State machine logic
    valid_transitions = {
        "READY": ["SUBMITTED"],
        "SUBMITTED": ["UNDER_REVIEW"],
        "UNDER_REVIEW": ["APPROVED", "REJECTED"],
        "APPROVED": ["LOCKED"]
    }
    
    if payload.status not in valid_transitions.get(doc.status, []):
        raise HTTPException(status_code=400, detail=f"Invalid transition from {doc.status} to {payload.status}")
        
    from app.models import ApprovalRequest, Notification
    
    if payload.status == "SUBMITTED":
        if "SUBMIT" not in user_perms:
            raise HTTPException(status_code=403, detail="Role not authorized to submit documents")
        if not payload.reviewer_id:
            raise HTTPException(status_code=400, detail="Reviewer ID is required to submit for approval")
            
        reviewer_result = await db.execute(select(User).where(User.id == payload.reviewer_id))
        reviewer = reviewer_result.scalar_one_or_none()
        if not reviewer or not reviewer.is_active:
            raise HTTPException(status_code=400, detail="Invalid reviewer")
        if (reviewer.clearance_level or 1) < doc.classification_level:
            raise HTTPException(status_code=400, detail="Reviewer clearance level too low")
            
        approval_req = ApprovalRequest(
            id=uuid.uuid4(),
            document_id=doc.id,
            requester_id=current_user.id,
            reviewer_id=reviewer.id,
            status="PENDING"
        )
        db.add(approval_req)
        
        notification = Notification(
            id=uuid.uuid4(),
            user_id=reviewer.id,
            message=f"Document '{doc.title}' has been submitted to you for review.",
            link=f"/documents?id={doc.id}"
        )
        db.add(notification)
            
    if payload.status in ["UNDER_REVIEW", "APPROVED", "REJECTED", "LOCKED"]:
        if "APPROVE" not in user_perms:
            raise HTTPException(status_code=403, detail="Role not authorized to review documents")
            
        req_result = await db.execute(
            select(ApprovalRequest)
            .where(ApprovalRequest.document_id == doc.id, ApprovalRequest.status == "PENDING")
            .order_by(ApprovalRequest.created_at.desc())
        )
        approval_req = req_result.scalars().first()
        
        if approval_req:
            if str(approval_req.reviewer_id) != str(current_user.id) and current_user.role != "Admin":
                raise HTTPException(status_code=403, detail="Only the assigned reviewer or Admin can review this document")
                
            if payload.status in ["APPROVED", "REJECTED"]:
                approval_req.status = payload.status
                approval_req.reviewed_at = datetime.utcnow()
                approval_req.review_comment = payload.reason
                
                # Notify requester
                action_word = "approved" if payload.status == "APPROVED" else "rejected"
                notification = Notification(
                    id=uuid.uuid4(),
                    user_id=approval_req.requester_id,
                    message=f"Your document '{doc.title}' was {action_word} by {current_user.email}.",
                    link=f"/documents?id={doc.id}"
                )
                db.add(notification)
        else:
            # If no approval request exists but we are transitioning...
            case_res = await db.execute(select(Case).where(Case.id == doc.case_id))
            case = case_res.scalar_one_or_none()
            if case and str(case.owning_officer_id) == str(current_user.id) and current_user.role != "Admin":
                raise HTTPException(status_code=403, detail="Investigating officer cannot approve their own document")
            
    doc.status = payload.status
    if payload.status == "REJECTED":
        if not payload.reason:
            raise HTTPException(status_code=400, detail="Rejection reason is required")
        doc.rejection_reason = payload.reason
        
    await db.commit()
    
    action_map = {
        "SUBMITTED": "DOCUMENT_SUBMITTED",
        "UNDER_REVIEW": "DOCUMENT_UNDER_REVIEW",
        "APPROVED": "DOCUMENT_APPROVED",
        "REJECTED": "DOCUMENT_DENIED",
        "LOCKED": "DOCUMENT_LOCKED"
    }
    action = action_map.get(payload.status, f"DOCUMENT_{payload.status}")
    await log_document_action(db, current_user.id, action, doc.id, doc.case_id,
                              details={"new_status": payload.status, "reason": payload.reason})
                              
    return {"message": f"Document status updated to {payload.status}"}



# ─── INTEGRITY & RETRY ────────────────────────────────────────────────────────

@router.post("/{document_id}/verify-integrity")
async def verify_document_integrity(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    from app.core.authorization import check_document_access
    await check_document_access(db, doc, current_user, required_action="VIEW")
    
    ver_result = await db.execute(select(DocumentVersion).where(DocumentVersion.id == doc.current_version_id))
    latest_version = ver_result.scalar_one_or_none()
    if not latest_version:
        raise HTTPException(status_code=404, detail="Current version not found")
        
    try:
        file_bytes = get_storage_file(latest_version.storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File could not be read: {e}")
        
    actual_hash = calculate_sha256(file_bytes)
    expected_hash = latest_version.file_hash
    
    if actual_hash == expected_hash:
        result_status = "VERIFIED"
        latest_version.is_tampered = False
    else:
        result_status = "TAMPERED"
        latest_version.is_tampered = True
        
    await db.commit()
    
    action = "INTEGRITY_CHECK" if result_status == "VERIFIED" else "INTEGRITY_FAILURE"
    await log_document_action(db, current_user.id, action, doc.id, doc.case_id,
                              details={"expected_hash": expected_hash, "actual_hash": actual_hash})
                              
    return {
        "status": result_status,
        "expected_hash": expected_hash,
        "actual_hash": actual_hash,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/{document_id}/retry")
async def retry_document_processing(
    background_tasks: BackgroundTasks,
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    from app.core.authorization import check_document_access
    await check_document_access(db, doc, current_user, required_action="EDIT")
    
    if doc.status != "PROCESSING_FAILED":
        raise HTTPException(status_code=400, detail="Only failed documents can be retried")
        
    if (doc.retry_count or 0) >= 3:
        doc.status = "MANUAL_REVIEW_REQUIRED"
        await db.commit()
        await log_document_action(db, current_user.id, "PROCESSING_FAILURE", doc.id, doc.case_id,
                                  details={"reason": "Maximum retry limit reached"})
        return {"message": "Maximum retry limit reached. Manual review required.", "status": "MANUAL_REVIEW_REQUIRED"}
        
    ver_result = await db.execute(select(DocumentVersion).where(DocumentVersion.id == doc.current_version_id))
    latest_version = ver_result.scalar_one_or_none()
    if not latest_version:
        raise HTTPException(status_code=404, detail="Version not found")
        
    try:
        file_bytes = get_storage_file(latest_version.storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Cannot retry: original file missing")
        
    doc.retry_count = (doc.retry_count or 0) + 1
    doc.status = "PROCESSING"
    await db.commit()
    
    background_tasks.add_task(
        process_document_background,
        document_id=str(doc.id),
        version_id=str(latest_version.id),
        file_bytes=file_bytes,
        user_id=str(current_user.id)
    )
    
    await log_document_action(db, current_user.id, "DOCUMENT_PROCESSING_RETRY", doc.id, doc.case_id,
                              details={"retry_count": doc.retry_count})
                              
    return {"message": "Processing retried", "status": "PROCESSING"}


@router.get("/{document_id}/audit-history")
async def get_document_audit_history(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    from app.core.authorization import check_document_access
    await check_document_access(db, doc, current_user, required_action="VIEW")
    
    logs_result = await db.execute(
        select(AuditLog).where(AuditLog.document_id == document_id).order_by(AuditLog.timestamp.desc())
    )
    logs = logs_result.scalars().all()
    
    users_result = await db.execute(select(User))
    users_map = {str(u.id): {"email": u.email, "role": u.role} for u in users_result.scalars().all()}
    
    return [
        {
            "id": str(l.id),
            "timestamp": l.timestamp.isoformat(),
            "action": l.action,
            "user_email": users_map.get(str(l.user_id), {}).get("email", "System"),
            "details": l.details
        }
        for l in logs
    ]


# ─── DIGITAL SIGNATURES ───────────────────────────────────────────────────────

@router.post("/{document_id}/versions/{version_id}/sign")
async def sign_document_version(
    document_id: str,
    version_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.core.authorization import check_document_access
    from app.core.security import verify_password
    from app.core.config import settings
    from app.models import UserKey, DocumentSignature
    from app.core.audit import log_audit_event
    from cryptography.hazmat.primitives.asymmetric import rsa, padding, utils
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.fernet import Fernet
    import base64
    
    password = payload.get("password")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required for signing authorization.")
        
    if not verify_password(password, current_user.password_hash):
        await log_audit_event(db, "SIGNATURE_ATTEMPT_FAILED", current_user.id, document_id, details={"reason": "Incorrect password", "version": version_id})
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid password.")
        
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Check permissions (requires EDIT)
    await check_document_access(db, doc, current_user, required_action="EDIT")
    
    ver_result = await db.execute(select(DocumentVersion).where(DocumentVersion.id == version_id, DocumentVersion.document_id == document_id))
    version = ver_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
        
    if str(doc.current_version_id) != str(version.id):
        raise HTTPException(status_code=400, detail="Only the current version can be signed.")
        
    # Check if already signed
    sig_check = await db.execute(select(DocumentSignature).where(DocumentSignature.document_version_id == version.id))
    if sig_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This document version is already signed.")
        
    # Integrity Check Before Signing
    try:
        file_bytes = get_storage_file(version.storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File could not be read: {e}")
        
    actual_hash = calculate_sha256(file_bytes)
    if actual_hash != version.file_hash:
        await log_audit_event(db, "SIGNATURE_ATTEMPT_FAILED", current_user.id, document_id, doc.case_id, details={"reason": "Integrity check failed before signing."})
        await db.commit()
        raise HTTPException(status_code=400, detail="Document integrity verification failed. This document cannot be signed.")
        
    # User Key Management
    uk_result = await db.execute(select(UserKey).where(UserKey.user_id == current_user.id))
    user_key = uk_result.scalar_one_or_none()
    
    import hashlib
    fernet_key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode('utf-8')).digest())
    fernet = Fernet(fernet_key)
    
    if not user_key:
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key = private_key.public_key()
        
        priv_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        pub_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        enc_priv = fernet.encrypt(priv_pem).decode('utf-8')
        
        user_key = UserKey(
            user_id=current_user.id,
            public_key_pem=pub_pem.decode('utf-8'),
            encrypted_private_key_pem=enc_priv
        )
        db.add(user_key)
        await db.commit()
        await db.refresh(user_key)
        
    # Sign the hash
    dec_priv_pem = fernet.decrypt(user_key.encrypted_private_key_pem.encode('utf-8'))
    private_key = serialization.load_pem_private_key(dec_priv_pem, password=None)
    
    signature = private_key.sign(
        bytes.fromhex(actual_hash),
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH
        ),
        utils.Prehashed(hashes.SHA256())
    )
    
    sig_b64 = base64.b64encode(signature).decode('utf-8')
    
    doc_sig = DocumentSignature(
        document_version_id=version.id,
        signer_id=current_user.id,
        document_hash=actual_hash,
        signature=sig_b64,
        public_key_pem=user_key.public_key_pem
    )
    db.add(doc_sig)
    
    await log_audit_event(db, "DOCUMENT_SIGNED", current_user.id, document_id, doc.case_id, details={
        "version": version.version_number,
        "document_hash": actual_hash
    })
    
    await db.commit()
    await db.refresh(doc_sig)
    
    return {"message": "Document digitally signed successfully.", "signature_id": str(doc_sig.id)}


@router.get("/{document_id}/versions/{version_id}/verify-signature")
async def verify_document_signature(
    document_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.core.authorization import check_document_access
    from app.models import DocumentSignature
    from app.core.audit import log_audit_event
    from cryptography.hazmat.primitives.asymmetric import padding, utils
    from cryptography.hazmat.primitives import hashes, serialization
    import base64
    
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    await check_document_access(db, doc, current_user, required_action="VIEW")
    
    ver_result = await db.execute(select(DocumentVersion).where(DocumentVersion.id == version_id, DocumentVersion.document_id == document_id))
    version = ver_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
        
    sig_result = await db.execute(select(DocumentSignature).where(DocumentSignature.document_version_id == version.id))
    doc_sig = sig_result.scalar_one_or_none()
    
    if not doc_sig:
        return {"status": "UNSIGNED", "message": "No signature found for this version."}
        
    # Recalculate file hash
    try:
        file_bytes = get_storage_file(version.storage_path)
    except Exception as e:
        await log_audit_event(db, "SIGNATURE_VERIFICATION_FAILED", current_user.id, document_id, doc.case_id, details={"reason": "File missing"})
        await db.commit()
        return {"status": "INVALID", "reason": "Document file is missing or unreadable."}
        
    actual_hash = calculate_sha256(file_bytes)
    
    if actual_hash != doc_sig.document_hash:
        await log_audit_event(db, "SIGNATURE_VERIFICATION_FAILED", current_user.id, document_id, doc.case_id, details={"reason": "Hash mismatch"})
        await db.commit()
        return {"status": "INVALID", "reason": "Document has been modified since it was signed."}
        
    try:
        public_key = serialization.load_pem_public_key(doc_sig.public_key_pem.encode('utf-8'))
        signature_bytes = base64.b64decode(doc_sig.signature)
        
        public_key.verify(
            signature_bytes,
            bytes.fromhex(actual_hash),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            utils.Prehashed(hashes.SHA256())
        )
        
        signer_res = await db.execute(select(User).where(User.id == doc_sig.signer_id))
        signer = signer_res.scalar_one_or_none()
        
        await log_audit_event(db, "SIGNATURE_VERIFIED", current_user.id, document_id, doc.case_id, details={"version": version.version_number})
        await db.commit()
        
        return {
            "status": "VALID",
            "signer": signer.email if signer else "Unknown",
            "timestamp": doc_sig.timestamp.isoformat(),
            "algorithm": "RSA-PSS-SHA256"
        }
    except Exception as e:
        await log_audit_event(db, "SIGNATURE_VERIFICATION_FAILED", current_user.id, document_id, doc.case_id, details={"reason": "Cryptographic verification failed"})
        await db.commit()
        return {"status": "INVALID", "reason": "Cryptographic signature is invalid or corrupted."}
