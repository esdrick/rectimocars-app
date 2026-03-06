"""add work order meta history

Revision ID: 9a1c2d3e4f5b
Revises: 6d2c9f1a7b0e
Create Date: 2026-02-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9a1c2d3e4f5b"
down_revision = "6d2c9f1a7b0e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_order_meta_history",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("work_order_id", sa.String(length=36), nullable=False),
        sa.Column("changed_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("changed_by", sa.String(length=255), nullable=True),
        sa.Column("changes_json", sa.JSON(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"]),
    )


def downgrade() -> None:
    op.drop_table("work_order_meta_history")
