from pydantic import BaseModel
from typing import Optional, Any
import uuid
from datetime import datetime

class DocumentVersionResponse(BaseModel):
    id: int
    version_number: int
    sha256_hash: str
    creator_id: uuid.UUID
    workflow_status: str
    ai_extracted_metadata: Optional[Any]
    created_at: datetime
    
    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    current_version_id: Optional[int]
    status: str
    created_at: datetime
    
    current_version: Optional[DocumentVersionResponse]
    
    class Config:
        from_attributes = True

class UploadResponse(BaseModel):
    document_id: uuid.UUID
    status: str
