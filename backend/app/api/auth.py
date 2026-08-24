import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import User
from app.core.audit import log_audit_event
from app.core.security import verify_password, get_password_hash, create_access_token, get_current_user
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


class PasswordChangePayload(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        await log_audit_event(
            db=db,
            action="LOGIN_FAILED",
            result="FAILURE",
            details={"email": form_data.username, "reason": "Incorrect credentials"}
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active or user.is_deleted:
        await log_audit_event(
            db=db,
            action="LOGIN_FAILED",
            user_id=user.id,
            result="FAILURE",
            details={"email": user.email, "reason": "Account deactivated or deleted"}
        )
        await db.commit()
        raise HTTPException(status_code=403, detail="Account is deactivated or deleted")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    # Log Login Audit
    await log_audit_event(
        db=db,
        action="LOGIN_SUCCESS",
        user_id=user.id,
        result="SUCCESS",
        details={"email": user.email, "role": user.role, "clearance_level": user.clearance_level}
    )
    await db.commit()

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "department": current_user.department or "General",
        "clearance_level": current_user.clearance_level or (5 if current_user.role == "Admin" else 1),
        "is_active": current_user.is_active
    }


@router.post("/change-password")
async def change_password(
    payload: PasswordChangePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password does not match.")

    if len(payload.new_password) < 3:
        raise HTTPException(status_code=400, detail="New password must be at least 3 characters long.")

    current_user.password_hash = get_password_hash(payload.new_password)
    
    # Audit log
    await log_audit_event(
        db=db,
        action="PASSWORD_CHANGE",
        user_id=current_user.id,
        result="SUCCESS",
        details={"email": current_user.email}
    )
    await db.commit()
    await db.refresh(current_user)

    return {"message": "Password changed successfully."}


@router.post("/signup")
async def signup(
    email: str, 
    password: str, 
    full_name: str, 
    role: str = "Investigating Officer",
    department: str = "General",
    clearance_level: int = 1,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = get_password_hash(password)
    new_user = User(
        id=uuid.uuid4(),
        email=email, 
        password_hash=hashed_password, 
        role=role,
        department=department or "General",
        clearance_level=clearance_level or (5 if role == "Admin" else 1),
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return {
        "message": "User created successfully",
        "id": str(new_user.id),
        "email": new_user.email,
        "clearance_level": new_user.clearance_level
    }


@router.get("/search")
async def search_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import or_, and_
    if not q or len(q) < 2:
        return []
    
    query = select(User).where(
        and_(
            User.is_active == True,
            User.is_deleted == False,
            or_(
                User.email.ilike(f"%{q}%"),
                User.department.ilike(f"%{q}%"),
                User.role.ilike(f"%{q}%")
            )
        )
    ).limit(20)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "role": u.role,
            "department": u.department,
            "clearance_level": u.clearance_level or 1
        }
        for u in users
    ]
