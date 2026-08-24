import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_docs():
    engine = create_async_engine('postgresql+asyncpg://postgres.vshsmnrzeusimlcemzhc:W2072abcW20@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres')
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id, status, document_type, title FROM documents"))
        rows = result.fetchall()
        for r in rows:
            print(f"ID: {r[0]}, Status: {r[1]}, Type: {r[2]}, Title: {r[3]}")
    await engine.dispose()

asyncio.run(check_docs())
