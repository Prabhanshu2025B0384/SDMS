import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
import sqlalchemy

async def test():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        res = await conn.execute(sqlalchemy.text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
        print(res.fetchall())
    await engine.dispose()

asyncio.run(test())
