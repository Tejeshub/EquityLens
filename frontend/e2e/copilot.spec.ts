import { test, expect, companyId, signedIn, SYMS, shot } from "./support/fixtures";
import type { Page } from "@playwright/test";

async function openAsk(page: Page, symbol: string = SYMS.ok) {
  await signedIn(page);
  await page.goto(`/company/${await companyId(page.request, symbol)}`);
  await page.getByRole("tab", { name: "Ask" }).click();
}
const ask = async (page: Page, q: string) => {
  await page.getByLabel("Your question").fill(q);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
};

test.describe("Copilot", () => {
  test("a document-grounded question renders the answer with its citation and source link", async ({ page, net }, testInfo) => {
    await openAsk(page);
    await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeDisabled(); // empty question
    await ask(page, "What are the quarterly sales and net profit?");
    await expect(page.getByText("Synthetic answer based on the stored sources [1].")).toBeVisible();
    await expect(page.getByText("Not document-grounded.")).toHaveCount(0);
    await expect(page.getByText(/\d+ document passage\(s\) retrieved\./)).toBeVisible();
    const cite = page.getByRole("listitem").filter({ hasText: "[1]" }).filter({ hasText: "Screener.in consolidated quarterly results" });
    await expect(cite).toBeVisible();
    await expect(cite.getByRole("link", { name: "Screener.in consolidated quarterly results" })).toHaveAttribute("href", /^https:\/\/www\.screener\.in\//);
    await expect(cite.getByRole("link")).toHaveAttribute("rel", /noopener/);
    await expect(cite).toContainText("Sales:");
    expect(net.count("POST", /\/api\/v1\/ask$/)).toBe(1);
    await shot(page, "copilot-answer", testInfo);
  });

  test("a news-grounded question cites a news article", async ({ page }) => {
    await openAsk(page);
    await ask(page, "synthetic headline commentary");
    await expect(page.getByText("Synthetic answer based on the stored sources [1].")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: /Synthetic headline \d/ }).first()).toBeVisible();
  });

  test("FAIL_PROVIDER: a clear error state, no fabricated answer, no citations", async ({ page, allow, net }) => {
    allow.httpStatus(503, /\/api\/v1\/ask$/);
    await openAsk(page);
    await ask(page, "FAIL_PROVIDER sales profit");
    await expect(page.getByText("Could not get an answer")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Could not get an answer" })).toContainText(/no answer was generated/i);
    await expect(page.getByText(/Synthetic answer/)).toHaveCount(0);
    await expect(page.getByText(/document passage\(s\) retrieved/)).toHaveCount(0);
    await expect(page.getByRole("list").filter({ hasText: "[1]" })).toHaveCount(0);
    expect(net.find("POST", /\/api\/v1\/ask$/)[0].status).toBe(503);
    // the form is usable again afterwards
    await ask(page, "What are the quarterly sales and net profit?");
    await expect(page.getByText("Synthetic answer based on the stored sources [1].")).toBeVisible();
    await expect(page.getByText("Could not get an answer")).toHaveCount(0);
  });

  test("gibberish: flagged as not document-grounded, zero passages, no sources listed", async ({ page }) => {
    await openAsk(page);
    await ask(page, "xqzvwk plorbf");
    await expect(page.getByText("Not document-grounded.")).toBeVisible();
    await expect(page.getByText(/No matching source excerpts were retrieved/)).toBeVisible();
    await expect(page.getByText("0 document passage(s) retrieved.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "[1]" })).toHaveCount(0);
  });

  test("question length is bounded in the UI (500) and the counter tracks it", async ({ page }) => {
    await openAsk(page);
    await page.getByLabel("Your question").fill("q".repeat(600));
    await expect(page.getByText("500/500")).toBeVisible();
  });
});
