import asyncio
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.models import AuditLog
from app.database import AsyncSessionLocal
import json
import hashlib

async def rebuild_chain():
    async with AsyncSessionLocal() as db:
        query = select(AuditLog).order_by(AuditLog.timestamp.asc(), AuditLog.id.asc())
        result = await db.execute(query)
        logs = result.scalars().all()

        expected_previous_hash = None

        for log in logs:
            log.previous_hash = expected_previous_hash

            payload_dict = {
                "id": str(log.id),
                "timestamp": log.timestamp.isoformat(),
                "action": log.action,
                "user_id": str(log.user_id) if log.user_id else None,
                "document_id": str(log.document_id) if log.document_id else None,
                "case_id": str(log.case_id) if log.case_id else None,
                "result": log.result,
                "details": log.details or {},
                "previous_hash": log.previous_hash
            }

            canonical_payload = json.dumps(payload_dict, sort_keys=True, separators=(',', ':'))
            sha256_hash = hashlib.sha256()
            sha256_hash.update(canonical_payload.encode('utf-8'))
            log.current_hash = sha256_hash.hexdigest()

            expected_previous_hash = log.current_hash

        await db.commit()
        print(f"Rebuilt chain for {len(logs)} logs.")

if __name__ == "__main__":
    asyncio.run(rebuild_chain())
