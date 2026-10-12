import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import CompanyDetail from "@/pages/CompanyDetail";
import Index from "@/pages/Index";
import {
  COMPANY, FINANCIALS, HISTORY, QUOTE_SPARSE, defaultCompanyRoutes, jsonResponse, meRoute, mockFetch, renderWithProviders, route,
} from "./helpers";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const renderCompany = (id = "c-1") => renderWithProviders(<CompanyDetail />, { path: `/company/${id}`, routePath: "/company/:id" });
const noBadText = () => {
  const text = document.body.textContent ?? "";
  expect(text).not.toMatch(/NaN|undefined|Infinity|\bnull\b/);
};

describe("CompanyDetail", () => {
  it("renders real fixture data with provenance and delayed label", async () => {
    mockFetch(...defaultCompanyRoutes);
    renderCompany();
    expect(await screen.findByText("Acme Chemicals Ltd")).toBeInTheDocument();
    expect(await screen.findByText(/₹1,234\.50/)).toBeInTheDocument();
    expect(screen.getAllByText(/Delayed – Test Prices/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Source: Yahoo Finance/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("cached").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/real-?time/i);
    // none of the old fabricated numbers
    expect(document.body.textContent).not.toMatch(/Confidence: 82%|8\.2|Q3 FY26/);
    noBadText();
  });

  it("renders missing quote values as 'Not available from the current source' and flags stale", async () => {
    mockFetch(...defaultCompanyRoutes.slice(0, 2), route("GET", "/api/v1/companies/c-1/quote", () => jsonResponse(200, QUOTE_SPARSE)), ...defaultCompanyRoutes.slice(3));
    renderCompany();
    await screen.findByText(/This price is stale/);
    expect(screen.getAllByLabelText("Not available from the current source").length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByTitle("Not available from the current source")[0]).toHaveTextContent("—");
    noBadText();
  });

  it("shows 'Company not found' for an unknown id without falling back to another company", async () => {
    mockFetch(meRoute, route("GET", "/api/v1/companies/nope", () => jsonResponse(404, { detail: { code: "company_not_found", message: "Company not found" } })));
    renderCompany("nope");
    expect(await screen.findByRole("heading", { name: "Company not found" })).toBeInTheDocument();
    expect(screen.queryByText("Acme Chemicals Ltd")).not.toBeInTheDocument();
  });

  it("shows quote errors without breaking the page", async () => {
    mockFetch(...defaultCompanyRoutes.slice(0, 2), route("GET", "/api/v1/companies/c-1/quote", () => jsonResponse(504, { detail: { code: "provider_timeout", message: "Quote provider timed out" } })), ...defaultCompanyRoutes.slice(3));
    renderCompany();
    expect(await screen.findByText("Quote provider timed out")).toBeInTheDocument();
    expect(screen.getByText("Acme Chemicals Ltd")).toBeInTheDocument();
  });

  it("renders news with safe links only, attribution, and no sentiment", async () => {
    mockFetch(...defaultCompanyRoutes);
    renderCompany();
    const link = await screen.findByRole("link", { name: "Acme posts results" });
    expect(link).toHaveAttribute("href", "https://news.example.com/a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("link", { name: "Unsafe link item" })).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe link item")).toBeInTheDocument();
    expect(screen.getByText("News provided by ExampleProvider")).toBeInTheDocument();
    expect(screen.getByText("Publication date not available")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/positive|negative|bullish/i);
    noBadText();
  });

  it("range buttons refetch history with the chosen range; empty bars show an empty state", async () => {
    const { calls } = mockFetch(
      ...defaultCompanyRoutes.slice(0, 3),
      route("GET", "/api/v1/companies/c-1/history", (url) =>
        jsonResponse(200, url.searchParams.get("range") === "1y" ? { ...HISTORY, bars: [] } : HISTORY)),
      ...defaultCompanyRoutes.slice(4),
    );
    renderCompany();
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith("/history"))).toBe(true));
    expect(calls.find((c) => c.url.pathname.endsWith("/history"))!.url.searchParams.get("range")).toBe("3mo");
    fireEvent.click(screen.getByRole("button", { name: "1Y" }));
    expect(await screen.findByText("No price history for this range")).toBeInTheDocument();
    expect(calls.filter((c) => c.url.pathname.endsWith("/history")).map((c) => c.url.searchParams.get("range"))).toContain("1y");
  });

  it("does not trigger research on page load", async () => {
    const { calls } = mockFetch(...defaultCompanyRoutes);
    renderCompany();
    await screen.findByText("Acme Chemicals Ltd");
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.some((c) => c.url.pathname.startsWith("/api/v1/research") || c.url.pathname === "/api/v1/ask")).toBe(false);
    expect(calls.every((c) => (c.init.method ?? "GET") === "GET")).toBe(true);
  });
});

describe("Financials tab", () => {
  const openFinancials = async () => {
    renderCompany();
    await screen.findByText("Acme Chemicals Ltd");
    const tab = screen.getByRole("tab", { name: "Financials" });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
  };

  it("renders reported values, 'Not available' for absent periods, stale + source, no NaN", async () => {
    mockFetch(...defaultCompanyRoutes);
    await openFinancials();
    expect(await screen.findByText(/Stale data/)).toBeInTheDocument();
    expect(screen.getByText(/upstream timeout/)).toBeInTheDocument();
    expect(screen.getByText("Figures are as reported.")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Not available from the current source").length).toBe(1); // Net Profit missing 2025-09-30
    expect(screen.getByRole("link", { name: "View source page" })).toHaveAttribute("href", "https://www.screener.in/company/ACME/");
    noBadText();
  });

  it("computes changes only when both periods exist and base is non-zero, and labels them computed", async () => {
    mockFetch(...defaultCompanyRoutes);
    await openFinancials();
    await screen.findByText("Sales", { exact: false });
    fireEvent.change(screen.getByLabelText(/Computed change/), { target: { value: "prev" } });
    // Sales 120 vs 100 = +20.0%, 150 vs 120 = +25.0%
    expect(await screen.findByText("▲20.0%")).toBeInTheDocument();
    expect(screen.getByText("▲25.0%")).toBeInTheDocument();
    // Net Profit: base 0 / missing previous -> no percentage, no Infinity/NaN
    expect(screen.getByText(/computed in your browser/i)).toBeInTheDocument();
    noBadText();
    fireEvent.change(screen.getByLabelText(/Computed change/), { target: { value: "yoy" } });
    // Sales 2026-06-30 vs 2025-06-30 = +50.0%
    expect(await screen.findByText("▲50.0%")).toBeInTheDocument();
    noBadText();
  });

  it("shows 'not covered' for 404 not_covered", async () => {
    mockFetch(...defaultCompanyRoutes.slice(0, 5), route("GET", "/api/v1/companies/c-1/financials", () => jsonResponse(404, { detail: { code: "not_covered", message: "n/a" } })));
    await openFinancials();
    expect(await screen.findByText("Not covered by the current source")).toBeInTheDocument();
  });

  it("selecting a statement tab refetches with that statement", async () => {
    const { calls } = mockFetch(...defaultCompanyRoutes);
    await openFinancials();
    await screen.findByText(/Stale data/);
    fireEvent.click(screen.getByRole("tab", { name: "Balance Sheet" }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith("/financials") && c.url.searchParams.get("statement") === "balance_sheet")).toBe(true));
    expect(FINANCIALS.rows.length).toBe(2);
  });
});

describe("Research / Ask tabs (backend not built yet)", () => {
  it("shows an honest 'unavailable' state when /research/latest is a plain 404", async () => {
    mockFetch(...defaultCompanyRoutes, route("GET", "/api/v1/research/latest", () => jsonResponse(404, { detail: "Not Found" })));
    renderCompany();
    await screen.findByText("Acme Chemicals Ltd");
    const tab = screen.getByRole("tab", { name: "AI Research" });
    fireEvent.mouseDown(tab); fireEvent.click(tab);
    expect(await screen.findByText("AI research unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate research/i })).toBeDisabled();
  });

  it("renders a real report honestly: insufficient evidence, partial status, disclaimer", async () => {
    const report = {
      id: "r1", company_id: "c-1", company_name: "Acme", status: "partial", generated_at: "2026-10-12T10:00:00Z", disclaimer: "Not investment advice; AI-generated.",
      overall: { score: null, confidence: null, confidence_basis: [] },
      dimensions: [{ key: "fundamental", title: "Fundamentals", status: "unavailable", position: null, score: null, confidence: null, summary: "", evidence: [], limitations: ["No filings found"] }],
      sources: [], refinement: { rounds: 0, changes: [], skipped_reason: "insufficient data" }, limitations: [],
    };
    mockFetch(...defaultCompanyRoutes, route("GET", "/api/v1/research/latest", () => jsonResponse(200, report)));
    renderCompany();
    await screen.findByText("Acme Chemicals Ltd");
    const tab = screen.getByRole("tab", { name: "AI Research" });
    fireEvent.mouseDown(tab); fireEvent.click(tab);
    expect(await screen.findByText("Insufficient evidence")).toBeInTheDocument();
    expect(screen.getByText("Not investment advice; AI-generated.")).toBeInTheDocument();
    expect(screen.getByText(/Partial result/)).toBeInTheDocument();
    expect(screen.getByText(/No filings found/)).toBeInTheDocument();
    noBadText();
  });
});

describe("Dashboard movers", () => {
  const movers = (segment: string) => ({
    segment, as_of_date: "2026-10-12",
    gainers: [{ company_id: "g1", symbol: "GAIN", name: "Gainer Ltd", price: 110, previous_close: 100, change_percent: 10 }],
    losers: [], evaluated: 40, excluded: 7, universe_size: 47, source: "Yahoo Finance", delayed: true, note: null, cached: false, stale: true,
    fetched_at: "2026-10-12T10:00:00Z",
  });

  it("shows excluded count, stale banner, empty-losers state, and switching segment refetches", async () => {
    const { calls } = mockFetch(meRoute, route("GET", "/api/v1/market/movers", (url) => jsonResponse(200, movers(url.searchParams.get("segment")!))));
    renderWithProviders(<Index />, { path: "/", routePath: "/" });
    expect(await screen.findByText("Gainer Ltd")).toBeInTheDocument();
    expect(screen.getByText(/excluded 7 symbols with stale\/insufficient data/)).toBeInTheDocument();
    expect(screen.getByText(/movers are stale/i)).toBeInTheDocument();
    expect(screen.getByText("No losers")).toBeInTheDocument();
    expect(screen.getByText("+10.00%")).toBeInTheDocument();
    expect(screen.getByText(/Delayed – Test Prices/)).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname.endsWith("/movers"))!.url.searchParams.get("segment")).toBe("mid");
    fireEvent.click(screen.getByRole("button", { name: "Small Cap" }));
    await waitFor(() => expect(calls.some((c) => c.url.searchParams.get("segment") === "small")).toBe(true));
    noBadText();
  });

  it("shows an error state when movers fail", async () => {
    mockFetch(meRoute, route("GET", "/api/v1/market/movers", () => jsonResponse(503, { detail: { code: "x", message: "Movers unavailable right now" } })));
    renderWithProviders(<Index />, { path: "/", routePath: "/" });
    expect(await screen.findByText("Movers unavailable right now")).toBeInTheDocument();
    expect(COMPANY.id).toBe("c-1");
  });
});
