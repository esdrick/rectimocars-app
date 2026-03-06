"""order_number sequence

Revision ID: ff013aee7e43
Revises: b7cb0d0e6a6e
Create Date: 2026-02-03 18:32:24.732226

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff013aee7e43'
down_revision: Union[str, Sequence[str], None] = 'b7cb0d0e6a6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # 1) sequence
    op.execute("CREATE SEQUENCE IF NOT EXISTS work_orders_order_number_seq START 1;")

    # 2) default en columna
    op.execute(
        "ALTER TABLE work_orders "
        "ALTER COLUMN order_number SET DEFAULT nextval('work_orders_order_number_seq');"
    )

    # 3) backfill para filas existentes (si las hay)
    op.execute(
        "UPDATE work_orders "
        "SET order_number = nextval('work_orders_order_number_seq') "
        "WHERE order_number IS NULL;"
    )

    # 4) NOT NULL
    op.alter_column("work_orders", "order_number", existing_type=sa.Integer(), nullable=False)

def downgrade():
    op.alter_column("work_orders", "order_number", existing_type=sa.Integer(), nullable=True)
    op.execute("ALTER TABLE work_orders ALTER COLUMN order_number DROP DEFAULT;")
    op.execute("DROP SEQUENCE IF EXISTS work_orders_order_number_seq;")
