# PROJECT AUDIT

## PART 1 — REPOSITORY OVERVIEW

### Structure
- **Project Root**: `./EquityLens`
- **Frontend Directory**: `./EquityLens/frontend`
  - Purpose: Houses the user interface, written in React and Vite. It contains the routing, components, pages, and API integration.
- **Backend Directory**: `./EquityLens/backend`
  - Purpose: Houses the FastAPI server, multi-agent logic, RAG pipeline, scrapers, and database interactions.

### High-level Tree
```text
.
├── backend
│   ├── agents/            # AI agent logic (debaters, coordinator, ingestion)
│   ├── rag/               # RAG pipeline implementation
│   ├── raw_data/          # Storage for raw downloaded data
│   ├── scripts/           # DB initialization and seeding scripts
│   ├── storage/           # Database setup (PostgreSQL and ChromaDB)
│   ├── tests/             # Backend test files
│   ├── tools/             # Helper tools (chroma, download, parser, verification)
│   ├── config.py          # Environment configuration
│   ├── main.py            # FastAPI entrypoint and routes
│   ├── models.py          # Pydantic models
│   ├── scraper.py         # Screener.in scraper
│   ├── transcript_scraper.py
│   └── requirements.txt
└── frontend
    ├── public/
    ├── src/
    │   ├── components/    # Reusable UI components
    │   ├── data/          # Mock data (dummyData.ts)
    │   ├── hooks/         # Custom React hooks (e.g., useAnalyze.ts)
    │   ├── pages/         # Top-level route components
    │   ├── services/      # API client logic
    │   └── types/
    ├── index.html
    ├── package.json
    ├── tailwind.config.ts
    └── vite.config.ts
```

---

## PART 2 — TECHNOLOGY STACK

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling Solution**: Tailwind CSS
- **UI Libraries**: Shadcn UI (Radix UI primitives), Lucide React (icons), Recharts (charts), Embla Carousel
- **State Management**: React Query (data fetching), React local state/context
- **Routing**: React Router DOM
- **Form Handling & Validation**: React Hook Form, Zod
- **API Client**: Native `fetch` wrapper in `src/services/api.ts`

### Backend
- **Framework & Language**: FastAPI, Python 3
- **ORM & Database**: SQLAlchemy targeting PostgreSQL (structured data)
- **Vector Database**: ChromaDB (local persistence for semantic chunks)
- **Validation Library**: Pydantic
- **AI/LLM Integration**: Agno, Google Generative AI (Gemini), Grok client, Sentence Transformers
- **Scraping & APIs**: BeautifulSoup4, Trafilatura, Firecrawl, Exa
- **Authentication/Authorization**: None detected
- **Testing Tools**: Pytest (inferred from `test_refactoring.py`)

---

## PART 3 — FRONTEND INVESTIGATION

### 3.1 Pages
- **`/` (Index)** (`src/pages/Index.tsx`): Landing/Dashboard page. (COMPLETE)
- **`/company/:id` (Company Detail)** (`src/pages/CompanyDetail.tsx`): Main company analysis dashboard featuring an overview, candlestick charts, news feed, financial table, and AI report. Heavy reliance on dummy data mixed with real analysis. (PARTIAL)
- **`/watchlists` (Watchlists)** (`src/pages/WatchlistsPage.tsx`): Manage watchlists of equities. (COMPLETE UI, backend wiring unclear)
- **`/watchlist/:id/analysis` (Watchlist Analysis)** (`src/pages/WatchlistAnalysis.tsx`): Analyze a specific watchlist. (COMPLETE UI, backend wiring unclear)
- **`*` (Not Found)** (`src/pages/NotFound.tsx`): Fallback 404 page. (COMPLETE)

### 3.2 Routing
Defined in `src/App.tsx`. All routes are public. No nested or protected routes exist.

### 3.3 Components
- **Navigation**: `Navbar.tsx`, `CopilotSidebar.tsx`, `ReasoningPanel.tsx`
- **Dashboards/Displays**: `CompanyOverview.tsx`, `CandlestickChart.tsx`, `NewsFeed.tsx`, `FinancialTable.tsx`, `ManagementTracker.tsx`, `ReportSection.tsx`
- **UI Library**: Extensive standard Shadcn UI components in `src/components/ui/` (tabs, inputs, select, dialogs).

### 3.4 User Interactions
- **Search**: SearchBar component with placeholder for finding companies.
- **Analysis Trigger**: When landing on `CompanyDetail.tsx`, it triggers `useAnalyze` to hit the backend `/analyze` endpoint.
- **Q&A (Ask)**: Triggered through `CopilotSidebar.tsx` to ask questions about a company.

### 3.5 Frontend State
- **Global**: Handled by React Query (`QueryClientProvider`) for API responses.
- **Local**: `useState` for component UI states (e.g., `copilotOpen`, `reasoningOpen` in `CompanyDetail.tsx`).

---

## PART 4 — FRONTEND DATA SOURCES

- **API (`src/services/api.ts`)**: Real backend API targeting `http://localhost:8000`. Used for `/analyze` and `/ask` endpoints. (COMPLETE)
- **Mock Data (`src/data/dummyData.ts`)**: Hardcoded data for companies list, news feed, and default values. Extensively consumed in `CompanyDetail.tsx` where backend data is absent or partially implemented. (MOCK/HARDCODED)
- **Browser Storage**: Not prominently utilized.

---

## PART 5 — BACKEND INVESTIGATION

### 5.1 API Routes
- **`POST /analyze`**: Orchestrates multi-agent analysis. Scrapes Screener data, transcripts, tracks guidance, runs 3 debaters (fundamental, sentiment, alt) in parallel, and coordinates a final scorecard. (COMPLETE, but some agents use mocks)
- **`POST /ask`**: Implements a RAG pipeline (`answer_with_rag`). Falls back to a generic QA agent if RAG fails. (COMPLETE)
- **`GET /health`**: Health check. (COMPLETE)

### 5.2 Services
- **Agents (`backend/agents/`)**: 
  - `fundamental_debater.py`, `sentiment_debater.py`, `alt_debater.py`: Evaluate specific company dimensions.
  - `coordinator.py`: Synthesizes debater arguments.
  - `ingestion_agent.py`: Discovers and processes PDFs from investor relations pages.
  - `qa_agent.py`: Fallback Q&A handler.
- **Scrapers**: 
  - `scraper.py` (ScreenerScraper): Pulls structured financial data.
  - `transcript_scraper.py`: Pulls documents and transcripts.

### 5.3 Models (`backend/models.py`)
- `CompanyInput`, `EquityResearchRequest`, `EquityResearchResponse`
- `AgentMessage`, `ScoreDimension`, `Scorecard`
- `GuidanceEntry`, `PeerComparison`
- `AskRequest`, `AskResponse`, `AskCitation`, `RetrievedChunk`

---

## PART 6 — DATABASE INVESTIGATION

- **Relational DB**: PostgreSQL via SQLAlchemy (`backend/storage/structured_store.py`).
  - Tables: `financials_quarterly`, `raw_documents`, `guidance_entries`.
  - Schema managed by declarative Base, initialized via `backend/scripts/init_db.py`.
- **Vector DB**: ChromaDB (`backend/storage/semantic_store.py`).
  - Collection: `equity_chunks`. Uses `all-MiniLM-L6-v2` embeddings.
- No explicit migration system (like Alembic) is configured.

---

## PART 7 — API CONTRACT MAPPING

- **Frontend Feature**: Company Analysis (`CompanyDetail.tsx`)
  - **API Call**: `POST /analyze` (via `useAnalyze` hook)
  - **Backend Endpoint**: `analyze` in `main.py`
  - **Backend Service**: Parallel debater execution + Coordinator
  - **Database Model**: Stores scraped data in `financials_quarterly` & `equity_chunks`, returns `EquityResearchResponse`.
- **Mismatch**: The frontend `CompanyDetail` relies heavily on `dummyData.ts` for company definitions and news feeds, rather than fetching this from a backend index.

---

## PART 8 — AUTHENTICATION AND AUTHORIZATION

**NONE.** There is no authentication or authorization layer implemented in the frontend or backend. All routes are unprotected.

---

## PART 9 — EXTERNAL SERVICES AND INTEGRATIONS

- **LLMs**: Gemini, Grok, Llama Cloud, OpenAI. (Configured via environment variables, used by agents and RAG pipeline).
- **Web Scraping**: Firecrawl, Exa.
- **Financial APIs**: Screener.in (scraped directly), DiscountingCashFlows (Earnings API configured in `config.py`).

---

## PART 10 — ENVIRONMENT AND CONFIGURATION

- **Backend** (`backend/.env` / `config.py`):
  - Keys: `GROK_API_KEY`, `GEMINI_API_KEY`, `EXA_API_KEY`, `LLAMA_CLOUD_API_KEY`, `FIRECRAWL_API_KEY`
  - DBs: `POSTGRES_URL`, `CHROMA_PERSIST_DIR`
  - Agent Models: `DEBATER_MODEL`, `COORDINATOR_MODEL`, `QA_MODEL`
- **Frontend** (`frontend/.env`):
  - `VITE_API_URL` (Defaults to `http://localhost:8000`)

---

## PART 11 — TESTING

- **Frontend**: Vitest and React Testing Library setup in `package.json`, though explicit test files were not identified in the immediate scan.
- **Backend**: `backend/tests/` directory exists. Found a `test_refactoring.py` script. Test coverage appears low/ad-hoc.

---

## PART 12 — DEPLOYMENT

No explicit deployment configuration (Dockerfiles, Kubernetes manifests, Vercel/Netlify configs, or CI/CD pipelines) found. Local development relies on Vite (`npm run dev`) and Uvicorn.

---

## PART 13 — TODO / FIXME / INCOMPLETE CODE

- **Frontend**:
  - `index.html`: `TODO: Set the document title`, `TODO: Update og:title`
  - `CopilotSidebar.tsx` & `SearchBar.tsx`: Hardcoded placeholders.
- **Backend**:
  - `sentiment_debater.py` (L27): Uses a "mock URL" for Firecrawl transcript scraping.
  - `alt_debater.py` (L10, L21, L27): Explicitly uses "mock" and "placeholder" for jobs counts and web traffic rank.

---

## PART 14 — BROKEN OR SUSPICIOUS FUNCTIONALITY

1. **Hardcoded Agent Logic**: `alt_debater.py` relies on hardcoded variables (`jobs_count = 15`, `traffic_rank = 5000`) rather than integrating actual alternative data APIs.
   - *Impact*: AI output is partially hallucinated/static.
   - *Confidence*: High.
2. **Frontend Data Dissonance**: `CompanyDetail.tsx` executes a heavy, state-of-the-art multi-agent backend analysis, but elements like News, basic company info, and historical stock data are injected from `dummyData.ts`.
   - *Impact*: UI will not reflect real-world data outside of the AI report section.
   - *Confidence*: High.

---

## PART 15 — FEATURE INVENTORY

| Feature | Frontend | Backend | Database | API | Status | Evidence |
| ------- | -------- | ------- | -------- | --- | ------ | -------- |
| Multi-Agent Debate | `CompanyDetail.tsx` | `main.py`, `agents/` | PostgreSQL | `/analyze` | PARTIAL | UI wired, backend works, but some agents mock data. |
| RAG Q&A | `CopilotSidebar.tsx`| `rag/pipeline.py` | ChromaDB | `/ask` | COMPLETE | API fully wired to RAG logic. |
| Dashboard Data | `Index.tsx` | N/A | N/A | N/A | MOCK | Relying on `dummyData.ts`. |
| Watchlist Management| `WatchlistsPage.tsx`| N/A | N/A | N/A | PARTIAL | Frontend UI exists; no backend endpoint found. |
| PDF Ingestion | N/A | `ingestion_agent.py`| Postgres/Chroma| N/A | COMPLETE | Backend code uses scrapers and Chroma chunks. |

---

## PART 16 — USER FLOW RECONSTRUCTION

**Company Analysis Flow (Inferred):**
```text
User 
 ↓
Landing Page (Index.tsx) -> Selects a Company
 ↓
CompanyDetail.tsx (Triggers `useAnalyze` Hook)
 ↓
POST /analyze
 ↓
Backend: Scrapes Screener -> Ingests PDFs -> Runs Debaters -> Runs Coordinator
 ↓
Returns Scorecard & Reasoning
 ↓
Frontend renders AI Report Tabs and overall score.
```

---

## PART 17 — FRONTEND/BACKEND COMPLETION ANALYSIS

- **Frontend**: High visual completion with Shadcn UI. Missing substantial backend connectivity for standard relational data (companies, lists, historical charts).
- **Backend**: High complexity implemented (Agno agents, RAG, scrapers), but lacks standard CRUD endpoints for UI state (e.g., fetching a list of companies).
- **Integration**: Mismatch. Frontend heavily uses mock data for layout while backend focuses purely on the AI analysis endpoints.

---

## PART 18 — WHAT WE KNOW VS WHAT WE DON'T KNOW

### CONFIRMED
- Stack is React/Vite/Tailwind + FastAPI/PostgreSQL/ChromaDB.
- AI logic leverages RAG and multi-agent debate patterns.
- No authentication system exists.

### INFERRED
- This project is a specialized Equity Research tool focusing on Indian equities (referenced in `main.py` app description).
- Intended to automate fundamental, sentiment, and alternative data analysis.

### UNKNOWN
- How stock market pricing and historical candlestick data are intended to be sourced (currently mocked).
- How watchlists are intended to be persisted (no DB tables or APIs exist for it).

### PRODUCT DECISIONS REQUIRED
- Should we integrate a real-time market data provider (e.g., Alpha Vantage, Yahoo Finance) for charts?
- Do we need user accounts and authentication to persist watchlists?
- Should alternative data APIs (LinkedIn, SimilarWeb) actually be purchased/integrated to fix the mocked debaters?

---

## PART 19 — FINAL PROJECT SUMMARY

1. **What does this project appear to be?** An AI-driven equity research platform.
2. **What problem does it solve?** Automating deep company research by having AI agents "debate" fundamentals and sentiment.
3. **Who uses it?** Investors or financial analysts.
4. **Major features:** Multi-agent AI analysis, RAG document Q&A, Watchlist management.
5. **Already implemented:** Complex AI backend pipelines, RAG, sleek frontend UI.
6. **Partially implemented:** Backend debaters (using mocks), frontend dashboard (using mocks).
7. **Missing:** Authentication, real-time market data API integrations, watchlist persistence.
8. **Broken:** `alt_debater` uses hardcoded placeholders.
9. **Mismatches:** Frontend UI expects full structural data (companies, charts, news) but backend only provides AI analysis.
10. **Database:** PostgreSQL (structured), ChromaDB (semantic).
11. **APIs:** `/analyze`, `/ask`, `/health`.
12. **Auth:** None.
13. **External services:** Grok, Gemini, Firecrawl, Exa, Screener.in.
14. **Biggest technical gaps:** Disconnect between frontend data expectations and backend capabilities; mocked data in AI agent logic.
15. **Unknown:** Source of truth for raw market data.
16. **Product decisions:** Market data vendor selection, auth implementation.

---

# INVESTIGATION COMPLETE

### Files Inspected
- `backend/main.py`
- `backend/models.py`
- `backend/config.py`
- `backend/storage/structured_store.py`
- `backend/storage/semantic_store.py`
- `backend/agents/ingestion_agent.py`
- `backend/rag/pipeline.py`
- `frontend/src/App.tsx`
- `frontend/src/pages/CompanyDetail.tsx`
- `frontend/src/services/api.ts`

### Areas That Could Not Be Determined
- Intended deployment strategy.

### Highest-Confidence Findings
- The application uses a multi-agent AI architecture with RAG fallback.
- The frontend relies on dummy data for non-AI features.

### Highest-Risk Unknowns
- Costs and feasibility of replacing the `alt_debater.py` mocks with real data streams (LinkedIn jobs, web traffic).
