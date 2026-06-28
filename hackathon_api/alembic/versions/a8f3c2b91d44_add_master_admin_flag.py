"""add master admin flag

Revision ID: a8f3c2b91d44
Revises: f7a2c3d9e801
Create Date: 2026-06-28 01:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8f3c2b91d44"
down_revision: Union[str, Sequence[str], None] = "f7a2c3d9e801"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_master_admin", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.alter_column("users", "is_master_admin", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "is_master_admin")
