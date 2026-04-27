from datetime import datetime
from pydantic import BaseModel, EmailStr

from app.schemas.assessment import ArchetypeOut, RecommendedRoleOut, ThemeResult


class AdminUserSummary(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    preferred_locale: str
    is_admin: bool
    created_at: datetime
    session_count: int
    last_completed_at: datetime | None
    top_theme_code: str | None
    top_theme_name: str | None

    class Config:
        from_attributes = True


class AdminSessionSummary(BaseModel):
    id: int
    locale: str
    started_at: datetime
    completed_at: datetime | None
    top: list[ThemeResult]  # top 5


class AdminUserDetail(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    preferred_locale: str
    is_admin: bool
    created_at: datetime
    sessions: list[AdminSessionSummary]


class AdminResponseOption(BaseModel):
    position: int
    text: str
    theme_code: str
    theme_name: str


class AdminResponseDetail(BaseModel):
    question_id: int
    question_code: str
    order: int
    kind: str  # "paired" | "likert"
    # For likert:
    prompt: str | None = None
    value: int  # 0/1 for paired, 1-5 for likert
    # Likert human-readable (e.g. "Mostly")
    value_label: str | None = None
    # For likert, the themes this question contributes to
    likert_themes: list[str] = []  # list of theme names
    # For paired: both options, so you can see what was/wasn't picked
    options: list[AdminResponseOption] = []
    # For paired: the chosen option's text + theme (convenience)
    chosen_text: str | None = None
    chosen_theme_code: str | None = None
    chosen_theme_name: str | None = None


class AdminSessionUser(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    preferred_locale: str
    is_admin: bool


class AdminSessionDetail(BaseModel):
    id: int
    locale: str
    started_at: datetime
    completed_at: datetime | None
    user: AdminSessionUser
    all_themes: list[ThemeResult]  # all traits, ranked
    responses: list[AdminResponseDetail]
    primary_archetype: ArchetypeOut | None = None
    secondary_archetype: ArchetypeOut | None = None
    recommended_roles: list[RecommendedRoleOut] = []
