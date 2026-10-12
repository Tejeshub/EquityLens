# Browser E2E suite (Playwright)

Real Chromium -> real Vite frontend -> real FastAPI backend -> real Postgres. Only the third-party providers are faked.

## Prerequisites
- Postgres container `equitylens_dev_pg` on `127.0.0.1:55433` (user `postgres`, password `equitylens_dev`) with EMPTY databases `e2e_personal`, `e2e_public` and `e2e_public_news` (`docker exec equitylens_dev_pg psql -U postgres -c "create database e2e_public_news"`). Nothing else is touched; the scripts refuse non-local hosts and database names not starting with `e2e_`.
- Backend venv: `backend/.venv` (override with `E2E_PYTHON`). Node 20+ and `cd frontend && npm install`.
- `npx playwright install chromium` (once). If system libraries are missing: `sudo npx playwright install-deps chromium`.
- Free ports 8000-8002 (backends) and 8080-8082 (frontends). Override DB access with `E2E_PG_HOST|PORT|USER|PASSWORD` (host must stay local).

## Run
```
cd frontend
npm run e2e                                   # everything, dev-server mode (~1 min), reseeds all three DBs first
npm run e2e:prod                              # everything against the PRODUCTION BUILD (vite build + vite preview + vercel.json headers/CSP)
npm run e2e -- --project=personal-desktop     # one project (personal-desktop | personal-mobile | public-desktop | public-mobile | public-news-desktop | public-news-mobile)
npm run e2e -- e2e/research.spec.ts           # one spec
npm run e2e -- -g "CSRF"                      # by title
npm run e2e:headed                            # watch it
npm run e2e:report                            # open the HTML report (playwright-report/)
```
`playwright.config.ts` starts six servers (and `e2e/support/start-backend.sh` first runs `backend/scripts/seed_e2e.py --reset` for each DB, so every run starts from a clean, known database):

| stack | backend | database | policy | frontend (proxy via `VITE_DEV_PROXY_TARGET`) |
|---|---|---|---|---|
| personal | :8000 | e2e_personal | `DATA_PROFILE=personal` (all sources on, excerpts on) | :8080 |
| public | :8001 | e2e_public | `DATA_PROFILE=public` (production default: market data, fundamentals, segments AND news all off; research/Copilot refuse with 503 `source_disabled`) | :8081 |
| public-news-only | :8002 | e2e_public_news | `DATA_PROFILE=public ENABLE_NEWS=true` (headlines only, no excerpts; research is sentiment-only; Copilot over headlines) | :8082 |

Backend env: `ENVIRONMENT=test PROVIDER_MODE=fixture RESEARCH_JOBS_INLINE=false FIXTURE_LLM_DELAY_MS=700 COPILOT_PROVIDER=gemini REGISTER_*=1000 ALLOWED_ORIGINS=http://localhost:<frontend port>`; any `ENABLE_*` variable from the shell is unset so the profile default decides. Backend logs go to `frontend/e2e/.logs/`.

Projects: `personal-desktop` 1280x800 (all specs except public/public-news; includes `security.spec.ts`, which only runs in production-build mode), `personal-mobile` 390x844 Pixel 7 (auth, company, watchlists, research, copilot, quality), `public-desktop` / `public-mobile` (`public.spec.ts`: everything off), `public-news-desktop` / `public-news-mobile` (`public-news.spec.ts`).

### Production-build mode (`E2E_BUILD=1`, `npm run e2e:prod`)
`e2e:prod` runs `vite build`, then starts `vite preview` (instead of `vite` dev) for the three frontends. `vite.config.ts` has `preview.proxy` for `/api` and `/auth` (same as dev) and sets `preview.headers` from the `/(.*)` rule of `frontend/vercel.json` (single source of truth: HSTS, nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, Content-Security-Policy). Additionally:
- The guard fixture installs a `securitypolicyviolation` listener in every page (turned into a `console.error`, which fails the test unless allow-listed); Chrome's own CSP console errors are caught the same way. So every spec in every project doubles as a CSP check when run in this mode.
- `e2e/security.spec.ts` (production mode only, otherwise skipped): vercel.json defines the expected header set; document responses for `/`, `/login` and a deep link carry every header with exactly vercel.json's value; the built HTML has no inline script or event handler and assets carry nosniff + CSP; the browser really enforces the policy (a cross-origin `fetch` and an injected inline script are blocked, probes allow-listed).
- HSTS: browsers ignore `Strict-Transport-Security` over plain http (the suite runs on http://localhost), so it is not exercised as behaviour; the test only asserts the preview server sends it with vercel.json's value.
- Not covered: Vercel's own rewrites (`RENDER_BACKEND_URL` placeholder), and the `frame-ancestors` / `X-Frame-Options` behaviour (header presence only).

Debug loop without reseeding: start the six servers yourself (same commands as the config), then `E2E_REUSE_SERVERS=1 npx playwright test ...`. Traces/screenshots of failures are in `frontend/test-results/` (`npx playwright show-trace <trace.zip>`).

## Fake vs real
- Fake: Yahoo, Screener, Exa (news), Groq, Gemini (`backend/providers/fixtures.py`, deterministic synthetic data; SYNTHBETA = upstream 429 for quote and financials, SYNTHDELTA = 404 unsupported, question text `FAIL_PROVIDER` = upstream 500). Seeded companies: SYNTHALPHA, SYNTHBETA, SYNTHGAMMA, SYNTHDELTA.
- Real: browser, React app, Vite proxy, FastAPI, Postgres, Argon2 auth, sessions, CSRF + Origin checks, rate limiting, background research jobs and polling, policy (data-profile) gating, caching, document retrieval for Copilot.
- Test-only DB access: `pg` is used to age/expire a session row (idle/absolute expiry tests) and, in `public.spec.ts`, to prove a refused research/ask request created no `research_jobs` / `research_reports` rows.

## Conventions
- Disposable users: `e2e-<uuid>@example.com`, random password; nothing hard-coded. Setup without UI uses `page.request` (the auth spec drives register/login through the UI).
- `e2e/support/fixtures.ts`: an auto fixture fails any test on `pageerror`, `console.error`, HTTP 5xx or failed request (aborted requests excepted); `net` records requests; `allow` allow-lists provoked ones (`allow.httpStatus(503, /ask/)`). Chrome's "Failed to load resource" 4xx console lines are ignored (4xx are asserted explicitly where provoked). `guard.spec.ts` proves the guard fires (`test.fail()` tests show a red mark in the list reporter but count as passed).
- No `waitForTimeout`; only web-first assertions, response waits, and a route gate for the "loading" state.
- Screenshots land in `frontend/e2e/screenshots/` (`<name>-desktop|mobile.png`, `public-*` for the all-off stack, `public-news-*` for the news-only stack). They are rewritten on every run.

## Known open items (not failing the suite)
See the final report of the E2E task: axe "heading-order" (moderate), Google Fonts `@import` placed after `@tailwind` in `src/index.css` (ignored by browsers). Fixing the latter makes the app request fonts.googleapis.com, so the suite would then need to stub it.
