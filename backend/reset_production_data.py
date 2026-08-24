import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.core.config import settings
from app.core.storage import get_supabase_client

async def reset_database():
    print(f"Connecting to database using URL from config...")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    admin_email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@gmail.com")

    async with AsyncSessionLocal() as session:
        try:
            print("Beginning database cleanup...")
            
            # Delete data in order of foreign key dependencies
            print("Deleting from audit_logs...")
            await session.execute(text("DELETE FROM audit_logs;"))
            
            print("Deleting from document_permissions...")
            await session.execute(text("DELETE FROM document_permissions;"))
            
            print("Deleting from document_versions...")
            await session.execute(text("DELETE FROM document_versions;"))
            
            print("Deleting from case_assignments...")
            await session.execute(text("DELETE FROM case_assignments;"))
            
            print("Deleting from documents...")
            await session.execute(text("DELETE FROM documents;"))
            
            print("Deleting from cases...")
            await session.execute(text("DELETE FROM cases;"))
            
            print(f"Deleting all users EXCEPT '{admin_email}'...")
            await session.execute(text("DELETE FROM users WHERE email != :admin_email"), {"admin_email": admin_email})
            
            await session.commit()
            print("Database cleanup completed successfully.")
        except Exception as e:
            await session.rollback()
            print(f"Error during database cleanup: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

def reset_storage():
    print("Beginning Supabase Storage cleanup...")
    client = get_supabase_client()
    bucket = settings.SUPABASE_STORAGE_BUCKET
    
    try:
        # List all objects in the bucket
        res = client.storage.from_(bucket).list()
        
        # 'list()' usually returns an empty array if bucket is empty or list of files
        # It handles pagination if there are many files in some SDK versions, but for now we'll delete what it returns.
        if not res:
            print(f"No objects found in bucket '{bucket}'.")
            return
            
        file_paths = [item['name'] for item in res if item['name'] != '.emptyFolderPlaceholder']
        
        if file_paths:
            print(f"Deleting {len(file_paths)} files from bucket '{bucket}'...")
            client.storage.from_(bucket).remove(file_paths)
            print("Storage cleanup completed successfully.")
        else:
            print(f"No objects to delete in bucket '{bucket}'.")
    except Exception as e:
        print(f"Error during storage cleanup: {e}")
        raise

async def main():
    print("WARNING: THIS IS A DESTRUCTIVE OPERATION.")
    print("This will delete all application data (cases, documents, audit logs) and uploaded files.")
    print("It will NOT drop tables, the database, or the storage bucket.")
    print("Proceeding in 5 seconds...")
    await asyncio.sleep(5)
    
    await reset_database()
    reset_storage()
    print("Full application reset complete.")

if __name__ == "__main__":
    asyncio.run(main())
