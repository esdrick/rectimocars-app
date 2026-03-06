"""add accounts payable and purchase credit fields

Revision ID: c2f4d9a6b113
Revises: 7b47023bd1be
Create Date: 2026-03-03 12:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2f4d9a6b113"
down_revision: Union[str, Sequence[str], None] = "7b47023bd1be"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("accounts_payable"):
        op.create_table(
            "accounts_payable",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("expense_type", sa.String(length=100), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("due_date", sa.Date(), nullable=False),
            sa.Column("paid", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("paid_at", sa.DateTime(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("source_type", sa.String(length=50), nullable=True),
            sa.Column("source_id", sa.String(length=36), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_accounts_payable_paid", "accounts_payable", ["paid"])
        op.create_index("ix_accounts_payable_due_date", "accounts_payable", ["due_date"])
        op.create_index("ix_accounts_payable_expense_type", "accounts_payable", ["expense_type"])
        op.create_index("ix_accounts_payable_source_type_source_id", "accounts_payable", ["source_type", "source_id"])

    inventory_columns = {column["name"] for column in inspector.get_columns("inventory_movements")}

    if "payment_mode" not in inventory_columns:
        op.add_column(
            "inventory_movements",
            sa.Column("payment_mode", sa.String(length=20), nullable=False, server_default=sa.text("'CONTADO'")),
        )
    if "total_cost" not in inventory_columns:
        op.add_column("inventory_movements", sa.Column("total_cost", sa.Numeric(12, 2), nullable=True))
    if "due_date" not in inventory_columns:
        op.add_column("inventory_movements", sa.Column("due_date", sa.Date(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    inventory_columns = {column["name"] for column in inspector.get_columns("inventory_movements")}
    if "due_date" in inventory_columns:
        op.drop_column("inventory_movements", "due_date")
    if "total_cost" in inventory_columns:
        op.drop_column("inventory_movements", "total_cost")
    if "payment_mode" in inventory_columns:
        op.drop_column("inventory_movements", "payment_mode")

    if inspector.has_table("accounts_payable"):
        op.drop_index("ix_accounts_payable_source_type_source_id", table_name="accounts_payable")
        op.drop_index("ix_accounts_payable_expense_type", table_name="accounts_payable")
        op.drop_index("ix_accounts_payable_due_date", table_name="accounts_payable")
        op.drop_index("ix_accounts_payable_paid", table_name="accounts_payable")
        op.drop_table("accounts_payable")
