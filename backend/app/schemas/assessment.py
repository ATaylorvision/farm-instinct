from datetime import datetime
from pydantic import BaseModel, Field


class OptionOut(BaseModel):
    position: int
    text: str


class QuestionOut(BaseModel):
    id: int
    code: str
    kind: str  # "paired" | "likert"
    prompt: str | None = None  # populated for likert
    options: list[OptionOut] = []  # populated for paired


class AssessmentStartOut(BaseModel):
    session_id: int
    locale: str
    questions: list[QuestionOut]


class ResponseIn(BaseModel):
    question_id: int
    value: int = Field(ge=0, le=5)


class AssessmentSubmitIn(BaseModel):
    session_id: int
    responses: list[ResponseIn]


class ThemeResult(BaseModel):
    code: str
    name: str
    description: str
    tips: list[str]
    score: float
    rank: int


class ArchetypeOut(BaseModel):
    code: str
    rank: int
    score: float
    emoji: str
    color: str
    name: str
    tagline: str
    description: str
    hidden_truth: str
    vs_others: str
    strengths: list[str]
    best_role: str
    frustrated_by: str
    struggles_with: str
    wrong_role: str
    management: str


class RecommendedRoleOut(BaseModel):
    code: str
    emoji: str
    name: str
    reason: str


class AssessmentResultOut(BaseModel):
    session_id: int
    locale: str
    completed_at: datetime | None
    top: list[ThemeResult]
    all_themes: list[ThemeResult]
    primary_archetype: ArchetypeOut | None = None
    secondary_archetype: ArchetypeOut | None = None
    recommended_roles: list[RecommendedRoleOut] = []
