import { test as base, expect, type APIRequestContext, type BrowserContext, type Page, type Request, type Response } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import AxeBuilder from "@axe-core/playwright";

export { expect };

export interface RecordedRequest { method: string; url: string; path: string; search: string; status: number | null; resourceType: string }

/** Everything the app asked the network for during a test; used to assert what was (not) requested. */
export class NetLog {
  readonly entries: RecordedRequest[] = [];
  constructor(private readonly origin: string) {}
  api(): RecordedRequest[] { return this.entries.filter((e) => e.path.startsWith("/api/") || e.path.startsWith("/auth/")); }
  find(method: string, re: RegExp): RecordedRequest[] { return this.entries.filter((e) => e.method === method && re.test(e.path + e.search)); }
  count(method: string, re: RegExp): number { return this.find(method, re).length; }
  clear() { this.entries.length = 0; }
  get base() { return this.origin; }
}

/** Provoked failures a test deliberately causes. Anything else that is wrong fails the test at teardown. */
export class Allow {
  readonly console: RegExp[] = [];
  readonly status: { status: number; url: RegExp }[] = [];
  readonly failed: RegExp[] = [];
  consoleError(re: RegExp) { this.console.push(re); }
  httpStatus(status: number, url: RegExp) { this.status.push({ status, url }); }
  failedRequest(url: RegExp) { this.failed.push(url); }
}

interface Fixtures {
  net: NetLog;
  allow: Allow;
  guard: void;
}

const pathOf = (u: string) => { try { const x = new URL(u); return { path: x.pathname, search: x.search }; } catch { return { path: u, search: "" }; } };

/** Attach the pageerror / console.error / 5xx / failed-request guard and the request recorder to a page. */
export const PROD_BUILD = !!process.env.E2E_BUILD;

export function instrument(page: Page, net: NetLog, allow: Allow, problems: string[]) {
  // Content-Security-Policy violations. Only the production-build mode serves the CSP header, but the listener is harmless
  // elsewhere. Chrome also logs a console error for each violation; this makes the report explicit and un-ignorable.
  void page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`CSP-VIOLATION ${e.violatedDirective} blocked=${e.blockedURI || "inline"} source=${e.sourceFile || ""}:${e.lineNumber}`);
    });
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // Chrome logs every non-2xx fetch as "Failed to load resource: ... status of NNN". 5xx are reported by the response
    // listener below; 4xx are normal API semantics here (401/404/409/422/429 are asserted explicitly by the tests that cause them).
    if (/^Failed to load resource/.test(text)) return;
    if (allow.console.some((re) => re.test(text))) return;
    problems.push(`console.error: ${text}`);
  });
  page.on("request", (r: Request) => {
    const { path, search } = pathOf(r.url());
    net.entries.push({ method: r.method(), url: r.url(), path, search, status: null, resourceType: r.resourceType() });
  });
  page.on("response", (r: Response) => {
    const rec = [...net.entries].reverse().find((e) => e.url === r.url() && e.status === null && e.method === r.request().method());
    if (rec) rec.status = r.status();
    if (r.status() >= 500 && !allow.status.some((a) => a.status === r.status() && a.url.test(r.url()))) problems.push(`HTTP ${r.status()} from ${r.request().method()} ${r.url()}`);
  });
  page.on("requestfailed", (r) => {
    const err = r.failure()?.errorText ?? "";
    if (err.includes("ERR_ABORTED")) return; // the app (react-query) cancels superseded requests on purpose
    if (allow.failed.some((re) => re.test(r.url()))) return;
    problems.push(`request failed (${err}): ${r.method()} ${r.url()}`);
  });
}

export const test = base.extend<Fixtures>({
  net: async ({ baseURL }, use) => { await use(new NetLog(baseURL!)); },
  allow: async ({}, use) => { await use(new Allow()); },
  guard: [async ({ page, net, allow }, use) => {
    const problems: string[] = [];
    instrument(page, net, allow, problems);
    await use();
    expect(problems, "unexpected page errors / console errors / 5xx / failed requests").toEqual([]);
  }, { auto: true }],
});

// ---------------------------------------------------------------------------------------------------------------- data helpers

export const SYMS = { ok: "SYNTHALPHA", quota: "SYNTHBETA", ok2: "SYNTHGAMMA", unsupported: "SYNTHDELTA" } as const;

export function newUser() {
  return { email: `e2e-${randomUUID()}@example.com`, password: `Pw-${randomUUID()}` };
}

export function csrfOf(cookies: { name: string; value: string }[]): string {
  const c = cookies.find((x) => x.name === "el_csrf");
  if (!c) throw new Error("no el_csrf cookie");
  return decodeURIComponent(c.value);
}

/** Register through the API (setup only; the auth spec drives registration through the UI). Cookies land in the context. */
export async function registerViaApi(ctx: BrowserContext | { request: APIRequestContext }, user = newUser()) {
  const request = "request" in ctx ? ctx.request : (ctx as BrowserContext).request;
  const res = await request.post("/auth/register", { data: user });
  expect(res.status(), await res.text()).toBe(201);
  return user;
}

/** Authenticated unsafe-method request helper: adds the CSRF header from the context's el_csrf cookie. */
export async function csrfHeaders(ctx: BrowserContext): Promise<Record<string, string>> {
  return { "X-CSRF-Token": csrfOf(await ctx.cookies()) };
}

const companyCache = new Map<string, string>();
export async function companyId(request: APIRequestContext, symbol: string): Promise<string> {
  const hit = companyCache.get(symbol);
  if (hit) return hit;
  const res = await request.get("/api/v1/companies/search", { params: { q: symbol } });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const row = body.items.find((c: { primary_symbol: string }) => c.primary_symbol === symbol);
  if (!row) throw new Error(`seeded company ${symbol} not found`);
  companyCache.set(symbol, row.id);
  return row.id;
}

/** Fresh signed-in user in the context (API registration), returns credentials. */
export async function signedIn(page: Page): Promise<{ email: string; password: string }> {
  return registerViaApi(page.context());
}

/** Database connection for the E2E-only server-side manipulations (session ageing). Local throw-away DBs only. */
export function pgClient(database: "e2e_personal" | "e2e_public" | "e2e_public_news" = "e2e_personal") {
  const host = process.env.E2E_PG_HOST ?? "127.0.0.1";
  if (!["127.0.0.1", "localhost"].includes(host)) throw new Error("E2E database must be local");
  return new pg.Client({ host, port: Number(process.env.E2E_PG_PORT ?? 55433), user: process.env.E2E_PG_USER ?? "postgres",
    password: process.env.E2E_PG_PASSWORD ?? "equitylens_dev", database });
}

/** Wait until the page is not showing the global session-check spinner. */
export async function appReady(page: Page) {
  await expect(page.getByText("Checking your session…")).toHaveCount(0);
}

export async function noHorizontalOverflow(page: Page) {
  const o = await page.evaluate(() => ({ sw: document.scrollingElement!.scrollWidth, iw: window.innerWidth }));
  expect(o.sw, `scrollWidth ${o.sw} > innerWidth ${o.iw}`).toBeLessThanOrEqual(o.iw);
}

export async function shot(page: Page, name: string, testInfo: { project: { name: string } }, opts: { fullPage?: boolean } = {}) {
  const kind = testInfo.project.name.includes("mobile") ? "mobile" : "desktop";
  const n = testInfo.project.name;
  const profile = n.startsWith("public-news") ? "public-news-" : n.startsWith("public") ? "public-" : "";
  await page.screenshot({ path: `e2e/screenshots/${profile}${name}-${kind}.png`, fullPage: opts.fullPage ?? false });
}

/** Accessibility: serious/critical axe violations fail; moderate/minor are recorded as annotations (listed in docs/E2E.md). */
export async function axeCheck(page: Page, label: string) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  const blocking = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  for (const v of res.violations.filter((x) => !blocking.includes(x))) base.info().annotations.push({ type: "axe-nonblocking", description: `${label}: ${v.impact} ${v.id} (${v.nodes.length} nodes) - ${v.help}` });
  expect(blocking.map((v) => `${label}: ${v.impact} ${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
    "serious/critical accessibility violations").toEqual([]);
}
