from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime, func, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Theme(Base):
    """A farmer strength theme (e.g., Steward, Innovator)."""
    __tablename__ = "themes"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # Translations stored as JSON: {"en": {"name": "...", "description": "...", "tips": [...]}, "es": {...}}
    translations: Mapped[dict] = mapped_column(JSON, nullable=False)


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # "paired" (forced-choice between two options) or "likert" (1-5 agreement on a single prompt)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # For likert: {"en": {"prompt": "..."}, "es": {"prompt": "..."}}
    # For paired: prompts live on QuestionOption instead.
    translations: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # For likert: [{"theme_code": "steward", "weight": 1.0}, ...]
    likert_weights: Mapped[list | None] = mapped_column(JSON, nullable=True)

    options: Mapped[list["QuestionOption"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", order_by="QuestionOption.position"
    )


class QuestionOption(Base):
    """An option for a paired (forced-choice) question. Each option maps to one theme."""
    __tablename__ = "question_options"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 or 1 for paired
    theme_code: Mapped[str] = mapped_column(String(64), nullable=False)
    # {"en": {"text": "..."}, "es": {"text": "..."}}
    translations: Mapped[dict] = mapped_column(JSON, nullable=False)

    question: Mapped[Question] = relationship(back_populates="options")

    __table_args__ = (UniqueConstraint("question_id", "position", name="uq_question_position"),)


class AssessmentSession(Base):
    __tablename__ = "assessment_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    locale: Mapped[str] = mapped_column(String(8), default="en", nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="sessions")  # noqa: F821
    responses: Mapped[list["Response"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    scores: Mapped[list["ThemeScore"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class Response(Base):
    __tablename__ = "responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("assessment_sessions.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    # For paired: 0 or 1 (which option was chosen)
    # For likert: 1..5 agreement value
    value: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped[AssessmentSession] = relationship(back_populates="responses")

    __table_args__ = (UniqueConstraint("session_id", "question_id", name="uq_session_question"),)


class ThemeScore(Base):
    __tablename__ = "theme_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("assessment_sessions.id", ondelete="CASCADE"), nullable=False)
    theme_code: Mapped[str] = mapped_column(String(64), nullable=False)
    score: Mapped[float] = mapped_column(nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped[AssessmentSession] = relationship(back_populates="scores")

    __table_args__ = (UniqueConstraint("session_id", "theme_code", name="uq_session_theme"),)
