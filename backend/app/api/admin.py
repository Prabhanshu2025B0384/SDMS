from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models import User, Case, Document, AuditLog
from app.core.security import get_current_user, get_password_hash
from app.core.authorization import RoleChecker

router = APIRouter(
    prefix="/admin", 
    tags=["Admin"],
    dependencies=[Depends(RoleChecker(["MANAGE_USERS", "DELETE"]))]
)

# ---- USERS ----
@router.get("/users")
async def list_all_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()

class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None

@router.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, db: AsyncSession = Depends(get_db)):
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
    if payload.is_active is not None:
        user.is_active = payload.is_active
        
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        await db.delete(user)
        await db.commit()
        return {"message": "User deleted"}
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete this user because they are linked to existing cases, documents, or audit logs."
        )

# ---- CASES ----
@router.get("/cases")
async def list_all_cases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Case))
    return result.scalars().all()

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

# ---- DOCUMENTS ----
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

# ---- AUDIT LOGS ----
@router.get("/audit-logs")
async def list_audit_logs(db: AsyncSession = Depends(get_db)):
    # Admin can view all audit logs
    result = await db.execute(select(AuditLog).order_by(AuditLog.timestamp.desc()))
    return result.scalars().all()
