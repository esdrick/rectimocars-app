"""merge suppliers and accounts payable heads

Revision ID: f5a1c3e8d9b2
Revises: 8c2b1e5a9f01, c2f4d9a6b113
Create Date: 2026-03-03 13:10:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "f5a1c3e8d9b2"
down_revision: Union[str, Sequence[str], None] = ("8c2b1e5a9f01", "c2f4d9a6b113")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
