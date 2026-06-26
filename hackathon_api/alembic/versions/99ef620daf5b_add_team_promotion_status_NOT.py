"""add_team_promotion_status

Revision ID: 99ef620daf5b
Revises: f4ce107bd846
Create Date: 2026-06-25 15:00:32.717098

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '99ef620daf5b'
down_revision: Union[str, Sequence[str], None] = 'f4ce107bd846'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
