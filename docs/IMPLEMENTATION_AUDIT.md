# EquityLens — Implementation Audit

Audit date: 2026-10-12. Method: direct reading of the source tree, plus running the frontend baseline
(`tsc`, `vitest`, `eslint`, `vite build`). Backend baseline: see §9 (status recorded there).
Everything below is **verified against source** unless marked *(unverified)*. The supplied
`PROJECT_RECONSTRUCTION.md` was treated as a hypothesis, not as authority — corrections are in §10.

Repository facts
- Workspace root `…/Projects/EquityLens/EquityLens/` contains `backend/`, `frontend/`, and prior audit/PRD/TRD markdown.
- **Not a git repository** (no `.git` anywhere above the workspace). There is no history to diff against or roll back to. Recommendation: `git init` + initial commit before further changes (not done unprompted).
- Environment as found: `frontend/node_modules` absent, no backend virtualenv, no local app Postgres. "Environment setup already completed" was **not true on this machine** for dependencies. `backend/.env` exists with 12 variables set (names only inspected; values never printed).

## 1. Verified architecture

| Layer | Reality |
|---|---|
| Frontend | Vite + React 18 + TypeScript + shadcn/ui + Tailwind + TanStack Query + react-router. 4 routes. Only `/analyze` and `/ask` are called; everything else is rendered from `src/data/dummyData.ts`. |
| Backend | FastAPI (`backend/main.py`), 3 routes. Sync agent code run via `run_in_executor`. Logging is `print()`. |
| LLM | `agents/grok_client.py` is **Groq** (`groq` SDK, default model `llama-3.1-8b-instant`), *not* xAI Grok. The env var is named `GROK_API_KEY`. Returns `""` on any error (swallows failures). |
| Gemini | `google-generativeai` used only in `rag/pipeline.py` when `QA_MODEL=gemini` (it is, in `.env`), model `gemini-2.5-flash` hard-coded. `agents/qa_agent.py` configures Gemini but its Gemini branch is commented out; it calls Groq. |
| Relational DB | SQLAlchemy engine on `POSTGRES_URL`. **Points at a remote Supabase pooler**, not a local DB. Three tables defined in `storage/structured_store.py`: `financials_quarterly`, `raw_documents`, `guidance_entries`. Created by `scripts/init_db.py` (`metadata.create_all`); **no migrations**. Engine is created at import time → backend cannot even import without a valid `POSTGRES_URL`. |
| Vector DB | ChromaDB `PersistentClient` at `CHROMA_PERSIST_DIR` (`./chroma_data`), collection `equity_chunks`, embeddings via `sentence-transformers all-MiniLM-L6-v2` (pulls torch). |
| Providers | Screener.in (HTML scraping, `scraper.py`, `transcript_scraper.py`), Exa (`sentiment_debater.py`, raw `requests`), "Firecrawl" (see §5 — not actually used), discountingcashflows.com earnings API (`earnings_scraper.py`, basic auth; **not wired into any route**), LlamaCloud key (referenced in config, **unused**). |
| Auth | None. |
| Deployment | No `vercel.json`, `render.yaml`, Dockerfile, or Procfile. |

## 2. Feature status matrix

Legend: ✅ working · 🟡 partial · 🔴 broken · 🎭 mocked · 🔌 disconnected · ⬜ missing

| Feature | Status | Evidence |
|---|---|---|
| Company search (SearchBar) | 🎭 | Filters the 12-item hard-coded `companies` array. No backend endpoint exists. |
| Dashboard market movers (`Index.tsx`) | 🎭 | Sorts `companies` by hard-coded `changePercent`. |
| Company detail overview | 🎭 | Price, P/E, EPS, ROE, 52W, volume, beta, etc. from `dummyData`. Unknown `:id` silently falls back to `companies[0]` (shows the wrong company as real). |
| "Score pills" (8.2, 7.8, 6.5, 7) | 🎭 | Hard-coded literals in `CompanyOverview.tsx`. |
| Price chart | 🎭 | `candlestickData` generated mathematically in `dummyData.ts`; period buttons are inert; label says "60D" always. |
| News feed | 🎭 | `getCompanyNews()` returns fabricated headlines. |
| Financials table | 🎭 | `quarterlyData` hard-coded; not tied to selected company. |
| AI Report tab (`ReportSection`) | 🎭 | `reportSections` hard-coded, including "Confidence: 82%"; quarter dropdowns inert. |
| Management tracker | 🎭 | `managementGuidance` hard-coded. Backend `track_guidance` is called with `[]` (always returns nothing) and its output is never shown. |
| Watchlists CRUD | 🎭 | React `useState` seeded from `dummyData`. No backend, no persistence, no user scoping. |
| Watchlist analysis | 🎭 | `AgentAnimation` is a timed animation; `ComparisonTable` uses `dummyData`. Never calls `/analyze`. |
| `/analyze` (3 debaters + coordinator) | 🟡 | Runs end-to-end *when providers work*, but see §3–§4: wrong data lookups, fabricated alt-data, fake refinement, score = confidence. |
| Scorecard "Analysis Results" tab | 🟡 | Renders real response. Fires on **every page load** (useEffect on mount) → triggers scraping + 3 LLM calls + DB inserts per visit. |
| Reasoning panel | 🟡 | Renders `reasoning` messages from response; heavy `console.log`. |
| `/ask` RAG | 🟡 | Real Chroma retrieval + Gemini. Company filter applied *after* top-k (loses results), no `where` filter, no per-user scoping, error strings leaked to client, fallback path unscoped. |
| Copilot sidebar | 🟡 | Calls `/ask`. Shows `source` strings only (no links). Hard "Sorry…" on failure. |
| Peer comparison | 🔴 | `compare_companies` returns `{metric_name, ranking}`; `/analyze` reads `comparison["metric"]`/`["companies"]` → always empty. SQL built with f-string (injection). Compares against `MAX(quarter)` as a **string** over all companies. Only runs with ≥2 companies, which the UI never sends. |
| Ingestion (`run_ingestion`) | 🟡 | Runs only if `ir_page_url` given; the UI never sends it. Regex `Revenue … (crore|million|billion)` on first 5 pages, written as `Q3FY24` regardless of the document. Only 2000 chars/page embedded. |
| Screener financial scrape | 🟡 | Real HTML parse, but see §3 (identity/period mismatches, duplicate inserts on each call, units guessed). |
| Transcript/doc scraper | 🟡 | Real, has caching & size limits; not examined line-by-line *(unverified internals)*. |
| Earnings-call API scraper | 🔌 | `earnings_scraper.py` not imported by `main.py`. Credentials default to `user`/`pass`. |
| Auth / users | ⬜ | None. |
| Quotes / OHLCV / movers | ⬜ | No backend provider at all. |
| News | ⬜ | Exa is only used inside the sentiment agent; no news endpoint. |
| Company master / search index | ⬜ | None. |
| Deployment config | ⬜ | None. |
| `/health` | ✅ | Liveness only; no dependency checks. |

## 3. Data-integrity defects (backend)

1. **Fundamental debater can never find data.** It queries `verify_metric(company_name_as_displayed, "Q3FY24", "revenue"|"pat"|"roce"|"debt_equity")`. Screener ingestion stores `company_name = TICKER`, `quarter = column header text` (e.g. `Dec 2023`), `metric_name = Screener row label` (e.g. `Sales +`, `Net Profit +`). Those keys never coincide → all four metrics are `None` in production flows. The only way rows match is `scripts/seed_sample_data.py`, which inserts **invented** TCS/Infosys/Wipro/HCL numbers (e.g. TCS revenue 60000). *Action for owner: check whether those seed rows exist in the Supabase database (SQL in SECURITY_AUDIT.md §Next actions).*
2. **Hard-coded period** `Q3FY24` in fundamental debater, guidance tracker, ingestion agent.
3. **Duplicate rows:** `batch_insert_financial_metrics` is a plain INSERT with random UUID; `financials_quarterly` has no unique key → every `/analyze` call appends the same data again.
4. **Float for money** (`Column(Float)`), unit assigned by table type (`"Crore"`/`"%"`) rather than parsed; ratio table forced to `%`.
5. **Zero-confidence "success":** on empty LLM output or bad JSON, debaters return `{position: neutral, confidence: 0}` and the pipeline still reports `execution_status: "success"`.
6. **JSON extraction** (`extract_json_from_text`) uses non-greedy `{.*?}` → truncates nested JSON, then `json.loads` fails → silent neutral/0. No schema validation of LLM output.

## 4. Fake / inflated analysis behaviours (backend)

- `agents/coordinator.py:39-42` — *"Increase confidence artificially for demo"*: `confidence + 20`. Confirmed. No critique, no retrieval, no LLM call. In practice the only output that enters the loop is a failed agent (confidence `0`, because the threshold is 0.7 on a 0–100 scale); one pass turns a *failed* agent into confidence `20` — fabricated confidence for an agent that produced nothing.
- **Scale confusion:** debaters emit confidence 0–100; threshold default `0.7`. `confidence < 0.7` is only true for `0`.
- **Score = confidence:** `score = int(output["confidence"])`; the "dimension score" is the model's self-reported confidence, and `overall_score` is its average. Grade A–F is the same number bucketed. Not evidence-based.
- **Dimension mapping is arbitrary:** fundamental → "industry_position", sentiment → "valuation_outlook", alternative → "risk_assessment". Labels do not describe what the agent analysed.
- `agents/alt_debater.py` — job count = `15` if the word "hiring" appears anywhere in a **Google search HTML page** (`5` on exception, which also covers Google's 429/consent pages), web-traffic rank hard-coded `5000`, MCA risk hard-coded `"low"`, "promoter pledge" asked of the LLM with no data. All presented to the LLM as measurements. **Invented evidence.** Also scraping Google search results violates Google ToS.
- `agents/sentiment_debater.py` — Exa call uses `"type": "keyword"` and reads `r["text"]`, but does not request `contents`, so `text` is typically absent → empty news. The "Firecrawl" step is a plain `requests.get` to a **non-existent** `moneycontrol.com/company-article/{company}/transcript` URL with a Firecrawl bearer header sent to moneycontrol (credential leak to a third party). Firecrawl is not used anywhere.
- `track_guidance` receives `[]` ("simplified … for demo"); its regex is unreliable; result is never rendered.

## 5. Frontend defects

- 11 components/pages import `dummyData.ts` (full list in IMPLEMENTATION_PLAN §C).
- `CompanyDetail` posts `{name, screener_id: ticker}` using dummy tickers (PERSISTENT, MPHASIS, …) — real NSE symbols, but the `/analyze` payload is client-supplied and unvalidated.
- `useEffect(..., [company.id])` auto-runs `/analyze` (≈ minutes, many provider calls) on every visit and on every navigation back.
- No auth, no route guards, no API timeout/abort, base URL falls back to `http://localhost:8000`.
- Production `console.log` of full request/response and parsed source lineage.
- Lint: 6 errors / 10 warnings (baseline).
- Only test: `example.test.ts` (trivial).

## 6. Database entities

| Table | Defined in | Notes / gaps |
|---|---|---|
| `financials_quarterly` | `structured_store.py` | no unique/index, Float, string `quarter`, `source_document_id` doubles as URL, `created_at` naive local time |
| `raw_documents` | same | `id` string `company_source_hash` (md5), `file_path` local disk |
| `guidance_entries` | same | never written by any code path |
| Chroma `equity_chunks` | `semantic_store.py` | metadata `company` (name or ticker, inconsistent), `ticker`, `source`, `table_type`, `page`; no owner, no doc id, ids are random UUID (re-ingest duplicates) |

Missing for the product: users, sessions, companies, quotes/OHLCV cache, news cache, watchlists, watchlist_items, provider usage, saved reports.

## 7. External provider status

| Provider | Role | Verified how | Status |
|---|---|---|---|
| Groq (llama-3.1-8b-instant) | all agent + (non-Gemini) QA | code only | key present; **not call-tested** |
| Gemini | RAG answer | code only | key present; **not call-tested** |
| Exa | news search | code only | key present; request shape is questionable (§4); **not call-tested** |
| Firecrawl | claimed | code | **not used by any working code** |
| Screener.in | financials + doc links | code only | HTML scraping; terms of use not verified; **not call-tested** |
| LlamaCloud | none | code | **unused** |
| discountingcashflows | earnings transcripts | code | **disconnected**; defaults `user`/`pass` |
| Supabase Postgres | DB | env host only | **not connected** (deliberately — it is the owner's remote DB; no test or migration may target it) |

Quotas/limits for every provider are **unknown** from the repo; see `docs/PROVIDERS.md` (created during Stage B research) for sourced values.

## 8. Existing tests

`backend/tests/`: `test_rag_pipeline.py`, `test_rag_citation_parser.py`, `test_ask_response_schema.py`, `test_transcript_scraper.py`, `test_earnings_scraper.py` (unit-style), `test_api.py` and `test_api_8001.py` (**live-server scripts** hitting `localhost:8000/8001` with `requests`; use "Apple Inc."; not unit tests). Root: `test_refactoring.py`, `verify_scraper.py`. Note `backend/.gitignore` contains `test_*.py`, so the test suite would be **ignored by Git** if the repo were initialised as-is.

Frontend: one trivial vitest test.

## 9. Baseline results

| Check | Result |
|---|---|
| `tsc -p tsconfig.app.json --noEmit` | pass |
| `vitest run` | pass (1 trivial test) |
| `eslint .` | **fail**: 6 errors, 10 warnings (pre-existing) |
| `vite build` | pass (806 kB main chunk, warning only) |
| backend `pytest` | recorded in `docs/BASELINE.md` once the venv install finishes |

## 10. Corrections to the supplied reconstruction

| Reconstruction claim | Verified reality |
|---|---|
| "Fundamental and Sentiment debaters are fully functional, using real Postgres data, Exa and Firecrawl" | Fundamental queries keys that cannot match scraper output; Sentiment's Exa request likely returns no text and its "Firecrawl" step is a fake call to a nonexistent URL. Neither is "fully functional". |
| "Grok" | The client is Groq with a Llama 8B model. |
| "Only alt_debater is mocked" | Also coordinator refinement, scores, guidance tracker, peer comparison wiring. |
| Screener/Exa/Firecrawl/Grok/Gemini all "integrations involving…" | Firecrawl unused; LlamaCloud unused; Grok is Groq. |
| ChromaDB retrieval works | Works mechanically; company scoping is post-hoc and incorrect. |

## 11. Post-implementation status (end of session 1)

The findings above describe the repository **as found**. Since then: the unauthenticated `/analyze` & `/ask`, the mock dashboard, the fake refinement,
the invented alternative data and the seed script were removed or replaced (see IMPLEMENTATION_PLAN.md progress table, API_INVENTORY.md, SECURITY_AUDIT.md
remediation status). Newly verified facts discovered during the work: (a) the legacy Groq default model `llama-3.1-8b-instant` returns 404 today, so the old
debaters were returning empty output (neutral/0) in practice; (b) Screener's terms permit personal non-commercial viewing only; (c) Yahoo chart data is unofficial.
Backend baseline before changes: 3 legacy tests failing (`test_transcript_scraper` chunking, pre-existing, unrelated) — those legacy tests now live in
`backend/tests/legacy/` (need the full legacy requirements) and were re-run in the full venv after the move: 28 pass, the same 3 fail. Current: `pytest` 91 passed (lean pinned venv, clean install).

## 12. Phase 2 status (supersedes §11 where they differ)
Corrections to earlier statements: the project **is** a git repository (Phase 1 ran `git status` from the wrong directory); the Supabase database is **empty** (so `alembic stamp 0001` was never the right instruction for it);
the "captured" Screener/Yahoo/Exa/NSE test fixtures were replaced by synthetic ones. Feature status now: company search, news (headlines), AI research (background jobs), Copilot (FTS, Groq default), watchlists, auth — **working and
browser-verified (fixtures)**; prices/financials/shareholding/compare/sector-segment — **implemented but disabled by policy in the public profile** (terms do not permit public display), enabled in the personal profile.
Disposition of legacy ingestion (PDF/transcript/Chroma): intentionally deferred, unreachable; modules kept under `backend/` for reference; defects found there were fixed and its tests pass (31/31); reviving it needs an SSRF guard, a
Postgres FTS/pgvector store and routing through `providers/*` (see PHASE_2_PROGRESS.md). Full evidence: `docs/PHASE_2_PROGRESS.md`.
