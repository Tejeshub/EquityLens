import { test, expect, axeCheck, companyId, csrfHeaders, signedIn, SYMS, shot, noHorizontalOverflow } from "./support/fixtures";
import type { NetLog } from "./support/fixtures";

/**
 * Public profile with ONLY the news provider enabled (ENABLE_NEWS=true, excerpts off): headlines + links, sentiment-only
 * research, Copilot grounded over the headlines. Prices / financials / movers / segments stay off.
 */
const RESTRICTED = /\/(quote|history|financials|snapshot|compare)$|\/market\/movers/;
const PRICES_REASON = /Market prices are not available in this deployment/;
const FIN_REASON = /Reported financials and shareholding are not available in this deployment/;
const EXCERPT_TEXT = /Synthetic placeholder body|Invented text used only|Another invented excerpt|Placeholder text/;

function expectNoRestrictedRequests(net: NetLog) {
  const bad = net.entries.filter((e) => RESTRICTED.test(e.path));
  expect(bad.map((e) => `${e.method} ${e.path}${e.search}`), "market / fundamentals sources are off in this stack").toEqual([]);
}

test.describe("public profile, news only", () => {
  test("capabilities: news on without excerpts, AI on, everything else off", async ({ page }) => {
    const caps = await (await page.request.get("/api/v1/capabilities")).json();
    expect(caps.profile).toBe("public");
    expect(caps.news.enabled).toBe(true);
    expect(caps.news.reason).toBeNull();
    expect(caps.news.excerpts_displayed).toBe(false);
    expect(caps.ai.research).toBe(true);
    expect(caps.market_data.enabled).toBe(false);
    expect(caps.fundamentals.enabled).toBe(false);
    expect(caps.index_segments.enabled).toBe(false);
  });

  test("dashboard offers news, AI research and Copilot but no market data", async ({ page, net }, testInfo) => {
    await signedIn(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Source-linked equity research");
    const avail = page.getByRole("region", { name: "What is available" });
    for (const t of ["Company search", "News", "AI research", "Copilot", "Watchlists"]) await expect(avail.getByText(t, { exact: true })).toBeVisible();
    await expect(page.getByTestId("no-sources")).toHaveCount(0);
    await expect(page.getByText("Market movers are not shown.")).toBeVisible();
    await expect(page.locator("main").getByText(/delayed price data|reported financials/i)).toHaveCount(0);
    const attr = page.getByTestId("source-attribution");
    await expect(attr).toContainText("News: Exa web search");
    await expect(attr).not.toContainText("No third-party data sources");
    await shot(page, "dashboard", testInfo);
    await axeCheck(page, "public-news dashboard");
    expectNoRestrictedRequests(net);
  });

  test("news: headlines with safe links and publisher, and NO article excerpt", async ({ page, net }, testInfo) => {
    await signedIn(page);
    await page.goto(`/company/${await companyId(page.request, SYMS.ok)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Synthetic Alpha Limited");
    const link = page.getByRole("link", { name: "Synthetic headline 1" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("href", /^https?:\/\//);
    await expect(page.getByText("news.example.com").first()).toBeVisible();
    await expect(page.getByText(EXCERPT_TEXT)).toHaveCount(0);
    await expect(page.getByText(PRICES_REASON).first()).toBeVisible(); // prices still off
    expect(net.count("GET", /\/news\?/)).toBe(1);

    // the API itself carries no excerpt either
    const body = await (await page.request.get(`/api/v1/companies/${await companyId(page.request, SYMS.ok)}/news`)).json();
    expect(body.items.length).toBeGreaterThan(0);
    for (const it of body.items) expect(it.excerpt ?? null).toBeNull();
    await shot(page, "company", testInfo);
    await axeCheck(page, "public-news company");
    await noHorizontalOverflow(page);
    expectNoRestrictedRequests(net);
  });

  test("research completes with sentiment only: fundamental and alternative unavailable with reasons; overall equals sentiment", async ({ page, net }, testInfo) => {
    await signedIn(page);
    await page.goto(`/company/${await companyId(page.request, SYMS.ok)}`);
    await page.getByRole("tab", { name: "AI Research" }).click();
    await expect(page.getByText("No saved research for this company")).toBeVisible();
    expect(net.count("POST", /\/research/)).toBe(0);
    await page.getByRole("button", { name: "Generate research" }).click();
    await expect(page.getByText("Overall score")).toBeVisible({ timeout: 45_000 });

    const card = (title: string) => page.locator("div.rounded-lg", { has: page.locator("p.font-medium", { hasText: new RegExp(`^${title}$`) }) }).last();
    const fundamentals = card("Fundamentals");
    const alt = card("Alternative / ownership signals");
    const sentiment = card("News sentiment");
    await expect(fundamentals).toContainText("Unavailable");
    await expect(fundamentals).toContainText("N/A");
    await expect(fundamentals).toContainText(FIN_REASON);
    await expect(alt).toContainText("Unavailable");
    await expect(alt).toContainText("Shareholding data is not available in this deployment");
    await expect(sentiment).toContainText("Analysed");
    const sentimentScore = Number((await sentiment.locator("p.text-lg").textContent())!.split("/")[0]);
    const overall = Number((await page.getByText("Overall score").locator("xpath=following-sibling::p[1]").textContent())!.split("/")[0]);
    expect(overall).toBe(sentimentScore);
    await expect(page.getByText(/1 of 3 dimensions had evidence/)).toBeVisible();
    await expect(page.getByText("Partial result: some analysis dimensions could not be completed.")).toBeVisible();
    // no excerpt text leaks into the evidence either
    await expect(page.getByTestId("panel-research").getByText(EXCERPT_TEXT)).toHaveCount(0);
    await shot(page, "research", testInfo);
    await axeCheck(page, "public-news research result");
    expectNoRestrictedRequests(net);
  });

  test("Copilot answers grounded over the headlines; citations link out and show no excerpt text", async ({ page, net }, testInfo) => {
    await signedIn(page);
    await page.goto(`/company/${await companyId(page.request, SYMS.ok)}`);
    await page.getByRole("tab", { name: "Ask" }).click();
    await page.getByLabel("Your question").fill("synthetic headline commentary");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Synthetic answer based on the stored sources [1].")).toBeVisible();
    await expect(page.getByText("Not document-grounded.")).toHaveCount(0);
    const cite = page.getByTestId("panel-ask").getByRole("listitem").filter({ hasText: /Synthetic headline \d/ }).first();
    await expect(cite).toBeVisible();
    await expect(cite.getByRole("link")).toHaveAttribute("href", /^https?:\/\//);
    await expect(cite).not.toContainText(/placeholder|invented/i);
    await expect(page.getByText(EXCERPT_TEXT)).toHaveCount(0);
    await shot(page, "copilot-answer", testInfo);
    await axeCheck(page, "public-news copilot answer");
    expectNoRestrictedRequests(net);
  });

  test("the backend still refuses market and fundamentals sources here, and only these", async ({ page }) => {
    await signedIn(page);
    const id = await companyId(page.request, SYMS.ok);
    for (const path of [`/api/v1/companies/${id}/quote`, `/api/v1/companies/${id}/history?range=1mo`, `/api/v1/companies/${id}/financials`, "/api/v1/market/movers?segment=mid"]) {
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(503);
      expect(((await res.json()) as { detail: { code: string } }).detail.code, path).toBe("source_disabled");
    }
    const h = await csrfHeaders(page.context());
    const ok = await page.request.get(`/api/v1/companies/${id}/news`);
    expect(ok.status()).toBe(200);
    const job = await page.request.post(`/api/v1/research/${id}`, { headers: h });
    expect(job.status()).toBe(202);
  });
});
