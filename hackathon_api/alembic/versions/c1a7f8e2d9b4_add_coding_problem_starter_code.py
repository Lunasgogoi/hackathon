"""add coding problem starter code

Revision ID: c1a7f8e2d9b4
Revises: 9b4f5d2c1a70
Create Date: 2026-06-27 17:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1a7f8e2d9b4"
down_revision: Union[str, Sequence[str], None] = "9b4f5d2c1a70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("coding_problems", sa.Column("starter_code", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("coding_problems", "starter_code")
