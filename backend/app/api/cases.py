from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import Case, User
from app.core.security import get_current_user

router = APIRouter(prefix="/cases", tags=["Cases"])

@router.get("/")
async def list_cases(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Case))
    return result.scalars().all()
