import { test, expect, companyId, csrfHeaders, newUser, registerViaApi, signedIn, SYMS, noHorizontalOverflow, shot } from "./support/fixtures";
import type { Locator, Page } from "@playwright/test";

const NAMES: Record<string, string> = { SYNTHALPHA: "Synthetic Alpha Limited", SYNTHBETA: "Synthetic Beta Limited", SYNTHGAMMA: "Synthetic Gamma Limited", SYNTHDELTA: "Synthetic Delta Limited" };

const card = (page: Page, name: string): Locator =>
  page.locator('[data-testid^="watchlist-"]').filter({ has: page.getByRole("heading", { name, exact: true }) });

async function createList(page: Page, name: string) {
  await page.getByRole("button", { name: "New Watchlist" }).click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

async function addCompany(page: Page, list: string, symbol: string) {
  const c = card(page, list);
  await c.getByLabel("Search companies to add").fill(symbol);
  await c.getByRole("button", { name: `Add ${NAMES[symbol]}` }).click();
  await expect(c.getByRole("button", { name: `Remove ${NAMES[symbol]}` })).toBeVisible();
}

test.describe("watchlists", () => {
  test("create, rename, add via the search picker, remove, delete; state persists across reload and logout/login", async ({ page, net }, testInfo) => {
    const u = await signedIn(page);
    await page.goto("/watchlists");
    await expect(page.getByText("No watchlists yet")).toBeVisible();

    await createList(page, "Alpha picks");
    await expect(card(page, "Alpha picks").getByText("This watchlist is empty")).toBeVisible();
    await expect(card(page, "Alpha picks").getByRole("button", { name: "Compare", exact: true })).toBeDisabled();

    // rename
    await page.getByRole("button", { name: "Rename Alpha picks" }).click();
    await page.getByLabel("Watchlist name").fill("Core picks");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByRole("heading", { name: "Core picks", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Alpha picks" })).toHaveCount(0);

    // add through the real search picker
    await addCompany(page, "Core picks", "SYNTHALPHA");
    await addCompany(page, "Core picks", "SYNTHGAMMA");
    await expect(card(page, "Core picks").getByText("2/10 companies")).toBeVisible();
    await expect(card(page, "Core picks").getByRole("button", { name: "Compare", exact: true })).toBeEnabled();
    // companies already in the list are shown as Added and cannot be added twice from the UI
    await card(page, "Core picks").getByLabel("Search companies to add").fill("SYNTHALPHA");
    await expect(card(page, "Core picks").getByRole("button", { name: "Synthetic Alpha Limited already added" })).toBeDisabled();
    await card(page, "Core picks").getByLabel("Search companies to add").fill("");

    // remove one
    await card(page, "Core picks").getByRole("button", { name: "Remove Synthetic Gamma Limited" }).click();
    await expect(card(page, "Core picks").getByRole("button", { name: "Remove Synthetic Gamma Limited" })).toHaveCount(0);
    await expect(card(page, "Core picks").getByText("1/10 companies")).toBeVisible();
    await shot(page, "watchlist", testInfo);
    await noHorizontalOverflow(page);

    // persists after reload
    await page.reload();
    await expect(card(page, "Core picks").getByRole("button", { name: "Remove Synthetic Alpha Limited" })).toBeVisible();
    await expect(card(page, "Core picks").getByText("1/10 companies")).toBeVisible();

    // ... and after logout + login
    await page.getByRole("button", { name: /^Account menu for / }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Email").fill(u.email);
    await page.getByLabel("Password", { exact: true }).fill(u.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/watchlists$/); // back where the user was (?next=)
    await expect(card(page, "Core picks").getByRole("button", { name: "Remove Synthetic Alpha Limited" })).toBeVisible();

    // company link from a watchlist opens the company page
    await card(page, "Core picks").getByRole("button", { name: /Synthetic Alpha Limited SYNTHALPHA/ }).click();
    await expect(page).toHaveURL(/\/company\//);
    await page.goBack();

    // delete needs confirmation
    await page.getByRole("button", { name: "Delete Core picks" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Core picks", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Delete Core picks" }).click();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page.getByText("No watchlists yet")).toBeVisible();
    await page.reload();
    await expect(page.getByText("No watchlists yet")).toBeVisible();
    expect(net.count("DELETE", /\/api\/v1\/watchlists\/[0-9a-f-]{36}$/)).toBe(1);
  });

  test("duplicate add (stale tab) shows the server's conflict as an error; duplicate / blank names are rejected", async ({ page, allow }) => {
    allow.httpStatus(409, /./);
    await signedIn(page);
    await page.goto("/watchlists");
    await createList(page, "Dupes");

    // Another tab adds the company; this (stale) tab still offers "Add", the server answers 409.
    const alpha = await companyId(page.request, SYMS.ok);
    const lists = await (await page.request.get("/api/v1/watchlists")).json();
    const res = await page.request.post(`/api/v1/watchlists/${lists[0].id}/items`, { data: { company_id: alpha }, headers: await csrfHeaders(page.context()) });
    expect(res.status()).toBe(201);

    const c = card(page, "Dupes");
    await c.getByLabel("Search companies to add").fill("SYNTHALPHA");
    await c.getByRole("button", { name: "Add Synthetic Alpha Limited" }).click();
    await expect(c.getByRole("alert")).toHaveText("That company is already in this watchlist.");

    // duplicate name
    await page.getByRole("button", { name: "New Watchlist" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Dupes");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "You already have a watchlist with that name." })).toBeVisible();
    // blank / whitespace-only names cannot be submitted
    await page.getByLabel("Name", { exact: true }).fill("   ");
    await expect(page.getByRole("button", { name: "Create", exact: true })).toBeDisabled();
  });

  test("'Show delayed prices' uses /snapshot, shows prices and per-company reasons for provider failures", async ({ page, net }) => {
    await signedIn(page);
    await page.goto("/watchlists");
    await createList(page, "Prices");
    for (const s of ["SYNTHALPHA", "SYNTHBETA", "SYNTHDELTA"]) await addCompany(page, "Prices", s);
    const c = card(page, "Prices");
    expect(net.count("GET", /\/snapshot/), "prices are only fetched on request").toBe(0);

    await c.getByRole("button", { name: "Show delayed prices" }).click();
    await expect(c.getByRole("button", { name: "Hide prices" })).toHaveAttribute("aria-pressed", "true");
    await expect(c.getByText(/₹\d+\.\d\d/)).toBeVisible();
    await expect(c.getByText("Provider rate limit reached")).toBeVisible();      // SYNTHBETA quota
    await expect(c.getByText("No data found for this symbol")).toBeVisible();     // SYNTHDELTA unsupported
    await expect(c.getByText(/^Delayed – Yahoo Finance/)).toBeVisible();
    expect(net.count("GET", /\/api\/v1\/watchlists\/[0-9a-f-]{36}\/snapshot$/)).toBe(1);
    await c.getByRole("button", { name: "Hide prices" }).click();
    await expect(c.getByText(/₹\d+\.\d\d/)).toHaveCount(0);
  });

  test("compare: statement selector, per-company availability badges, unavailable reasons and '—' cells", async ({ page, net }, testInfo) => {
    await signedIn(page);
    await page.goto("/watchlists");
    await createList(page, "Compare me");
    for (const s of ["SYNTHALPHA", "SYNTHGAMMA", "SYNTHBETA", "SYNTHDELTA"]) await addCompany(page, "Compare me", s);
    await card(page, "Compare me").getByRole("button", { name: "Compare", exact: true }).click();
    await expect(page).toHaveURL(/\/watchlist\/[0-9a-f-]{36}\/analysis$/);
    await expect(page.getByRole("heading", { name: "Compare me", level: 1 })).toBeVisible();
    await expect(page.getByText(/Nothing has been fetched yet/)).toBeVisible();
    expect(net.count("POST", /\/compare$/), "comparison runs only on request").toBe(0);

    await page.getByRole("button", { name: "Run comparison" }).click();
    const ids = Object.fromEntries(await Promise.all(Object.values(SYMS).map(async (s) => [s, await companyId(page.request, s)])));
    await expect(page.getByTestId(`status-${ids.SYNTHALPHA}`)).toHaveText("Data available");
    await expect(page.getByTestId(`status-${ids.SYNTHGAMMA}`)).toHaveText("Data available");
    await expect(page.getByTestId(`status-${ids.SYNTHBETA}`)).toHaveText("Unavailable");
    await expect(page.getByTestId(`status-${ids.SYNTHDELTA}`)).toHaveText("Unavailable");
    await expect(page.getByText("Provider rate limit reached").first()).toBeVisible();
    await expect(page.getByText("No data found for this symbol").first()).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByRole("row", { name: /^Sales/ })).toContainText("1,120");
    await expect(table.getByRole("row", { name: /^Net Profit/ })).toContainText("154");
    await expect(table.getByRole("row", { name: /^Sales/ }).getByLabel("Not available from the current source")).toHaveCount(2);
    await expect(page.getByText(/No ranking or AI interpretation is applied|no ranking or scoring is applied/i).first()).toBeVisible();
    await shot(page, "compare", testInfo, { fullPage: true });
    await noHorizontalOverflow(page);

    // switch statement
    await page.getByLabel("Statement").selectOption("balance_sheet");
    await page.getByRole("button", { name: "Refresh comparison" }).click();
    await expect(table.getByRole("row", { name: /^Total Assets/ })).toContainText("7,240");
    await expect(page.locator("p", { hasText: /^Balance sheet/ })).toContainText("Values are as reported");
    expect(net.count("POST", /\/compare$/)).toBe(2);
  });

  test("compare needs two companies and the back link returns to the list", async ({ page }) => {
    await signedIn(page);
    await page.goto("/watchlists");
    await createList(page, "Solo");
    await addCompany(page, "Solo", "SYNTHALPHA");
    await expect(card(page, "Solo").getByRole("button", { name: "Compare", exact: true })).toBeDisabled();
    const lists = await (await page.request.get("/api/v1/watchlists")).json();
    await page.goto(`/watchlist/${lists[0].id}/analysis`);
    await expect(page.getByText("Add at least two companies to this watchlist to compare them.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run comparison" })).toBeDisabled();
    await page.getByRole("button", { name: "Back to Watchlists" }).click();
    await expect(page).toHaveURL(/\/watchlists$/);
  });

  test("a second user starts with no watchlists (list is per account)", async ({ page, browser }) => {
    await signedIn(page);
    await page.goto("/watchlists");
    await createList(page, "Mine");
    const ctx2 = await browser.newContext({ baseURL: page.url().split("/watchlists")[0] });
    try {
      await registerViaApi(ctx2, newUser());
      const p2 = await ctx2.newPage();
      await p2.goto("/watchlists");
      await expect(p2.getByText("No watchlists yet")).toBeVisible();
    } finally { await ctx2.close(); }
  });
});
