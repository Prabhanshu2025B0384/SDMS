"""fix_audit_hash_chain

Revision ID: e16383db42b5
Revises: d108258926e2
Create Date: 2026-08-23 21:51:53.720292

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e16383db42b5'
down_revision: Union[str, Sequence[str], None] = 'd108258926e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    import json
    import hashlib
    from sqlalchemy.orm import Session
    from sqlalchemy import text
    
    bind = op.get_bind()
    session = Session(bind=bind)
    
    # Fetch all audit logs ordered by timestamp and ID to ensure determinism
    # Use raw SQL to avoid needing ORM classes in the migration
    result = session.execute(text("SELECT id, timestamp, action, user_id, document_id, case_id, result, details FROM audit_logs ORDER BY timestamp ASC, id ASC"))
    logs = result.fetchall()
    
    previous_hash = None
    
    for log in logs:
        # Construct the payload deterministically
        payload_dict = {
            "id": str(log[0]),
            "timestamp": log[1].isoformat() if log[1] else None,
            "action": log[2],
            "user_id": str(log[3]) if log[3] else None,
            "document_id": str(log[4]) if log[4] else None,
            "case_id": str(log[5]) if log[5] else None,
            "result": log[6],
            "details": log[7] or {},
            "previous_hash": previous_hash
        }
        
        canonical_payload = json.dumps(payload_dict, sort_keys=True, separators=(',', ':'))
        sha256_hash = hashlib.sha256()
        sha256_hash.update(canonical_payload.encode('utf-8'))
        current_hash = sha256_hash.hexdigest()
        
        # Update the row
        session.execute(
            text("UPDATE audit_logs SET previous_hash = :ph, current_hash = :ch WHERE id = :id"),
            {"ph": previous_hash, "ch": current_hash, "id": log[0]}
        )
        
        previous_hash = current_hash
        
    session.commit()


def downgrade() -> None:
    """Downgrade schema."""
    pass
