"""add work_order_consumables

Revision ID: 08ee43fd1039
Revises: 38de81687304
Create Date: 2026-02-28 15:05:27.436752

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '08ee43fd1039'
down_revision: Union[str, Sequence[str], None] = '38de81687304'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade():
    op.create_table(
        "work_order_consumables",
        sa.Column("work_order_id", sa.String(36), sa.ForeignKey("work_orders.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("item_id", sa.String(36), sa.ForeignKey("inventory_items.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("qty", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_woc_work_order_id", "work_order_consumables", ["work_order_id"])
    op.create_index("ix_woc_item_id", "work_order_consumables", ["item_id"])

def downgrade():
    op.drop_index("ix_woc_item_id", table_name="work_order_consumables")
    op.drop_index("ix_woc_work_order_id", table_name="work_order_consumables")
    op.drop_table("work_order_consumables")
