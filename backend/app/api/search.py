from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from typing import List

from app.database import get_db
from app.models import Document, User
from app.core.security import get_current_user

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("/")
async def search_documents(
    q: str = Query(..., min_length=3),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Perform full text search on documents using PostgreSQL native websearch_to_tsquery.
    """
    # Simple direct string query against the tsvector column using SQLAlchemy raw text
    # In production, we'd parameterize safely to avoid SQL injection, but websearch_to_tsquery is safe.
    query = select(Document).where(
        text("search_vector @@ websearch_to_tsquery('english', :q)")
    ).params(q=q)
    
    result = await db.execute(query)
    documents = result.scalars().all()
    
    return documents
