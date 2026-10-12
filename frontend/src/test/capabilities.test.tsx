import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import CompanyDetail from "@/pages/CompanyDetail";
import Index from "@/pages/Index";
import WatchlistsPage from "@/pages/WatchlistsPage";
import WatchlistAnalysis from "@/pages/WatchlistAnalysis";
import SearchBar from "@/components/SearchBar";
import Footer from "@/components/Footer";
import NewsFeed from "@/components/NewsFeed";
import { ErrorBox } from "@/components/DataStates";
import { ApiError } from "@/services/api";
import { CAPS_ALL, CAPS_NEWS_ONLY, CAPS_PUBLIC, COMPANY, NEWS, capsRoute, jsonResponse, meRoute, mockFetch, renderWithProviders, route } from "./helpers";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const pathsOf = (calls: { url: URL }[]) => calls.map((c) => c.url.pathname);
const companyRoutes = [
  meRoute, capsRoute(CAPS_NEWS_ONLY),
  route("GET", "/api/v1/companies/c-1", () => jsonResponse(200, { ...COMPANY, sector: null })),
  route("GET", "/api/v1/companies/c-1/news", () => jsonResponse(200, { ...NEWS, items: [{ ...NEWS.items[0], excerpt: null }] })),
];
const list = (items: object[]) => route("GET", "/api/v1/watchlists", () => jsonResponse(200, [{ id: "w1", name: "My list", created_at: "t", max_items: 5, items }]));
const two = [{ company_id: "c-1", name: "Acme", symbol: "ACME" }, { company_id: "c-2", name: "Beta", symbol: "BETA" }];

describe("capabilities disabled (public profile)", () => {
  it("company page (news only): banners replace price, chart and financials; no disabled-source request is made", async () => {
    const { calls } = mockFetch(...companyRoutes);
    renderWithProviders(<CompanyDetail />, { path: "/company/c-1", routePath: "/company/:id" });
    expect(await screen.findByText("Acme Chemicals Ltd")).toBeInTheDocument();
    expect((await screen.findAllByText(/Prices are not shown here \(test reason\)/)).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByTestId("source-disabled").length).toBeGreaterThanOrEqual(2); // header + chart
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Price unavailable/)).not.toBeInTheDocument();
    const tab = screen.getByRole("tab", { name: "Financials" });
    fireEvent.mouseDown(tab); fireEvent.click(tab);
    expect(await screen.findByText(/Financials are not shown here \(test reason\)/)).toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "Statement" })).not.toBeInTheDocument();
    expect(await screen.findByText("Acme posts results")).toBeInTheDocument();
    const p = pathsOf(calls);
    expect(p.some((x) => /\/(quote|history|financials)$/.test(x))).toBe(false);
    expect(p.filter((x) => x === "/api/v1/capabilities")).toHaveLength(1);
  });

  it("news renders without an empty excerpt box when excerpts are not displayed", async () => {
    mockFetch(meRoute, route("GET", "/api/v1/companies/c-1/news", () => jsonResponse(200, { ...NEWS, items: [{ ...NEWS.items[0], excerpt: null }] })));
    renderWithProviders(<NewsFeed companyId="c-1" />);
    expect(await screen.findByText("Acme posts results")).toBeInTheDocument();
    expect(document.querySelector("li p.line-clamp-2")).toBeNull();
  });

  it("dashboard (everything off): says plainly that no data source is enabled and lists only what exists", async () => {
    const { calls } = mockFetch(meRoute, capsRoute(CAPS_PUBLIC));
    renderWithProviders(<Index />, { path: "/", routePath: "/" });
    expect(await screen.findByText(/Prices are not shown here/)).toBeInTheDocument();
    expect(screen.getByTestId("no-sources")).toHaveTextContent(/no data source is enabled/);
    expect(screen.getByTestId("no-sources")).toHaveTextContent(/company search.*watchlists \(company names only\).*account/);
    const region = within(screen.getByRole("region", { name: "What is available" }));
    for (const t of ["Company search", "Watchlists"]) expect(region.getByText(t)).toBeInTheDocument();
    for (const t of ["News", "AI research", "Copilot"]) expect(region.queryByText(t)).not.toBeInTheDocument();
    expect(screen.queryByText("Top Gainers")).not.toBeInTheDocument();
    expect(pathsOf(calls)).not.toContain("/api/v1/market/movers");
    expect(screen.queryByText(/delayed price data|Every figure shows its source/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).parentElement).toHaveTextContent(/no data source is enabled/);
  });

  it("dashboard (news only): offers news, AI research and Copilot", async () => {
    mockFetch(meRoute, capsRoute(CAPS_NEWS_ONLY));
    renderWithProviders(<Index />, { path: "/", routePath: "/" });
    const region = within(await screen.findByRole("region", { name: "What is available" }));
    for (const t of ["Company search", "News", "AI research", "Copilot", "Watchlists"]) expect(region.getByText(t)).toBeInTheDocument();
    expect(screen.queryByTestId("no-sources")).not.toBeInTheDocument();
  });

  it("watchlists: no 'Show delayed prices', no snapshot request, Compare disabled with the reason", async () => {
    const { calls } = mockFetch(meRoute, capsRoute(CAPS_PUBLIC), list(two));
    renderWithProviders(<WatchlistsPage />);
    await screen.findByText("Acme");
    await waitFor(() => expect(pathsOf(calls)).toContain("/api/v1/capabilities"));
    expect(screen.queryByRole("button", { name: /delayed prices/i })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Compare/ })).toBeDisabled());
    expect(pathsOf(calls).some((p) => p.endsWith("/snapshot"))).toBe(false);
  });

  it("watchlist analysis: notice instead of controls, no compare request", async () => {
    const { calls } = mockFetch(meRoute, capsRoute(CAPS_PUBLIC), list(two));
    renderWithProviders(<WatchlistAnalysis />, { path: "/watchlist/w1/analysis", routePath: "/watchlist/:id/analysis" });
    expect(await screen.findByText(/Financials are not shown here/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run comparison/i })).not.toBeInTheDocument();
    expect(pathsOf(calls).some((p) => p.endsWith("/compare"))).toBe(false);
  });

  it("search: filters are hidden and sector/segment are never sent", async () => {
    const { calls } = mockFetch(capsRoute(CAPS_PUBLIC), route("GET", "/api/v1/companies/search", () => jsonResponse(200, { items: [{ ...COMPANY, sector: null }], total: 1, limit: 10, offset: 0, source: "db" })));
    renderWithProviders(<SearchBar />, { withAuth: false });
    await waitFor(() => expect(pathsOf(calls)).toContain("/api/v1/capabilities"));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByLabelText("Toggle filters")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search companies"), { target: { value: "acme" } });
    expect(await screen.findByText("Acme Chemicals Ltd")).toBeInTheDocument();
    const s = calls.find((c) => c.url.pathname.endsWith("/search"))!.url.searchParams;
    expect(s.has("sector")).toBe(false);
    expect(s.has("segment")).toBe(false);
  });

  it("footer: persistent disclaimer and attribution come from capabilities", async () => {
    mockFetch(capsRoute(CAPS_NEWS_ONLY));
    renderWithProviders(<Footer />, { withAuth: false });
    expect(screen.getByText(/Informational only — not investment advice\. AI-generated content can be wrong\./)).toBeInTheDocument();
    const attr = await screen.findByTestId("source-attribution");
    expect(attr).toHaveTextContent("News: Test News");
    expect(attr).toHaveTextContent("AI answers: Groq");
    expect(attr).not.toHaveTextContent("Test Prices");
    expect(attr).toHaveTextContent(/Not shown in this deployment: market prices, reported financials/);
  });

  it("footer with everything off claims no provider", async () => {
    mockFetch(capsRoute(CAPS_PUBLIC));
    renderWithProviders(<Footer />, { withAuth: false });
    const attr = await screen.findByTestId("source-attribution");
    expect(attr).toHaveTextContent("No third-party data sources are enabled.");
    expect(attr).not.toHaveTextContent(/Test News|Groq/);
    expect(attr).toHaveTextContent(/Not shown in this deployment:.*news/);
  });

  it("footer lists enabled providers when everything is on", async () => {
    mockFetch(capsRoute(CAPS_ALL));
    renderWithProviders(<Footer />, { withAuth: false });
    expect(await screen.findByTestId("source-attribution")).toHaveTextContent("Prices: Test Prices");
  });

  it("a 503 source_disabled ApiError renders as an info banner with no retry button", () => {
    const err = new ApiError({ status: 503, code: "source_disabled", message: "Market prices are not available in this deployment." });
    renderWithProviders(<ErrorBox error={err} onRetry={() => {}} />, { withAuth: false });
    expect(screen.getByTestId("source-disabled")).toHaveTextContent("Market prices are not available in this deployment.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  const NEWS_REASON = /News is not shown here \(test reason\)/;
  const AI_REASON = /No data source is enabled \(test reason\)/;
  const openTab = (name: string) => { const t = screen.getByRole("tab", { name }); fireEvent.mouseDown(t); fireEvent.click(t); };
  const aiPaths = (calls: { url: URL }[]) => pathsOf(calls).filter((p) => /\/(research|ask|news)(\/|$)/.test(p));

  it("everything off: news feed, research and Copilot show the backend reason, with no submit controls and no requests", async () => {
    const { calls } = mockFetch(meRoute, capsRoute(CAPS_PUBLIC),
      route("GET", "/api/v1/companies/c-1", () => jsonResponse(200, { ...COMPANY, sector: null })));
    renderWithProviders(<CompanyDetail />, { path: "/company/c-1", routePath: "/company/:id" });
    expect(await screen.findByText("Acme Chemicals Ltd")).toBeInTheDocument();
    expect(await screen.findByText(NEWS_REASON)).toBeInTheDocument();
    expect(screen.queryByText("Loading news…")).not.toBeInTheDocument();
    openTab("AI Research");
    expect(await screen.findByText(AI_REASON)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate research/i })).not.toBeInTheDocument();
    openTab("Ask");
    expect(await screen.findAllByText(AI_REASON)).toHaveLength(2);
    expect(screen.queryByLabelText("Your question")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^ask$/i })).not.toBeInTheDocument();
    expect(aiPaths(calls)).toEqual([]);
  });

  it("news only: headlines load and research starts (sentiment-only evidence); Copilot answers", async () => {
    const { calls } = mockFetch(...companyRoutes,
      route("GET", "/api/v1/research/latest", () => jsonResponse(404, { detail: { code: "no_research", message: "none" } })),
      route("GET", "/api/v1/research/active", () => jsonResponse(404, { detail: { code: "no_active_job", message: "none" } })),
      route("POST", "/api/v1/ask", () => jsonResponse(200, { answer: "Headline-based answer.", grounded: true, citations: [], retrieval_count: 1, notice: null })));
    renderWithProviders(<CompanyDetail />, { path: "/company/c-1", routePath: "/company/:id" });
    expect(await screen.findByText("Acme posts results")).toBeInTheDocument();
    openTab("AI Research");
    expect(await screen.findByRole("button", { name: /generate research/i })).toBeEnabled();
    expect(screen.queryByText(AI_REASON)).not.toBeInTheDocument();
    await waitFor(() => expect(pathsOf(calls)).toContain("/api/v1/research/latest"));
    openTab("Ask");
    fireEvent.change(await screen.findByLabelText("Your question"), { target: { value: "headlines?" } });
    fireEvent.click(screen.getByRole("button", { name: /^ask$/i }));
    expect(await screen.findByText("Headline-based answer.")).toBeInTheDocument();
    expect(screen.queryByText(NEWS_REASON)).not.toBeInTheDocument();
  });

  it("research off but news on is not a combination the UI invents: each panel follows its own flag", async () => {
    const caps = { ...CAPS_NEWS_ONLY, ai: { ...CAPS_NEWS_ONLY.ai, research: false, reason: "AI off (test reason)." } };
    const { calls } = mockFetch(capsRoute(caps), ...companyRoutes);
    renderWithProviders(<CompanyDetail />, { path: "/company/c-1", routePath: "/company/:id" });
    expect(await screen.findByText("Acme posts results")).toBeInTheDocument();
    openTab("AI Research");
    expect(await screen.findByText(/AI off \(test reason\)/)).toBeInTheDocument();
    openTab("Ask");
    expect(await screen.findAllByText(/AI off \(test reason\)/)).toHaveLength(2);
    expect(pathsOf(calls).filter((p) => /\/(research|ask)(\/|$)/.test(p))).toEqual([]);
  });

  it("a 503 source_disabled from news, research start and ask still renders as an info banner (defensive)", async () => {
    const disabled = (m: string) => jsonResponse(503, { detail: { code: "source_disabled", message: m } });
    mockFetch(capsRoute(CAPS_ALL),
      route("GET", "/api/v1/companies/c-1/news", () => disabled("News refused by backend.")),
      route("GET", "/api/v1/research/latest", () => disabled("Research refused by backend.")),
      route("GET", "/api/v1/research/active", () => jsonResponse(404, { detail: { code: "no_active_job", message: "none" } })),
      route("POST", "/api/v1/ask", () => disabled("Ask refused by backend.")), ...companyRoutes);
    renderWithProviders(<CompanyDetail />, { path: "/company/c-1", routePath: "/company/:id" });
    expect(await screen.findByText("News refused by backend.")).toBeInTheDocument();
    openTab("AI Research");
    expect(await screen.findByText("Research refused by backend.")).toBeInTheDocument();
    openTab("Ask");
    fireEvent.change(await screen.findByLabelText("Your question"), { target: { value: "q" } });
    fireEvent.click(screen.getByRole("button", { name: /^ask$/i }));
    expect(await screen.findByText("Ask refused by backend.")).toBeInTheDocument();
    expect(screen.getAllByTestId("source-disabled").length).toBeGreaterThanOrEqual(3);
  });
});
