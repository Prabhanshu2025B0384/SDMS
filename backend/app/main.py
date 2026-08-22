from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, documents, search, cases

app = FastAPI(
    title="Secure DMS (Zero Cost)",
    description="A 100% free, open-source secure document management system.",
    version="2.0.0"
)

# Allow CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(cases.router)

@app.get("/")
async def root():
    return {"message": "Secure DMS Zero-Cost API is running"}
