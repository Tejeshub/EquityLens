import { test, expect, Allow, NetLog, instrument, companyId, csrfHeaders, newUser, registerViaApi, SYMS } from "./support/fixtures";
import type { APIRequestContext, Browser } from "@playwright/test";

const UNKNOWN = "00000000-0000-4000-8000-000000000000";

async function newUserContext(browser: Browser, baseURL: string, problems: string[], allow: Allow) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const user = await registerViaApi(ctx, newUser());
  const page = await ctx.newPage();
  instrument(page, new NetLog(baseURL), allow, problems);
  return { ctx, page, user };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<any> {
  try { return await res.json(); } catch { return null; }
}

test.describe("multi-user isolation", () => {
  test("user B cannot see or touch user A's watchlists and research (UI and every id-taking route -> 404); anonymous -> 401", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const problems: string[] = [];
    const allow = new Allow();
    const A = await newUserContext(browser, baseURL!, problems, allow);
    const B = await newUserContext(browser, baseURL!, problems, allow);
    const anon = await browser.newContext({ baseURL });
    try {
      const alphaId = await companyId(A.ctx.request, SYMS.ok);
      const gammaId = await companyId(A.ctx.request, SYMS.ok2);

      // --- A, through the UI: a watchlist with a company, and a research report
      await A.page.goto("/watchlists");
      await A.page.getByRole("button", { name: "New Watchlist" }).click();
      await A.page.getByLabel("Name", { exact: true }).fill("A private list");
      await A.page.getByRole("button", { name: "Create", exact: true }).click();
      await expect(A.page.getByRole("heading", { name: "A private list" })).toBeVisible();
      await A.page.getByLabel("Search companies to add").fill("SYNTHALPHA");
      await A.page.getByRole("button", { name: "Add Synthetic Alpha Limited" }).click();
      await expect(A.page.getByRole("button", { name: "Remove Synthetic Alpha Limited" })).toBeVisible();

      await A.page.goto(`/company/${alphaId}`);
      await A.page.getByRole("tab", { name: "AI Research" }).click();
      const started = A.page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/v1/research/${alphaId}`);
      await A.page.getByRole("button", { name: "Generate research" }).click();
      const jobId: string = (await (await started).json()).job_id;
      await expect(A.page.getByText("Overall score")).toBeVisible({ timeout: 45_000 });

      const aLists = await json(await A.ctx.request.get("/api/v1/watchlists"));
      const wlId: string = aLists[0].id;
      const report = await json(await A.ctx.request.get(`/api/v1/research/latest?company_id=${alphaId}`));
      const reportId: string = report.id;
      expect(wlId && jobId && reportId).toBeTruthy();

      // --- B, through the UI: sees nothing of A's
      await B.page.goto("/watchlists");
      await expect(B.page.getByText("No watchlists yet")).toBeVisible();
      await expect(B.page.getByText("A private list")).toHaveCount(0);
      await B.page.goto(`/company/${alphaId}`);
      await B.page.getByRole("tab", { name: "AI Research" }).click();
      await expect(B.page.getByText("No saved research for this company")).toBeVisible();
      await expect(B.page.getByText("Overall score")).toHaveCount(0);
      await B.page.goto(`/watchlist/${wlId}/analysis`);
      await expect(B.page.getByRole("heading", { name: "Watchlist not found" })).toBeVisible();
      await expect(B.page.getByText("A private list")).toHaveCount(0);

      // --- B's authenticated API requests against A's ids: always the same 404 as for an id that never existed
      const h = await csrfHeaders(B.ctx);
      const req = B.ctx.request;
      type Probe = { name: string; call: (id: { wl: string; report: string; job: string }) => Promise<Awaited<ReturnType<APIRequestContext["get"]>>> };
      const probes: Probe[] = [
        { name: "GET snapshot", call: (i) => req.get(`/api/v1/watchlists/${i.wl}/snapshot`) },
        { name: "PATCH watchlist", call: (i) => req.patch(`/api/v1/watchlists/${i.wl}`, { data: { name: "hijacked" }, headers: h }) },
        { name: "DELETE watchlist", call: (i) => req.delete(`/api/v1/watchlists/${i.wl}`, { headers: h }) },
        { name: "POST items", call: (i) => req.post(`/api/v1/watchlists/${i.wl}/items`, { data: { company_id: gammaId }, headers: h }) },
        { name: "DELETE item", call: (i) => req.delete(`/api/v1/watchlists/${i.wl}/items/${alphaId}`, { headers: h }) },
        { name: "POST compare", call: (i) => req.post(`/api/v1/watchlists/${i.wl}/compare`, { data: { statement: "quarterly_results" }, headers: h }) },
        { name: "GET research report", call: (i) => req.get(`/api/v1/research/${i.report}`) },
        { name: "GET research job", call: (i) => req.get(`/api/v1/research/jobs/${i.job}`) },
      ];
      for (const p of probes) {
        const real = await p.call({ wl: wlId, report: reportId, job: jobId });
        const none = await p.call({ wl: UNKNOWN, report: UNKNOWN, job: UNKNOWN });
        expect(real.status(), `${p.name} with A's id`).toBe(404);
        expect(none.status(), `${p.name} with an unknown id`).toBe(404);
        expect(await json(real), `${p.name}: body must not differ between 'exists but not yours' and 'does not exist'`).toEqual(await json(none));
      }
      // latest / active are keyed by company and scoped to the caller: B has nothing, whatever A has
      const latest = await req.get(`/api/v1/research/latest?company_id=${alphaId}`);
      expect(latest.status()).toBe(404);
      expect((await json(latest)).detail.code).toBe("no_research");
      const active = await req.get(`/api/v1/research/active?company_id=${alphaId}`);
      expect(active.status()).toBe(404);
      expect((await json(await req.get("/api/v1/watchlists")))).toEqual([]);

      // --- A's data is untouched by all of that
      const after = await json(await A.ctx.request.get("/api/v1/watchlists"));
      expect(after).toHaveLength(1);
      expect(after[0].name).toBe("A private list");
      expect(after[0].items.map((i: { symbol: string }) => i.symbol)).toEqual(["SYNTHALPHA"]);
      expect((await A.ctx.request.get(`/api/v1/research/${reportId}`)).status()).toBe(200);
      expect((await A.ctx.request.get(`/api/v1/research/jobs/${jobId}`)).status()).toBe(200);

      // --- and the other direction: B's list is invisible to A
      const bList = await json(await req.post("/api/v1/watchlists", { data: { name: "B private list" }, headers: h }));
      expect((await A.ctx.request.get(`/api/v1/watchlists/${bList.id}/snapshot`)).status()).toBe(404);
      await A.page.goto("/watchlists");
      await expect(A.page.getByRole("heading", { name: "A private list" })).toBeVisible();
      await expect(A.page.getByText("B private list")).toHaveCount(0);

      // --- unauthenticated probing: 401 everywhere, never 404/200/403 (which would reveal existence or skip auth)
      const anonReq = anon.request;
      const anonCalls: [string, () => Promise<Awaited<ReturnType<APIRequestContext["get"]>>>][] = [
        ["GET watchlists", () => anonReq.get("/api/v1/watchlists")],
        ["GET snapshot", () => anonReq.get(`/api/v1/watchlists/${wlId}/snapshot`)],
        ["PATCH watchlist", () => anonReq.patch(`/api/v1/watchlists/${wlId}`, { data: { name: "x" } })],
        ["DELETE watchlist", () => anonReq.delete(`/api/v1/watchlists/${wlId}`)],
        ["POST items", () => anonReq.post(`/api/v1/watchlists/${wlId}/items`, { data: { company_id: alphaId } })],
        ["DELETE item", () => anonReq.delete(`/api/v1/watchlists/${wlId}/items/${alphaId}`)],
        ["POST compare", () => anonReq.post(`/api/v1/watchlists/${wlId}/compare`, { data: {} })],
        ["GET report", () => anonReq.get(`/api/v1/research/${reportId}`)],
        ["GET job", () => anonReq.get(`/api/v1/research/jobs/${jobId}`)],
        ["GET latest", () => anonReq.get(`/api/v1/research/latest?company_id=${alphaId}`)],
        ["GET active", () => anonReq.get(`/api/v1/research/active?company_id=${alphaId}`)],
        ["POST research", () => anonReq.post(`/api/v1/research/${alphaId}`, { data: {} })],
        ["POST ask", () => anonReq.post("/api/v1/ask", { data: { company_id: alphaId, question: "what is revenue" } })],
        ["GET company", () => anonReq.get(`/api/v1/companies/${alphaId}`)],
        ["GET search", () => anonReq.get("/api/v1/companies/search?q=synth")],
        ["GET quote", () => anonReq.get(`/api/v1/companies/${alphaId}/quote`)],
        ["GET history", () => anonReq.get(`/api/v1/companies/${alphaId}/history`)],
        ["GET news", () => anonReq.get(`/api/v1/companies/${alphaId}/news`)],
        ["GET financials", () => anonReq.get(`/api/v1/companies/${alphaId}/financials`)],
        ["GET movers", () => anonReq.get("/api/v1/market/movers")],
        ["GET me", () => anonReq.get("/auth/me")],
      ];
      for (const [name, call] of anonCalls) expect((await call()).status(), `anonymous ${name}`).toBe(401);
      // capabilities are deliberately public
      expect((await anonReq.get("/api/v1/capabilities")).status()).toBe(200);
    } finally {
      await Promise.all([A.ctx.close(), B.ctx.close(), anon.close()]);
    }
    expect(problems, "unexpected page errors / console errors / 5xx / failed requests").toEqual([]);
  });

  test("signing out one user does not sign out another browser context, and sessions are not shared", async ({ browser, baseURL }) => {
    const problems: string[] = [];
    const allow = new Allow();
    const A = await newUserContext(browser, baseURL!, problems, allow);
    const B = await newUserContext(browser, baseURL!, problems, allow);
    try {
      await A.page.goto("/");
      await B.page.goto("/");
      await expect(A.page.getByRole("button", { name: `Account menu for ${A.user.email}` })).toBeVisible();
      await expect(B.page.getByRole("button", { name: `Account menu for ${B.user.email}` })).toBeVisible();
      await A.page.getByRole("button", { name: /^Account menu for / }).click();
      await A.page.getByRole("menuitem", { name: "Log out" }).click();
      await expect(A.page).toHaveURL(/\/login/);
      await B.page.reload();
      await expect(B.page.getByRole("button", { name: `Account menu for ${B.user.email}` })).toBeVisible();
      const me = await json(await B.ctx.request.get("/auth/me"));
      expect(me.email).toBe(B.user.email);
    } finally {
      await Promise.all([A.ctx.close(), B.ctx.close()]);
    }
    expect(problems).toEqual([]);
  });
});
