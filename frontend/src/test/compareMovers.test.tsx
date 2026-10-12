import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import WatchlistAnalysis from "@/pages/WatchlistAnalysis";
import Index from "@/pages/Index";
import PriceChart, { tickDecimals } from "@/components/PriceChart";
import { HISTORY, jsonResponse, meRoute, mockFetch, renderWithProviders, route } from "./helpers";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const two = [{ company_id: "c-1", name: "Acme", symbol: "ACME", added_at: "t" }, { company_id: "c-2", name: "Beta", symbol: "BETA", added_at: "t" }];
const lists = route("GET", "/api/v1/watchlists", () => jsonResponse(200, [{ id: "w1", name: "My list", created_at: "t", max_items: 5, items: two }]));
const compareBody = (over: object = {}) => ({
  companies: [
    { company_id: "c-1", name: "Acme", symbol: "ACME", period: "2026-06-30", basis: "consolidated", status: "ok", reason: null },
    { company_id: "c-2", name: "Beta", symbol: "BETA", period: null, basis: null, status: "unavailable", reason: "not_covered" },
  ],
  statement: "profit_loss", period: null,
  rows: [{ metric: "Sales", unit: "Rs. Cr", values: { "c-1": 100, "c-2": null } }],
  source: "Src", basis_note: "Basis note text.", retrieved_at: "2026-10-12T00:00:00Z", notice: "Notice text here.", ...over,
});

describe("watchlist comparison", () => {
  it("statement selector is sent to the backend; badges, reason, basis note and notice render", async () => {
    const { calls } = mockFetch(meRoute, lists, route("POST", "/api/v1/watchlists/w1/compare", () => jsonResponse(200, compareBody())));
    renderWithProviders(<WatchlistAnalysis />, { path: "/watchlist/w1/analysis", routePath: "/watchlist/:id/analysis" });
    const sel = await screen.findByLabelText("Statement");
    expect(within(sel).getAllByRole("option").map((o) => (o as HTMLOptionElement).value)).toEqual(
      ["quarterly_results", "profit_loss", "ratios", "balance_sheet", "shareholding"]);
    fireEvent.change(sel, { target: { value: "profit_loss" } });
    fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
    expect(await screen.findByText("Basis note text.")).toBeInTheDocument();
    expect(JSON.parse(String(calls.find((c) => c.url.pathname.endsWith("/compare"))!.init.body))).toEqual({ statement: "profit_loss" });
    expect(screen.getByTestId("status-c-1")).toHaveTextContent("Data available");
    expect(screen.getByTestId("status-c-2")).toHaveTextContent("Unavailable");
    expect(screen.getAllByText("Not covered by the current source").length).toBeGreaterThan(0);
    expect(screen.getByText("Notice text here.")).toBeInTheDocument();
    expect(screen.getByText("period 2026-06-30")).toBeInTheDocument(); // overall period is null => per-company period shown
    expect(screen.getByLabelText("Not available from the current source")).toHaveTextContent("—");
  });

  it("warns and shows each period when periods differ", async () => {
    const body = compareBody({
      companies: [
        { company_id: "c-1", name: "Acme", symbol: "ACME", period: "2026-06-30", basis: null, status: "ok", reason: null },
        { company_id: "c-2", name: "Beta", symbol: "BETA", period: "2026-03-31", basis: null, status: "ok", reason: null },
      ], rows: [{ metric: "Sales", unit: null, values: { "c-1": 1, "c-2": 2 } }],
    });
    mockFetch(meRoute, lists, route("POST", "/api/v1/watchlists/w1/compare", () => jsonResponse(200, body)));
    renderWithProviders(<WatchlistAnalysis />, { path: "/watchlist/w1/analysis", routePath: "/watchlist/:id/analysis" });
    fireEvent.click(await screen.findByRole("button", { name: "Run comparison" }));
    expect(await screen.findByText("period 2026-06-30")).toBeInTheDocument();
    expect(screen.getByText("period 2026-03-31")).toBeInTheDocument();
    expect(screen.getByText(/different latest periods/)).toBeInTheDocument();
  });

  it("compare 503 source_disabled is a banner, not an error box", async () => {
    mockFetch(meRoute, lists, route("POST", "/api/v1/watchlists/w1/compare", () => jsonResponse(503, { detail: { code: "source_disabled", message: "Reported financials are not available." } })));
    renderWithProviders(<WatchlistAnalysis />, { path: "/watchlist/w1/analysis", routePath: "/watchlist/:id/analysis" });
    fireEvent.click(await screen.findByRole("button", { name: "Run comparison" }));
    expect(await screen.findByTestId("source-disabled")).toHaveTextContent("Reported financials are not available.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("movers", () => {
  const base = { segment: "mid", as_of_date: "2026-10-12", gainers: [{ company_id: "g1", symbol: "GAIN", name: "Gainer Ltd", price: 110, previous_close: 100, change_percent: 10 }],
    losers: [{ company_id: "l1", symbol: "LOSE", name: "Flat Ltd", price: 100, previous_close: 100, change_percent: 0 }],
    evaluated: 10, excluded: 0, universe_size: 20, source: "S", delayed: true, note: null, cached: false, stale: false, fetched_at: "2026-10-12T10:00:00Z",
    batches_failed: 0, partial: false, reason: null };

  it("partial ranking shows the batch banner; rows are links; zero change is neutral", async () => {
    mockFetch(meRoute, route("GET", "/api/v1/market/movers", () => jsonResponse(200, { ...base, partial: true, batches_failed: 2 })));
    renderWithProviders(<Index />, { path: "/", routePath: "/" });
    expect(await screen.findByText("Some price batches could not be fetched; showing a partial ranking (2 batch(es) failed).")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Gainer Ltd/ });
    expect(link).toHaveAttribute("href", "/company/g1");
    expect(screen.getByText("0.00%").className).toMatch(/text-muted-foreground/);
    expect(screen.getByText("+10.00%").className).toMatch(/text-chart-up/);
  });

  it("no partial banner when complete; reason with empty universe is an info banner", async () => {
    mockFetch(meRoute, route("GET", "/api/v1/market/movers", () => jsonResponse(200, base)));
    renderWithProviders(<Index />, { path: "/", routePath: "/" });
    await screen.findByText("Gainer Ltd");
    expect(screen.queryByText(/partial ranking/)).not.toBeInTheDocument();
    cleanup();
    mockFetch(meRoute, route("GET", "/api/v1/market/movers", () => jsonResponse(200, { ...base, gainers: [], losers: [], universe_size: 0, evaluated: 0, reason: "No index membership loaded for this segment." })));
    renderWithProviders(<Index />, { path: "/", routePath: "/" });
    expect(await screen.findByText("No index membership loaded for this segment.")).toBeInTheDocument();
    expect(screen.queryByText("Top Gainers")).not.toBeInTheDocument();
  });
});

describe("PriceChart accessibility", () => {
  it("tickDecimals adapts to the price span", () => {
    expect(tickDecimals(100, 400)).toBe(0);
    expect(tickDecimals(10, 15)).toBe(1);
    expect(tickDecimals(1.2, 1.9)).toBe(2);
    expect(tickDecimals(0.51, 0.52)).toBe(3);
  });

  it("has role=img with a descriptive label and an sr-only table of recent bars", async () => {
    mockFetch(route("GET", "/api/v1/companies/c-1/history", () => jsonResponse(200, HISTORY)));
    renderWithProviders(<PriceChart companyId="c-1" />, { withAuth: false });
    const img = await screen.findByRole("img", { name: /Latest close 1,234\.50 on 2026-10-12/ });
    expect(img).toHaveAccessibleName(/3M range, 2 trading days/);
    const table = screen.getByRole("table");
    expect(table.className).toMatch(/sr-only/);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("is not rendered (and requests nothing) when market data is disabled", async () => {
    const { CAPS_PUBLIC, capsRoute } = await import("./helpers");
    const { calls } = mockFetch(capsRoute(CAPS_PUBLIC));
    renderWithProviders(<PriceChart companyId="c-1" />, { withAuth: false });
    expect(await screen.findByTestId("source-disabled")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith("/history"))).toBe(false));
  });
});
