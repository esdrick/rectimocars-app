"""create inventory tables

Revision ID: 38de81687304
Revises: 9a1c2d3e4f5b
Create Date: 2026-02-28 14:51:08.360873

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '38de81687304'
down_revision: Union[str, Sequence[str], None] = '9a1c2d3e4f5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        "inventory_items",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("code", sa.String(length=50), nullable=True, unique=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("stock_on_hand", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("stock_min", sa.Numeric(12, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "inventory_movements",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("item_id", sa.String(length=36), sa.ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=10), nullable=False),  # IN / OUT / ADJUST
        sa.Column("qty", sa.Numeric(12, 2), nullable=False),
        sa.Column("unit_cost", sa.Numeric(12, 2), nullable=True),
        sa.Column("supplier", sa.String(length=255), nullable=True),
        sa.Column("work_order_id", sa.String(length=36), sa.ForeignKey("work_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_inventory_items_name", "inventory_items", ["name"])
    op.create_index("ix_inventory_items_category", "inventory_items", ["category"])
    op.create_index("ix_inventory_movements_item_id", "inventory_movements", ["item_id"])
    op.create_index("ix_inventory_movements_work_order_id", "inventory_movements", ["work_order_id"])


def downgrade():
    op.drop_index("ix_inventory_movements_work_order_id", table_name="inventory_movements")
    op.drop_index("ix_inventory_movements_item_id", table_name="inventory_movements")
    op.drop_table("inventory_movements")
    op.drop_index("ix_inventory_items_category", table_name="inventory_items")
    op.drop_index("ix_inventory_items_name", table_name="inventory_items")
    op.drop_table("inventory_items")