# PRODUCT REQUIREMENTS DOCUMENT — EquityLens

**Status**: Draft for engineering handoff (precedes TRD)
**Primary source of truth**: `PROJECT_RECONSTRUCTION.md` (itself derived from `PROJECT_AUDIT.md` and `PROJECT_AUDIT_DEEP_DIVE.md`)
**Purpose of this document**: Define the product EquityLens should become, grounded in what has actually been built, with all unresolved product decisions explicitly surfaced rather than silently resolved.

Evidence-status labels used throughout, carried directly from the reconstruction:
- **CONFIRMED** — directly supported by audit evidence
- **STRONGLY INFERRED** — not explicit, but well-supported
- **POSSIBLE** — plausible, insufficient evidence to treat as intended
- **UNKNOWN** — cannot be determined
- **PRODUCT DECISION REQUIRED** — needs an intentional decision, not resolvable from evidence

Where this PRD makes a decision in order to remain coherent, it is explicitly labeled **[MINIMUM VIABLE DECISION]** and distinguished from historical intent — no such label implies this was the original developer's plan.

---

## 1. EXECUTIVE SUMMARY

EquityLens is an AI-driven equity research application. Its working core is a multi-agent analysis pipeline: given a company, three specialized AI "debater" agents (fundamental, sentiment, and alternative-data) independently evaluate the company, and a coordinator agent synthesizes their outputs into a scored, evidence-backed research scorecard. A separate retrieval-augmented Q&A ("Copilot") feature lets users ask free-form questions grounded in ingested investor-relations documents, with citations. *(CONFIRMED — reconstruction §1, §4)*

The problem this solves is the manual effort of equity research: gathering fundamentals, sentiment signals, and alternative data, then synthesizing them into a coherent view — a process EquityLens automates via parallel AI agents. *(STRONGLY INFERRED — reconstruction §2)*

The best-supported target user is an equity researcher or financial analyst, plausibly focused on Indian equities given the Screener.in data source; this audience inference is strong but not confirmed by any stated persona. *(STRONGLY INFERRED — reconstruction §3)*

**Current implementation state**: The AI analysis pipeline (`/analyze`) and RAG Copilot (`/ask`) are genuinely functional end-to-end. Nearly everything else visible in the frontend — company browsing, prices, charts, news, and watchlists — is presented through a static mock dataset with no backend behind it. No authentication exists. No deployment infrastructure exists. *(CONFIRMED — reconstruction §13, §14)*

**Intended completed product** (as defined by this PRD): A coherent, usable equity-research application that preserves and builds on the working AI core, with just enough supporting product infrastructure (company discovery, presentation of the analysis, and clear evidence/confidence communication) to make that core usable as a real product — without assuming every currently-mocked frontend surface must be built out, and without silently deciding open questions like authentication, market-data sourcing, or watchlist persistence.

---

## 2. PRODUCT DEFINITION

### Product Name
EquityLens

### Product Category
An AI-assisted equity research and analysis tool (not a trading platform, not a portfolio manager, not a general financial chatbot). *(STRONGLY INFERRED from feature set — reconstruction §4, §18)*

### Product Vision
Enable a user to get a synthesized, multi-perspective, evidence-backed view of a company's investment case, and to interrogate that view conversationally — replacing scattered manual research with one guided workflow.

### Product Mission
Reduce the effort of producing and defending an initial equity research view by automating the synthesis of fundamental, sentiment, and (where retained) alternative-data evidence into one reasoned, cited output.

### Value Proposition
Instead of manually pulling financial statements, reading news and transcripts, and forming an independent judgment, a user submits a company and receives a structured, multi-dimensional scorecard with visible reasoning and evidence — plus the ability to ask follow-up questions against the same underlying documents, with citations. This is grounded directly in the working `/analyze` and `/ask` capabilities; it does not claim capabilities the product does not have (e.g., portfolio-level insight, real-time trading signals).

---

## 3. TARGET USERS

### Primary user: Equity researcher / financial analyst
- **Confidence**: STRONGLY INFERRED — reconstruction §3, based on domain terminology (fundamental/sentiment/alternative "debaters," scorecards, guidance tracking, peer comparison, ROE/ROCE/P-E fields) and Indian-equity data sourcing (Screener.in).
- **Goals**: Form and defend an initial view on a company quickly; gather and reconcile multiple types of evidence; ask targeted follow-up questions without re-reading full source documents.
- **Pain points**: Manual research is slow and fragmented across filings, transcripts, and news; synthesizing conflicting signals (strong fundamentals vs. weak sentiment, for example) takes judgment and time.
- **Relevant workflows**: Submitting a company for analysis, reviewing a scorecard, drilling into reasoning per dimension, asking Copilot questions.
- **Expected product value**: Faster first-pass research output with visible, checkable reasoning rather than an opaque single answer.

### Secondary user: Individual/retail investor
- **Confidence**: POSSIBLE — reconstruction §3 notes the dashboard-style UI (movers, search, watchlists) resembles consumer investing-app patterns, but this is inferred from UI shape alone, not from any stated audience or evidence of retail-oriented simplification (e.g., no plain-language mode, no educational content was found).
- This audience is **not treated as confirmed** in this PRD. Features are not added specifically to serve this audience unless they are already justified for the primary audience.

### Explicitly not confirmed as target users
Portfolio managers (no portfolio-construction or allocation features found), students/academic researchers (plausible but unsupported beyond general PoC framing). These are **UNKNOWN** and are not designed for in this PRD.

---

## 4. PROBLEM STATEMENT

Equity research, done manually, requires:
- Locating and reading structured financials (revenue, profitability, leverage ratios) across periods.
- Locating and interpreting qualitative signals — news sentiment, management commentary from earnings calls/transcripts.
- (Where relevant) considering alternative, non-traditional signals such as hiring activity or web traffic.
- Synthesizing all of the above into one coherent, defensible view, rather than treating each source in isolation.
- Being able to go back and ask specific follow-up questions against the source material without re-reading everything.

This is fragmented (multiple source types, no single workflow), effortful (manual synthesis across dimensions), and hard to interrogate after the fact (no easy way to ask "why" against the original documents). *(STRONGLY INFERRED from the shape of the implemented pipeline — reconstruction §2, §6)*

This PRD does **not** introduce unrelated problems such as trade execution, portfolio construction/rebalancing, or general financial advice — none of these are supported by evidence in the reconstruction.

---

## 5. PRODUCT GOALS

### Product Goals
1. Reduce the manual effort required to produce a first-pass, multi-dimensional company research view.
2. Provide a research view that synthesizes multiple independent perspectives (fundamental, sentiment, and — pending decision — alternative data) rather than a single undifferentiated answer.
3. Make the reasoning and evidence behind the AI's conclusions visible and checkable, not just a final score.
4. Allow users to ask natural-language follow-up questions and receive answers grounded in the same source documents, with citations.
5. Present a coherent, navigable workflow from "pick a company" through "get analysis" through "ask questions" — even if the surrounding product surface (search, browsing) is simplified relative to the current mocked UI.

### Engineering Goals
(Stated at the product level; technical approach is deferred to the TRD.)
1. Preserve the existing `/analyze` and `/ask` pipelines as the functional core rather than rebuilding them.
2. Ensure any newly-scoped supporting features (e.g., company search) are built as real, backend-connected functionality rather than extending the mock-data pattern.
3. Ensure the product clearly and honestly represents which parts of a response are grounded in real data/documents versus which are AI-generated synthesis or ungrounded fallback.

No numerical performance targets (latency, accuracy percentages, uptime SLAs) are defined here, as none are supported by the reconstruction evidence; any such targets belong in the TRD or in a later measurement phase.

---

## 6. NON-GOALS / OUT OF SCOPE

### Explicitly out of scope
- **Trade execution / order placement** — no evidence of any trading integration; inconsistent with the product's research-only framing.
- **Portfolio management** (holdings tracking, allocation, rebalancing) — no evidence of any portfolio concept anywhere in the codebase.
- **Financial advice framed as personalized recommendations** — the product produces research synthesis, not individualized advice; this distinction matters for how outputs are presented (see §28, AI Safety/Trust).
- **Social/community features** (sharing, following other users, comments) — no evidence anywhere.
- **General-purpose chatbot functionality** unrelated to a specific company's research context — Copilot is scoped to company-grounded Q&A, not open-domain chat.

### Not yet decided (do not treat as out of scope)
- Authentication / user accounts
- Persistent watchlists
- Real market data / charts
- Real news feed
- Company master/search index
- Real alternative-data integration
- Deployment/hosting approach

These are **PRODUCT DECISION REQUIRED** items (see §33) and must not be assumed excluded simply because they are unresolved.

---

## 7. MVP DEFINITION

### MVP Core
These are required because they are the product's only confirmed, functionally real capabilities, and they directly deliver the core value proposition.

| Feature | Why it belongs in MVP Core |
|---|---|
| Multi-agent company analysis (`/analyze`) | CONFIRMED working; the central value-delivering capability |
| RAG Copilot (`/ask`) | CONFIRMED working; delivers the "interrogate the research" value |
| Document ingestion (investor-relations PDFs) | CONFIRMED working; required input for both of the above |
| Peer comparison | CONFIRMED working, delivered as part of `/analyze` |

### MVP Supporting Features
These are not independently core, but the core is not usable as a product without them.

| Feature | Why it's needed to make the core usable |
|---|---|
| A way to select/identify a company to analyze | Without this, a user cannot invoke `/analyze` at all. Currently only mock-backed (reconstruction §7, §13); **must become real** for MVP even in minimal form — see §19 for scope options. |
| Presentation of the scorecard, reasoning, and evidence | The AI output is the product; it must be legibly presented, not just returned as raw JSON. |
| Basic company identity display (name, sector — whatever minimally frames the analysis) | Needed for the user to confirm what was analyzed; does not require real-time pricing or charts. |

### Post-MVP / Future
These currently exist only as mocked UI and are not required to deliver the core value proposition. Their inclusion is a **product decision**, not an automatic requirement, because the reconstruction explicitly warns against treating existing frontend breadth as justification (reconstruction §12, §18).

| Feature | Why it is not treated as MVP by default |
|---|---|
| Real-time/historical market data and charts | Enhances context but is not required to deliver a research scorecard or Copilot answer; entirely mocked today with no backend (reconstruction §9, §13) |
| Real news feed (dashboard-level) | Distinct from the Sentiment debater's internal news use, which already works; the dedicated News UI is unconfirmed as core (reconstruction §21 framing) |
| Watchlists (create/manage/compare) | Fully UI-only today with zero backend; valuable but not required for the core single-company research loop (reconstruction §17, §22) |
| Alternative-data agent (real vendor integration) | Currently fully mocked; whether it's core to the value proposition is an open decision, not assumed (reconstruction §17 Decision #4) |
| Authentication / accounts | No evidence this was ever planned; only needed if multi-user or persistence decisions require it |
| Company master database / real search index | Needed to fully replace the mock list, but a minimal MVP can function with a constrained/curated company set — see §19 |

---

## 8. USER JOURNEYS (Target State)

### Journey 1 — Discover a company
```text
Entry point: Landing/search screen
↓
User action: User searches or selects from a list of supported companies
↓
System behavior: Returns matching companies from a real, backend-supported company set (scope per §19 decision)
↓
Result: User selects one company
↓
Success condition: User is taken to that company's research page
```
*Depends on the Company Discovery decision in §19 — MVP viability requires at least a minimal real version of this, per §7.*

### Journey 2 — Run/review company analysis
```text
Entry point: Company research page
↓
User action: User initiates analysis (or it triggers automatically on page load, consistent with current `useAnalyze` behavior)
↓
System behavior: System calls the multi-agent pipeline (`/analyze`), shows a clear in-progress state
↓
Result: A scorecard with per-dimension scores, confidence, and reasoning is returned
↓
Success condition: User can see an overall view and can navigate into the details
```
CONFIRMED as an existing, working flow (reconstruction §5, §6 Flow B).

### Journey 3 — Explore AI scorecard
```text
Entry point: Completed analysis on the company page
↓
User action: User reviews overall score and per-dimension breakdown (fundamental, sentiment, alternative — if retained)
↓
System behavior: Renders scores, confidence levels, and dimension summaries
↓
Result: User forms a top-level understanding of the AI's view
↓
Success condition: User can identify which dimensions are strong/weak and why
```

### Journey 4 — Drill into reasoning/evidence
```text
Entry point: Scorecard view
↓
User action: User opens the reasoning panel for a dimension
↓
System behavior: Displays the underlying agent reasoning and evidence used for that dimension's score
↓
Result: User can see why a score was given, not just the score itself
↓
Success condition: User can trace a score back to specific evidence
```
CONFIRMED as existing (`ReasoningPanel.tsx`, reconstruction §4, §7).

### Journey 5 — Ask questions through Copilot
```text
Entry point: Copilot sidebar, opened from the company page
↓
User action: User asks a free-form question about the company
↓
System behavior: System retrieves relevant document chunks and generates a grounded answer with citations; falls back to an ungrounded answer if retrieval finds nothing, clearly marked as such (see §17)
↓
Result: User receives an answer, with citations when grounded
↓
Success condition: User can distinguish a document-grounded answer from a fallback answer
```
CONFIRMED as existing and functional (reconstruction §5, §11), with the fallback-labeling requirement added here as new (not currently confirmed to be visually distinguished — see §17).

### Journey 6 — Review supporting financial/news/company information
```text
Entry point: Company research page
↓
User action: User views supporting context (financial metrics, and — if in scope — news, pricing)
↓
System behavior: Displays whatever supporting data is in MVP scope, sourced from real backend data, not mock data
↓
Result: User has enough context to interpret the scorecard
↓
Success condition: Displayed data is accurate and sourced, not simulated
```
**Depends on §20/§21 decisions** for how much of this (market data, news) is in scope; the financial-metrics portion is already CONFIRMED real via the Fundamental debater's Postgres-backed data.

### Journey 7 — Watchlist workflow (IF selected as MVP)
```text
Entry point: Watchlists page
↓
User action: User creates a watchlist, adds companies, later returns to view/analyze it
↓
System behavior: Persists the watchlist and its members server-side; supports comparative analysis across members
↓
Result: Watchlist and its contents survive across sessions
↓
Success condition: Data persists and comparison reflects real analysis, not mock data
```
**This journey is explicitly conditional** on the Watchlists product decision in §22/§33. It is not included in MVP Core by default (reconstruction §17 Decision #5, §18).

---

## 9. PRODUCT FEATURE SPECIFICATIONS

### Feature: Multi-Agent Company Analysis

**Purpose**: Produce a synthesized, multi-perspective research view of a company.

**User Value**: Replaces manual cross-source research with one automated, structured output.

**User Actions**: Submit/select a company; initiate analysis; view results.

**System Behavior**: Scrapes/loads financial data, ingests available IR documents, runs Fundamental, Sentiment, and (if retained) Alternative debater agents in parallel, coordinator synthesizes a scorecard.

**Inputs**: Company identifier (name/ticker); optionally `quarters` and a refinement threshold (existing request parameters, reconstruction §4).

**Outputs**: A scorecard containing overall score, confidence, per-dimension scores/reasoning/evidence, and peer comparison data.

**Dependencies**: Financial data source, document ingestion, LLM providers, PostgreSQL, ChromaDB.

**Edge Cases**: Company with no available financial data; company with no available IR documents; partial agent failure (e.g., one debater fails but others succeed).

**Error States**: Full analysis failure (all agents fail or scraping fails) must produce a clear, user-visible error rather than a silent empty/broken scorecard.

**Empty States**: If a specific dimension has no usable evidence, that dimension should indicate low/no confidence explicitly rather than fabricating a score.

**Acceptance Criteria**:
- Given a supported company, submitting it for analysis returns a scorecard with all in-scope dimensions populated.
- Each dimension's score is accompanied by visible reasoning and evidence.
- If any single agent fails, the user is informed which dimension is affected rather than the whole analysis silently failing (this is a **new** requirement — current partial-failure behavior is not detailed in the reconstruction and is UNKNOWN).

**Current Implementation Status**: EXISTING / WORKING (core pipeline), with the Alternative-data dimension EXISTING / MOCKED (reconstruction §4, §7).

**Evidence / Origin**: `PROJECT_AUDIT.md` §5.1; `PROJECT_AUDIT_DEEP_DIVE.md` §4, §6.

---

### Feature: RAG Copilot (Company Q&A)

**Purpose**: Let users ask free-form, document-grounded questions about a company.

**User Value**: Enables interrogation of the research without re-reading source documents.

**User Actions**: Open Copilot; type a question; optionally continue asking follow-ups.

**System Behavior**: Retrieves relevant chunks from the company's ingested documents, generates a cited answer; if retrieval returns nothing, falls back to a general (non-grounded) answer, clearly labeled as such.

**Inputs**: Question text, company context, optional retrieval depth (`top_k`).

**Outputs**: Answer text, citations (when grounded), retrieved chunk references, a flag indicating whether the fallback path was used.

**Dependencies**: ChromaDB retrieval, embedding model, LLM provider(s), document ingestion having already run for the company.

**Edge Cases**: Question about a company with no ingested documents; question unrelated to the company's available evidence; very broad or ambiguous questions.

**Error States**: LLM provider failure should surface a clear error, not a blank or misleading answer.

**Empty States**: Zero retrieved chunks → fallback answer, explicitly UI-marked as not document-grounded (this labeling is a **new** requirement — see §17).

**Acceptance Criteria**:
- A grounded answer always displays its citations.
- A fallback answer is visually distinguishable from a grounded answer.
- The Copilot only answers in the context of the currently selected company.

**Current Implementation Status**: EXISTING / WORKING, with the fallback-labeling UX being NEW (not confirmed as already implemented).

**Evidence / Origin**: `PROJECT_AUDIT.md` §5.1; `PROJECT_AUDIT_DEEP_DIVE.md` §5.

---

### Feature: Document Ingestion

**Purpose**: Acquire and index investor-relations documents to ground both the Fundamental debater and Copilot.

**User Value**: Indirect — underlies the quality and groundedness of both the scorecard and Copilot answers.

**User Actions**: None directly user-facing today; ingestion is triggered as part of the analysis flow.

**System Behavior**: Discovers/downloads PDFs, parses and extracts metrics, chunks and embeds content into ChromaDB.

**Inputs**: Company identifier (used to locate the company's IR materials).

**Outputs**: Stored raw documents, extracted metrics, embedded chunks.

**Dependencies**: PDF discovery/scraping, `PdfReader` parsing, SentenceTransformers embeddings, ChromaDB, PostgreSQL (`raw_documents` table).

**Edge Cases**: Company with no discoverable IR PDFs; malformed/unparseable PDFs; documents behind access restrictions.

**Error States**: Ingestion failure for a company should not silently produce an empty knowledge base without informing the user that grounded answers may be limited.

**Empty States**: No documents found → both Fundamental analysis and Copilot should indicate reduced evidence availability rather than presenting full confidence.

**Acceptance Criteria**: Documents successfully ingested for a company are retrievable by both the Fundamental debater and Copilot.

**Current Implementation Status**: EXISTING / WORKING, with metric extraction explicitly described as a "demo implementation" (regex-based) — EXISTING / PARTIAL in quality, not in availability.

**Evidence / Origin**: `PROJECT_AUDIT.md` §5.2; `PROJECT_AUDIT_DEEP_DIVE.md` §6, §11.

---

### Feature: Peer Comparison

**Purpose**: Contextualize a company's analysis against peers.

**User Value**: Helps a user judge whether a score is good/bad relative to comparable companies, not just in isolation.

**User Actions**: View peer comparison data alongside the main scorecard.

**System Behavior**: Returned as part of the `/analyze` response (`peer_comparisons` field).

**Inputs**: Same as the main analysis request.

**Outputs**: `PeerComparison` data consumed by the frontend.

**Dependencies**: Same as main analysis pipeline.

**Edge Cases**: Company with no identifiable peers.

**Error States**: If no peer data is available, this should be indicated rather than left blank without explanation.

**Empty States**: No peers found → explicit "no peer comparison available" state.

**Acceptance Criteria**: When peer data exists, it is displayed alongside the scorecard.

**Current Implementation Status**: EXISTING / WORKING.

**Evidence / Origin**: `PROJECT_AUDIT.md` §5.3; `PROJECT_AUDIT_DEEP_DIVE.md` §4.

---

### Feature: Company Discovery / Search — DECISION REQUIRED

**Purpose**: Let a user find and select a company to analyze.

**User Value**: Entry point into the entire product; without it, no other feature is reachable.

**User Actions**: Search by name/ticker, or select from a list.

**System Behavior**: Currently returns results only from a static mock list (`dummyData.ts`); target behavior depends on the scope decision in §19.

**Inputs**: Search text.

**Outputs**: List of matching companies.

**Dependencies**: A real company master data source (scope TBD — see §19).

**Edge Cases**: No matches; ambiguous/partial matches; company not in the supported set.

**Error States**: Search backend unavailable.

**Empty States**: No results found — clear "no matching company" state, with guidance if possible (e.g., suggest checking spelling).

**Acceptance Criteria**: A user can find and select a company that the analysis pipeline can actually process, without relying on mock data.

**Current Implementation Status**: EXISTING / MOCKED.

**Evidence / Origin**: `PROJECT_AUDIT.md` §3.4; `PROJECT_AUDIT_DEEP_DIVE.md` §2, §3.

**Note**: This feature is required in *some* real form for MVP (see §7), but its exact scope (full market-wide search vs. a curated/minimal company set) is a **PRODUCT DECISION REQUIRED** — see §19 and §33.

---

### Feature: Market Data / Charts — POST-MVP / DECISION REQUIRED

**Purpose**: Show price context (current price, historical movement) for a company.

**Status**: EXISTING / MOCKED. Not required to deliver the core value proposition (research synthesis and Q&A do not depend on price charts). Included as Post-MVP by default; see §20 and §32/§33 for the scope decision.

---

### Feature: News Feed (dashboard-level) — POST-MVP / DECISION REQUIRED

**Purpose**: Show company-specific news headlines to the user directly (distinct from the Sentiment debater's internal use of news, which already works).

**Status**: EXISTING / MOCKED. Post-MVP by default; see §21 and §33.

---

### Feature: Watchlists — POST-MVP / DECISION REQUIRED

**Purpose**: Let users save and revisit groups of companies, and compare them.

**Status**: EXISTING / MOCKED (UI-only, zero backend, non-persistent). Post-MVP by default; see §22 and §33.

---

### Feature: Alternative-Data Analysis — DECISION REQUIRED

**Purpose**: Add a non-traditional-signal dimension (hiring, web traffic) to the scorecard.

**Status**: EXISTING / MOCKED (hardcoded constants regardless of company). Whether this remains a target feature (requiring real vendor integration) or is removed from the scorecard is a **PRODUCT DECISION REQUIRED** — see §33 Decision #4. Until decided, this PRD does **not** assume it ships as a real dimension in the target product; it is documented as at-risk of removal, not as confirmed future scope.

---

### Feature: Authentication / User Accounts — DECISION REQUIRED

**Purpose**: Identify users and scope data (e.g., watchlists) to them.

**Status**: MISSING entirely; no evidence it was ever planned. Only becomes a requirement if a multi-user or persistence decision (e.g., persistent watchlists) requires it. See §23 and §33.

---

## 10. CORE AI RESEARCH FEATURE (Detailed)

### Input
The user provides a company identifier (name or ticker). Optionally, the system may accept a time window (`quarters`) and a confidence-refinement threshold, consistent with the existing `EquityResearchRequest` shape. *(CONFIRMED as existing request shape — reconstruction §4)*

### Analysis
The system evaluates the company from independent perspectives, each backed by a distinct evidence type, rather than asking a single model to produce one undifferentiated judgment.

### Perspectives
- **Fundamental**: Evaluates financial health using real structured metrics (revenue, profit, ROCE, debt/equity). *(CONFIRMED real — reconstruction §10)*
- **Sentiment**: Evaluates market/qualitative perception using real news search and transcript scraping. *(CONFIRMED real, with a noted fragility in how transcript URLs are located — reconstruction §10)*
- **Alternative data**: Evaluates non-traditional signals (hiring, web traffic). *(Currently fully mocked; **retained in scope only pending the Decision in §33** — this PRD does not assume it ships.)*

### Synthesis
A coordinator agent combines the debaters' outputs into one scorecard, weighing each dimension's contribution to an overall score and confidence.

**Important — target behavior vs. current implementation**: The current coordinator's "refinement" step, triggered when confidence falls below a threshold, does not perform genuine re-evaluation. It directly increases the stored confidence value by a fixed amount (`min(current_conf + 20, 100)`), regardless of whether any new evidence or reasoning was actually produced. *(CONFIRMED — reconstruction §10)* **This current behavior is explicitly NOT the target requirement.**

If genuine refinement is retained in the target product, the desired behavior is: when a dimension's confidence is below threshold, the coordinator should prompt the relevant debater(s) to reconsider their conclusion in light of the coordinator's specific concerns, and confidence should change only as a genuine reflection of whether the reconsidered analysis is actually stronger — not as an automatic, evidence-independent increment. Whether this genuine refinement is built, or whether the product instead simply reports confidence as-is without a refinement step, is a **PRODUCT DECISION REQUIRED** (see §33 Decision #9).

### Scorecard
See §11 (Scorecard Requirements) below.

### Evidence
Each dimension's conclusion must be traceable to specific evidence (financial figures, news items, document excerpts) surfaced through the existing `AgentMessage`/reasoning structure, not presented as an unsupported assertion.

### Confidence
Confidence must be communicated as a genuine reflection of evidence strength and agreement across agents — not, per the caution above, an artificially inflated number. Until genuine refinement is decided and possibly built, confidence should be presented as-computed by the initial debate, with the current inflation mechanism either removed or clearly not exposed to the user as a meaningful signal.

---

## 11. SCORECARD REQUIREMENTS

| Field | Meaning | User Visibility | Purpose | Acceptance Criteria |
|---|---|---|---|---|
| Overall score | Aggregate synthesized view of the company | Prominent, top-level | Quick top-line takeaway | Present whenever analysis completes successfully |
| Overall confidence | System's confidence in the overall score | Prominent, alongside score | Signals how much weight to give the score | Must reflect genuine evidence strength, not an artificial floor/inflation (see §10) |
| Per-dimension scores (Fundamental, Sentiment, and Alternative-data if retained) | Score for each independent perspective | Visible in a breakdown view | Lets user see which dimensions drive the overall view | Each in-scope dimension present, or explicitly marked unavailable |
| Per-dimension reasoning | Narrative explanation from each debater | Visible via drill-down (Reasoning Panel) | Lets user evaluate *why*, not just *what* | Every populated dimension has accompanying reasoning |
| Per-dimension evidence | Specific facts/citations used | Visible via drill-down | Grounds the reasoning in checkable evidence | Every populated dimension has at least one evidence reference when data was available |
| Agent contributions | Which agent produced which part of the reasoning | Visible in drill-down (already modeled via `AgentMessage`) | Transparency into the multi-agent process | Reasoning is attributable to the specific debater |
| Peer comparison | How the company compares to peers | Visible alongside scorecard | Adds relative context | Present when peer data is available; explicit empty state otherwise |

No additional score dimensions are introduced beyond what the existing implementation already models (Fundamental, Sentiment, Alternative-data), consistent with the instruction not to invent new dimensions.

---

## 12. RAG COPILOT REQUIREMENTS

- **User question**: Free-form natural-language text, scoped to the currently selected company.
- **Company context**: The active company drives retrieval scope; question and company are both required inputs (matches existing `AskRequest` shape).
- **Retrieval**: Relevant chunks retrieved from the company's ingested documents.
- **Document grounding**: When chunks are found, the answer must be generated from and cited to those chunks.
- **Response**: Natural-language answer.
- **Citations**: Displayed alongside a grounded answer, referencing the specific retrieved chunks used.
- **Fallback behavior — product decision applied**: The current system falls back to a general, non-grounded LLM answer when retrieval returns zero chunks. **This PRD retains the fallback** [MINIMUM VIABLE DECISION] — removing it would leave users with no answer at all in cases where documents simply aren't available yet, which is worse for usability. However, the **UX requirement is new and mandatory**: any fallback answer must be clearly and visibly labeled as not grounded in company documents, so it is never mistaken for a cited, evidence-backed answer. This is not confirmed as already implemented in the UI and must be treated as a gap to close.
- **Errors**: LLM or retrieval failures must produce a visible error state, not a blank or default-looking response.
- **Empty retrieval**: Explicitly the trigger for the labeled fallback above, not a silent failure.

---

## 13. DOCUMENT / KNOWLEDGE REQUIREMENTS

Supported document category, based strictly on the reconstruction: **investor-relations PDFs** (annual reports, presentations, and similar IR materials discoverable and downloadable per-company). *(CONFIRMED — reconstruction §6 Flow E, §11)*

Transcripts are used internally by the Sentiment debater via scraping (Firecrawl), but are **not** confirmed to be ingested into the same document/RAG pipeline as IR PDFs — the reconstruction does not establish this, so it is treated as UNKNOWN whether transcripts are part of the Copilot's retrievable knowledge base or only feed the Sentiment debater's live analysis.

- **Ingestion**: Discover and download available IR PDFs for a company.
- **Parsing**: Extract text and (where possible) structured metrics from PDFs.
- **Chunking**: Split parsed content into retrievable units.
- **Indexing**: Embed and store chunks for semantic retrieval.
- **Retrieval**: Return the most relevant chunks for a given question.
- **Citation/source representation**: Each retrieved chunk used in an answer must be traceable back to its source document for citation purposes.

No other document categories (e.g., regulatory filings, analyst reports, social media) are introduced, as none are supported by evidence.

---

## 14. COMPANY DISCOVERY AND SEARCH

This is treated as an explicit **product-scope decision**, not an assumed requirement, per the reconstruction's finding that the backend currently provides none of this (reconstruction §13 gap matrix).

If included in the target product (required in some form for MVP per §7):

- **Company search**: By name and/or ticker.
- **Company selection**: From search results or a browsable list.
- **Company master data**: Minimal identity data sufficient to display and disambiguate a company (name, ticker, sector) — sourced from a real backend, not `dummyData.ts`.
- **Search results**: Ranked/matched list of candidate companies.
- **Empty results**: Explicit "no matching company" state.
- **Invalid company**: If a user reaches the analysis step with an unsupported/invalid company, the system must fail clearly rather than attempting analysis on bad input.
- **Navigation into company research**: Selecting a company routes into the analysis workflow (Journey 2).

**Scope note**: This PRD does **not** select a company/market data vendor. It also does not mandate a full market-wide company universe — a minimal, curated set of supported companies is an acceptable MVP scope option, to be decided alongside the broader company-data decision (see §33). That specific sizing choice (curated set vs. full index) is left **TBD** and should be resolved before or during TRD design.

---

## 15. MARKET DATA REQUIREMENTS

**Status**: Post-MVP / decision-dependent (see §7, §32, §33). If included in the target product, the product-level requirements are:

- **Current price**: A single up-to-date price value per company.
- **Historical prices**: A time series sufficient to render a chart.
- **Price movement**: Change and percent-change over a relevant period.
- **Candlestick data**: Open/high/low/close/volume per period, for charting.
- **Freshness expectations**: Data should be recognizably "current" to the user (e.g., a visible as-of timestamp), though no specific latency/refresh-interval number is defined here, as none is supported by evidence.

No vendor is selected in this document; vendor selection belongs to the TRD.

---

## 16. NEWS REQUIREMENTS

**Status**: Post-MVP / decision-dependent (see §7, §32, §33).

### Frontend news feed (dashboard-level)
If included: company-specific news items each with headline, source, publication time, article link, and (if available) a sentiment indicator consistent with the existing `NewsItem` shape (`title, source, date, sentiment, summary, url`). Empty state: "no recent news available." Error state: news source unavailable, shown distinctly from an empty result.

### News used internally by Sentiment Debater
This is a **separate, already-functional** capability (real Exa-based news search feeding the Sentiment debater's analysis) and is **not** the same feature as the dashboard news feed. The reconstruction explicitly distinguishes these two uses of "news," and this PRD preserves that distinction — the Sentiment debater's internal news use requires no new product decision and is already in MVP Core as part of the analysis pipeline.

No news vendor is selected here; that belongs to the TRD.

---

## 17. WATCHLIST REQUIREMENTS

**Status**: Post-MVP by default; included as a finalized MVP requirement only if the product decision in §33 selects it.

If included, target requirements are:
- **Create watchlist**: Name and initialize an empty or pre-populated watchlist.
- **Rename watchlist**.
- **Delete watchlist**.
- **Add company** to a watchlist.
- **Remove company** from a watchlist.
- **View companies** in a watchlist.
- **Analyze watchlist**: Run comparative analysis across the watchlist's companies (built on the same real `/analyze` pipeline, not mock comparison data).
- **Persistence**: Watchlists and their contents must survive across sessions — this requires real backend storage, which does not currently exist (reconstruction §17 Decision #5). The current implementation is **not** persistent and must not be described as such.
- **Empty states**: A watchlist with no companies should show a clear "add a company" prompt rather than a blank/broken view.
- **Duplicate handling**: Adding a company already in the watchlist should be a no-op or explicit message, not a silent duplicate entry.
- **Invalid company handling**: Attempting to add an unsupported/invalid company should fail clearly.

If watchlists are deferred, none of the above are required for the initial coherent release; the current UI-only implementation should either be clearly marked as non-persistent/demo in the interim, or removed from the shipped MVP surface to avoid misleading users, per the reconstruction's caution against mocked functionality being presented as real.

---

## 18. AUTHENTICATION / USER ACCOUNT REQUIREMENTS

**Classification**: **PRODUCT DECISION REQUIRED**, defaulting to **Not required for MVP** [MINIMUM VIABLE DECISION], because:
- No evidence anywhere in the codebase suggests authentication was ever planned (reconstruction §16, §17).
- The MVP Core and MVP Supporting features defined in §7 do not inherently require per-user identity — company analysis and Copilot Q&A are not user-specific operations.
- Authentication only becomes necessary if a decision elsewhere (most likely: persistent, per-user watchlists) requires scoping data to a user.

If authentication is later selected (contingent on the Watchlists decision or another multi-user requirement), the product-level requirements would be:
- **Account creation**: A user can create an identity.
- **Login / Logout**: Standard session start/end.
- **User identity**: The system can identify which user is acting.
- **Data ownership**: User-created data (e.g., watchlists) is scoped to and only accessible by its owner.
- **Session expectations**: A logged-in state persists across visits until explicit logout or expiration.

No authentication technology or provider is selected here; that belongs to the TRD.

---

## 19. DATA REQUIREMENTS (Product-Level Entities)

| Entity | Purpose | Key Information | Relationship to Features | Exists Today | Needs to Be Created |
|---|---|---|---|---|---|
| Company | Subject of analysis | Name, ticker, sector, minimal identity | Discovery, Analysis, Watchlists | Partial — `CompanyInput` exists backend-side (minimal); full identity only in frontend mock | A real, backend-authoritative Company entity |
| Financial Metric / Quarterly Financial | Grounds Fundamental analysis | Revenue, profit, ROCE, debt/equity, etc. | Fundamental debater | Yes (`financials_quarterly`) | No |
| News Item (internal) | Grounds Sentiment analysis | Search results from Exa | Sentiment debater | Yes (live search, not persisted as a distinct entity) | No |
| News Item (dashboard) | User-facing news feed | Headline, source, date, sentiment, link | News Requirements (§16) — decision-dependent | No (mock only) | Yes, if news feed is selected |
| Market Data / Candlestick Point | User-facing price/chart data | Price, OHLCV | Market Data Requirements (§15) — decision-dependent | No (mock only, mathematically generated) | Yes, if market data is selected |
| Research Scorecard | Primary product output | Overall score/confidence, dimensions | Analysis, Scorecard display | Yes (`Scorecard`, `ScoreDimension`) | No |
| Agent Analysis / Agent Message | Per-dimension reasoning | Reasoning text, evidence, contributing agent | Reasoning drill-down | Yes | No |
| Document | Source material for RAG and Fundamental analysis | Raw IR PDFs | Ingestion, Copilot, Fundamental debater | Yes (`raw_documents`) | No |
| Retrieved Chunk / Citation | Evidence backing Copilot answers | Chunk text, source document reference | Copilot | Yes (`RetrievedChunk`, ChromaDB) | No |
| Watchlist | User-curated company groups | Name, member companies | Watchlist workflow — decision-dependent | No (frontend mock/local state only) | Yes, if watchlists selected |
| Watchlist Item | Membership record | Company reference | Watchlist workflow | No | Yes, if watchlists selected |
| User | Identity for account-scoped data | Identity, credentials | Authentication — decision-dependent | No | Yes, only if authentication selected |

No database schema or SQL design is defined here; this is a product-level entity list only, per instructions.

---

## 20. FUNCTIONAL REQUIREMENTS

| ID | Requirement | Priority | Status | Source |
|---|---|---|---|---|
| FR-001 | The system shall allow a user to submit a supported company for AI-powered multi-agent research analysis. | P0 | EXISTING | `/analyze`, reconstruction §4 |
| FR-002 | The system shall return a scorecard containing an overall score, overall confidence, and per-dimension results. | P0 | EXISTING | `Scorecard`/`ScoreDimension` models |
| FR-003 | The system shall provide fundamental-dimension analysis grounded in real financial metrics. | P0 | EXISTING | Fundamental debater, reconstruction §10 |
| FR-004 | The system shall provide sentiment-dimension analysis grounded in real news and transcript evidence. | P0 | EXISTING | Sentiment debater, reconstruction §10 |
| FR-005 | The system shall display, for each analyzed dimension, the underlying reasoning and evidence used. | P0 | EXISTING | Reasoning Panel, `AgentMessage` |
| FR-006 | The system shall provide peer comparison data alongside a company's scorecard, when available. | P1 | EXISTING | `PeerComparison` |
| FR-007 | The system shall allow a user to ask free-form questions about the currently selected company via Copilot. | P0 | EXISTING | `/ask`, reconstruction §5 |
| FR-008 | The system shall ground Copilot answers in retrieved document chunks and display citations when grounding succeeds. | P0 | EXISTING | RAG pipeline |
| FR-009 | The system shall visibly label any Copilot answer that used the non-grounded fallback path, distinguishing it from a cited answer. | P0 | NEW | UX gap identified in reconstruction §11/§17 of reconstruction (fallback exists, labeling not confirmed) |
| FR-010 | The system shall ingest available investor-relations PDF documents for a company to support both Fundamental analysis and Copilot. | P0 | EXISTING | Ingestion agent |
| FR-011 | The system shall allow a user to find and select a company from a real, backend-supported set (not a static mock list). | P0 | MOCKED → NEW | reconstruction §13 gap matrix |
| FR-012 | The system shall display an explicit error state if analysis fails for a submitted company. | P1 | PARTIAL | Not fully detailed in reconstruction; treated as a necessary usability requirement |
| FR-013 | The system shall display an explicit state when a specific analysis dimension has insufficient evidence, rather than fabricating a score. | P1 | NEW | Derived from AI Safety principle, §28 |
| FR-014 | The system shall NOT present the current artificial confidence-inflation behavior of the coordinator as genuine refinement to the user. | P0 | DECISION REQUIRED | reconstruction §10; see §33 Decision #9 |
| FR-015 | IF market data is selected as in-scope, the system shall display current price, historical price movement, and candlestick charts for a company, sourced from a real backend. | P2 | DECISION REQUIRED | reconstruction §15/§20 |
| FR-016 | IF a news feed is selected as in-scope, the system shall display company-specific news items with headline, source, date, and link, sourced from a real backend. | P2 | DECISION REQUIRED | reconstruction §16/§21 |
| FR-017 | IF watchlists are selected as in-scope, the system shall allow users to create, rename, delete, and populate watchlists, with server-side persistence. | P2 | DECISION REQUIRED | reconstruction §17/§22 |
| FR-018 | IF watchlists are selected as in-scope, the system shall allow comparative analysis across a watchlist's companies using the real analysis pipeline. | P2 | DECISION REQUIRED | reconstruction §17/§22 |
| FR-019 | IF alternative-data analysis is retained, the system shall source real hiring/traffic data rather than hardcoded constants. | P3 | DECISION REQUIRED | reconstruction §17 Decision #4 |
| FR-020 | IF authentication is selected as in-scope, the system shall support account creation, login, logout, and scoping of user-owned data (e.g., watchlists) to that user. | P3 | DECISION REQUIRED | reconstruction §17 Decision #2 |

---

## 21. NON-FUNCTIONAL REQUIREMENTS

### Performance
- The system must clearly communicate an in-progress state during analysis (`/analyze`), since this is a multi-step, multi-agent process that is not instantaneous. No specific latency target is defined, as none is supported by evidence.
- Copilot responses should indicate a loading/thinking state while retrieval and generation occur.

### Reliability
- External data failures (scraping failure, missing financials, unavailable transcripts, unavailable PDFs) must degrade gracefully — the affected dimension or feature should indicate reduced confidence/availability rather than the whole analysis silently failing.
- LLM provider failures must be surfaced as errors, not silently swallowed into an empty or default response.

### Security
- Secrets (API keys for Grok, Gemini, Exa, Firecrawl, etc.) must not be exposed to the client. *(Product-level constraint; already implied by current `.env`-based config, reconstruction §10 of `PROJECT_AUDIT.md`.)*
- If authentication/user data is introduced, user data must be isolated per user — no cross-user data leakage.
- External content ingested via scraping (PDFs, web pages) must be handled safely and not treated as trusted executable input.

### Usability
- Analysis status (in progress, complete, failed) must always be clear to the user.
- Confidence must be presented in a way a non-technical-but-domain-literate user can interpret (e.g., not just a raw unexplained number).
- Citations in Copilot answers must be visibly connected to the answer text they support.
- All error and empty states defined in this document (§17, §27) must be user-visible, not silent.

### Data freshness
Freshness expectations are defined **only** for features actually included in scope. If market data is selected (§15), the product must show the data as recognizably time-stamped/current; no specific refresh interval is defined here absent evidence. If market data is excluded from MVP, no freshness requirement applies.

---

## 22. ERROR / EMPTY / EDGE CASE REQUIREMENTS

| Case | User Experience | System Behavior | Recovery Path |
|---|---|---|---|
| Invalid/unsupported company selected | Clear "company not supported" message | Reject before attempting analysis | User returns to search/selection |
| Company not found in search | "No matching company" empty state | No results returned | User refines search |
| Analysis fails entirely | Clear error message, not a blank/broken scorecard | Analysis pipeline surfaces the failure | User can retry |
| Financial data unavailable for a company | Fundamental dimension shows reduced/no confidence, explained | Debater indicates missing data rather than fabricating a score | N/A — informational |
| Transcript unavailable | Sentiment dimension proceeds with available evidence (e.g., news only), flags reduced evidence | Debater continues without failing entirely | N/A — informational |
| No IR PDFs available | Both Fundamental grounding and Copilot document grounding are limited; system indicates this | Ingestion returns empty; downstream features flag reduced grounding | N/A — informational |
| RAG returns no chunks | Copilot shows a clearly labeled non-grounded fallback answer | Fallback QA path triggers, `fallback_used` flag set | User is aware the answer isn't document-cited |
| LLM failure (any agent) | Clear error for the affected component | Do not silently substitute a fabricated result | User can retry |
| Market data unavailable (if in scope) | "Price data unavailable" state | No chart rendered instead of broken chart | N/A — informational |
| News unavailable (if in scope) | "No recent news" state | Empty list, not an error unless the source itself failed | N/A — informational, unless true failure |
| Empty watchlist (if in scope) | "Add a company to get started" prompt | Empty list rendered cleanly | User adds a company |
| Duplicate company added to watchlist (if in scope) | No-op or gentle notice, not a silent duplicate | Add operation checks for existing membership | N/A |
| Unsupported company added to watchlist (if in scope) | Clear rejection message | Validate against supported company set before adding | User selects a valid company |

---

## 23. AI SAFETY / TRUST REQUIREMENTS

Because EquityLens produces AI-generated financial research content, the product must communicate its outputs responsibly:

1. **Clearly identify AI-generated analysis as AI-generated** — the scorecard and reasoning should not be presented as if they were independently verified human research.
2. **Always show supporting evidence** alongside conclusions — a score or answer without visible evidence is not an acceptable end state for the core features.
3. **Distinguish source-backed information from generated reasoning** — e.g., a cited financial figure vs. the debater's interpretive commentary about it should be visually or structurally distinguishable where feasible.
4. **Communicate confidence honestly** — per §10, the current artificial confidence-inflation mechanism must not ship as-is in the target product; confidence shown to the user must reflect genuine evidence strength.
5. **Clearly identify fallback/non-grounded Copilot responses** (FR-009) — never let an ungrounded answer appear equivalent to a cited one.
6. **Do not represent generated analysis as guaranteed financial truth or personalized investment advice** — outputs should be framed as research synthesis to inform the user's own judgment, consistent with the product being a research tool, not an advisory service (§6 Non-Goals). No specific regulatory or legal disclaimer language is prescribed here, as this PRD does not have evidentiary basis to define legal claims — that determination is outside this document's scope.

---

## 24. ANALYTICS / OBSERVABILITY

No user-facing product analytics requirements are defined in this PRD, as none are supported by the reconstruction evidence and none were requested. Operational logging/monitoring is a technical concern deferred to the TRD.

---

## 25. PRODUCT ACCEPTANCE CRITERIA (Completed Product)

The completed product should satisfy:
- A user can discover/select a company from a real, backend-supported set (not a mock list).
- A user can run analysis and receive a scorecard within the existing `/analyze` pipeline's behavior.
- The scorecard includes an overall score, overall confidence, and populated per-dimension results for all in-scope dimensions.
- Reasoning and evidence are accessible for every populated dimension.
- Copilot answers questions about the selected company, grounded in ingested documents where possible.
- Citations are visible for grounded Copilot answers; fallback answers are visibly distinguished.
- Peer comparison is shown when available.
- Whatever supporting data is in MVP scope (financials at minimum; market data/news only if selected) is real, not simulated.
- If watchlists are in scope, create/add/remove/delete/view/analyze all function with real persistence.
- All defined error and empty states (§22) are handled visibly, not silently.

Features not selected for target scope (e.g., market data, news, watchlists, alternative data, authentication, if ultimately excluded per §33) are **not** required to pass acceptance — this is intentional and must not be treated as an oversight.

---

## 26. CURRENT IMPLEMENTATION → TARGET PRODUCT GAP

| Product Capability | Current State | Target State | Gap |
|---|---|---|---|
| Multi-agent company analysis | Working (Fundamental, Sentiment real; Alternative mocked) | Working, with Alternative dimension either made real or removed | Resolve Alternative-data decision |
| Coordinator synthesis/confidence | Working structure, but refinement artificially inflates confidence | Genuine confidence representation (with or without real refinement) | Remove/replace the artificial inflation mechanism |
| RAG Copilot | Fully functional, including fallback | Same, with fallback clearly labeled in UI | Add fallback-labeling UX |
| Document ingestion | Functional, demo-quality metric extraction | Same or improved extraction quality | Optional quality improvement, not a functional gap |
| Peer comparison | Working | Working | None |
| Company discovery/search | Mock-only | Real, backend-supported (scope TBD) | Build real company data source and search |
| Scorecard/reasoning presentation | Working, backed by real `/analyze` data | Same | None functionally; ensure UI clarity per §21 Usability |
| Market data/charts | Fully mocked | Decision-dependent | Build real integration, or explicitly exclude |
| News feed (dashboard) | Fully mocked | Decision-dependent | Build real integration, or explicitly exclude |
| Watchlists | UI-only, non-persistent | Decision-dependent | Build backend/persistence, or explicitly exclude/mark as non-persistent |
| Authentication | Absent | Decision-dependent | Build only if a multi-user requirement is selected |
| Deployment | Absent | Needed for any real release | Define hosting/deployment approach (TRD-level, but a product prerequisite) |

---

## 27. MVP SCOPE MATRIX

| Feature | MVP | Post-MVP | Excluded | Decision Needed |
|---|:--:|:--:|:--:|:--:|
| Multi-agent AI analysis (Fundamental + Sentiment) | ✅ | | | |
| Scorecard (score, confidence, reasoning, evidence) | ✅ | | | |
| RAG Copilot | ✅ | | | |
| Document ingestion | ✅ | | | |
| Peer comparison | ✅ | | | |
| Company search/discovery (minimal real version) | ✅ | | | ✅ (scope size) |
| Company profile (minimal identity display) | ✅ | | | |
| Market data / charts | | ✅ (default) | | ✅ |
| News feed (dashboard) | | ✅ (default) | | ✅ |
| Watchlists | | ✅ (default) | | ✅ |
| Alternative data (real integration) | | | | ✅ (retain-real vs. remove) |
| Coordinator genuine refinement | | | | ✅ (build vs. drop refinement claim) |
| Authentication | | | ✅ (default, unless required by another decision) | ✅ |
| Deployment | ✅ (prerequisite for any release) | | | ✅ (model TBD) |

---

## 28. OPEN PRODUCT DECISIONS

| Decision | Options | Recommended Direction | Rationale | Final Decision |
|---|---|---|---|---|
| 1. Single-user vs. multi-user | (a) Single-user, no accounts; (b) Multi-user with accounts | (a) Single-user for initial release [MINIMUM VIABLE DECISION] | No evidence auth was ever planned; core value (analysis + Copilot) doesn't require identity; simplest coherent MVP | TBD |
| 2. Authentication | (a) None; (b) Basic accounts | (a) None, unless Watchlists (Decision 5) is selected as persistent+multi-user | Consistent with Decision 1; avoid building infrastructure not required by core value | TBD |
| 3. Market data provider/inclusion | (a) Include real market data; (b) Exclude from MVP, revisit later | (b) Exclude from MVP [MINIMUM VIABLE DECISION] | Not required for core value delivery; currently 100% mocked with no backend; adds a new external dependency for a feature that doesn't add to the research synthesis itself | TBD |
| 4. Alternative-data agent | (a) Build real vendor integration; (b) Remove from scorecard; (c) Keep as clearly-labeled experimental/placeholder dimension | No single direction can be confidently recommended — reconstruction explicitly poses this as unresolved without a clear signal either way | Currently fully fake, actively risks misleading users if shipped as-is (§23) | TBD |
| 5. Watchlists | (a) Build real persisted watchlists (requires backend + likely accounts); (b) Exclude from MVP; (c) Ship as an explicitly-labeled local-only/non-persistent convenience feature | (b) Exclude from MVP [MINIMUM VIABLE DECISION] | Not required for core single-company research loop; full build requires resolving Decisions 1–2 first | TBD |
| 6. News feed (dashboard) | (a) Build real integration; (b) Exclude from MVP; (c) Rely on Sentiment debater's internal news use only, no dedicated feed | (b) Exclude dedicated feed from MVP [MINIMUM VIABLE DECISION] | Sentiment analysis already uses real news internally; a separate dashboard feed is not required for core value | TBD |
| 7. Company master/search index | (a) Full market-wide index/search; (b) Minimal curated company set for MVP | (b) Minimal curated set for MVP [MINIMUM VIABLE DECISION] | Enables the MVP Core to function without committing to a large data-sourcing effort upfront | TBD |
| 8. Deployment model | (a) Cloud-hosted multi-tenant; (b) Self-hosted/local tool | No confident recommendation — no evidence of intended hosting anywhere in either audit | Deployment config is entirely absent; this is a genuine unknown, not just an unmade choice | TBD |
| 9. Coordinator refinement | (a) Build genuine LLM-based refinement; (b) Remove the refinement step and present initial confidence as final; (c) Keep a refinement step but make it genuine only for flagged low-confidence dimensions | (b) Remove the artificial-inflation mechanism and present confidence as-computed [MINIMUM VIABLE DECISION] for MVP; genuine refinement (a) deferred as Post-MVP enhancement | The current mechanism actively misrepresents confidence (§10); removing the fake inflation is a trust-safety necessity even before genuine refinement is built | TBD |
| 10. Overall MVP scope | (a) AI-analysis-and-Copilot-only product; (b) Fuller dashboard product matching current frontend breadth | (a) AI-analysis-and-Copilot-only for MVP, per Decisions 3/5/6/7 above | Matches the only confirmed-working, evidence-backed core; avoids committing to unbuilt infrastructure prematurely | TBD |

All recommendations above are labeled **[MINIMUM VIABLE DECISION]** where marked — they represent the smallest coherent scope needed to ship a usable product built on confirmed-working capability, not a claim about what the original developer intended. All **Final Decision** values are `TBD` pending explicit confirmation by the product owner, as instructed.

---

## 29. ASSUMPTIONS

| Assumption | Why Necessary | Evidence | Risk If Incorrect |
|---|---|---|---|
| The primary audience is equity researchers/analysts, not retail investors | Needed to frame value proposition and journeys coherently | STRONGLY INFERRED from terminology (reconstruction §3) | If the real audience is retail-focused, UX and feature depth (e.g., jargon level, need for education) would need to change |
| A minimal/curated company set is an acceptable MVP scope for search | Needed to make Company Discovery buildable without a full market-data licensing decision upfront | No direct evidence either way; this is a scoping choice made to keep the PRD coherent | If a full market-wide index was actually required from day one, MVP scope is too narrow |
| Single-user, no-auth is an acceptable MVP starting point | Needed to avoid stalling MVP definition on an unresolved account-system decision | No evidence auth was ever planned (reconstruction §16) | If multi-user support was actually intended from the start, this narrows MVP incorrectly and watchlists/other features would need re-scoping |
| The Alternative-data debater is not assumed to ship as a real dimension in MVP | Needed because its current state (fully fake) cannot ethically ship as-is per AI Safety requirements (§23), and no evidence resolves whether real integration was intended | CONFIRMED that it's currently 100% mocked (reconstruction §4, §10) | If alternative-data analysis was actually meant to be a differentiating core feature, deferring it may under-scope the product's intended value |
| Watchlists, market data, and a dedicated news feed are not required for the core value proposition | Needed to distinguish "visually present" from "functionally required," per explicit instruction not to use frontend breadth alone as justification | Explicit reconstruction guidance (§12, §18) and gap matrix showing zero backend support for all three | If these were actually considered essential to the product's market positioning, excluding them from MVP could under-deliver against real expectations |

---

## 30. TRACEABILITY

| Requirement | Reconstruction Evidence | Existing Implementation | Remaining Work |
|---|---|---|---|
| FR-001 Multi-agent analysis | reconstruction §4, §6 Flow B | `/analyze`, `agents/` | None functionally; refine confidence handling (FR-014) |
| FR-002 Scorecard output | reconstruction §11, §16 | `Scorecard`, `ScoreDimension` | None |
| FR-003 Fundamental analysis | reconstruction §10 | `fundamental_debater.py` | None |
| FR-004 Sentiment analysis | reconstruction §10 | `sentiment_debater.py` | Improve transcript-URL reliability (noted fragility) |
| FR-005 Reasoning/evidence display | reconstruction §6 Flow B, §11 | `ReasoningPanel.tsx`, `AgentMessage` | None functionally |
| FR-006 Peer comparison | reconstruction §4, §11 | `PeerComparison`, response field | None |
| FR-007 Copilot Q&A | reconstruction §5, §11, §12 | `/ask`, RAG pipeline | None functionally |
| FR-008 Grounded citations | reconstruction §11, §12 | `AskResponse.citations` | None |
| FR-009 Fallback labeling | reconstruction §12 caution | `fallback_used` flag exists in API | Build UI treatment to visibly label fallback answers |
| FR-010 Document ingestion | reconstruction §6 Flow E, §13 | `ingestion_agent.py` | Optional: improve regex-based extraction quality |
| FR-011 Real company discovery | reconstruction §13 gap matrix, §19 | None (mock only) | Build real company data source + search backend |
| FR-012 Analysis failure error state | Not directly detailed in reconstruction | Unknown/unconfirmed | Define and build explicit failure UX |
| FR-013 Insufficient-evidence dimension state | Derived from AI Safety principle (§28/§23 of this PRD) | Unknown/unconfirmed | Define and build explicit low-evidence UX |
| FR-014 Remove artificial confidence inflation | reconstruction §10, §16 | `coordinator.py` current logic | Replace/remove the `+20` inflation mechanism |
| FR-015–FR-020 (decision-dependent features) | reconstruction §17, §33 of this PRD | Mostly mock-only or absent | Contingent entirely on decisions in §28 of this PRD |

---

## 31. PRD QUALITY CHECK (Internal Consistency)

1. Every P0/P1 requirement traces to CONFIRMED evidence or an explicitly labeled decision (FR-001–FR-013 confirmed; FR-014 explicitly decision-flagged). ✅
2. No UNKNOWN item (e.g., transcript ingestion scope, deployment intent) is presented as fact — each remains flagged. ✅
3. Mocked features (market data, news, watchlists, alternative data) are consistently labeled EXISTING/MOCKED, never described as currently functional. ✅
4. Current state (§26 gap table) and target state are separated throughout. ✅
5. MVP scope (§7, §27) is internally consistent — no feature appears as both MVP Core and Post-MVP. ✅
6. User journeys (§8) map directly to feature specs (§9) and functional requirements (§20). ✅
7. Acceptance criteria (§25) only require features actually selected for MVP scope. ✅
8. No database schema or SQL design appears anywhere in this document. ✅
9. No specific technical vendor (market data, news, auth, LLM) is selected. ✅
10. No unrelated features (trading, payments, social, admin dashboards, mobile apps) were introduced — see §6 Non-Goals. ✅
11. AI-generated analysis is explicitly required to be presented as synthesis to inform judgment, not guaranteed truth (§23). ✅
12. `/analyze` and `/ask` remain the explicit center of the product throughout (§7, §9, §10, §26, §27). ✅

---

## 32. FINAL PRD SUMMARY

### Product in One Sentence
EquityLens is an AI-driven equity research tool that synthesizes fundamental and sentiment evidence into a scored, evidence-backed company scorecard and lets users interrogate that research through a document-grounded Copilot.

### MVP in One Paragraph
The first complete usable version of EquityLens preserves the existing, genuinely functional multi-agent analysis pipeline (`/analyze`) and RAG Copilot (`/ask`), including document ingestion and peer comparison, and adds the minimum real supporting infrastructure needed to use them as a product: a real (even if initially minimal/curated) company discovery mechanism to replace the current mock data, clear presentation of the scorecard and its reasoning/evidence, visible labeling of any non-grounded Copilot fallback answers, and removal of the coordinator's current artificial confidence-inflation behavior. Market data/charts, a dedicated news feed, watchlists, real alternative-data integration, and authentication are explicitly deferred pending the product decisions in §28, not silently included or excluded.

### Current State
A working AI research core (`/analyze`, `/ask`, document ingestion, peer comparison) wrapped in a largely mocked frontend (company data, prices, charts, news, watchlists) with no authentication and no deployment infrastructure.

### Major Remaining Work
- Build a real company discovery/search backend (replacing `dummyData.ts`).
- Remove or replace the coordinator's artificial confidence-inflation mechanism.
- Add visible UX labeling for Copilot's non-grounded fallback answers.
- Define explicit failure/empty states for analysis and evidence-scarce dimensions.
- Resolve and, where selected, build out market data, news, watchlists, alternative-data integration, and authentication.
- Define a deployment model (currently entirely absent).

### Major Product Decisions
All ten items in §28 remain open and are marked `TBD`: single-user vs. multi-user, authentication, market data inclusion, alternative-data agent's future, watchlists, dedicated news feed, company index scope, deployment model, coordinator refinement approach, and overall MVP breadth. This PRD proposes minimum-viable defaults for coherence but does not treat any of them as finally decided.

### PRD Confidence
- **High-confidence requirements**: FR-001 through FR-008, FR-010 (the core AI analysis and Copilot pipeline, and document ingestion) — all CONFIRMED working capabilities.
- **Medium-confidence requirements**: FR-009, FR-011, FR-012, FR-013 (fallback labeling, real company discovery, failure/empty-state UX) — needed for usability but not directly detailed in the source evidence, so specifics (not existence) carry medium confidence.
- **Decision-dependent requirements**: FR-014 through FR-020, and everything in §15–§18 and §27–§28 concerning market data, news, watchlists, alternative data, authentication, and coordinator refinement — none of these are final until the corresponding product decision is made.
