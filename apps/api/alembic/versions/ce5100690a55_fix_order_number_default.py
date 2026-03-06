"""fix order_number default

Revision ID: ce5100690a55
Revises: ff013aee7e43
Create Date: 2026-02-03 18:58:05.456175

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "ce5100690a55"
down_revision: Union[str, Sequence[str], None] = "ff013aee7e43"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Create the sequence (idempotent)
    op.execute("CREATE SEQUENCE IF NOT EXISTS work_orders_order_number_seq START 1;")

    # 2) Set DEFAULT to use the sequence
    op.execute(
        "ALTER TABLE work_orders "
        "ALTER COLUMN order_number SET DEFAULT nextval('work_orders_order_number_seq');"
    )

    # 3) Backfill existing NULLs (if any)
    op.execute(
        "UPDATE work_orders "
        "SET order_number = nextval('work_orders_order_number_seq') "
        "WHERE order_number IS NULL;"
    )

    # 4) Move sequence to max(order_number)+1 so future inserts don't collide
    op.execute(
        """
        SELECT setval(
          'work_orders_order_number_seq',
          COALESCE((SELECT MAX(order_number) FROM work_orders), 0) + 1,
          false
        );
        """
    )

    # 5) Enforce NOT NULL
    op.alter_column(
        "work_orders",
        "order_number",
        existing_type=sa.Integer(),
        nullable=False,
    )


def downgrade() -> None:
    # Relax NOT NULL
    op.alter_column(
        "work_orders",
        "order_number",
        existing_type=sa.Integer(),
        nullable=True,
    )

    # Remove DEFAULT
    op.execute("ALTER TABLE work_orders ALTER COLUMN order_number DROP DEFAULT;")

    # Drop sequence
    op.execute("DROP SEQUENCE IF EXISTS work_orders_order_number_seq;")