# EquityLens

Equity research for **NSE-listed Indian companies**: company search, headline news, AI-assisted research with visible sources, a source-grounded Copilot, and
per-user watchlists. When licensed/permitted sources are enabled it also shows delayed prices/charts and reported financials with side-by-side comparison.
Informational only — not investment advice; AI output can be wrong.

> **Data-source policy.** The production default (`DATA_PROFILE=public`) keeps **every restricted source off** — prices, reported financials/shareholding, sector/segment labels
> and news — because their terms forbid public display or the rights are unresolved (literal clauses and outstanding permissions: `docs/PROVIDERS.md`). With nothing enabled the app is
> a shell (accounts, company search, watchlists without prices) and AI research/Copilot refuse rather than guess; the UI says so instead of showing anything invented.
> A flag (`ENABLE_YAHOO`, `ENABLE_SCREENER`, `ENABLE_NSE_INDEX`, `ENABLE_NEWS`, `ENABLE_NEWS_EXCERPTS`) is **not a licence**; enabling one is the owner's decision and risk.
> **Not cleared for public commercial use** while those permissions are outstanding.

## Status (what is verified, and how)
| Level | Evidence |
|---|---|
| Automated | backend `pytest` **178 passed** (PostgreSQL 15 and 17.11, full venv and the exact pinned production dependencies) · legacy suite 31 passed · frontend `vitest` **162 passed**, `tsc` clean, `eslint` 0 errors (12 `react-refresh` warnings in UI helper files), production build OK · `pip-audit` clean |
| Browser | Playwright against the dev server **119 passed / 4 skipped** (the 4 are the production-build-only security spec) and against the **production build with vercel.json's CSP/headers** **123 passed**, 6 projects (personal, public-all-off, public-news-only × desktop/mobile) — real frontend, backend, database, auth/CSRF, job queue and policy gating, with **offline synthetic provider fixtures** (`docs/E2E.md`) |
| Live providers | one controlled live Copilot check (real Exa headlines → real Gemini answer, grounded); earlier manual live calls (Phase 1) |
| Deployed | **no** — nothing deployed, nothing run against Supabase; see `docs/DEPLOYMENT.md` |

## Stack
FastAPI + SQLAlchemy + Alembic + PostgreSQL (full-text search for Copilot) · React 18 + Vite 7 + TypeScript + shadcn/ui + TanStack Query + react-router 7 · Playwright.

## Local setup
    docker run -d --name equitylens_pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=equitylens -p 127.0.0.1:55433:5432 postgres:17
    cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt     # lean, pinned (no torch/chromadb)
    cp .env.example .env     # DATABASE_URL=postgresql+psycopg2://postgres:dev@127.0.0.1:55433/equitylens + provider keys
    .venv/bin/alembic upgrade head && .venv/bin/python scripts/import_companies.py           # company master (public NSE files)
    .venv/bin/uvicorn main:app --port 8000
    cd ../frontend && npm install && npm run dev      # http://localhost:8080 (proxies /api and /auth)

## Tests
    # backend (the harness DROPS and recreates the public schema of the test DB and refuses non-local hosts; live provider calls are blocked)
    cd backend && ENVIRONMENT=test DATABASE_URL=postgresql+psycopg2://postgres:PW@127.0.0.1:PORT/equitylens_test .venv/bin/python -m pytest
    cd backend && ENVIRONMENT=test .venv/bin/python -m pytest tests/legacy      # dormant legacy modules (need requirements-legacy.txt)
    # frontend
    cd frontend && npm run typecheck && npm run lint && npm test && npm run build
    # browser E2E (starts three stacks and reseeds throw-away databases; see docs/E2E.md for prerequisites)
    cd frontend && npm run e2e          # dev server
    cd frontend && npm run e2e:prod     # production build + vercel.json security headers/CSP
API docs: `/docs` (disabled when `ENVIRONMENT=production`). Endpoint list: `docs/API_INVENTORY.md`.

## Deployment
Vercel (frontend) + Render (backend) + Supabase: `docs/DEPLOYMENT.md` (environment-variable checklist, migration procedure, post-deploy checks). `render.yaml` and `frontend/vercel.json` are templates;
`vercel.json` contains a placeholder that **fails the Vercel build** until you set your Render URL.

## Documentation map
`docs/PHASE_2_PROGRESS.md` (issue register, test log) · `docs/PROVIDERS.md` · `docs/SECURITY_AUDIT.md` · `docs/IMPLEMENTATION_AUDIT.md` · `docs/IMPLEMENTATION_PLAN.md` · `docs/RESEARCH_METHOD.md` · `docs/E2E.md` · `docs/DEPLOYMENT.md`.

## Known limitations
No licensed price, fundamentals or news source (everything restricted is off in the public profile; research/Copilot refuse) · NSE only (no BSE-only listings) · no real-time prices · hiring/traffic/MCA alternative signals not measured ·
PDF/transcript ingestion deferred (the old Chroma/PDF modules are unreachable legacy code) · no email verification or password reset · research scores are a published heuristic rubric (`docs/RESEARCH_METHOD.md`) ·
7 `npm audit` advisories remain in the tailwind 3 build chain (build-time only, accepted) · Chromium-only E2E, emulated mobile · client-IP throttling behind Vercel→Render needs post-deploy configuration.
