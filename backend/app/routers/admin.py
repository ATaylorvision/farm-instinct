from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import AssessmentSession, Question, Response, Theme, ThemeScore, User
from app.schemas.admin import (
    AdminResponseDetail,
    AdminResponseOption,
    AdminSessionDetail,
    AdminSessionSummary,
    AdminSessionUser,
    AdminUserDetail,
    AdminUserSummary,
)
from app.schemas.assessment import ArchetypeOut, RecommendedRoleOut, ThemeResult
from app.services.archetypes import recommended_roles, score_archetypes

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])


# Fallback Likert labels if no locale-specific strings are available.
LIKERT_LABELS = {
    "en": {1: "Not at all", 2: "A little", 3: "Somewhat", 4: "Mostly", 5: "Exactly"},
    "es": {1: "Para nada", 2: "Un poco", 3: "Más o menos", 4: "Bastante", 5: "Exactamente"},
}


def _theme_translation(theme: Theme, locale: str) -> dict:
    return theme.translations.get(locale) or theme.translations.get("en") or {}


def _question_translation(question: Question, locale: str) -> dict:
    return question.translations.get(locale) or question.translations.get("en") or {}


def _option_translation(option, locale: str) -> dict:
    return option.translations.get(locale) or option.translations.get("en") or {}


@router.get("/users", response_model=list[AdminUserSummary])
def list_users(db: Session = Depends(get_db)) -> list[AdminUserSummary]:
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    themes = {t.code: t for t in db.scalars(select(Theme)).all()}

    # Aggregate session count + last completion per user in one query
    counts = dict(
        db.execute(
            select(AssessmentSession.user_id, func.count(AssessmentSession.id))
            .where(AssessmentSession.completed_at.is_not(None))
            .group_by(AssessmentSession.user_id)
        ).all()
    )
    last_times = dict(
        db.execute(
            select(AssessmentSession.user_id, func.max(AssessmentSession.completed_at))
            .where(AssessmentSession.completed_at.is_not(None))
            .group_by(AssessmentSession.user_id)
        ).all()
    )

    out: list[AdminUserSummary] = []
    for u in users:
        # top theme of most-recent completed session
        last = db.scalar(
            select(AssessmentSession)
            .where(AssessmentSession.user_id == u.id, AssessmentSession.completed_at.is_not(None))
            .order_by(AssessmentSession.completed_at.desc())
            .limit(1)
        )
        top_code = None
        top_name = None
        if last:
            top_score = db.scalar(
                select(ThemeScore).where(ThemeScore.session_id == last.id).order_by(ThemeScore.rank).limit(1)
            )
            if top_score:
                top_code = top_score.theme_code
                theme = themes.get(top_code)
                if theme:
                    top_name = _theme_translation(theme, last.locale).get("name", top_code)
        out.append(
            AdminUserSummary(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                preferred_locale=u.preferred_locale,
                is_admin=u.is_admin,
                created_at=u.created_at,
                session_count=counts.get(u.id, 0),
                last_completed_at=last_times.get(u.id),
                top_theme_code=top_code,
                top_theme_name=top_name,
            )
        )
    return out


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def user_detail(user_id: int, db: Session = Depends(get_db)) -> AdminUserDetail:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    sessions = db.scalars(
        select(AssessmentSession)
        .where(AssessmentSession.user_id == user.id)
        .order_by(AssessmentSession.started_at.desc())
        .options(selectinload(AssessmentSession.scores))
    ).all()
    themes = {t.code: t for t in db.scalars(select(Theme)).all()}

    sess_out: list[AdminSessionSummary] = []
    for s in sessions:
        top_scores = sorted(s.scores, key=lambda x: x.rank)[:5]
        top_results: list[ThemeResult] = []
        for sc in top_scores:
            theme = themes.get(sc.theme_code)
            loc = _theme_translation(theme, s.locale) if theme else {}
            top_results.append(
                ThemeResult(
                    code=sc.theme_code,
                    name=loc.get("name", sc.theme_code),
                    description=loc.get("description", ""),
                    tips=loc.get("tips", []),
                    score=sc.score,
                    rank=sc.rank,
                )
            )
        sess_out.append(
            AdminSessionSummary(
                id=s.id,
                locale=s.locale,
                started_at=s.started_at,
                completed_at=s.completed_at,
                top=top_results,
            )
        )

    return AdminUserDetail(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        preferred_locale=user.preferred_locale,
        is_admin=user.is_admin,
        created_at=user.created_at,
        sessions=sess_out,
    )


@router.get("/sessions/{session_id}", response_model=AdminSessionDetail)
def session_detail(session_id: int, db: Session = Depends(get_db)) -> AdminSessionDetail:
    session = db.scalar(
        select(AssessmentSession)
        .where(AssessmentSession.id == session_id)
        .options(
            selectinload(AssessmentSession.user),
            selectinload(AssessmentSession.scores),
            selectinload(AssessmentSession.responses),
        )
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    locale = session.locale
    themes = {t.code: t for t in db.scalars(select(Theme)).all()}

    def theme_name(code: str | None) -> str | None:
        if not code:
            return None
        th = themes.get(code)
        if not th:
            return code
        return _theme_translation(th, locale).get("name", code)

    # All 12 themes, ranked
    all_scores = sorted(session.scores, key=lambda x: x.rank)
    all_themes: list[ThemeResult] = []
    for sc in all_scores:
        th = themes.get(sc.theme_code)
        loc = _theme_translation(th, locale) if th else {}
        all_themes.append(
            ThemeResult(
                code=sc.theme_code,
                name=loc.get("name", sc.theme_code),
                description=loc.get("description", ""),
                tips=loc.get("tips", []),
                score=sc.score,
                rank=sc.rank,
            )
        )

    # Responses with question + option hydration
    question_ids = [r.question_id for r in session.responses]
    questions = db.scalars(
        select(Question)
        .where(Question.id.in_(question_ids))
        .options(selectinload(Question.options))
    ).all()
    questions_by_id = {q.id: q for q in questions}

    likert_map = LIKERT_LABELS.get(locale, LIKERT_LABELS["en"])

    resp_out: list[AdminResponseDetail] = []
    # Sort by question order so the transcript reads naturally.
    ordered = sorted(
        session.responses,
        key=lambda r: (questions_by_id.get(r.question_id).order if questions_by_id.get(r.question_id) else 9999),
    )
    for r in ordered:
        q = questions_by_id.get(r.question_id)
        if not q:
            continue
        qtr = _question_translation(q, locale)

        if q.kind == "paired":
            opts_out: list[AdminResponseOption] = []
            chosen_text = None
            chosen_theme_code = None
            for opt in sorted(q.options, key=lambda o: o.position):
                otr = _option_translation(opt, locale)
                text = otr.get("text", "")
                opts_out.append(
                    AdminResponseOption(
                        position=opt.position,
                        text=text,
                        theme_code=opt.theme_code,
                        theme_name=theme_name(opt.theme_code) or opt.theme_code,
                    )
                )
                if opt.position == r.value:
                    chosen_text = text
                    chosen_theme_code = opt.theme_code
            resp_out.append(
                AdminResponseDetail(
                    question_id=q.id,
                    question_code=q.code,
                    order=q.order,
                    kind="paired",
                    prompt=qtr.get("prompt"),
                    value=r.value,
                    value_label=None,
                    likert_themes=[],
                    options=opts_out,
                    chosen_text=chosen_text,
                    chosen_theme_code=chosen_theme_code,
                    chosen_theme_name=theme_name(chosen_theme_code),
                )
            )
        else:  # likert
            weights = q.likert_weights or []
            likert_theme_names = [
                theme_name(w.get("theme_code")) or w.get("theme_code", "")
                for w in weights
                if w.get("theme_code")
            ]
            resp_out.append(
                AdminResponseDetail(
                    question_id=q.id,
                    question_code=q.code,
                    order=q.order,
                    kind="likert",
                    prompt=qtr.get("prompt"),
                    value=r.value,
                    value_label=likert_map.get(r.value),
                    likert_themes=likert_theme_names,
                    options=[],
                    chosen_text=None,
                    chosen_theme_code=None,
                    chosen_theme_name=None,
                )
            )

    # Archetypes + recommended roles, in the user's locale (so rich content matches their language)
    trait_map_0_1 = {sc.theme_code: sc.score for sc in all_scores}
    archetypes_ranked = score_archetypes(trait_map_0_1, locale)

    def _to_arc_out(a) -> ArchetypeOut:
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

    primary_arc = _to_arc_out(archetypes_ranked[0]) if archetypes_ranked else None
    secondary_arc = _to_arc_out(archetypes_ranked[1]) if len(archetypes_ranked) > 1 else None
    roles_out = [
        RecommendedRoleOut(code=r.code, emoji=r.emoji, name=r.name, reason=r.reason)
        for r in recommended_roles(trait_map_0_1, locale)
    ]

    return AdminSessionDetail(
        id=session.id,
        locale=session.locale,
        started_at=session.started_at,
        completed_at=session.completed_at,
        user=AdminSessionUser(
            id=session.user.id,
            email=session.user.email,
            full_name=session.user.full_name,
            preferred_locale=session.user.preferred_locale,
            is_admin=session.user.is_admin,
        ),
        all_themes=all_themes,
        responses=resp_out,
        primary_archetype=primary_arc,
        secondary_archetype=secondary_arc,
        recommended_roles=roles_out,
    )
