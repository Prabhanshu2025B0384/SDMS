import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, select, func
from app.core.config import settings
from app.models import User, Case, Document, DocumentVersion, AuditLog, DocumentPermission, CaseAssignment

async def verify():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    # 1. Trigger lifespan to ensure initialization runs
    from app.main import lifespan
    from fastapi import FastAPI
    app = FastAPI()
    
    async with lifespan(app):
        # 2. Check counts
        async with AsyncSessionLocal() as session:
            users_count = await session.scalar(select(func.count()).select_from(User))
            cases_count = await session.scalar(select(func.count()).select_from(Case))
            documents_count = await session.scalar(select(func.count()).select_from(Document))
            document_versions_count = await session.scalar(select(func.count()).select_from(DocumentVersion))
            audit_logs_count = await session.scalar(select(func.count()).select_from(AuditLog))
            permissions_count = await session.scalar(select(func.count()).select_from(DocumentPermission))
            assignments_count = await session.scalar(select(func.count()).select_from(CaseAssignment))
            
            # Print results
            print(f"Users: {users_count}")
            print(f"Cases: {cases_count}")
            print(f"Documents: {documents_count}")
            print(f"Document Versions: {document_versions_count}")
            print(f"Audit Logs: {audit_logs_count}")
            print(f"Permissions: {permissions_count}")
            print(f"Case Assignments: {assignments_count}")
            
            # Check the only user
            if users_count > 0:
                user = (await session.scalars(select(User))).first()
                print(f"Admin Email: {user.email}")
                print(f"Admin Role: {user.role}")
                print(f"Admin Active: {user.is_active}")
                print(f"Admin Clearance: {user.clearance_level}")

    await engine.dispose()
    
if __name__ == "__main__":
    asyncio.run(verify())
