import asyncio
import httpx
from app.database import AsyncSessionLocal
from app.models import User
from sqlalchemy import select
from app.core.security import create_access_token
from datetime import timedelta

async def test_api():
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.clearance_level == 3))).scalars().first()
        access_token_expires = timedelta(minutes=60)
        access_token = create_access_token(
            data={"sub": str(user.id)}, expires_delta=access_token_expires
        )
        print(f"Testing as user: {user.email}")
        
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {access_token}"}
        url = "http://127.0.0.1:8000/search/documents"
        params = {
            "query": "API",
            "classification_level": 3,
            "document_type": "Evidence Log"
        }
        response = await client.get(url, headers=headers, params=params)
        print("Status:", response.status_code)
        print("Response:", response.text)

if __name__ == "__main__":
    asyncio.run(test_api())
