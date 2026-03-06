"""add due date to work orders

Revision ID: 2d9a7e1c4b6f
Revises: f5a1c3e8d9b2
Create Date: 2026-03-03 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2d9a7e1c4b6f"
down_revision: Union[str, Sequence[str], None] = "f5a1c3e8d9b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("work_orders")}
    if "due_date" not in columns:
        op.add_column("work_orders", sa.Column("due_date", sa.Date(), nullable=True))
        op.create_index("ix_work_orders_due_date", "work_orders", ["due_date"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("work_orders")}
    indexes = {index["name"] for index in inspector.get_indexes("work_orders")}
    if "ix_work_orders_due_date" in indexes:
        op.drop_index("ix_work_orders_due_date", table_name="work_orders")
    if "due_date" in columns:
        op.drop_column("work_orders", "due_date")
