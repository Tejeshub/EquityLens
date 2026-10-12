# Deployment guide — Vercel (frontend) + Render (backend) + Supabase Postgres

**Status: NOT deployed. Nothing in this repository deploys itself, and no production database has been modified.** You (the owner) perform
every step below. What was verified locally is listed in `docs/PHASE_2_PROGRESS.md`; items that can only be verified after deployment are
marked **[verify after deploy]**.

## 0. Before you deploy — decisions you must make
1. **Data sources (all restricted ones are OFF by default).** With `DATA_PROFILE=public` (the production default) **no evidence source is enabled**: prices (Yahoo, unofficial),
   reported financials/shareholding (Screener.in), sector/segment labels (NSE index lists) and news (Exa) are all off, because their terms either forbid public display or leave
   it unresolved (`docs/PROVIDERS.md`). What remains: account registration/login, company search (name/symbol/ISIN from NSE — itself pending NSE's written confirmation) and
   watchlists (names only). Research and Copilot **refuse** (503 `source_disabled`) because they would have nothing to rest on. This is deliberately conservative: **the app is
   not cleared for public commercial use** until the permissions in PROVIDERS.md §"Unresolved licensing questions" are obtained. Switches: `ENABLE_YAHOO`, `ENABLE_SCREENER`,
   `ENABLE_NSE_INDEX`, `ENABLE_NEWS`, `ENABLE_NEWS_EXCERPTS` — a flag does **not** grant legal permission; turning one on is your decision and your risk.
2. **Copilot model.** Default `COPILOT_PROVIDER=groq`. Gemini's free tier may use prompts to improve Google products and allows human review; use it for public user text
   only on a billing-enabled Cloud project (`GEMINI_BILLING_ENABLED=true`) — billing is your decision.
3. **Rotate `FIRECRAWL_API_KEY`** (§8). Registration is open without email verification (no mail delivery exists); password reset is not implemented.

## 1. Architecture
Browser → **Vercel** (static SPA + security headers) → `/api/*` and `/auth/*` rewritten by Vercel to **Render** (FastAPI) → **Supabase** Postgres.
The browser only talks to the Vercel origin, so the session cookie (`el_session`, HttpOnly, Secure, SameSite=Lax) is first-party; no
cross-site cookies and no CORS-with-credentials are needed. **Leave `VITE_API_URL` unset in production.** The API's CORS allow-list and
CSRF Origin check use the Vercel origin (`ALLOWED_ORIGINS`), because the browser's `Origin` is the Vercel domain.
Research runs as a background job (the POST returns in milliseconds; the UI polls), so no single request is long-lived.

## 2. Environment variables (names only — never commit values)
### Backend (Render) — secrets are marked 🔒
| Variable | Purpose | Required | Default / notes |
|---|---|---|---|
| `ENVIRONMENT` | `production` turns on Secure cookies, hides `/docs`, requires `ALLOWED_ORIGINS`, refuses fixture mode | **yes** | `development` |
| `DATABASE_URL` 🔒 | Postgres URL (`postgresql+psycopg2://…`). Supabase **session-mode pooler, port 5432**. Legacy name `POSTGRES_URL` still read | **yes** | — |
| `ALLOWED_ORIGINS` | Exact browser origin(s), comma-separated, no trailing slash (your Vercel URL). Startup fails in production if unset | **yes** | — |
| `DATA_PROFILE` | `public` (restricted sources off) or `personal` | recommended explicit `public` | `public` in production |
| `ENABLE_YAHOO` / `ENABLE_SCREENER` / `ENABLE_NSE_INDEX` / `ENABLE_NEWS` / `ENABLE_NEWS_EXCERPTS` | per-source override of the profile (`true`/`false`). Excerpts require news. **Not a licence** | no | profile decides (public = all off) |
| `GROK_API_KEY` 🔒 | **Groq** API key (legacy variable name) — research narratives and, by default, Copilot | only if an evidence source is enabled | — |
| `EXA_API_KEY` 🔒 | Exa search (only used if `ENABLE_NEWS=true`) | only if news is enabled | — |
| `GEMINI_API_KEY` 🔒 | Gemini (only if `COPILOT_PROVIDER=gemini`) | optional | — |
| `COPILOT_PROVIDER`, `GEMINI_BILLING_ENABLED` | model choice for Copilot (see §0.2) | no | `groq`, `false` |
| `GROQ_MODEL` | model id | no | `openai/gpt-oss-20b` |
| `THREADPOOL_SIZE` | request worker threads **and** in-flight cap. DB pool = THREADPOOL_SIZE + RESEARCH_MAX_CONCURRENT + 2 (+`DB_POOL_EXTRA`=4) plus 5 for the budget pool — keep the sum under your database's connection limit | no | 24 (render.yaml sets 10) |
| `RESEARCH_MAX_CONCURRENT`, `RESEARCH_MAX_QUEUE`, `RESEARCH_JOB_TIMEOUT_S` | background research bounds | no | 2, 20, 600 |
| `RESEARCH_PER_USER_PER_DAY`, `ASK_PER_USER_PER_HOUR` | per-user AI budgets | no | 5, 30 |
| `REGISTER_PER_IP_PER_HOUR`, `REGISTER_GLOBAL_PER_HOUR`, `LOGIN_FAIL_PER_ACCOUNT_IP`, `LOGIN_FAIL_PER_ACCOUNT`, `LOGIN_FAIL_PER_IP` | abuse controls (failures only are counted) | no | 10, 300, 5, 50, 30 |
| `TRUSTED_PROXY_HOPS` | number of proxies in front of the app, used to find the client IP in `X-Forwarded-For` (never the left-most entry). Leave **unset (0)** until you have verified the chain (§7); with 0 and a private peer address (Render's load balancer) per-IP ceilings are skipped rather than pooling all users | no | 0 |
| `SESSION_TTL_HOURS`, `SESSION_IDLE_HOURS`, `COOKIE_SECURE` | sessions (absolute 168 h, idle 72 h, Secure on in production) | no | |
| `EXA_REQUESTS_PER_DAY`, `GROQ_REQUESTS_PER_DAY`, `YAHOO_REQUESTS_PER_MINUTE`, `GEMINI_REQUESTS_PER_DAY` | global provider budgets (conservative; real quotas unverified) | no | 40, 500, 30, 200 |
| `DEBUG_PROXY_CHAIN` | temporary diagnostic for §7 (logs the forwarding chain of the first 20 `/api/v1/capabilities` requests; no cookies/bodies). Turn off afterwards | no | `false` |
| `PROVIDER_MODE` | **must stay `live` (default)**; `fixture` is test-only and the app refuses to start with it in production | no | `live` |
| `RESEARCH_JOBS_INLINE` | **tests only**; the app refuses to start with it in production | no | `false` |
### Frontend (Vercel) — all public
No environment variables are required. (`VITE_API_URL` exists but must stay **unset** so API calls stay same-origin through the rewrites.)

## 3. Database & migrations (Supabase) — you run this; the repository never touches it
Each step is labelled: **[READ-ONLY]** inspection, **[LOCAL]** rehearsal on a throw-away database, **[BACKUP]**, **[WRITE — you authorize]** production change.
Facts (verified read-only on 2026-10-12, PostgreSQL 17.11): the Supabase `public` schema was **empty**, no `alembic_version`, `auth.users` = 0. No later write of any kind has been made.

**[LOCAL] Rehearsals already performed on disposable PostgreSQL 17.11 (rerun them yourself with the commands in `docs/PHASE_2_PROGRESS.md`):**
| Scenario | Result |
|---|---|
| fresh empty DB → `alembic upgrade head` (0001→0007) | head `0007`, `alembic check` clean, `/ready` ok |
| original (pre-Phase-1) schema + rows → `stamp 0001` → `upgrade head` | rows preserved, check clean (column definitions identical to 0001) |
| incremental 0005 → 0007 with existing users, including two that collapse to one canonical email (`a.b@gmail.com`, `ab@gmail.com`) | succeeds; the later duplicate gets `email_canonical = '…#dup-<id>'` (kept working, cannot collide); users/companies preserved |
| `downgrade 0007 → 0005` then `upgrade head` | users and companies preserved; downgrade drops `users.email_canonical` and the `research_jobs` table (their data is lost; canonical emails are recomputed on re-upgrade) |
| `pg_dump --format=custom` → `pg_restore` into a new DB | row counts, `alembic_version` and `/ready` identical after restore |
`alembic downgrade` below 0001 is deliberately refused (it would drop the legacy financial tables).

**Production procedure**
1. **[READ-ONLY]** re-check the target is still empty (prints no data/credentials):
   `cd backend && DATABASE_URL='<supabase url>' .venv/bin/python scripts/inspect_db_readonly.py`
   Expected: `public relations: NONE (empty)`, `alembic_version table: absent`. **If it shows tables or rows, STOP** — the plan then depends on what exists; a database created by the old
   `init_db.py` needs `alembic stamp 0001` only after confirming its schema matches (the rehearsal proved this for the original schema).
2. **[BACKUP]** `pg_dump --no-owner --format=custom -f pre_equitylens.dump "<url>"` (and/or a Supabase dashboard backup). Verify it restores:
   `createdb scratch && pg_restore --no-owner -d scratch pre_equitylens.dump` on a local Postgres.
3. **[WRITE — you authorize]** `cd backend && DATABASE_URL='<url>' .venv/bin/alembic upgrade head`, then `alembic current` must print `0007 (head)` and `alembic check` must be clean.
4. **[WRITE — you authorize]** load the company master (needed for search; reads public NSE files, see PROVIDERS.md P3): `DATABASE_URL='<url>' .venv/bin/python scripts/import_companies.py` (re-run monthly).
5. **Recovery.** If the database was empty before step 3: restore the step-2 dump or drop the tables the migrations created (`users, auth_sessions, rate_limit_counters, companies, listings,
   index_memberships, financial_facts, documents, document_chunks, watchlists, watchlist_items, research_reports, research_jobs, financials_quarterly, raw_documents, guidance_entries,
   alembic_version`). If it was not empty, restore the dump (do **not** use downgrades as a recovery for data you did not create).
6. Future releases: take a backup, run `alembic upgrade head` the same way **before** deploying code that needs it; `GET /ready` returns 503 `schema_mismatch` while database and build disagree.
7. Connection budget: DB pool = `THREADPOOL_SIZE` + `RESEARCH_MAX_CONCURRENT` + 2 (+`DB_POOL_EXTRA`=4) plus a 5-connection budget pool; render.yaml sets `THREADPOOL_SIZE=10` (≈ 23 connections). Check your Supabase plan's limit.

## 4. Render (backend)
1. New → Blueprint (uses `render.yaml`) or Web Service: runtime Python 3.12, root directory `backend`, build `pip install -r requirements.txt`, start
   `uvicorn main:app --host 0.0.0.0 --port $PORT`, health check path `/health`, plan Free.
2. Add the environment variables from §2 (secrets in the dashboard).
3. Deploy. Expect a slow first request after idle (free instances sleep). Optional, free: an external uptime pinger on `/health` to keep it warm.
4. Check `GET https://<service>/ready` → `{"status":"ready","database":true,"schema":true}`. `/docs` must be 404.

## 5. Vercel (frontend)
1. Import the repo; **Root Directory `frontend`**, framework preset Vite, build `npm run build`, output `dist`.
2. In `frontend/vercel.json` replace both `RENDER_BACKEND_URL` placeholders with your Render origin (e.g. `https://<service>.onrender.com`, no trailing
   slash) and commit. The build **fails on Vercel** (`VERCEL=1`) while the placeholder remains — deliberate guard (`scripts/check-vercel-config.mjs`).
3. No environment variables. Security headers and the CSP are set by `vercel.json` (API is same-origin so `connect-src 'self'`).
4. Set `ALLOWED_ORIGINS` on Render to the final Vercel production origin (and add preview origins only if you want previews to log in).

## 6. Manual post-deploy checklist (nothing below has been performed) **[verify after deploy]**
1. `https://<render>/health` → `{"status":"ok"}`; `/ready` → `{"status":"ready","database":true,"schema":true}`; `/docs` → 404.
2. Open the Vercel URL: page loads over HTTPS; DevTools → Network: API calls go to the **Vercel origin** (`/api/...`, `/auth/...`), console has no errors, response headers include the CSP, HSTS, X-Frame-Options.
3. Register a new account → you are signed in; cookies `el_session` (HttpOnly, Secure, SameSite=Lax) and `el_csrf` (Secure, readable) are set. Reload → still signed in. Log out → protected pages redirect to login.
4. Wrong password ×5 for one account → 429 with a retry message (per-account/pair limiter). Then do §7 to confirm per-IP behaviour.
5. Company search returns NSE companies. **Capability flags:** `GET /api/v1/capabilities` shows every source `enabled:false` with a reason; the company page shows notices instead of prices/chart/financials/news, makes **no** `/quote`, `/history`, `/financials`, `/news` requests (Network tab), and the Research and Copilot tabs explain that no data source is enabled; direct `POST /api/v1/research/<id>` or `/ask` returns 503 `source_disabled`.
6. Watchlists: create, add a company, refresh the page (persists), log out/in (persists), rename, delete.
7. Second account (another browser profile): cannot see the first account's watchlists.
8. **Only if you deliberately enabled a source:** repeat the relevant checks (news with links, research job → running → complete, Copilot answer with citations) and test failure handling by temporarily setting a wrong provider key (expect a clear unavailable state, not a blank page), and by hitting the provider's rate limit sparingly (expect 429 message, no retry storm).
9. Render free tier: expect the first request after ~15 minutes idle to take 30–60 s (cold start) and possibly fail once through the Vercel proxy; a retry works. An external uptime pinger on `/health` keeps it warm (free).

## 7. Client IP behind Vercel → Render, and rate limits (unverified production-only behaviour)
What the code does: `TRUSTED_PROXY_HOPS=N` takes the client address from `X-Forwarded-For` counted **from the right** (never the left-most, spoofable entry): with chain `xff + [peer]`, the client is element `-(N+1)`.
With the default `0` and only a private/loopback peer visible (Render's load balancer), **per-IP ceilings are skipped** (they would pool all users behind one address); per-(account, IP) and per-account
counters and the **global registration cap** (300/h, `REGISTER_GLOBAL_PER_HOUR`) still apply. So the safe default needs no configuration; configuring hops only *adds* per-IP protection.
What is known: Vercel's request-header documentation says it overwrites `X-Forwarded-For` to prevent spoofing (and exposes `x-vercel-forwarded-for`); Render staff say the real client IP is placed first in `X-Forwarded-For`
and a user reports Render *appends* to an incoming value. **Neither is verified for a Vercel-rewrite → Render chain**, so measure it:
1. On Render set `DEBUG_PROXY_CHAIN=true` (leave `TRUSTED_PROXY_HOPS` unset) and redeploy. 2. From a network whose public IP you know, open `https://<vercel>/api/v1/capabilities` once, then once more sending a forged header
(`curl -H 'X-Forwarded-For: 203.0.113.7' https://<vercel>/api/v1/capabilities`). 3. Read the Render log lines `proxy-chain probe: peer=… xff_entries=… xff=[…]`. 4. Work out N: your real IP must be at index `-(N+1)` of `xff + [peer]`
**in both requests** and the forged `203.0.113.7` must not be able to occupy that index. If it can (the chain is spoofable through Vercel), leave `TRUSTED_PROXY_HOPS` unset. 5. Set `TRUSTED_PROXY_HOPS=N`, set `DEBUG_PROXY_CHAIN=false`.
6. Verify limits: 31 failed logins for *different* made-up emails from your IP → 429 (per-IP ceiling, `LOGIN_FAIL_PER_IP`=30); a second device on another network can still log in.
Residual: requests sent straight to the `*.onrender.com` URL bypass Vercel and can spoof the chain; prefer a custom API domain behind Vercel only, or rely on the account-level and global limits. There is no CAPTCHA or email verification,
so determined automated sign-ups are limited (300/hour globally, per-account failure counters) but not prevented.
Other unverified items: Vercel rewrite timeout behaviour on a cold Render start; background research jobs lost if Render restarts mid-job (reported `failed: timeout` after `RESEARCH_JOB_TIMEOUT_S`, user resubmits);
`Secure` cookies and the CSP over real HTTPS (unit + production-build E2E checks only); Supabase pooler connection limits.

## 8. Credential rotation (owner actions — I cannot do these and have not)
**Firecrawl (must rotate).** Evidence: `git show 5123e97:backend/agents/sentiment_debater.py` lines 28-34 built `{"Authorization": f"Bearer {FIRECRAWL_API_KEY}"}` and sent it with `requests.get` to
`https://www.moneycontrol.com/company-article/<company>/transcript` — a third party, not Firecrawl. The code has been removed from the tree, nothing imports it (`tests/test_release_hygiene.py`), and the setting
is no longer read; but if that code ever ran with your real key, moneycontrol.com received it. Steps: 1. Sign in at firecrawl.dev → *API Keys* (https://www.firecrawl.dev/app/api-keys) → create a new key (or skip if you no longer use
Firecrawl) → **delete/revoke the old key** in the same page (the exact button label could not be confirmed from documentation). 2. If you keep a key anywhere, update it: local `backend/.env`, and the Render environment (the app no longer needs it — you can simply delete `FIRECRAWL_API_KEY` from both). 3. Confirm the old key now fails
(a request with it should return 401). 4. Tell me once done; until you confirm, this is **not** recorded as rotated.
Precautionary rotation of the others (new key → set on Render → verify → revoke old): Groq (console.groq.com/keys), Gemini (Google AI Studio / Cloud console), Exa (dashboard.exa.ai/api-keys), LlamaCloud (unused: revoke),
Supabase (Database settings → reset the postgres password; consider a dedicated least-privilege role for the app), discountingcashflows (legacy, unused). Enable GitHub secret scanning + push protection on the repository.
