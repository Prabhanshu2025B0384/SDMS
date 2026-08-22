from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Secure DMS (Zero Cost)"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://raunakpratapkushwaha@localhost:5432/securedms"
    
    # JWT Settings
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_SUPER_SECRET_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # Ceph / S3 Storage Settings
    CEPH_ENDPOINT_URL: str = "http://localhost:8000"  # Update with actual Ceph RGW endpoint
    CEPH_ACCESS_KEY: str = "admin"
    CEPH_SECRET_KEY: str = "admin"
    CEPH_BUCKET_NAME: str = "secure-dms-documents"
    
    # Local Ollama AI Settings
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    
    class Config:
        env_file = ".env"

settings = Settings()
