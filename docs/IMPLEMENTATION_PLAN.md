# EquityLens — Implementation Plan & Progress

Companion to `IMPLEMENTATION_AUDIT.md`. Updated as work lands; the **Progress** table is the source of truth
for what is done. "Done" means implemented **and** verified at the level stated.

## Engineering decisions (documented, conservative)

| Decision | Choice | Why |
|---|---|---|
| Market data | Yahoo chart endpoint (user-approved 2026-10-12), labelled *delayed / unofficial*, behind a provider interface so it is swappable | Only free source with NSE/BSE OHLCV; ToS risk disclosed in README/PROVIDERS |
| Company master | Public NSE equity list (`EQUITY_L.csv`) + BSE scrip list loaded by an explicit import script into a `companies` table; unsupported symbols excluded | Real records, no hand-typed companies. Exact sources/terms to be confirmed when the import is built |
| Fundamentals | Keep Screener.in scrape, fix identity/period/unit/dedupe, add provenance; `quarter` → ISO period end date | Existing working capability; ToS caveat documented |
| News | Exa with `contents` requested, bounded, cached; reuse existing key | Existing integration; quota treated as **unknown** → conservative per-user + global caps |
| LLM | Keep Groq (+Gemini for RAG) behind one client with timeout/retry/JSON-schema validation | Preserve working integrations; no paid fallback |
| Auth | Local accounts: Argon2id, server-side sessions in Postgres, HttpOnly cookie, CSRF double-submit, same-origin via Vercel rewrite → Render | Avoids paid IdP and cross-site cookie pitfalls |
| Relational DB | Alembic migrations; **tests and dev use a disposable local Postgres container created for this project**; the remote Supabase DB is never touched without explicit approval | Safety |
| Vector store | Keep Chroma; add `where` filters + doc ids; persistence on Render requires a disk (paid) → document options (Render disk vs. pgvector), do not assume | Deployment honesty |
| Embeddings | Torch/sentence-transformers makes a ~5.7 GB venv and will not fit free Render. Evaluate Chroma's ONNX MiniLM default (same model, no torch) | Deployability |
| Process | Research is an explicit user action (button), never page-load | API budget |

## Stages & dependencies

```
A Audit ──► B Foundations ──► C Real-data dashboard ──► F Integration/hardening ──► G Verify ──► H Deploy-ready
              │                  │  (needs B: db, auth, provider layer, company index)
              ├─► D AI research ─┘  (needs B provider layer; independent of C UI)
              └─► E Watchlists      (needs B auth + db, C quotes for snapshots)
```

### Stage B — Foundations
B1 backend packaging: UTF-8 pruned requirements, `settings` module (no import-time side effects, no secret logging), structured logging w/ redaction, lazy engine, `/health` + `/ready`.
B2 Alembic baseline matching existing tables (non-destructive) + new tables: `users`, `sessions`, `companies`, `watchlists`, `watchlist_items`, `research_reports`, `provider_usage`, `quotes_cache`/`news_cache` (if justified). Numeric for money; UTC timestamps; unique constraints.
B3 Auth module + dependencies + CSRF + throttling.
B4 Provider control layer: per-provider limiter, timeout, jittered retry honoring `Retry-After`, circuit breaker, single-flight, TTL cache (in-process now; Postgres-backed shared cache for multi-instance quota counters).
B5 Company index + `GET /companies/search`.
B6 Typed frontend API client (timeouts, abort, 401 handling, env base URL), auth pages, route guards, query client defaults.

### Stage C — Real-data dashboard
Quote + history services/endpoints; movers computed only from fresh timestamp-compatible quotes from a bounded universe; news endpoint; financials endpoint with provenance; replace each `dummyData` consumer (list in §C-table); delete `dummyData.ts` from production bundle (keep fixtures only under `src/test/`).

### Stage D — AI research
D1 replace alt debater with real evidence collectors (see below) and honest "unavailable" signals; D2 strict-schema debaters, partial-failure aware; D3 coordinator: remove confidence inflation; real critique-and-revise (max 1–2 rounds, bounded, optional); confidence from explicit criteria (coverage, agreement, data freshness); D4 fix peer comparison; D5 RAG scope/filter, untrusted-context handling, "not document-grounded" labelling, citation verification; D6 ingestion hardening (SSRF guard, provenance, validated extraction, idempotent chunk ids).

Alt-data evidence candidates (only if a compliant free source is confirmed): Screener shareholding/promoter-pledge (already scraped), BSE/NSE corporate announcements (public), Exa-found careers/press pages with explicit URLs. Hiring counts, web-traffic rank and MCA signals are **unavailable** unless a compliant source is found; the agent says so.

### Stage E — Watchlists
CRUD + items + snapshot + compare endpoints, owner-scoped; UI wired; max-items bound; unique(watchlist_id, company_id).

### Stage F/G/H
Contract tests, security tests (cross-user, SSRF, injection, CSRF), frontend tests (vitest + Testing Library), Playwright E2E, `vercel.json`, `render.yaml`, `docs/DEPLOYMENT.md`, `.env.example`, README.

## §C — `dummyData` consumers to replace

`SearchBar`, `Index`, `CompanyDetail`, `CompanyOverview`, `CandlestickChart`, `NewsFeed`, `FinancialTable`, `ReportSection`, `ManagementTracker`, `ComparisonTable`, `WatchlistsPage`, `WatchlistAnalysis`.

## Progress (updated end of session 1)

Evidence levels: **I** implemented · **T** automated tests pass · **L** exercised against the live provider (manually) · **D** deployment-verified.

| Item | I | T | L | D | Notes |
|---|---|---|---|---|---|
| Audit docs | ✅ | n/a | n/a | n/a | |
| Config/settings, redacted logging, lazy DB, health/ready | ✅ | ✅ | n/a | ⬜ | |
| Alembic 0001–0005 (up/down/up on fresh DB; `alembic check` clean) | ✅ | ✅ | n/a | ⬜ | existing-DB path is `stamp 0001` — **not rehearsed on a copy of the real DB** |
| Auth (Argon2id, sessions, CSRF, throttling) | ✅ | ✅ | n/a | ⬜ | no email verification / reset |
| Provider control layer | ✅ | ✅ | partly | ⬜ | circuit/cache are process-local; budgets are Postgres-shared |
| Company master + search | ✅ | ✅ | ✅ NSE lists | ⬜ | NSE only |
| Quotes / history / movers | ✅ | ✅ (fixtures) | ✅ Yahoo | ⬜ | unofficial source |
| News | ✅ | ✅ (fixture) | ✅ Exa (2 calls) | ⬜ | |
| Financials + shareholding | ✅ | ✅ (captured page) | ✅ Screener | ⬜ | ToS caveat |
| Research (rubric, narratives, bounded critique) | ✅ | ✅ (fake LLM) | ✅ Groq, one company | ⬜ | critique step hit TPM quota once live and degraded as designed |
| Copilot (Postgres FTS) | ✅ | ✅ (fake LLM) | ⬜ Gemini answer path not run end-to-end | ⬜ | Gemini key verified with a trivial call only |
| Watchlists + compare | ✅ | ✅ | partly (frontend smoke) | ⬜ | |
| Frontend wiring, no mock data | ✅ | ✅ 70 tests | curl smoke only | ⬜ | no browser run |
| Browser E2E (Playwright) | ⬜ | ⬜ | ⬜ | ⬜ | **next task** |
| Vercel/Render config | ✅ files | ⬜ | ⬜ | ⬜ | placeholders to fill |
| PDF filing/transcript ingestion, BSE listings, alt-data sources | ⬜ | | | | not started / no compliant source |

**Next exact tasks:** (1) Playwright journey against a running stack; (2) rehearse `alembic stamp 0001` + upgrade on a copy of the real DB; (3) live Copilot answer check; (4) deploy and verify the Vercel→Render rewrite incl. research request duration; (5) decide Screener/Yahoo terms; (6) react-router major upgrade for `npm audit`.


## Phase 2 outcome and next tasks
Done: audits (provider terms, API inventory, contract, reliability, security, frontend), credential-incident review, data-source policy layer, auth hardening, reliability fixes, async research jobs, frontend capability states and a11y
fixes, dependency upgrades, Playwright E2E, migration rehearsals, deployment docs. **Owner decisions/actions outstanding:** (1) licensed price source and fundamentals source (or written permissions); (2) NSE/Exa written confirmations;
(3) rotate Firecrawl key (+ precautionary rotations); (4) approve and run the Supabase migration yourself (DEPLOYMENT.md §3); (5) set `RENDER_BACKEND_URL`, `ALLOWED_ORIGINS`, deploy; (6) decide Gemini billing; (7) approve squashing the local
history that still contains the earlier captured fixtures before any push. **Engineering next:** post-deploy verification (client-IP chain, cookies/CSP over HTTPS, proxy timeouts), E2E against a production build and in Firefox/WebKit,
research-job failure-state specs, heading-order a11y nit, tailwind 4 migration (clears the remaining audit items), email verification / password reset, BSE coverage.
