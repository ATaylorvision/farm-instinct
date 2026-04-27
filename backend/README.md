# Farm Instinct — Backend

FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL. Serves auth, the assessment flow, scoring, and bilingual result payloads.

## Setup

```bash
python -m venv .venv
source .venv/Scripts/activate     # Windows Git Bash / WSL
# source .venv/bin/activate       # macOS / Linux
pip install -r requirements.txt
cp .env.example .env              # edit DATABASE_URL and JWT_SECRET
```

### Database

Create a local Postgres database matching your `DATABASE_URL`:

```bash
createdb farminstinct   # or use psql / pgAdmin
alembic upgrade head    # apply schema
python -m app.seed.seed # load themes and questions (EN/ES)
```

### Run

```bash
uvicorn app.main:app --reload --port 8000
# Docs: http://localhost:8000/docs
# Health: http://localhost:8000/api/health
```

## API overview

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | Create account, return JWT |
| POST | `/api/auth/login` | — | OAuth2 password form, return JWT |
| GET  | `/api/auth/me` | Bearer | Current user |
| POST | `/api/assessment/start?locale=en` | Bearer | Create session, return questions |
| POST | `/api/assessment/submit` | Bearer | Submit responses, return results |
| GET  | `/api/assessment/result/{id}` | Bearer | Re-fetch a completed result |
| GET  | `/api/assessment/history` | Bearer | List past completed sessions |

## Adding or editing themes/questions

Edit `app/seed/themes.json` or `app/seed/questions.json`, then re-run:

```bash
python -m app.seed.seed
```

The seeder upserts themes and replaces questions by `code`. Safe to run repeatedly.

## Scoring

See `app/services/scoring.py`. Paired questions contribute +1 to the chosen option's theme. Likert items map each 1–5 answer to `(value − 3) / 2 × weight`. Final theme scores are min-max normalized to 0..1 using each theme's own max possible magnitude, then ranked descending.
