# Phase 2 progress — production readiness

Updated continuously. Evidence levels: **I** implemented · **T** automated tests · **M** manual · **L** live provider · **B** real browser · **D** deployed.

## Stage 0 — baseline (re-verified 2026-10-12)

| Item | Result |
|---|---|
| Project root | `<repo>` |
| Git | **A repository exists** at the project root (`.git`, branch `main`, remote `origin` = github.com/Tejeshub/EquityLens, 5 prior commits). **The Phase 1 report said "not a git repository" — that was wrong**: I ran `git status` from the parent directory. Corrected here. |
| Checkpoint | Phase 1 work committed locally on branch `phase1-real-data` (`a9efd69`), **not pushed**. `main` untouched. `.env`, `.venv`, `chroma_data`, `node_modules` are git-ignored; a working-tree scan found no real secret values outside `backend/.env`. |
| CLAUDE.md | none present |
| Backend | `backend/.venv` exists (5.7 GB legacy full install). `ENVIRONMENT=test … pytest` → **91 passed**. |
| Frontend | `node_modules` present. `vitest` → 70 passed; `tsc` ok; `eslint` 0 errors / 8 warnings. |
| Local DB | container `equitylens_dev_pg` (port 55433) is **mine** from Phase 1, holds only throw-away dev/test data (`equitylens_test` is dropped by the test harness; `equitylens_dev` holds an imported company master + a live-check user). Another container `smh_test_pg` belongs to a different project and is untouched. |

## Findings verified against reality

1. **No secret values in git history.** All revisions were searched for every value in `backend/.env` (hash-free substring search, nothing printed). The only matches were the *placeholder* strings in the old `.env.example` (`your_grok_api_key`, …) — not real keys. Active keys were never committed.
2. **Supabase database is empty** (read-only session, `default_transaction_read_only=on`): schemas auth/extensions/graphql/pgbouncer/public/realtime/storage/vault; **`public` has zero relations and zero functions; no `alembic_version`; `auth.users` = 0; `storage.objects` = 0; 10 MB (Supabase system objects only); PostgreSQL 17.11.** Consequences: (a) there is no production data to preserve *today*; (b) the Phase 1 advice to run `alembic stamp 0001` was wrong for this database — a fresh `upgrade head` is the correct path; (c) the "invented Q3FY24 seed rows" cannot exist here. Nothing was written to Supabase. Migration against it still waits for approval (see Stage 3).
3. Firecrawl key: legacy `sentiment_debater.py` sent it as a bearer token to `moneycontrol.com` (reproduced from source, see Stage 1). Owner must rotate.
4. A captured Screener.in page fragment is committed as a test fixture (`backend/tests/fixtures/screener_persistent_tables.html`) — restricted-source content in a repo with a public-looking remote; to be replaced with a synthetic fixture.

## Stage 3 — migration rehearsal (isolated; nothing touched Supabase)

Rehearsal target: throw-away container `equitylens_rehearsal_pg` (**PostgreSQL 17.11, same major/minor as Supabase**), port 55434, credentials unrelated to any real system.

| Scenario | Result (T/M) |
|---|---|
| A. Empty database (what Supabase actually is): `alembic upgrade head` (0001→0005) | succeeds; `alembic current` = 0005; `alembic check` clean; `/ready` true; 15 tables created |
| A2. Full backend suite on PG 17.11 | 91 passed |
| B. Original pre-Phase-1 schema (built from the original `structured_store.py` at commit 5123e97, with 2 synthetic rows) | column definitions identical to migration 0001; `upgrade head` without stamp fails safely (tables exist); `stamp 0001` + `upgrade head` succeeds, both rows survive, `alembic check` clean |
| Rollback | migration 0001 downgrade deliberately raises (refuses to drop legacy tables); 0002–0005 downgrade drops only tables they created (verified up/down/up in Phase 1). Recovery plan for Supabase: since the database is empty, "restore" = drop the tables the migrations created; take a Supabase backup/snapshot first anyway |

Still gated: applying anything to Supabase needs your explicit approval (see final report).


## Issue register (consolidated from the ten read-only audits; each material claim re-checked against source or by a reproduction)

Status key: **Fixed** (code + regression test) · **Mitigated** · **Open** (needs owner/other decision) · **N/A**. "Conf" = confirmed (reproduced / literal source or terms text) or suspected.

### Provider terms (public multi-user display) — decisions
| # | Sev | Finding & evidence | Conf | Disposition | Status |
|---|---|---|---|---|---|
| P1 | critical | **Screener.in**: ToS licence is "personal, non-commercial transitory viewing only"; forbids "modify or copy", "any public display (commercial or non-commercial)" and "mirror ... on any other server"; no API/licence exists (support: "we don't provide APIs"). Scraping+storing+serving to public users violates the literal text. | Conf (literal text, 2 independent fetches) | Source disabled by policy in the public profile (`ENABLE_SCREENER`); fundamentals/shareholding/compare/Copilot-financials/research fundamental+alternative dimensions return explicit "unavailable: no source licensed". Re-enable only with written permission. | Fixed (code+tests); **owner decision: licence/alternative** |
| P2 | critical | **Yahoo Finance chart/spark**: ToS prohibits automated collection, reproducing/distributing/publicly performing the Services and any commercial reuse; no official finance API; yfinance itself says personal/research use. | Conf (literal text) | Disabled in public profile (`ENABLE_YAHOO`): quotes, history, movers, watchlist prices off with explicit reason. No compliant free replacement found (NSE/BSE EOD files need written permission; Alpha Vantage free = personal use; Twelve Data free = non-display; Tiingo internal-only; Finnhub personal). | Fixed; **owner decision: licensed price source** |
| P3 | medium | **NSE lists** (EQUITY_L.csv, index lists): no clause permits third-party display; NSE ToU forbids scraping/storing/displaying site content without written permission; NSE Indices licenses "use or distribution" of index data. Company identity (name/symbol/ISIN) is the minimum the product needs. | Suspected (terms silent/unclear) | Identity data kept; index-derived fields (sector, Large/Mid/Small) off in public profile (`ENABLE_NSE_INDEX`). Email NSE Data & Analytics/Indices for written confirmation. | Mitigated; **owner action** |
| P4 | medium | **Exa**: ToS 4.2(a) bars copying/displaying obtained information unless permitted in writing; display rights to end users not found. | Suspected | Public profile requests **headlines + URLs only** (no `contents`, no excerpt stored/shown); Exa output used server-side for LLM labelling and shown as link-outs with attribution. Ask Exa for written permission before enabling excerpts. | Mitigated |
| P5 | high | **Gemini free tier**: prompts/outputs used to improve Google products and human-reviewable; users told not to submit personal info. Copilot sends users' free text. | Conf (literal text) | Copilot defaults to **Groq** (no-training, no-retention-by-default terms). Gemini used only when `COPILOT_PROVIDER=gemini` AND `GEMINI_BILLING_ENABLED=true` (paid Cloud project; owner decision) — or in the personal profile. | Fixed |
| P6 | info | Groq quotas: dev plan table lists gpt-oss-20b 30 RPM / 1K RPD / 8K TPM / 200K TPD; Gemini free-tier numbers not published on the fetched page; Exa free tier = $10/month credits. | Conf | budgets conservative; docs updated | Documented |

### Security (auth & API surface)
| # | Sev | Finding | Conf | Fix / regression test | Status |
|---|---|---|---|---|---|
| S1 | high | Per-IP register/login limits keyed on `request.client.host`: behind Vercel→Render all users share one IP (site-wide cap) or XFF is spoofable if trusted naively | Conf (real uvicorn runs) | `client_ip()` honours `TRUSTED_PROXY_HOPS` using the Nth-from-right XFF entry (never leftmost); failure counters keyed (account,IP) with high per-account/IP ceilings; global registration cap; documented spoof caveat for direct `*.onrender.com` access (use custom domain / block direct) · `test_client_ip_*`, `test_attacker_cannot_lock_out_victim_from_another_ip` | Fixed / Mitigated (config-dependent) |
| S2 | medium | Account lockout DoS (counted before password check, never reset) | Conf | failure-only counting, reset on success · `test_login_failures_throttled…`, `test_success_resets…` | Fixed |
| S3 | medium | Email normalisation: invisible chars/homoglyphs/plus-tags created unlimited accounts | Conf | NFKC + reject Cf/Cc/Zs + ASCII-only + canonical (plus-tag, gmail dots) unique column (migration 0006) · `test_email_normalisation_blocks_variants` | Fixed |
| S4 | medium | Argon2 memory/DB-pool exhaustion under concurrent auth | Suspected | bounded hashing semaphore (HASH_CONCURRENCY=3, 503 when saturated) | Mitigated |
| S5 | low | Non-ASCII `X-CSRF-Token` → 500 | Conf | bytes compare · `test_non_ascii_csrf_header_is_403_not_500` | Fixed |
| S6 | low | Prompt-structure injection: untrusted titles/text could forge `<source>` tags | Conf | HTML-escape in prompt builders · `test_untrusted_text_cannot_forge_source_tags` | Fixed |
| S7 | low | No idle timeout / revoke-all / purge | Conf | idle timeout (72 h), `/auth/logout-all`, startup + opportunistic purge, login rotates session · tests in test_auth | Fixed |
| S8 | low | Origin check trusted client `Host`; /auth/* POSTs lacked CSRF token (logout forceable) | Conf | allow-list only; logout requires CSRF when a session exists · `test_logout_requires_csrf…` | Fixed (login/register rely on Origin allow-list + SameSite=Lax; no pre-session token exists) |
| S9 | info | Production default ALLOWED_ORIGINS fell back to localhost | Conf | startup fails in production if unset · `test_production_requires_explicit_allowed_origins` | Fixed |
| S10 | medium | Auth enforced per-route only (new route public by omission) | Conf | router-level `Depends(current_user)` for all /api/v1 + test over ALL routes with explicit public allow-list | Fixed |
| S11 | high (hygiene) | Firecrawl key was sent as bearer to moneycontrol.com by pre-Phase-1 code (`git show 5123e97:backend/agents/sentiment_debater.py` lines 28-34, quoted); legacy code printed Groq key tail | Conf | leak lines removed from the dormant legacy module; **key must be rotated by owner** (cannot be done by me) | Fixed in code / **Open: owner rotates** |
| S12 | info | Git history: no real secret ever committed (value search across all revisions; only placeholders); frontend bundle has no secrets (`dist` grep) | Conf | — | Verified |

### Integration / contract / UX
| # | Sev | Finding | Fix | Status |
|---|---|---|---|---|
| C1 | medium | movers: no response_model, silent partial results, `.NS` symbols leak | `MoversOut` model, `partial`/`batches_failed`, NSE symbols | Fixed (backend) / frontend in progress |
| C2 | medium | malformed id shows raw 422; `no_data` code not mapped; structured 429 message overwritten | backend maps `no_data`→`not_covered`; frontend treats 404/422 as not found | backend Fixed / frontend in progress |
| C3 | low | compare ignores per-company status, only quarterly reachable | UI work | frontend in progress |
| C4 | low | CORS: 500 and Retry-After not readable cross-origin | catch-all inside CORS; `expose_headers` · `test_cors_exposes_retry_after_and_500_has_cors` | Fixed |
| C5 | medium | ~10 endpoints only type-asserted in the client (blank screen on shape change) | zod schemas | frontend in progress |
| C6 | low | `GET /financials` and other GETs have provider side effects/budget use | documented in API_INVENTORY; per-user read limiter evaluated under reliability | see R-section |
| C7 | medium | Frontend: combobox a11y, auth error mapping, session-check treats outage as logout, tab state loss, copy claims, navbar mobile, chart a11y, placeholder width | frontend agent | in progress |
| C8 | medium | vercel.json placeholder unreplaced, no security headers | guard script + headers | frontend in progress |
| D1 | medium | npm audit: 16 advisories (2 critical, 6 high, 8 moderate). Runtime: react-router (moderate, open-redirect via backslash; reachable in-browser) | react-router 7.18.4, vite 7.3.7, vitest 4.1.11, esbuild 0.28.2; residual: tailwind 3.x build chain (9 advisories, build-time only, fix = breaking tailwind 4) | Fixed except residual (documented) |
| D2 | info | ESLint 8 warnings = `react-refresh/only-export-components` in shadcn ui files (dev HMR hint, no hooks bugs) | documented; no suppression | Accepted |
| L1 | info | 3 legacy chunker tests: 2 stale tests + 1 real defect (oversized paragraph never split; short trailing paragraph silently dropped) | defect fixed in `transcript_scraper.py`, tests strengthened (31/31 legacy pass); module remains unreachable/deferred | Fixed |
| F1 | medium | Captured Screener/Yahoo/Exa/NSE content committed as test fixtures | replaced by synthetic generated fixtures (`tests/fixtures/make_synthetic_fixtures.py`) | Fixed (old files still exist in git history of the local checkpoint commits) |
| J1 | medium | ~25 s synchronous research through Vercel rewrite + sleeping Render instance is unreliable | bounded async job flow (queue cap, concurrency cap, per-user dedupe, timeout, ownership) · `test_research_jobs.py` | Fixed |

## Reliability findings (R-series) — all verified by experiment (two uvicorn processes, mocked upstreams, scratch DB)
| # | Sev | Finding | Fix | Regression test | Status |
|---|---|---|---|---|---|
| R1 | **critical** | Request-capacity deadlock: 80 concurrent trivial authenticated requests → 40 HTTP 500 after 30 s (240 → ~190 failures); pool 10 vs 40 threads; connections held while awaiting threads. Pool ≥ threads alone does NOT fix it (reproduced). | admission middleware (in-flight ≤ THREADPOOL_SIZE, queue-wait 20 s → 503), DB pool = inflight + research workers + 2, bounded threadpool | `test_no_threadpool_db_pool_deadlock_under_concurrency` (real uvicorn, 240 concurrent; **fails when admission is disabled**, verified) | Fixed |
| R2 | high | each budget check opened a second connection from the same pool | separate tiny budget pool | covered by R1 test | Fixed |
| R3 | high | Groq 429 handling blocked a worker for 135 s per call (slept after the last attempt too) | no sleep after final attempt; `max_retry_after` 20 s; research moved to background jobs | `test_no_sleep_after_final_429_attempt`, jobs tests | Fixed |
| R4 | high | one user could drain global Screener/Exa/Yahoo budgets (no per-user read limits) | `core/limits.per_user` on quote/history/movers/news/financials/snapshot/compare | `test_per_user_read_limits` | Fixed |
| R5 | medium | no negative caching; waiters retried sequentially behind a failing leader (50 concurrent → 50 upstream calls); Screener "not found" refetched every request | negative cache by error kind, Screener failure cooldown | `test_failures_are_cached_briefly…`, `test_failed_or_uncovered_company_is_not_refetched…` | Fixed |
| R6 | medium | caller 4xx (400) could open the breaker for everyone; half-open admitted all callers | only provider-side failures count; single half-open probe; thread-safe | `test_caller_errors_do_not_trip_the_breaker`, `test_half_open_admits_exactly_one_probe` | Fixed |
| R7 | medium | httpx timeouts are per phase: slow-drip upstream held a thread indefinitely | total per-attempt deadline + response size cap | `test_total_deadline_stops_slow_drip_upstream`, `test_response_size_is_capped` | Fixed |
| R8 | low | per-key lock dict leaked / lock popped while in use | ref-counted locks | `test_locks_are_released…` | Fixed |
| R9 | medium | fixed-window budgets allow ≈2× burst at window edges | budgets are set below real quotas; documented | – | Accepted |
| R10 | low | caches/breaker per process (budget IS shared via Postgres: verified 120 cold quotes over 2 processes → exactly 30 upstream calls) | single Render instance assumed; documented | – | Accepted |

## Stage 8 / 10 verification log
| Check | Command / method | Result |
|---|---|---|
| Backend suite | `ENVIRONMENT=test … pytest` (full venv, fastapi 0.135) | **146 passed** |
| Backend suite on the production dependency set | clean venv from `requirements-dev.txt` (fastapi 0.143, starlette 1.7) | **146 passed** (this caught 2 tests that depended on Starlette route-object internals → now OpenAPI-based) |
| Backend suite on PostgreSQL 17.11 | rehearsal container | 146 passed |
| Legacy suite | `pytest tests/legacy` | 31 passed (3 earlier failures: 2 stale tests + 1 real chunker defect, fixed) |
| `pip-audit -r requirements.txt` | pinned runtime deps | no known vulnerabilities |
| Frontend | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` | tsc clean · eslint 0 errors / 12 warnings (all `react-refresh/only-export-components`) · vitest 156 passed (16 files) · build OK |
| `npm audit` | full / `--omit=dev` | 9 (4 moderate, 5 high) / 7 (2 moderate, 5 high); **all in the tailwind 3.x build chain**, none reachable at runtime; fix requires tailwind 4 (not forced). Was 16 incl. 2 critical |
| Browser E2E | `cd frontend && npm run e2e` (run by me, plus by the E2E agent twice) | **109 passed**, 0 failed/skipped/flaky, ~57 s; also green with `E2E_PYTHON` = production-dependency venv |
| Migration rehearsal (current tree) | PG 17.11 containers | fresh → head 0007, `alembic check` clean, `/ready` ok; legacy schema + 2 rows → `stamp 0001` + upgrade, rows kept; incremental 0004→0007 on a DB with existing users (canonical-email back-fill) OK |
| Secret scan | working tree + all git revisions + `frontend/dist` | none (placeholders only); no provider variable names in the bundle |
| Live Copilot (Gemini) | 1 request, real Exa headlines, `DATA_PROFILE=public`, `COPILOT_PROVIDER=gemini`, `GEMINI_BILLING_ENABLED=true` for that process only | 200 in 3.4 s, `grounded: true`, 1 citation (headline + link, no excerpt) |
| Supabase | read-only inspection only | empty `public` schema; **nothing written** |

## Task log
- Stage 0–4, 6–8 and 10 complete as above. Stage 9 (production smoke) not applicable: nothing deployed.


# Pre-push audit (Phase 3) — log
| Item | Result |
|---|---|
| Repo state | root `<repo>`; `main` == `origin/main` == `5123e97` (never pushed to); 4 unpublished local commits on `phase1-real-data`; remote `https://github.com/Tejeshub/EquityLens.git` |
| Captured third-party fixtures in unpublished history | exactly 5 files, added in `a9efd69`, deleted in `67a38c8`: `backend/tests/fixtures/{screener_persistent_tables.html, yahoo_chart_5d.json, yahoo_spark.json, exa_news.json, nifty_sample.csv}` → excluded from the publishable branch (see final report for the construction and verification) |
| Captured content in already-published history (`origin/main`) | `backend/raw_data/Sun Pharma/filing_20260411_2b2e4138.html` (272 KB investor-page capture from the original author's first commits) and `Images/*.png` (screenshots of the removed mock UI). Not touched (shared history); the HTML file is dropped from the new branch's tree. Removing it from history needs a rewrite of shared history → **needs your approval** |
| Firecrawl | path re-quoted from `5123e97`; current tree: no active code mentions firecrawl/llama_cloud/moneycontrol, `config.py` no longer reads those keys, importing `main` loads no legacy module/scraper SDK/`providers.fixtures` (`tests/test_release_hygiene.py`); absolute-URL host pinning in `ProviderClient` so a key cannot be sent to another host |
| Secrets | no real value in any git revision or `frontend/dist` (value search for all `.env` values + key patterns); credentials read server-side only; the frontend references none of the variable names (tested) |
| Policy | news now has its own switch and is **off in the public profile**; AI research/Copilot refuse (503 `source_disabled`, no job, no model call) while no evidence source is enabled; UI makes no request for disabled sources (browser tests assert request absence) |
| Proxy topology | Vercel docs: overwrites `X-Forwarded-For`; Render: staff say real IP first, user reports append; **unverified for the rewrite chain** → default hops 0 skips per-IP ceilings, `DEBUG_PROXY_CHAIN` probe + measured procedure in DEPLOYMENT.md §7 |
| Provider failure matrix | 429 / 500 / invalid payload / timeout / empty result / stale-then-fail / retry bound for quote, history, news, financials: explicit status+code, nothing invented, nothing stored (`tests/test_provider_failures.py`, 21 tests) |
| DB rehearsals (PG 17.11) | fresh→0007; legacy+stamp; incremental 0005→0007 with collision users; downgrade 0007→0005 and re-upgrade (users/companies preserved); `pg_dump`/`pg_restore` + `/ready`; 178-test suite on PG 17.11 |
| npm audit | 7 (2 moderate, 5 high), all `tailwindcss@3.4.19` build chain (`chokidar→braces`, `fast-glob→micromatch`, `postcss-nested`/`postcss-selector-parser`); unused `@tailwindcss/typography` and `lovable-tagger` removed (−2); fix = Tailwind 4 migration (not done; see report) |
| Backend / frontend / E2E | backend 178 passed (full venv + production-pin venv + PG 17.11), legacy 31, vitest 162, E2E 119+4 skipped (dev) and 123 (prod build), run by me with the production-pin Python |

## Publishable branch `release/phase2-clean` — construction and verification
- **Recovery:** the full local history (including the earlier captured fixtures) is preserved in branch `backup/phase1-real-data-87efcc6`, the local branch `phase1-real-data`, and an off-repo bundle (`~/equitylens-recovery-87efcc6.bundle`, verified). Treat those as private: **never push them** (they contain captured third-party fixture data).
- **Construction:** nothing was rewritten or force-moved. Three new commits (backend / frontend / docs+config) were created with `git commit-tree` directly on top of `main` (= `origin/main`, `5123e97`) from the final tree of `phase1-real-data`, minus `backend/raw_data/` (a captured investor-page HTML). The unpublished intermediate commits are therefore not ancestors of the branch.
- **Verification (all executed):** `main` is an ancestor; exactly 3 commits, no merges; 253 objects unique to the branch; none of the 5 captured-fixture blob ids present; no `.env`/`.venv`/`node_modules`/`raw_data`/`dist` paths; no value from the real `backend/.env` and no key/private-key/JWT pattern in any new blob (only fake test strings and a shell template); tree identical to `phase1-real-data` except the dropped `raw_data` file.
- **Fresh-checkout reproduction** (git worktree of the branch, new venv from `requirements-dev.txt`, `npm ci`): backend 178 passed, `pip-audit` clean; `tsc` clean, vitest 162 passed, eslint 0 errors (12 warnings), build OK, `npm audit` 7 (tailwind chain); Playwright production-build mode 123 passed. Production-config smoke (`ENVIRONMENT=production`, real uvicorn, fresh PG 17.11 migrated to head, no provider keys): `/health`, `/ready` (schema true), `/docs` 404, capabilities all sources off, Secure/HttpOnly/SameSite cookies, CSRF and bad-Origin 403, 503 `source_disabled` for news/quote/financials/movers/research, logout → 401.
- **Reading the branch graph.** The publishable branch is deliberately **not** a descendant of `phase1-real-data`: `git merge-base --is-ancestor phase1-real-data <release>` is *false* and `git diff <release> phase1-real-data` shows `backend/raw_data/Sun Pharma/filing_20260411_2b2e4138.html` as **added** — both are by design (that file is the captured page that exists in `main`'s published history and in `phase1-real-data`, and is intentionally absent from the release tree). The release branch carries the same *final tree*, not the same commits.
- **Not fixed (shared history):** the already-published `origin/main` still contains `backend/raw_data/Sun Pharma/filing_20260411_2b2e4138.html` and `Images/*.png` (screenshots of the removed mock UI). Removing them from history requires rewriting shared history → needs your approval.
