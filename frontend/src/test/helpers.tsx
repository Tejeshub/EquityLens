// Test-only helpers and fixtures. Nothing in here may be imported by production code.
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { vi } from "vitest";
import { AuthProvider } from "@/auth/AuthContext";
import RequireAuth from "@/auth/RequireAuth";

export const jsonResponse = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

export type Handler = (url: URL, init: RequestInit) => Response | Promise<Response> | undefined;

export const CAPS_ALL = {
  profile: "personal",
  market_data: { enabled: true, reason: null, provider: "Test Prices", delayed: true },
  fundamentals: { enabled: true, reason: null, provider: "Test Fundamentals" },
  index_segments: { enabled: true, reason: null, provider: "Test Index" },
  news: { enabled: true, reason: null, excerpts_displayed: true, provider: "Test News" },
  ai: { research: true, reason: null, copilot_provider: "groq", note: "AI output may contain errors." },
};
const OFF_SOURCES = {
  market_data: { enabled: false, reason: "Prices are not shown here (test reason).", provider: "Test Prices", delayed: true },
  fundamentals: { enabled: false, reason: "Financials are not shown here (test reason).", provider: "Test Fundamentals" },
  index_segments: { enabled: false, reason: "Segments are not shown here (test reason).", provider: "Test Index" },
};
/** Public production default: every evidence source is off, including news; AI has nothing to work from. */
export const CAPS_PUBLIC = {
  profile: "public",
  ...OFF_SOURCES,
  news: { enabled: false, reason: "News is not shown here (test reason).", excerpts_displayed: false, provider: "Test News" },
  ai: { research: false, reason: "No data source is enabled (test reason).", copilot_provider: "groq", note: "AI output may contain errors." },
};
/** Public profile with only ENABLE_NEWS=true: headlines (no excerpts); research/Copilot have a sentiment-only evidence base. */
export const CAPS_NEWS_ONLY = {
  ...CAPS_PUBLIC,
  news: { enabled: true, reason: null, excerpts_displayed: false, provider: "Test News" },
  ai: { research: true, reason: null, copilot_provider: "groq", note: "AI output may contain errors." },
};

/** Installs a fetch mock. Handlers are tried in order; unmatched requests fail loudly. */
export function mockFetch(...handlers: Handler[]) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost:3000");
    calls.push({ url, init });
    // Every page asks for capabilities; unless a test supplies its own, all sources are enabled.
    for (const h of [...handlers, capsRoute()]) {
      const r = await h(url, init);
      if (r) return r;
    }
    throw new Error(`Unmocked fetch: ${init.method ?? "GET"} ${url.pathname}${url.search}`);
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

export const route = (method: string, path: string | RegExp, respond: (url: URL, init: RequestInit) => Response | Promise<Response>): Handler =>
  (url, init) => {
    const m = (init.method ?? "GET").toUpperCase();
    const ok = typeof path === "string" ? url.pathname === path : path.test(url.pathname);
    return m === method && ok ? respond(url, init) : undefined;
  };

export const ME = { id: "u1", email: "me@example.com" };
export const capsRoute = (caps: unknown = CAPS_ALL) => route("GET", "/api/v1/capabilities", () => jsonResponse(200, caps));
export const meRoute = route("GET", "/auth/me", () => jsonResponse(200, ME));

export const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });

const LocationProbe = () => {
  const l = useLocation();
  return <div data-testid="location">{`${l.pathname}${l.search}`}</div>;
};

/** Renders `ui` inside providers; if `guarded`, under the same RequireAuth wrapper the app uses. */
export function renderWithProviders(ui: ReactElement, opts: { path?: string; routePath?: string; guarded?: boolean; withAuth?: boolean } = {}) {
  const { path = "/", routePath = "*", guarded = false, withAuth = true } = opts;
  const client = makeClient();
  const inner = guarded ? (
    <Routes>
      <Route path="/login" element={<div>LOGIN PAGE</div>} />
      <Route element={<RequireAuth />}>
        <Route path={routePath} element={ui} />
      </Route>
    </Routes>
  ) : (
    <Routes><Route path={routePath} element={ui} /></Routes>
  );
  const tree = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {withAuth ? <AuthProvider>{inner}</AuthProvider> : inner}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { client, ...render(tree) };
}

// ---------------------------------------------------------------- fixtures

export const COMPANY = {
  id: "c-1", name: "Acme Chemicals Ltd", isin: "INE000A01010", sector: "Chemicals",
  listings: [{ exchange: "NSE", symbol: "ACME" }], primary_symbol: "ACME", exchange: "NSE",
};

export const QUOTE_FULL = {
  company_id: "c-1", symbol: "ACME", currency: "INR", price: 1234.5, previous_close: 1200, change: 34.5, change_percent: 2.875,
  change_basis: "previous close", week52_high: 1500, week52_low: 900, volume: 123456, as_of: "2026-10-12T09:45:00Z",
  provenance: { source: "Yahoo Finance", delayed: true, note: null, cached: true, stale: false, fetched_at: "2026-10-12T09:46:00Z" },
};

export const QUOTE_SPARSE = {
  ...QUOTE_FULL, previous_close: null, change: null, change_percent: null, week52_high: null, week52_low: null, volume: null,
  provenance: { ...QUOTE_FULL.provenance, stale: true },
};

export const HISTORY = {
  interval: "1d",
  bars: [
    { date: "2026-10-09", open: 1190, high: 1210, low: 1180, close: 1200, volume: 1000 },
    { date: "2026-10-12", open: 1200, high: 1240, low: 1195, close: 1234.5, volume: null },
  ],
  provenance: QUOTE_FULL.provenance,
};

export const NEWS = {
  items: [
    { title: "Acme posts results", url: "https://news.example.com/a", source: "Example News", published_at: "2026-10-11T08:00:00Z", excerpt: "Profit rose.", author: null },
    { title: "Unsafe link item", url: "javascript:alert(1)", source: "Bad Source", published_at: null, excerpt: null, author: "Jane" },
  ],
  total: 2, limit: 10, offset: 0, source: "ExampleProvider", attribution: "News provided by ExampleProvider", cached: false, stale: false,
  fetched_at: "2026-10-12T09:00:00Z",
};

export const FINANCIALS = {
  basis: "consolidated", period_type: "quarterly",
  periods: ["2025-06-30", "2025-09-30", "2026-06-30"],
  rows: [
    { metric: "Sales", unit: "Rs. Cr", values: { "2025-06-30": 100, "2025-09-30": 120, "2026-06-30": 150 } },
    { metric: "Net Profit", unit: "Rs. Cr", values: { "2025-06-30": 0, "2026-06-30": 20 } },
  ],
  source: "Screener.in", source_url: "https://www.screener.in/company/ACME/", retrieved_at: "2026-10-10T00:00:00Z",
  stale: true, refresh_error: "upstream timeout", notice: "Figures are as reported.",
};

export const defaultCompanyRoutes: Handler[] = [
  meRoute,
  route("GET", "/api/v1/companies/c-1", () => jsonResponse(200, COMPANY)),
  route("GET", "/api/v1/companies/c-1/quote", () => jsonResponse(200, QUOTE_FULL)),
  route("GET", "/api/v1/companies/c-1/history", () => jsonResponse(200, HISTORY)),
  route("GET", "/api/v1/companies/c-1/news", () => jsonResponse(200, NEWS)),
  route("GET", "/api/v1/companies/c-1/financials", () => jsonResponse(200, FINANCIALS)),
];
