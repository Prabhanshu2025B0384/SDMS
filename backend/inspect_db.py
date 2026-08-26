import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Document, Case

async def inspect():
    async with AsyncSessionLocal() as db:
        query = select(Document, Case).join(Case, Document.case_id == Case.id).where(Document.title == 'SIHPPT')
        result = await db.execute(query)
        rows = result.all()
        for doc, case in rows:
            print(f"Title: {doc.title}")
            print(f"Classification: {doc.classification_level} (type: {type(doc.classification_level)})")
            print(f"Type: {doc.document_type} (type: {type(doc.document_type)})")
            print(f"Case Ref: {case.case_number}")
            print(f"Search Vector: {doc.search_vector}")

if __name__ == "__main__":
    asyncio.run(inspect())
