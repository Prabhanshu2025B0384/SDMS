from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from typing import List

from app.database import get_db
from app.models import User, Document, Case, CaseAssignment
from app.core.security import get_current_user
from pydantic import BaseModel
import uuid

router = APIRouter()

class SearchResult(BaseModel):
    document_id: uuid.UUID
    case_id: uuid.UUID
    snippet: str

@router.get("/", response_model=List[SearchResult])
async def search_documents(
    q: str = Query(..., min_length=3),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Determine the user's accessible cases
    accessible_cases_query = select(Case.id).outerjoin(CaseAssignment).where(
        (Case.owning_officer_id == user.id) | 
        (CaseAssignment.user_id == user.id)
    )
    
    # We use websearch_to_tsquery for safe query parsing
    search_query = """
    SELECT 
        d.id as document_id, 
        d.case_id as case_id,
        ts_headline('english', v.raw_ocr_text, websearch_to_tsquery('english', :query)) as snippet
    FROM documents d
    JOIN document_versions v ON d.current_version_id = v.id
    WHERE 
        d.case_id IN ({})
        AND d.search_vector @@ websearch_to_tsquery('english', :query)
    ORDER BY ts_rank(d.search_vector, websearch_to_tsquery('english', :query)) DESC
    LIMIT 20
    """
    
    # Because IN clause with a subquery is safest for SQLAlchemy core vs text
    # we'll build this query cleanly with SQLAlchemy:
    from sqlalchemy import func
    
    # Use SQLAlchemy constructs for safety
    tsquery = func.websearch_to_tsquery('english', q)
    
    stmt = (
        select(
            Document.id.label("document_id"),
            Document.case_id.label("case_id"),
            func.ts_headline('english', DocumentVersion.raw_ocr_text, tsquery).label("snippet")
        )
        .join(DocumentVersion, Document.current_version_id == DocumentVersion.id)
        .where(Document.case_id.in_(accessible_cases_query))
        .where(Document.search_vector.op('@@')(tsquery))
        .order_by(func.ts_rank(Document.search_vector, tsquery).desc())
        .limit(20)
    )
    
    result = await db.execute(stmt)
    rows = result.all()
    
    return [
        SearchResult(
            document_id=row.document_id,
            case_id=row.case_id,
            snippet=row.snippet
        ) for row in rows
    ]
