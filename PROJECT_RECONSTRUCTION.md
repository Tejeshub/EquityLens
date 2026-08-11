# PROJECT RECONSTRUCTION — EquityLens

**Purpose of this document**: Reconstruct, from existing evidence only, what EquityLens appears to be, what it does today, what it appears intended to do, and what remains unknown or requires a product decision. This document does **not** define requirements, a PRD, a TRD, or an implementation plan. It is the evidentiary foundation those later stages will build on.

**Sources of evidence**:
- `PROJECT_AUDIT.md` (Stage 1 — initial repository audit)
- `PROJECT_AUDIT_DEEP_DIVE.md` (Stage 1b — verification deep dive)

Where the two sources agree, both are cited. Where they disagree or one supersedes the other, this is called out explicitly in Section 0.

**Confidence legend** used throughout:
- **CONFIRMED** — directly supported by the audit evidence.
- **STRONGLY INFERRED** — not explicit, but well-supported by multiple pieces of evidence.
- **POSSIBLE** — plausible, but insufficient evidence to treat as intended.
- **UNKNOWN** — cannot be determined from available evidence.
- **PRODUCT DECISION REQUIRED** — not resolvable technically; needs an intentional decision.

---

## 0. DISCREPANCIES BETWEEN THE TWO AUDIT DOCUMENTS

The deep dive explicitly reconciles itself against the original audit in its own "Original Audit Verification" section. The material discrepancies are:

| Topic | `PROJECT_AUDIT.md` said | `PROJECT_AUDIT_DEEP_DIVE.md` found | Resolution used in this document |
|---|---|---|---|
| Debater completeness | Implied all three debaters (fundamental, sentiment, alternative) might be partially mocked ("some agents use mocks") | Fundamental and Sentiment debaters are fully functional, using real Postgres data, Exa search, and Firecrawl scraping. Only the Alternative debater is hardcoded/mocked. | Deep dive treated as authoritative (per instructions) — only `alt_debater.py` is mocked; fundamental and sentiment are real. |
| Watchlist backend status | "Complete UI, backend wiring unclear" | Confirmed: no models, no Postgres tables, no API endpoints. 100% React local state. | Deep dive's confirmed finding used — watchlists have zero backend presence, not merely "unclear." |
| Coordinator refinement | Not analyzed in detail | Refinement loop is not genuine LLM-based critique; it artificially increases confidence via `lc["confidence"] = min(current_conf + 20, 100)` | Deep dive's specific finding used — this is a demo/placeholder mechanism, not real refinement. |

No other direct contradictions were found. The deep dive is best read as a superset/correction of the first audit rather than a conflicting document — both agree on stack, absence of auth, and the general "mocked frontend / real AI backend" pattern. Where this reconstruction cites a claim found in only one document, that is noted inline.

---

## 1. EXECUTIVE PRODUCT RECONSTRUCTION

### What is EquityLens?

Based on the evidence, EquityLens is a web application consisting of a React/TypeScript frontend and a FastAPI/Python backend, built around a **multi-agent AI equity research pipeline**. A user can submit a company and receive an AI-generated research scorecard produced by three "debater" agents (fundamental, sentiment, alternative-data) whose outputs are synthesized by a coordinator agent, plus a document-grounded Q&A ("Copilot") feature backed by a RAG pipeline over ingested investor-relations PDFs. *(CONFIRMED — `PROJECT_AUDIT.md` Parts 3, 5, 15; `PROJECT_AUDIT_DEEP_DIVE.md` Sections 2, 4, 5, 6)*

The application's central, genuinely functional capability is this AI research pipeline: it scrapes real financial data (Screener.in), runs live LLM calls (Grok, Gemini), performs real news search (Exa) and document scraping (Firecrawl), stores structured data in PostgreSQL and semantic chunks in ChromaDB, and returns a synthesized, cited analysis. *(CONFIRMED)*

What is distinctive about the current implementation is the sharp split between this AI core and everything else. The application presents itself visually as a complete SaaS-style research dashboard (landing page with company movers, company detail pages with charts/news/financials, watchlist management), but nearly all of that surrounding "dashboard" experience — company identity, prices, candlestick charts, news, and watchlists — is sourced entirely from a static local file (`dummyData.ts`), not from any backend or database. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` Sections 2, 3, 9, 13)*

EquityLens is **not**, as currently implemented, a standard CRUD-backed SaaS product. It is an AI research engine with a mocked application shell around it. *(CONFIRMED per deep dive Section 20: "What We Can Confidently Say")*

---

## 2. PRODUCT PURPOSE

### Problem
The implementation appears designed to address the effort of manual equity research — pulling financial fundamentals, reading sentiment/news signals, and synthesizing a view on a company. The multi-agent "debate" structure (fundamental vs. sentiment vs. alternative-data agents, reconciled by a coordinator) suggests the problem being solved is **producing a synthesized, multi-perspective research view of a company faster than manual analysis would allow**. *(STRONGLY INFERRED — based on agent naming and pipeline structure in `PROJECT_AUDIT.md` Part 5, `PROJECT_AUDIT_DEEP_DIVE.md` Section 6)*

### Solution
The existing implementation attempts this by: (1) scraping structured financials for a named company, (2) ingesting available investor-relations documents into a vector store, (3) running three specialized LLM-driven agents in parallel against different evidence types, (4) having a coordinator agent merge their outputs into a scored, reasoned output, and (5) allowing follow-up natural-language questions answered via retrieval-augmented generation over the ingested documents. *(CONFIRMED — `PROJECT_AUDIT.md` Part 5.1, Part 16; `PROJECT_AUDIT_DEEP_DIVE.md` Sections 4, 5, 6, 11)*

### Core value
The core value appears to be a single generated **scorecard with dimensioned reasoning and evidence** (per-dimension score, confidence, evidence, agent reasoning) plus a **chat interface to interrogate that analysis with citations**. *(CONFIRMED — `PROJECT_AUDIT.md` Part 5.3 models; `PROJECT_AUDIT_DEEP_DIVE.md` Section 4 response fields)*

What is **not** established as core value: real-time pricing, portfolio tracking, or watchlist-based monitoring — these exist as UI surface area but are not backed by working data or persistence. *(CONFIRMED — see Section 4/9 below)*

---

## 3. TARGET USERS

| Candidate Audience | Confidence | Evidence |
|---|---|---|
| Equity researchers / financial analysts | STRONGLY INFERRED | Domain terminology throughout (fundamental/sentiment/alternative "debaters," scorecards, guidance tracking, peer comparison, ROE/ROCE/P/E fields in mock `Company` data) suggests an audience familiar with equity research vocabulary. `PROJECT_AUDIT.md` Part 19 and `PROJECT_AUDIT_DEEP_DIVE.md` Section 20 both independently describe the product as a research/analysis tool. |
| Individual investors | POSSIBLE | The dashboard-style landing page ("Top Gainers"/"Top Losers"), simple search, and watchlist concept resemble consumer investing-app UX patterns, which could target retail investors. But this is inferred from UI shape alone, not from any stated audience. |
| Users focused on Indian equities specifically | STRONGLY INFERRED | Data source is Screener.in (an Indian equity data site), and `PROJECT_AUDIT.md` Part 18 states the app description in `main.py` references Indian equities. |
| Portfolio managers | UNKNOWN | No portfolio-construction, allocation, or multi-asset tracking features found in either audit. |
| Students/academic researchers | POSSIBLE | Consistent with the "proof-of-concept" framing in `PROJECT_AUDIT_DEEP_DIVE.md` Section 16 ("Inferences") and Section 20, but no direct evidence (e.g., no academic branding, licensing, or citations found) supports this over a professional-tool interpretation. |

No audit evidence directly states an intended audience (e.g., no persona docs, marketing copy, or onboarding flow were found). All audience conclusions above are inferential.

---

## 4. CORE PRODUCT CAPABILITIES

| Capability | Evidence | Current Status | Confidence | Product Interpretation |
|---|---|---|---|---|
| Company search | `SearchBar.tsx`, consumes `dummyData.ts` (`PROJECT_AUDIT_DEEP_DIVE.md` §2) | UI exists; backed by static mock list only | CONFIRMED (as UI); MOCK (as data) | Intended capability, but no real company index exists yet |
| Company analysis (multi-agent) | `POST /analyze`, `agents/` (`PROJECT_AUDIT.md` §5.1; `PROJECT_AUDIT_DEEP_DIVE.md` §4, §6) | Functional end-to-end | CONFIRMED | Central, working capability |
| Fundamental analysis | `fundamental_debater.py`, pulls real Postgres metrics (`PROJECT_AUDIT_DEEP_DIVE.md` §6) | Functional, real data | CONFIRMED | Core capability |
| Sentiment analysis | `sentiment_debater.py`, Exa + Firecrawl (`PROJECT_AUDIT_DEEP_DIVE.md` §6) | Functional, real data (transcript scrape URL is a "generalized guess," per §6) | CONFIRMED, with a caveat | Core capability, some fragility in transcript sourcing |
| Alternative-data analysis | `alt_debater.py` (`PROJECT_AUDIT.md` §13, §14; `PROJECT_AUDIT_DEEP_DIVE.md` §7) | Hardcoded mock values (`jobs_count=15`, `traffic_rank=5000`) | CONFIRMED as mocked | Intended capability, not yet implemented with real data |
| Multi-agent debate/coordination | `coordinator.py` (`PROJECT_AUDIT_DEEP_DIVE.md` §6, §7) | Functional structurally, but refinement step is a placeholder (artificial confidence bump, not genuine critique) | CONFIRMED | Core mechanism, partially demo-quality |
| AI scorecard | `Scorecard`, `ScoreDimension` models (`PROJECT_AUDIT.md` §5.3; `PROJECT_AUDIT_DEEP_DIVE.md` §4) | Functional, returned by `/analyze` | CONFIRMED | Core deliverable of the product |
| RAG / document Q&A | `POST /ask`, `rag/pipeline.py` (`PROJECT_AUDIT.md` §5.1; `PROJECT_AUDIT_DEEP_DIVE.md` §5, §11) | Fully functional, with fallback QA agent | CONFIRMED | Core, working capability |
| Financial data (structured) | `financials_quarterly` table, Screener scraper (`PROJECT_AUDIT.md` §6; `PROJECT_AUDIT_DEEP_DIVE.md` §10) | Real, backend-populated | CONFIRMED | Working supporting infrastructure |
| Company information (identity/profile) | `dummyData.ts` (`PROJECT_AUDIT_DEEP_DIVE.md` §2, §9) | Entirely mocked, no backend table | CONFIRMED as mocked | Strongly implied as needed, not yet built |
| Market data (price/candlestick) | `dummyData.ts`, mathematically generated candlesticks (`PROJECT_AUDIT_DEEP_DIVE.md` §3, §9) | Entirely mocked | CONFIRMED as mocked | Strongly implied as needed, no vendor chosen |
| News | `dummyData.ts` (`PROJECT_AUDIT_DEEP_DIVE.md` §2, §9) | Entirely mocked (note: sentiment debater does use real Exa news search internally, but the frontend "News" feed is separate and mocked) | CONFIRMED as mocked | Strongly implied as needed |
| Watchlists (CRUD) | `WatchlistsPage.tsx`, React state only (`PROJECT_AUDIT_DEEP_DIVE.md` §8) | UI-only, no persistence, no backend, no DB tables | CONFIRMED | UI strongly suggests intended feature; backend entirely absent |
| Watchlist comparison/analysis | `WatchlistAnalysis.tsx` (`PROJECT_AUDIT_DEEP_DIVE.md` §2) | UI-only, mocked data | CONFIRMED as mocked | Implied extension of watchlists, not functional |
| PDF/document ingestion | `ingestion_agent.py` (`PROJECT_AUDIT.md` §5.2, §15; `PROJECT_AUDIT_DEEP_DIVE.md` §6, §11) | Functional (described as "demo implementation" of metric extraction via regex, §6) | CONFIRMED, with acknowledged simplicity | Core supporting capability for RAG |
| Peer comparison | `PeerComparison` model, `compare_companies`, used in frontend (`PROJECT_AUDIT.md` §5.3; `PROJECT_AUDIT_DEEP_DIVE.md` §4) | Present in API response and consumed by frontend | CONFIRMED | Real, working sub-feature of `/analyze` |
| Guidance tracking | `GuidanceEntry` model, `guidance_entries` table (`PROJECT_AUDIT.md` §5.3, §6) | Backend model and table exist | STRONGLY INFERRED as functional (not traced end-to-end in either audit) | Likely real, not independently verified in the deep dive |

---

## 5. CORE PRODUCT LOOP

### Primary user journey
Reconstructed from `PROJECT_AUDIT.md` Part 16 and `PROJECT_AUDIT_DEEP_DIVE.md` Section 4 trace:

```text
User opens landing page (mocked company list)
↓
Selects or searches a company (mocked list)
↓
Lands on Company Detail page
↓
Frontend triggers POST /analyze automatically (useAnalyze hook)
↓
Backend scrapes Screener + ingests IR PDFs
↓
Fundamental, Sentiment, Alternative debaters run in parallel
↓
Coordinator merges outputs into a scorecard (with placeholder refinement step)
↓
Frontend renders AI Report tabs, dimension scores, reasoning panel
↓
User opens Copilot Sidebar and asks a question
↓
POST /ask → RAG retrieval over ChromaDB → LLM answer with citations (or fallback QA agent)
```
CONFIRMED — directly traced in both documents.

### Secondary user journeys
- **Watchlist creation and browsing** — CONFIRMED to exist as a UI-only flow (create/add/remove/delete), entirely client-side, non-persistent (lost on refresh, not verified but implied by "React local state" per `PROJECT_AUDIT_DEEP_DIVE.md` §8).
- **Watchlist comparative analysis** — same status, UI-only, mocked comparison data.

### Optional/uncertain journeys
- Health-check consumption (`GET /health`) — exists but has **no frontend consumer at all** (`PROJECT_AUDIT_DEEP_DIVE.md` §12), so it is not part of any user journey; likely an operational/monitoring endpoint only.

---

## 6. DETAILED USER FLOWS

### Flow A — Company discovery
**Search → company selection → company page**
- Confirmed steps: SearchBar UI exists; Index page lists companies; clicking navigates to `/company/:id`. *(CONFIRMED — `PROJECT_AUDIT.md` §3.1, §3.4)*
- Mocked steps: The entire company list, and thus the entire discovery flow, is powered by `dummyData.ts`, not a real company index or search backend. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §2, §3)*
- Missing steps: No backend company search/index endpoint exists at all. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §13 gap matrix)*

### Flow B — Company analysis
**Company → `/analyze` → agents → coordinator → scorecard**
- Confirmed steps: Full trace exists and is functional, per Section 5 above.
- Inferred steps: The "genuine refinement loop" implied by the presence of `debate_refinement_threshold` as a request parameter appears intended but is not truly implemented — it is a stand-in confidence bump. *(CONFIRMED as placeholder — `PROJECT_AUDIT_DEEP_DIVE.md` §7)*
- Backend dependencies: PostgreSQL (`financials_quarterly`), ChromaDB (`equity_chunks`), Grok/Gemini APIs, Exa, Firecrawl, Screener.in scraping.

### Flow C — AI Copilot
**Question → `/ask` → RAG → retrieval → LLM → answer/citations**
- Confirmed steps: Fully traced and functional, including a fallback path (generic QA agent via Grok) when retrieval returns zero chunks. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §5)*
- No mocked steps identified in this flow — it is described as "GENUINELY FUNCTIONAL" in the deep dive.

### Flow D — Watchlists
**Create → add companies → view → remove/delete → analysis**
- Confirmed steps: All actions exist in the frontend UI. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §8)*
- Missing steps: No backend models, no database tables, no API endpoints of any kind. State lives only in React `useState` and is lost on reload (implied by "React local state," not explicitly tested/confirmed in either audit — treated as STRONGLY INFERRED for the reload-loss behavior specifically, CONFIRMED for the absence of backend persistence).
- Mocked steps: Initial watchlist data seeded from `dummyData.ts`.

### Flow E — Document/RAG ingestion
**Document → parsing → chunking → embeddings → ChromaDB → retrieval**
- Confirmed steps: `ingestion_agent.py` scrapes IR PDFs, `PdfReader` parses them, chunks are embedded via `all-MiniLM-L6-v2` (SentenceTransformers) and stored in ChromaDB's `equity_chunks` collection, retrieved via `search_chunks`. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §11)*
- Caveat: Metric extraction from parsed PDFs uses regex and is explicitly described as a "demo implementation." *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §6)*

---

## 7. FEATURE INVENTORY — PRODUCT VIEW

| Feature | Exists in UI | Exists in Backend | Persisted | Functional | Mocked | Confidence | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| Multi-agent AI analysis | Yes | Yes | Yes (Postgres/Chroma) | Yes (mostly) | Partially (alt debater, coordinator refinement) | CONFIRMED | Core working feature |
| RAG Q&A / Copilot | Yes | Yes | Yes (Chroma) | Yes | No | CONFIRMED | Fully functional |
| Company landing/dashboard data | Yes | No | No | No | Yes | CONFIRMED | 100% `dummyData.ts` |
| Company search | Yes | No | No | No | Yes | CONFIRMED | Searches only the mock list |
| Market/price/candlestick data | Yes | No | No | No | Yes | CONFIRMED | Candlesticks are mathematically generated, not real |
| News feed | Yes | No | No | No | Yes | CONFIRMED | Distinct from Sentiment debater's real Exa news use |
| Watchlist management | Yes | No | No | No | Yes | CONFIRMED | Zero backend presence |
| Watchlist analysis | Yes | No | No | No | Yes | CONFIRMED | Zero backend presence |
| Peer comparison | Yes | Yes | Partially (via analyze response) | Yes | No | CONFIRMED | Delivered through `/analyze` |
| Guidance tracking | Unclear (not directly traced in frontend) | Yes (model + table) | Yes | STRONGLY INFERRED | Unknown | STRONGLY INFERRED | Backend structure exists; frontend consumption not confirmed in either audit |
| Authentication | No | No | No | No | N/A | CONFIRMED | Entirely absent, both audits agree |
| Health check | N/A (no UI) | Yes | N/A | Yes | No | CONFIRMED | No frontend consumer found |

### Existing functionality
Multi-agent `/analyze` pipeline, `/ask` RAG pipeline, PDF ingestion into ChromaDB, structured financial scraping into PostgreSQL, peer comparison as part of the analyze response.

### Strongly implied functionality
A real company master list/index (implied by search and dashboard UI expecting one), real market data integration (implied by chart/price UI), persistent watchlists (implied by full CRUD UI), a real news feed (implied by dedicated News UI distinct from the Sentiment debater's internal use of news).

### Possible functionality
User accounts/authentication (no UI or backend evidence exists for this at all — its "possibility" rests solely on the general expectation that a SaaS-shaped product would eventually need it, not on any artifact in the repo).

---

## 8. FRONTEND PRODUCT RECONSTRUCTION

The frontend presents itself as a complete equity-research SaaS dashboard: a landing/dashboard page (top gainers/losers, search), a per-company detail page (candlestick chart, news feed, financial table, AI report, reasoning drill-down, Copilot sidebar), and watchlist management pages. *(CONFIRMED — `PROJECT_AUDIT.md` §3.1; `PROJECT_AUDIT_DEEP_DIVE.md` §2)*

### Real backend-backed functionality
- AI Analysis Results tab / Scorecard rendering (from `/analyze`)
- Reasoning Panel drill-down (from `/analyze` → `reasoning` field)
- Copilot Sidebar chat (from `/ask`)

*(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §4 "Frontend Usage Matrix," §5)*

### Mock/demo presentation
- Landing page company list, prices, gainers/losers
- Company identity, current/historical price, candlestick charts
- News feed
- Watchlists (creation, membership, comparison)
- Search (searches only the mock list)

*(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §2, §3, §9, §13 gap matrix)*

This split is explicit and load-bearing evidence in the deep dive: "Only the 'Analysis Results' tab and Copilot utilize the `/analyze` data. The top-level pricing, company name, news, and stock charts are still rendered exclusively from `dummyData.ts`." *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §4)*

---

## 9. BACKEND PRODUCT RECONSTRUCTION

The backend's actual product purpose, based on the evidence, is narrower than the frontend implies: it is an **AI orchestration and research-generation service**, not a general application backend. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §15: "The backend is primarily a highly-specialized AI orchestration layer, not a standard CRUD backend.")*

- **Ingestion** (`ingestion_agent.py`): discovers and downloads investor-relations PDFs, extracts metrics via regex (demo-quality), embeds content for retrieval. Its product purpose is to feed both the Fundamental debater and the RAG pipeline with source material.
- **Financial data retrieval** (`scraper.py`, `transcript_scraper.py`): pulls structured financials from Screener.in and transcripts, populating PostgreSQL. Its purpose is to ground the Fundamental debater in real numbers rather than LLM guesswork.
- **Fundamental debater**: purpose is to argue a company's investment case from real financial ratios (`revenue`, `pat`, `roce`, `debt_equity`).
- **Sentiment debater**: purpose is to argue from qualitative/market-perception evidence (real news via Exa, transcript scraping via Firecrawl).
- **Alternative debater**: purpose is intended to be to argue from non-traditional signals (hiring, web traffic), but currently cannot fulfill this purpose because its inputs are hardcoded constants.
- **Coordinator**: purpose is to reconcile the three debaters into one scorecard and, ostensibly, to push back on low-confidence conclusions via refinement — a purpose it does not yet genuinely fulfill (see Section 10).
- **RAG/Q&A**: purpose is to let a user ask free-form questions grounded in the same ingested documents, with citations, independent of the debate pipeline.

Collectively, these components support one coherent product function — generating and explaining an AI equity research view — while the backend does **not** support the CRUD/data-serving functions (company lists, prices, watchlists) that the frontend visually implies exist. *(CONFIRMED, synthesized from both documents)*

---

## 10. AI PRODUCT BEHAVIOR

### Fundamental analysis
Uses real structured data pulled from PostgreSQL (`revenue`, `pat`, `roce`, `debt_equity`) via a `verify_metric` mechanism, reasoned over by Grok. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §6)*

### Sentiment analysis
Uses real external evidence: Exa for news search, Firecrawl for transcript scraping — though the deep dive notes the scrape target URL is "a generalized guess," implying some fragility/incompleteness in how transcripts are located. *(CONFIRMED, with caveat — `PROJECT_AUDIT_DEEP_DIVE.md` §6)*

### Alternative data
Currently uses **only** hardcoded constants (`jobs_count = 15`, `traffic_rank = 5000`) regardless of the company being analyzed. No real alternative-data vendor is integrated. *(CONFIRMED — `PROJECT_AUDIT.md` §13/§14; `PROJECT_AUDIT_DEEP_DIVE.md` §7)*

### Coordinator
Combines the three debaters' outputs into one scorecard. It checks whether confidence is below a configurable threshold and is *structured* to trigger a refinement step in that case — but the refinement step does not perform genuine LLM-based critique or re-evaluation. It instead directly increments the stored confidence value by a fixed amount, capped at 100 (`lc["confidence"] = min(current_conf + 20, 100)`). *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §7, §16)*

### Confidence/refinement — explicit caution
This refinement behavior **must not** be described as a complete or genuine intelligent refinement system. As the deep dive states directly, this is a demo-purposed placeholder, not a working critique loop. Any product reconstruction or future requirement referencing "refinement" should treat the *existence* of a refinement mechanism as CONFIRMED, but its *genuineness* as CONFIRMED-NOT-REAL (i.e., confirmed to be a placeholder, not merely unverified).

---

## 11. RAG PRODUCT BEHAVIOR

- **What can the user ask?** Free-form questions about a company, submitted via the Copilot Sidebar. The request model (`AskRequest`) accepts `question`, `company`, and `top_k`, implying the user can (at minimum) scope a question to a specific company and the system controls how many chunks are retrieved. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §5)*
- **What context is used?** Chunks retrieved from the `equity_chunks` ChromaDB collection, built from ingested investor-relations PDFs (and possibly Screener table content, per the ingestion trace in §11 of the deep dive, which references both `PdfReader` and a "Screener table" source via `chroma_tools.py`).
- **What documents are involved?** Investor-relations PDFs discovered/downloaded by the ingestion agent. *(CONFIRMED)*
- **How are citations presented?** The `AskResponse` model includes `citations` and `retrieved_chunks` fields; the audits confirm these exist in the contract but do not describe the frontend's exact visual citation treatment. *(CONFIRMED that citations exist in the API; UNKNOWN exactly how they render)*
- **What happens when retrieval fails?** If zero chunks are retrieved, the RAG call raises, and the route catches this to invoke a fallback: a generic QA agent (`answer_with_citations`) using Grok instead of the RAG-grounded Gemini path. The response includes a `fallback_used` flag. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §5)*
- **What is the fallback behavior, technically?** Same LLM-answer shape, but without document grounding — Grok answers generally rather than from retrieved chunks.
- **What company context appears to be used?** The `company` field on `AskRequest` suggests answers are scoped per-company, consistent with the per-company ingestion/analysis flow, though whether this filters the ChromaDB query or is used only for prompt framing is not detailed in either audit. *(STRONGLY INFERRED scoping; UNKNOWN implementation mechanics)*

---

## 12. DATA MODEL — PRODUCT PERSPECTIVE

| Entity | Existing in Code | Existing Only in Frontend Mock | Strongly Implied | Unknown |
|---|---|---|---|---|
| Company (analysis subject) | `CompanyInput` model (backend, minimal) | Full `Company` shape (id, ticker, price, ROE, etc.) only in `dummyData.ts` | A unified "Company" entity combining both is strongly implied as the product target | — |
| Financial Metric / Quarterly Financial | `financials_quarterly` table | — | — | — |
| News Item | — | `NewsItem` type in `dummyData.ts` only | A backend-sourced news entity is strongly implied by dedicated UI | — |
| Guidance Entry | `GuidanceEntry` model, `guidance_entries` table | — | — | Whether frontend actually renders this — unknown |
| Research Scorecard | `Scorecard`, `ScoreDimension` models | — | — | — |
| Agent Message | `AgentMessage` model | — | — | — |
| Document (raw) | `raw_documents` table | — | — | — |
| Retrieved Chunk | `RetrievedChunk` model, `equity_chunks` Chroma collection | — | — | — |
| Watchlist | — | `Watchlist` type in `dummyData.ts`, React state only | Backend `watchlists`/`watchlist_items` tables strongly implied by full CRUD UI | — |
| Watchlist Item | — | Implied by `companies` array field on mock `Watchlist` | Same as above | — |
| User | — | — | — | No evidence at all — not even a frontend mock. Fully UNKNOWN. |
| Peer Comparison | `PeerComparison` model | — | — | — |
| Candlestick Point | — | `CandlestickPoint` type, mathematically generated in `dummyData.ts` | A real price-history entity strongly implied | — |

---

## 13. CURRENT PRODUCT STATE

### Working
- `POST /analyze` end-to-end pipeline (scraping → ingestion → 3 debaters → coordinator → scorecard).
- `POST /ask` RAG pipeline with fallback.
- Fundamental and Sentiment debaters using real data sources.
- PDF ingestion into ChromaDB.
- Peer comparison as delivered through `/analyze`.

*(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §20)*

### Partially Working
- Coordinator's refinement/confidence mechanism (structurally present, not genuinely intelligent).
- Sentiment debater's transcript sourcing (real, but URL-guessing introduces fragility).
- Ingestion agent's metric extraction (functional but regex-based, described as "demo implementation").

### Mocked
- Landing/dashboard company data, prices, movers.
- Company identity/profile data on the detail page.
- Candlestick/historical price charts.
- News feed.
- All watchlist data and behavior.
- Alternative-data debater inputs (`jobs_count`, `traffic_rank`).

### Missing
- Authentication and user management (entirely absent).
- Watchlist backend (models, tables, endpoints — all absent).
- Company master database/index.
- Historical/real-time market data pipeline.
- Real alternative-data vendor integration.

### Broken/Suspicious
- No hard runtime errors identified in either audit. The primary "suspicious" finding is architectural: a fully-featured-looking frontend sitting atop a backend that only serves two of its many implied data needs. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §20: "Nothing is explicitly throwing errors, but the architecture is disjointed.")*

### Disconnected
- Company search, pricing, charts, news, and watchlists all exist in the frontend with zero corresponding backend support — the deep dive's gap matrix (§13) confirms "NO" across Backend/DB/API/Connected columns for each of these.

---

## 14. THE "BRAIN VS BODY" MODEL

This framing originates directly in the deep dive's executive summary and final findings and is used here as an architectural/product reconstruction concept, not as marketing language.

### Brain
The functioning AI research engine: the scraping pipeline, the three debater agents, the coordinator, and the RAG/Q&A system. This is described in the deep dive as genuinely sophisticated and functionally real — live scraping, live LLM calls, real retrieval. *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §1, §20)*

### Body
The surrounding application infrastructure a user would expect from a research dashboard: company identity and listing, pricing and charts, news, watchlists, and (by implication) accounts. This layer is, per the evidence, "entirely simulated." *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §1, §20)*

### Consequences of this imbalance
- A user cannot currently use EquityLens for anything except: analyzing one company at a time via `/analyze`, and asking questions about it via `/ask`. Every other visible feature (browsing companies, tracking prices, managing watchlists) is non-functional beyond the visual layer.
- The apparent breadth of the product (dashboard, watchlists, charts) does not reflect the actual breadth of what has been built — this is the central risk a PRD/TRD stage will need to resolve: whether to build out the "body" to match the "brain," or to scope the product down to what the brain already does well.
- Any completion-percentage read of the project purely from the frontend would be misleading; the frontend looks far more complete than the backend that would need to support it.

---

## 15. WHAT THE PROJECT APPEARS TO HAVE BEEN BUILT FOR

### Most likely interpretation
A **proof-of-concept for the AI research architecture**, with a frontend built to visually demonstrate what a full product built around that architecture could look like.

### Evidence
- The deep dive states this directly as an inference: "The project was likely a proof-of-concept for the AI architecture, with the frontend wrapped around it to make it look like a complete SaaS product." *(`PROJECT_AUDIT_DEEP_DIVE.md` §16)*
- No deployment configuration exists (no Docker, no CI/CD, no hosting config) in either audit — inconsistent with a project that had reached production-readiness intent, consistent with a PoC/demo stage. *(CONFIRMED — `PROJECT_AUDIT.md` §12; `PROJECT_AUDIT_DEEP_DIVE.md` §17)*
- No authentication exists anywhere, which is unusual for an intended multi-user SaaS product but consistent with a single-developer PoC or personal/local tool. *(CONFIRMED)*
- The AI backend received disproportionate engineering investment relative to standard product infrastructure (no company DB, no watchlist DB, no market-data integration), suggesting the AI pipeline was the actual focus of development effort.

### Confidence
STRONGLY INFERRED. This is the audit authors' own explicit inference, corroborated by multiple independent structural signals (no deployment config, no auth, mock-heavy frontend, disproportionate backend investment in AI vs. CRUD).

### Alternative interpretations
- **Early-stage SaaS product**, where the frontend was intentionally built ahead of backend infrastructure as a common (if imbalanced) development sequencing choice. Plausible but not distinguishable from the PoC interpretation using current evidence.
- **Academic/hackathon project**, plausible given the scope and unevenness, but no direct evidence (institution references, competition artifacts, README framing) was reported in either audit to support this specifically over general PoC framing.
- **Personal tool**, plausible given single-user assumptions implied by lack of auth, but equally explainable by early-stage SaaS development where auth simply hasn't been built yet.

None of these alternatives can be ruled in or out with current evidence; they are listed as PRODUCT DECISION REQUIRED-adjacent framing questions for the next stage, not resolved conclusions.

---

## 16. WHAT WE CANNOT KNOW FROM THE CODE

- Was this intended as a single-user or multi-user application? *(No auth exists in either direction — UNKNOWN)*
- Was authentication planned but simply not yet built, or intentionally deferred/out of scope? *(UNKNOWN)*
- Was the product intended for production deployment, given the total absence of deployment configuration? *(UNKNOWN — `PROJECT_AUDIT.md` §12, `PROJECT_AUDIT_DEEP_DIVE.md` §17 both flag this as unresolved)*
- What market-data provider was intended to replace the mocked prices/candlesticks? *(UNKNOWN — both audits raise this as an open question, `PROJECT_AUDIT.md` §18, `PROJECT_AUDIT_DEEP_DIVE.md` §18)*
- Was the alternative-data agent supposed to eventually use real providers (e.g., SimilarWeb, LinkedIn), or was it a placeholder for a feature that might be cut? *(UNKNOWN — deep dive §18 poses this directly as an open question)*
- Was watchlist persistence intended from the start, or added to the frontend ahead of backend planning? *(UNKNOWN — no backend artifacts exist to infer intent from)*
- What was the monetization/business model, if any? *(No evidence in either audit — UNKNOWN)*
- What was the intended MVP scope — i.e., was the AI pipeline meant to be the entire MVP, with the dashboard shell as future work, or was full dashboard parity considered part of MVP? *(UNKNOWN)*
- Were some frontend modules (e.g., `WatchlistAnalysis.tsx`) built as throwaway prototypes rather than intended production surfaces? *(UNKNOWN — cannot be distinguished from intended-but-unfinished work using code evidence alone)*

---

## 17. PRODUCT DECISIONS REQUIRED

| Decision | Why It Matters | Evidence We Have | What We Still Don't Know |
|---|---|---|---|
| Single-user local tool vs. multi-user SaaS | Determines whether auth, per-user data isolation, and hosting need to be built at all | No auth exists anywhere; deep dive raises this explicitly (§18 Q1) | Original intent behind the omission |
| Authentication/user management approach | Blocks any real watchlist/user-state persistence design | Zero evidence of any auth mechanism, planned or partial | Whether auth was ever scoped, and if so, by what mechanism (custom, Auth0, Clerk, etc. — none referenced anywhere in either audit) |
| Market data provider selection | Blocks replacing mocked prices/charts with real data | `dummyData.ts` fully mocks this; deep dive explicitly flags provider choice as undecided (§18 Q2) | Which vendor, cost tolerance, refresh frequency |
| Whether to build real alternative-data integration or remove the Alt Debater | Affects both product scope and AI pipeline design | `alt_debater.py` is fully hardcoded; deep dive explicitly poses this as an open question (§18 Q3) | Whether alternative-data analysis is core to the value proposition or a nice-to-have |
| Watchlist persistence and backend build-out | Currently 100% non-functional beyond a single browser session | Full CRUD UI exists with zero backend; confirmed in both audits | Whether this is core scope or should be descoped/simplified |
| News feed sourcing | Currently fully mocked despite dedicated UI | `dummyData.ts` news vs. Sentiment debater's separate real Exa usage | Whether a real news feed is core scope, or whether the Sentiment debater's internal news use is sufficient and the dedicated News UI should be reconsidered |
| Company master data / search backend | Search and dashboard currently only operate over the mock list | No company table, no search endpoint (deep dive §10, §13) | Whether this needs to be a licensed data feed, self-maintained index, or scraped-on-demand |
| Deployment model | No Docker/CI/CD exists at all | Confirmed absence in both audits | Target environment, hosting, scaling needs |
| Coordinator refinement — genuine vs. placeholder | Currently a demo stand-in that inflates confidence artificially | Exact code behavior confirmed in deep dive §7 | Whether genuine LLM-based refinement was the original intent or whether the current always-approve behavior is acceptable |

---

## 18. PRODUCT SCOPE RECONSTRUCTION

### CORE
- Multi-agent company analysis (`/analyze`): fundamental + sentiment debaters, coordinator, scorecard.
- RAG-based Copilot Q&A (`/ask`), including its fallback path.
- PDF/document ingestion feeding both the Fundamental debater and RAG.
- Peer comparison as delivered through `/analyze`.

*(These are CORE because they are the only features that are both functionally real and central to the product's stated evidence-based purpose.)*

### SUPPORTING
- Company detail page framing around the AI report (tabs, reasoning panel) — supports the core AI experience even though it's UI-only scaffolding.
- Guidance tracking (backend model/table exist, consumption unconfirmed) — supports the fundamental analysis narrative but its actual role is not fully verified.

### UNCERTAIN / FUTURE
- Alternative-data analysis (exists structurally, but its data is entirely fake — its product importance is unclear until Decision Required #4 above is resolved).
- Landing/dashboard browsing experience (movers, mocked prices).
- Company search over a real index.
- Real market data/candlestick charts.
- Real news feed.
- Watchlist management and watchlist analysis (fully UI-only today).
- Authentication/user accounts.

---

## 19. REQUIREMENT CANDIDATES

These are extracted from evidence only and are **not** finalized requirements — they are inputs for the next (PRD) stage.

| ID | Candidate Requirement | Evidence | Confidence | Current Status |
|---|---|---|---|---|
| RC-001 | User can submit a company for AI-powered multi-agent research analysis. | `POST /analyze`, full pipeline trace | CONFIRMED | Working |
| RC-002 | System returns a scored, dimensioned scorecard with reasoning and evidence per dimension. | `Scorecard`, `ScoreDimension`, `AgentMessage` models | CONFIRMED | Working |
| RC-003 | User can ask free-form follow-up questions about a company and receive a cited, document-grounded answer. | `POST /ask`, RAG trace | CONFIRMED | Working |
| RC-004 | System falls back to a non-grounded answer when retrieval yields no results. | `fallback_used` flag, fallback QA agent | CONFIRMED | Working |
| RC-005 | System ingests investor-relations documents and makes them available for retrieval and fundamental analysis. | `ingestion_agent.py`, ChromaDB, `raw_documents` | CONFIRMED | Working (demo-quality extraction) |
| RC-006 | System provides peer comparison data alongside a company's analysis. | `PeerComparison` model, response field, frontend consumer | CONFIRMED | Working |
| RC-007 | User can browse a list/dashboard of companies with current price and movement data. | `Index.tsx`, `dummyData.ts` | INFERRED (frontend intent) | Mocked, not backed |
| RC-008 | User can search for a company by name/ticker/sector. | `SearchBar.tsx` | INFERRED | Mocked, not backed |
| RC-009 | User can view historical price/candlestick charts for a company. | `CandlestickChart.tsx`, mock generator | INFERRED | Mocked, not backed |
| RC-010 | User can view a news feed for a company. | `NewsFeed.tsx`, `dummyData.ts` | INFERRED | Mocked, not backed |
| RC-011 | User can create, view, and delete watchlists and add/remove companies from them. | `WatchlistsPage.tsx` full CRUD UI | INFERRED | UI-only, no persistence |
| RC-012 | User can view a comparative analysis across companies in a watchlist. | `WatchlistAnalysis.tsx` | INFERRED | UI-only, mocked |
| RC-013 | System analyzes alternative data (hiring, web traffic) as part of company research. | `alt_debater.py` | POSSIBLE | Hardcoded/fake, real intent unconfirmed |
| RC-014 | System performs genuine LLM-based refinement when analysis confidence is low. | `coordinator.py` refinement branch | POSSIBLE | Structurally present, not genuinely implemented |
| RC-015 | System supports user accounts and authenticated, per-user data. | None found in code | PRODUCT DECISION REQUIRED | Not present in any form |
| RC-016 | System sources real-time or periodically updated market data from an external provider. | None found in code; explicitly flagged as unknown in both audits | PRODUCT DECISION REQUIRED | Not present |

### Confirmed requirement candidates
RC-001, RC-002, RC-003, RC-004, RC-005, RC-006

### Inferred requirement candidates
RC-007, RC-008, RC-009, RC-010, RC-011, RC-012

### Possible requirement candidates
RC-013, RC-014

### Product decisions required before becoming requirements
RC-015, RC-016 (and, by extension, whether RC-011/RC-012 can become real requirements depends on the auth/persistence decisions in Section 17)

---

# PRD INPUT PACKAGE

## Product Definition
EquityLens is a multi-agent AI equity research system with a working backend pipeline (`/analyze`, `/ask`) that scrapes real financial data, runs specialized LLM "debater" agents, synthesizes a scored research output, and answers grounded follow-up questions via RAG. It is currently wrapped in a frontend that visually presents a fuller SaaS-style research dashboard (company browsing, pricing/charts, news, watchlists), but that surrounding layer is presently mocked and non-functional beyond the two core AI endpoints.

## Target User
Best supported: an equity researcher or financial analyst, likely focused on Indian equities (given Screener.in as the data source). Individual-investor framing is plausible from the UI shape but not independently confirmed. Treat audience as STRONGLY INFERRED, not CONFIRMED.

## Problem
Manual equity research — gathering fundamentals, sentiment, and alternative signals, then synthesizing a view — is time-consuming. EquityLens attempts to automate the synthesis step using parallel AI "debater" agents reconciled by a coordinator.

## Core Value Proposition
A synthesized, evidence-backed, per-dimension research scorecard for a company, plus the ability to interrogate that research conversationally with citations.

## Core Features
Prioritized by evidence strength:
1. Multi-agent company analysis (`/analyze`) — CONFIRMED, working
2. RAG Copilot Q&A (`/ask`) — CONFIRMED, working
3. Document ingestion supporting both of the above — CONFIRMED, working
4. Peer comparison — CONFIRMED, working
5. Company browsing/search, pricing/charts, news, watchlists — INFERRED as intended, currently non-functional (mocked)

## Primary User Flow
Discover/select company (currently mock-backed) → view company detail page → automatic `/analyze` trigger → view AI scorecard and reasoning → ask follow-up questions via Copilot (`/ask`, RAG-grounded with fallback).

## Secondary User Flows
Watchlist creation/management and watchlist comparison analysis — both currently UI-only with no backend support.

## Confirmed Requirements
RC-001 through RC-006 (see Section 19).

## Inferred Requirements
RC-007 through RC-012 (see Section 19) — these describe UI-implied intent, not verified backend capability.

## Open Product Decisions
- Single-user vs. multi-user, and whether/how to build authentication
- Market data vendor selection for prices/charts
- Whether alternative-data analysis becomes real (vendor integration) or is removed/descoped
- Whether watchlists become a real, persisted feature
- Whether a real news feed and company master index are in scope
- Deployment/hosting model
- Whether the coordinator's refinement step should become genuine LLM-based critique

## Current Implementation State
- **Working**: `/analyze` pipeline (fundamental + sentiment debaters, coordinator, scorecard), `/ask` RAG pipeline with fallback, PDF ingestion, peer comparison.
- **Partial**: Coordinator refinement (placeholder confidence bump), sentiment debater transcript sourcing (URL-guessing), ingestion metric extraction (regex-based demo implementation).
- **Mocked**: Company identity/listing, prices, candlestick charts, news feed, all watchlist data/behavior, alternative-data debater inputs.
- **Missing**: Authentication, watchlist backend, company master database, real market data pipeline, real alternative-data integration, deployment configuration.

## Important Constraints
- No authentication layer exists anywhere in the current codebase — any multi-user requirement starts from zero.
- No deployment/CI infrastructure exists — this is a local-development-only project today.
- The alternative-data agent cannot currently produce non-fake output without new vendor integration work, for which "[n]o existing tools in the repo handle this" *(CONFIRMED — `PROJECT_AUDIT_DEEP_DIVE.md` §7)*.
- The frontend's data expectations (company list, prices, news, watchlists) substantially exceed current backend capability; treating frontend completeness as a proxy for product completeness would be inaccurate.

---

# FINAL RECONSTRUCTION SUMMARY

## What We Know With High Confidence
- The AI research pipeline (`/analyze`) and RAG Copilot (`/ask`) are real, functional, and are the product's actual working core.
- The Fundamental and Sentiment debaters use genuine external data sources; the Alternative debater does not.
- The coordinator's "refinement" step is a placeholder that artificially inflates confidence rather than performing genuine critique.
- Nearly the entire frontend "dashboard" experience — company data, prices, charts, news, watchlists — is mocked via `dummyData.ts` with no backend support.
- No authentication exists anywhere in the system.
- No deployment/CI/CD configuration exists.

## What We Strongly Infer
- The project's original focus and engineering effort centered on the AI architecture, with the frontend built to visually suggest a more complete product than currently exists (the "brain vs. body" imbalance).
- The intended audience is research-oriented (equity researchers/analysts), likely with an Indian-equities focus, though this is inferred from terminology and data sourcing rather than stated directly.
- A real company index, market data feed, news feed, and watchlist backend were all intended at some point, given the amount of frontend UI built around them — but none of this is confirmed as committed roadmap, only as implied by unfinished scaffolding.

## What We Don't Know
- Whether the project was built as a PoC, an early-stage SaaS product, an academic project, or a personal tool.
- The intended market-data and alternative-data vendors.
- The intended deployment/hosting model.
- Whether authentication and multi-user support were ever planned.
- Whether currently-mocked frontend modules were meant to become real features or were exploratory/throwaway.

## What Requires a Product Decision
- Single-user vs. multi-user architecture and authentication approach.
- Market data vendor selection.
- Whether to build real alternative-data integration or remove that agent.
- Whether watchlists become a real, persisted product feature.
- Whether the coordinator's refinement mechanism should be rebuilt as genuine LLM-based critique.
- Overall MVP scope: whether the product ships as an AI-analysis-only tool, or as the fuller dashboard the frontend currently implies.

## Most Likely Product Definition
Based strictly on the evidence, EquityLens is currently a working proof-of-concept for an AI-driven, multi-agent equity research and Q&A engine — capable of producing a synthesized, evidence-backed research scorecard for a company and answering grounded follow-up questions — wrapped in a frontend that visually simulates a more complete equity-research SaaS dashboard whose supporting data (company listings, pricing, news, and watchlists) does not yet exist in any real, backend-connected form.

## Recommended Basis for PRD
The PRD stage should treat Sections 4, 5, 7, 9–14, and 19 (Confirmed and Inferred requirement candidates) of this document as its primary grounded input — particularly the CONFIRMED-status capabilities (`/analyze`, `/ask`, ingestion, peer comparison) as the definite starting scope. The INFERRED-status frontend-implied features (search, pricing/charts, news, watchlists) should be carried forward as candidate scope items requiring explicit product decisions, not as pre-approved requirements. The POSSIBLE items (real alternative-data integration, genuine coordinator refinement) and the PRODUCT DECISION REQUIRED items (authentication, market data vendor, deployment model, MVP scope) should be explicitly surfaced to the product owner for resolution before the PRD finalizes scope — none of them should be silently assumed one way or the other.
