"""add assessment attempts

Revision ID: 9b4f5d2c1a70
Revises: d4e80de49e41
Create Date: 2026-06-27 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b4f5d2c1a70"
down_revision: Union[str, Sequence[str], None] = "d4e80de49e41"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assessment_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("total_score", sa.Float(), nullable=False),
        sa.Column("max_score", sa.Float(), nullable=False),
        sa.Column("percentage", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_id", "user_id", name="uq_assessment_attempt_user"),
    )
    op.create_index(op.f("ix_assessment_attempts_id"), "assessment_attempts", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_assessment_attempts_id"), table_name="assessment_attempts")
    op.drop_table("assessment_attempts")
