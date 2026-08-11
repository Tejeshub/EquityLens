# PRD VALIDATION

## 1. REPOSITORY BASELINE

Based on an inspection of the codebase (and the findings from `PROJECT_AUDIT.md` and `PROJECT_AUDIT_DEEP_DIVE.md`), the current baseline is:

*   **Frontend Technology**: React, Vite, Tailwind CSS, Shadcn UI.
*   **Backend Technology**: FastAPI, Python.
*   **Major Directories**: `frontend/src/` (components, pages, services, data), `backend/` (agents, rag, storage, tools, `main.py`).
*   **Major Modules**: 
    *   Agents (`fundamental_debater`, `sentiment_debater`, `alt_debater`, `coordinator`, `ingestion_agent`).
    *   RAG (`pipeline`, semantic storage using ChromaDB).
    *   Scraping (`scraper`, `transcript_scraper`).
*   **API Structure**: `POST /analyze`, `POST /ask`, `GET /health` (all implemented in `main.py`).
*   **Database/Data Layer**: PostgreSQL (via SQLAlchemy) for structured financial data and guidance entries; ChromaDB for semantic vector chunks.
*   **AI/Agent Structure**: Integrates with Grok/Gemini. Uses parallel execution for debaters, coordinated by `debate_coordinator`.
*   **RAG Structure**: Vector embedding via `SentenceTransformers` (`all-MiniLM-L6-v2`), stored locally in ChromaDB, retrieved via `search_chunks`, passed to `gemini-2.5-flash` for answering (with Grok fallback).
*   **Current Build/Run Structure**: Local development setup. No CI/CD, Docker, or production deployment configuration exists.

---

## 2. PRD SECTION-BY-SECTION VALIDATION

| PRD Section | Validation Status | Explanation |
| :--- | :--- | :--- |
| Product definition | VALIDATED | Accurately describes the core multi-agent and RAG capabilities found in the code. |
| Target users | VALIDATED | Properly labeled as STRONGLY INFERRED based on the financial terminology in the codebase. |
| Product goals | VALIDATED | Aligns with the automated research synthesis actually built. |
| MVP | VALIDATED | Correctly scopes the MVP around the working AI core and flags missing features (discovery) as mandatory additions. |
| User journeys | VALIDATED | Journeys 2, 3, 4, 5 are fully backed by code. Journey 1 (discovery) is correctly flagged as needing real implementation. Journeys 6, 7 are flagged as decision-dependent. |
| Feature specifications | VALIDATED | Reflects the exact behavior of the `/analyze` and `/ask` endpoints. |
| AI research feature | VALIDATED | Accurately captures the fundamental, sentiment, alt debaters, and the coordinator. |
| Scorecard | VALIDATED | Mirrors the `Scorecard` and `ScoreDimension` Pydantic models. |
| RAG Copilot | VALIDATED | Accurately describes the retrieval process, citation generation, and fallback QA agent. |
| Document ingestion | VALIDATED | Reflects `ingestion_agent.py` and `parser_tools.py` functionality. |
| Company discovery | PRODUCT DECISION | Correctly identified as mocked in `dummyData.ts` and requiring a product decision for real implementation. |
| Market data | PRODUCT DECISION | Correctly identified as mocked and needing a vendor decision. |
| News | PRODUCT DECISION | Correctly differentiates between internal debater news (Exa) and the mocked dashboard feed. |
| Watchlists | PRODUCT DECISION | Correctly identified as UI-only with no backend persistence. |
| Authentication | PRODUCT DECISION | Correctly noted as entirely absent from the codebase. |
| Data requirements | VALIDATED | Accurately maps the entities present in DB vs. those only in frontend mocks. |
| Functional requirements | VALIDATED | The FR table is highly accurate (see Section 3). |
| Non-functional requirements | VALIDATED | Reasonable constraints that do not invent unbacked performance numbers. |
| Error states | VALIDATED | Accurately describes the necessary UX for failures. |
| AI safety/trust | VALIDATED | Appropriately emphasizes the need for transparency, especially regarding the coordinator's artificial confidence bump. |
| Acceptance criteria | VALIDATED | Testable and scope-consistent. |
| MVP scope | VALIDATED | The MVP matrix correctly categorizes features based on current backend reality. |

---

## 3. FUNCTIONAL REQUIREMENT TRACEABILITY

| ID | PRD Requirement | Code Evidence | Current Status | Validation | Gap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| FR-001 | Submit company for AI analysis | `backend/main.py` (`/analyze`), `frontend/src/services/api.ts` | Fully implemented | VALIDATED | None |
| FR-002 | Return scorecard with scores/confidence | `models.py` (`Scorecard`), `coordinator.py` | Fully implemented | VALIDATED | None |
| FR-003 | Fundamental analysis on real metrics | `fundamental_debater.py`, `structured_store.py` | Fully implemented | VALIDATED | None |
| FR-004 | Sentiment analysis on news/transcripts | `sentiment_debater.py` (Exa, Firecrawl) | Fully implemented | VALIDATED | Transcript URL is guessed |
| FR-005 | Display reasoning/evidence per dimension | `ReportSection.tsx`, `AgentMessage` | Fully implemented | VALIDATED | None |
| FR-006 | Peer comparison alongside scorecard | `main.py` (`compare_companies`), `models.py` | Fully implemented | VALIDATED | None |
| FR-007 | Ask free-form questions via Copilot | `backend/main.py` (`/ask`), `CopilotSidebar.tsx` | Fully implemented | VALIDATED | None |
| FR-008 | Ground Copilot in retrieved chunks | `rag/pipeline.py`, `chroma_tools.py` | Fully implemented | VALIDATED | None |
| FR-009 | Visually label fallback answers | `CopilotSidebar.tsx` (missing visual label for `fallback_used`) | Missing | VALIDATED | UI needs update to show `fallback_used` |
| FR-010 | Ingest IR PDFs | `ingestion_agent.py`, `parser_tools.py` | Fully implemented | VALIDATED | Extraction is regex-based (demo) |
| FR-011 | Real company discovery/search | `Index.tsx`, `SearchBar.tsx` (using `dummyData.ts`) | Mocked | VALIDATED | Requires backend implementation |
| FR-012 | Explicit error state if analysis fails | `useAnalyze.ts`, `CompanyDetail.tsx` | Partially implemented | VALIDATED | Better error boundaries needed |
| FR-013 | Explicit state for insufficient evidence | `fundamental_debater.py` (handles missing data) | Partially implemented | VALIDATED | UI representation needs refinement |
| FR-014 | Prevent artificial confidence inflation | `coordinator.py` (`lc["confidence"] = min(current_conf + 20, 100)`) | Fully implemented (as placeholder) | VALIDATED | Requires replacing placeholder logic |
| FR-015 | Market data/charts from real backend | `dummyData.ts`, `CompanyDetail.tsx` | Mocked | VALIDATED | Pending Product Decision |
| FR-016 | News feed from real backend | `dummyData.ts`, `CompanyDetail.tsx` | Mocked | VALIDATED | Pending Product Decision |
| FR-017 | Watchlists with server persistence | `WatchlistsPage.tsx` | Mocked (UI only) | VALIDATED | Pending Product Decision |
| FR-018 | Comparative watchlist analysis | `WatchlistAnalysis.tsx` | Mocked (UI only) | VALIDATED | Pending Product Decision |
| FR-019 | Alternative data on real signals | `alt_debater.py` (hardcoded 15 jobs, 5000 rank) | Mocked | VALIDATED | Pending Product Decision |
| FR-020 | Authentication / accounts | Entirely absent | Missing | VALIDATED | Pending Product Decision |

---

## 4. CURRENT IMPLEMENTATION STATUS AUDIT

| Capability | PRD Status | Actual Repository Status | Correct? | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| `/analyze` | EXISTING | Fully functional orchestrator | Yes | `backend/main.py` |
| `/ask` | EXISTING | Fully functional RAG | Yes | `backend/main.py` |
| Fundamental Debater | EXISTING | Real DB metrics | Yes | `backend/agents/fundamental_debater.py` |
| Sentiment Debater | EXISTING | Real Exa/Firecrawl API | Yes | `backend/agents/sentiment_debater.py` |
| Alternative Debater | EXISTING / MOCKED | Hardcoded values | Yes | `backend/agents/alt_debater.py` |
| Coordinator | EXISTING / PARTIAL | Refinement is artificial | Yes | `backend/agents/coordinator.py` |
| Scorecard | EXISTING | Maps output correctly | Yes | `backend/models.py` |
| Peer comparison | EXISTING | Functional | Yes | `backend/main.py` |
| RAG | EXISTING | Working ChromaDB pipeline | Yes | `backend/rag/pipeline.py` |
| Document ingestion | EXISTING / PARTIAL| Working, regex demo | Yes | `backend/agents/ingestion_agent.py` |
| Company discovery | EXISTING / MOCKED | `dummyData.ts` driven | Yes | `frontend/src/components/SearchBar.tsx` |
| Market data | EXISTING / MOCKED | `dummyData.ts` driven | Yes | `frontend/src/data/dummyData.ts` |
| Charts | EXISTING / MOCKED | generated data | Yes | `frontend/src/data/dummyData.ts` |
| News | EXISTING / MOCKED | `dummyData.ts` driven | Yes | `frontend/src/data/dummyData.ts` |
| Watchlists | EXISTING / MOCKED | Local React state | Yes | `frontend/src/pages/WatchlistsPage.tsx` |
| Authentication | MISSING | Absent | Yes | No auth code exists |

---

## 5. FRONTEND VALIDATION

| Frontend Feature | Implementation | Backend Connected? | Mocked? | PRD Correct? |
| :--- | :--- | :--- | :--- | :--- |
| Company Search | `SearchBar.tsx` | No | Yes (`dummyData.ts`) | Yes |
| Landing Movers | `Index.tsx` | No | Yes (`dummyData.ts`) | Yes |
| Company Details | `CompanyDetail.tsx` | No (for market data) | Yes (`dummyData.ts`) | Yes |
| AI Report / Scorecard | `CompanyDetail.tsx`, `ReportSection.tsx` | Yes (`POST /analyze`) | No | Yes |
| Copilot Chat | `CopilotSidebar.tsx` | Yes (`POST /ask`) | No | Yes |
| News Feed | `CompanyDetail.tsx` | No | Yes (`dummyData.ts`) | Yes |
| Watchlist Management | `WatchlistsPage.tsx` | No | Yes (local state) | Yes |

---

## 6. BACKEND VALIDATION

The backend consists of:
*   `POST /analyze`: Fully functional. Runs scraping, ingestion, and multi-agent debate.
*   `POST /ask`: Fully functional. Runs ChromaDB retrieval and Gemini LLM.
*   `GET /health`: Present, but unused by frontend.

The backend does **not** contain any CRUD routes for users, companies, market data, news, or watchlists. The PRD is 100% accurate in its assessment of the backend's narrow, AI-focused scope.

---

## 7. AI PIPELINE VALIDATION

```text
Request → Screener/Transcript Scrapers → Ingestion Agent
          ↓
          ├── Fundamental Agent (Real DB metrics)
          ├── Sentiment Agent (Real Exa search, Firecrawl scraping)
          └── Alternative Agent (MOCKED: hardcoded metrics)
          ↓
Coordinator (MOCKED REFINEMENT: artificially adds +20 to confidence)
          ↓
Scorecard Mapping → Frontend
```
The PRD accurately identifies that the Alternative agent is mocked and the Coordinator's refinement behavior is artificial.

---

## 8. RAG VALIDATION

```text
Document → PdfReader → Chunking → all-MiniLM-L6-v2 Embeddings → ChromaDB equity_chunks
          ↓
Query → search_chunks → Gemini-2.5-flash → Answer + Citations
          ↓
If chunks == 0 → Grok QA Fallback → fallback_used = True
```
The PRD accurately describes the pipeline. The `fallback_used` flag is returned by the backend, but `CopilotSidebar.tsx` does not currently exhibit clear visual styling to distinguish it, validating FR-009 as a necessary UX addition.

---

## 9. DOCUMENT INGESTION VALIDATION

The `ingestion_agent.py` and `parser_tools.py` successfully locate PDFs, download them, parse text using `PdfReader`, and embed them. As the PRD states, the metric extraction is indeed a demo-quality regex implementation.

---

## 10. DATA ENTITY VALIDATION

| Entity | PRD Says | Exists in Code? | Actual Representation | Validation |
| :--- | :--- | :--- | :--- | :--- |
| Company | Real backend entity needed | Partial | Mocked frontend `dummyData.ts` | VALIDATED |
| Financial Metric | DB-backed | Yes | `financials_quarterly` Postgres table | VALIDATED |
| News (internal) | Exa search | Yes | Runtime search in `sentiment_debater.py` | VALIDATED |
| News (dashboard) | Decision-dependent | No | Mocked `NewsItem` in `dummyData.ts` | VALIDATED |
| Market Data | Decision-dependent | No | Mocked `CandlestickPoint` array | VALIDATED |
| Scorecard | API-backed | Yes | `Scorecard` / `ScoreDimension` Pydantic models | VALIDATED |
| Agent Message | API-backed | Yes | `AgentMessage` Pydantic model | VALIDATED |
| Document | DB-backed | Yes | `raw_documents` Postgres table | VALIDATED |
| Retrieved Chunk | API-backed | Yes | `RetrievedChunk` model, ChromaDB | VALIDATED |
| Watchlist | Decision-dependent | No | Mocked frontend state | VALIDATED |
| Watchlist Item | Decision-dependent | No | Nested in frontend state | VALIDATED |
| User | Decision-dependent | No | Absent entirely | VALIDATED |

---

## 11. API VALIDATION

| Product Capability | API | Exists? | Frontend Uses It? | Status |
| :--- | :--- | :--- | :--- | :--- |
| Run Analysis | `POST /analyze` | Yes | Yes (`useAnalyze`) | FULLY CONNECTED |
| Copilot Q&A | `POST /ask` | Yes | Yes (`useAsk`) | FULLY CONNECTED |
| System Health | `GET /health` | Yes | No | UNUSED |

No missing APIs were called by the frontend (it relies on mock data instead of making API calls for missing backend routes).

---

## 12. MOCK DATA AUDIT

| Mock Data | Location | Feature Affected | PRD Treatment | Replacement Needed? |
| :--- | :--- | :--- | :--- | :--- |
| `companies` list | `frontend/src/data/dummyData.ts` | Search, Dashboard, Details | Identified | Yes (for MVP) |
| `getCompanyNews` | `frontend/src/data/dummyData.ts` | News Feed | Identified | Pending Product Decision |
| `candlestickData` | `frontend/src/data/dummyData.ts` | Charts | Identified | Pending Product Decision |
| `watchlists` | `frontend/src/data/dummyData.ts` | Watchlists | Identified | Pending Product Decision |
| `jobs_count = 15` | `backend/agents/alt_debater.py` | Alt Debater | Identified | Pending Product Decision |
| `confidence + 20` | `backend/agents/coordinator.py` | Coordinator Refinement | Identified | Yes (Fix Refinement) |

---

## 13. MVP VALIDATION

The PRD's proposed MVP is **highly technically coherent**. By stripping out the mocked "body" of the application (charts, news, watchlists) and focusing entirely on the "brain" (the AI analysis pipeline and RAG Copilot) plus a minimal real company discovery mechanism, the PRD defines an MVP that can actually be built upon the existing codebase without requiring massive, out-of-scope backend rewrites.

---

## 14. USER JOURNEY VALIDATION

| Journey | Existing Steps | Missing Steps | Mocked Steps | Valid? |
| :--- | :--- | :--- | :--- | :--- |
| 1: Discover | UI exists | Backend search API | Company list | Yes (Needs real backend) |
| 2: Analyze | End-to-end | None | None | Yes |
| 3: Explore Scorecard | UI exists | None | None | Yes |
| 4: Drill into Reasoning | UI exists | None | None | Yes |
| 5: Ask Copilot | End-to-end | Visual fallback label | None | Yes |
| 6: Context Data | UI exists | Real market data / news APIs | Data models | Yes (If scoped in) |
| 7: Watchlists | UI exists | Backend CRUD APIs | Data state | Yes (If scoped in) |

---

## 15. ACCEPTANCE CRITERIA VALIDATION

All acceptance criteria defined in the PRD (Section 25) are objectively testable, scope-consistent, and directly tied to resolving the gaps between the current mocked state and a real MVP state. 

---

## 16. NON-FUNCTIONAL REQUIREMENT VALIDATION

The NFRs (Section 21) are grounded and reasonable. The PRD explicitly avoids inventing performance benchmarks that cannot be supported by the current codebase, which is appropriate for this stage.

---

## 17. UNSUPPORTED / INVENTED REQUIREMENTS

**None found.** The PRD is exceptionally disciplined. It successfully resists the urge to convert mocked frontend features (like Watchlists) into automatic requirements, properly isolating them as "Product Decisions." It invents no unsupported user personas or capabilities.

---

## 18. MISSING PRODUCT REQUIREMENTS

*   **`GET /health` Endpoint**: The codebase contains a `/health` endpoint that is not mentioned in the PRD. 
    *   *Importance*: Low. It is an operational detail that belongs in the TRD, but its omission from the PRD is minor.
*   **Transcript URL Guessing**: The PRD notes the fragility of the Sentiment debater's transcript sourcing, but doesn't explicitly mandate a requirement to fix the "generalized guess" URL construction. 
    *   *Importance*: Medium. This should be addressed during TRD design.

---

## 19. CONTRADICTIONS

**No contradictions found.** The PRD aligns perfectly with the repository's reality and the previous audit documents.

---

## 20. PRODUCT DECISION VALIDATION

The PRD correctly isolates and defers all major unresolvable architectural questions to Section 28 (Open Product Decisions). It correctly identifies that Authentication, Market Data, News, Watchlists, Alt Data Integration, and Deployment Model must be decided by the product owner before the TRD can finalize technical specifications.

---

## 21. TRD READINESS CHECK

| Area | Ready? | Blocking Issue |
| :--- | :--- | :--- |
| Product scope | Yes | None (MVP is clearly defined) |
| Requirements | Yes | None |
| Technical boundaries | Yes | None |
| Existing system | Yes | None |
| Remaining work | Yes | None |
| Decisions | Yes | Pending final confirmation of the Section 28 product decisions. |

---

## 22. REQUIRED FINAL CLASSIFICATION

**READY FOR TRD**

---

## 23. FINAL SUMMARY

### Overall Validation Result
**READY FOR TRD**

### What Is Correct
The PRD exhibits a perfect understanding of the "Brain vs. Body" imbalance in the EquityLens codebase. It correctly scopes the MVP around the functional AI analysis and RAG pipelines while isolating the mocked frontend features (watchlists, market data, news) as explicit product decisions.

### What Is Incorrect
There are no material inaccuracies in the PRD's assessment of the codebase.

### What Is Missing
The PRD omits mention of the `GET /health` endpoint (a minor operational detail). It could also explicitly add a functional requirement to robustify the transcript URL scraping in the Sentiment Debater, which is currently a "generalized guess."

### What Is Unsupported
Nothing. The PRD invents no requirements.

### What Requires Product Decisions
Before the TRD is finalized, the product owner must resolve the 9 decisions outlined in PRD Section 28 (Authentication, Market Data, Watchlists, etc.).

### Recommended PRD Changes
1.  Add a minor technical requirement to robustify transcript URL discovery for the Sentiment Debater.
2.  Once the Product Decisions (Section 28) are finalized by the owner, update the MVP Scope Matrix (Section 27) accordingly and proceed immediately to TRD generation.
