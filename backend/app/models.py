import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TSVECTOR
from sqlalchemy.orm import relationship

from app.database import Base


class GUID(TypeDecorator):
    """Platform-independent GUID/UUID type.
    Uses PostgreSQL's native UUID type, otherwise uses CHAR(36), storing as stringified hex values.
    """
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            else:
                return str(uuid.UUID(str(value)))

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                try:
                    return uuid.UUID(str(value))
                except (ValueError, TypeError):
                    return value
            return value


class User(Base):
    __tablename__ = "users"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    public_id = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    preserved_email = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    department = Column(String, nullable=False)
    clearance_level = Column(Integer, default=1, nullable=False) # 1: Junior, 2: Inspector, 3: Senior IO, 4: SP/Senior, 5: Executive/Admin
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)


class Case(Base):
    __tablename__ = "cases"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    case_number = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="CREATED")
    jurisdiction = Column(String, nullable=False)
    owning_officer_id = Column(GUID, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class CaseAssignment(Base):
    __tablename__ = "case_assignments"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    case_id = Column(GUID, ForeignKey("cases.id"), nullable=False)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False)
    assignment_type = Column(String, nullable=False)


class Document(Base):
    __tablename__ = "documents"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    case_id = Column(GUID, ForeignKey("cases.id"), nullable=False)
    title = Column(String, nullable=False)
    document_type = Column(String, nullable=False)
    classification_level = Column(Integer, default=1, nullable=False) # 1: Unrestricted, 2: Confidential, 3: Secret, 4: Top Secret, 5: Executive
    status = Column(String, default="PROCESSING")
    created_at = Column(DateTime, default=datetime.utcnow)
    current_version_id = Column(GUID, nullable=True)
    search_vector = Column(TSVECTOR, nullable=True)
    
    # Module enhancements
    rejection_reason = Column(String, nullable=True)
    failure_reason = Column(String, nullable=True)
    retry_count = Column(Integer, default=0)

    # Relationships
    case = relationship("Case", backref="documents")
    versions = relationship("DocumentVersion", back_populates="document")


class DocumentPermission(Base):
    __tablename__ = "document_permissions"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    document_id = Column(GUID, ForeignKey("documents.id"), nullable=False)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False)
    permission_type = Column(String, default="VIEW", nullable=False) # VIEW, DOWNLOAD, EDIT
    granted_by = Column(GUID, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    document_id = Column(GUID, ForeignKey("documents.id"), nullable=False)
    version_number = Column(String, nullable=False)
    storage_path = Column(String, nullable=False) # Path in Storage (Local / S3)
    file_hash = Column(String, nullable=False) # SHA-256
    raw_ocr_text = Column(Text, nullable=True)
    structured_data = Column(JSON, default={})
    is_tampered = Column(Boolean, default=False)

    document = relationship("Document", back_populates="versions")
    created_by = Column(GUID, ForeignKey("users.id"), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    document_id = Column(GUID, ForeignKey("documents.id"), nullable=True)
    case_id = Column(GUID, ForeignKey("cases.id"), nullable=True)
    result = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    previous_hash = Column(String, nullable=True)
    current_hash = Column(String, nullable=False)


