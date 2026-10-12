# EquityLens — Security audit

## Phase 2 status (2026-10-12) — read this section first
Method: independent adversarial review (code + running uvicorn against scratch databases), reliability experiments with two processes and 240-way concurrency, git-history secret
search, provider-terms review, dependency audits. Findings, evidence, fixes and regression tests are tabulated in `docs/PHASE_2_PROGRESS.md` (issue register S1–S12, P1–P6, R*, C*, D*).

**Verified secure / fixed (with tests):** no IDOR on any id-taking route (user B gets 404; browser E2E re-checks); parameterised SQL and escaped LIKE; tsquery built only from `[a-z0-9]` tokens;
CSRF token on every unsafe `/api/v1` route and on logout; Origin allow-list only (client `Host` no longer trusted); non-ASCII CSRF header → 403; failure-only login throttling keyed
(account, IP) with high ceilings, global registration cap, per-IP ceilings skipped when only a private proxy address is visible; email NFKC/ASCII/canonical uniqueness; bounded Argon2
concurrency; session rotation on login, idle (72 h) + absolute (168 h) expiry, logout-all, purge; router-level authentication for all `/api/v1`; sanitized 500s with CORS headers;
`/docs` off and `ALLOWED_ORIGINS` mandatory in production; untrusted text HTML-escaped inside prompt `<source>` blocks; provider responses size- and deadline-capped; breaker not
tripped by caller errors; per-user read limits protecting shared provider budgets; admission control + pool sizing removing a verified request-capacity deadlock;
live provider calls blocked inside automated tests.

**Credential incident.** Verified from `git show 5123e97:backend/agents/sentiment_debater.py` lines 28-34: the pre-Phase-1 code sent `FIRECRAWL_API_KEY` as a `Bearer` token to
`https://www.moneycontrol.com/...` (a third party, not Firecrawl). Whether it ever ran with the real key, or was logged by that host, cannot be determined → treat the Firecrawl key as
**compromised: rotate it (owner action, `docs/DEPLOYMENT.md` §8)**. The leaking lines were removed from the dormant legacy module; legacy code also printed the last 4 characters of the Groq key
(removed). Git history (21 commits, all branches) contains **no real secret value** (value search for every `.env` value + generic key patterns; only placeholders); `backend/.env` was never committed;
`frontend/dist` and sources contain no provider variable names or key patterns. Not examined: the GitHub remote itself (forks/PRs), non-text files in `Images/`.
Provider keys are read server-side only (`backend/config.py`, `providers/*`); the only frontend env var is `VITE_API_URL`.

**Open / accepted (documented, not hidden):**
- Registration is open and email is unverified, so one person can create many accounts (mitigated by global registration cap, per-account/IP counters and per-user budgets; a CAPTCHA/email verification is not implemented).
- Real client IPs behind Vercel→Render are unverified: `TRUSTED_PROXY_HOPS` must be set after observing the chain; a client can spoof `X-Forwarded-For` if it reaches the `*.onrender.com` URL directly.
- Fixed-window budgets allow brief 2× bursts at window boundaries (provider budgets are set conservatively).
- Circuit-breaker and caches are per process (one Render instance assumed); budgets are shared via Postgres.
- Frontend `npm audit`: 9 advisories remain, all in the tailwind 3.x build chain (braces/micromatch/fast-glob/chokidar/postcss-selector-parser/@tailwindcss-typography/postcss-nested), build-time only; fix = breaking tailwind 4 migration (not forced). `npm audit --omit=dev` shows the same chain, none reachable at runtime.
- Prompt injection can be reduced, not eliminated: model output is schema-validated, citations and figures are checked programmatically, and the model has no tools.
- `Secure` cookies and the CSP are verified by unit/static checks only until browsed over HTTPS on Vercel.
- The 72 KB test fixtures were synthetic-ised, but commits `a9efd69`… of the local branch history still contain the earlier *captured* fixtures; squash/rewrite before any push (needs your approval).

---

# Appendix: original pre-hardening audit (2026-10-12, Phase 1)

Date: 2026-10-12. Scope: source in `backend/` and `frontend/`. Method: code reading. No penetration testing
has been performed. Severity is relative to the intended multi-user deployment (Vercel + Render).

## Findings

| # | Sev | Area | Finding | Evidence | Planned fix |
|---|---|---|---|---|---|
| S1 | **Critical** | AuthN/Z | No authentication or authorization on any route; anyone can trigger paid LLM calls, scraping and DB writes. | `main.py` — no dependencies/guards | Session auth on all private routes (Stage B) |
| S2 | **Critical** | SSRF | `ir_page_url` from the request body is fetched server-side with no scheme/host/IP validation; links found on that page are then downloaded too. | `tools/discovery_tools.py:find_pdf_links`, `storage/raw_store.py:save_raw_document` | Remove user-supplied URL from the public contract; allowlist + resolved-IP checks + size/redirect/timeout caps for any remaining fetch |
| S3 | **Critical** | Credential leakage | Firecrawl bearer token is sent to `moneycontrol.com` in a plain `requests.get`. Real secret to a third party. | `agents/sentiment_debater.py:140-146` | Remove that code; rotate `FIRECRAWL_API_KEY` (owner action) |
| S4 | High | SQL injection | `compare_companies` interpolates `metric` into SQL with an f-string. Currently called with the literal `"revenue"`, but the function signature accepts arbitrary values. | `agents/comparator.py` | Bound parameters |
| S5 | High | Path traversal | `company` (client-controlled) is used as a directory name: `os.path.join(RAW_DATA_DIR, company)`. `../` sequences escape `raw_data/`. | `storage/raw_store.py` | Slugify / hash-based paths, `resolve()` containment check |
| S6 | High | CORS | `allow_origins=["*"]` together with `allow_credentials=True`. | `main.py:25-31` | Explicit env-driven origin allowlist |
| S7 | High | Secrets in logs | `grok_client` logs the last 4 chars of the key at import; `print()` logs prompts' first 200 chars of responses and question text. | `agents/grok_client.py:263`, `main.py:396` | Structured logger with redaction; no prompt/response bodies |
| S8 | High | Secrets at rest | `backend/.env` holds live keys incl. a Supabase DB URL. `backend/.env.example` appears to be an exact structural copy: **it must be checked to confirm it contains placeholders only** (names were inspected; values not). Not a git repo, so the committed state is unknown. | – | Verify `.env.example`; owner to rotate any key that has ever been pasted/shared |
| S9 | High | Prompt injection | Retrieved document text and scraped pages are concatenated into prompts with no delimiting or instruction-hierarchy defence. | `rag/pipeline.py`, `qa_agent.py`, debaters | Delimited untrusted-context blocks, system-level rule, output validation, citation verification |
| S10 | High | Cross-user data | Chroma has no owner metadata; `where` filter not used; company filter applied after top-k. Single shared knowledge base. | `rag/retriever.py` | Add `owner_scope`/`doc_id` metadata, `where` filtering server-side; public-company docs vs user-private docs separated |
| S11 | Medium | Error disclosure | `str(e)` returned to clients in `error`/`answer` fields; HTTP 200 on failure. | `main.py` | Sanitized error envelope + correlation id; correct status codes |
| S12 | Medium | Resource exhaustion | Unbounded `companies[]`, `question`, `top_k`; sync scraping in the request path (single `run_in_executor(None, …)` shared pool); PDF downloads up to 60 s; 5-page parse. | models, `main.py` | Pydantic bounds, concurrency semaphores, timeouts, per-user rate limit |
| S13 | Medium | Unsafe fetch of PDFs | `requests.get(...).content` written to disk without content-type/size checks in `save_raw_document` (the transcript scraper has a 10 MB cap; this path does not). | `storage/raw_store.py` | Stream with cap, magic-byte check |
| S14 | Medium | Hash | `md5` used for filenames/ids (non-security use, but collision-prone ids). | `raw_store.py` | SHA-256 |
| S15 | Medium | XSS | Frontend renders LLM/news text via React text nodes (safe by default); no `dangerouslySetInnerHTML` found in app code (`ui/chart.tsx` shadcn style injection only). Citations are not rendered as links yet. | grep | Keep; sanitize/validate URLs before rendering `href` (http/https only) |
| S16 | Medium | Docs exposure | `/docs`, `/openapi.json` enabled in production. | FastAPI default | Disable or gate in production |
| S17 | Medium | Transport | Frontend base URL silently defaults to `http://localhost:8000`. | `services/api.ts` | Require env in prod build; fail loudly |
| S18 | Low | Dependency hygiene | `requirements.txt` is UTF-16, a full `pip freeze` (238 pins incl. torch, kubernetes, grpc, ~5.7 GB venv); unused packages (`openai`, `groq` used; `firecrawl-py`, `exa-py` not imported). Vulnerability scan not yet run. | requirements | Prune, convert to UTF-8, run `pip-audit` / `npm audit` |
| S19 | Low | Scraping terms | Screener.in HTML scraping with a spoofed browser User-Agent; Google SERP scraping (alt agent). Terms/permission not verified. | `scraper.py`, `alt_debater.py` | Respect robots/ToS; remove Google scraping; document Screener position |

## Remediation status (end of session 1)
S1 fixed (auth + CSRF on every route, tested) · S2 fixed by removal (no endpoint accepts a URL; legacy fetchers unreachable) · S3 fixed by removal, **key rotation is an owner action** ·
S4 fixed by removal (legacy comparator unreachable) · S5 fixed by removal (raw_store unreachable) · S6 fixed (env allowlist, tested) · S7 fixed (redaction, tested) ·
S8 checked: `.env.example` held placeholders only; new `.env.example` rewritten · S9 mitigated (untrusted `<source>` blocks, programmatic citation/figure checks; **not eliminated**) ·
S10 fixed for Copilot (owner/company filter in SQL, tested) · S11 fixed (sanitized 500, correct statuses) · S12 mostly fixed (bounds, budgets, ≤4 concurrent calls) · S13/S14 n/a after removal ·
S15 kept (React text nodes; links only for http/https) · S16 fixed (docs off in production) · S17 fixed (same-origin default) · S18 backend pinned lean deps, `pip-audit` clean for app packages;
**frontend `npm audit` still reports advisories (react-router, braces, postcss-selector-parser) needing breaking upgrades — open** · S19 Google scraping removed; Screener terms caveat open (docs/PROVIDERS.md).
Not done: dependency-level DAST, rate limiting at the edge, account lockout notifications, password reset, session listing/revocation UI, `Secure` cookie behaviour verified only by unit test (not over real HTTPS).

## Controls to be implemented (Stage B/F), with test requirements

1. Argon2id password hashing; session cookie `HttpOnly; Secure; SameSite=Lax` (same-origin through a Vercel rewrite to Render, so no third-party cookie dependency); CSRF token (double-submit) on state-changing requests; session expiry + rotation; login throttling.
2. Ownership checks in the data layer (every watchlist/report query includes `user_id`), plus DB FKs; tests for user A vs user B (read/update/delete/enumerate).
3. Input bounds on every request model; explicit status codes; sanitized error body.
4. Outbound fetch guard (scheme, allowlist, DNS-resolve-and-pin, private/loopback/link-local block, redirect revalidation, size/time caps).
5. Secret hygiene: log redaction, no secrets in responses; `.env.example` placeholders only.
6. Dependency audit commands recorded in the test report.

## Next actions that require the owner

- Confirm `backend/.env.example` contains no real values; rotate Firecrawl key (S3) and any key that may have been exposed.
- Check the Supabase database for fabricated seed rows (read-only; run yourself or approve me running it):
  `SELECT company_name, quarter, COUNT(*) FROM financials_quarterly WHERE quarter = 'Q3FY24' GROUP BY 1,2;`
  Rows for TCS / Infosys / Wipro / HCL with `Q3FY24` came from `scripts/seed_sample_data.py` (invented numbers) and must be removed.
- Initialise git (`git init`) so changes are reviewable — I did not do so unprompted.
