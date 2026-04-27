"""Seed the database with themes and questions from JSON files.

Run from the backend directory:
    python -m app.seed.seed              # idempotent — preserves user sessions
    python -m app.seed.seed --wipe       # wipe assessment data, then reseed (dev reset)

The default behavior is safe to run on every container boot: themes are upserted,
questions are upserted by code (translations / weights / options replaced in place),
and existing user sessions, responses, and theme scores are preserved.

The `--wipe` flag clears assessment-domain data first — use this when you want a
clean reset (e.g. after restructuring traits or questions). It does NOT touch the
users table.
"""

import json
import sys
from pathlib import Path

from sqlalchemy import delete, select

from app.database import SessionLocal
from app.models import (
    AssessmentSession,
    Question,
    QuestionOption,
    Response,
    Theme,
    ThemeScore,
)

SEED_DIR = Path(__file__).parent


def _load(name: str) -> list[dict]:
    with (SEED_DIR / name).open(encoding="utf-8") as f:
        return json.load(f)


def wipe(db) -> None:
    """Clear assessment data so a reseed starts clean.

    Order respects FK dependencies. Users are not touched.
    """
    db.execute(delete(ThemeScore))
    db.execute(delete(Response))
    db.execute(delete(AssessmentSession))
    db.execute(delete(QuestionOption))
    db.execute(delete(Question))
    db.execute(delete(Theme))
    db.flush()


def seed_themes(db) -> None:
    for entry in _load("themes.json"):
        translations = {lang: entry[lang] for lang in ("en", "es") if lang in entry}
        existing = db.scalar(select(Theme).where(Theme.code == entry["code"]))
        if existing:
            existing.translations = translations
        else:
            db.add(Theme(code=entry["code"], translations=translations))
    db.flush()


def seed_questions(db) -> None:
    """Upsert questions by code.

    Existing questions are updated in place (preserving their id, so any
    responses referencing them stay valid). For paired questions, options are
    replaced wholesale — that's safe because option ids aren't referenced
    elsewhere.
    """
    for entry in _load("questions.json"):
        existing = db.scalar(select(Question).where(Question.code == entry["code"]))

        if entry["kind"] == "paired":
            translations = {}
            likert_weights = None
        elif entry["kind"] == "likert":
            translations = {
                "en": {"prompt": entry["prompt"]["en"]},
                "es": {"prompt": entry["prompt"]["es"]},
            }
            likert_weights = entry["likert_weights"]
        else:
            raise ValueError(f"Unknown kind: {entry['kind']}")

        if existing:
            existing.kind = entry["kind"]
            existing.order = entry["order"]
            existing.translations = translations
            existing.likert_weights = likert_weights
            # Replace options if any (orphan-delete via relationship cascade)
            existing.options.clear()
            db.flush()
            q = existing
        else:
            q = Question(
                code=entry["code"],
                kind=entry["kind"],
                order=entry["order"],
                translations=translations,
                likert_weights=likert_weights,
            )
            db.add(q)

        if entry["kind"] == "paired":
            for i, opt in enumerate(entry["options"]):
                q.options.append(
                    QuestionOption(
                        position=i,
                        theme_code=opt["theme_code"],
                        translations={"en": {"text": opt["en"]}, "es": {"text": opt["es"]}},
                    )
                )

    db.flush()


def main() -> None:
    do_wipe = "--wipe" in sys.argv[1:]
    with SessionLocal() as db:
        if do_wipe:
            wipe(db)
        seed_themes(db)
        seed_questions(db)
        db.commit()
        if do_wipe:
            print("Wiped assessment data and reseeded themes/questions.")
        else:
            print("Themes and questions upserted (existing user data preserved).")


if __name__ == "__main__":
    main()
