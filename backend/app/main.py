import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select

from app.api import admin, auth, cases, documents, search
from app.core.security import get_password_hash
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

    # 3. Seed initial admin and demo case
    async with AsyncSessionLocal() as db:
        admin_res = await db.execute(select(User).where(User.email == "admin12032008@gmail.com"))
        admin_user = admin_res.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                id=uuid.uuid4(),
                email="admin12032008@gmail.com",
                password_hash=get_password_hash("adminhumai"),
                department="System Admin",
                role="Admin",
                is_active=True
            )
            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)
            print("Initialized default Admin user: admin12032008@gmail.com")

        case_res = await db.execute(select(Case))
        first_case = case_res.scalars().first()
        if not first_case and admin_user:
            demo_case = Case(
                id=uuid.uuid4(),
                case_number="CASE-2026-001",
                jurisdiction="Cyber & Financial Crimes Unit",
                status="ACTIVE",
                owning_officer_id=admin_user.id
            )
            db.add(demo_case)
            await db.commit()
            print("Initialized default Case: CASE-2026-001")

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(cases.router)
app.include_router(admin.router)

@app.get("/")
async def root():
    return {"message": "Secure DMS Zero-Cost API is running"}

