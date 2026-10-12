import AxeBuilder from "@axe-core/playwright";
import { test, expect, companyId, csrfHeaders, newUser, registerViaApi, signedIn, SYMS, noHorizontalOverflow, shot } from "./support/fixtures";
import type { Page } from "@playwright/test";

/** Rules that are reported (annotation) but not failed: moderate/minor, listed in docs/E2E.md as open. */
async function axe(page: Page, label: string) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  const blocking = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const rest = res.violations.filter((v) => !(v.impact === "serious" || v.impact === "critical"));
  for (const v of rest) test.info().annotations.push({ type: "axe-nonblocking", description: `${label}: ${v.impact} ${v.id} (${v.nodes.length} nodes) - ${v.help}` });
  expect(blocking.map((v) => `${label}: ${v.impact} ${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
    "serious/critical accessibility violations").toEqual([]);
}

async function renders(page: Page, h1: RegExp | string) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(h1);
  const text = (await page.locator("body").innerText()).trim();
  expect(text.length, "page must not be blank").toBeGreaterThan(40);
  await noHorizontalOverflow(page);
}

async function focusIndicator(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { ok: false, what: "nothing focused" };
    const visible = (e: Element) => { const s = getComputedStyle(e); return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none"); };
    // custom widgets draw their focus ring on a wrapper (:focus-within)
    const wrapper = el.closest("[class*='focus-within']");
    const ok = !!visible(el) || (!!wrapper && !!visible(wrapper)) || el.matches("a[href^='#']");
    const label = el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || el.tagName;
    return { ok: !!ok, what: `${el.tagName.toLowerCase()} "${label}"` };
  });
}

test.describe("UI quality", () => {
  test("every main page renders (no blank screen), fits the viewport width, and has no console errors", async ({ page }, testInfo) => {
    await page.goto("/login");
    await renders(page, "Sign in");
    await page.goto("/register");
    await renders(page, "Create account");

    await signedIn(page);
    await page.goto("/");
    await renders(page, "Source-linked equity research");
    await expect(page.getByRole("heading", { name: "Top Gainers" })).toBeVisible();
    await noHorizontalOverflow(page);

    await page.goto(`/company/${await companyId(page.request, SYMS.ok)}`);
    await renders(page, "Synthetic Alpha Limited");
    await expect(page.getByRole("img", { name: /Daily candlestick chart/ })).toBeVisible();
    await page.getByRole("tab", { name: "Financials" }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await noHorizontalOverflow(page); // wide statement table scrolls inside its own region, not the page
    await page.getByRole("tab", { name: "AI Research" }).click();
    await noHorizontalOverflow(page);
    await page.getByRole("tab", { name: "Ask" }).click();
    await noHorizontalOverflow(page);

    await page.goto("/watchlists");
    await renders(page, "Watchlists");
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test("navbar is usable: both links reachable, account menu opens fully on screen and logs out", async ({ page }) => {
    const u = await signedIn(page);
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toBeVisible();
    const vp = page.viewportSize()!;
    for (const name of ["EquityLens home", "Discover", "Watchlists"]) {
      const link = nav.getByRole("link", { name });
      await expect(link).toBeVisible();
      const box = (await link.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${name} inside viewport`).toBeLessThanOrEqual(vp.width);
      expect(box.height, `${name} tap target height`).toBeGreaterThanOrEqual(24);
    }
    await nav.getByRole("link", { name: "Watchlists" }).click();
    await expect(page).toHaveURL(/\/watchlists$/);
    await expect(nav.getByRole("link", { name: "Watchlists" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Discover" }).click();
    await expect(page).toHaveURL(/\/$/);

    const menuBtn = nav.getByRole("button", { name: `Account menu for ${u.email}` });
    await menuBtn.click();
    const menu = page.getByRole("menu", { name: "Account" });
    await expect(menu).toBeVisible();
    const m = (await menu.boundingBox())!;
    expect(m.x, "menu left edge on screen").toBeGreaterThanOrEqual(0);
    expect(m.x + m.width, "menu right edge on screen").toBeLessThanOrEqual(vp.width);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await menuBtn.click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("accessibility (axe wcag2a/aa + best-practice): no serious or critical violations on login, dashboard, company, watchlists, compare", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await axe(page, "login");
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    await axe(page, "register");

    await signedIn(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Top Gainers" })).toBeVisible();
    await expect(page.getByText("Evaluated 4 of 4 symbols")).toBeVisible();
    await axe(page, "dashboard");
    await page.getByRole("combobox", { name: "Search companies" }).fill("Synthetic");
    await expect(page.getByRole("option")).toHaveCount(4);
    await axe(page, "dashboard + open results");

    await page.goto(`/company/${await companyId(page.request, SYMS.ok)}`);
    await expect(page.getByRole("img", { name: /Daily candlestick chart/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Synthetic headline 1" })).toBeVisible();
    await axe(page, "company overview");
    await page.getByRole("tab", { name: "Financials" }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await axe(page, "company financials");
    await page.getByRole("tab", { name: "AI Research" }).click();
    await expect(page.getByText("No saved research for this company")).toBeVisible();
    await axe(page, "company research (empty)");
    await page.getByRole("tab", { name: "Ask" }).click();
    await page.getByLabel("Your question").fill("What are the quarterly sales and net profit?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Synthetic answer based on the stored sources [1].")).toBeVisible();
    await axe(page, "company ask (answer)");

    // watchlist with items + comparison
    const h = await csrfHeaders(page.context());
    const wl = await (await page.request.post("/api/v1/watchlists", { data: { name: "axe list" }, headers: h })).json();
    for (const s of [SYMS.ok, SYMS.ok2, SYMS.quota]) {
      const r = await page.request.post(`/api/v1/watchlists/${wl.id}/items`, { data: { company_id: await companyId(page.request, s) }, headers: h });
      expect(r.status()).toBe(201);
    }
    await page.goto("/watchlists");
    await expect(page.getByRole("heading", { name: "axe list" })).toBeVisible();
    await page.getByRole("button", { name: "Show delayed prices" }).click();
    await expect(page.getByText("Provider rate limit reached")).toBeVisible();
    await axe(page, "watchlists");
    await page.goto(`/watchlist/${wl.id}/analysis`);
    await page.getByRole("button", { name: "Run comparison" }).click();
    await expect(page.getByText("Data available").first()).toBeVisible();
    await expect(page.getByText("Unavailable").first()).toBeVisible();
    await axe(page, "compare");
  });

  test("keyboard only: sign in, reach the search box with Tab, pick a company with the arrow keys and Enter; focus is always visible", async ({ page }) => {
    const u = newUser();
    await registerViaApi(page.context(), u);
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // login form: Tab order email -> password -> submit
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email")).toBeFocused();
    expect((await focusIndicator(page)).ok, "focus visible on email").toBe(true);
    await page.keyboard.type(u.email);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
    expect((await focusIndicator(page)).ok, "focus visible on password").toBe(true);
    await page.keyboard.type(u.password);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
    expect((await focusIndicator(page)).ok, "focus visible on submit").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Source-linked equity research");

    // dashboard: tab from the top until the combobox has focus; every stop must show focus
    const combo = page.getByRole("combobox", { name: "Search companies" });
    const stops: string[] = [];
    for (let i = 0; i < 15 && !(await combo.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
      const f = await focusIndicator(page);
      stops.push(f.what);
      expect(f.ok, `focus visible on ${f.what}`).toBe(true);
    }
    await expect(combo).toBeFocused();
    expect(stops[0], "skip link is the first tab stop").toContain("Skip to main content");
    expect((await focusIndicator(page)).ok, "focus visible on the search box").toBe(true);

    await page.keyboard.type("SYNTHGAMMA");
    await expect(page.getByRole("option")).toHaveCount(1);
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/company\//);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Synthetic Gamma Limited");

    // company page tabs are operable with the keyboard
    await page.getByRole("tab", { name: "Overview" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Financials" })).toBeFocused();
    expect((await focusIndicator(page)).ok, "focus visible on tabs").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("panel-financials")).toBeVisible();
  });
});
