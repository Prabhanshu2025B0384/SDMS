from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from typing import List

from app.database import get_db
from app.models import Document, User
from app.core.security import get_current_user

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("/documents")
async def search_documents(
    query: str = Query(..., min_length=3),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search documents securely.
    """
    query_stmt = select(Document).where(
        text("search_vector @@ websearch_to_tsquery('english', :query)")
    ).params(query=query)
    
    if current_user.role != "Admin":
        from app.models import Case
        query_stmt = query_stmt.join(Case).where(Case.owning_officer_id == current_user.id)
    
    result = await db.execute(query_stmt)
    documents = result.scalars().all()
    
    return [
        {
            "id": str(doc.id),
            "title": doc.title,
            "document_type": doc.document_type,
            "status": doc.status,
            "case_id": str(doc.case_id)
        }
        for doc in documents
    ]
