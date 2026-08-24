import os
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select

from app.api import admin, auth, cases, documents, search, notifications
from app.core.security import get_password_hash, verify_password
from app.core.storage import ensure_storage_ready
from app.database import AsyncSessionLocal, Base, engine
from app.models import Case, User


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Ensure storage folders exist
    ensure_storage_ready()

    # 2. Auto-create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 3. Seed initial admin
    async with AsyncSessionLocal() as db:
        admin_email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@gmail.com")
        admin_password = os.getenv("INITIAL_ADMIN_PASSWORD", "admin")
        
        admin_res = await db.execute(select(User).where(User.email == admin_email))
        admin_user = admin_res.scalar_one_or_none()
        
        if not admin_user:
            admin_user = User(
                id=uuid.uuid4(),
                email=admin_email,
                password_hash=get_password_hash(admin_password),
                department="System Admin",
                role="Admin",
                clearance_level=5,
                is_active=True
            )
            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)
            print(f"Initialized default Admin user: {admin_email}")
        else:
            changed = False
            if admin_user.clearance_level != 5:
                admin_user.clearance_level = 5
                changed = True
            if admin_user.role != "Admin":
                admin_user.role = "Admin"
                changed = True
            if not admin_user.is_active:
                admin_user.is_active = True
                changed = True
            if not verify_password(admin_password, admin_user.password_hash):
                admin_user.password_hash = get_password_hash(admin_password)
                changed = True
            
            if changed:
                await db.commit()
                print(f"Updated default Admin user: {admin_email}")

    yield


app = FastAPI(
    title="Secure DMS (Zero Cost)",
    description="A 100% free, open-source secure document management system.",
    version="2.0.0",
    lifespan=lifespan
)

# Allow CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(cases.router)
app.include_router(admin.router)
app.include_router(notifications.router)

@app.get("/")
async def root():
    return {"message": "Secure DMS Zero-Cost API is running"}
