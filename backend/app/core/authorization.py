from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid

from app.database import get_db
from app.models import User, Case, CaseAssignment, Document
from app.core.security import get_current_user

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: User = Depends(get_current_user)):
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for this role"
            )
        return user

async def verify_case_access(case_id: uuid.UUID, user: User, db: AsyncSession) -> Case:
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    # Check if owner
    if case.owning_officer_id == user.id:
        return case
        
    # Check if assigned or supervisor
    assign_result = await db.execute(
        select(CaseAssignment).where(
            CaseAssignment.case_id == case_id,
            CaseAssignment.user_id == user.id
        )
    )
    assignment = assign_result.scalar_one_or_none()
    
    if not assignment:
        # We also need to log unauthorized access attempts as per requirements.
        # This will be integrated with the audit log system later.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this case")
        
    return case

async def verify_document_access(document_id: uuid.UUID, user: User, db: AsyncSession) -> Document:
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Verify access to the parent case
    await verify_case_access(document.case_id, user, db)
    
    return document
