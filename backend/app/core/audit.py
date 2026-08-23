import hashlib
import json
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import AuditLog


async def log_audit_event(
    db: AsyncSession,
    action: str,
    user_id=None,
    document_id=None,
    case_id=None,
    result: str = "SUCCESS",
    details: dict = None
):
    """
    Creates a cryptographically chained audit log record.
    Uses PostgreSQL transaction isolation to ensure sequential consistency.
    """
    timestamp = datetime.utcnow()
    
    # Lock the most recent audit log to ensure sequential chain
    # using FOR UPDATE to prevent race conditions.
    query = select(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).with_for_update().limit(1)
    res = await db.execute(query)
    last_audit = res.scalar_one_or_none()
    
    previous_hash = last_audit.current_hash if last_audit else None
    
    audit_id = uuid.uuid4()
    
    # Canonical payload for SHA-256
    payload_dict = {
        "id": str(audit_id),
        "timestamp": timestamp.isoformat(),
        "action": action,
        "user_id": str(user_id) if user_id else None,
        "document_id": str(document_id) if document_id else None,
        "case_id": str(case_id) if case_id else None,
        "result": result,
        "details": details or {},
        "previous_hash": previous_hash
    }
    
    # Deterministic JSON serialization
    canonical_payload = json.dumps(payload_dict, sort_keys=True, separators=(',', ':'))
    
    sha256_hash = hashlib.sha256()
    sha256_hash.update(canonical_payload.encode('utf-8'))
    current_hash = sha256_hash.hexdigest()
    
    audit = AuditLog(
        id=audit_id,
        timestamp=timestamp,
        user_id=user_id,
        action=action,
        document_id=document_id,
        case_id=case_id,
        result=result,
        details=details or {},
        previous_hash=previous_hash,
        current_hash=current_hash
    )
    
    db.add(audit)
    
    # We do NOT commit here. The caller should commit to ensure atomicity with 
    # whatever business logic triggered the audit event.
    return audit
