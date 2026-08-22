import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models import User
from app.core.security import get_password_hash
from sqlalchemy.future import select

async def seed_admin():
    async with AsyncSessionLocal() as db:
        # Check if admin exists
        result = await db.execute(select(User).where(User.email == "admin12032008@gmail.com"))
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            print("Admin user already exists.")
            return

        hashed_password = get_password_hash("adminhumai")
        admin_user = User(
            email="admin12032008@gmail.com",
            password_hash=hashed_password,
            department="System Admin",
            role="Admin"
        )
        
        db.add(admin_user)
        await db.commit()
        print("Successfully created Admin user.")

if __name__ == "__main__":
    asyncio.run(seed_admin())
