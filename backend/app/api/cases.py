from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid

from app.database import get_db
from app.models import Case, User, CaseAssignment
from app.schemas.case import CaseCreate, CaseResponse, CaseAssignmentCreate
from app.core.security import get_current_user
from app.core.authorization import RoleChecker, verify_case_access

router = APIRouter()

@router.post("/", response_model=CaseResponse)
async def create_case(
    case_in: CaseCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(RoleChecker(["Investigating Officer", "Senior Officer", "Admin"]))
):
    new_case = Case(
        case_number=case_in.case_number,
        jurisdiction=case_in.jurisdiction,
        owning_officer_id=user.id,
        status="CREATED"
    )
    db.add(new_case)
    await db.commit()
    await db.refresh(new_case)
    return new_case

@router.get("/", response_model=List[CaseResponse])
async def list_cases(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # User can see cases they own OR are assigned to
    # A more complex query could be used here to join case_assignments
    query = select(Case).outerjoin(CaseAssignment).where(
        (Case.owning_officer_id == user.id) | 
        (CaseAssignment.user_id == user.id)
    ).distinct()
    
    result = await db.execute(query)
    cases = result.scalars().all()
    return cases

@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    case = await verify_case_access(case_id, user, db)
    return case

@router.post("/{case_id}/assignments")
async def assign_officer(
    case_id: uuid.UUID,
    assignment_in: CaseAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(RoleChecker(["Senior Officer", "Admin"]))
):
    case = await verify_case_access(case_id, user, db)
    
    assignment = CaseAssignment(
        case_id=case_id,
        user_id=assignment_in.user_id,
        assignment_type=assignment_in.assignment_type
    )
    db.add(assignment)
    await db.commit()
    return {"status": "success"}
