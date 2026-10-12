import { readFileSync } from "node:fs";
import { test, expect, PROD_BUILD, signedIn } from "./support/fixtures";

/**
 * Production-build mode only (npm run e2e:prod): the app is served by `vite preview` with the headers defined in vercel.json
 * (vite.config.ts reads them from there), so this proves the real build works under that Content-Security-Policy and that the
 * headers are actually sent. CSP violations in every other spec are caught by the guard fixture (securitypolicyviolation
 * listener + console errors).
 */
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const expected: Record<string, string> = {};
for (const rule of vercel.headers) if (rule.source === "/(.*)") for (const h of rule.headers) expected[h.key.toLowerCase()] = h.value;

test.describe("production build: security headers and CSP", () => {
  test.skip(!PROD_BUILD, "needs E2E_BUILD=1 (npm run e2e:prod): the dev server does not serve vercel.json's headers");

  test("vercel.json defines the expected header set", () => {
    for (const k of ["content-security-policy", "strict-transport-security", "x-content-type-options", "referrer-policy", "x-frame-options", "permissions-policy"]) {
      expect(expected[k], k).toBeTruthy();
    }
    const csp = expected["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("document and SPA deep-link responses carry every vercel.json header", async ({ page }) => {
    for (const url of ["/", "/login", "/company/does-not-matter"]) {
      const res = await page.goto(url);
      expect(res!.status(), url).toBe(200);
      const got = res!.headers();
      for (const [k, v] of Object.entries(expected)) {
        // HSTS is only honoured by browsers over https; this suite serves http on localhost, so Chrome ignores it. It is
        // still SENT by the preview server (same header set as Vercel), which is what is asserted here.
        expect(got[k], `${k} on ${url}`).toBe(v);
      }
    }
  });

  test("built assets are served with the headers too and the HTML has no inline script", async ({ page }) => {
    const res = await page.goto("/");
    const html = await res!.text();
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[^<]/i); // every <script> has a src
    expect(html).not.toMatch(/\son[a-z]+=/i); // no inline event handlers
    const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    expect(asset, "built JS bundle referenced from index.html").toBeTruthy();
    const js = await page.request.get(asset!);
    expect(js.status()).toBe(200);
    expect(js.headers()["x-content-type-options"]).toBe("nosniff");
    expect(js.headers()["content-security-policy"]).toBe(expected["content-security-policy"]);
  });

  test("a signed-in session works under the CSP: the browser enforces the policy (cross-origin connect and inline script blocked)", async ({ page, allow }) => {
    allow.consoleError(/CSP-VIOLATION|violates the (following|document.s) Content Security Policy/);
    allow.failedRequest(/example\.invalid/);
    await signedIn(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Source-linked equity research");
    // The policy is actually enforced by the browser: a cross-origin connect and an inline script are blocked. Each probe
    // produces a CSP violation that the guard would otherwise fail on, so they are collected here and allowed explicitly.
    const violations = await page.evaluate(() => new Promise<string[]>((resolve) => {
      const seen: string[] = [];
      document.addEventListener("securitypolicyviolation", (e) => seen.push(e.violatedDirective));
      fetch("http://example.invalid/x").catch(() => undefined);
      const s = document.createElement("script"); s.textContent = "window.__csp_inline_ran = true"; document.head.appendChild(s);
      setTimeout(() => resolve(seen), 300);
    }));
    expect(violations.some((d) => d.startsWith("connect-src"))).toBe(true);
    expect(violations.some((d) => d.startsWith("script-src"))).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __csp_inline_ran?: boolean }).__csp_inline_ran)).toBeUndefined();
  });
});
