import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.database import get_db
from app.models import Case, CaseAssignment, User

router = APIRouter(prefix="/cases", tags=["Cases"])


class CaseCreate(BaseModel):
    case_number: str
    jurisdiction: str
    status: Optional[str] = "ACTIVE"
    owning_officer_id: Optional[str] = None


class ReassignCasePayload(BaseModel):
    officer_id: str


class AddAssignmentPayload(BaseModel):
    user_id: str
    assignment_type: Optional[str] = "Investigating Officer"


@router.get("/")
async def list_cases(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Case).order_by(Case.created_at.desc()))
    cases = result.scalars().all()
    
    # Load all users map for fast email lookup
    users_result = await db.execute(select(User))
    users_map = {str(u.id): u.email for u in users_result.scalars().all()}
    
    # Check current user's case assignments
    assignments_res = await db.execute(
        select(CaseAssignment.case_id).where(CaseAssignment.user_id == current_user.id)
    )
    assigned_case_ids = {str(c_id) for c_id in assignments_res.scalars().all()}

    return [
        {
            "id": str(c.id),
            "case_number": c.case_number,
            "status": c.status,
            "jurisdiction": c.jurisdiction,
            "owning_officer_id": str(c.owning_officer_id),
            "owning_officer_email": users_map.get(str(c.owning_officer_id), "Unknown"),
            "is_assigned_to_current_user": (
                current_user.role == "Admin" or 
                str(c.owning_officer_id) == str(current_user.id) or 
                str(c.id) in assigned_case_ids
            ),
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in cases
    ]


@router.post("/")
async def create_case(payload: CaseCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = await db.execute(select(Case).where(Case.case_number == payload.case_number))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Case number already exists")

    owner_id = current_user.id
    if current_user.role == "Admin" and payload.owning_officer_id:
        owner_id = payload.owning_officer_id

    new_case = Case(
        id=uuid.uuid4(),
        case_number=payload.case_number,
        jurisdiction=payload.jurisdiction,
        status=payload.status or "ACTIVE",
        owning_officer_id=owner_id
    )
    db.add(new_case)
    await db.commit()
    await db.refresh(new_case)
    return {
        "id": str(new_case.id),
        "case_number": new_case.case_number,
        "status": new_case.status,
        "jurisdiction": new_case.jurisdiction,
        "owning_officer_id": str(new_case.owning_officer_id)
    }


@router.patch("/{case_id}/reassign")
async def reassign_case(
    case_id: str,
    payload: ReassignCasePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Only Admins can reassign case ownership")

    case_result = await db.execute(select(Case).where(Case.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    target_user_result = await db.execute(select(User).where(User.id == payload.officer_id))
    target_user = target_user_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target officer/user not found")

    case.owning_officer_id = target_user.id
    await db.commit()
    await db.refresh(case)

    return {
        "message": f"Case {case.case_number} successfully reassigned to {target_user.email}",
        "case_id": str(case.id),
        "owning_officer_id": str(case.owning_officer_id),
        "owning_officer_email": target_user.email
    }


@router.post("/{case_id}/assignments")
async def add_case_assignment(
    case_id: str,
    payload: AddAssignmentPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Only Admins can assign users to cases")

    case_result = await db.execute(select(Case).where(Case.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    target_user_result = await db.execute(select(User).where(User.id == payload.user_id))
    target_user = target_user_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target officer/user not found")

    # Check existing
    existing = await db.execute(
        select(CaseAssignment).where(
            CaseAssignment.case_id == case_id,
            CaseAssignment.user_id == payload.user_id
        )
    )
    if existing.scalar_one_or_none():
        return {"message": f"Officer {target_user.email} is already assigned to this case"}

    assignment = CaseAssignment(
        id=uuid.uuid4(),
        case_id=case.id,
        user_id=target_user.id,
        assignment_type=payload.assignment_type or "Investigating Officer"
    )
    db.add(assignment)
    await db.commit()

    return {
        "message": f"Officer {target_user.email} assigned to case {case.case_number}",
        "case_id": str(case.id),
        "user_id": str(target_user.id)
    }


