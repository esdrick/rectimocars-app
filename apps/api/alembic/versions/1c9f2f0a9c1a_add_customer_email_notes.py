"""add customer email and notes

Revision ID: 1c9f2f0a9c1a
Revises: ce5100690a55
Create Date: 2026-02-10 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1c9f2f0a9c1a"
down_revision: Union[str, Sequence[str], None] = "ce5100690a55"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("customers", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "notes")
    op.drop_column("customers", "email")
