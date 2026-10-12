import { test, expect, axeCheck, companyId, csrfHeaders, pgClient, signedIn, SYMS, shot, noHorizontalOverflow } from "./support/fixtures";
import type { NetLog } from "./support/fixtures";
import type { Page } from "@playwright/test";

// In the production default (public profile) EVERY evidence source is off: the UI must not even try any of these.
const RESTRICTED = /\/(quote|history|financials|snapshot|compare|news|ask)$|\/market\/movers|\/api\/v1\/research(\/|$)/;
const NEWS_REASON = /News is not available in this deployment/;
const AI_REASON = /No data source is enabled in this deployment/;
const PRICES_REASON = /Market prices are not available in this deployment/;
const FIN_REASON = /Reported financials and shareholding are not available in this deployment/;

function expectNoRestrictedRequests(net: NetLog) {
  const bad = net.entries.filter((e) => RESTRICTED.test(e.path));
  expect(bad.map((e) => `${e.method} ${e.path}${e.search}`), "the public profile must not even attempt restricted-source requests").toEqual([]);
}

test.describe("public data profile", () => {
  test("dashboard: explains what is disabled, offers no movers / segment filter, makes no restricted requests", async ({ page, net }, testInfo) => {
    await signedIn(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Source-linked equity research");
    await expect(page.getByText("Market movers are not shown.")).toBeVisible();
    await expect(page.getByText(PRICES_REASON).first()).toBeVisible();
    await expect(page.getByText("What you can do here")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top Gainers" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Large Cap" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Toggle filters" })).toHaveCount(0); // sector / segment filter hidden
    await expect(page.locator("main").getByText(/delayed price data|reported financials/i)).toHaveCount(0); // intro copy does not promise them
    await expect(page.getByTestId("source-attribution")).toContainText("Not shown in this deployment: market prices, reported financials");
    await expect(page.getByTestId("source-attribution")).not.toContainText("Yahoo");
    await expect(page.getByTestId("source-attribution")).toContainText("news");
    await expect(page.getByTestId("source-attribution")).toContainText("No third-party data sources are enabled.");
    // truthful copy: says plainly that nothing is enabled and lists only what exists
    await expect(page.getByTestId("no-sources")).toContainText("no data source is enabled");
    const avail = page.getByRole("region", { name: "What is available" });
    for (const t of ["Company search", "Watchlists"]) await expect(avail.getByText(t, { exact: true })).toBeVisible();
    for (const t of ["News", "AI research", "Copilot"]) await expect(avail.getByText(t, { exact: true })).toHaveCount(0);
    await expect(page.getByText("Every figure shows its source")).toHaveCount(0);

    // search still works and shows no sector labels
    await page.getByRole("combobox", { name: "Search companies" }).fill("SYNTHALPHA");
    const opt = page.getByRole("option", { name: /Synthetic Alpha Limited/ });
    await expect(opt).toBeVisible();
    await expect(opt).not.toContainText("Synthetic Industry");
    await shot(page, "dashboard", testInfo);
    await noHorizontalOverflow(page);
    expectNoRestrictedRequests(net);
    expect(net.count("GET", /\/api\/v1\/capabilities/)).toBeGreaterThan(0);
  });

  test("company page: banners instead of prices / chart / financials / news / research / Copilot; nothing is requested", async ({ page, net }, testInfo) => {
    await signedIn(page);
    await page.goto(`/company/${await companyId(page.request, SYMS.ok)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Synthetic Alpha Limited");
    await expect(page.getByText("Market prices are not shown.")).toBeVisible();
    await expect(page.getByText("Price charts are not shown.")).toBeVisible();
    await expect(page.getByText(PRICES_REASON).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "1M", exact: true })).toHaveCount(0);
    await expect(page.getByRole("img", { name: /candlestick/i })).toHaveCount(0);
    await expect(page.getByText("Synthetic Industry")).toHaveCount(0); // sector label is hidden too
    await expect(page.getByText("₹")).toHaveCount(0);

    // news: banner with the backend's reason instead of the feed
    const panel = page.getByTestId("panel-overview");
    await expect(panel.getByText(NEWS_REASON)).toBeVisible();
    await expect(page.getByRole("link", { name: /Synthetic headline/ })).toHaveCount(0);
    await shot(page, "company", testInfo);
    await axeCheck(page, "public company overview");

    await page.getByRole("tab", { name: "Financials" }).click();
    await expect(page.getByText("Reported financials are not shown.")).toBeVisible();
    await expect(page.getByText(FIN_REASON)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Quarterly Results" })).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);

    // Research / Copilot tabs stay visible but explain why they are unavailable; no controls
    await page.getByRole("tab", { name: "AI Research" }).click();
    const research = page.getByTestId("panel-research");
    await expect(research.getByText("AI research is not available.")).toBeVisible();
    await expect(research.getByText(AI_REASON)).toBeVisible();
    await expect(page.getByRole("button", { name: /Generate research|Regenerate research/ })).toHaveCount(0);
    await shot(page, "research", testInfo);
    await axeCheck(page, "public company research");
    await page.getByRole("tab", { name: "Ask" }).click();
    const ask = page.getByTestId("panel-ask");
    await expect(ask.getByText("Copilot is not available.")).toBeVisible();
    await expect(ask.getByText(AI_REASON)).toBeVisible();
    await expect(page.getByLabel("Your question")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ask", exact: true })).toHaveCount(0);
    await axeCheck(page, "public company ask");
    await noHorizontalOverflow(page);
    expectNoRestrictedRequests(net);
    expect(net.count("GET", /\/capabilities/)).toBeGreaterThan(0);
  });

  test("accessibility (axe): dashboard, watchlists and the compare notice", async ({ page }) => {
    await signedIn(page);
    await page.goto("/");
    await expect(page.getByTestId("no-sources")).toBeVisible();
    await axeCheck(page, "public dashboard");
    await page.goto("/watchlists");
    await expect(page.getByRole("heading", { name: "Watchlists" }).first()).toBeVisible();
    await axeCheck(page, "public watchlists");
  });

  test("watchlists: no price button, Compare disabled with the reason, no /snapshot or /compare request", async ({ page, net }) => {
    await signedIn(page);
    await page.goto("/watchlists");
    await page.getByRole("button", { name: "New Watchlist" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Public list");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const card = page.locator('[data-testid^="watchlist-"]').first();
    for (const [sym, name] of [["SYNTHALPHA", "Synthetic Alpha Limited"], ["SYNTHGAMMA", "Synthetic Gamma Limited"]]) {
      await card.getByLabel("Search companies to add").fill(sym);
      await card.getByRole("button", { name: `Add ${name}` }).click();
      await expect(card.getByRole("button", { name: `Remove ${name}` })).toBeVisible();
    }
    await expect(card.getByText("2/10 companies")).toBeVisible();
    await expect(card.getByRole("button", { name: /delayed prices/i })).toHaveCount(0);
    const compare = card.getByRole("button", { name: "Compare", exact: true });
    await expect(compare).toBeDisabled();
    await expect(compare).toHaveAttribute("title", FIN_REASON);

    // direct navigation to the compare page explains instead of calling the API
    const lists = await (await page.request.get("/api/v1/watchlists")).json();
    await page.goto(`/watchlist/${lists[0].id}/analysis`);
    await expect(page.getByText("Comparison is not available.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run comparison" })).toHaveCount(0);
    expectNoRestrictedRequests(net);
  });

  test("the backend itself refuses restricted sources (503 source_disabled), independent of what the UI does", async ({ page }) => {
    await signedIn(page);
    const id = await companyId(page.request, SYMS.ok);
    const h = await csrfHeaders(page.context());
    const list = await (await page.request.post("/api/v1/watchlists", { data: { name: "policy" }, headers: h })).json();
    const checks: [string, Awaited<ReturnType<typeof page.request.get>>][] = [
      ["quote", await page.request.get(`/api/v1/companies/${id}/quote`)],
      ["history", await page.request.get(`/api/v1/companies/${id}/history?range=1mo`)],
      ["financials", await page.request.get(`/api/v1/companies/${id}/financials`)],
      ["movers", await page.request.get("/api/v1/market/movers?segment=mid")],
      ["sector filter", await page.request.get("/api/v1/companies/search?q=synth&sector=Synthetic")],
      ["segment filter", await page.request.get("/api/v1/companies/search?q=synth&segment=mid")],
      ["compare", await page.request.post(`/api/v1/watchlists/${list.id}/compare`, { data: {}, headers: h })],
      ["news", await page.request.get(`/api/v1/companies/${id}/news`)],
      ["research start", await page.request.post(`/api/v1/research/${id}`, { headers: h })],
      ["ask", await page.request.post("/api/v1/ask", { data: { company_id: id, question: "anything" }, headers: h })],
    ];
    for (const [name, res] of checks) {
      expect(res.status(), name).toBe(503);
      expect(((await res.json()) as { detail: { code: string } }).detail.code, name).toBe("source_disabled");
    }
    // snapshot is allowed but makes no provider call: every row says why
    const company = await page.request.post(`/api/v1/watchlists/${list.id}/items`, { data: { company_id: id }, headers: h });
    expect(company.status()).toBe(201);
    const snap = await (await page.request.get(`/api/v1/watchlists/${list.id}/snapshot`)).json();
    expect(snap.rows.map((r: { status: string; reason: string }) => [r.status, r.reason])).toEqual([["unavailable", "source_disabled"]]);
    const caps = await (await page.request.get("/api/v1/capabilities")).json();
    expect(caps.profile).toBe("public");
    expect(caps.market_data.enabled).toBe(false);
    expect(caps.fundamentals.enabled).toBe(false);
    expect(caps.news.enabled).toBe(false);
    expect(caps.news.reason).toMatch(NEWS_REASON);
    expect(caps.news.excerpts_displayed).toBe(false);
    expect(caps.ai.research).toBe(false);
    expect(caps.ai.reason).toMatch(AI_REASON);
    // refusing created nothing: no job, no report (and the model was never called)
    const db = pgClient("e2e_public");
    await db.connect();
    try {
      for (const t of ["research_jobs", "research_reports"]) {
        const r = await db.query(`select count(*)::int as n from ${t}`);
        expect(r.rows[0].n, t).toBe(0);
      }
    } finally { await db.end(); }
  });
});

