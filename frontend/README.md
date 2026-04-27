# Farm Instinct — Frontend

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn-style primitives · next-intl.

## Setup

```bash
npm install
cp .env.example .env.local    # point NEXT_PUBLIC_API_URL at the backend
npm run dev                   # http://localhost:3000
```

Visit [http://localhost:3000](http://localhost:3000) — the middleware will redirect to `/en` or `/es` based on request locale. You can switch languages any time from the top-right toggle.

## Routes

```
/[locale]/                  Landing page
/[locale]/login             Log in
/[locale]/register          Sign up
/[locale]/assessment        Take the assessment
/[locale]/results?session=N View your results
```

## i18n

- Locales live in `messages/en.json` and `messages/es.json`.
- Adding a locale: add it to `i18n/routing.ts`, create `messages/<code>.json`, update the seed JSON in the backend to include that language under each theme and option.

## Structure

```
app/
  layout.tsx                 Minimal root shell (next-intl pattern)
  [locale]/
    layout.tsx               Provides <html>, Nav, AuthProvider, NextIntlClientProvider
    page.tsx                 Landing
    login/, register/
    assessment/              Stepper, paired + Likert cards
    results/                 Top 5 with tips + full ranking
components/
  ui/                        Button, Input, Label, Card, Progress (shadcn-style)
  nav.tsx, language-toggle.tsx
lib/
  api.ts                     Typed fetch client (localStorage JWT)
  auth-context.tsx           Client-side auth state
  utils.ts                   cn() helper
i18n/
  routing.ts, request.ts     next-intl configuration
messages/
  en.json, es.json
```

## Build

```bash
npm run build
npm run start
```
