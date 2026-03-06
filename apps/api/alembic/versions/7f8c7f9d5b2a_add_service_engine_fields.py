"""add service engine fields

Revision ID: 7f8c7f9d5b2a
Revises: 1c9f2f0a9c1a
Create Date: 2026-02-17
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7f8c7f9d5b2a"
down_revision = "1c9f2f0a9c1a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("services", sa.Column("cilindraje", sa.String(length=20), nullable=True))
    op.add_column("services", sa.Column("valvulas", sa.String(length=20), nullable=True))
    op.add_column("services", sa.Column("sellos", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("services", "sellos")
    op.drop_column("services", "valvulas")
    op.drop_column("services", "cilindraje")
