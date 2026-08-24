import asyncio
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models import User

async def run():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.email == 'admin@gmail.com'))
        user = res.scalar_one_or_none()
        print(f'User: {user}')
        if user:
            print(f'is_active: {user.is_active}')
            print(f'role: {user.role}')
            print(f'password_hash: {user.password_hash}')

if __name__ == "__main__":
    asyncio.run(run())
