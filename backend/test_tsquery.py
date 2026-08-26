import asyncio
from sqlalchemy import select, text
from app.database import AsyncSessionLocal

async def test_tsquery():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT websearch_to_tsquery('english', 'API')"))
        val = res.scalar()
        print(f"websearch_to_tsquery('english', 'API') = {repr(val)}")
        
        try:
            res2 = await db.execute(text("SELECT ts_rank('a:1'::tsvector, websearch_to_tsquery('english', 'API'))"))
            val2 = res2.scalar()
            print(f"ts_rank with API = {val2}")
        except Exception as e:
            print("Error in ts_rank API:", e)

if __name__ == "__main__":
    asyncio.run(test_tsquery())
