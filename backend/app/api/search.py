from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, text, func
from typing import List, Optional

from app.database import get_db
from app.models import Document, Case, User
from app.core.security import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("/documents")
async def search_documents(
    query: Optional[str] = Query(None),
    classification_level: Optional[int] = Query(None),
    document_type: Optional[str] = Query(None),
    case_reference: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search documents securely across titles, case numbers, document types, and OCR text.
    Works seamlessly on PostgreSQL.
    """
    from app.models import DocumentVersion
    
    # 1. Base query joins Document, Case, and DocumentVersion
    query_stmt = (
        select(
            Document,
            Case,
            DocumentVersion.raw_ocr_text
        )
        .join(Case, Document.case_id == Case.id)
        .outerjoin(
            DocumentVersion, 
            (DocumentVersion.document_id == Document.id) & 
            (Document.current_version_id == DocumentVersion.id)
        )
    )

    # Apply authorization
    from app.core.authorization import get_authorized_document_filter
    auth_filter = get_authorized_document_filter(current_user)
    if auth_filter is not True:
        query_stmt = query_stmt.where(auth_filter)

    # 2. Add optional filters
    if classification_level:
        query_stmt = query_stmt.where(Document.classification_level == classification_level)
    
    if document_type and document_type.lower() != "all types":
        query_stmt = query_stmt.where(Document.document_type == document_type)

    if case_reference:
        query_stmt = query_stmt.where(Case.case_number.ilike(f"%{case_reference}%"))

    # 3. Add text search if provided
    if query and query.strip():
        # Split by comma and filter out empty terms
        terms = [t.strip() for t in query.split(",") if t.strip()]
        
        for term in terms:
            tsquery = func.websearch_to_tsquery('english', term)
            
            from sqlalchemy import cast, String
            
            term_filter = or_(
                Document.search_vector.op('@@')(tsquery),
                Case.case_number.ilike(f"%{term}%"),
                Document.title.ilike(f"%{term}%"),
                cast(DocumentVersion.structured_data, String).ilike(f"%{term}%")
            )
            query_stmt = query_stmt.where(term_filter)
            
        # Optional: Keep sorting logic based on the primary full query if it matches OCR
        primary_tsquery = func.websearch_to_tsquery('english', query)
        query_stmt = query_stmt.order_by(func.ts_rank(Document.search_vector, primary_tsquery).desc(), Document.created_at.desc())
    else:
        query_stmt = query_stmt.order_by(Document.created_at.desc())
        
    result = await db.execute(query_stmt)
    
    # Parse rows containing (Document, Case, raw_ocr_text)
    documents_data = []
    for row in result.all():
        doc = row[0]
        case_obj = row[1]
        ocr_text = row[2] or ""
        # Simple snippet generation if query is present
        snippet = ""
        if query and query.strip():
            # very basic snippet logic since we aren't fetching ts_headline
            idx = ocr_text.lower().find(query.lower())
            if idx != -1:
                start = max(0, idx - 40)
                end = min(len(ocr_text), idx + len(query) + 40)
                snippet = "..." + ocr_text[start:end] + "..."
            else:
                snippet = doc.title
        
        documents_data.append({
            "id": str(doc.id),
            "title": doc.title,
            "document_type": doc.document_type,
            "classification_level": doc.classification_level or 1,
            "status": doc.status,
            "case_id": case_obj.case_number,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "snippet": snippet if snippet else ""
        })
    
    return documents_data
    


