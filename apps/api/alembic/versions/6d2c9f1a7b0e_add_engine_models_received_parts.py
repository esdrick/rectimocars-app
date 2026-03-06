"""add engine models and received parts to work orders

Revision ID: 6d2c9f1a7b0e
Revises: 3b1a7c8e2d4f
Create Date: 2026-02-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "6d2c9f1a7b0e"
down_revision = "3b1a7c8e2d4f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "engine_models",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False, unique=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "received_parts_catalog",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False, unique=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    op.add_column("work_orders", sa.Column("engine_model_id", sa.String(length=36), nullable=True))
    op.add_column("work_orders", sa.Column("offered_for_date", sa.Date(), nullable=True))
    op.create_foreign_key(
        "fk_work_orders_engine_model_id",
        "work_orders",
        "engine_models",
        ["engine_model_id"],
        ["id"],
    )

    op.create_table(
        "work_order_received_parts",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("work_order_id", sa.String(length=36), nullable=False),
        sa.Column("part_id", sa.String(length=36), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"]),
        sa.ForeignKeyConstraint(["part_id"], ["received_parts_catalog.id"]),
    )


def downgrade() -> None:
    op.drop_table("work_order_received_parts")
    op.drop_constraint("fk_work_orders_engine_model_id", "work_orders", type_="foreignkey")
    op.drop_column("work_orders", "offered_for_date")
    op.drop_column("work_orders", "engine_model_id")
    op.drop_table("received_parts_catalog")
    op.drop_table("engine_models")
