# TECHNICAL REQUIREMENTS DOCUMENT — EquityLens

**Status**: Technical source of truth for completing the existing EquityLens application.
**Primary inputs**: `PRD.md`, `PRD_VALIDATION.md`, `PROJECT_RECONSTRUCTION.md` (which itself derives from `PROJECT_AUDIT.md` and `PROJECT_AUDIT_DEEP_DIVE.md`).
**Scope of this document**: Technical design only. No code, migrations, or tickets are produced here.

Component-status legend used throughout:
- **EXISTING** — already implemented and functional
- **PARTIAL** — partially implemented
- **MOCKED** — exists but uses mock/static behavior
- **BROKEN** — exists but has a known technical problem
- **EXTEND** — existing component needs additional functionality
- **MODIFY** — existing implementation must change
- **NEW** — does not currently exist
- **REMOVE/REPLACE** — existing implementation should be replaced
- **TBD** — depends on an unresolved product/technical decision

Per `PRD_VALIDATION.md` §21–22, the PRD is classified **READY FOR TRD**, with two minor additions the validation recommended: (1) treat `GET /health` as operational infrastructure (§30), and (2) add a technical requirement to robustify the Sentiment Debater's transcript-URL discovery (§14). Both are incorporated below. No contradictions between PRD and repository were found in validation, and this TRD does not introduce any.

---

## 1. TECHNICAL EXECUTIVE SUMMARY

**Current technical architecture**: A React/Vite/TypeScript frontend calling a FastAPI backend over two functional endpoints (`POST /analyze`, `POST /ask`), backed by PostgreSQL (structured financial data) and ChromaDB (semantic document chunks). The AI layer consists of three parallel "debater" agents (fundamental, sentiment, alternative) and a coordinator, plus a RAG pipeline for Q&A. Everything outside this AI core — company listing/search, market data, news, watchlists — is served from a static frontend file (`dummyData.ts`) with no backend counterpart. *(EXISTING per `PRD_VALIDATION.md` §1, §4, §6)*

**Target technical architecture**: The same AI core, preserved essentially as-is except for two required fixes (coordinator confidence integrity, Copilot fallback labeling), plus a new, minimal, real company-data backend (search + identity) to replace `dummyData.ts` for the company-discovery flow. Market data, news, watchlists, alternative-data integration, and authentication remain **TBD** pending the Section 28 product decisions in `PRD.md`, and are designed here only to the extent needed to avoid architectural dead-ends if/when they are approved.

**Major existing components preserved**: `/analyze` pipeline, `/ask` RAG pipeline, ingestion agent, PostgreSQL structured store, ChromaDB semantic store, Fundamental and Sentiment debaters.

**Major missing components**: Real company master data + search API, coordinator confidence-integrity fix, Copilot fallback UI, explicit error/empty-state handling in `useAnalyze`/`CompanyDetail.tsx`.

**Largest technical gaps**: (1) No backend exists for company identity/search — the single most important gap because it blocks the entire discovery journey (`PRD.md` §7, §14; `PRD_VALIDATION.md` §18). (2) The coordinator's confidence "refinement" is fabricated, which is a trust-integrity defect, not just a missing feature (`PRD.md` §10; `PRD_VALIDATION.md` §7, §12). (3) No persistence layer exists for any of watchlists/market data/news, all of which remain gated behind product decisions.

**Key technical decisions required before further build-out**: authentication approach (only if watchlists are selected), market-data vendor, news vendor, alternative-data vendor, deployment platform — all deferred per `PRD.md` §28 and preserved as TBD here (§39).

---

## 2. CURRENT SYSTEM ARCHITECTURE

```text
Frontend (React/Vite/TS)
   ↓ fetch() via src/services/api.ts
API Layer (FastAPI — backend/main.py)
   ↓
Backend Services (backend/agents/, backend/rag/, backend/scraper.py, backend/transcript_scraper.py)
   ↓
AI / RAG / Data Layer (Agno-based agents calling Grok/Gemini; SentenceTransformers embeddings)
   ↓
PostgreSQL (SQLAlchemy, backend/storage/structured_store.py) / ChromaDB (backend/storage/semantic_store.py) / External Services (Screener.in, Exa, Firecrawl)
```

| Component | Responsibility | Technology | Location | Status |
|---|---|---|---|---|
| Frontend app shell | Routing, pages, layout | React 18, Vite, React Router | `frontend/src/App.tsx`, `frontend/src/pages/` | EXISTING |
| API client | Talks to backend | `fetch` wrapper | `frontend/src/services/api.ts` | EXISTING |
| Mock data source | Supplies company/news/market/watchlist data | Static TS module | `frontend/src/data/dummyData.ts` | MOCKED |
| `useAnalyze` hook | Triggers `/analyze`, manages query state | React Query | `frontend/src/hooks/useAnalyze.ts` | EXISTING |
| Copilot UI | Chat interface for `/ask` | React component | `frontend/src/components/CopilotSidebar.tsx` | EXISTING (fallback labeling PARTIAL) |
| FastAPI entrypoint | Route registration, app config | FastAPI | `backend/main.py` | EXISTING |
| Fundamental Debater | Financial-metric-based analysis | Agno agent + Grok | `backend/agents/fundamental_debater.py` | EXISTING |
| Sentiment Debater | News/transcript-based analysis | Agno agent + Grok, Exa, Firecrawl | `backend/agents/sentiment_debater.py` | EXISTING (transcript URL fragile) |
| Alternative Debater | Alt-data-based analysis | Agno agent + Grok | `backend/agents/alt_debater.py` | MOCKED |
| Coordinator | Synthesizes debater outputs | Python logic + LLM | `backend/agents/coordinator.py` | PARTIAL (confidence bump is fabricated) |
| Ingestion Agent | Discovers/downloads/parses/embeds IR PDFs | PdfReader, regex, ChromaDB | `backend/agents/ingestion_agent.py` | EXISTING (regex extraction is demo-quality) |
| RAG pipeline | Retrieval + generation for `/ask` | ChromaDB, SentenceTransformers, Gemini/Grok | `backend/rag/pipeline.py` | EXISTING |
| Structured store | Financial data persistence | SQLAlchemy/PostgreSQL | `backend/storage/structured_store.py` | EXISTING |
| Semantic store | Vector chunk persistence | ChromaDB | `backend/storage/semantic_store.py` | EXISTING |
| Scrapers | Pull financials/transcripts | BeautifulSoup4/Trafilatura, Firecrawl | `backend/scraper.py`, `backend/transcript_scraper.py` | EXISTING |
| Health check | Operational check | FastAPI route | `backend/main.py` (`GET /health`) | EXISTING, unused by frontend |

*(Source: `PRD_VALIDATION.md` §1, §4, §6, §11; `PROJECT_RECONSTRUCTION.md` §9)*

---

## 3. TARGET SYSTEM ARCHITECTURE

```text
CURRENT
   Frontend (mock-data-driven for discovery/market/news/watchlists)
   Backend (AI-only: /analyze, /ask, /health)
   ↓
Required Changes
   + New Company backend (model, search API)
   + Coordinator confidence-integrity fix (remove fabricated bump)
   + Copilot fallback UI treatment
   + Explicit error/empty-state handling
   [TBD, gated by product decision] Market data backend
   [TBD, gated by product decision] News backend
   [TBD, gated by product decision] Watchlist backend + auth
   [TBD, gated by product decision] Alternative-data real integration
   ↓
TARGET
   Frontend (company discovery backed by real API; AI features unchanged; other surfaces
             either built out per decision or removed/clearly marked non-functional)
   Backend (AI core preserved + Company API; other APIs added only if selected)
```

**Preserve as-is**: `/analyze` orchestration structure, Fundamental Debater, Sentiment Debater's data sources (Exa, Firecrawl — URL construction hardened, not replaced), ingestion pipeline, RAG pipeline, PostgreSQL/ChromaDB storage layers.

**Extend**: `main.py` (new Company router), `CopilotSidebar.tsx` (fallback UI), `useAnalyze.ts`/`CompanyDetail.tsx` (error/empty states), `sentiment_debater.py` (transcript discovery robustness).

**Modify**: `coordinator.py` (remove the artificial `+20` confidence bump).

**New**: Company data model + `companies` table + `/companies/search` (and related) endpoints; frontend Company API client calls replacing `dummyData.ts` reads for discovery.

**Replace only if selected**: `alt_debater.py`'s hardcoded values (replace with real vendor calls, or remove the dimension — per `PRD.md` §33 Decision 4).

---

## 4. ARCHITECTURE PRINCIPLES

1. **Preserve the working AI analysis and RAG pipelines** — `/analyze` and `/ask` are the product's only confirmed-functional core and must not be redesigned; changes to them are additive (error handling, confidence-integrity) not structural.
2. **Keep product modules cohesive** — new Company functionality is added as its own router/service rather than folded into `main.py`'s existing AI-analysis logic.
3. **Prefer modular FastAPI routers** over a monolithic `main.py` as new endpoints are added, consistent with the existing pattern of separating agents/services into their own modules.
4. **Maintain clear frontend/backend contracts** — new API responses must match (or cleanly extend) existing Pydantic model conventions already used for `EquityResearchResponse`/`AskResponse`.
5. **Keep AI-generated results traceable to evidence** — no new or modified component may present a score/confidence/answer without a retained mechanism for showing its supporting evidence (already true of `/analyze`/`/ask`; must remain true after changes).
6. **Avoid unnecessary infrastructure** — no message queues, no Kubernetes, no Redis, no GraphQL are introduced; the existing synchronous FastAPI + PostgreSQL + ChromaDB stack is sufficient for the defined MVP scope (see §28, §29).
7. **Separate mock/demo data from production data** — `dummyData.ts` must not silently continue to back any feature once that feature has a real backend; partial migrations that leave mock and real data intermixed are treated as technical debt (§37).
8. **Use typed API contracts** — new endpoints follow the existing Pydantic-schema-first pattern already used in `backend/models.py`.
9. **Make external integrations replaceable** — any newly-added external dependency (company data, market data, news, alternative data) must sit behind a narrow backend interface so the vendor can change without frontend impact, consistent with how Grok/Gemini are already abstracted behind agent calls.

---

## 5. FRONTEND TECHNICAL ARCHITECTURE

### Current structure
- **Routing**: `App.tsx`, React Router — `/`, `/company/:id`, `/watchlists`, `/watchlist/:id/analysis`, catch-all 404. All public, no protected routes. *(EXISTING)*
- **Pages**: `Index.tsx` (landing, mocked movers/list), `CompanyDetail.tsx` (mixed: real AI data + mocked identity/price/news), `WatchlistsPage.tsx` / `WatchlistAnalysis.tsx` (fully mocked).
- **Components**: `Navbar.tsx`, `CopilotSidebar.tsx`, `ReasoningPanel.tsx`, `CompanyOverview.tsx`, `CandlestickChart.tsx`, `NewsFeed.tsx`, `FinancialTable.tsx`, `ManagementTracker.tsx`, `ReportSection.tsx`, plus the Shadcn UI primitive library.
- **Hooks**: `useAnalyze.ts` (React Query wrapper around `/analyze`); an analogous hook exists for `/ask` (referred to as `useAsk` in `PRD_VALIDATION.md` §11).
- **State management**: React Query for server state (AI responses); local `useState` for UI state and — currently — for all watchlist data (this is the technical root cause of watchlists' non-persistence).
- **API layer**: `frontend/src/services/api.ts`, a typed `fetch` wrapper targeting `VITE_API_URL` (default `http://localhost:8000`); currently only wraps `/analyze` and `/ask`.
- **Data flow**: AI-derived data flows through React Query from the backend; everything else flows from the static `dummyData.ts` import, not from any network call.
- **Styling**: Tailwind CSS + Shadcn UI (Radix primitives).
- **Error/loading handling**: Present for the AI query hooks via React Query's built-in states, but not confirmed to have dedicated, user-legible error/empty UI (`PRD_VALIDATION.md` FR-012/FR-013 gap).

### Required changes

| Frontend Area | Current | Target | Change Type |
|---|---|---|---|
| Company discovery (`SearchBar.tsx`, `Index.tsx`) | Reads `dummyData.ts` | Calls new `/companies/search` (or similar) API via `api.ts` | MODIFY |
| Company identity display | Reads `dummyData.ts` | Calls new Company API for minimal identity (name, ticker, sector) | MODIFY |
| `CopilotSidebar.tsx` | No visible distinction for `fallback_used` | Distinct visual treatment when `fallback_used === true` | EXTEND |
| `useAnalyze.ts` / `CompanyDetail.tsx` | Implicit/undocumented error handling | Explicit error state UI on analysis failure; explicit low-evidence state per dimension | EXTEND |
| `api.ts` | Wraps `/analyze`, `/ask` only | Add typed client methods for Company API (and Market Data/News/Watchlist APIs only if those product decisions are approved) | EXTEND |
| `CandlestickChart.tsx`, `NewsFeed.tsx` | Read `dummyData.ts` | TBD — either wired to real APIs (if Market Data/News decisions approved) or explicitly marked non-functional/removed from MVP surface | TBD |
| `WatchlistsPage.tsx`, `WatchlistAnalysis.tsx` | Local `useState`, `dummyData.ts` seed | TBD — either wired to new Watchlist API + auth, or explicitly marked non-functional/removed from MVP surface | TBD |

Per Architecture Principle 7, any of the TBD rows above that are **not** approved for the current build cycle should have their current mock-data behavior clearly and visibly marked (e.g., a "demo data" badge) rather than silently left presenting fake data as real — this is a UX/technical requirement independent of whether the underlying feature is ultimately built.

---

## 6. BACKEND TECHNICAL ARCHITECTURE

### Current structure
- **Entry point**: `backend/main.py` — registers `/analyze`, `/ask`, `/health`, and orchestrates the analysis pipeline directly (per `PRD_VALIDATION.md` §6, there are no separate "routers" yet — route handlers and orchestration logic currently live together in `main.py`).
- **Services/agents**: `backend/agents/` — `fundamental_debater.py`, `sentiment_debater.py`, `alt_debater.py`, `coordinator.py`, `ingestion_agent.py`, `qa_agent.py` (fallback QA).
- **RAG**: `backend/rag/pipeline.py` — retrieval + generation logic for `/ask`.
- **Storage**: `backend/storage/structured_store.py` (PostgreSQL/SQLAlchemy), `backend/storage/semantic_store.py` (ChromaDB).
- **Scraping**: `backend/scraper.py` (Screener.in), `backend/transcript_scraper.py`.
- **Schemas**: `backend/models.py` — Pydantic request/response models (`CompanyInput`, `EquityResearchRequest/Response`, `AgentMessage`, `ScoreDimension`, `Scorecard`, `GuidanceEntry`, `PeerComparison`, `AskRequest/Response`, `AskCitation`, `RetrievedChunk`).
- **Configuration**: `backend/config.py`, `.env`-based (API keys, DB URL, Chroma path, per-agent model selection).
- **Tools**: `backend/tools/` — chroma, download, parser, verification helpers.

### Target changes
- Introduce a **Company module** (`backend/agents/` is not the right home for this — it is not an AI agent; place alongside storage/services, e.g., `backend/company/` or a `companies` router + service + model, consistent with Architecture Principle 2) providing: a `Company` persistence model, a search/lookup service, and a router exposing it under `main.py`'s app.
- **Modify** `coordinator.py` to remove the fabricated `min(current_conf + 20, 100)` confidence bump (see §16).
- **Extend** `sentiment_debater.py`'s transcript-discovery logic to reduce reliance on a "generalized guess" URL (see §14) — the existing Exa/Firecrawl integration points are preserved; only the URL-construction step changes.
- **Extend** `main.py` (or, preferably, refactor into routers as new endpoints are added) to register the new Company endpoints alongside the existing ones.
- Preferably, as the Company router is added, begin splitting `main.py`'s route registrations into per-domain routers (`analysis_router`, `copilot_router`, `company_router`) — this is a structural improvement enabled by, not required by, the new Company work, and should not block delivery if deprioritized.
- **No changes** to `fundamental_debater.py`'s core logic, `ingestion_agent.py`'s core logic, or the RAG pipeline's core logic are required by the validated PRD.

---

## 7. API ARCHITECTURE

### Existing APIs

| Method | Path | Purpose | Request | Response | Validation | Errors | Frontend Consumer | Status |
|---|---|---|---|---|---|---|---|---|
| POST | `/analyze` | Run multi-agent company research | `EquityResearchRequest` (`companies`, optional `quarters`, `debate_refinement_threshold`) | `EquityResearchResponse` (`scorecards`, `guidance_tracker`, `peer_comparisons`, `execution_status`) | Pydantic model validation | Not fully documented in source evidence — treated as a gap (§25) | `useAnalyze.ts` | EXISTING |
| POST | `/ask` | RAG-grounded Q&A, with fallback | `AskRequest` (`question`, `company`, `top_k`) | `AskResponse` (`answer`, `citations`, `retrieved_chunks`, `fallback_used`) | Pydantic model validation | Fallback triggers internally on zero-chunk retrieval; explicit HTTP error behavior not fully documented — gap (§25) | `CopilotSidebar.tsx` (via `useAsk`) | EXISTING |
| GET | `/health` | Operational health check | None | `{"status": "ok"}` | N/A | N/A | None (unused) | EXISTING — treated as operational infrastructure per `PRD_VALIDATION.md` §18, not product functionality; retained as-is |

### Required new APIs

Only the Company API is required unconditionally by the validated MVP (`PRD.md` §7, §14; `PRD_VALIDATION.md` §18). The remaining candidate APIs are gated by open product decisions and are specified only at the level needed to avoid foreclosing future options.

| Capability | Endpoint (proposed) | Required for MVP? | Gating decision |
|---|---|---|---|
| Company search | `GET /companies/search?q=` | Yes | None — required by MVP |
| Company lookup by id/ticker | `GET /companies/{id}` | Yes | None — required by MVP |
| Market data (price/candlestick) | `GET /companies/{id}/market-data` | No | `PRD.md` §33 Decision 3 |
| News feed | `GET /companies/{id}/news` | No | `PRD.md` §33 Decision 6 |
| Watchlist CRUD | `POST/GET/DELETE /watchlists`, `POST/DELETE /watchlists/{id}/companies/{companyId}` | No | `PRD.md` §33 Decision 5 (and, transitively, Decisions 1–2 on auth) |
| Watchlist analysis | `POST /watchlists/{id}/analyze` | No | Same as above; would likely reuse `/analyze` internally rather than duplicate agent logic |
| Auth (register/login/logout) | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` | No | `PRD.md` §33 Decisions 1–2 |

No APIs are proposed for capabilities not required by the validated PRD (e.g., no admin endpoints, no analytics endpoints), consistent with Architecture Principle 6 and the instruction not to introduce unnecessary surface area.

---

## 8. API CONTRACTS

### `GET /companies/search` (NEW)
```text
Endpoint: /companies/search
Method: GET
Authentication: None (matches current no-auth baseline)
Request: query param `q` (string, min length 1)
Validation: `q` required; reject empty/whitespace-only queries with 422
Business Logic: Case-insensitive match against company name and ticker in the Company store; return ranked/matched results
Response: 200 — list of { id, name, ticker, sector } (minimal identity, matching PRD §14 "company master data" scope)
Errors: 422 on invalid query; 500 on backend/store failure
Status Codes: 200, 422, 500
```

### `GET /companies/{id}` (NEW)
```text
Endpoint: /companies/{id}
Method: GET
Authentication: None
Request: path param `id`
Validation: `id` must exist in the Company store
Business Logic: Fetch stored identity record
Response: 200 — { id, name, ticker, sector } (extendable later; no fields invented beyond what the PRD's minimal-identity scope requires)
Errors: 404 if company not found; 500 on store failure
Status Codes: 200, 404, 500
```

### `POST /analyze` (EXISTING — contract preserved, documented for completeness)
```text
Endpoint: /analyze
Method: POST
Authentication: None
Request: EquityResearchRequest { companies: CompanyInput[], quarters?: int, debate_refinement_threshold?: float }
Validation: Pydantic model validation on request body
Business Logic: Scrape financials → ingest IR PDFs → run Fundamental/Sentiment/(Alternative) debaters in parallel → coordinator synthesis → scorecard transform
Response: EquityResearchResponse { scorecards: Scorecard[], guidance_tracker, peer_comparisons, execution_status }
Errors: Not fully specified in source evidence (see §25 for the target error-handling requirement layered on top of this existing contract)
Status Codes: 200 (success path confirmed); error status codes NOT confirmed in evidence — flagged as a gap, not invented here
```

### `POST /ask` (EXISTING — contract preserved, documented for completeness)
```text
Endpoint: /ask
Method: POST
Authentication: None
Request: AskRequest { question: str, company: str, top_k?: int }
Validation: Pydantic model validation
Business Logic: Retrieve chunks from ChromaDB → if chunks found, generate grounded answer via Gemini with citations → if zero chunks, fall back to Grok-based `answer_with_citations` and set `fallback_used=true`
Response: AskResponse { answer: str, citations: AskCitation[], retrieved_chunks: RetrievedChunk[], fallback_used: bool }
Errors: Not fully specified in source evidence
Status Codes: 200 (success path confirmed); error status codes NOT confirmed — gap (§25)
```

All contracts above are consistent with the existing Pydantic models named in `backend/models.py` per `PRD_VALIDATION.md` §1/§6; no response fields are invented beyond what the reconstruction and validation confirm exist or what the PRD explicitly requires (e.g., minimal Company identity fields).

---

## 9. API VERSIONING

No versioning scheme currently exists (`/analyze`, `/ask`, `/health` are unversioned paths per `PRD_VALIDATION.md` §1, §11). Given the small existing surface and single-consumer (first-party frontend) nature of this API, introducing a heavyweight versioning scheme (e.g., `/v1/`, `/v2/` with parallel maintenance) is not justified at this stage.

**Recommendation**: Continue unversioned paths for now; if/when the API gains external or third-party consumers, introduce a single `/v1/` prefix at that time rather than preemptively. This keeps the existing endpoints unchanged and avoids unnecessary complexity, consistent with Architecture Principle 6.

---

## 10. DATABASE ARCHITECTURE

### Current PostgreSQL architecture
- **Technology**: PostgreSQL via SQLAlchemy, declarative Base. *(EXISTING)*
- **Existing tables** (per `PROJECT_AUDIT.md` §6, confirmed in `PRD_VALIDATION.md` §10): `financials_quarterly`, `raw_documents`, `guidance_entries`.
- **Migrations**: No migration system (e.g., Alembic) is configured. *(EXISTING gap — noted, not silently fixed without a decision, see §11)*
- **Vector store**: ChromaDB, collection `equity_chunks`, embeddings via `all-MiniLM-L6-v2`. *(EXISTING)*

### Target schema additions

Only entities required by the validated MVP or explicitly approved product decisions are added — no speculative schema is created for undecided features.

**`companies` (NEW — required for MVP)**
- **Purpose**: Backend-authoritative company identity, replacing `dummyData.ts` for discovery.
- **Fields**: `id`, `name`, `ticker`, `sector` (matches the minimal identity scope defined in `PRD.md` §14/§19 — no price/market fields here, since Market Data is a separate, decision-gated concern).
- **Relationships**: Referenced by `financials_quarterly` (already keyed by company in some form, per existing Fundamental Debater queries) and by `raw_documents`; exact existing foreign-key structure should be verified against the live schema before migration, since the reconstruction/validation did not document current company-keying mechanics in `financials_quarterly` in full.
- **Constraints**: `ticker` unique; `name` indexed for search.
- **Indexes**: Index on `name` and `ticker` to support `/companies/search`.
- **Migration**: New table; backfill from whatever company set is chosen for MVP (curated list per `PRD.md` §33 Decision 7), not from `dummyData.ts` directly (that data is mock and must not be treated as production seed data without review — see §11).

**Entities NOT created in this pass (decision-gated):**
- `market_data` / `daily_prices` — TBD, Decision 3.
- `news_items` (dashboard-facing) — TBD, Decision 6.
- `watchlists`, `watchlist_items` — TBD, Decision 5.
- `users` — TBD, Decisions 1–2.

This matches `PROJECT_RECONSTRUCTION.md` §12's finding that these entities exist only in frontend mocks today, and `PRD_VALIDATION.md` §10's confirmation that this mapping is accurate.

---

## 11. DATABASE MIGRATION STRATEGY

- **Existing schema preservation**: `financials_quarterly`, `raw_documents`, `guidance_entries` are unchanged by this TRD; no destructive migrations are proposed against them.
- **New migrations**: Introduce a `companies` table as an additive migration. Because no migration tool is currently configured, **introducing one (e.g., Alembic) is itself an in-scope technical task** for this phase of work — not because the PRD requires migration tooling as a product feature, but because adding a new table without any migration discipline would itself be a new piece of technical debt. This is a minimal-necessary infrastructure addition, not scope creep, per Architecture Principle 6 (it doesn't add a new *service*, just discipline around the database already in use).
- **Migration ordering**: `companies` table must exist before any foreign-key-style relationships from other tables are added to it (if any are introduced later, e.g., if `financials_quarterly` is refactored to key against `companies.id` explicitly).
- **Data migration needs**: None required for existing tables. The new `companies` table needs an initial data load — this is a seed/backfill operation, not a schema migration.
- **Seed/demo data strategy**: The curated MVP company set (per `PRD.md` §33 Decision 7) should be loaded via an explicit seed step, clearly separated from any test/demo fixtures. **`dummyData.ts`'s company list must not be mechanically copied into the seed data without review** — it was authored as UI placeholder content, not verified real company data, and copying it uncritically would reintroduce mock data under the guise of "real" backend data, violating Architecture Principle 7.
- **Rollback considerations**: The new `companies` table is additive and can be dropped without affecting existing AI-pipeline tables if the Company feature needs to be rolled back; no other schema changes are proposed that would complicate rollback.

---

## 12. AI MULTI-AGENT ARCHITECTURE

```text
Company (via new Company API / existing CompanyInput)
   ↓
Data/Ingestion (Screener scrape, transcript scrape, IR PDF ingestion)
   ↓
Fundamental Agent  |  Sentiment Agent  |  Alternative Agent
   ↓ (parallel)
Coordinator (synthesis; confidence handling — TARGET CHANGE, see §16)
   ↓
Scorecard → EquityResearchResponse → Frontend
```

This structure is preserved from the current implementation (`PRD_VALIDATION.md` §7). The only structural change in this TRD is to the Coordinator's confidence-handling logic (§16); all three debaters keep their existing input/output contracts.

Per-agent summary (detail in §13–§15):

| Agent | Inputs | Outputs | Data Source | LLM | Persistence | Status |
|---|---|---|---|---|---|---|
| Fundamental | Company name | Score, confidence, reasoning, evidence | PostgreSQL (`financials_quarterly`) via `verify_metric` | Grok | Reads from `structured_store` | EXISTING |
| Sentiment | Company name | Score, confidence, reasoning, evidence | Exa (news), Firecrawl (transcripts) | Grok | None (runtime fetch) | EXISTING, transcript URL fragile |
| Alternative | Company name | Score, confidence, reasoning, evidence | Hardcoded constants | Grok | None | MOCKED |
| Coordinator | 3 debater outputs | Final scorecard dict | N/A | Possibly LLM-assisted synthesis | Writes to response, not DB | PARTIAL |

---

## 13. FUNDAMENTAL AGENT

- **Data requirements**: Quarterly financial metrics (`revenue`, `pat`, `roce`, `debt_equity`, and others per `financials_quarterly`).
- **Financial metrics**: Sourced via `verify_metric` against PostgreSQL — this mechanism is confirmed real and functioning (`PRD_VALIDATION.md` §4, §7).
- **PostgreSQL dependencies**: Requires the `financials_quarterly` table to be populated (via the existing Screener scraper) before analysis.
- **Calculation logic**: Not fully detailed in the reconstruction/validation beyond "queries real metrics"; treated as an internal implementation detail preserved as-is.
- **LLM usage**: Grok, used to reason over the retrieved metrics and produce narrative justification.
- **Output schema**: Conforms to the existing per-dimension shape within `Scorecard`/`ScoreDimension`.

**Current vs. target**: No functional change required — this agent is EXISTING and already satisfies the validated PRD (`FR-003`). The only target-level requirement layered on top is the general "insufficient evidence" state (`FR-013`, `PRD.md` §22) — if `financials_quarterly` has no data for a company, this agent must explicitly signal low/no confidence rather than the current behavior (which is not fully documented as doing so — treated as a PARTIAL gap per `PRD_VALIDATION.md` FR-013 row, not a confirmed failure).

---

## 14. SENTIMENT AGENT

- **Transcript/news discovery**: News via Exa (confirmed real search); transcripts via Firecrawl scraping.
- **External scraping/API dependencies**: Exa API, Firecrawl API.
- **Sentiment extraction**: Performed by Grok reasoning over retrieved news/transcript content.
- **Output**: Score, confidence, reasoning, evidence — same shape as other debaters.
- **Failure cases**: Company with no news results; company with no locatable/scrapeable transcript.

**Target requirement — transcript URL robustness** (per `PRD_VALIDATION.md` §18 "Missing Product Requirements" and §7/§9): The current transcript-URL construction is described as "a generalized guess," meaning it likely constructs a probable URL pattern rather than reliably discovering the actual transcript location. The target technical approach should replace or supplement this guess with a **discovery step** — e.g., searching investor-relations pages or using Exa/Firecrawl's own search capabilities to locate the actual transcript URL before attempting to scrape it, rather than assuming a fixed URL pattern. This is a **MODIFY**, not a rebuild: the surrounding scrape-and-analyze flow is preserved; only the URL-acquisition step changes. If a transcript genuinely cannot be located, the agent should proceed with reduced evidence (news-only) rather than failing the whole dimension, consistent with the Error Handling strategy in §25.

---

## 15. ALTERNATIVE DATA AGENT

- **Current implementation**: Hardcoded `jobs_count = 15`, `traffic_rank = 5000` regardless of company (`PRD_VALIDATION.md` §7, §12; `alt_debater.py`).
- **Target requirement**: **TBD — PRODUCT DECISION REQUIRED** (`PRD.md` §33 Decision 4). This TRD does not select a vendor (e.g., SimilarWeb, LinkedIn data providers) and does not assume real integration is approved.
- **Data source requirements** (if approved): A hiring-activity data source and a web-traffic ranking data source, each queryable per-company, with a defined fallback when no data is available for a given company (mirroring the "insufficient evidence" pattern used elsewhere rather than substituting fabricated defaults).
- **Integration boundary** (if approved): The agent's existing input/output contract (company name in; score/confidence/reasoning/evidence out) should be preserved — only the internal data-fetching step changes, keeping this a MODIFY rather than a rebuild, consistent with Architecture Principle 9 (replaceable external integrations).

**If not approved**: The dimension should be removed from the scorecard rendering path (frontend) and the coordinator's dimension aggregation (backend), rather than left silently producing fabricated output — this is required by the AI Safety/Trust principles in `PRD.md` §23, independent of which way the vendor decision goes.

---

## 16. COORDINATOR / SYNTHESIS

### Current implementation
The coordinator (`debate_coordinator` in `coordinator.py`) receives the three debaters' outputs and checks each dimension's confidence against `debate_refinement_threshold`. When confidence is below threshold, instead of triggering genuine re-evaluation, it directly executes `lc["confidence"] = min(current_conf + 20, 100)` — an unconditional numeric increment with no relationship to any new evidence or reasoning. *(CONFIRMED — `PRD_VALIDATION.md` §7, §12; `PROJECT_RECONSTRUCTION.md` §10)*

### Target behavior
Per `PRD.md` §10 and §33 Decision 9, the validated PRD's minimum-viable direction is: **remove the fabricated confidence inflation and present confidence as genuinely computed by the initial debate**, deferring genuine LLM-based refinement as a possible post-MVP enhancement rather than building it now.

### Technical change
- **MODIFY** `coordinator.py`: delete/disable the `lc["confidence"] = min(current_conf + 20, 100)` branch (and any code path that exists solely to support it).
- The refinement-threshold check itself (`debate_refinement_threshold` request parameter) may be preserved structurally for forward compatibility, but must not trigger any confidence modification that isn't backed by genuinely new evaluation. If no genuine refinement is being built in this phase, the simplest correct behavior is: compute confidence once from the debaters' actual outputs, and report it as final — no bump step at all.
- If genuine refinement is later approved (post-MVP), the technical shape would be: on low confidence, re-invoke the relevant debater(s) with the coordinator's specific concern as additional context, and only update confidence based on the *content* of that re-invocation's output — this is noted here for forward planning but is **not** part of the current build scope.
- This change is isolated to `coordinator.py`'s synthesis logic; no changes to `Scorecard`/`ScoreDimension` schemas are required, since `confidence` remains a numeric field either way.

---

## 17. RAG ARCHITECTURE

```text
Document (IR PDF)
 ↓
Parsing (PdfReader, parser_tools.py)
 ↓
Chunking
 ↓
Embedding (SentenceTransformerEmbeddingFunction, all-MiniLM-L6-v2)
 ↓
ChromaDB (collection: equity_chunks)
 ↓
Retrieval (search_chunks)
 ↓
Context construction (pipeline.py)
 ↓
Gemini (gemini-2.5-flash, default; Grok configurable via QA_MODEL)
 ↓
Answer + Citations (AskResponse)
 ↓
[If 0 chunks retrieved] → Grok-based answer_with_citations fallback → fallback_used = true
```

*(CONFIRMED as accurately reflecting the existing implementation — `PRD_VALIDATION.md` §8, §11; `PROJECT_RECONSTRUCTION.md` §11)*

### Required target changes
- **No changes to the retrieval/generation pipeline itself.** This is EXISTING and validated as fully functional.
- **Frontend-facing change only**: `CopilotSidebar.tsx` must render a distinct visual treatment when `fallback_used === true` in the `AskResponse`, satisfying `FR-009`. This is a frontend consumption change, not a backend/RAG architecture change — the backend already returns the flag needed (`PRD_VALIDATION.md` §8: "the `fallback_used` flag is returned by the backend, but `CopilotSidebar.tsx` does not currently exhibit clear visual styling").

---

## 18. DOCUMENT INGESTION ARCHITECTURE

```text
Company
 ↓
Discovery (locate IR PDFs)
 ↓
Download
 ↓
Parsing (PdfReader)
 ↓
Metric Extraction (regex — demo-quality)
 ↓
Chunking
 ↓
Embedding (all-MiniLM-L6-v2)
 ↓
Persistence (raw_documents in PostgreSQL; chunks in ChromaDB equity_chunks)
 ↓
Retrieval (feeds both RAG/Copilot and, for metrics, Fundamental Debater)
```

*(CONFIRMED — `PRD_VALIDATION.md` §9; `PROJECT_RECONSTRUCTION.md` §6 Flow E, §11)*

**Current limitations**: Metric extraction from parsed PDFs uses regex and is explicitly "demo-quality" — it likely misses or misparses metrics that don't match the expected text patterns.

**Target behavior required by the PRD**: The PRD (`PRD.md` §9 Feature Spec: Document Ingestion) does not mandate a specific extraction-quality improvement as a P0/P1 requirement — it lists improving extraction quality as optional, not a functional gap. This TRD therefore does **not** mandate replacing the regex extraction in this phase; it is documented here as a known limitation (§37 Technical Debt) rather than a required change, consistent with not inventing requirements the PRD didn't make.

---

## 19. COMPANY DATA ARCHITECTURE

Per `PRD.md` §14 and §33 Decision 7, the target scope is a **minimal, curated company set**, not a full market-wide index — this TRD designs accordingly.

- **Company identity**: `id`, `name`, `ticker`, `sector` — matches the minimal identity fields defined in the PRD; no additional fields (price, market cap, etc. belong to the separate, decision-gated Market Data architecture in §20, not to core identity).
- **Ticker**: Unique identifier for search/lookup, alongside `id`.
- **Company metadata**: Limited to `sector` for now; nothing else is required by the validated PRD scope.
- **Search**: Implemented via the new `GET /companies/search` endpoint (§7, §8), backed by a simple indexed name/ticker match against the new `companies` table — no external search infrastructure (e.g., Elasticsearch) is justified for a curated, minimal set.
- **Selection**: Frontend calls `/companies/search`, user selects a result, frontend navigates to `/company/:id` using the returned `id`.
- **Company lookup**: `GET /companies/{id}` for the detail page's identity display.

**Existing curated dataset**: The reconstruction and validation do not report an existing curated company dataset in the backend (only in `dummyData.ts`, which is explicitly mock and not to be used as a seed source without review, per §11). This is a genuine gap requiring new data: either a manually curated list matching the companies the Screener scraper can already successfully pull financials for, or another sourcing approach — this specific sourcing mechanism is left to implementation planning, not decided here, since the PRD does not specify it and this TRD should not invent a data-acquisition process beyond noting the requirement.

**Scalability note**: If the product later needs a larger/full company master (beyond the curated MVP set), the `companies` table and search endpoint are structured to scale to that without a redesign — this is a forward-compatibility note, not a current requirement.

---

## 20. MARKET DATA ARCHITECTURE

**Status: TBD — pending `PRD.md` §33 Decision 3.** This TRD does not build this now; the following is scoped only to avoid foreclosing the decision.

If approved, the technical shape would be:
- **Current price**: A single latest-price value per company, refreshed on some cadence (cadence not specified by the PRD — no number invented here).
- **Historical data / candlestick data**: OHLCV records over time, likely stored in a new `market_data`/`daily_prices` table if persisted, or fetched live from a vendor and cached (see §28) if not persisted long-term.
- **Timestamps/freshness**: Each price/candlestick record must carry an as-of timestamp so the frontend can display data recency, per `PRD.md` §15.
- **Storage strategy**: TBD — depends on whether the chosen vendor supports historical queries directly (reducing the need for local storage) or only current snapshots (requiring local accumulation over time).
- **API integration boundary**: A new backend service (e.g., `market_data_service`) should wrap the vendor call so the frontend and rest of the backend never talk to the vendor directly — consistent with Architecture Principle 9.
- **Caching**: Likely needed to avoid excessive vendor calls on repeated page views (see §28).

**`TBD — Market Data Provider`**: Whichever vendor is eventually selected (in the implementation-planning stage that follows this decision) must support: per-company current price lookup, historical OHLCV data at a queryable granularity, and reasonable rate limits for a research-tool usage pattern. No specific vendor is named here.

---

## 21. NEWS ARCHITECTURE

**Status: TBD — pending `PRD.md` §33 Decision 6.**

This must remain architecturally **separate** from the Sentiment Debater's internal Exa-based news use, per `PRD.md` §16 and `PRD_VALIDATION.md` §10/§12 — the two are confirmed to be different capabilities today (one is a live, ephemeral search feeding an LLM prompt; the other would be a persisted, user-facing feed) and unifying them was not requested or evidenced.

If approved, the technical shape would be:
- **Retrieval**: A backend service calling a (TBD) news vendor/API per company.
- **Normalization**: Mapping vendor response fields to the existing `NewsItem`-like shape already modeled in the frontend (`title, source, date, sentiment, summary, url`), so frontend changes are minimized.
- **Storage/cache**: Likely a lightweight cache or short-lived persisted table, given news is time-sensitive and doesn't need indefinite storage — full persistence strategy is an implementation-planning decision, not fixed here.
- **Source metadata**: Publisher/source name retained per item.
- **Publication time**: Retained per item for display and potential recency sorting.
- **Company association**: Each item keyed to a `companies.id`.
- **Frontend API**: `GET /companies/{id}/news`, matching the pattern established for `/companies/{id}/market-data`.

No vendor is selected here.

---

## 22. WATCHLIST ARCHITECTURE

**Status: TBD — pending `PRD.md` §33 Decisions 1, 2, and 5.**

```text
Watchlist persistence
        ↓
Requires identity/ownership model
        ↓
Authentication decision (§23)
```

This dependency is explicit and blocking: persisted, multi-session watchlists inherently require knowing *whose* watchlist it is, which requires the Authentication decision to be resolved first. **This TRD does not invent an anonymous/device-based persistence mechanism as a workaround** — that would silently resolve a product decision (whether the product is single-user or multi-user) through a technical backdoor, which is explicitly disallowed.

If Decisions 1/2/5 are approved together (multi-user + auth + persisted watchlists), the technical shape would be:
- **User ownership**: Each watchlist references a `user_id` (from the User entity established by whatever auth mechanism is chosen — not specified here).
- **Watchlist model**: `id`, `user_id`, `name`, timestamps.
- **Watchlist items**: `id`, `watchlist_id`, `company_id` (referencing the new `companies` table from §10), timestamps.
- **CRUD APIs**: `POST/GET/DELETE /watchlists`, `POST/DELETE /watchlists/{id}/companies/{companyId}` (as listed in §7).
- **Persistence**: PostgreSQL, consistent with the rest of the structured data.
- **Duplicate handling**: A unique constraint on `(watchlist_id, company_id)` to prevent duplicate membership at the database level, backing the product requirement in `PRD.md` §17.
- **Company references**: Foreign key to `companies.id` — meaning a company must exist in the real Company backend (§19) before it can be watchlisted; this is an additional argument for prioritizing the Company backend regardless of the Watchlist decision's outcome.
- **Deletion behavior**: Deleting a watchlist should cascade-delete its items; deleting a company from the master list (an edge case not directly addressed by the PRD) would need a decision on cascade vs. restrict — flagged here as an implementation-planning detail, not resolved in this TRD.
- **Analysis integration**: Watchlist analysis should invoke the existing `/analyze` pipeline per company rather than duplicating agent logic — reusing, not reimplementing, per Architecture Principle 1.

**If Decisions 1/2/5 are not approved**: The current frontend watchlist UI (`WatchlistsPage.tsx`, `WatchlistAnalysis.tsx`) should be either removed from the shipped MVP surface or clearly marked as non-functional/demo, per Architecture Principle 7 and §5's frontend change table — leaving it silently mocked is not an acceptable target state regardless of which way the feature decision goes.

---

## 23. AUTHENTICATION AND AUTHORIZATION

### Product dependency
The only currently-identified feature requiring identity is **persisted, per-user watchlists** (§22). No other MVP-scoped feature (`/analyze`, `/ask`, Company search) requires identity.

### Technical requirement (if selected)
An authentication system, whatever its implementation, would need to provide at minimum: user registration, login, logout, session/token validation on subsequent requests, and a stable `user_id` that other tables (e.g., `watchlists`) can reference as a foreign key.

### Options
Not evaluated in detail here, per instructions not to select a technology prematurely. In broad terms, the eventual choice will fall into either (a) a self-managed auth implementation within the existing FastAPI backend, or (b) a managed third-party identity provider integrated via the backend. Both are technically compatible with the existing stack; the choice depends on factors (team capacity, timeline, cost) outside this TRD's evidence base.

### Decision
`TBD — PRODUCT DECISION REQUIRED` (`PRD.md` §33 Decisions 1–2).

### Extensibility note
Because no other MVP feature depends on authentication, deferring this decision does not block delivery of the MVP Core (§27 of `PRD.md`; §26 of this TRD's gap matrix). When authentication is eventually selected, it can be added as a new module (e.g., `backend/auth/`) plus a `users` table and a `user_id` foreign key added to `watchlists`, without requiring changes to `/analyze`, `/ask`, or the Company API — this is a deliberate design property, not an accident, consistent with keeping the AI core and Company API decision-independent.

---

## 24. EXTERNAL INTEGRATION ARCHITECTURE

| Integration | Purpose | Interface | Request Flow | Auth/Secrets | Rate Limits | Timeout | Retries | Fallback | Status |
|---|---|---|---|---|---|---|---|---|---|
| Grok | LLM reasoning for all three debaters | Agno-mediated API calls | Agent invokes with company/evidence context | `GROK_API_KEY` env var | Not documented in source evidence | Not documented | Not documented | None confirmed | EXISTING |
| Gemini | Default LLM for RAG answer generation | Direct API call in `rag/pipeline.py` | Question + retrieved context → answer | `GEMINI_API_KEY` env var | Not documented | Not documented | Not documented | Falls back to Grok-based QA agent on zero-chunk retrieval (not on Gemini failure specifically — distinction not detailed in evidence) | EXISTING |
| Exa | News search (Sentiment Debater) | API call | Company name → news results | `EXA_API_KEY` env var | Not documented | Not documented | Not documented | None confirmed | EXISTING |
| Firecrawl | Transcript scraping (Sentiment Debater) | API call | Guessed/discovered URL → scraped content | `FIRECRAWL_API_KEY` env var | Not documented | Not documented | Not documented | None confirmed — target improvement in §14 | EXISTING, target hardening |
| Screener.in | Structured financial data scraping | Direct scrape (BeautifulSoup4/Trafilatura) | Company → financial page → parsed metrics | None (public scrape) | Not documented; site-imposed limits possible | Not documented | Not documented | None confirmed | EXISTING |
| Llama Cloud | Configured per `.env` (`LLAMA_CLOUD_API_KEY`) but role not detailed in reconstruction/validation | Unknown | Unknown | `LLAMA_CLOUD_API_KEY` | Unknown | Unknown | Unknown | Unknown | UNKNOWN — flagged, not assumed |
| Market data vendor | Prices/charts | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD, Decision 3 |
| News vendor | Dashboard news feed | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD, Decision 6 |
| Alternative-data vendor(s) | Real hiring/traffic signals | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD, Decision 4 |

**Note on `Llama Cloud`**: `config.py` is documented as containing a `LLAMA_CLOUD_API_KEY` (`PROJECT_AUDIT.md` §10), but neither the reconstruction nor the validation traces its actual usage in any agent or pipeline. This TRD does not assume a role for it and flags it as UNKNOWN rather than guessing — worth a direct repository check during implementation, since it may be unused, experimental, or tied to functionality not surfaced in the audits.

**Target requirement (general, applies across all integrations)**: Every external integration should have a defined timeout and a defined failure behavior (§25) even where the current implementation's specifics aren't documented in the source evidence — this TRD flags the absence of documented timeout/retry behavior as a gap to close (§37), not something to silently assume is already handled.

---

## 25. ERROR HANDLING

| Failure Type | Backend Behavior | API Response | Frontend Behavior | User-Facing Message | Logging |
|---|---|---|---|---|---|
| Request validation error (`/analyze`, `/ask`, new Company endpoints) | Pydantic validation rejects request | 422 with validation detail | Show field-level or general validation error | "Please check your input and try again" (or field-specific) | Log at WARN with request context |
| Company not found (Company API) | Lookup returns none | 404 | Show "company not found" state | "We couldn't find that company" | Log at INFO |
| Analysis fails entirely (all agents fail / scraping fails) | Catch and return a clear failure indicator rather than a partial/malformed scorecard | Non-200 (exact code TBD at implementation; 502/500 reasonable given external-dependency failure) | Show explicit error state (FR-012), offer retry | "Analysis couldn't be completed right now — please try again" | Log at ERROR with company + failure cause |
| Partial agent failure (one debater fails, others succeed) | Coordinator should still synthesize from available dimensions and mark the failed dimension explicitly | 200 with a dimension explicitly marked unavailable (this is a **NEW** requirement — current partial-failure behavior is UNKNOWN per reconstruction) | Show the failed dimension as "unavailable" rather than omitting it silently | "We couldn't complete the [X] analysis for this company" | Log at WARN, specific agent identified |
| Financial data unavailable | Fundamental Debater proceeds with explicit low/no-confidence signal (FR-013) | 200, dimension confidence reflects data absence | Dimension shown with a "limited data" indicator | "Limited financial data available" | Log at INFO |
| Transcript unavailable | Sentiment Debater proceeds with news-only evidence | 200, confidence reflects reduced evidence | Same pattern as above | "Limited to news data — transcript unavailable" | Log at INFO |
| No IR PDFs found | Ingestion returns empty; downstream Fundamental/RAG grounding reduced | 200, but Copilot fallback more likely | Copilot shows fallback labeling (FR-009) when relevant | Handled via existing fallback UX | Log at INFO |
| RAG retrieval returns zero chunks | Falls back to `answer_with_citations` (Grok), `fallback_used=true` | 200 | Visually distinct "not document-grounded" treatment (FR-009 — currently missing per validation) | "This answer isn't based on the company's documents" (or similar) | Log at INFO |
| LLM provider failure (Grok/Gemini) | Should surface as an explicit failure for the affected component, not a fabricated/blank response | Non-200 or an explicit error field in the response | Explicit error message for the affected section | "AI analysis temporarily unavailable" | Log at ERROR with provider identified |
| External API timeout (Exa/Firecrawl/Screener/vendor) | Timeout should be treated as a soft failure for that specific evidence source, not a hard pipeline failure, consistent with the "proceed with reduced evidence" pattern above | 200 with reduced-confidence dimension, where possible | Reflect reduced evidence, not a generic error | Consistent with reduced-evidence pattern | Log at WARN |
| Rate limiting from any external provider | Should be caught and treated similarly to timeout (soft failure for that evidence source) | 200 with reduced-confidence dimension, where possible | Same as above | Same as above | Log at WARN |
| Unsupported/invalid company submitted for analysis | Reject before invoking the expensive agent pipeline, once Company backend exists (§19) to validate against | 400/404 | Clear rejection before triggering a long-running analysis | "This company isn't currently supported" | Log at INFO |

This table intentionally marks several current backend error behaviors as **NEW** or **UNKNOWN** rather than assuming they already exist — neither the reconstruction nor the validation documents the current `/analyze`/`/ask` error/status-code behavior in detail, and this TRD does not fabricate that detail.

---

## 26. LOADING / LONG-RUNNING ANALYSIS

- **Analysis state**: `/analyze` involves scraping, ingestion, and three parallel agent calls plus coordination — this is a multi-step, potentially slow synchronous request. The frontend's `useAnalyze` (React Query) already provides a loading state mechanism; the target requirement is to ensure this is clearly surfaced in the UI (tied to FR-012's error-state work, since loading and error states are naturally implemented together).
- **Timeout**: A reasonable client-side and/or server-side timeout should exist so a hung analysis doesn't leave the user in an indefinite loading state; no specific duration is specified here since none is supported by evidence — this is an implementation-planning detail.
- **Cancellation**: Not currently confirmed to exist; not mandated as a new requirement by the PRD, so not added here beyond noting it as a possible future usability improvement.
- **Retries**: Given the current synchronous design, a failed analysis should be retriable by the user re-submitting (i.e., re-invoking `/analyze`), rather than requiring any new backend retry-queue mechanism.
- **Partial failure**: See §25 — partial agent failure should degrade to a partial scorecard with the failed dimension marked, not fail the whole request, where technically feasible.
- **Frontend progress state**: A basic "analysis in progress" indicator is sufficient; no fine-grained multi-step progress UI (e.g., "Fundamental agent running... Sentiment agent running...") is required by the PRD, and none is added here as scope.

**On background queues**: The existing synchronous request/response design (no job queue) is **retained**. Introducing an async task queue (Celery, background workers, etc.) is not justified by the current scale or the validated MVP scope — `/analyze` being slow is a UX/timeout concern to manage within the existing synchronous model (clear loading state, reasonable timeout, retriable on failure), not evidence that a queueing system is required. This is consistent with Architecture Principle 6 and the explicit instruction not to introduce background queues unless technically necessary.

---

## 27. SECURITY

- **Environment secrets**: All API keys (`GROK_API_KEY`, `GEMINI_API_KEY`, `EXA_API_KEY`, `LLAMA_CLOUD_API_KEY`, `FIRECRAWL_API_KEY`, `POSTGRES_URL`) must remain server-side only, loaded via `.env`/`config.py` as already established — no change to this existing pattern, only a requirement that new integrations (Company data, and any future Market Data/News/Alt-Data vendors) follow the same pattern.
- **API keys**: Never exposed to the frontend; the frontend only ever talks to the EquityLens backend, never directly to Grok/Gemini/Exa/Firecrawl/vendors — this is already true structurally and must remain true as new integrations are added.
- **CORS**: Must be configured to allow the frontend's origin(s) only; current configuration not detailed in evidence — flagged as a gap to verify/harden during implementation, not assumed already correct.
- **Input validation**: All new endpoints (Company search/lookup, and any future Market Data/News/Watchlist endpoints) must use Pydantic request models, consistent with the existing pattern, to prevent malformed input from reaching business logic.
- **Prompt injection considerations**: Since Copilot answers are grounded in scraped/ingested documents (which are external, potentially adversarial content), the RAG pipeline's prompt construction should treat retrieved chunk content as data, not as instructions — this is a general LLM-application security practice relevant given the product ingests third-party PDFs; no specific existing mitigation is confirmed in the evidence, so this is flagged as a hardening consideration rather than a confirmed existing protection.
- **Document content safety**: Ingested PDFs are from third-party sources (investor-relations sites); parsing should be resilient to malformed/oversized files without crashing the ingestion pipeline.
- **External URL handling**: The Sentiment Debater's transcript-URL construction (§14) and the Company/document discovery steps should validate/sanitize any URLs before fetching, to avoid SSRF-style risks from untrusted URL construction.
- **SQL injection prevention**: Already mitigated by SQLAlchemy's parameterized query usage in the existing `structured_store.py`; new Company-table queries must follow the same ORM-based pattern rather than raw string-built SQL.
- **Authorization**: Not applicable to current MVP scope (no auth). If/when authentication is added (§23), all user-owned data (watchlists) must be scoped so a user can only access their own records.
- **User data isolation**: Not applicable until authentication is selected; noted as a hard requirement at that time (§23).
- **Logging of sensitive information**: API keys and any future user credentials must never appear in logs; company/financial data being logged for debugging is lower-risk but should still avoid logging full LLM prompts/responses verbatim in production logs where they might contain scraped third-party content at length.

No compliance certifications (SOC 2, ISO 27001, etc.) are claimed or targeted here, as none are supported by any evidence or requirement.

---

## 28. CACHING

- **Company search**: Given a minimal curated company set (§19), the underlying data is small and changes infrequently — a simple indexed database query is sufficient; no caching layer is required for MVP.
- **Market data** (if approved, §20): Likely benefits from caching, since repeated page views for the same company within a short window shouldn't necessarily re-hit a paid market-data vendor on every request. A simple in-database "last fetched at" + TTL check, or an in-process cache, is sufficient — **no Redis or dedicated cache service is justified** at this scale.
- **News** (if approved, §21): Similarly may benefit from a short-TTL cache/database check rather than fetching on every page view — same reasoning as market data.
- **Expensive AI analysis (`/analyze`)**: Not currently cached, and no caching requirement is introduced here — analysis results are company-specific and evidence-time-sensitive (financials, news, sentiment change over time), so re-running rather than serving a stale cached scorecard is more consistent with the product's value proposition of "current" research. If this becomes a cost/performance concern at higher usage, a time-boxed cache (e.g., "don't re-run within N hours for the same company") could be considered later — not specified here since no evidence justifies a specific duration.
- **Document retrieval (ChromaDB)**: Already effectively a persistent index, not a cache-in-front-of-a-cache; no additional caching layer needed.

**Conclusion**: In-memory/database-level caching (simple TTL checks) is sufficient wherever caching is eventually needed; no dedicated caching infrastructure (Redis, CDN-layer caching, etc.) is required for the validated MVP scope.

---

## 29. BACKGROUND PROCESSING

- **Document ingestion / PDF processing / embeddings**: Currently performed synchronously as part of the `/analyze` request flow (per the traced pipeline in `PROJECT_RECONSTRUCTION.md` §6 Flow B and `PRD_VALIDATION.md` §7). This is a candidate for background/async processing if latency becomes a problem, but the validated PRD does not mandate this change, and introducing a background job system is a nontrivial infrastructure addition. **Retained as synchronous for this phase**, with the tradeoff being that `/analyze` requests remain slower and must be handled via the loading/timeout UX in §26 rather than a queue.
- **Large research analysis**: Same reasoning — synchronous for now.
- **Scraping**: Same reasoning — synchronous for now, part of the existing `/analyze` flow.

**Justification for retaining synchronous design**: The current scale (single-company, on-demand analysis, no evidence of high concurrent request volume) does not clearly justify the operational complexity of a background job system (worker processes, job status polling, a queue). If usage patterns later demonstrate a real need (e.g., users abandoning due to load time, need for concurrent multi-company batch analysis), this should be revisited as a dedicated technical decision at that time — not preemptively built now, consistent with Architecture Principle 6.

---

## 30. OBSERVABILITY

- **Structured logging**: Recommended across the backend (request context, company identifier, agent name, external API called) to support debugging the multi-agent pipeline's partial-failure behavior (§25). Current logging practices are not detailed in the reconstruction/validation — treated as a gap to establish, not assumed to already exist.
- **Error logging**: Every failure path defined in §25 should have a corresponding log entry at an appropriate severity.
- **Request logging**: Basic access logging for the API layer (method, path, status, duration) is a reasonable baseline; not confirmed to currently exist.
- **AI pipeline logging**: Each debater's success/failure and the coordinator's synthesis decisions should be logged, both for debugging and to support any future auditing of confidence changes (relevant given §16's confidence-integrity fix — logging makes it verifiable that no artificial inflation is occurring post-fix).
- **Ingestion logging**: Document discovery/download/parse success and failure per company.
- **External API failure logging**: Every external integration in §24 should log failures with enough context (which provider, which company, what error) to diagnose issues without needing to reproduce them.
- **Health endpoint**: `GET /health` is confirmed to already exist and should be **retained as operational infrastructure** (per `PRD_VALIDATION.md` §18's explicit recommendation) — it is not a product feature and does not need a frontend consumer; it exists for infrastructure-level monitoring (e.g., a deployment platform's health check, once a deployment model is chosen — §32).
- **Operational metrics**: No specific metrics dashboard or APM tooling is mandated here, as none is supported by evidence or requested; basic structured logs are sufficient for the current phase.

---

## 31. TESTING STRATEGY

### Frontend
- **Component tests**: For newly-added/modified components — Company search results list, the new Copilot fallback-label treatment, and the new explicit error/empty states on `CompanyDetail.tsx`.
- **Integration tests**: `useAnalyze`/`useAsk` hooks against a mocked backend, verifying loading/success/error state transitions.
- **User-flow tests**: End-to-end coverage of Journey 1 (Discover) once real, and Journey 2/5 (Analyze, Copilot) to guard the preserved core.

### Backend
- **Unit tests**: Company search/lookup service logic; the modified Coordinator logic (verifying the fabricated `+20` bump is gone and confidence reflects only genuine debater output); the hardened Sentiment transcript-discovery logic.
- **API tests**: New Company endpoints (`/companies/search`, `/companies/{id}`) — success, empty-result, and validation-error cases. Existing `/analyze`/`/ask` endpoints should gain test coverage for the error-handling behaviors newly specified in §25, since these are not confirmed to be tested today (an existing `test_refactoring.py` was found per `PROJECT_AUDIT.md` §11, but coverage is described as "low/ad-hoc").
- **Service tests**: `structured_store.py`/new Company store — CRUD correctness, uniqueness constraints.

### AI
- **Agent output validation**: Verify each debater returns a well-formed score/confidence/reasoning/evidence structure even on partial data.
- **Deterministic scoring logic where possible**: Any non-LLM logic (e.g., how the coordinator aggregates dimension scores into an overall score, if that aggregation is arithmetic rather than LLM-driven) should be unit-testable deterministically.
- **Prompt/output contract tests**: Verify agent LLM calls produce parseable output matching the expected schema (guarding against LLM output drift breaking the pipeline).
- **Fallback tests**: Specifically test that the Coordinator no longer inflates confidence (regression test directly targeting the fix in §16).

### RAG
- **Retrieval tests**: Verify `search_chunks` returns relevant chunks for known ingested content.
- **Citation tests**: Verify returned citations correctly map back to source chunks/documents.
- **No-result tests**: Verify zero-chunk retrieval correctly triggers the fallback path and sets `fallback_used=true`.
- **Grounding/fallback tests**: Verify the frontend correctly renders the distinct fallback treatment (FR-009) when `fallback_used=true` is returned — this bridges backend and frontend testing.

### Integration
- **Frontend ↔ backend**: Full request/response cycle for `/analyze`, `/ask`, and new Company endpoints.
- **Backend ↔ PostgreSQL**: Structured store read/write correctness, including the new `companies` table.
- **Backend ↔ ChromaDB**: Embedding/retrieval round-trip correctness.
- **Backend ↔ external APIs**: Mocked/stubbed tests for Grok, Gemini, Exa, Firecrawl, Screener.in to verify the backend's handling of both success and failure/timeout responses from each, directly exercising the error-handling matrix in §25.

No specific coverage percentage targets are set, as none are supported by evidence and none were requested.

---

## 32. DEPLOYMENT ARCHITECTURE

**Current state**: No deployment configuration exists — no Dockerfiles, no Kubernetes manifests, no Vercel/Netlify/other hosting config, no CI/CD pipeline. Local development relies on `npm run dev` (frontend, Vite) and Uvicorn (backend). *(CONFIRMED — `PROJECT_AUDIT.md` §12; `PRD_VALIDATION.md` §1)*

**Target deployment architecture**: `TBD — PRODUCT DECISION REQUIRED` (`PRD.md` §33 Decision 8). This TRD does not select a cloud provider or hosting platform. It defines the technical shape needed regardless of platform choice:
- **Frontend hosting**: Any static-hosting-capable platform (the app is a Vite-built SPA) — platform TBD.
- **Backend hosting**: Any platform capable of running a long-lived Python/FastAPI process (via Uvicorn or similar ASGI server) — platform TBD.
- **PostgreSQL**: A managed or self-hosted PostgreSQL instance reachable from the backend — provider TBD.
- **ChromaDB persistence**: Currently local-disk-based (`CHROMA_PERSIST_DIR`); in a hosted environment this requires either a persistent volume/disk attached to the backend service, or migration to a hosted vector-store option — this choice depends on the deployment platform selected and is not resolved here.
- **Environment variables**: See §33 for the full conceptual list; these must be securely injected by whatever deployment platform is chosen, not committed to source control.
- **Build commands**: Frontend — Vite build (`npm run build` or equivalent, exact script TBD from `package.json`); Backend — no build step beyond dependency installation (`requirements.txt`).
- **Startup**: Backend via Uvicorn (or a production ASGI server such as Gunicorn+Uvicorn workers, if warranted by the chosen platform); frontend served as static build output.
- **CORS**: Must be configured to allow the deployed frontend's actual origin once hosting is chosen (see §27).
- **Secrets**: Managed via whatever secrets-management mechanism the chosen platform provides — not resolved here.
- **Health checks**: The existing `GET /health` endpoint (§30) should be wired into whatever health-check mechanism the chosen deployment platform uses.

---

## 33. ENVIRONMENT CONFIGURATION

No actual secret values are included — this is a conceptual specification of what must be configurable.

| Variable | Purpose | Required | Environment |
|---|---|---|---|
| `POSTGRES_URL` | PostgreSQL connection string | Yes | Backend |
| `CHROMA_PERSIST_DIR` | ChromaDB local persistence path | Yes | Backend |
| `GROK_API_KEY` | Grok LLM access for debater agents | Yes | Backend |
| `GEMINI_API_KEY` | Gemini LLM access for RAG answer generation | Yes | Backend |
| `EXA_API_KEY` | Exa news search access | Yes | Backend |
| `FIRECRAWL_API_KEY` | Firecrawl scraping access | Yes | Backend |
| `LLAMA_CLOUD_API_KEY` | Configured, purpose UNKNOWN (§24) | Unclear — verify during implementation | Backend |
| `DEBATER_MODEL` | Model selection for debater agents | Yes (has existing default behavior presumably) | Backend |
| `COORDINATOR_MODEL` | Model selection for coordinator | Yes | Backend |
| `QA_MODEL` | Model selection for RAG/QA (defaults to Gemini, falls back to Grok) | Yes | Backend |
| `VITE_API_URL` | Backend API base URL for frontend | Yes | Frontend (defaults to `http://localhost:8000`) |
| `MARKET_DATA_API_KEY` | Market data vendor access | Only if Decision 3 approved | Backend — TBD |
| `NEWS_API_KEY` | News vendor access | Only if Decision 6 approved | Backend — TBD |
| `ALT_DATA_API_KEY(S)` | Alternative-data vendor(s) access | Only if Decision 4 approved | Backend — TBD |
| `AUTH_*` (provider-specific) | Authentication configuration | Only if Decisions 1–2 approved | Backend — TBD |

---

## 34. DATA FLOW

### Company Analysis
```text
Frontend (CompanyDetail.tsx)
↓
useAnalyze → api.ts → POST /analyze
↓
main.py routes to analysis orchestration
↓
Screener/Transcript scrapers populate PostgreSQL (financials_quarterly)
↓
Ingestion Agent discovers/parses/embeds IR PDFs → raw_documents (Postgres), equity_chunks (ChromaDB)
↓
Fundamental / Sentiment / Alternative Debaters run in parallel, each producing a per-dimension result
↓
Coordinator synthesizes into a Scorecard (confidence handling per §16 fix)
↓
EquityResearchResponse returned
↓
Frontend renders scorecard, reasoning, peer comparison
```

### Copilot
```text
User types question in CopilotSidebar.tsx
↓
POST /ask (question, company, top_k)
↓
Retrieval: search_chunks against ChromaDB (equity_chunks, scoped to company)
↓
If chunks found: context constructed → Gemini generates answer with citations
If zero chunks: fallback → Grok-based answer_with_citations, fallback_used=true
↓
AskResponse returned
↓
Frontend renders answer + citations, with fallback clearly labeled (FR-009 target fix)
```

### Document Ingestion
```text
Company identifier
↓
Ingestion Agent discovers IR PDF locations
↓
Download
↓
PdfReader parses text; regex extracts structured metrics (demo-quality, §18)
↓
Chunking of parsed text
↓
SentenceTransformer embeddings (all-MiniLM-L6-v2)
↓
Persistence: raw_documents (Postgres), equity_chunks (ChromaDB)
```

### Company Discovery (NEW)
```text
User types in SearchBar.tsx
↓
api.ts → GET /companies/search?q=...
↓
Company service queries companies table (indexed name/ticker match)
↓
Results returned to frontend
↓
User selects a company → navigate to /company/:id
↓
GET /companies/{id} for identity display
```

---

## 35. FRONTEND ↔ BACKEND INTEGRATION PLAN

| Feature | Frontend | API | Backend | Database | Status |
|---|---|---|---|---|---|
| Company analysis | `CompanyDetail.tsx`, `useAnalyze` | `POST /analyze` | `main.py`, `agents/` | `financials_quarterly`, `raw_documents`, ChromaDB | CONNECTED |
| Copilot Q&A | `CopilotSidebar.tsx` | `POST /ask` | `main.py`, `rag/pipeline.py` | ChromaDB | CONNECTED |
| Company search | `SearchBar.tsx`, `Index.tsx` | `GET /companies/search` (NEW) | New Company service (NEW) | New `companies` table (NEW) | NEEDS NEW API + NEW DB SUPPORT |
| Company identity | `CompanyDetail.tsx` header area | `GET /companies/{id}` (NEW) | New Company service (NEW) | `companies` table (NEW) | NEEDS NEW API + NEW DB SUPPORT |
| Copilot fallback labeling | `CopilotSidebar.tsx` | Uses existing `fallback_used` field | None (data already returned) | None | NEEDS FRONTEND UPDATE ONLY |
| Analysis error/empty states | `CompanyDetail.tsx`, `useAnalyze` | Uses existing `/analyze` response/error | Needs error-response consistency per §25 | None | NEEDS FRONTEND + BACKEND UPDATE |
| Market data/charts | `CandlestickChart.tsx` | `GET /companies/{id}/market-data` (TBD) | New Market Data service (TBD) | New `market_data` table or cache (TBD) | NEEDS MOCK REPLACEMENT — gated by Decision 3 |
| News feed | `NewsFeed.tsx` | `GET /companies/{id}/news` (TBD) | New News service (TBD) | New `news_items` table or cache (TBD) | NEEDS MOCK REPLACEMENT — gated by Decision 6 |
| Watchlists | `WatchlistsPage.tsx`, `WatchlistAnalysis.tsx` | New Watchlist CRUD endpoints (TBD) | New Watchlist service (TBD) | New `watchlists`, `watchlist_items` tables (TBD) | NEEDS MOCK REPLACEMENT — gated by Decisions 1, 2, 5 |
| Health check | None currently | `GET /health` | `main.py` | None | CONNECTED (operational only, no frontend consumer needed) |

---

## 36. CURRENT → TARGET TECHNICAL GAP MATRIX

| Component | Current State | Target State | Change | Priority |
|---|---|---|---|---|
| Frontend company discovery | MOCKED (`dummyData.ts`) | Backed by real Company API | MODIFY | P0 |
| Company backend | NEW (does not exist) | New model, table, service, endpoints | NEW | P0 |
| Coordinator confidence handling | BROKEN (fabricated inflation) | Genuine confidence, no fabricated bump | MODIFY | P0 |
| Copilot fallback UI | PARTIAL (backend flag exists, no frontend treatment) | Visually distinct fallback labeling | EXTEND | P0 |
| Analysis/Copilot error handling | PARTIAL/UNKNOWN | Explicit, consistent error states per §25 | EXTEND | P1 |
| Sentiment transcript discovery | PARTIAL (URL guessing) | Robust discovery mechanism | MODIFY | P1 |
| Document ingestion metric extraction | PARTIAL (regex, demo-quality) | Unchanged for this phase (optional future improvement) | NO CHANGE (documented as debt) | P3 |
| Fundamental Debater | EXISTING | Unchanged, plus insufficient-evidence signaling | EXTEND (minor) | P1 |
| RAG pipeline core | EXISTING | Unchanged | NO CHANGE | — |
| Market data | MOCKED | TBD | TBD | TBD (Decision 3) |
| News (dashboard) | MOCKED | TBD | TBD | TBD (Decision 6) |
| Watchlists | MOCKED | TBD | TBD | TBD (Decisions 1, 2, 5) |
| Alternative-data agent | MOCKED | TBD | TBD | TBD (Decision 4) |
| Authentication | MISSING | TBD | TBD | TBD (Decisions 1, 2) |
| Deployment | MISSING | TBD | TBD | TBD (Decision 8) |
| Database migration tooling | MISSING | Introduce minimal migration tool (e.g., Alembic) to support new `companies` table safely | NEW (minimal, necessary infra) | P1 |

---

## 37. TECHNICAL DEBT

| Item | Description | Classification |
|---|---|---|
| Coordinator confidence inflation | `lc["confidence"] = min(current_conf + 20, 100)` fabricates confidence rather than computing it genuinely | **Critical** — actively misrepresents AI output to users; directly violates AI Safety/Trust requirements |
| Alternative Debater hardcoded values | `jobs_count=15`, `traffic_rank=5000` regardless of company | **Critical** (if the dimension remains user-visible without being clearly marked as non-functional); severity drops to **Low/Not Applicable** if the decision is to remove the dimension |
| Frontend mock data (`dummyData.ts`) powering discovery, market data, news, watchlists | Presents simulated data as if real across most of the visible product surface | **High** — directly misleads users about what the product can do; must be resolved (either built real or clearly marked demo) before any real release |
| Sentiment Debater transcript URL guessing | "Generalized guess" URL construction, fragile | **Medium** — degrades Sentiment analysis quality/reliability but doesn't misrepresent output the way the Coordinator issue does |
| Document ingestion regex-based metric extraction | Demo-quality extraction, likely misses/misparses some data | **Medium** — reduces Fundamental analysis completeness in edge cases, not flagged as a required fix by the PRD |
| No database migration tooling | Schema changes have no managed migration path | **Medium** — becomes acute as soon as the new `companies` table (or any future schema change) needs to be safely deployed |
| No documented API error/status-code behavior for `/analyze`/`/ask` | Existing error handling is undocumented/unconfirmed in evidence | **Medium** — blocks confidently building the consistent error-handling layer in §25 without direct repository verification |
| Watchlist state entirely in frontend `useState` | Complete absence of persistence; any refresh loses data | **High** (if watchlists are approved and this isn't rebuilt) — **Low/Not Applicable** if watchlists are deferred/removed |
| No CORS/security configuration confirmed | Not documented as explicitly configured or verified | **Medium** — a prerequisite for any real deployment (§27, §32) |
| Low/ad-hoc backend test coverage | `test_refactoring.py` exists but coverage described as low | **Medium** — increases risk of regressions as the Coordinator fix (§16) and new Company API are introduced |
| `LLAMA_CLOUD_API_KEY` present but unused role | Configured secret with unconfirmed purpose | **Low** — worth verifying/cleaning up, not urgent |

---

## 38. MIGRATION / IMPLEMENTATION STRATEGY

```text
Phase 1 — Backend/data foundation
  Introduce minimal migration tooling; create `companies` table; seed curated MVP company set
  (seed data reviewed independently — not copied uncritically from dummyData.ts)

Phase 2 — Company API
  Build Company service + GET /companies/search + GET /companies/{id}

Phase 3 — Replace frontend mock data for discovery
  Wire SearchBar.tsx, Index.tsx, and CompanyDetail.tsx identity display to the new Company API
  Remove/retire the corresponding portions of dummyData.ts

Phase 4 — AI pipeline integrity fixes
  Remove Coordinator's fabricated confidence inflation (§16)
  Harden Sentiment Debater transcript URL discovery (§14)
  Add insufficient-evidence signaling to Fundamental/Sentiment outputs where missing (FR-013)

Phase 5 — Copilot and error-handling UX
  Add fallback-answer visual labeling to CopilotSidebar.tsx (FR-009)
  Define and implement explicit error/empty states for /analyze and /ask on the frontend (FR-012)
  Harden backend error responses for /analyze and /ask to support the above consistently

Phase 6 — Testing
  Backend unit/API tests for Company endpoints and the Coordinator fix
  RAG/fallback tests
  Frontend component/integration tests for the above

Phase 7 — Deployment foundation
  Resolve Decision 8 (deployment platform)
  Establish CORS/secrets/health-check wiring for the chosen platform

--- The following phases are explicitly gated and only proceed once their product decisions are resolved ---

Phase 8 — Market/News integrations (gated by Decisions 3, 6)
Phase 9 — Watchlist persistence + Authentication (gated by Decisions 1, 2, 5)
Phase 10 — Alternative-data real integration or removal (gated by Decision 4)
```

**Dependency notes**:
- Phase 2 (Company API) is a prerequisite for Phase 9 (Watchlists), since watchlist items reference companies — this holds regardless of when/whether Phase 9 is approved, so completing Phase 1–3 early has forward value even if watchlists are ultimately deferred.
- Phase 4 (AI integrity fixes) has no dependency on Phases 1–3 and could be executed in parallel — it's sequenced after Phase 1–3 above only for narrative clarity, not because of a technical blocking relationship.
- Phases 8–10 are intentionally placed last and gated, consistent with not building decision-dependent infrastructure prematurely.

---

## 39. TECHNICAL DECISIONS / TBDs

| Decision | Current State | Options | Recommended Direction | Blocking? |
|---|---|---|---|---|
| Authentication technology/provider | Absent | Self-managed vs. managed identity provider | No technical recommendation made — contingent on Decisions 1–2 in `PRD.md` §33 being resolved first | Blocks Phase 9 (Watchlists) only |
| Market-data provider | Mocked | Multiple commercial vendors exist; none evaluated here | No recommendation — contingent on `PRD.md` §33 Decision 3 | Blocks Phase 8 (market-data portion) only |
| News provider | Mocked | Multiple commercial vendors exist; none evaluated here | No recommendation — contingent on `PRD.md` §33 Decision 6 | Blocks Phase 8 (news portion) only |
| Alternative-data strategy/vendor | Mocked | Build real integration vs. remove dimension vs. keep as labeled placeholder | No recommendation — contingent on `PRD.md` §33 Decision 4 | Blocks Phase 10 only |
| Watchlist persistence | Mocked (frontend-only) | Build with auth vs. defer entirely | No recommendation beyond what's already proposed in `PRD.md` §33 Decision 5 (defer for MVP) | Blocks Phase 9 only |
| Deployment platform | Absent | Various hosting platforms; none evaluated here | No recommendation — contingent on `PRD.md` §33 Decision 8 | Blocks Phase 7 (and thus any real release) |
| Background processing | Not present | Keep synchronous vs. introduce a job queue | Keep synchronous for this phase (§29) — this is a technical recommendation this TRD does make, since it's justified by current scale, not by an unresolved product question | Not blocking |
| Caching infrastructure | Not present | In-memory/DB TTL checks vs. dedicated cache service (Redis, etc.) | In-memory/DB-level caching only, introduced when/if Market Data or News features are approved (§28) — this TRD does make this recommendation, as it's a technical scale judgment, not a product decision | Not blocking |
| Database migration tooling | Absent | Introduce a lightweight tool (e.g., Alembic) vs. continue without one | Introduce one — this TRD does make this recommendation, as it's necessary infrastructure hygiene for safely adding the new `companies` table, not a product-scope question | Blocks Phase 1 if skipped (schema changes would be unmanaged) |

Decisions explicitly requiring product-owner sign-off (per `PRD.md` §33) are marked with no technical recommendation, consistent with not silently resolving product decisions. Decisions this TRD does resolve (background processing, caching, migration tooling) are pure technical-scale judgments, not product-scope questions, and are justified individually above.

---

## 40. REQUIREMENT TRACEABILITY

```text
PRD Requirement
      ↓
Technical Component
      ↓
API / Database / Service
      ↓
Current Implementation
      ↓
Required Change
```

| Requirement | Technical Component | API / DB / Service | Current Implementation | Required Change |
|---|---|---|---|---|
| FR-001 Multi-agent analysis | Analysis orchestration | `POST /analyze`, `agents/` | EXISTING, functional | None (preserve) |
| FR-002 Scorecard output | Coordinator, models | `Scorecard`/`ScoreDimension` | EXISTING | Confidence-integrity fix only (§16) |
| FR-003 Fundamental analysis | Fundamental Debater | `financials_quarterly` | EXISTING | Add insufficient-evidence signaling |
| FR-004 Sentiment analysis | Sentiment Debater | Exa, Firecrawl | EXISTING | Harden transcript URL discovery (§14) |
| FR-005 Reasoning/evidence display | Reasoning Panel | `AgentMessage` | EXISTING | None (preserve) |
| FR-006 Peer comparison | Peer comparison logic | `PeerComparison` | EXISTING | None (preserve) |
| FR-007 Copilot Q&A | RAG pipeline | `POST /ask` | EXISTING | None (preserve) |
| FR-008 Grounded citations | RAG pipeline | `AskResponse.citations` | EXISTING | None (preserve) |
| FR-009 Fallback labeling | Copilot UI | `CopilotSidebar.tsx` | PARTIAL (backend flag exists, no UI treatment) | Add visual fallback treatment (§17, §35) |
| FR-010 Document ingestion | Ingestion Agent | `raw_documents`, ChromaDB | EXISTING | None required (extraction quality is optional, §18) |
| FR-011 Real company discovery | New Company module | `companies` table, `/companies/search` | MOCKED | Full new build (§7, §8, §10, §19) |
| FR-012 Analysis failure error state | Error handling layer | `/analyze` response + frontend | PARTIAL/UNKNOWN | Define and implement per §25 |
| FR-013 Insufficient-evidence state | Debater output handling | Debater responses | PARTIAL | Extend signaling per §25 |
| FR-014 Remove artificial confidence inflation | Coordinator | `coordinator.py` | BROKEN (fabricated) | Modify per §16 |
| FR-015 Market data (if selected) | New Market Data module | TBD | MOCKED | New build, gated (§20) |
| FR-016 News feed (if selected) | New News module | TBD | MOCKED | New build, gated (§21) |
| FR-017 Watchlist CRUD (if selected) | New Watchlist module | TBD | MOCKED | New build, gated (§22) |
| FR-018 Watchlist analysis (if selected) | New Watchlist module + existing `/analyze` reuse | TBD | MOCKED | New build, gated (§22) |
| FR-019 Real alternative data (if selected) | Alternative Debater | TBD | MOCKED | Modify, gated (§15) |
| FR-020 Authentication (if selected) | New Auth module | TBD | MISSING | New build, gated (§23) |

---

## 41. TRD QUALITY CHECK

1. Every P0/P1 PRD requirement (FR-001 through FR-014) has a technical implementation path defined above. ✅
2. Existing working components (`/analyze`, `/ask`, Fundamental/Sentiment Debaters, RAG pipeline, ingestion) are explicitly preserved, not redesigned. ✅
3. Mocked functionality (company discovery, market data, news, watchlists, alternative data) is clearly and consistently identified as MOCKED throughout, never described as functional. ✅
4. Current and target architectures are separated in every major section (§2 vs. §3, and per-component current/target subsections). ✅
5. Product decisions (auth, market data, news, watchlists, alt-data, deployment, MVP scope) are preserved as TBD, not silently converted into technical decisions — see §39. ✅
6. API contracts (§8) are consistent with the existing Pydantic model conventions and the PRD's minimal-identity scope for Company data. ✅
7. Database design (§10) supports required product functionality without creating decision-gated entities prematurely. ✅
8. Frontend/backend integration gaps are explicitly identified in §35. ✅
9. AI pipeline requirements are technically represented in §12–§16. ✅
10. RAG requirements are technically represented in §17. ✅
11. Error handling is defined in §25, including explicit flags where current behavior is unconfirmed. ✅
12. Testing (§31) covers frontend, backend, AI, RAG, and integration layers. ✅
13. Deployment requirements are addressed in §32, correctly marked TBD where platform-dependent. ✅
14. No unnecessary infrastructure introduced — no queues, no Redis, no Kubernetes, no GraphQL, no microservices (§4 Principle 6, §28, §29). ✅
15. Technical debt is explicitly documented and classified in §37. ✅

---

## 42. FINAL TRD SUMMARY

### Current Architecture
A React/Vite frontend and FastAPI backend, with a genuinely functional AI core (`/analyze`, `/ask`, ingestion, RAG) backed by PostgreSQL and ChromaDB, but with nearly all supporting product surface (company discovery, market data, news, watchlists) rendered from static frontend mock data with no backend behind it. No authentication, no deployment configuration, no database migration tooling.

### Target Architecture
The same AI core, preserved structurally, with two integrity fixes (Coordinator confidence handling, Copilot fallback labeling) and one required new capability (a real, minimal Company backend for discovery). Market data, news, watchlists, alternative-data integration, authentication, and deployment platform remain explicitly TBD, designed only far enough to avoid foreclosing future decisions.

### Major Technical Gaps
(1) No backend company data/search exists — blocks the entire discovery journey. (2) The Coordinator fabricates confidence rather than computing it genuinely — a trust-integrity defect requiring a direct code fix. (3) No persistence layer, migration tooling, or deployment configuration exists at all — foundational gaps that block any real (non-local) release regardless of which optional features are eventually approved.

### Critical Technical Decisions
Nine of the ten decisions in `PRD.md` §33 remain genuine product decisions this TRD does not resolve (auth, market data, news, alt-data, watchlists, deployment, and the overall MVP breadth they imply). This TRD does independently resolve three pure technical-scale judgments: retain synchronous processing (no job queue), use lightweight in-memory/DB caching only (no Redis), and introduce minimal database migration tooling.

### Recommended Implementation Sequence
Backend/data foundation and Company API first (Phases 1–3), since Company data is a prerequisite for both the discovery journey and any future watchlist work; AI pipeline integrity fixes in parallel (Phase 4); Copilot/error-handling UX next (Phase 5); testing (Phase 6); deployment foundation (Phase 7); gated feature phases (8–10) only once their respective product decisions are made.

### Highest-Risk Technical Areas
(1) The Coordinator confidence fix — must be verified not to silently reintroduce a different form of confidence fabrication. (2) Sentiment Debater transcript-URL hardening — external-site scraping is inherently fragile and may need ongoing maintenance regardless of the specific discovery mechanism chosen. (3) Whatever data source backs the initial curated company set — its quality directly determines whether the Fundamental Debater and ingestion pipeline actually work for the companies users can discover, making this a cross-cutting risk rather than an isolated one.

### TRD Confidence
- **High confidence**: Preservation of `/analyze`, `/ask`, Fundamental Debater, RAG pipeline, ingestion pipeline (all EXISTING and validated); the Coordinator confidence-fix scope; the Copilot fallback-labeling scope; the case against introducing queues/Redis/microservices at this scale.
- **Medium confidence**: Exact API contract details for `/analyze`/`/ask` error responses (current behavior undocumented in evidence, so the target design in §25 is a reasonable but not repository-confirmed specification); the Sentiment transcript-discovery hardening approach (directionally sound, specific mechanism not fully detailed); the `LLAMA_CLOUD_API_KEY`'s actual role (flagged UNKNOWN, needs direct repository verification).
- **Decision-dependent**: Market data, news, watchlists, authentication, alternative-data integration, and deployment platform — all architecturally scoped only to the extent needed to remain buildable once approved, per `PRD.md` §33 and preserved as TBD throughout this TRD.
