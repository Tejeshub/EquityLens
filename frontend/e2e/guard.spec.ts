import { test, expect } from "./support/fixtures";

/**
 * Meta-tests: the shared guard fixture must fail a test on page errors, console errors, 5xx and failed requests.
 * `test.fail()` makes each of these pass only if the guard really raised.
 */
test.describe("guard fixture catches app problems", () => {
  test("uncaught exception", async ({ page }) => {
    test.fail();
    await page.goto("/login");
    await page.evaluate(() => { setTimeout(() => { throw new Error("boom from test"); }, 0); });
    await expect.poll(() => page.evaluate(() => true)).toBe(true);
    await page.waitForFunction(() => new Promise<boolean>((r) => setTimeout(() => r(true), 50)));
  });

  test("console.error", async ({ page }) => {
    test.fail();
    await page.goto("/login");
    await page.evaluate(() => console.error("provoked console error"));
  });

  test("HTTP 5xx from the backend", async ({ page }) => {
    test.fail();
    await page.route("**/api/v1/capabilities", (r) => r.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await page.goto("/login");
    await page.evaluate(() => fetch("/api/v1/capabilities"));
  });

  test("failed request", async ({ page }) => {
    test.fail();
    await page.route("**/api/v1/capabilities", (r) => r.abort("connectionrefused"));
    await page.goto("/login");
    await page.evaluate(() => fetch("/api/v1/capabilities").catch(() => undefined));
  });

  test("an allow-listed provoked failure does not fail the test", async ({ page, allow }) => {
    allow.httpStatus(503, /capabilities/);
    allow.consoleError(/provoked/);
    await page.route("**/api/v1/capabilities", (r) => r.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
    await page.goto("/login");
    await page.evaluate(() => { console.error("provoked once"); return fetch("/api/v1/capabilities"); });
  });
});
