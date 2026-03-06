"""add inventory consumables tables

Revision ID: 7b47023bd1be
Revises: 08ee43fd1039
Create Date: 2026-02-28 15:49:01.171368

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b47023bd1be'
down_revision: Union[str, Sequence[str], None] = '08ee43fd1039'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("inventory_movements"):
        op.create_table(
            "inventory_movements",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("item_id", sa.String(length=36), nullable=False),
            sa.Column("type", sa.String(length=10), nullable=False),
            sa.Column("qty", sa.Numeric(12, 2), nullable=False),
            sa.Column("unit_cost", sa.Numeric(12, 2), nullable=True),
            sa.Column("supplier", sa.String(length=255), nullable=True),
            sa.Column("work_order_id", sa.String(length=36), nullable=True),
            sa.Column("note", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    if not inspector.has_table("work_order_consumables"):
        op.create_table(
            "work_order_consumables",
            sa.Column("work_order_id", sa.String(length=36), nullable=False),
            sa.Column("item_id", sa.String(length=36), nullable=False),
            sa.Column("qty", sa.Numeric(12, 2), server_default="0", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("work_order_id", "item_id"),
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("work_order_consumables"):
        op.drop_table("work_order_consumables")
    if inspector.has_table("inventory_movements"):
        op.drop_table("inventory_movements")
