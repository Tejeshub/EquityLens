# PROJECT AUDIT DEEP DIVE

## 1. Executive Summary

This document represents a deep-dive verification of the EquityLens codebase. The primary finding is that EquityLens is a structurally imbalanced application: it possesses a highly sophisticated, multi-agent AI backend that genuinely works, but its standard web application features (data fetching, watchlists, user state, core market data) are entirely simulated on the frontend using local mock data. 

The `/analyze` and `/ask` pipelines are real and complex, executing live scraping and LLM generation. However, the foundational data (e.g., historical prices, news, company lists) lacks a backend infrastructure.

---

## 2. Frontend Feature Deep Dive

### `Index.tsx`
* **Purpose**: Landing page showcasing "Top Gainers" and "Top Losers", alongside a search bar.
* **User Actions**: Click on a company to navigate to its details. Search for a company.
* **Data Required**: Company list, current price, change percentages.
* **Data Source**: Exclusively `dummyData.ts`.
* **Backend Dependency**: None.
* **Completion Status**: MOCK/HARDCODED.

### `CompanyDetail.tsx`
* **Purpose**: Main dashboard for a single company's analysis.
* **User Actions**: View candlestick charts, read news, review financial tables, view the AI-generated report, and open the Copilot Sidebar.
* **Data Required**: Company identity, market data, news, financial metrics, AI analysis scorecard.
* **Data Source**: Mixed. Market data, news, and company identity come from `dummyData.ts`. The AI analysis scorecard comes from React Query (`useAnalyze`) hitting the backend.
* **Backend Dependency**: `POST /analyze`.
* **Completion Status**: PARTIAL (AI integration is complete; standard market data is mocked).

### `WatchlistsPage.tsx`
* **Purpose**: Manage lists of companies for comparative analysis.
* **User Actions**: Create new watchlist, add/remove companies, delete watchlist, trigger analysis.
* **Data Required**: List of watchlists, list of available companies.
* **Data Source**: Local React state initialized by `dummyData.ts`.
* **Backend Dependency**: None.
* **Completion Status**: MOCK/HARDCODED.

### `WatchlistAnalysis.tsx`
* **Purpose**: Compare companies within a specific watchlist.
* **User Actions**: View comparison table, trigger report.
* **Data Required**: Watchlist companies, comparison metrics.
* **Data Source**: Local React state / `dummyData.ts`.
* **Backend Dependency**: None.
* **Completion Status**: MOCK/HARDCODED.

### `CopilotSidebar.tsx`
* **Purpose**: Chat interface to ask questions about the current company/report.
* **User Actions**: Send a text query, receive an answer with citations.
* **Data Required**: Conversation history, current company context.
* **Data Source**: React state for history, `POST /ask` for answers.
* **Backend Dependency**: `POST /ask`.
* **Completion Status**: COMPLETE.

### `SearchBar.tsx`
* **Purpose**: Find companies by name, ticker, or sector.
* **User Actions**: Type query, click filter buttons.
* **Data Required**: Full list of companies.
* **Data Source**: `dummyData.ts`.
* **Backend Dependency**: None.
* **Completion Status**: MOCK/HARDCODED.

---

## 3. Dummy/Mock Data Analysis

Located in `frontend/src/data/dummyData.ts`.

### A. Data Structures & Fields
1. **`Company`**: id, name, ticker, sector, cap, price, change, changePercent, marketCap, pe, eps, volume, roe, roce, etc.
2. **`NewsItem`**: id, title, source, date, sentiment, summary, url.
3. **`QuarterlyData`**: quarter, revenue, netProfit, ebitda, eps, operatingMargin.
4. **`CandlestickPoint`**: date, open, high, low, close, volume.
5. **`Watchlist`**: id, name, sector, cap, companies (array of IDs).

### B. Consumers
* **`Index.tsx`**: Uses `Company` array.
* **`CompanyDetail.tsx`**: Uses `Company`, `NewsItem`.
* **`WatchlistsPage.tsx`**: Uses `Watchlist`, `Company`.
* **`SearchBar.tsx`**: Uses `Company`.

### C. Dataset Mapping Table

| Mock Dataset | Used By | Important Fields | Current Source | Likely Real Source Category | Status |
| ------------ | ------- | ---------------- | -------------- | --------------------------- | ------ |
| `companies` | Index, Search, Watchlists, Details | Ticker, Price, ROE, P/E | `dummyData.ts` | Real-time Market Data API | MOCK |
| `getCompanyNews` | CompanyDetail | Title, Sentiment, Source | `dummyData.ts` | External News API | MOCK |
| `quarterlyData` | CompanyDetail | Revenue, EBITDA, EPS | `dummyData.ts` | Backend Financials DB | MOCK |
| `candlestickData`| CompanyDetail | Open, High, Low, Close | `dummyData.ts` (Generated) | Market Data API | MOCK |
| `watchlists` | WatchlistsPage | Name, Companies List | `dummyData.ts` | Backend User DB | MOCK |

---

## 4. `/analyze` Contract

**Trace**: `CompanyDetail.tsx` → `useAnalyze` hook → `apiClient.analyze` → `POST /analyze` → `main.py` → `ingestion` & `debaters` & `coordinator` → `transform_coordinator_output_to_scorecard` → `EquityResearchResponse` → UI rendering in "Analysis Results" tab.

### Request
* **Method/Endpoint**: `POST /analyze`
* **Model**: `EquityResearchRequest`
* **Required**: `companies` (list of `CompanyInput`).
* **Optional**: `quarters`, `debate_refinement_threshold`.

### Response
* **Structure**: `EquityResearchResponse`
* **Major Fields**: `scorecards` (array of `Scorecard`), `guidance_tracker`, `peer_comparisons`, `execution_status`.
* **Scorecard Nested**: Contains `dimensions` (array of `ScoreDimension`), which includes `score`, `confidence`, `evidence`, and `reasoning` (array of `AgentMessage`).

### Frontend Usage Matrix

| Response Field | Backend Source | Frontend Consumer | Used in UI? |
| -------------- | -------------- | ----------------- | ----------- |
| `overall_score` | Coordinator | `CompanyDetail.tsx` | YES (Top level metric) |
| `confidence_score`| Coordinator | `CompanyDetail.tsx` | YES |
| `dimensions` | Debaters via Coordinator | `CompanyDetail.tsx` | YES (Mapped to cards) |
| `reasoning` | Debaters | `ReasoningPanel.tsx` | YES (Drill-down view) |
| `peer_comparisons`| `compare_companies` | `CompanyDetail.tsx` | YES |

**Important Distinction**: Only the "Analysis Results" tab and Copilot utilize the `/analyze` data. The top-level pricing, company name, news, and stock charts are still rendered exclusively from `dummyData.ts`.

---

## 5. `/ask` Contract

**Trace**: `CopilotSidebar.tsx` → `apiClient.ask` → `POST /ask` → `answer_with_rag` → `retrieve_chunks` → LLM generation → `AskResponse` → Copilot rendering.

* **Request**: `AskRequest` (`question`, `company`, `top_k`).
* **Response**: `AskResponse` (`answer`, `citations`, `retrieved_chunks`, `fallback_used`).
* **LLM Provider**: Configurable via `QA_MODEL`. Defaults to Gemini (`gemini-2.5-flash`), but falls back to Grok if configured.
* **Fallback Behavior**: If RAG retrieves 0 chunks, it throws an error and the route catches it to trigger `answer_with_citations` (a generic QA agent using Grok) as a fallback.
* **Status**: GENUINELY FUNCTIONAL. The RAG pipeline queries ChromaDB successfully.

---

## 6. Multi-Agent Pipeline

**Flow Trace**:
```text
/analyze
   ↓
ScreenerScraper / TranscriptScraper (Extracts data to Postgres/Chroma)
   ↓
Ingestion Agent (Downloads IR PDFs, extracts metrics)
   ↓
Parallel Execution:
 ├─ Fundamental Debater (Queries Postgres metrics, calls Grok)
 ├─ Sentiment Debater (Queries Exa news, scrapes transcripts, calls Grok)
 └─ Alternative Data Debater (Uses mocked jobs/traffic data, calls Grok)
   ↓
Coordinator (Evaluates confidence, requests refinement if < threshold)
   ↓
Scorecard Transformation
   ↓
API Response
```

### Agents
1. **Fundamental Debater**:
   - *Inputs*: Company name.
   - *Data*: Pulls real `revenue`, `pat`, `roce`, `debt_equity` from Postgres via `verify_metric`.
   - *LLM*: Grok.
2. **Sentiment Debater**:
   - *Inputs*: Company name.
   - *Data*: Exa API (real news search), Firecrawl (real scraping, but URL is a generalized guess).
   - *LLM*: Grok.
3. **Alternative Debater**:
   - *Inputs*: Company name.
   - *Data*: MOCK. Hardcoded `jobs_count`, `traffic_rank`.
   - *LLM*: Grok.
4. **Coordinator**:
   - *Inputs*: Outputs of the 3 debaters.
   - *Logic*: Checks if confidence < threshold. If so, runs a refinement loop (though current code just artificially bumps confidence for demo purposes: `lc["confidence"] = min(current_conf + 20, 100)`).
   - *Output*: Final scorecard dictionary.
5. **Ingestion Agent**:
   - *Purpose*: Scrapes PDFs, parses them via `PdfReader`, uses regex to extract metrics (demo implementation), and embeds chunks into ChromaDB.

---

## 7. Mock/Placeholder Backend Logic

### `alt_debater.py`
1. **Function**: `alt_debate`
2. **Purpose**: Analyze alternative data (hiring, traffic, filings).
3. **Substitutes**: Real web traffic APIs (e.g., SimilarWeb) and LinkedIn scrapers.
4. **Effect**: Forces the AI to generate analysis based on static numbers (`15` jobs, `5000` rank).
5. **Replacement Path**: Needs a real vendor API integration. No existing tools in the repo handle this.

### `coordinator.py`
1. **Function**: `debate_coordinator`
2. **Purpose**: Synthesize and refine debater outputs.
3. **Substitutes**: True LLM-based critique/refinement.
4. **Effect**: Instead of asking the LLM to improve low-confidence answers, it artificially executes `lc["confidence"] = min(current_conf + 20, 100)`.

---

## 8. Watchlist Investigation

* **User Actions**: Create watchlist, view watchlists, add company, remove company, delete watchlist.
* **State Storage**: React local state (`useState` in `WatchlistsPage.tsx`).
* **Backend Functionality Missing**: Entirely missing. There are no models, no PostgreSQL tables, and no API endpoints for creating, reading, updating, or deleting watchlists. It is 100% presentation only.

---

## 9. Market / Company / News Data

* **Company Identity**: Mock (`dummyData.ts`).
* **Current/Historical Price**: Mock (`dummyData.ts`).
* **Candlestick Data**: Mock (mathematically generated array in `dummyData.ts`).
* **News**: Mock (`dummyData.ts`).
* **Financial Data (Ratios)**: Backend scraping (Screener.in) inserted into Postgres.

---

## 10. Database vs Frontend Requirements

| Frontend Requirement | Existing DB Support | Existing Table/Field | Missing DB Support |
| -------------------- | ------------------- | -------------------- | ------------------ |
| AI Research Metrics | YES | `financials_quarterly` | None |
| RAG Documents | YES | `raw_documents` | None |
| Guidance Tracking | YES | `guidance_entries` | None |
| Users / Auth | NO | N/A | Missing entire user schema |
| Watchlists | NO | N/A | Missing `watchlists`, `watchlist_items` |
| Company Master List | NO | N/A | Missing `companies` table |
| Historical Prices | NO | N/A | Missing `daily_prices` table |

---

## 11. RAG Pipeline

**Trace**:
`Document` → `PdfReader` (`parser_tools.py`) / `Screener table` (`chroma_tools.py`) → Chunking → Embedded via `SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")` → Stored in ChromaDB `equity_chunks` locally → Retreived via `search_chunks` → Context built in `pipeline.py` → Sent to `gemini-2.5-flash` → Returns Answer and Citations.

* **Vector Collection**: `equity_chunks` in ChromaDB.
* **Embedding Model**: `all-MiniLM-L6-v2`.
* **LLM**: Gemini 2.5 Flash (default).

---

## 12. Complete API Inventory

| Method | Endpoint | Purpose | Request | Response | Auth | Status | Frontend Consumer |
| ------ | -------- | ------- | ------- | -------- | ---- | ------ | ----------------- |
| POST | `/analyze` | Run multi-agent debate | `EquityResearchRequest` | `EquityResearchResponse`| None | COMPLETE | `CompanyDetail.tsx` |
| POST | `/ask` | Run RAG Q&A | `AskRequest` | `AskResponse` | None | COMPLETE | `CopilotSidebar.tsx` |
| GET | `/health` | Health Check | None | `{"status": "ok"}` | None | COMPLETE | `NO FRONTEND CONSUMER FOUND` |

---

## 13. Frontend ↔ Backend Gap Matrix

| Feature | Frontend Exists | Backend Exists | DB Exists | API Exists | Connected | Mocked | Gap |
| ------- | --------------: | -------------: | --------: | ---------: | --------: | -----: | --- |
| AI Multi-Agent | YES | YES | YES | YES | YES | NO (Mostly) | None |
| RAG Q&A | YES | YES | YES | YES | YES | NO | None |
| Company Search | YES | NO | NO | NO | NO | YES | Needs Company DB & API |
| Stock Prices / Charts| YES | NO | NO | NO | NO | YES | Needs Market Data API |
| News Feed | YES | NO | NO | NO | NO | YES | Needs News API |
| Watchlists | YES | NO | NO | NO | NO | YES | Needs User DB & CRUD API |

---

## 14. Original Audit Verification

### VERIFIED
- Multi-agent AI logic and RAG are the core focus and exist functionally.
- Authentication is completely missing.
- Heavy reliance on dummy data in the frontend.

### CORRECTED
- Original audit suggested all debaters might be partial. The Fundamental and Sentiment debaters are fully functional (using Exa/Scraping/DB). Only `alt_debater.py` is actively hardcoded.
- Watchlists were suspected of missing endpoints; this is now confirmed. Watchlists exist *only* in React state.

### EXPANDED
- Detailed exactly *how* the RAG pipeline is configured (`all-MiniLM-L6-v2`, ChromaDB, Gemini).
- Traced the exact flow of the `debate_coordinator` and its fake confidence inflation loop.

### STILL UNKNOWN
- Intended source for real-time stock pricing.
- Intended mechanism for user management (Auth0, Clerk, custom?).

---

## 15. Confirmed Facts
1. The backend is primarily a highly-specialized AI orchestration layer, not a standard CRUD backend.
2. The UI relies on `dummyData.ts` for almost everything except the AI Scorecard and Copilot Chat.
3. The RAG pipeline relies on local ChromaDB storage and SentenceTransformers.

## 16. Inferences
1. The project was likely a proof-of-concept for the AI architecture, with the frontend wrapped around it to make it look like a complete SaaS product.

## 17. Unknowns
1. The intended deployment infrastructure (no Docker/CI config exists).

## 18. Product Decisions Required
1. Should this remain a single-user local tool, or must we implement Auth/Users for SaaS deployment?
2. Which market data provider (e.g., AlphaVantage, Polygon.io) should be integrated to replace the dummy stock charts?
3. Should alternative data scraping (LinkedIn) be legitimately implemented, or should the Alt Debater be removed?

## 19. Evidence / Important File Paths
- `frontend/src/data/dummyData.ts` (Mock data core)
- `frontend/src/pages/WatchlistsPage.tsx` (Local state watchlists)
- `backend/agents/coordinator.py` (Refinement loop logic)
- `backend/agents/alt_debater.py` (Hardcoded alternative metrics)
- `backend/main.py` (API routing)

---

## 20. Final Findings

### What We Can Confidently Say About EquityLens
EquityLens currently exists as a functional **Proof-of-Concept for an AI-driven equity research engine**, wrapped in a frontend mockup of a SaaS dashboard. The "brain" of the application (scraping financial tables, running agent debates, and executing RAG queries) works. The "body" of the application (user accounts, persistent watchlists, live stock charts, news feeds) is entirely simulated.

### What Is Already Working
- `POST /analyze`: Scraping, Fundamental/Sentiment agents, Coordinator output.
- `POST /ask`: RAG document retrieval and LLM answering.
- Frontend rendering of the AI Scorecard.

### What Is Partially Working
- Coordinator refinement loop (artificially inflates confidence).

### What Is Missing
- Authentication & User Management.
- Watchlist API and Database tables.
- Company Master database.
- Real-time/Historical Market Data pipelines.

### What Is Mocked
- Top-level company information, prices, and charts (`dummyData.ts`).
- News feeds (`dummyData.ts`).
- Alternative Data metrics (web traffic, job postings in `alt_debater.py`).
- Watchlist state (`WatchlistsPage.tsx`).

### What Is Broken
- Nothing is explicitly throwing errors, but the architecture is disjointed between a real AI backend and a mock SaaS frontend.

### What Cannot Yet Be Determined
- Business logic for user accounts (SaaS vs. single-user local tool).
- Desired vendors for market data and alternative data.

### Highest-Risk Unknowns
- Cost and latency implications of replacing the frontend's instant mock data with live financial data APIs.
