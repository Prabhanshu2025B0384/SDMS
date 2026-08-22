import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, TSVECTOR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False) # e.g., Investigating Officer, Senior Officer
    department = Column(String, nullable=False) # e.g., Police, Court
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    cases = relationship("Case", back_populates="owning_officer")
    assignments = relationship("CaseAssignment", back_populates="user")
    document_versions = relationship("DocumentVersion", back_populates="creator")
    audit_logs = relationship("AuditLog", back_populates="user")


class Case(Base):
    __tablename__ = "cases"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_number = Column(String, unique=True, index=True, nullable=False)
    jurisdiction = Column(String, nullable=False)
    owning_officer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(String, default="CREATED") # CREATED, INVESTIGATION, UNDER_REVIEW, APPROVED, CLOSED
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    owning_officer = relationship("User", back_populates="cases")
    assignments = relationship("CaseAssignment", back_populates="case")
    documents = relationship("Document", back_populates="case")
    audit_logs = relationship("AuditLog", back_populates="case")


class CaseAssignment(Base):
    __tablename__ = "case_assignments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assignment_type = Column(String, nullable=False) # Investigator, Supervisor
    
    case = relationship("Case", back_populates="assignments")
    user = relationship("User", back_populates="assignments")


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    current_version_id = Column(Integer, ForeignKey("document_versions.id", use_alter=True), nullable=True)
    status = Column(String, default="PROCESSING") # PROCESSING, PROCESSING_FAILED, READY
    search_vector = Column(TSVECTOR)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    case = relationship("Case", back_populates="documents")
    versions = relationship("DocumentVersion", back_populates="document", foreign_keys="[DocumentVersion.document_id]")
    current_version = relationship("DocumentVersion", foreign_keys=[current_version_id], post_update=True)
    audit_logs = relationship("AuditLog", back_populates="document")


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    minio_object_path = Column(String, nullable=False)
    sha256_hash = Column(String, nullable=False)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    workflow_status = Column(String, default="DRAFT") # DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
    ai_extracted_metadata = Column(JSONB, nullable=True)
    raw_ocr_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    document = relationship("Document", back_populates="versions", foreign_keys=[document_id])
    creator = relationship("User", back_populates="document_versions")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    version_id = Column(Integer, ForeignKey("document_versions.id"), nullable=True)
    result = Column(String, nullable=False) # SUCCESS, DENIED, FAILED
    details = Column(JSONB, nullable=True)
    hash = Column(String, nullable=False)
    previous_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="audit_logs")
    case = relationship("Case", back_populates="audit_logs")
    document = relationship("Document", back_populates="audit_logs")
