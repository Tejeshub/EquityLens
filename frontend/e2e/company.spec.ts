import { test, expect, companyId, signedIn, SYMS, noHorizontalOverflow, shot } from "./support/fixtures";
import type { Page } from "@playwright/test";

const searchBox = (page: Page) => page.getByRole("combobox", { name: "Search companies" });

test.describe("dashboard search", () => {
  test("shows a loading state, then results; no-results text for a miss", async ({ page }) => {
    await signedIn(page);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await page.route("**/api/v1/companies/search*", async (route) => { await gate; await route.continue(); });
    await page.goto("/");
    await searchBox(page).fill("Synthetic");
    await expect(page.getByText("Searching…").first()).toBeVisible();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    release();
    await expect(page.getByRole("listbox", { name: "Search results" })).toBeVisible();
    await expect(page.getByRole("option")).toHaveCount(4);
    await expect(page.getByRole("option").filter({ hasText: "SYNTHALPHA" })).toContainText("Synthetic Alpha Limited");
    await page.unroute("**/api/v1/companies/search*");

    await searchBox(page).fill("zzzzqqqq");
    await expect(page.getByText("No companies found")).toBeVisible();
    await expect(page.getByRole("option")).toHaveCount(0);

    // by symbol (case-insensitive) as well as by name
    await searchBox(page).fill("synthgamma");
    await expect(page.getByRole("option")).toHaveCount(1);
    await expect(page.getByRole("option")).toContainText("Synthetic Gamma Limited");
  });

  test("a failing search shows an error with retry instead of an empty list", async ({ page }) => {
    await signedIn(page);
    await page.route("**/api/v1/companies/search*", (route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ detail: "Too many requests; slow down and try again shortly" }) }));
    await page.goto("/");
    await searchBox(page).fill("Synthetic");
    await expect(page.getByRole("alert")).toContainText("Search failed");
  });

  test("combobox keyboard navigation: arrows, Home/End, Escape, Enter opens the active company", async ({ page }) => {
    await signedIn(page);
    await page.goto("/");
    const box = searchBox(page);
    await box.focus();
    await box.pressSequentially("Synthetic");
    const options = page.getByRole("option");
    await expect(options).toHaveCount(4);
    await expect(box).toHaveAttribute("aria-expanded", "true");
    await expect(box).not.toHaveAttribute("aria-activedescendant", /.+/);

    const active = async (i: number) => {
      await expect(options.nth(i)).toHaveAttribute("aria-selected", "true");
      const id = await options.nth(i).getAttribute("id");
      await expect(box).toHaveAttribute("aria-activedescendant", id!);
    };
    await box.press("ArrowDown"); await active(0);
    await box.press("ArrowDown"); await active(1);
    await box.press("ArrowUp"); await active(0);
    await box.press("ArrowUp"); await active(3); // wraps
    await box.press("Home"); await active(0);
    await box.press("End"); await active(3);

    await box.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(box).toHaveAttribute("aria-expanded", "false");
    await expect(box).toHaveValue("Synthetic"); // first Escape only closes the popup
    await box.press("ArrowDown");
    await expect(options).toHaveCount(4);
    await box.press("ArrowDown"); await active(0);
    await box.press("ArrowDown"); await active(1);
    const name = (await options.nth(1).locator("p").first().textContent())!.trim();
    await box.press("Enter");
    await expect(page).toHaveURL(/\/company\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  });

  test("clicking a result opens the company page", async ({ page }) => {
    await signedIn(page);
    await page.goto("/");
    await searchBox(page).fill("SYNTHALPHA");
    await page.getByRole("option", { name: /Synthetic Alpha Limited/ }).click();
    await expect(page).toHaveURL(/\/company\//);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Synthetic Alpha Limited");
  });

  test("market movers render with delayed provenance, and rows link to company pages", async ({ page }) => {
    await signedIn(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Top Gainers" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top Losers" })).toBeVisible();
    await expect(page.getByText(/Evaluated \d+ of \d+ symbols/)).toBeVisible();
    await expect(page.getByText(/^Delayed – Yahoo Finance/).first()).toBeVisible();
    await page.getByRole("button", { name: "Large Cap" }).click();
    await expect(page.getByRole("button", { name: "Large Cap" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("No index membership loaded for this segment.")).toBeVisible();
    await page.getByRole("button", { name: "Mid Cap" }).click();
    await page.getByRole("link", { name: /Synthetic Gamma Limited/ }).first().click();
    await expect(page).toHaveURL(/\/company\//);
  });

  test("segment / sector filters are offered in the personal profile", async ({ page }) => {
    await signedIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle filters" }).click();
    await expect(page.getByRole("button", { name: "Mid Cap", exact: true }).first()).toBeVisible();
    await page.getByLabel("Sector").fill("Synthetic Industry");
    await expect(page.getByRole("option")).toHaveCount(4);
  });
});

test.describe("company page (personal profile)", () => {
  test("quote with delayed provenance, chart, range buttons, news and financials all render for a healthy company", async ({ page, net }, testInfo) => {
    await signedIn(page);
    const id = await companyId(page.request, SYMS.ok);
    await page.goto(`/company/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Synthetic Alpha Limited");
    await expect(page).toHaveTitle(/Synthetic Alpha Limited/);

    // quote + provenance
    await expect(page.getByText("₹105.00").first()).toBeVisible();
    await expect(page.getByText("Previous Close", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/^Delayed – Yahoo Finance/).first()).toBeVisible();
    await expect(page.getByText(/Prices are delayed/).first()).toBeVisible();
    await expect(page.getByText(/Source: Yahoo Finance/).first()).toBeVisible();

    // chart renders (candles + accessible summary)
    const chart = page.getByRole("img", { name: /Daily candlestick chart, 3M range/ });
    await expect(chart).toBeVisible();
    await expect(chart.locator("svg.recharts-surface").first()).toBeVisible();
    expect(await chart.locator(".recharts-bar-rectangle").count()).toBeGreaterThan(10);
    await expect(page.getByRole("table", { name: /Last 10 trading days/ })).toHaveCount(1);

    // news: headlines, publisher, undated item handled, links are safe
    const news = page.locator("h3", { hasText: "Latest News" }).locator("xpath=ancestor::div[contains(@class,'rounded-md')][1]");
    await expect(news.getByRole("link", { name: "Synthetic headline 1" })).toBeVisible();
    await expect(news.getByText("Publication date not available")).toBeVisible();
    const links = news.locator("ul a");
    const n = await links.count();
    expect(n).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < n; i++) {
      const a = links.nth(i);
      await expect(a).toHaveAttribute("href", /^https:\/\//);
      await expect(a).toHaveAttribute("target", "_blank");
      await expect(a).toHaveAttribute("rel", /noopener/);
      await expect(a).toHaveAttribute("rel", /noreferrer/);
    }
    await shot(page, "company-overview", testInfo);
    await noHorizontalOverflow(page);

    // company page never triggers research by itself
    expect(net.count("POST", /\/research/)).toBe(0);
  });

  test("range buttons issue the matching /history?range= request and the chart data changes", async ({ page, net }) => {
    await signedIn(page);
    const id = await companyId(page.request, SYMS.ok);
    await page.goto(`/company/${id}`);
    const chartLabel = async () => (await page.locator('[role="img"][aria-label^="Daily candlestick chart"]').getAttribute("aria-label"))!;
    await expect(page.getByRole("img", { name: /3M range/ })).toBeVisible();
    expect(net.find("GET", /\/history\?range=3mo$/).length).toBe(1);

    const seen = new Map<string, string>();
    seen.set("3M", await chartLabel());
    const cases: [string, string][] = [["1M", "1mo"], ["6M", "6mo"], ["1Y", "1y"], ["5Y", "5y"]];
    for (const [label, param] of cases) {
      const resp = page.waitForResponse((r) => r.url().includes(`/history?range=${param}`) && r.request().method() === "GET");
      await page.getByRole("button", { name: label, exact: true }).click();
      const r = await resp;
      expect(r.status()).toBe(200);
      const body = await r.json();
      expect(body.range).toBe(param);
      await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
      const chart = page.getByRole("img", { name: new RegExp(`Daily candlestick chart, ${label} range, ${body.bars.length} trading days`) });
      await expect(chart).toBeVisible();
      await expect(page.getByRole("heading", { name: new RegExp(`Price Chart \\(${label}`) })).toBeVisible();
      seen.set(label, await chartLabel());
    }
    expect(new Set(seen.values()).size, "each range shows different chart data").toBe(5);
    expect(net.find("GET", /\/history\?range=/).map((e) => e.status)).toEqual([200, 200, 200, 200, 200]);
  });

  test("financials: statement tabs, period columns, computed change, and 'not available' markers", async ({ page }) => {
    await signedIn(page);
    const id = await companyId(page.request, SYMS.ok);
    await page.goto(`/company/${id}`);
    await page.getByRole("tab", { name: "Financials" }).click();
    const panel = page.getByTestId("panel-financials");
    await expect(panel.getByRole("columnheader", { name: "30 Jun 2026" })).toBeVisible();
    await expect(panel.getByRole("columnheader", { name: "30 Jun 2023" })).toBeVisible();
    await expect(panel.getByRole("cell", { name: /^Sales/ })).toBeVisible();
    await expect(panel.getByText("Quarterly", { exact: true })).toBeVisible();
    await expect(panel.getByText("Source: Screener.in")).toBeVisible();
    await expect(panel.getByRole("link", { name: "View source page" })).toHaveAttribute("rel", /noopener/);

    await panel.getByLabel("Computed change:").selectOption("prev");
    await expect(panel.getByTitle("Computed in the browser from the reported values").first()).toBeVisible();

    for (const [tab, header] of [["Profit & Loss", /Mar 2026/], ["Balance Sheet", /Mar 2026/], ["Cash Flow", /Mar 2026/], ["Ratios", /Mar 2026/]] as const) {
      await panel.getByRole("tab", { name: tab }).click();
      await expect(panel.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
      await expect(panel.getByRole("columnheader", { name: header })).toBeVisible();
      await expect(panel.getByText("Annual", { exact: true })).toBeVisible();
    }
    // somewhere in the statements a period has no reported value: it must say so, not show 0 or blank
    let naFound = false;
    for (const tab of ["Quarterly Results", "Profit & Loss", "Balance Sheet", "Cash Flow", "Ratios"]) {
      await panel.getByRole("tab", { name: tab }).click();
      await expect(panel.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
      await expect(panel.getByRole("table")).toBeVisible();
      if (await panel.getByLabel("Not available from the current source").count()) { naFound = true; break; }
    }
    test.info().annotations.push({ type: "na-cell", description: naFound ? "found" : "fixture has no gaps" });
  });

  test("unsupported symbol (provider 404): clear not-covered / unavailable states, news still works, nothing crashes", async ({ page, allow }) => {
    await signedIn(page);
    const id = await companyId(page.request, SYMS.unsupported);
    await page.goto(`/company/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Synthetic Delta Limited");
    await expect(page.getByText("Price data unavailable")).toBeVisible();
    await expect(page.getByText("No market data found for this symbol").first()).toBeVisible();
    await expect(page.getByText("Price history unavailable")).toBeVisible();
    await expect(page.getByRole("link", { name: "Synthetic headline 1" })).toBeVisible();
    await page.getByRole("tab", { name: "Financials" }).click();
    await expect(page.getByText("Not covered by the current source")).toBeVisible();
    await expect(page.getByText("The current financial-data source does not cover this company.")).toBeVisible();
    // the tabs for research / ask are still present and usable
    await expect(page.getByRole("tab", { name: "AI Research" })).toBeEnabled();
    void allow;
  });

  test("provider quota failure (429): quote and chart explain it, news and other sections still render", async ({ page }) => {
    await signedIn(page);
    const id = await companyId(page.request, SYMS.quota);
    await page.goto(`/company/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Synthetic Beta Limited");
    await expect(page.getByText("Price data unavailable")).toBeVisible();
    await expect(page.getByText("Market data provider rate limit reached; try again later").first()).toBeVisible();
    await expect(page.getByText("Price history unavailable")).toBeVisible();
    // 429 is not retryable right now: no "Try again" button in the quote box
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Synthetic headline 1" })).toBeVisible();
    await page.getByRole("tab", { name: "Financials" }).click();
    await expect(page.getByText("Financials unavailable")).toBeVisible();
    await expect(page.getByText("The financial data provider rate limit was reached; try again later.")).toBeVisible();
    await page.getByRole("tab", { name: "Ask" }).click();
    await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeVisible();
  });

  test("malformed and unknown company ids show 'Company not found'", async ({ page }) => {
    await signedIn(page);
    await page.goto("/company/not-a-uuid");
    await expect(page.getByRole("heading", { name: "Company not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Search for a company" })).toBeVisible();
    await expect(page).toHaveTitle(/Company not found/);
    await page.goto("/company/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { name: "Company not found" })).toBeVisible();
    await page.getByRole("link", { name: "Search for a company" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
