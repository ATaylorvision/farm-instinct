"""add is_admin to users

Revision ID: 0002_is_admin
Revises: 0001_initial
Create Date: 2026-04-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_is_admin"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("users", "is_admin")
