from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, text
from typing import List

from app.database import get_db
from app.models import Document, Case, User
from app.core.security import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("/documents")
async def search_documents(
    query: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search documents securely across titles, case numbers, document types, and OCR text.
    Works seamlessly on SQLite and PostgreSQL.
    """
    pattern = f"%{query}%"
    
    # Universal SQL query matching title, document_type, or search_vector
    filter_condition = or_(
        Document.title.ilike(pattern),
        Document.document_type.ilike(pattern),
        Document.search_vector.ilike(pattern),
        Case.case_number.ilike(pattern)
    )
    
    query_stmt = select(Document).join(Case, Document.case_id == Case.id).where(filter_condition)
    
    if current_user.role != "Admin":
        query_stmt = query_stmt.where(Case.owning_officer_id == current_user.id)
    
    query_stmt = query_stmt.order_by(Document.created_at.desc())
    
    result = await db.execute(query_stmt)
    documents = result.scalars().all()
    
    return [
        {
            "id": str(doc.id),
            "title": doc.title,
            "document_type": doc.document_type,
            "status": doc.status,
            "case_id": str(doc.case_id),
            "created_at": doc.created_at.isoformat() if doc.created_at else None
        }
        for doc in documents
    ]

