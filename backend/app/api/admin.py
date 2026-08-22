from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import User, Case, Document, AuditLog
from app.core.security import get_current_user
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

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"message": "User deleted"}

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
    await db.delete(case)
    await db.commit()
    return {"message": "Case deleted"}

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
