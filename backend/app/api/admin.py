import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import func, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models import User, Case, Document, DocumentPermission, AuditLog, CaseAssignment, DocumentVersion
from app.core.security import get_current_user, get_password_hash
from app.core.authorization import RoleChecker, CLEARANCE_LEVELS
from app.core.audit import log_audit_event

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(RoleChecker(["MANAGE_USERS", "DELETE"]))]
)


# ─── USERS ───────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_all_users(search: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = select(User).where(User.is_deleted == False)
    
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            (cast(User.id, String).ilike(search_term)) |
            (User.public_id.ilike(search_term)) |
            (User.email.ilike(search_term)) |
            (User.department.ilike(search_term)) |
            (User.role.ilike(search_term))
        )
        
    result = await db.execute(query.order_by(User.clearance_level.desc()))
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "public_id": u.public_id,
            "email": u.email,
            "role": u.role,
            "department": u.department,
            "clearance_level": u.clearance_level or 1,
            "clearance_label": CLEARANCE_LEVELS.get(u.clearance_level or 1, {}).get("name", "Level 1"),
            "is_active": u.is_active
        }
        for u in users
    ]


class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    clearance_level: Optional[int] = None
    is_active: Optional[bool] = None


class UserCreate(BaseModel):
    email: str
    password: str
    role: str = "Investigating Officer"
    department: str = "General"
    clearance_level: int = 1


@router.post("/users")
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        id=uuid.uuid4(),
        public_id=f"USR-{uuid.uuid4().hex[:8].upper()}",
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        department=payload.department,
        clearance_level=max(1, min(5, payload.clearance_level)),
        is_active=True,
        is_deleted=False
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    await log_audit_event(
        db=db,
        action="USER_CREATED",
        user_id=new_user.id,
        result="SUCCESS",
        details={"email": new_user.email, "role": new_user.role}
    )
    await db.commit()
    return {
        "id": str(new_user.id),
        "public_id": new_user.public_id,
        "email": new_user.email,
        "role": new_user.role,
        "department": new_user.department,
        "clearance_level": new_user.clearance_level,
        "clearance_label": CLEARANCE_LEVELS.get(new_user.clearance_level, {}).get("name", "Level 1"),
        "is_active": new_user.is_active
    }


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str, 
    payload: UserUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email is not None:
        user.email = payload.email
    if payload.password is not None and len(payload.password) > 0:
        user.password_hash = get_password_hash(payload.password)
    if payload.role is not None:
        user.role = payload.role
    if payload.department is not None:
        user.department = payload.department
    if payload.clearance_level is not None:
        user.clearance_level = max(1, min(5, payload.clearance_level))
    if payload.is_active is not None:
        if payload.is_active is False:
            if user_id == str(current_user.id):
                raise HTTPException(status_code=400, detail="Cannot deactivate your own active session.")
            if user.role == "Admin" and user.is_active:
                admin_count = await db.scalar(select(func.count(User.id)).where(User.role == "Admin", User.is_active == True))
                if admin_count <= 1:
                    raise HTTPException(status_code=400, detail="Cannot deactivate the last active administrator.")
        user.is_active = payload.is_active

    await db.commit()
    await db.refresh(user)

    action = "USER_UPDATED"
    if payload.is_active is not None:
        action = "USER_REACTIVATED" if payload.is_active else "USER_DEACTIVATED"

    await log_audit_event(
        db=db,
        action=action,
        user_id=user.id,
        result="SUCCESS",
        details={"email": user.email, "role": user.role, "is_active": user.is_active}
    )
    await db.commit()
    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "department": user.department,
        "clearance_level": user.clearance_level,
        "clearance_label": CLEARANCE_LEVELS.get(user.clearance_level, {}).get("name", "Level 1"),
        "is_active": user.is_active
    }


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if user_id == str(current_user.id):
        raise HTTPException(status_code=400, detail="Cannot delete or deactivate your own active session.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "Admin" and user.is_active:
        admin_count = await db.scalar(select(func.count(User.id)).where(User.role == "Admin", User.is_active == True))
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete or deactivate the last active administrator.")

    user.preserved_email = user.email
    user.email = f"deleted_{uuid.uuid4().hex[:8]}@dms.local"
    user.password_hash = "DELETED"
    user.is_active = False
    user.is_deleted = True
    
    await db.commit()

    await log_audit_event(
        db=db,
        action="USER_DELETED",
        user_id=user.id,
        result="SUCCESS",
        details={"preserved_email": user.preserved_email, "public_id": user.public_id}
    )
    await db.commit()

    return {"message": "User permanently deleted."}


# ─── CASES ───────────────────────────────────────────────────────────────────

@router.get("/cases")
async def list_all_cases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Case))
    cases = result.scalars().all()
    users_result = await db.execute(select(User))
    users_map = {str(u.id): u.email for u in users_result.scalars().all()}
    return [
        {
            "id": str(c.id),
            "case_number": c.case_number,
            "status": c.status,
            "jurisdiction": c.jurisdiction,
            "owning_officer_id": str(c.owning_officer_id),
            "owning_officer_email": users_map.get(str(c.owning_officer_id), "Unknown"),
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in cases
    ]


@router.delete("/cases/{case_id}")
async def delete_case(case_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        await db.delete(case)
        await db.commit()
        return {"message": "Case deleted"}
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this case because it is linked to existing documents or audit logs."
        )


# ─── DOCUMENTS ───────────────────────────────────────────────────────────────

@router.get("/documents")
async def list_all_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document))
    return result.scalars().all()


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.commit()
    return {"message": "Document deleted"}


@router.get("/documents/{document_id}/access-history")
async def get_document_access_history(
    document_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Returns chronological access history (VIEW + DOWNLOAD events) for a specific document."""
    doc_result = await db.execute(select(Document).where(Document.id == document_id))
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    logs_result = await db.execute(
        select(AuditLog).where(
            AuditLog.document_id == document_id,
            AuditLog.action.in_(["VIEW", "DOWNLOAD", "SHARE"])
        ).order_by(AuditLog.timestamp.desc())
    )
    logs = logs_result.scalars().all()

    users_result = await db.execute(select(User))
    users_map = {str(u.id): {"email": u.email, "role": u.role} for u in users_result.scalars().all()}

    return {
        "document_id": document_id,
        "document_title": doc.title,
        "total_views": sum(1 for l in logs if l.action == "VIEW"),
        "total_downloads": sum(1 for l in logs if l.action == "DOWNLOAD"),
        "access_records": [
            {
                "id": str(l.id),
                "timestamp": l.timestamp.isoformat(),
                "action": l.action,
                "user_id": str(l.user_id) if l.user_id else None,
                "user_email": users_map.get(str(l.user_id), {}).get("email", "Unknown"),
                "user_role": users_map.get(str(l.user_id), {}).get("role", "Unknown"),
                "details": l.details
            }
            for l in logs
        ]
    }


# ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

@router.get("/audit-logs")
async def list_audit_logs(
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    document_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Enhanced audit log with filtering and summary analytics."""
    query = select(AuditLog).order_by(AuditLog.timestamp.desc())

    if action and action != "ALL":
        query = query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if document_id:
        query = query.where(AuditLog.document_id == document_id)

    result = await db.execute(query)
    logs = result.scalars().all()

    users_result = await db.execute(select(User))
    users_map = {str(u.id): {"email": u.email, "role": u.role, "clearance_level": u.clearance_level} for u in users_result.scalars().all()}

    docs_result = await db.execute(select(Document))
    docs_map = {str(d.id): d.title for d in docs_result.scalars().all()}

    # Summary metrics
    total = len(logs)
    total_views = sum(1 for l in logs if l.action == "VIEW")
    total_downloads = sum(1 for l in logs if l.action == "DOWNLOAD")
    total_uploads = sum(1 for l in logs if l.action == "UPLOAD")
    total_logins = sum(1 for l in logs if l.action == "LOGIN")
    total_shares = sum(1 for l in logs if l.action == "SHARE")
    unique_users = len(set(str(l.user_id) for l in logs if l.user_id))

    return {
        "summary": {
            "total": total,
            "views": total_views,
            "downloads": total_downloads,
            "uploads": total_uploads,
            "logins": total_logins,
            "shares": total_shares,
            "unique_users": unique_users
        },
        "logs": [
            {
                "id": str(l.id),
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                "action": l.action,
                "result": l.result,
                "user_id": str(l.user_id) if l.user_id else None,
                "user_email": users_map.get(str(l.user_id), {}).get("email", "System"),
                "user_role": users_map.get(str(l.user_id), {}).get("role", "System"),
                "user_clearance": users_map.get(str(l.user_id), {}).get("clearance_level", 1),
                "document_id": str(l.document_id) if l.document_id else None,
                "document_title": docs_map.get(str(l.document_id), None) if l.document_id else None,
                "case_id": str(l.case_id) if l.case_id else None,
                "details": l.details,
                "current_hash": (l.current_hash or "")[:16]
            }
            for l in logs
        ]
    }


@router.get("/audit-logs/verify-chain")
async def verify_audit_chain(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["MANAGE_USERS"]))
):
    from app.core.authorization import RoleChecker
    
    import json
    import hashlib
    
    query = select(AuditLog).order_by(AuditLog.timestamp.asc(), AuditLog.id.asc())
    result = await db.execute(query)
    logs = result.scalars().all()
    
    expected_previous_hash = None
    
    for log in logs:
        # 1. Verify previous_hash link
        if log.previous_hash != expected_previous_hash:
            return {
                "status": "BROKEN",
                "broken_at_id": str(log.id),
                "reason": f"previous_hash mismatch. Expected {expected_previous_hash}, got {log.previous_hash}"
            }
            
        # 2. Recalculate current_hash
        payload_dict = {
            "id": str(log.id),
            "timestamp": log.timestamp.isoformat(),
            "action": log.action,
            "user_id": str(log.user_id) if log.user_id else None,
            "document_id": str(log.document_id) if log.document_id else None,
            "case_id": str(log.case_id) if log.case_id else None,
            "result": log.result,
            "details": log.details or {},
            "previous_hash": log.previous_hash
        }
        
        canonical_payload = json.dumps(payload_dict, sort_keys=True, separators=(',', ':'))
        sha256_hash = hashlib.sha256()
        sha256_hash.update(canonical_payload.encode('utf-8'))
        calculated_hash = sha256_hash.hexdigest()
        
        if calculated_hash != log.current_hash:
            return {
                "status": "BROKEN",
                "broken_at_id": str(log.id),
                "reason": f"current_hash mismatch. Data has been modified."
            }
            
        expected_previous_hash = log.current_hash
        
    return {
        "status": "VALID",
        "broken_at_id": None,
        "reason": None,
        "total_verified": len(logs)
    }

