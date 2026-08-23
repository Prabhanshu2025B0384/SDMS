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
    """Helper to log document-level audit events (VIEW, DOWNLOAD, SHARE, etc.)."""
    audit = AuditLog(
        id=uuid.uuid4(),
        timestamp=datetime.utcnow(),
        user_id=user_id,
        action=action,
        document_id=document_id,
        case_id=case_id,
        result=result,
        details=details or {},
        current_hash=f"{action}_{str(document_id)}_{str(user_id)}_{datetime.utcnow().timestamp()}"
    )
    db.add(audit)
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
                version.raw_ocr_text = extracted.get("raw_text", "")
                version.structured_data = extracted.get("structured_data", {})
                await session.commit()

            doc_result = await session.execute(
                select(Document).where(Document.id == document_id)
            )
            doc = doc_result.scalar_one_or_none()
            if doc:
                doc.status = "READY"
                doc.search_vector = f"{doc.title} {doc.document_type} {extracted.get('raw_text', '')[:500]}"
                await session.commit()
                print(f"Successfully processed document {document_id} to status READY")
    except Exception as e:
        print(f"Background processing error for {document_id}: {e}")
        try:
            async with AsyncSessionLocal() as session:
                doc_result = await session.execute(select(Document).where(Document.id == document_id))
                doc = doc_result.scalar_one_or_none()
                if doc:
                    doc.status = "READY"
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

@router.get("/")
async def get_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "Admin":
        query = select(Document).order_by(Document.created_at.desc())
    else:
        from app.models import CaseAssignment, DocumentPermission
        from sqlalchemy import or_
        assigned_case_ids_subquery = select(CaseAssignment.case_id).where(CaseAssignment.user_id == current_user.id)
        explicitly_shared_doc_ids = select(DocumentPermission.document_id).where(DocumentPermission.user_id == current_user.id)
        query = select(Document).join(Case).where(
            or_(
                Case.owning_officer_id == current_user.id,
                Document.case_id.in_(assigned_case_ids_subquery),
                Document.id.in_(explicitly_shared_doc_ids)
            )
        ).order_by(Document.created_at.desc())

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
    await log_document_action(db, current_user.id, "VIEW", doc.id, doc.case_id,
                              details={"title": doc.title, "user_email": current_user.email})

    ver_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == document_id).order_by(DocumentVersion.created_at.desc())
    )
    latest_version = ver_result.scalars().first()

    return {
        "id": str(doc.id),
        "title": doc.title,
        "document_type": doc.document_type,
        "classification_level": doc.classification_level or 1,
        "status": doc.status,
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
        select(DocumentVersion).where(DocumentVersion.document_id == document_id).order_by(DocumentVersion.created_at.desc())
    )
    latest_version = ver_result.scalars().first()
    if not latest_version:
        raise HTTPException(status_code=404, detail="Document version not found")

    try:
        file_bytes = get_storage_file(latest_version.storage_path)
        # Log DOWNLOAD event
        await log_document_action(db, current_user.id, "DOWNLOAD", doc.id, doc.case_id,
                                  details={"title": doc.title, "user_email": current_user.email})
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

    await db.commit()

    # Audit log
    await log_document_action(db, current_user.id, "SHARE", doc.id, doc.case_id,
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

    # Create Document Record
    new_doc_id = uuid.uuid4()
    new_doc = Document(
        id=new_doc_id,
        case_id=case.id,
        title=title,
        document_type=document_type,
        classification_level=max(1, min(5, classification_level)),
        status="PROCESSING",
        search_vector=f"{title} {document_type}"
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

    # Kick off Background Task
    background_tasks.add_task(
        process_document_background,
        document_id=str(new_doc.id),
        version_id=str(new_version.id),
        file_bytes=file_bytes,
        user_id=str(current_user.id)
    )

    # Audit Log
    audit = AuditLog(
        id=uuid.uuid4(),
        user_id=current_user.id,
        action="UPLOAD",
        document_id=new_doc.id,
        case_id=case.id,
        result="SUCCESS",
        details={"title": title, "classification_level": classification_level, "user_email": current_user.email},
        current_hash=file_hash
    )
    db.add(audit)
    await db.commit()

    return {
        "message": "Upload started successfully",
        "document_id": str(new_doc.id),
        "status": "PROCESSING"
    }
