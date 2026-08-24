import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_docs():
    engine = create_async_engine('postgresql+asyncpg://postgres:root@localhost:5432/secure_dms')
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id, status, document_type, title FROM documents"))
        rows = result.fetchall()
        for r in rows:
            print(f"ID: {r[0]}, Status: {r[1]}, Type: {r[2]}, Title: {r[3]}")
    await engine.dispose()

asyncio.run(check_docs())
