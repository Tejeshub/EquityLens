import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import WatchlistsPage from "@/pages/WatchlistsPage";
import WatchlistAnalysis from "@/pages/WatchlistAnalysis";
import { COMPANY, jsonResponse, meRoute, mockFetch, renderWithProviders, route } from "./helpers";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "el_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; });

const wl = (items: { company_id: string; name: string; symbol: string }[] = []) => ({
  id: "w1", name: "My list", created_at: "2026-10-01T00:00:00Z", max_items: 3,
  items: items.map((i) => ({ ...i, added_at: "2026-10-02T00:00:00Z" })),
});
const searchRoute = route("GET", "/api/v1/companies/search", () => jsonResponse(200, { items: [COMPANY], total: 1, limit: 10, offset: 0, source: "db" }));

/** Stateful list so refetch after a mutation reflects it. */
function listState(initial: ReturnType<typeof wl>[]) {
  const state = { lists: initial };
  return { state, get: route("GET", "/api/v1/watchlists", () => jsonResponse(200, state.lists)) };
}

describe("WatchlistsPage", () => {
  it("shows an empty state and creates a watchlist with only a name, sending CSRF", async () => {
    document.cookie = "el_csrf=csrf-abc; path=/";
    const { state, get } = listState([]);
    const { calls } = mockFetch(meRoute, get, route("POST", "/api/v1/watchlists", () => { state.lists = [wl()]; return jsonResponse(201, wl()); }));
    renderWithProviders(<WatchlistsPage />, { routePath: "*" });
    expect(await screen.findByText("No watchlists yet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new watchlist/i }));
    expect(screen.queryByText("Sector")).not.toBeInTheDocument();
    expect(screen.queryByText("Cap")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "My list" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("My list")).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === "POST" && c.url.pathname === "/api/v1/watchlists")!;
    expect(JSON.parse(String(post.init.body))).toEqual({ name: "My list" });
    expect((post.init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("csrf-abc");
  });

  it("adds a company found through real search", async () => {
    const { state, get } = listState([wl()]);
    const { calls } = mockFetch(meRoute, get, searchRoute, route("POST", "/api/v1/watchlists/w1/items", (_u, init) => {
      expect(JSON.parse(String(init.body))).toEqual({ company_id: "c-1" });
      state.lists = [wl([{ company_id: "c-1", name: COMPANY.name, symbol: "ACME" }])];
      return jsonResponse(201, state.lists[0]);
    }));
    renderWithProviders(<WatchlistsPage />);
    await screen.findByText("This watchlist is empty");
    fireEvent.change(screen.getByLabelText("Search companies to add"), { target: { value: "acme" } });
    fireEvent.click(await screen.findByRole("button", { name: `Add ${COMPANY.name}` }));
    expect(await screen.findByRole("button", { name: `Remove ${COMPANY.name}` })).toBeInTheDocument();
    expect(calls.filter((c) => c.url.pathname.endsWith("/search")).length).toBe(1);
  });

  it("shows a clear error on duplicate add (409) and on the cap (422)", async () => {
    const { get } = listState([wl()]);
    let n = 0;
    mockFetch(meRoute, get, searchRoute, route("POST", "/api/v1/watchlists/w1/items", () =>
      n++ === 0 ? jsonResponse(409, { detail: "Company already in watchlist" }) : jsonResponse(422, { detail: { code: "watchlist_full", message: "Watchlist is full (max 3)" } })));
    renderWithProviders(<WatchlistsPage />);
    await screen.findByText("This watchlist is empty");
    fireEvent.change(screen.getByLabelText("Search companies to add"), { target: { value: "acme" } });
    fireEvent.click(await screen.findByRole("button", { name: `Add ${COMPANY.name}` }));
    expect(await screen.findByText("That company is already in this watchlist.")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: `Add ${COMPANY.name}` }));
    expect(await screen.findByText("Watchlist is full (max 3)")).toBeInTheDocument();
  });

  it("removes a company (DELETE) and renames a watchlist (PATCH)", async () => {
    const item = { company_id: "c-1", name: COMPANY.name, symbol: "ACME" };
    const { state, get } = listState([wl([item])]);
    const { calls } = mockFetch(
      meRoute, get,
      route("DELETE", "/api/v1/watchlists/w1/items/c-1", () => { state.lists = [wl()]; return jsonResponse(204); }),
      route("PATCH", "/api/v1/watchlists/w1", (_u, init) => { state.lists = [{ ...wl(), name: JSON.parse(String(init.body)).name }]; return jsonResponse(200, state.lists[0]); }),
    );
    renderWithProviders(<WatchlistsPage />);
    fireEvent.click(await screen.findByRole("button", { name: `Remove ${COMPANY.name}` }));
    await screen.findByText("This watchlist is empty");
    expect(calls.some((c) => c.init.method === "DELETE" && c.url.pathname === "/api/v1/watchlists/w1/items/c-1")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Rename My list" }));
    fireEvent.change(screen.getByLabelText("Watchlist name"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByText("Renamed")).toBeInTheDocument();
  });

  it("loads prices only on request and shows unavailable rows honestly", async () => {
    const items = [{ company_id: "c-1", name: "Acme", symbol: "ACME" }, { company_id: "c-2", name: "Beta", symbol: "BETA" }];
    const { get } = listState([wl(items)]);
    const { calls } = mockFetch(meRoute, get, route("GET", "/api/v1/watchlists/w1/snapshot", () => jsonResponse(200, {
      source: "Yahoo Finance", delayed: true, note: null,
      rows: [
        { company_id: "c-1", name: "Acme", symbol: "ACME", status: "ok", reason: null, price: 100, change_percent: null, as_of: "2026-10-12T09:00:00Z", cached: false, stale: true },
        { company_id: "c-2", name: "Beta", symbol: "BETA", status: "unavailable", reason: "Quote provider timed out", price: null, change_percent: null, as_of: null, cached: false, stale: false },
      ],
    })));
    renderWithProviders(<WatchlistsPage />);
    await screen.findByText("Acme");
    expect(calls.some((c) => c.url.pathname.endsWith("/snapshot"))).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: "Show delayed prices" }));
    expect(await screen.findByText("Quote provider timed out")).toBeInTheDocument();
    const card = screen.getByTestId("watchlist-w1");
    expect(within(card).getAllByLabelText("Not available from the current source").length).toBeGreaterThan(0);
    expect(within(card).getAllByText("stale").length).toBeGreaterThan(0);
    expect(within(card).getByText(/Delayed – Test Prices/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it("accepts the real API shape for unavailable snapshot rows (cached/stale/price all null)", async () => {
    const items = [{ company_id: "c-1", name: "Acme", symbol: "ACME" }, { company_id: "c-2", name: "Beta", symbol: "BETA" }];
    const { get } = listState([wl(items)]);
    mockFetch(meRoute, get, route("GET", "/api/v1/watchlists/w1/snapshot", () => jsonResponse(200, {
      watchlist_id: "w1", source: "Yahoo Finance", delayed: true, note: null,
      rows: [
        { company_id: "c-1", name: "Acme", symbol: "ACME", status: "ok", reason: null, price: 100, change_percent: 1.5, as_of: "2026-10-12T09:00:00Z", cached: true, stale: false },
        { company_id: "c-2", name: "Beta", symbol: "BETA", status: "unavailable", reason: "quota", price: null, change_percent: null, as_of: null, cached: null, stale: null },
      ],
    })));
    renderWithProviders(<WatchlistsPage />);
    await screen.findByText("Acme");
    fireEvent.click(await screen.findByRole("button", { name: "Show delayed prices" }));
    expect(await screen.findByText("Provider rate limit reached")).toBeInTheDocument();
    expect(screen.queryByText("Prices unavailable")).not.toBeInTheDocument();
  });

  it("explains a duplicate watchlist NAME (409 on create) as a name conflict, not as a duplicate company", async () => {
    const { get } = listState([wl()]);
    mockFetch(meRoute, get, route("POST", "/api/v1/watchlists", () => jsonResponse(409, { detail: "You already have a watchlist with that name" })));
    renderWithProviders(<WatchlistsPage />);
    await screen.findByText("This watchlist is empty");
    fireEvent.click(screen.getByRole("button", { name: /new watchlist/i }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "My list" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("You already have a watchlist with that name.")).toBeInTheDocument();
    expect(screen.queryByText("That company is already in this watchlist.")).not.toBeInTheDocument();
  });

  it("shows an error state when the list fails to load", async () => {
    mockFetch(meRoute, route("GET", "/api/v1/watchlists", () => jsonResponse(500, { detail: "boom", request_id: "req-1" })));
    renderWithProviders(<WatchlistsPage />);
    expect(await screen.findByText("Could not load watchlists")).toBeInTheDocument();
    expect(screen.getByText(/req-1/)).toBeInTheDocument();
  });
});

describe("WatchlistAnalysis", () => {
  const two = [{ company_id: "c-1", name: "Acme", symbol: "ACME" }, { company_id: "c-2", name: "Beta", symbol: "BETA" }];

  it("shows 'Watchlist not found' for an unknown id", async () => {
    mockFetch(meRoute, route("GET", "/api/v1/watchlists", () => jsonResponse(200, [wl(two)])));
    renderWithProviders(<WatchlistAnalysis />, { path: "/watchlist/zzz/analysis", routePath: "/watchlist/:id/analysis" });
    expect(await screen.findByRole("heading", { name: "Watchlist not found" })).toBeInTheDocument();
  });

  it("does nothing until the button is pressed, then renders real compare data with 'Not available' cells", async () => {
    const { calls } = mockFetch(meRoute, route("GET", "/api/v1/watchlists", () => jsonResponse(200, [wl(two)])),
      route("POST", "/api/v1/watchlists/w1/compare", () => jsonResponse(200, {
        companies: [{ company_id: "c-1", name: "Acme", symbol: "ACME", period: "2026-03-31", basis: "consolidated", status: "ok", reason: null }, { company_id: "c-2", name: "Beta", symbol: "BETA", period: "2026-03-31", basis: null, status: "ok", reason: null }],
        statement: "ratios", period: "2026-03-31",
        rows: [{ metric: "ROCE", unit: "%", values: { "c-1": 18.5, "c-2": null } }],
        source: "Screener.in", basis_note: "Consolidated where available", retrieved_at: "2026-10-12T00:00:00Z",
      })));
    renderWithProviders(<WatchlistAnalysis />, { path: "/watchlist/w1/analysis", routePath: "/watchlist/:id/analysis" });
    await screen.findByText("My list");
    expect(calls.some((c) => c.url.pathname.endsWith("/compare"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
    expect(await screen.findByText("18.5")).toBeInTheDocument();
    expect(screen.getByLabelText("Not available from the current source")).toBeInTheDocument();
    expect(screen.getByText("Consolidated where available")).toBeInTheDocument();
    await waitFor(() => expect(document.body.textContent).not.toMatch(/NaN|undefined/));
  });

  it("shows unavailable (not an error crash) when compare endpoint does not exist yet", async () => {
    mockFetch(meRoute, route("GET", "/api/v1/watchlists", () => jsonResponse(200, [wl(two)])),
      route("POST", "/api/v1/watchlists/w1/compare", () => jsonResponse(404, { detail: "Not Found" })));
    renderWithProviders(<WatchlistAnalysis />, { path: "/watchlist/w1/analysis", routePath: "/watchlist/:id/analysis" });
    await screen.findByText("My list");
    fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
    expect(await screen.findByText(/not available on this backend yet/)).toBeInTheDocument();
  });
});
