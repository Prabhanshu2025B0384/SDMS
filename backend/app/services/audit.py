from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from app.models import AuditLog
import hashlib
import json
from datetime import datetime

async def create_audit_log(
    db: AsyncSession,
    action: str,
    result: str,
    user_id=None,
    case_id=None,
    document_id=None,
    version_id=None,
    details=None
):
    # Fetch the last audit log for the chain
    query = select(AuditLog.hash).order_by(desc(AuditLog.created_at)).limit(1)
    db_result = await db.execute(query)
    last_hash = db_result.scalar_one_or_none()
    
    # Prepare data for hashing
    data = {
        "user_id": str(user_id) if user_id else None,
        "action": action,
        "case_id": str(case_id) if case_id else None,
        "document_id": str(document_id) if document_id else None,
        "version_id": version_id,
        "result": result,
        "details": details,
        "previous_hash": last_hash
    }
    
    # Calculate new hash
    data_str = json.dumps(data, sort_keys=True)
    new_hash = hashlib.sha256(data_str.encode('utf-8')).hexdigest()
    
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        case_id=case_id,
        document_id=document_id,
        version_id=version_id,
        result=result,
        details=details,
        hash=new_hash,
        previous_hash=last_hash
    )
    
    db.add(audit_log)
    # We commit in the caller, but can flush here
    await db.flush()
    return audit_log
