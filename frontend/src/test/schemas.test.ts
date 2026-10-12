import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/services/api";
import { CAPS_ALL, COMPANY, FINANCIALS, HISTORY, NEWS, jsonResponse, mockFetch, route } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const bad = { unexpected: true };
const cases: [string, string, string, () => Promise<unknown>][] = [
  ["capabilities", "GET", "/api/v1/capabilities", () => api.capabilities()],
  ["history", "GET", "/api/v1/companies/c-1/history", () => api.companies.history("c-1", "3mo")],
  ["news", "GET", "/api/v1/companies/c-1/news", () => api.companies.news("c-1")],
  ["financials", "GET", "/api/v1/companies/c-1/financials", () => api.companies.financials("c-1", "ratios")],
  ["movers", "GET", "/api/v1/market/movers", () => api.market.movers("mid")],
  ["watchlists list", "GET", "/api/v1/watchlists", () => api.watchlists.list()],
  ["snapshot", "GET", "/api/v1/watchlists/w1/snapshot", () => api.watchlists.snapshot("w1")],
  ["compare", "POST", "/api/v1/watchlists/w1/compare", () => api.watchlists.compare("w1")],
  ["research latest", "GET", "/api/v1/research/latest", () => api.research.latest("c-1")],
  ["research job", "GET", "/api/v1/research/jobs/j1", () => api.research.job("j1")],
  ["ask", "POST", "/api/v1/ask", () => api.ask("c-1", "question?")],
];

describe("response schemas", () => {
  it.each(cases)("%s: wrong shape becomes ApiError invalid_response (never a raw object)", async (_n, method, path, call) => {
    mockFetch(route(method, path, () => jsonResponse(200, bad)));
    await expect(call()).rejects.toMatchObject({ name: "ApiError", code: "invalid_response" });
    mockFetch(route(method, path, () => jsonResponse(200, null)));
    await expect(call()).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("invalid_response carries a friendly message", async () => {
    mockFetch(route("GET", "/api/v1/capabilities", () => jsonResponse(200, bad)));
    const e = (await api.capabilities().catch((x) => x)) as ApiError;
    expect(e.message).toMatch(/unexpected format/i);
  });

  it("tolerates extra fields and applies defaults for optional arrays", async () => {
    mockFetch(route("GET", "/api/v1/capabilities", () => jsonResponse(200, { ...CAPS_ALL, brand_new: 1 })));
    await expect(api.capabilities()).resolves.toMatchObject({ market_data: { enabled: true } });
    mockFetch(route("GET", "/api/v1/companies/c-1/history", () => jsonResponse(200, { provenance: HISTORY.provenance, extra: 1 })));
    await expect(api.companies.history("c-1", "1mo")).resolves.toMatchObject({ bars: [] });
    mockFetch(route("GET", "/api/v1/companies/c-1/news", () => jsonResponse(200, { ...NEWS, items: undefined, more: 1 })));
    await expect(api.companies.news("c-1")).resolves.toMatchObject({ items: [] });
    mockFetch(route("GET", "/api/v1/companies/c-1/financials", () => jsonResponse(200, { ...FINANCIALS, source_url: null, basis: null })));
    await expect(api.companies.financials("c-1", "ratios")).resolves.toMatchObject({ basis: null, source_url: null });
    mockFetch(route("GET", "/api/v1/companies/c-1", () => jsonResponse(200, COMPANY)));
    await expect(api.companies.get("c-1")).resolves.toMatchObject({ id: "c-1" });
  });

  it("movers carry the new fields", async () => {
    mockFetch(route("GET", "/api/v1/market/movers", () => jsonResponse(200, { segment: "mid", partial: true, batches_failed: 2, reason: null })));
    await expect(api.market.movers("mid")).resolves.toMatchObject({ partial: true, batches_failed: 2, gainers: [], losers: [] });
  });

  it("structured {code,message} details are not overwritten, including on 429", async () => {
    mockFetch(route("GET", "/api/v1/companies/c-1/financials", () => jsonResponse(429, { detail: { code: "quota", message: "The financial data provider rate limit was reached; try again later." } }, { "Retry-After": "9" })));
    const e = (await api.companies.financials("c-1", "ratios").catch((x) => x)) as ApiError;
    expect(e.code).toBe("quota");
    expect(e.message).toBe("The financial data provider rate limit was reached; try again later.");
    expect(e.retryAfter).toBe(9);
  });

  it("422 validation messages are cleaned of the pydantic prefix and exposed per field", async () => {
    mockFetch(route("POST", "/auth/login", () => jsonResponse(422, { detail: [{ loc: ["body", "email"], msg: "Value error, invalid email address", type: "value_error" }] })));
    const e = (await api.auth.login("é@x.co", "pw").catch((x) => x)) as ApiError;
    expect(e.fields.email).toBe("invalid email address");
    expect(e.message).not.toMatch(/Value error/);
  });

  it("compare posts the chosen statement", async () => {
    const { calls } = mockFetch(route("POST", "/api/v1/watchlists/w1/compare", () => jsonResponse(200, { companies: [], rows: [], statement: "shareholding" })));
    await api.watchlists.compare("w1", "shareholding");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ statement: "shareholding" });
  });
});
