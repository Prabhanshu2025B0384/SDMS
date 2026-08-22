from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Secure DMS"
    
    # Database (Defaulting to asyncpg)
    DATABASE_URL: str = "postgresql+asyncpg://raunakpratapkushwaha@localhost:5432/securedms"
    
    # JWT Settings
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_SUPER_SECRET_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # MinIO Settings
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    MINIO_BUCKET_NAME: str = "secure-dms-documents"
    
    # AI/LLM Settings
    GEMINI_API_KEY: str = ""
    
    class Config:
        env_file = ".env"

settings = Settings()
