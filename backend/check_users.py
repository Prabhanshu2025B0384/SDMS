import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_admin_status():
    engine = create_async_engine('postgresql+asyncpg://postgres:root@localhost:5432/secure_dms')
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT email, is_active, is_deleted FROM users WHERE email='admin@gmail.com'"))
        row = result.fetchone()
        print(f"Admin Status - Email: {row[0]}, is_active: {row[1]}, is_deleted: {row[2]}")
        
        # Let's fix it automatically if it's broken
        if not row[1] or row[2]:
            await conn.execute(text("UPDATE users SET is_active=true, is_deleted=false WHERE email='admin@gmail.com'"))
            await conn.commit()
            print("Fixed admin status.")
    await engine.dispose()

asyncio.run(check_admin_status())
