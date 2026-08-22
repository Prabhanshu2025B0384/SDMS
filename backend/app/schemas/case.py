from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime

class CaseBase(BaseModel):
    case_number: str
    jurisdiction: str

class CaseCreate(CaseBase):
    pass

class CaseResponse(CaseBase):
    id: uuid.UUID
    owning_officer_id: uuid.UUID
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class CaseAssignmentCreate(BaseModel):
    user_id: uuid.UUID
    assignment_type: str
