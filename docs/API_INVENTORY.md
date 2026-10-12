# EquityLens — API inventory (reconciled against `app.routes` on 2026-10-12, 32 operations)

Source of truth is the code; this table was produced from the live route list and checked by the `api-inventory` and `contract` audits plus tests
(`test_security.py::test_every_route_requires_authentication_except_the_explicit_public_allowlist` fails if a route becomes public by accident).

**Conventions.** Auth = `el_session` HttpOnly cookie. Every `/api/v1/*` route has a router-level `Depends(current_user)` (401 when missing/expired/idle).
Unsafe methods (POST/PATCH/DELETE) additionally need `X-CSRF-Token` = the readable `el_csrf` cookie, and an allow-listed `Origin` if the browser sends one (403 otherwise).
`/auth/login` and `/auth/register` have no session yet, so they rely on the Origin allow-list + `SameSite=Lax`; `/auth/logout` requires the CSRF token when a session exists.
Errors: `{detail: string | {code, message}}`; validation 422 `{detail:[…]}`; unhandled 500 `{detail, request_id}` (no internals, CORS headers present); 429 carries `Retry-After`
(exposed to the browser). Source gating: `503 {code:"source_disabled"}` (see PROVIDERS.md). Provider failures map to 429/503/504/502 with `{code,message}`.
GETs are **not** side-effect free: provider-backed GETs spend shared provider budgets and may write caches (`/financials` can write `financial_facts`; `/ask` writes public `documents`).
Hence per-user limits (below).

| Method & path | Purpose | Input (validation) | Output model | Per-user limit / cache | Providers & DB | Frontend consumer | Tests |
|---|---|---|---|---|---|---|---|
| `GET /health` | liveness (process only) — public by design | – | `{status}` | – | none | Render health check | test_auth |
| `GET /ready` | readiness: DB reachable **and** schema at this build's migration head — public by design, no detail | – | `{status,database,schema}` / 503 | – | DB | ops | test_auth, test_security |
| `GET /docs`, `/openapi.json`, `/docs/oauth2-redirect` | API docs — **404 when `ENVIRONMENT=production`** | – | – | – | – | – | test_security |
| `POST /auth/register` | create account + session | email (ASCII, NFKC-folded, canonicalised: plus-tags/gmail dots collapse), password 10–256 | `UserOut` 201 | 10/h per reliable IP, 300/h global | users, auth_sessions, rate_limit_counters | RegisterPage | test_auth |
| `POST /auth/login` | session (rotates any old session) | email, password | `UserOut` | failures only: 5/15 min per (account,IP), 50 per account, 30 per reliable IP; Argon2 concurrency bounded | same | LoginPage | test_auth |
| `POST /auth/logout` | revoke session (CSRF required if session exists) | – | 204 | – | auth_sessions | Navbar | test_auth |
| `POST /auth/logout-all` | revoke all the user's sessions | – | 204 | – | auth_sessions | Navbar menu | test_auth |
| `GET /auth/me` | current user | – | `UserOut` | – | users, auth_sessions (idle 72 h, absolute 168 h) | AuthContext | test_auth |
| `GET /api/v1/capabilities` | which sources are on/off and why — **public by design**, booleans + reasons only | – | dict | – | none | useCapabilities | test_policy |
| `GET /api/v1/companies/search` | company search | q ≤60 (LIKE-escaped), sector ≤120, segment large\|mid\|small, limit 1–25, offset 0–1000; q may be empty only with sector/segment (503 if index source off) | `SearchOut` | – | companies, listings, index_memberships | SearchBar, CompanyPicker | test_companies, test_market, test_policy |
| `GET /api/v1/companies/{id}` | company | UUID | `CompanyOut` (sector null when index source off) | – | companies | CompanyDetail | test_companies |
| `GET /api/v1/companies/{id}/quote` | delayed quote | UUID | `QuoteOut` + provenance | 60/min; cache 2 min, stale ≤6 h flagged; negative cache | Yahoo (gated) | CompanyOverview | test_market, test_policy |
| `GET /api/v1/companies/{id}/history?range=` | OHLCV | 1mo\|3mo\|6mo\|1y\|5y | `HistoryOut` | 60/min; cache 15 min | Yahoo (gated) | PriceChart | test_market |
| `GET /api/v1/market/movers` | top gainers/losers over an index segment (≤100 symbols, ≤5 batched calls) | segment, top 1–10 | `MoversOut` (`partial`, `batches_failed`, NSE symbols) | 12/min | Yahoo + NSE index (both gated) | Index | test_market, test_policy |
| `GET /api/v1/companies/{id}/news` | headline news (links; excerpts only in personal profile) | limit 1–20, offset 0–40 | `NewsOut` | 120/h; cache 6 h; global 40 Exa searches/day | Exa | NewsFeed | test_news, test_policy |
| `GET /api/v1/companies/{id}/financials?statement=` | reported financials with provenance | quarterly_results\|profit_loss\|balance_sheet\|cash_flow\|ratios\|shareholding | `FinancialsOut` | 60/h; DB-persisted, refresh ≤1/7 days, failure cooldown | Screener (gated), financial_facts | FinancialTable | test_financials, test_policy |
| `POST /api/v1/research/{company_id}` | start a background research job (explicit user action) | UUID | `JobOut` **202** | 20 attempts/h; 5 reports/day charged only when new model work runs; one active job per user+company; global queue 20 | jobs thread, Groq, Exa, DB | ResearchPanel | test_research_jobs, test_research |
| `GET /api/v1/research/jobs/{job_id}` | job status (+ report when complete); owner only → 404 otherwise | UUID | `JobOut` | – | research_jobs, research_reports | useResearchJob | test_research_jobs |
| `GET /api/v1/research/active?company_id=` | resume polling after reload | UUID | `JobOut` / 404 `no_active_job` | – | research_jobs | ResearchPanel | test_research_jobs |
| `GET /api/v1/research/latest?company_id=` | caller's latest report / 404 `no_research` | UUID | `ResearchOut` | – | research_reports (owner filter) | ResearchPanel | test_research |
| `GET /api/v1/research/{report_id}` | caller's report by id (owner only) | UUID | `ResearchOut` | – | research_reports | **none (kept for deep links; tested)** | test_research |
| `POST /api/v1/ask` | document-grounded Copilot (no answer caching, no conversation storage) | company_id, question 3–500, top_k 1–8 | `AskOut` (`grounded`, citations) | 30/h; Groq default | documents/document_chunks (FTS, owner filter), Groq/Gemini | AskPanel | test_copilot, test_policy |
| `GET /api/v1/watchlists` | list own watchlists | – | `List[WatchlistOut]` | – | watchlists | WatchlistsPage | test_watchlists |
| `POST /api/v1/watchlists` | create (≤20 per user, unique name per user) | name 1–80 | `WatchlistOut` 201 | – | watchlists | WatchlistsPage | test_watchlists |
| `PATCH /api/v1/watchlists/{id}` | rename | name | `WatchlistOut` | – | owner-scoped query | WatchlistsPage | test_watchlists |
| `DELETE /api/v1/watchlists/{id}` | delete | – | 204 | – | cascade | WatchlistsPage | test_watchlists |
| `POST /api/v1/watchlists/{id}/items` | add company (≤10; unique) | company_id | `WatchlistOut` 201 | – | | CompanyPicker | test_watchlists |
| `DELETE /api/v1/watchlists/{id}/items/{company_id}` | remove | – | 204 | – | | WatchlistsPage | test_watchlists |
| `GET /api/v1/watchlists/{id}/snapshot` | prices per item (rows `unavailable/source_disabled` when off) | – | `SnapshotOut` | 10/min; ≤4 concurrent provider calls | Yahoo (gated) | WatchlistsPage | test_watchlists, test_policy |
| `POST /api/v1/watchlists/{id}/compare` | side-by-side reported metrics (no ranking, no AI) | statement quarterly_results\|profit_loss\|ratios\|balance_sheet\|shareholding; ≥2 companies | `CompareOut` | 12/h | Screener (gated), financial_facts | WatchlistAnalysis | test_watchlists, test_policy |

**Ownership.** Watchlists, items, reports, jobs and private documents are filtered by the authenticated user in the query itself; other users' ids return 404 (never 403/200).
**Internal/operational only:** `/health`, `/ready`, docs routes. **Removed:** the unauthenticated pre-Phase-1 `/analyze` and `/ask` (reference copy `backend/legacy/main_legacy.py.txt`).
**Not implemented:** password reset, email verification, user preferences, PDF/transcript ingestion routes.
Browser coverage of these routes: see `docs/E2E.md` (Playwright).
