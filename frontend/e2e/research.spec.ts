import { test, expect, companyId, signedIn, SYMS, shot } from "./support/fixtures";
import type { Page } from "@playwright/test";

const openResearch = async (page: Page) => { await page.getByRole("tab", { name: "AI Research" }).click(); };
const running = (page: Page) => page.getByRole("status").filter({ hasText: /Research is (queued|running)…|Starting research…/ });

/** Numbers shown on the report page: overall score and per-dimension scores (out of 100). */
async function readScores(page: Page) {
  const overall = Number((await page.getByText("Overall score").locator("xpath=following-sibling::p[1]").textContent())!.split("/")[0]);
  const dims: Record<string, { status: string; score: number | null }> = {};
  const cards = page.locator("div.space-y-3 > div.rounded-lg");
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const c = cards.nth(i);
    const title = (await c.locator("p.font-medium").first().textContent())!.trim();
    const status = (await c.locator("span").first().textContent())!.trim();
    const raw = (await c.locator("p.text-lg").textContent())!.trim();
    dims[title] = { status, score: raw === "N/A" ? null : Number(raw.split("/")[0]) };
  }
  return { overall, dims };
}

test.describe("AI research", () => {
  test("never runs on page load; click -> visible running state -> scorecard with scores, criteria, confidence, sources", async ({ page, net }, testInfo) => {
    await signedIn(page);
    const id = await companyId(page.request, SYMS.ok);
    await page.goto(`/company/${id}`);
    await openResearch(page);
    await expect(page.getByText("No saved research for this company")).toBeVisible();
    expect(net.count("GET", /\/research\/latest\?company_id=/)).toBe(1);
    expect(net.count("POST", /\/research/), "no research may be fired on page load").toBe(0);

    await page.getByRole("button", { name: "Generate research" }).click();
    await expect(running(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate research" })).toBeDisabled();
    await expect(page.getByText("Overall score")).toBeVisible({ timeout: 45_000 });
    await expect(running(page)).toHaveCount(0);
    expect(net.count("POST", /\/research\//)).toBe(1);
    expect(net.count("GET", /\/research\/jobs\//)).toBeGreaterThan(0);

    // scorecard
    await expect(page.getByText("Overall confidence")).toBeVisible();
    await expect(page.getByText(/Confidence reflects how much evidence was available and how recent it is/)).toBeVisible();
    await expect(page.getByText(/Coverage factor 1.00: 3 of 3 dimensions had evidence/)).toBeVisible();
    for (const t of ["Fundamentals", "News sentiment", "Alternative / ownership signals"]) await expect(page.getByText(t, { exact: true })).toBeVisible();
    const { overall, dims } = await readScores(page);
    const scores = Object.values(dims).map((d) => d.score!);
    expect(scores).toHaveLength(3);
    for (const s of [overall, ...scores]) { expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(100); }
    expect(Math.abs(overall - scores.reduce((a, b) => a + b, 0) / 3)).toBeLessThanOrEqual(0.15);
    await expect(page.getByText(/\d+(\.\d)? \/ 100/).first()).toBeVisible();

    // criteria are inspectable
    const fundamentals = page.getByRole("table", { name: "Fundamentals rubric inputs" });
    await expect(fundamentals.getByRole("row")).toHaveCount(6); // header + 5 criteria
    await expect(fundamentals.getByRole("rowheader", { name: "Revenue growth (YoY)" })).toBeVisible();
    await expect(fundamentals.getByText(/Sales 1,120 in Jun 2026 vs 1,080 in Jun 2025/)).toBeVisible();

    // sources: numbered, external links are safe, citation anchors resolve to a listed source
    const sources = page.locator("ol > li[id^='research-source-']");
    expect(await sources.count()).toBeGreaterThanOrEqual(3);
    const ext = sources.locator("a");
    for (let i = 0; i < await ext.count(); i++) {
      await expect(ext.nth(i)).toHaveAttribute("href", /^https?:\/\//);
      await expect(ext.nth(i)).toHaveAttribute("rel", /noopener/);
    }
    const cite = page.locator("a[href^='#research-source-']").first();
    const href = await cite.getAttribute("href");
    await expect(page.locator(href!)).toHaveCount(1);
    await expect(page.getByText(/Informational only|not investment advice/i).first()).toBeVisible();
    await shot(page, "research-result", testInfo);

    // saved: survives a reload without any new POST
    await page.reload();
    await openResearch(page);
    await expect(page.getByText("Overall score")).toBeVisible();
    expect(net.count("POST", /\/research\//)).toBe(1);
    await expect(page.getByRole("button", { name: "Regenerate research" })).toBeEnabled();
  });

  test("reloading mid-run resumes the running job via /research/active (no second job)", async ({ page, net }) => {
    await signedIn(page);
    const id = await companyId(page.request, SYMS.ok2);
    await page.goto(`/company/${id}`);
    await openResearch(page);
    await page.getByRole("button", { name: "Generate research" }).click();
    await expect(running(page)).toBeVisible();

    await page.reload();
    await openResearch(page);
    await expect(running(page)).toBeVisible();
    expect(net.count("GET", /\/research\/active\?company_id=/)).toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("button", { name: /Generate research|Regenerate research/ })).toBeDisabled();
    await expect(page.getByText("Overall score")).toBeVisible({ timeout: 45_000 });
    expect(net.count("POST", /\/research\//), "reload must not start another job").toBe(1);
    const active = net.find("GET", /\/research\/active\?company_id=/);
    expect(active[0].status, "first lookup, before any job exists").toBe(404);
    expect(active.at(-1)!.status, "lookup after the reload finds the running job").toBe(200);
  });

  test("provider quota (SYNTHBETA): partial report, limitation visible, overall computed from available dimensions only", async ({ page }, testInfo) => {
    await signedIn(page);
    const id = await companyId(page.request, SYMS.quota);
    await page.goto(`/company/${id}`);
    await openResearch(page);
    await page.getByRole("button", { name: "Generate research" }).click();
    await expect(page.getByText("Overall score")).toBeVisible({ timeout: 45_000 });

    await expect(page.getByText("Partial result: some analysis dimensions could not be completed.")).toBeVisible();
    const { overall, dims } = await readScores(page);
    expect(dims["Fundamentals"]).toEqual({ status: "Unavailable", score: null });
    expect(dims["Alternative / ownership signals"]).toEqual({ status: "Unavailable", score: null });
    expect(dims["News sentiment"].status).toBe("Analysed");
    expect(overall, "overall = the only available dimension (sentiment), not diluted by neutral placeholders").toBe(dims["News sentiment"].score);
    await expect(page.getByText(/1 of 3 dimensions had evidence \(missing ones are excluded from the score, not treated as neutral\)/)).toBeVisible();
    await expect(page.getByText(/Financial data refresh failed \(quota\)/)).toBeVisible();
    await expect(page.getByText(/Only 0 of 5 fundamental criteria could be computed/)).toBeVisible();
    await expect(page.getByText("N/A").first()).toBeVisible();
    await shot(page, "research-partial", testInfo);
  });
});
