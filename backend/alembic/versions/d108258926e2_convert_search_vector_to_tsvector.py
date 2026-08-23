"""convert_search_vector_to_tsvector

Revision ID: d108258926e2
Revises: 8f8844c5967c
Create Date: 2026-08-23 21:49:10.187400

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd108258926e2'
down_revision: Union[str, Sequence[str], None] = '8f8844c5967c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TABLE documents ALTER COLUMN search_vector TYPE tsvector USING to_tsvector('english', coalesce(search_vector, ''))")
    op.execute("CREATE INDEX ix_documents_search_vector ON documents USING GIN (search_vector)")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX ix_documents_search_vector")
    op.execute("ALTER TABLE documents ALTER COLUMN search_vector TYPE text USING search_vector::text")
