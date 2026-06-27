"""add team profiles

Revision ID: f7a2c3d9e801
Revises: c1a7f8e2d9b4
Create Date: 2026-06-27 18:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a2c3d9e801"
down_revision: Union[str, Sequence[str], None] = "c1a7f8e2d9b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("skills", sa.String(length=255), nullable=True))
    op.add_column("teams", sa.Column("description", sa.String(length=255), nullable=True))
    op.add_column("teams", sa.Column("invite_code", sa.String(length=24), nullable=True))
    op.add_column("teams", sa.Column("max_members", sa.Integer(), server_default="4", nullable=False))
    op.add_column("teams", sa.Column("captain_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_teams_invite_code"), "teams", ["invite_code"], unique=True)
    op.create_foreign_key("fk_teams_captain_id_users", "teams", "users", ["captain_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_teams_captain_id_users", "teams", type_="foreignkey")
    op.drop_index(op.f("ix_teams_invite_code"), table_name="teams")
    op.drop_column("teams", "captain_id")
    op.drop_column("teams", "max_members")
    op.drop_column("teams", "invite_code")
    op.drop_column("teams", "description")
    op.drop_column("users", "skills")
    op.drop_column("users", "avatar_url")
