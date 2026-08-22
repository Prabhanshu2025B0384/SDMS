from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models import User
from app.core.security import verify_password, create_access_token

router = APIRouter()

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # In this context, form_data.username is typically the email
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Issue JWT containing user ID, role, and department
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role, "department": user.department}
    )
    return {"access_token": access_token, "token_type": "bearer"}

from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str
    department: str

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    from app.core.security import get_password_hash
    
    if not user_in.email.endswith("@gmail.com"):
        raise HTTPException(
            status_code=400,
            detail="Only @gmail.com email addresses are allowed for sign up."
        )
        
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists."
        )
        
    new_user = User(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role,
        department=user_in.department,
        is_active=True
    )
    
    db.add(new_user)
    await db.commit()
    
    return {"message": "User created successfully"}
