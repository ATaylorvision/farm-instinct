# Farm Instinct

A bilingual (English / Spanish) strengths assessment for farmers — inspired by the Gallup StrengthsFinder, but built around the instincts and abilities that make farmers thrive.

## Stack

- **Frontend** — Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · next-intl
- **Backend** — FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL · JWT auth
- **Assessment** — 12 farmer-oriented themes, mix of forced-choice pairs and Likert items, scored to produce a top-5 with farm-applied tips

## Layout

```
FarmInstinct/
  backend/    # FastAPI + PostgreSQL
  frontend/   # Next.js + Tailwind + shadcn
```

## Quick start

### Option A — Docker Compose (one command)

```bash
cp .env.example .env          # optional: change JWT_SECRET
docker compose up --build
```

- Frontend — http://localhost:3000
- Backend — http://localhost:8000 (docs at `/docs`)
- Postgres — localhost:5432 (user/db: `farminstinct`)

The backend container waits for Postgres, runs `alembic upgrade head`, then seeds themes and questions before starting uvicorn. Data persists in the `pgdata` volume. Tear down with `docker compose down` (add `-v` to also wipe the database).

### Option B — Run each app on the host

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for per-app setup. In short:

```bash
# Terminal 1 — backend
cd backend
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
cp .env.example .env                                     # edit DATABASE_URL etc.
alembic upgrade head
python -m app.seed.seed                                  # load themes + questions
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev                                              # http://localhost:3000
```

## How the assessment works

1. User registers or logs in.
2. Picks a language (EN or ES). Language is part of the URL (`/en/...`, `/es/...`).
3. Answers ~36 questions — a mix of forced-choice pairs and 1–5 Likert items.
4. Backend scores responses against 12 themes and returns a ranked result with farm-applied tips for the top 5.

## Themes

`Steward · Innovator · Negotiator · Observer · Planner · Builder · Nurturer · Risk-Taker · Community-Builder · Analyst · Teacher · Resilient`
