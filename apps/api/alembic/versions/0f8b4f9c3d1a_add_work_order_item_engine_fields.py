"""add work order item engine fields

Revision ID: 0f8b4f9c3d1a
Revises: 7f8c7f9d5b2a
Create Date: 2026-02-17
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0f8b4f9c3d1a"
down_revision = "7f8c7f9d5b2a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("work_order_items", sa.Column("cilindraje", sa.Integer(), nullable=True))
    op.add_column("work_order_items", sa.Column("valvulas", sa.Integer(), nullable=True))
    op.add_column("work_order_items", sa.Column("sellos", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("work_order_items", "sellos")
    op.drop_column("work_order_items", "valvulas")
    op.drop_column("work_order_items", "cilindraje")
