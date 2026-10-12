// Types mirror the backend JSON contract. Optional/nullable fields are modelled explicitly
// so the UI can render "Not available from the current source" rather than NaN/undefined.

export interface User {
  id: string;
  email: string;
}

export interface Listing {
  exchange: string;
  symbol: string;
}

export interface Company {
  id: string;
  name: string;
  isin: string;
  sector: string | null;
  listings: Listing[];
  primary_symbol: string;
  exchange: string;
}

export type Segment = "large" | "mid" | "small";

export interface SearchResponse {
  items: Company[];
  total: number;
  limit: number;
  offset: number;
  source: string;
}

export interface SearchParams {
  q?: string;
  sector?: string;
  segment?: Segment;
  limit?: number;
  offset?: number;
}

export interface Provenance {
  source: string;
  delayed: boolean;
  note: string | null;
  cached: boolean;
  stale: boolean;
  fetched_at: string;
}

export interface Quote {
  company_id: string;
  symbol: string;
  currency: string;
  price: number;
  previous_close: number | null;
  change: number | null;
  change_percent: number | null;
  change_basis: string;
  week52_high: number | null;
  week52_low: number | null;
  volume: number | null;
  as_of: string;
  provenance: Provenance;
}

export type HistoryRange = "1mo" | "3mo" | "6mo" | "1y" | "5y";

export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface HistoryResponse {
  bars: Bar[];
  interval: string;
  provenance: Provenance;
}

export interface SourceCapability {
  enabled: boolean;
  reason: string | null;
  provider: string | null;
}

export interface Capabilities {
  profile: "public" | "personal" | string;
  market_data: SourceCapability & { delayed: boolean };
  fundamentals: SourceCapability;
  index_segments: SourceCapability;
  news: { enabled: boolean; reason: string | null; excerpts_displayed: boolean; provider: string | null };
  ai: { research: boolean; reason: string | null; copilot_provider: string | null; note: string | null };
}

/** "news" and "ai" (research + Copilot need at least one evidence source) are switched independently of the market sources. */
export type SourceName = "market_data" | "fundamentals" | "index_segments" | "news" | "ai";

export interface Mover {
  company_id: string;
  symbol: string;
  name: string;
  price: number;
  previous_close: number;
  change_percent: number;
}

export interface MoversResponse {
  segment: Segment;
  as_of_date: string | null;
  gainers: Mover[];
  losers: Mover[];
  evaluated: number;
  excluded: number;
  universe_size: number;
  source: string | null;
  delayed: boolean;
  note: string | null;
  cached: boolean | null;
  stale: boolean | null;
  fetched_at: string | null;
  batches_failed: number;
  partial: boolean;
  reason: string | null;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string | null;
  excerpt: string | null;
  author: string | null;
}

export interface NewsResponse {
  items: NewsItem[];
  total: number;
  limit: number;
  offset: number;
  source: string;
  attribution: string;
  cached: boolean;
  stale: boolean;
  fetched_at: string;
}

export type StatementKind = "quarterly_results" | "profit_loss" | "balance_sheet" | "cash_flow" | "ratios";
export type CompareStatement = "quarterly_results" | "profit_loss" | "ratios" | "balance_sheet" | "shareholding";

export interface FinancialRow {
  metric: string;
  unit: string | null;
  values: Record<string, number>;
}

export interface FinancialsResponse {
  basis: string | null;
  period_type: string;
  periods: string[];
  rows: FinancialRow[];
  source: string;
  source_url: string | null;
  retrieved_at: string | null;
  stale: boolean;
  refresh_error: string | null;
  notice: string | null;
}

export interface WatchlistItem {
  company_id: string;
  name: string;
  symbol: string;
  added_at: string;
}

export interface Watchlist {
  id: string;
  name: string;
  created_at: string;
  items: WatchlistItem[];
  max_items: number;
}

export interface SnapshotRow {
  company_id: string;
  name: string;
  symbol: string;
  status: "ok" | "unavailable";
  reason: string | null;
  price: number | null;
  change_percent: number | null;
  as_of: string | null;
  cached: boolean;
  stale: boolean;
}

export interface SnapshotResponse {
  rows: SnapshotRow[];
  source: string;
  delayed: boolean;
  note: string | null;
}

export interface CompareCompany {
  company_id: string;
  name: string;
  symbol: string;
  period: string | null;
  basis: string | null;
  status: "ok" | "unavailable";
  reason: string | null;
}

export interface CompareResponse {
  companies: CompareCompany[];
  statement: string;
  period: string | null;
  rows: { metric: string; unit: string | null; values: Record<string, number | null> }[];
  source: string;
  basis_note: string | null;
  retrieved_at: string | null;
  notice: string | null;
}

// ---- Research (backend endpoint may not exist yet) ----

export type DimensionKey = "fundamental" | "sentiment" | "alternative";

export interface ResearchCriterion {
  key: string;
  label: string;
  value: number;
  unit: string;
  score: number;
  detail: string;
  source_ref: number | null;
}

export interface ResearchDimension {
  key: DimensionKey;
  title: string;
  status: "ok" | "unavailable" | "failed";
  position: "bullish" | "bearish" | "neutral" | null;
  score: number | null;
  confidence: number | null;
  summary: string;
  evidence: { text: string; source_ref: number | null }[];
  criteria: ResearchCriterion[];
  limitations: string[];
}

export interface ResearchSource {
  id: number;
  title: string;
  url: string | null;
  type: "financial_data" | "news" | "filing" | "alternative";
  retrieved_at: string;
  as_of: string | null;
}

export interface ResearchReport {
  id: string;
  company_id: string;
  company_name: string;
  status: "complete" | "partial";
  generated_at: string;
  disclaimer: string;
  overall: {
    score: number | null;
    confidence: number | null;
    confidence_basis: string[];
  };
  dimensions: ResearchDimension[];
  sources: ResearchSource[];
  refinement: { rounds: number; changes: string[]; skipped_reason: string | null };
  limitations: string[];
  method_note: string | null;
  reused: boolean;
}

export interface AskCitation {
  index: number;
  title: string;
  url: string | null;
  page: number | null;
  excerpt: string;
  as_of: string | null;
}

export interface AskResponse {
  answer: string;
  grounded: boolean;
  citations: AskCitation[];
  retrieval_count: number;
  notice: string | null;
}

export type JobStatus = "queued" | "running" | "complete" | "failed";

export interface ResearchJob {
  job_id: string;
  company_id: string;
  status: JobStatus;
  error: { code: string | null; message: string } | null;
  report_id: string | null;
  report: ResearchReport | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  poll_after_ms: number;
}
