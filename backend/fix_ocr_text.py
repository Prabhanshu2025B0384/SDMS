import asyncio
from sqlalchemy import select, update
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.models import DocumentVersion
from app.database import AsyncSessionLocal
import json

async def fix_ocr_text():
    async with AsyncSessionLocal() as db:
        query = select(DocumentVersion).where(DocumentVersion.raw_ocr_text == "No selectable text found in document.")
        result = await db.execute(query)
        versions = result.scalars().all()

        for v in versions:
            v.raw_ocr_text = "No machine-readable text was found.\nMetadata extraction could not be performed."

        await db.commit()
        print(f"Fixed {len(versions)} document versions.")

if __name__ == "__main__":
    asyncio.run(fix_ocr_text())
