import os
from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "Secure DMS (Zero Cost)"
    
    # Database (defaults to local SQLite if PostgreSQL is not specified)
    DATABASE_URL: str = "sqlite+aiosqlite:///./dms.db"
    
    @field_validator('DATABASE_URL', mode='before')
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v
    
    # Storage Mode: 'local' or 's3'
    STORAGE_TYPE: str = os.getenv("STORAGE_TYPE", "local")
    STORAGE_LOCAL_DIR: str = os.getenv("STORAGE_LOCAL_DIR", "./storage")
    
    # JWT Settings
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_SUPER_SECRET_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440 # 24 hours for seamless development
    
    # Ceph / S3 Storage Settings (optional)
    CEPH_ENDPOINT_URL: str = "http://localhost:8000"
    CEPH_ACCESS_KEY: str = "admin"
    CEPH_SECRET_KEY: str = "admin"
    CEPH_BUCKET_NAME: str = "secure-dms-documents"
    
    # Local Ollama AI Settings
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    
    # Supabase Settings
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "SDMS"
    
    # Gemini AI Settings
    GEMINI_API_KEY: str = ""
    
    # Frontend and CORS
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

