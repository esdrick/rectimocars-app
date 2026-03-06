"""add customer address

Revision ID: 3b1a7c8e2d4f
Revises: 0f8b4f9c3d1a
Create Date: 2026-02-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3b1a7c8e2d4f"
down_revision = "0f8b4f9c3d1a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("address", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "address")
