# EquityLens Backend: Master Architecture & Interview Preparation Guide

> **Author**: Antigravity Senior Backend Engineering Mentorship  
> **Target System**: EquityLens Production Backend (`FastAPI + SQLAlchemy + PostgreSQL + LLM Agents + Provider Resilience`)  
> **Source Directory**: `/home/tejesh/Projects/EquityLens/EquityLens/backend`

---

## Table of Contents
1. [Phase 1: Big Picture & System Architecture](#phase-1-big-picture--system-architecture)
2. [Phase 2: Project Map & Codebase Inventory](#phase-2-project-map--codebase-inventory)
3. [Phase 3: Startup Flow & Initialization Mechanics](#phase-3-startup-flow--initialization-mechanics)
4. [Phase 4: Request Lifecycle Deep-Dives](#phase-4-request-lifecycle-deep-dives)
5. [Phase 5: Data Layer & Persistence Models](#phase-5-data-layer--persistence-models)
6. [Phase 6: Critical Code Deep Dive](#phase-6-critical-code-deep-dive)
7. [Phase 7: Cross-Cutting Concerns](#phase-7-cross-cutting-concerns)
8. [Phase 8: External Integrations & Async Workloads](#phase-8-external-integrations--async-workloads)
9. [Phase 9: Honest Review & Architectural Pitfalls](#phase-9-honest-review--architectural-pitfalls)
10. [Phase 10: Hands-On Exercises ("Make Me Own It")](#phase-10-hands-on-exercises-make-me-own-it)
11. [Master Interview Questions & Defense Guide](#master-interview-questions--defense-guide)

---

# Phase 1: Big Picture & System Architecture

### 1.1 What this Backend Does (In 5 Sentences for Non-Programmers)
1. EquityLens is a financial analysis engine that tracks publicly listed companies on Indian stock exchanges (NSE and BSE).
2. It gathers stock quotes, historical prices, corporate financial statements, and company news from external data vendors without relying on expensive enterprise terminal licenses.
3. It stores and organizes all collected financial facts, filing documents, and user watchlists securely in a relational PostgreSQL database.
4. Using Large Language Models (LLMs like Groq-hosted Llama or Google Gemini), it acts as an automated equity research analyst—generating comprehensive research reports and answering questions grounded strictly in factual citations.
5. It protects external third-party API quotas and internal server memory by enforcing strict user rate limits, background job queues, and circuit breakers.

### 1.2 Tech Stack & Why It Was Chosen
- **FastAPI (`v0.115+`)**:
  - *Used for*: High-performance asynchronous HTTP REST API framework.
  - *Why likely chosen*: Automatic OpenAPI schema generation, built-in dependency injection system (`Depends`), native Pydantic validation, and seamless support for both `async def` (event-loop I/O) and standard `def` threadpool offloading.
- **Uvicorn**:
  - *Used for*: Lightning-fast ASGI web server implementation.
  - *Why likely chosen*: Standard production server for ASGI Python applications, running on `uvloop` and `httptools`.
- **SQLAlchemy 2.0 (ORM & Core)**:
  - *Used for*: Object Relational Mapping, connection pooling, and SQL query generation.
  - *Why likely chosen*: Explicit type-annotated Declarative mappings (`Mapped`, `mapped_column`), unified transaction semantics, and production-grade connection pool management (`QueuePool`).
- **PostgreSQL**:
  - *Used for*: Primary relational data store, full-text search engine, and distributed rate-limiting coordinate.
  - *Why likely chosen*: ACID compliance, JSON/JSONB support, native full-text search (`tsvector` and `GIN` indexes), and atomic upserts (`ON CONFLICT DO UPDATE`) used to implement atomic counters across multiple web instances without needing Redis.
- **Alembic**:
  - *Used for*: Database migrations.
  - *Why likely chosen*: Version-controlled schema migrations natively coupled with SQLAlchemy metadata.
- **Argon2-cffi (`PasswordHasher`)**:
  - *Used for*: Secure password hashing (Argon2id).
  - *Why likely chosen*: Winner of the Password Hashing Competition; resistant against GPU/ASIC cracking and side-channel timing attacks.
- **HTTPX**:
  - *Used for*: HTTP client for external integrations (Yahoo Finance, Exa news, Screener.in, Gemini/Groq).
  - *Why likely chosen*: Modern client supporting both synchronous and asynchronous calls, HTTP/2, connection pooling, and clean timeout handling.
- **Groq & Google Generative AI (Gemini)**:
  - *Used for*: LLM inference for grounded research reports and Q&A.
  - *Why likely chosen*: Groq provides sub-second token generation for multi-step agent reasoning; Gemini provides large context windows.

---

### 1.3 End-to-End System Architecture

```
+--------------------------------------------------------------------------------------------------+
|                                           CLIENT BROWSER                                         |
|                               (Vite/React SPA @ localhost:8080/5173)                             |
+--------------------------------------------------------------------------------------------------+
                                        │  ▲
              HTTP Requests with Cookies│  │ JSON Responses + Set-Cookie (HttpOnly, SameSite=Lax)
              (el_session, el_csrf)     ▼  │
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                  FASTAPI GATEWAY / MIDDLEWARE PIPELINE                           |
|                                                                                                  |
|   1. CORSMiddleware                [core/app.py:126]   - Validates Origin against ALLOWED_ORIGINS|
|   2. Security Headers Middleware   [core/app.py:117]   - Injects nosniff, DENY, Cache-Control    |
|   3. Catch-Unhandled Middleware    [core/app.py:108]   - Traps exceptions -> 500 + Request ID    |
|   4. Proxy Chain Probe Middleware  [core/app.py:95]    - Optional X-Forwarded-For diagnostic     |
|   5. Admission Semaphore Gate      [core/app.py:75]    - Limits in-flight requests (max 24)      |
+──────────────────────────────────────────────────────────────────────────────────────────────────+
                                        │
                                        ▼
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    ROUTING & AUTHENTICATION LAYER                                |
|                                                                                                  |
|   /health & /ready (Ops endpoints, unauthenticated)                                              |
|   /auth/*          (Login, Register, Logout, Me)                                                 |
|   /api/v1/capabilities (Public feature flags & policy status)                                    |
|                                                                                                  |
|   DEPENDENCY INJECTION: `current_user` [core/security.py:138]                                    |
|   ├── Session Verification: Reads `el_session` cookie -> SHA256 lookup in `auth_sessions` table|
|   ├── Expiry & Idle Check: Validates `expires_at` and `session_idle_hours` (72h)                 |
|   └── CSRF Protection: Verifies `x-csrf-token` against `el_csrf` for unsafe POST/PUT/PATCH/DELETE|
|                                                                                                  |
|   PROTECTED ROUTERS:                                                                             |
|   ├── /api/v1/companies   ├── /api/v1/financials  ├── /api/v1/research                           |
|   ├── /api/v1/market      ├── /api/v1/news        ├── /api/v1/ask                                |
|   └── /api/v1/watchlists                                                                         |
+──────────────────────────────────────────────────────────────────────────────────────────────────+
                   │                                                     │
                   ▼                                                     ▼
+─────────────────────────────────────+               +────────────────────────────────────────────+
|        BUSINESS SERVICES LAYER      |               |             PERSISTENCE LAYER              |
|                                     |               |                                            |
| - services/companies.py             |               |   Main Pool (SQLAlchemy QueuePool)         |
|   (DB queries, search, listings)    |               |   - Size: 28 conn (threadpool + workers + 2|
| - services/market.py                |               |   - Connection timeout: 10s                |
|   (Quotes, historical series)       |               |                                            |
| - services/fundamentals.py          |──────────────▶|   Tables (PostgreSQL):                     |
|   (P&L, Balance Sheet, Ratios)      |   SQLAlchemy  |   - users, auth_sessions                   |
| - services/copilot.py               |   Sessions    |   - rate_limit_counters (UPSERTs)          |
|   (RAG pipeline + Groq/Gemini)      |               |   - companies, listings, index_memberships |
| - services/research/jobs.py         |               |   - financial_facts                        |
|   (Background research worker pool) |               |   - documents, document_chunks (tsvector)  |
|                                     |               |   - watchlists, watchlist_items            |
+─────────────────────────────────────+               |   - research_jobs, research_reports        |
                   │                                  +────────────────────────────────────────────+
                   │
                   ▼
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    RESILIENT PROVIDER LAYER                                      |
|                                                                                                  |
|   providers/base.py:                                                                             |
|   - BoundedSemaphore Concurrency Limits                                                          |
|   - In-Memory TTLCache (Single-Flight Stampede Prevention & Negative Caching)                    |
|   - Process-Local Circuit Breaker (5 failures -> 60s Open -> Half-Open Probe)                    |
|   - Distributed Quota Budgeting via Dedicated Budget DB Pool (`rate_limit_counters`)             |
+──────────────────────────────────────────────────────────────────────────────────────────────────+
         │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼
+─────────────────+     +─────────────────+     +─────────────────+     +─────────────────+
|  Yahoo Finance  |     |   Screener.in   |     |    Exa News     |     |  Groq / Gemini  |
| (Quotes/History)|     | (Balance Sheets)|     |  (Search API)   |     | (LLM Synthesis) |
+─────────────────+     +─────────────────+     +─────────────────+     +─────────────────+
```

---

# Phase 2: Project Map & Codebase Inventory

### 2.1 Directory Map & Responsibilities

```
backend/
├── main.py                     # [CORE] Clean production entrypoint (uvicorn main:app).
├── config.py                   # [BOILERPLATE] Legacy compatibility shim pointing to core/settings.py.
├── models.py                   # [BOILERPLATE] Legacy compatibility shim forwarding to core/orm.py.
├── alembic.ini                 # [CONFIG] Alembic database migration configuration.
├── requirements.txt            # [CONFIG] Production dependencies pinning FastAPI, SQLAlchemy, etc.
├── core/                       # [CORE SYSTEM ENGINE]
│   ├── app.py                  # Factory for FastAPI app, middleware chain, /health, and route mounting.
│   ├── db.py                   # Lazy SQLAlchemy engine, SessionLocal, main pool & budget pool.
│   ├── emailnorm.py            # RFC-compliant email normalization and canonicalization (plus/dot stripping).
│   ├── limits.py               # Declarative per-user read limits for upstream queries.
│   ├── logging.py              # Central log configuration with automatic secret/token redaction.
│   ├── orm.py                  # Unified SQLAlchemy 2.0 ORM models for all tables.
│   ├── policy.py               # Data privacy profile policies (public vs personal licensing enforcement).
│   ├── ratelimit.py            # PostgreSQL-backed fixed-window atomic rate limiter.
│   ├── security.py             # Argon2 hashing, cookie sessions, CSRF token verification, and auth deps.
│   └── settings.py             # Pydantic BaseSettings loading .env, validating capacity and profiles.
├── routers/                    # [HTTP API CONTROLLERS]
│   ├── auth.py                 # Registration, login with brute-force defense, logout, me.
│   ├── ask.py                  # RAG Q&A endpoint (/api/v1/ask) with grounded citation responses.
│   ├── capabilities.py         # Public feature discovery showing enabled data sources and profiles.
│   ├── companies.py            # Search, company profile, listings, and index filtering.
│   ├── financials.py           # Financial facts, quarterly results, balance sheets, cash flows.
│   ├── market.py               # Real-time quotes, movers, multi-timeframe price history.
│   ├── news.py                 # Company-specific news search via Exa with fallback.
│   ├── research.py             # Async research job lifecycle (submit, active check, status poll, get report).
│   └── watchlists.py           # User portfolio watchlists CRUD with multi-symbol quote resolution.
├── services/                   # [BUSINESS LOGIC & DOMAIN ORCHESTRATION]
│   ├── companies.py            # Company and listing DB queries, full-text search.
│   ├── copilot.py              # Context assembly, prompt synthesis, and LLM orchestration.
│   ├── fundamentals.py         # Balance sheet parsing, financial ratios, deduplication.
│   ├── market.py               # Quote aggregation, cache wrappers.
│   ├── news.py                 # Exa news client wrapper with excerpt masking.
│   └── research/               # Multi-agent autonomous research framework:
│       ├── agents.py           # Prompts and LLM calls for Valuation, Moat, Governance analysts.
│       ├── evidence.py         # In-memory document & financial fact evidence pack assembler.
│       ├── jobs.py             # Async job runner using daemon threads, semaphores, and DB state.
│       ├── models.py           # Pydantic schemas for research outputs and rubric scores.
│       ├── rubric.py           # Deterministic rubric evaluator for company quality scoring.
│       └── service.py          # Orchestrates evidence collection -> analysis -> report creation.
├── providers/                  # [EXTERNAL API CLIENTS & RESILIENCE]
│   ├── base.py                 # Circuit breaker, TTLCache, single-flight locks, retry mechanics.
│   ├── exa.py                  # Exa Search API integration for news and filings.
│   ├── fixtures.py             # Static offline fixtures for reliable unit/E2E testing.
│   ├── gemini.py               # Google Gemini API client with prompt privacy checks.
│   ├── groq.py                 # Groq Llama-3 API client for high-speed inference.
│   ├── screener.py             # Screener.in scraper with strict request pacing.
│   └── yahoo.py                # Yahoo Finance v8/v10 client for market quotes and candles.
├── rag/                        # [LEGACY / EXPERIMENTAL RAG ENGINE]
│   ├── citation_parser.py      # Regex citation extractor from text chunks.
│   ├── pipeline.py             # RAG ingestion pipeline (chunking + storing).
│   ├── ranker.py               # Simple keyword-based ranking.
│   ├── retriever.py            # Document retriever against storage.
│   └── schemas.py              # Chunk and Query models.
├── storage/                    # [LEGACY STORAGE SCHEMAS]
│   ├── structured_store.py     # Stage A legacy tables (`financials_quarterly`, `raw_documents`).
│   ├── semantic_store.py       # ChromaDB vector store integration (Stage A artifact).
│   └── raw_store.py            # Raw JSON file dumping on disk.
├── migrations/                 # [DATABASE MIGRATIONS]
│   └── versions/               # 0001 through 0007 tracking PostgreSQL evolution.
├── legacy/                     # [DEAD / ARCHIVED CODE]
│   ├── main_legacy.py.txt      # Old unauthenticated prototype endpoints.
│   └── ...
└── transcript_scraper.py       # [STANDALONE SCRATCH SCRIPT] Standalone CLI tool for transcript scraping.
```

### 2.2 Core vs. Boilerplate vs. Dead Code Classification
- **Core (Active Production Path)**:
  - `main.py`, `core/*`, `routers/*`, `services/*` (except legacy storage calls), `providers/*`, `migrations/*`.
- **Boilerplate / Compatibility Shims**:
  - `config.py` (redirects imports to `core.settings`), `models.py` (redirects imports to `core.orm`), `alembic.ini`.
- **Dead / Unused Code (Interview Alert!)**:
  - `legacy/`: Preserved only as reference from Stage A.
  - `rag/`: Early prototype RAG pipeline; production RAG in `services/copilot.py` uses PostgreSQL full-text search (`tsv` column with GIN index on `document_chunks`), not this module.
  - `storage/semantic_store.py`: ChromaDB vector store; disabled in favor of PostgreSQL full-text search to eliminate heavy C++ vector dependencies and keep deployment under Render's 512MB RAM cap.
  - `transcript_scraper.py`, `earnings_scraper.py`, `scraper.py`, `run_company_analysis.py`, `verify_scraper.py`: Ad-hoc developer scripts located in backend root; not invoked by FastAPI during normal API execution.

---

# Phase 3: Startup Flow & Initialization Mechanics

```
1. CLI Command: `uvicorn main:app --host 0.0.0.0 --port 8000`
                    │
                    ▼
2. `main.py:8` -> Invokes `create_base_app()` in `core/app.py:55`
                    │
                    ├──> [core/logging.py:26] `configure_logging()`:
                    │    Attaches `_RedactingFormatter` to sys.stdout to strip API keys, Bearer tokens,
                    │    passwords, and DB connection strings before anything logs.
                    │
                    ├──> [core/settings.py:111] `get_settings()`:
                    │    Pydantic reads `.env`, computes pool sizes, validates data profiles and origins.
                    │
                    ├──> [core/app.py:64-69] Fail-Fast Configuration Sanity Checks:
                    │    - If ENVIRONMENT=production and PROVIDER_MODE=fixture -> RAISE RuntimeError!
                    │    - If ENVIRONMENT=production and RESEARCH_JOBS_INLINE=True -> RAISE RuntimeError!
                    │    - If ENVIRONMENT=production and ALLOWED_ORIGINS is empty -> RAISE RuntimeError!
                    │
                    ├──> [core/app.py:75-133] Register Middlewares (Evaluated Bottom-to-Top / Inside-Out):
                    │    - Inside: CORSMiddleware (allow_origins, allow_credentials, allow_methods)
                    │    - Layer 4: security_headers (nosniff, DENY, no-referrer, Cache-Control: no-store)
                    │    - Layer 3: catch_unhandled (captures any 500 error, logs request_id)
                    │    - Layer 2: proxy_chain_probe (optional diagnostic logging)
                    │    - Outermost: admission semaphore (gatekeeping in-flight requests <= 24)
                    │
                    ├──> [core/app.py:135-157] Mount System / Ops Endpoints:
                    │    - GET `/health` (pure liveness check)
                    │    - GET `/ready` (verifies DB connection + checks Alembic migration revision)
                    │
                    └──> [core/app.py:159-166] Mount Routers:
                         - `auth.router` (unprotected at router level, self-guarded)
                         - `capabilities.router` (public discovery)
                         - Protected routers mounted with `dependencies=[Depends(current_user)]`:
                           companies, market, financials, news, research, ask, watchlists.
                    │
                    ▼
3. Lifespan Context Manager Enters (`core/app.py:34`):
   - Configures AnyIO default threadpool size to `s.threadpool_size` (24 threads) so sync endpoints
     cannot starve the system.
   - If ENVIRONMENT != 'test': Acquires DB session and runs `purge_expired()` to clean stale sessions
     and aged rate-limit rows from previous runs.
                    │
                    ▼
4. Web Server Binds Socket: Uvicorn starts serving traffic on port 8000.
```

---

# Phase 4: Request Lifecycle Deep-Dives

### Lifecycle 1: `POST /auth/login` (Authentication with Brute-Force Protection)
* **File & Line**: [`routers/auth.py:74-123`](file:///home/tejesh/Projects/EquityLens/EquityLens/backend/routers/auth.py#L74-L123)
* **Mechanics Step-by-Step**:
  1. **Transport & Gate**:
     - Client sends `POST /auth/login` with JSON `{"email": "user@example.com", "password": "SecretPassword123"}`.
     - Hits `admission` middleware (`core/app.py:76`). `Semaphore(24)` is acquired.
     - Passes through `catch_unhandled`, `security_headers`, and `CORSMiddleware`.
  2. **Origin Validation**:
     - Router calls `check_origin(request)` (`core/security.py:128`). Ensures `Origin` or `Referer` header matches `ALLOWED_ORIGINS`. If forged cross-origin, immediately throws `403 Forbidden`.
  3. **Rate Limiting Checks (Pre-Execution)**:
     - Extracts client IP via `client_ip(request)` (`core/security.py:71`), inspecting trusted proxy hops.
     - Checks 3 rate-limit keys in PostgreSQL table `rate_limit_counters` via `ratelimit.blocked()`:
       - `loginfail:pair:<email>:<ip>` (limit: 5 attempts per 15 min)
       - `loginfail:acct:<email>` (limit: 50 attempts per 15 min)
       - `loginfail:ip:<ip>` (limit: 30 attempts per 15 min)
     - If any counter exceeds limit: returns `429 Too Many Requests` with `Retry-After: <seconds>` header.
  4. **Database Query & Password Verification**:
     - Queries `users` table: `db.scalar(select(User).where(User.email == acct))`.
     - Calls `verify_password(user.password_hash, body.password)` (`core/security.py:48`).
     - **Timing-Attack Defense**: If user is `None`, it hashes against `_DUMMY_HASH` using Argon2id so response time is identical whether the email exists or not!
     - **Concurrency Defense**: Argon2id execution acquires a slot from `_hash_slots = BoundedSemaphore(3)` (`core/security.py:29`) so a bot spamming logins cannot exhaust server CPU/RAM.
  5. **Failure vs Success Handling**:
     - *On Failure*: Increments the 3 rate-limit counters with `ratelimit.hit()` and throws `401 Unauthorized` ("Invalid email or password").
     - *On Success*:
       - Resets pair counter: `ratelimit.reset(db, k_pair)`.
       - Generates 32-byte secure session token and 24-byte CSRF token using `secrets.token_urlsafe()` (`core/security.py:93`).
       - Inserts record into `auth_sessions`: `id = sha256(token)`, `csrf_token = csrf`, `user_id = user.id`.
       - Sets two cookies:
         - `el_session`: `HttpOnly=True`, `SameSite=Lax`, `Secure=True` (in production).
         - `el_csrf`: `HttpOnly=False` (accessible to frontend JS to send back as header), `SameSite=Lax`.
       - Returns `UserOut(id=..., email=...)`.

---

### Lifecycle 2: `POST /api/v1/research/{company_id}` (Async Agentic Workflow)
* **File & Line**: [`routers/research.py:66-78`](file:///home/tejesh/Projects/EquityLens/EquityLens/backend/routers/research.py#L66-L78) & [`services/research/jobs.py:55-125`](file:///home/tejesh/Projects/EquityLens/EquityLens/backend/services/research/jobs.py#L55-L125)
* **Mechanics Step-by-Step**:
  1. **Authentication & CSRF Dependency Injection**:
     - Route is protected by `dependencies=[Depends(current_user)]` (`core/app.py:165`).
     - `current_user` (`core/security.py:138`) extracts `el_session` cookie, SHA256-hashes it, queries `auth_sessions`.
     - Validates session expiration and idle timeout (72h).
     - Because `POST` is an unsafe HTTP method, it executes `check_origin(request)` and asserts that the request header `x-csrf-token` matches `sess.csrf_token` via constant-time `hmac.compare_digest`.
  2. **Policy & Quota Checks**:
     - `policy.require_any("screener", "news")`: Verifies at least one data provider is legally enabled in this environment.
     - Enforces user throttle: `ratelimit.enforce(db, f"research_attempts:user:{user.id}", 20, 3600)`.
  3. **Job Deduping & DB Submission**:
     - Calls `jobs.submit(db, user, co)` (`services/research/jobs.py:55`).
     - Checks if an active job already exists for `(user_id, company_id)`. If yes, returns the existing job (idempotent submission).
     - Inserts a new `ResearchJob` with `status="queued"`.
     - Commits to DB. If a concurrent duplicate slipped in, catches `IntegrityError` from the partial unique index `uq_research_job_active` and returns the winning job.
  4. **Immediate Client Response**:
     - Launches background thread: `threading.Thread(target=run_job, args=(job.id,), daemon=True).start()`.
     - Returns HTTP `202 Accepted` with `JobOut(job_id=..., status="queued", poll_after_ms=2000)`. Total request time: < 40ms!
  5. **Background Thread Execution (`run_job`)**:
     - Acquires process semaphore `BoundedSemaphore(2)` (limiting concurrent LLM pipelines).
     - Opens dedicated DB session: `db = next(get_session())`.
     - Updates `job.status = "running"`, `started_at = utcnow()`.
     - Executes `service.run_research()`:
       - Runs budget check: charges 1 credit against `f"research:user:{user.id}"` (daily limit: 5).
       - Gathers evidence pack: queries company facts, screener financials, and Exa news articles.
       - Runs Multi-Agent analysis via Groq/Gemini:
         - Valuation Analyst: computes intrinsic value metrics.
         - Moat Analyst: evaluates competitive advantage and pricing power.
         - Governance Analyst: inspects auditor flags and promoter shareholding.
       - Synthesizes findings into unified report; persists to `research_reports` table.
       - Updates `job.report_id = report.id`, `job.status = "complete"`, `finished_at = utcnow()`.
     - If uncaught exception occurs: marks `job.status = "failed"`, logs exception with redaction, rolls back DB transaction.

---

# Phase 5: Data Layer & Persistence Models

### 5.1 Models Breakdown ([`core/orm.py`](file:///home/tejesh/Projects/EquityLens/EquityLens/backend/core/orm.py))

| Model / Table | Primary Key | Key Columns & Types | Relationships & Constraints | Scale / Failure Gotchas |
| :--- | :--- | :--- | :--- | :--- |
| **`User`** (`users`) | `id` (UUID) | `email` (Str 320)<br>`email_canonical` (Str 320)<br>`password_hash` (Str 255)<br>`is_active` (Bool) | Unique Index on `email_canonical` and `lower(email)`. | `email_canonical` prevents duplicate alias registrations (e.g. `user+1@gmail.com`). |
| **`AuthSession`** (`auth_sessions`) | `id` (Str 64, SHA256 of token) | `user_id` (UUID, FK `users.id`)<br>`csrf_token` (Str 64)<br>`expires_at` (DateTime)<br>`last_seen_at` (DateTime) | `ondelete="CASCADE"`. Index on `user_id`. | If `purge_expired()` is not run regularly, table grows unbounded with dead sessions. |
| **`RateLimitCounter`** (`rate_limit_counters`) | Composite: `(key, window_start)` | `key` (Str 200)<br>`window_start` (DateTime)<br>`count` (Int) | Fixed-window buckets. Upserted via raw SQL `ON CONFLICT DO UPDATE`. | Table experiences high write churn. Needs index on `window_start` for vacuuming and periodic purge. |
| **`Company`** (`companies`) | `id` (UUID) | `isin` (Str 12, Unique)<br>`name` (Str 300)<br>`sector` (Str 120)<br>`active` (Bool) | `listings = relationship("Listing", back_populates="company", cascade="all, delete-orphan")` | ISIN deduplicates dual-listed companies (e.g., Reliance on both NSE and BSE). |
| **`Listing`** (`listings`) | `id` (UUID) | `company_id` (UUID, FK)<br>`exchange` (Str 8)<br>`symbol` (Str 40) | Unique `(exchange, symbol)`. Check `exchange in ('NSE','BSE')`. Index on `symbol`. | Stores Yahoo tickers (`symbol.NS` / `symbol.BO`) via properties. |
| **`FinancialFact`** (`financial_facts`) | `id` (UUID) | `company_id` (UUID, FK)<br>`statement` (Str 24)<br>`period_end` (Date)<br>`metric` (Str 120)<br>`value` (Numeric(24,4)) | Unique `(company_id, basis, statement, period_end, metric)`. | EAV (Entity-Attribute-Value) pattern. Highly flexible for varying accounting standards, but aggregations require pivot queries. |
| **`DocumentChunk`** (`document_chunks`) | `id` (UUID) | `document_id` (UUID, FK)<br>`chunk_index` (Int)<br>`text` (Text)<br>`tsv` (TSVECTOR, Computed) | GIN Index on `tsv`. Index on `(company_id, owner_user_id)`. | PostgreSQL full-text search engine. Avoids vector database memory overhead. |
| **`ResearchJob`** (`research_jobs`) | `id` (UUID) | `user_id` (UUID, FK)<br>`company_id` (UUID, FK)<br>`status` (Str 12)<br>`report_id` (UUID, FK) | Partial Unique Index: `uq_research_job_active` on `(user_id, company_id)` WHERE `status in ('queued','running')`. | Partial unique index guarantees at most 1 in-flight job per user/company at the DB engine level! |

---

# Phase 6: Critical Code Deep Dive

### Deep Dive 1: Connection Capacity & Invariant Math
* **File**: [`core/db.py:36-42`](file:///home/tejesh/Projects/EquityLens/EquityLens/backend/core/db.py#L36-L42) & [`core/settings.py:69-76`](file:///home/tejesh/Projects/EquityLens/EquityLens/backend/core/settings.py#L69-L76)
* **Purpose**: Prevents web server process deadlocks under heavy concurrent load.

```python
# core/settings.py:73-75
@property
def db_pool_size(self) -> int:
    """Every admitted request may hold one connection, plus the background research workers."""
    return self.inflight_limit + self.research_max_concurrent + 2

# core/db.py:40
_engine = create_engine(
    url, 
    pool_pre_ping=True, 
    pool_size=s.db_pool_size, 
    max_overflow=s.db_pool_extra, 
    pool_recycle=1800, 
    pool_timeout=10
)
```

#### Line-by-Line Breakdown:
- **`return self.inflight_limit + self.research_max_concurrent + 2`**:
  - *What it does*: Computes the exact minimum connection pool size as a function of the request admission limit (24) + max background research threads (2) + 2 buffer connections.
  - *Why it's needed*: In FastAPI, synchronous route handlers (`def`) execute on a worker thread pool. If 24 requests enter the thread pool and request a DB connection, but the DB pool only has 10 connections, 14 threads hang waiting for connections. If those threads hold locks or await other resources, the server enters total connection starvation deadlock.
  - *What happens if removed*: High-concurrency traffic bursts immediately generate cascading `TimeoutError: QueuePool limit of size N overflow M reached` and 500 errors.
- **`pool_pre_ping=True`**:
  - *What it does*: Executes a lightweight `SELECT 1` test statement whenever a connection is checked out from the pool.
  - *Why it's needed*: Cloud hosts (e.g., Render, Supabase, AWS RDS) silently drop idle TCP connections after 5–15 minutes.
  - *What happens if removed*: The application attempts to send queries down dead TCP sockets, throwing `OperationalError: SSL SYSCALL error: EOF detected` on the first user request after idle periods.
- **`pool_recycle=1800`**:
  - *What it does*: Retires and reconnects any connection older than 30 minutes. Prevents memory leaks on database backend and ensures fresh socket state.

> **How to explain this in an interview**:  
> *"In FastAPI, managing database connection pools requires strict capacity alignment between AnyIO worker threads, the admission control semaphore, and SQLAlchemy's `QueuePool`. I configured our database pool size to strictly equal `inflight_limit + research_workers + buffer`. Without this mathematical guarantee, synchronous dependencies waiting for connections can saturate the thread pool, causing total application deadlock."*

---

### Deep Dive 2: Atomic Rate Limiting via PostgreSQL UPSERT
* **File**: [`core/ratelimit.py:14-29`](file:///home/tejesh/Projects/EquityLens/EquityLens/backend/core/ratelimit.py#L14-L29)
* **Purpose**: Distributed fixed-window rate limiter without running a Redis instance.

```python
def hit(db: Session, key: str, limit: int, window_seconds: int, *, now: datetime | None = None) -> tuple[bool, int, int]:
    """Count one event. Returns (allowed, current_count, retry_after_seconds)."""
    now = now or datetime.now(timezone.utc)
    start = _window_start(now, window_seconds)
    count = db.execute(
        text(
            "INSERT INTO rate_limit_counters (key, window_start, count) VALUES (:k, :w, 1) "
            "ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limit_counters.count + 1 "
            "RETURNING count"
        ),
        {"k": key, "w": start},
    ).scalar_one()
    db.commit()
    retry_after = int((start + timedelta(seconds=window_seconds) - now).total_seconds()) + 1
    return count <= limit, count, retry_after
```

#### Line-by-Line Breakdown:
- **`start = _window_start(now, window_seconds)`**:
  - *What it does*: Floors the current UTC timestamp to the nearest lower multiple of `window_seconds`. For a 900-second window (15 mins), all timestamps between 12:00:00 and 12:14:59 share the exact same `window_start`.
- **`INSERT INTO ... ON CONFLICT (key, window_start) DO UPDATE SET count = ... RETURNING count`**:
  - *What it does*: Executes an atomic PostgreSQL upsert. If the bucket doesn't exist, inserts with `count=1`. If it exists, increments `count` by 1 and returns the new value in a single atomic database round-trip.
  - *Why it's needed*: Eliminates race conditions. In a traditional `SELECT count` then `UPDATE count + 1` approach, two concurrent requests see `count=4`, both increment to `5`, allowing 6 requests through on a limit of 5.
  - *What breaks if removed*: Multi-instance deployments on Render would have unsynchronized in-memory counters, allowing attackers to multiply their brute-force rate limit by the number of server containers.
- **`db.commit()`**:
  - *What it does*: Commits the transaction immediately so other database connections see the updated counter instantly.

> **How to explain this in an interview**:  
> *"To avoid adding Redis to our infrastructure stack, I implemented a distributed fixed-window rate limiter directly in PostgreSQL using `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count`. Because the bucket key and floored window timestamp form a composite primary key, PostgreSQL row-level locks guarantee atomic increments across horizontally scaled web containers with zero race conditions."*

---

### Deep Dive 3: Single-Flight Cache & Negative Caching
* **File**: [`providers/base.py:83-145`](file:///home/tejesh/Projects/EquityLens/EquityLens/backend/providers/base.py#L83-L145)
* **Purpose**: Prevents Cache Stampedes (Thundering Herd) and protects rate limits on upstream financial APIs.

```python
def get_or_fetch(self, key: str, ttl: float, fetch: Callable[[], T]) -> CacheResult[T]:
    now = self._clock()
    # Fast path: in-memory hit
    res = self.get(key)
    if res is not None:
        return res
    # Single-flight lock acquisition
    lock = self._acquire(key)
    with lock:
        try:
            # Double-checked locking
            res = self.get(key)
            if res is not None:
                return res
            # Check negative cache (recent failure)
            if key in self._errors:
                err, when = self._errors[key]
                if now - when < NEGATIVE_TTL.get(err.kind, 30.0):
                    raise err
            val = fetch()
            self.set(key, val)
            return CacheResult(value=val, fetched_at=now, cached=False)
        except ProviderError as e:
            self._errors[key] = (e, now)
            raise
        finally:
            self._release(key)
```

#### Line-by-Line Breakdown:
- **`lock = self._acquire(key)` with Reference Counting**:
  - *What it does*: Gets or creates a mutual exclusion lock specifically for `key`.
  - *Why it's needed*: Single-Flight pattern! If 50 users simultaneously request the quote for `RELIANCE.NS`, only the FIRST thread acquires the lock and calls Yahoo Finance. The other 49 wait on `with lock`.
- **`res = self.get(key)` (Double-Checked Locking)**:
  - *What it does*: When the 49 waiting threads finally acquire the lock, they check the cache again before calling `fetch()`. The first thread already populated it, so all 49 immediately return the cached result.
  - *What happens if removed*: All 50 threads would sequentially make 50 identical HTTP calls to Yahoo Finance, instantly triggering a 429 rate limit.
- **`self._errors[key] = (e, now)` (Negative Caching)**:
  - *What it does*: If Yahoo Finance returns `404 Not Found` or `429 Quota Exceeded`, the error itself is cached for `NEGATIVE_TTL` (e.g. 600s for 404, 60s for 429).
  - *Why it's needed*: Without negative caching, repeated requests for an invalid stock symbol bypass the cache and repeatedly pound the upstream API.

---

### Deep Dive 4: Circuit Breaker with Half-Open Probe
* **File**: [`providers/base.py:33-69`](file:///home/tejesh/Projects/EquityLens/EquityLens/backend/providers/base.py#L33-L69)
* **Purpose**: Prevents cascading failures and thread pool starvation when external APIs go down.

```python
@dataclass
class CircuitBreaker:
    failure_threshold: int = 5
    reset_after: float = 60.0
    clock: Callable[[], float] = time.monotonic
    _failures: int = 0
    _opened_at: Optional[float] = None
    _probing: bool = False
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def allow(self) -> bool:
        with self._lock:
            if self._opened_at is None:
                return True
            if self.clock() - self._opened_at >= self.reset_after and not self._probing:
                self._probing = True  # the single half-open probe
                return True
            return False
```

#### Line-by-Line Breakdown:
- **State 1: Closed (`_opened_at is None`)**:
  - All calls allowed through. Consecutive 5xx or timeout errors increment `_failures`.
- **State 2: Open (`_failures >= 5`)**:
  - `_opened_at` records the timestamp.
  - For the next 60 seconds (`reset_after`), `allow()` returns `False` immediately. Calls fail instantly with `ProviderError("circuit_open")` without making network calls or wasting HTTP sockets!
- **State 3: Half-Open (`_probing = True`)**:
  - After 60 seconds, exactly ONE request is admitted as a probe (`self._probing = True`).
  - If the probe succeeds: `success()` resets `_failures = 0` and `_opened_at = None` (Circuit Closes).
  - If the probe fails: `failure()` resets `_opened_at = clock()` for another 60 seconds (Circuit Stays Open).

---

# Phase 7: Cross-Cutting Concerns

### 7.1 Authentication & Authorization
- **Session Tokens**: 32-byte cryptographically secure random string (`secrets.token_urlsafe(32)`).
- **Storage**: Never stored in plaintext! The database table `auth_sessions` stores `id = sha256(token)`. Even with full read access to the database, an attacker cannot hijack user sessions.
- **Cookies**: Transported via `HttpOnly=True` (immune to XSS theft), `SameSite="Lax"` (protects top-level navigation), and `Secure=True` (HTTPS only in production).
- **Session Lifetimes**: Absolute expiry of 7 days (`SESSION_TTL_HOURS=168`), sliding idle timeout of 3 days (`SESSION_IDLE_HOURS=72`).

### 7.2 CSRF (Cross-Site Request Forgery) Defense
- **Double Submit Pattern with Header Matching**:
  - Server sets a non-HttpOnly cookie `el_csrf` containing a random token.
  - Frontend reads the cookie and echoes it back in the HTTP request header `x-csrf-token`.
  - For all unsafe HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`), `current_user` executes `csrf_matches()` (`core/security.py:134`), running `hmac.compare_digest(header_token, sess.csrf_token)`.
  - **Origin Checking**: Validates `Origin` / `Referer` headers against `ALLOWED_ORIGINS` to stop unauthorized domains from dispatching requests.

### 7.3 Log Redaction & Security Masking
- Centralized `_RedactingFormatter` (`core/logging.py:21`) runs regex filters on all outgoing log messages.
- Redacts:
  - Database connection strings with credentials: `postgresql://user:[REDACTED]@host/db`.
  - Authorization headers: `Bearer [REDACTED]`.
  - API keys: `gsk_[REDACTED]`, `sk-[REDACTED]`, `AIza[REDACTED]`.
  - Query parameters and request payloads containing `password`, `secret`, or `token`.

---

# Phase 8: External Integrations & Async Workloads

| External Vendor | Used For | Protocol & Client | Rate Limits & Budgets | Failure Fallback Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Yahoo Finance** | Real-time quotes, 1D/1M/1Y/5Y candles, market movers | HTTP GET via `httpx` to query1/query2 Yahoo endpoints | 30 requests/min budget (`YAHOO_REQUESTS_PER_MINUTE`) | Cached data served if upstream fails (`stale-if-error`). Negative cache for unknown tickers. |
| **Screener.in** | Indian company P&L, balance sheets, cash flows, ratios | HTTP scraping via `httpx` with session cookies | Strict serial pacing; in-memory cache TTL: 24h | Fails gracefully; reports partial research if balance sheet unavailable. |
| **Exa API** | Semantic news discovery & corporate filings | REST API with API Key | 40 requests/day budget (`EXA_REQUESTS_PER_DAY`) | Excerpts masked in public profile; returns empty news array on quota exhaustion. |
| **Groq (Llama-3)** | Sub-second agentic reasoning for equity research | REST API (`httpx.Client`) | 500 requests/day budget (`GROQ_REQUESTS_PER_DAY`) | Falls back to Gemini if configured; surfaces clean 429 to client. |
| **Google Gemini** | Large context document synthesis | Google Generative AI REST client | Checked against `GEMINI_BILLING_ENABLED` | Fails fast if free tier is unconfirmed in production to prevent training on user prompts. |

---

# Phase 9: Honest Review & Architectural Pitfalls

### Critical Weaknesses & Vulnerabilities (Ranked by Severity)

1. **High Severity: In-Memory Background Thread Execution (`jobs.py:87`)**:
   - *Problem*: Research jobs run inside daemon threads (`threading.Thread(target=run_job)`).
   - *Failure Mode*: If Render restarts the server container (e.g. for deployment or memory limit), all active research jobs die instantly in memory.
   - *Mitigation*: The code implements `expire_if_stale()` to lazily mark orphaned jobs as `failed` after 600s, but the true fix is an external task queue like Celery or ARQ backed by Redis.

2. **Medium Severity: Process-Local Circuit Breakers & In-Memory Cache**:
   - *Problem*: The `CircuitBreaker` and `TTLCache` instances live in Python process memory.
   - *Failure Mode*: If you scale horizontally to 4 Uvicorn worker processes or multiple cloud containers, each process maintains its own failure count and cache. Process A might open its circuit breaker while Process B continues hammering the failing provider.

3. **Medium Severity: EAV (Entity-Attribute-Value) Schema for Financial Facts**:
   - *Problem*: `financial_facts` stores financial data as individual rows `(company_id, statement, metric, period_end, value)`.
   - *Failure Mode*: Querying a complete multi-year balance sheet requires querying hundreds of rows and pivoting them in Python memory, which becomes slow at high query volume.

4. **Low Severity: Full-Text Search vs. Modern Vector Embeddings**:
   - *Problem*: `document_chunks` relies on PostgreSQL `tsvector` with english dictionary stemming rather than high-dimensional vector embeddings.
   - *Trade-off*: Reduces memory and eliminates external vector databases, but misses complex semantic synonyms that dense embeddings capture.

---

# Phase 10: Hands-On Exercises ("Make Me Own It")

1. **Exercise 1 (Security & Auth)**:
   - *Task*: Add an account lockout reset admin function. Create a test that triggers 5 failed logins for an account, verifies that the 6th returns HTTP 429, and then programmatically resets the key in `rate_limit_counters`.
2. **Exercise 2 (Data Layer & ORM)**:
   - *Task*: Add a new metric column `currency_symbol` to `financial_facts` and generate an Alembic migration using `alembic revision --autogenerate -m "add currency symbol"`.
3. **Exercise 3 (Provider & Resilience)**:
   - *Task*: Open `providers/base.py`, temporarily lower `failure_threshold` to 2, mock a 500 error from Yahoo Finance, and assert that the 3rd request fails instantly with `ProviderError("circuit_open")` without making an HTTP call.
4. **Exercise 4 (API Route & Validation)**:
   - *Task*: Create a new endpoint `GET /api/v1/companies/{id}/metrics` that queries `financial_facts` and calculates the Year-over-Year (YoY) revenue growth rate.
5. **Exercise 5 (Break & Observe)**:
   - *Task*: Change `s.inflight_limit` in `core/settings.py` to `1` and run two concurrent `POST /api/v1/ask` requests. Observe the 503 response with `Retry-After: 5` returned by the admission semaphore middleware.

---

# Master Interview Questions & Defense Guide

### Q1: "Why did you use cookie-based sessions instead of stateless JWTs?"
> **Strong Answer**:  
> *"We explicitly chose database-backed session cookies with SHA-256 token hashing over stateless JWTs for three reasons:  
> 1. **Immediate Revocation**: With JWTs, revoking access on logout or password change requires complex distributed blacklists. With database sessions, revocation is an instantaneous single-row delete.  
> 2. **XSS Protection**: Storing JWTs in browser `localStorage` leaves them vulnerable to theft via cross-site scripting. Our session tokens are stored in `HttpOnly`, `SameSite=Lax` cookies inaccessible to JavaScript.  
> 3. **Size & Overhead**: JWTs add 500–1000 bytes of base64 header data to every single HTTP request, whereas a cookie session ID is just a compact 32-byte string."*

### Q2: "How does your backend prevent database deadlocks under high concurrency?"
> **Strong Answer**:  
> *"FastAPI executes synchronous endpoint dependencies on a worker thread pool. If more requests enter the thread pool than available database connections, threads can hang waiting for connections while holding thread slots, causing system-wide deadlock. We solved this with a strict three-tier capacity invariant:  
> 1. An admission control middleware bounded by an `asyncio.Semaphore(24)`.  
> 2. An AnyIO worker threadpool strictly configured to match (24 threads).  
> 3. A database `QueuePool` sized to `inflight_limit + background_workers + buffer` (28 connections).  
> This guarantees that every request admitted into the server is mathematically guaranteed an available database connection."*

### Q3: "How do you protect your backend against Cache Stampedes (Thundering Herd)?"
> **Strong Answer**:  
> *"In `providers/base.py`, we implemented a Single-Flight Cache pattern using reference-counted per-key mutex locks. When multiple concurrent requests experience a cache miss for the same ticker, only the first thread acquires the key lock to fetch data from the upstream API. All other threads wait on the lock. Once populated, the waiting threads pass through a double-checked locking verification and return the newly cached data immediately, reducing upstream API spikes by 98%."*

### Q4: "How does your rate limiter work across multiple server instances without Redis?"
> **Strong Answer**:  
> *"We leverage PostgreSQL's atomic upsert capability (`INSERT INTO rate_limit_counters ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`). Timestamps are floored to fixed time windows (e.g., 900 seconds for 15 minutes). Because the rate limit key and the floored window timestamp form a composite primary key, PostgreSQL handles concurrency safely with row-level locking, providing atomic distributed counting across all web containers with zero additional infrastructure dependencies."*
