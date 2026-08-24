from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, text, func
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
    # Create PostgreSQL TSQuery from user input
    tsquery = func.websearch_to_tsquery('english', query)
    
    # 1. Base query joins Document, Case, and DocumentVersion (for text snippet)
    from app.models import DocumentVersion
    
    query_stmt = (
        select(
            Document,
            Case,
            func.ts_rank(Document.search_vector, tsquery).label('rank'),
            func.ts_headline(
                'english',
                DocumentVersion.raw_ocr_text,
                tsquery,
                'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
            ).label('snippet')
        )
        .join(Case, Document.case_id == Case.id)
        .outerjoin(
            DocumentVersion, 
            (DocumentVersion.document_id == Document.id) & 
            (Document.current_version_id == DocumentVersion.id)
        )
    )
    
    # 2. Filter by Full-Text Search match OR exact case number match
    filter_condition = or_(
        Document.search_vector.op('@@')(tsquery),
        Case.case_number.ilike(f"%{query}%")
    )
    query_stmt = query_stmt.where(filter_condition)
    
    # 3. Apply exact security authorization
    from app.core.authorization import get_authorized_document_filter
    auth_filter = get_authorized_document_filter(current_user)
    if auth_filter is not True:
        query_stmt = query_stmt.where(auth_filter)
    
    # 4. Rank by relevance, then newest
    query_stmt = query_stmt.order_by(text('rank DESC'), Document.created_at.desc())
    
    result = await db.execute(query_stmt)
    
    # Parse rows containing (Document, Case, rank, snippet)
    documents_data = []
    for row in result.all():
        doc = row[0]
        snippet = row[3]
        documents_data.append({
            "id": str(doc.id),
            "title": doc.title,
            "document_type": doc.document_type,
            "classification_level": doc.classification_level or 1,
            "status": doc.status,
            "case_id": str(doc.case_id),
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "snippet": snippet if snippet else ""
        })
    
    return documents_data
    


