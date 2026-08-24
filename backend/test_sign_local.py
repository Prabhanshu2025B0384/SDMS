import asyncio
import sys
sys.path.append('.')
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.models import User, Document, DocumentVersion
from app.api.documents import sign_document_version

async def run_local():
    engine = create_async_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine, class_=AsyncSession)
    
    async with Session() as session:
        # Find admin
        admin = (await session.execute(select(User).where(User.role == 'Admin'))).scalar_one_or_none()
        if not admin: return print("No admin")
        
        # Find a document version
        version = (await session.execute(select(DocumentVersion).limit(1))).scalar_one_or_none()
        if not version: return print("No version")
        
        print(f"Signing doc {version.document_id} version {version.id}")
        
        try:
            res = await sign_document_version(
                document_id=str(version.document_id),
                version_id=str(version.id),
                payload={"password": "testpassword"},
                db=session,
                current_user=admin
            )
            print("Success:", res)
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_local())
