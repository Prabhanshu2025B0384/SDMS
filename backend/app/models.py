import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    department = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

class Case(Base):
    __tablename__ = "cases"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_number = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="CREATED")
    jurisdiction = Column(String, nullable=False)
    owning_officer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class CaseAssignment(Base):
    __tablename__ = "case_assignments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assignment_type = Column(String, nullable=False)

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    title = Column(String, nullable=False)
    document_type = Column(String, nullable=False)
    status = Column(String, default="PROCESSING")
    created_at = Column(DateTime, default=datetime.utcnow)
    current_version_id = Column(UUID(as_uuid=True), nullable=True)
    search_vector = Column(TSVECTOR)
    
    # Relationships
    case = relationship("Case", backref="documents")

class DocumentVersion(Base):
    __tablename__ = "document_versions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    version_number = Column(String, nullable=False)
    storage_path = Column(String, nullable=False) # Path in Ceph
    file_hash = Column(String, nullable=False) # SHA-256
    raw_ocr_text = Column(Text, nullable=True)
    structured_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=True)
    result = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    previous_hash = Column(String, nullable=True)
    current_hash = Column(String, nullable=False)

Index('idx_gin_search', Document.search_vector, postgresql_using='gin')
