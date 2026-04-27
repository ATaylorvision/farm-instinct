from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import AssessmentSession, Question, Response, ThemeScore, User, Theme
from app.schemas.assessment import (
    ArchetypeOut,
    AssessmentResultOut,
    AssessmentStartOut,
    AssessmentSubmitIn,
    OptionOut,
    QuestionOut,
    RecommendedRoleOut,
    ThemeResult,
)
from app.services.archetypes import recommended_roles, score_archetypes
from app.services.scoring import ThemeScoreResult, score_responses

router = APIRouter(prefix="/api/assessment", tags=["assessment"])


def _localize(translations: dict, locale: str, key: str, fallback: str = "") -> str:
    loc = translations.get(locale) or translations.get("en") or {}
    return loc.get(key, fallback)


@router.post("/start", response_model=AssessmentStartOut, status_code=status.HTTP_201_CREATED)
def start_session(
    locale: str = Query("en", pattern="^(en|es)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssessmentStartOut:
    session = AssessmentSession(user_id=user.id, locale=locale)
    db.add(session)
    db.flush()

    questions = db.scalars(
        select(Question).options(selectinload(Question.options)).order_by(Question.order, Question.id)
    ).all()

    out: list[QuestionOut] = []
    for q in questions:
        if q.kind == "paired":
            opts = [OptionOut(position=o.position, text=_localize(o.translations, locale, "text")) for o in q.options]
            out.append(QuestionOut(id=q.id, code=q.code, kind=q.kind, options=opts))
        else:  # likert
            out.append(QuestionOut(id=q.id, code=q.code, kind=q.kind, prompt=_localize(q.translations, locale, "prompt")))

    db.commit()
    return AssessmentStartOut(session_id=session.id, locale=locale, questions=out)


@router.post("/submit", response_model=AssessmentResultOut)
def submit(
    payload: AssessmentSubmitIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssessmentResultOut:
    session = db.get(AssessmentSession, payload.session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.completed_at:
        raise HTTPException(status_code=409, detail="Session already submitted")

    # Write responses
    for r in payload.responses:
        db.add(Response(session_id=session.id, question_id=r.question_id, value=r.value))
    db.flush()

    # Load questions with options for scoring
    qids = [r.question_id for r in payload.responses]
    questions = db.scalars(
        select(Question).options(selectinload(Question.options)).where(Question.id.in_(qids))
    ).all()
    questions_by_id = {q.id: q for q in questions}

    results = score_responses(session.responses, questions_by_id)

    # Ensure all themes appear (unranked ones get score 0)
    known_codes = {c for c, *_ in db.execute(select(Theme.code)).all()}
    scored_codes = {r.code for r in results}
    rank_counter = len(results)
    for code in known_codes - scored_codes:
        rank_counter += 1
        results.append(ThemeScoreResult(code=code, score=0.0, rank=rank_counter))

    for tr in results:
        db.add(ThemeScore(session_id=session.id, theme_code=tr.code, score=tr.score, rank=tr.rank))

    session.completed_at = datetime.now(timezone.utc)
    db.commit()

    return _build_result(db, session)


@router.get("/result/{session_id}", response_model=AssessmentResultOut)
def get_result(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssessmentResultOut:
    session = db.get(AssessmentSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.completed_at:
        raise HTTPException(status_code=409, detail="Session not yet completed")
    return _build_result(db, session)


@router.get("/history", response_model=list[AssessmentResultOut])
def history(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[AssessmentResultOut]:
    sessions = db.scalars(
        select(AssessmentSession)
        .where(AssessmentSession.user_id == user.id, AssessmentSession.completed_at.is_not(None))
        .order_by(AssessmentSession.completed_at.desc())
    ).all()
    return [_build_result(db, s) for s in sessions]


def _archetype_to_out(a) -> ArchetypeOut:
    return ArchetypeOut(
        code=a.code,
        rank=a.rank,
        score=a.score,
        emoji=a.emoji,
        color=a.color,
        name=a.name,
        tagline=a.tagline,
        description=a.description,
        hidden_truth=a.hidden_truth,
        vs_others=a.vs_others,
        strengths=a.strengths,
        best_role=a.best_role,
        frustrated_by=a.frustrated_by,
        struggles_with=a.struggles_with,
        wrong_role=a.wrong_role,
        management=a.management,
    )


def _build_result(db: Session, session: AssessmentSession) -> AssessmentResultOut:
    themes = {t.code: t for t in db.scalars(select(Theme)).all()}
    scores = sorted(session.scores, key=lambda s: s.rank)

    def to_theme_result(s: ThemeScore) -> ThemeResult:
        theme = themes.get(s.theme_code)
        loc = (theme.translations.get(session.locale) or theme.translations.get("en")) if theme else {}
        return ThemeResult(
            code=s.theme_code,
            name=loc.get("name", s.theme_code),
            description=loc.get("description", ""),
            tips=loc.get("tips", []),
            score=s.score,
            rank=s.rank,
        )

    all_results = [to_theme_result(s) for s in scores]

    # Archetypes + role recommendations from raw 0..1 trait scores
    trait_map_0_1 = {s.theme_code: s.score for s in scores}
    archetype_results = score_archetypes(trait_map_0_1, session.locale)
    primary = _archetype_to_out(archetype_results[0]) if archetype_results else None
    secondary = _archetype_to_out(archetype_results[1]) if len(archetype_results) > 1 else None
    roles = [
        RecommendedRoleOut(code=r.code, emoji=r.emoji, name=r.name, reason=r.reason)
        for r in recommended_roles(trait_map_0_1, session.locale)
    ]

    return AssessmentResultOut(
        session_id=session.id,
        locale=session.locale,
        completed_at=session.completed_at,
        top=all_results[:5],
        all_themes=all_results,
        primary_archetype=primary,
        secondary_archetype=secondary,
        recommended_roles=roles,
    )
