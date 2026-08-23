import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Secure DMS (Zero Cost)"
    
    # Database (defaults to local SQLite if PostgreSQL is not specified)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./dms.db")
    
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
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

