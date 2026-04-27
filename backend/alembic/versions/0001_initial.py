"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("preferred_locale", sa.String(length=8), nullable=False, server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "themes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("translations", sa.JSON(), nullable=False),
        sa.UniqueConstraint("code", name="uq_themes_code"),
    )

    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("translations", sa.JSON(), nullable=False),
        sa.Column("likert_weights", sa.JSON(), nullable=True),
        sa.UniqueConstraint("code", name="uq_questions_code"),
    )

    op.create_table(
        "question_options",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("theme_code", sa.String(length=64), nullable=False),
        sa.Column("translations", sa.JSON(), nullable=False),
        sa.UniqueConstraint("question_id", "position", name="uq_question_position"),
    )

    op.create_table(
        "assessment_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("locale", sa.String(length=8), nullable=False, server_default="en"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "responses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("assessment_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.UniqueConstraint("session_id", "question_id", name="uq_session_question"),
    )

    op.create_table(
        "theme_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("assessment_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("theme_code", sa.String(length=64), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.UniqueConstraint("session_id", "theme_code", name="uq_session_theme"),
    )


def downgrade() -> None:
    op.drop_table("theme_scores")
    op.drop_table("responses")
    op.drop_table("assessment_sessions")
    op.drop_table("question_options")
    op.drop_table("questions")
    op.drop_table("themes")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
