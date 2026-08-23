import asyncio
from app.database import AsyncSessionLocal
from app.models import DocumentVersion, Document, AuditLog
from sqlalchemy import select, update

async def main():
    async with AsyncSessionLocal() as session:
        # Get all versions
        result = await session.execute(select(DocumentVersion))
        versions = result.scalars().all()
        
        for version in versions:
            # Find the upload event in AuditLog
            audit_res = await session.execute(
                select(AuditLog).where(
                    AuditLog.document_id == version.document_id,
                    AuditLog.action.in_(["DOCUMENT_UPLOADED", "DOCUMENT_VERSION_UPLOADED"])
                ).order_by(AuditLog.timestamp.asc())
            )
            logs = audit_res.scalars().all()
            
            # Match version
            matched_log = None
            for log in logs:
                details = log.details or {}
                if details.get("version_number") == version.version_number:
                    matched_log = log
                    break
            
            if matched_log:
                version.created_at = matched_log.timestamp
            else:
                # fallback to document creation date
                doc_res = await session.execute(select(Document).where(Document.id == version.document_id))
                doc = doc_res.scalar_one_or_none()
                if doc:
                    version.created_at = doc.created_at
                    
        await session.commit()
        print("Updated timestamps.")

if __name__ == "__main__":
    asyncio.run(main())
