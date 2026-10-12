import { z, type ZodType, type ZodTypeDef } from "zod";
import type {
  AskResponse, Capabilities, CompareResponse, CompareStatement, Company, FinancialsResponse, HistoryRange, HistoryResponse,
  MoversResponse, NewsResponse, Quote, ResearchReport, SearchParams, SearchResponse, Segment,
  SnapshotResponse, StatementKind, ResearchJob, User, Watchlist,
} from "@/types/api";

const DEFAULT_TIMEOUT_MS = 30_000;
export const RESEARCH_TIMEOUT_MS = 90_000; // compare and ask only; research generation is a background job

export const apiBase = (): string => String(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

// ---------------------------------------------------------------- errors

export class ApiError extends Error {
  status: number;
  code: string | null;
  retryAfter: number | null;
  requestId: string | null;
  /** Per-field validation messages from a 422, keyed by the request field (e.g. "email"). */
  fields: Record<string, string>;

  constructor(opts: { status: number; message: string; code?: string | null; retryAfter?: number | null; requestId?: string | null; fields?: Record<string, string> }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code ?? null;
    this.retryAfter = opts.retryAfter ?? null;
    this.requestId = opts.requestId ?? null;
    this.fields = opts.fields ?? {};
  }

  /** A restricted data source is switched off for this deployment (HTTP 503 {code:'source_disabled'}). */
  get isSourceDisabled(): boolean {
    return this.code === "source_disabled";
  }

  /** FastAPI's own 404 for a route that does not exist ({"detail":"Not Found"}) has no code. */
  get isEndpointMissing(): boolean {
    return (this.status === 404 || this.status === 405) && this.code === null && /^(not found|method not allowed)$/i.test(this.message);
  }
}

export const isAbortError = (e: unknown): boolean => e instanceof DOMException && e.name === "AbortError";

function parseRetryAfter(h: string | null): number | null {
  if (!h) return null;
  const n = Number(h);
  if (Number.isFinite(n) && n >= 0) return n;
  const t = Date.parse(h);
  return Number.isNaN(t) ? null : Math.max(0, Math.round((t - Date.now()) / 1000));
}

/** Pydantic prefixes validator messages with "Value error, "; users should not see that. */
export const cleanValidationMessage = (m: string): string => m.replace(/^Value error,\s*/i, "").trim();

function errorFromBody(status: number, body: unknown, retryAfter: number | null): ApiError {
  let message = "";
  let code: string | null = null;
  let requestId: string | null = null;
  let structured = false;
  const fields: Record<string, string> = {};
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.request_id === "string") requestId = b.request_id;
    const d = b.detail;
    if (typeof d === "string") message = d;
    else if (Array.isArray(d)) {
      message = d
        .map((i) => {
          const it = i as { loc?: unknown[]; msg?: string };
          const field = Array.isArray(it.loc) ? it.loc.filter((x) => x !== "body").join(".") : "";
          const msg = cleanValidationMessage(it.msg ?? "invalid");
          if (field && !(field in fields)) fields[field] = msg;
          return field ? `${field}: ${msg}` : msg;
        })
        .join("; ");
      code = "validation_error";
    } else if (d && typeof d === "object") {
      const o = d as { code?: unknown; message?: unknown };
      if (typeof o.code === "string") code = o.code;
      if (typeof o.message === "string") message = o.message;
      structured = !!message;
    }
  }
  // A structured {code,message} detail carries the server's own wording; never overwrite it.
  if (status === 429 && !structured) {
    message = `Too many requests. Please try again later${retryAfter != null ? ` (retry in about ${Math.ceil(retryAfter)}s)` : ""}.`;
    code = code ?? "rate_limited";
  }
  if (!message) message = status >= 500 ? "The server had a problem. Please try again." : `Request failed (${status}).`;
  return new ApiError({ status, message, code, retryAfter, requestId, fields });
}

// ---------------------------------------------------------------- auth hooks

let unauthorizedHandler: (() => void) | null = null;
/** The auth provider registers a callback that clears auth state when any API call returns 401. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "el_csrf") return decodeURIComponent(rest.join("="));
  }
  return null;
}

// ---------------------------------------------------------------- core request

interface RequestOpts<T> {
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  schema?: ZodType<T, ZodTypeDef, unknown>;
  /** Auth endpoints return 401 for bad credentials; that is not a session expiry. */
  skip401Handler?: boolean;
}

async function request<T>(method: string, path: string, opts: RequestOpts<T> = {}): Promise<T> {
  const url = new URL(`${apiBase()}${path}`, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const finalUrl = apiBase() ? url.toString() : `${url.pathname}${url.search}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && method !== "HEAD") {
    const csrf = readCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", onCallerAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(finalUrl, {
      method,
      headers,
      credentials: "include",
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (timedOut) throw new ApiError({ status: 0, code: "timeout", message: "The request timed out. Please try again." });
    if (isAbortError(e)) throw e;
    throw new ApiError({ status: 0, code: "network", message: "Could not reach the server. Check your connection and try again." });
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onCallerAbort);
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = errorFromBody(res.status, data, parseRetryAfter(res.headers.get("Retry-After")));
    if (res.status === 401 && !opts.skip401Handler) unauthorizedHandler?.();
    throw err;
  }

  if (opts.schema) {
    const parsed = opts.schema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError({ status: res.status, code: "invalid_response", message: "The server sent data in an unexpected format, so it cannot be shown. Please try again later." });
    }
    return parsed.data;
  }
  return data as T;
}

// ---------------------------------------------------------------- schemas (auth, search, quote)

const userSchema = z.object({ id: z.union([z.string(), z.number()]).transform(String), email: z.string() });

const companySchema = z.object({
  id: z.string(),
  name: z.string(),
  isin: z.string().nullable().optional().transform((v) => v ?? ""),
  sector: z.string().nullable().optional().transform((v) => v ?? null),
  listings: z.array(z.object({ exchange: z.string(), symbol: z.string() })).default([]),
  primary_symbol: z.string(),
  exchange: z.string(),
});

const searchSchema = z.object({
  items: z.array(companySchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  source: z.string(),
});

const provenanceSchema = z.object({
  source: z.string(),
  delayed: z.boolean(),
  note: z.string().nullable().optional().transform((v) => v ?? null),
  cached: z.boolean(),
  stale: z.boolean(),
  fetched_at: z.string(),
});

const nullableNum = z.number().nullable().optional().transform((v) => v ?? null);

const quoteSchema = z.object({
  company_id: z.string(),
  symbol: z.string(),
  currency: z.string(),
  price: z.number(),
  previous_close: nullableNum,
  change: nullableNum,
  change_percent: nullableNum,
  change_basis: z.string().optional().transform((v) => v ?? ""),
  week52_high: nullableNum,
  week52_low: nullableNum,
  volume: nullableNum,
  as_of: z.string(),
  provenance: provenanceSchema,
});

const nullableStr = z.string().nullable().optional().transform((v) => v ?? null);
const nullableBool = z.boolean().nullable().optional().transform((v) => v ?? null);
// The API sends null (not a missing key) for flags that do not apply, e.g. cached/stale on an unavailable snapshot row.
const boolDefault = (d: boolean) => z.boolean().nullable().optional().transform((v) => v ?? d);

const barSchema = z.object({
  date: z.string(),
  open: nullableNum, high: nullableNum, low: nullableNum, close: nullableNum,
  volume: nullableNum,
});
const historySchema = z.object({
  bars: z.array(barSchema).default([]),
  interval: z.string().optional().transform((v) => v ?? ""),
  provenance: provenanceSchema,
});

const newsSchema = z.object({
  items: z.array(z.object({
    title: z.string(), url: z.string(), source: z.string().optional().transform((v) => v ?? ""),
    published_at: nullableStr, excerpt: nullableStr, author: nullableStr,
  })).default([]),
  total: z.number(),
  limit: z.number().optional().transform((v) => v ?? 0),
  offset: z.number().optional().transform((v) => v ?? 0),
  source: z.string().optional().transform((v) => v ?? ""),
  attribution: z.string().optional().transform((v) => v ?? ""),
  cached: boolDefault(false), stale: boolDefault(false),
  fetched_at: nullableStr,
});

const financialsSchema = z.object({
  basis: nullableStr,
  period_type: z.string().optional().transform((v) => v ?? ""),
  periods: z.array(z.string()).default([]),
  rows: z.array(z.object({ metric: z.string(), unit: nullableStr, values: z.record(z.number().nullable()).default({}) })),
  source: z.string().optional().transform((v) => v ?? ""),
  source_url: nullableStr, retrieved_at: nullableStr,
  stale: boolDefault(false), refresh_error: nullableStr, notice: nullableStr,
});

const moverSchema = z.object({
  company_id: z.string(), symbol: z.string(), name: z.string(),
  price: z.number(), previous_close: nullableNum, change_percent: z.number(),
});
const moversSchema = z.object({
  segment: z.string(),
  as_of_date: nullableStr,
  gainers: z.array(moverSchema).default([]),
  losers: z.array(moverSchema).default([]),
  evaluated: z.number().default(0), excluded: z.number().default(0), universe_size: z.number().default(0),
  source: nullableStr, delayed: boolDefault(true), note: nullableStr,
  cached: nullableBool, stale: nullableBool, fetched_at: nullableStr,
  batches_failed: z.number().default(0), partial: boolDefault(false), reason: nullableStr,
});

const watchlistSchema = z.object({
  id: z.string(), name: z.string(),
  created_at: z.string().optional().transform((v) => v ?? ""),
  items: z.array(z.object({ company_id: z.string(), name: z.string(), symbol: z.string(), added_at: z.string().optional().transform((v) => v ?? "") })).default([]),
  max_items: z.number().default(0),
});
const watchlistListSchema = z.array(watchlistSchema);

const snapshotSchema = z.object({
  rows: z.array(z.object({
    company_id: z.string(), name: z.string(), symbol: z.string(),
    status: z.string(), reason: nullableStr, price: nullableNum, change_percent: nullableNum, as_of: nullableStr,
    cached: boolDefault(false), stale: boolDefault(false),
  })),
  source: z.string().optional().transform((v) => v ?? ""),
  delayed: boolDefault(true), note: nullableStr,
});

const compareSchema = z.object({
  companies: z.array(z.object({
    company_id: z.string(), name: z.string(), symbol: z.string(),
    period: nullableStr, basis: nullableStr,
    status: z.string().optional().transform((v) => v ?? "ok"), reason: nullableStr,
  })),
  statement: z.string().optional().transform((v) => v ?? ""),
  period: nullableStr,
  rows: z.array(z.object({ metric: z.string(), unit: nullableStr, values: z.record(z.number().nullable()).default({}) })),
  source: z.string().optional().transform((v) => v ?? ""),
  basis_note: nullableStr, retrieved_at: nullableStr, notice: nullableStr,
});

const researchSchema = z.object({
  id: z.string(), company_id: z.string(),
  company_name: z.string().optional().transform((v) => v ?? ""),
  status: z.string(),
  generated_at: z.string(),
  disclaimer: z.string().optional().transform((v) => v ?? ""),
  overall: z.object({ score: nullableNum, confidence: nullableNum, confidence_basis: z.array(z.string()).default([]) }),
  dimensions: z.array(z.object({
    key: z.string(), title: z.string(), status: z.string(),
    position: nullableStr, score: nullableNum, confidence: nullableNum,
    summary: z.string().optional().transform((v) => v ?? ""),
    evidence: z.array(z.object({ text: z.string(), source_ref: nullableNum })).default([]),
    criteria: z.array(z.object({
      key: z.string(), label: z.string(), value: z.number(), unit: z.string().optional().transform((v) => v ?? ""),
      score: z.number(), detail: z.string().optional().transform((v) => v ?? ""), source_ref: nullableNum,
    })).default([]),
    limitations: z.array(z.string()).default([]),
  })).default([]),
  sources: z.array(z.object({
    id: z.number(), title: z.string(), url: nullableStr, type: z.string().optional().transform((v) => v ?? ""),
    retrieved_at: z.string().optional().transform((v) => v ?? ""), as_of: nullableStr,
  })).default([]),
  refinement: z.object({ rounds: z.number().default(0), changes: z.array(z.string()).default([]), skipped_reason: nullableStr })
    .default({ rounds: 0, changes: [], skipped_reason: null }),
  limitations: z.array(z.string()).default([]),
  method_note: nullableStr,
  reused: boolDefault(false),
});

const jobSchema = z.object({
  job_id: z.string(), company_id: z.string(), status: z.string(),
  error: z.object({ code: nullableStr, message: z.string().optional().transform((v) => v ?? "") }).nullable().optional().transform((v) => v ?? null),
  report_id: nullableStr,
  report: researchSchema.nullable().optional().transform((v) => v ?? null),
  created_at: z.string().optional().transform((v) => v ?? ""),
  started_at: nullableStr, finished_at: nullableStr,
  poll_after_ms: z.number().optional().transform((v) => (v && v > 0 ? v : 2000)),
});

const askSchema = z.object({
  answer: z.string(),
  grounded: z.boolean(),
  citations: z.array(z.object({
    index: z.number(), title: z.string(), url: nullableStr, page: nullableNum,
    excerpt: z.string().optional().transform((v) => v ?? ""), as_of: nullableStr,
  })).default([]),
  retrieval_count: z.number().default(0),
  notice: nullableStr,
});

const sourceCap = z.object({ enabled: z.boolean(), reason: nullableStr, provider: nullableStr });
const capabilitiesSchema = z.object({
  profile: z.string().optional().transform((v) => v ?? "public"),
  market_data: sourceCap.extend({ delayed: boolDefault(true) }),
  fundamentals: sourceCap,
  index_segments: sourceCap,
  news: z.object({ enabled: boolDefault(true), reason: nullableStr, excerpts_displayed: boolDefault(false), provider: nullableStr }),
  ai: z.object({ research: boolDefault(true), reason: nullableStr, copilot_provider: nullableStr, note: nullableStr }),
});

// ---------------------------------------------------------------- endpoints

const enc = encodeURIComponent;
// tsconfig is non-strict, which makes zod infer optional fields; assert the intended output type.
const typed = <T,>(s: unknown) => s as ZodType<T, ZodTypeDef, unknown>;

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<User>("POST", "/auth/register", { body: { email, password }, schema: typed<User>(userSchema), skip401Handler: true }),
    login: (email: string, password: string) =>
      request<User>("POST", "/auth/login", { body: { email, password }, schema: typed<User>(userSchema), skip401Handler: true }),
    // The CSRF header is attached by request() for every unsafe method, logout included.
    logout: () => request<void>("POST", "/auth/logout", { skip401Handler: true }),
    logoutAll: () => request<void>("POST", "/auth/logout-all", { skip401Handler: true }),
    me: (signal?: AbortSignal) => request<User>("GET", "/auth/me", { schema: typed<User>(userSchema), signal }),
  },
  capabilities: (signal?: AbortSignal) =>
    request<Capabilities>("GET", "/api/v1/capabilities", { schema: typed<Capabilities>(capabilitiesSchema), signal }),
  companies: {
    search: (p: SearchParams, signal?: AbortSignal) =>
      request<SearchResponse>("GET", "/api/v1/companies/search", {
        query: { q: p.q ?? "", sector: p.sector, segment: p.segment, limit: p.limit, offset: p.offset },
        schema: typed<SearchResponse>(searchSchema),
        signal,
      }),
    get: (id: string, signal?: AbortSignal) =>
      request<Company>("GET", `/api/v1/companies/${enc(id)}`, { schema: typed<Company>(companySchema), signal }),
    quote: (id: string, signal?: AbortSignal) =>
      request<Quote>("GET", `/api/v1/companies/${enc(id)}/quote`, { schema: typed<Quote>(quoteSchema), signal }),
    history: (id: string, range: HistoryRange, signal?: AbortSignal) =>
      request<HistoryResponse>("GET", `/api/v1/companies/${enc(id)}/history`, { query: { range }, schema: typed<HistoryResponse>(historySchema), signal }),
    news: (id: string, limit = 10, offset = 0, signal?: AbortSignal) =>
      request<NewsResponse>("GET", `/api/v1/companies/${enc(id)}/news`, { query: { limit, offset }, schema: typed<NewsResponse>(newsSchema), signal }),
    financials: (id: string, statement: StatementKind, signal?: AbortSignal) =>
      request<FinancialsResponse>("GET", `/api/v1/companies/${enc(id)}/financials`, { query: { statement }, schema: typed<FinancialsResponse>(financialsSchema), signal }),
  },
  market: {
    movers: (segment: Segment, top = 5, signal?: AbortSignal) =>
      request<MoversResponse>("GET", "/api/v1/market/movers", { query: { segment, top }, schema: typed<MoversResponse>(moversSchema), signal }),
  },
  watchlists: {
    list: (signal?: AbortSignal) => request<Watchlist[]>("GET", "/api/v1/watchlists", { schema: typed<Watchlist[]>(watchlistListSchema), signal }),
    create: (name: string) => request<Watchlist>("POST", "/api/v1/watchlists", { body: { name }, schema: typed<Watchlist>(watchlistSchema) }),
    rename: (id: string, name: string) => request<Watchlist>("PATCH", `/api/v1/watchlists/${enc(id)}`, { body: { name }, schema: typed<Watchlist>(watchlistSchema) }),
    remove: (id: string) => request<void>("DELETE", `/api/v1/watchlists/${enc(id)}`),
    addItem: (id: string, company_id: string) =>
      request<Watchlist>("POST", `/api/v1/watchlists/${enc(id)}/items`, { body: { company_id }, schema: typed<Watchlist>(watchlistSchema) }),
    removeItem: (id: string, company_id: string) =>
      request<void>("DELETE", `/api/v1/watchlists/${enc(id)}/items/${enc(company_id)}`),
    snapshot: (id: string, signal?: AbortSignal) =>
      request<SnapshotResponse>("GET", `/api/v1/watchlists/${enc(id)}/snapshot`, { schema: typed<SnapshotResponse>(snapshotSchema), signal }),
    compare: (id: string, statement: CompareStatement = "quarterly_results", signal?: AbortSignal) =>
      request<CompareResponse>("POST", `/api/v1/watchlists/${enc(id)}/compare`, {
        body: { statement }, schema: typed<CompareResponse>(compareSchema), signal, timeoutMs: RESEARCH_TIMEOUT_MS,
      }),
  },
  research: {
    /** Starts (or returns the already-active) background job; fast, so the normal timeout applies. */
    start: (company_id: string, signal?: AbortSignal) =>
      request<ResearchJob>("POST", `/api/v1/research/${enc(company_id)}`, { body: {}, schema: typed<ResearchJob>(jobSchema), signal }),
    job: (job_id: string, signal?: AbortSignal) =>
      request<ResearchJob>("GET", `/api/v1/research/jobs/${enc(job_id)}`, { schema: typed<ResearchJob>(jobSchema), signal }),
    active: (company_id: string, signal?: AbortSignal) =>
      request<ResearchJob>("GET", "/api/v1/research/active", { query: { company_id }, schema: typed<ResearchJob>(jobSchema), signal }),
    latest: (company_id: string, signal?: AbortSignal) =>
      request<ResearchReport>("GET", "/api/v1/research/latest", { query: { company_id }, schema: typed<ResearchReport>(researchSchema), signal }),
  },
  ask: (company_id: string, question: string, top_k?: number, signal?: AbortSignal) =>
    request<AskResponse>("POST", "/api/v1/ask", { body: { company_id, question, top_k }, schema: typed<AskResponse>(askSchema), signal, timeoutMs: RESEARCH_TIMEOUT_MS }),
};

/** Human-readable message for UI error states. */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}
