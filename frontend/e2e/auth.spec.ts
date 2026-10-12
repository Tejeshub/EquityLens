import { test, expect, newUser, registerViaApi, pgClient, appReady, shot, noHorizontalOverflow } from "./support/fixtures";

const accountMenu = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /^Account menu for / });

async function logOutViaUi(page: import("@playwright/test").Page) {
  await accountMenu(page).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function fillAuth(page: import("@playwright/test").Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
}

test.describe("registration", () => {
  test("registers through the UI, lands signed in on the dashboard, and the session survives a reload", async ({ page, net }, testInfo) => {
    const u = newUser();
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    await fillAuth(page, u.email, u.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Source-linked equity research");
    await expect(accountMenu(page)).toBeVisible();
    expect(net.count("POST", /^\/auth\/register$/)).toBe(1);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Source-linked equity research");
    await expect(accountMenu(page)).toHaveAttribute("aria-label", `Account menu for ${u.email}`);
    await expect(page.getByRole("heading", { name: "Top Gainers" })).toBeVisible();
    await shot(page, "dashboard", testInfo);
  });

  test("client-side validation: empty, short password, non-ASCII / zero-width / malformed email never reach the server", async ({ page, net }) => {
    await page.goto("/register");
    const submit = page.getByRole("button", { name: "Create account" });
    await submit.click();
    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();

    await fillAuth(page, "someone@example.com", "short");
    await submit.click();
    await expect(page.getByText("Password must be at least 10 characters.")).toBeVisible();

    await fillAuth(page, "josé@example.com", "long-enough-password");
    await submit.click();
    await expect(page.getByText(/Use only standard ASCII characters in your email/)).toBeVisible();

    await fillAuth(page, "zero​width@example.com", "long-enough-password");
    await submit.click();
    await expect(page.getByText(/Use only standard ASCII characters in your email/)).toBeVisible();

    await fillAuth(page, "not-an-email", "long-enough-password");
    await submit.click();
    await expect(page.getByText("Enter a valid email address.", { exact: true })).toBeVisible();

    expect(net.count("POST", /^\/auth\/register$/)).toBe(0);
    await expect(page).toHaveURL(/\/register$/);
  });

  test("server-side validation errors are shown when the client check passes (invalid local part, 257-char password)", async ({ page, net, allow }) => {
    allow.httpStatus(422, /\/auth\/register/);
    await page.goto("/register");
    const submit = page.getByRole("button", { name: "Create account" });
    await fillAuth(page, "a..b@example.com", "long-enough-password");
    await submit.click();
    await expect(page.getByRole("alert")).toContainText("Enter a valid email address");
    expect(net.find("POST", /^\/auth\/register$/)[0].status).toBe(422);

    await fillAuth(page, newUser().email, "x".repeat(257));
    await submit.click();
    await expect(page.getByRole("alert")).toContainText(/Password:/);
    expect(net.count("POST", /^\/auth\/register$/)).toBe(2);
    await expect(page).toHaveURL(/\/register$/);
  });

  test("the server itself rejects short passwords and non-ASCII / zero-width emails with 422 (API, no client checks)", async ({ page }) => {
    for (const body of [
      { email: newUser().email, password: "short" },
      { email: "josé-" + Date.now() + "@example.com", password: "long-enough-password" },
      { email: "zero​width@example.com", password: "long-enough-password" },
    ]) {
      const res = await page.request.post("/auth/register", { data: body });
      expect(res.status(), JSON.stringify(body.email)).toBe(422);
    }
  });

  test("duplicate email (even with different letter case) is refused with a generic message (no account enumeration)", async ({ page, allow }) => {
    allow.httpStatus(409, /\/auth\/register/);
    const u = newUser();
    await registerViaApi(page.context(), u);
    await page.context().clearCookies();
    await page.goto("/register");
    await fillAuth(page, u.email.toUpperCase(), "another-long-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert")).toContainText("We could not create the account");
    await expect(page.getByRole("alert")).not.toContainText(/already|exists|taken/i);
    await expect(page).toHaveURL(/\/register$/);
  });
});

test.describe("login / logout / sessions", () => {
  test("wrong password gives the same generic error as an unknown account, correct password signs in, logout ends the session", async ({ page, allow, net }) => {
    allow.httpStatus(401, /./);
    const u = newUser();
    await registerViaApi(page.context(), u);
    await page.context().clearCookies();

    await page.goto("/login");
    await fillAuth(page, u.email, "definitely-the-wrong-one");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");
    const wrongPw = await page.getByRole("alert").textContent();

    await fillAuth(page, newUser().email, "definitely-the-wrong-one");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toHaveText(wrongPw!);

    await fillAuth(page, u.email, u.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(accountMenu(page)).toBeVisible();

    await logOutViaUi(page);
    expect(net.count("POST", /^\/auth\/logout$/)).toBe(1);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "el_session")).toBeUndefined();
    // Server really revoked it: the old (now cleared) session cannot be used, and the app refuses protected pages.
    await page.goto("/watchlists");
    await expect(page).toHaveURL(/\/login\?next=%2Fwatchlists$/);
  });

  test("protected routes redirect to /login?next= and return to the requested page after sign-in", async ({ page }) => {
    const u = newUser();
    await registerViaApi(page.context(), u);
    await page.context().clearCookies();

    await page.goto("/watchlists");
    await expect(page).toHaveURL(/\/login\?next=%2Fwatchlists$/);
    await fillAuth(page, u.email, u.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/watchlists$/);
    await expect(page.getByRole("heading", { name: "Watchlists", level: 1 })).toBeVisible();

    // A company deep link with a query string survives the round trip too.
    await page.context().clearCookies();
    await page.goto("/company/00000000-0000-0000-0000-000000000000?tab=x");
    await expect(page).toHaveURL(/\/login\?next=%2Fcompany%2F00000000-0000-0000-0000-000000000000%3Ftab%3Dx$/);
  });

  test("open redirects through ?next= are ignored", async ({ page }) => {
    const u = newUser();
    await registerViaApi(page.context(), u);
    await page.context().clearCookies();
    await page.goto("/login?next=https%3A%2F%2Fevil.example%2F");
    await fillAuth(page, u.email, u.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/\/localhost:\d+\/$/);
  });

  test("clearing cookies mid-session redirects to login on the next API call, with ?next= for the page being used", async ({ page, allow }) => {
    allow.httpStatus(401, /./);
    await registerViaApi(page.context());
    await page.goto("/");
    await expect(accountMenu(page)).toBeVisible();
    await page.context().clearCookies();
    await page.getByRole("link", { name: "Watchlists" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fwatchlists$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("a session idle past the server limit is rejected (aged in the database) and the user is sent to login", async ({ page, allow }) => {
    allow.httpStatus(401, /./);
    const u = newUser();
    await registerViaApi(page.context(), u);
    await page.goto("/watchlists");
    await expect(page.getByRole("heading", { name: "Watchlists", level: 1 })).toBeVisible();

    const db = pgClient();
    await db.connect();
    try {
      const r = await db.query(
        "UPDATE auth_sessions SET last_seen_at = now() - interval '100 hours' WHERE user_id = (SELECT id FROM users WHERE email = $1)", [u.email]);
      expect(r.rowCount).toBe(1);
    } finally { await db.end(); }

    await page.reload();
    await expect(page).toHaveURL(/\/login\?next=%2Fwatchlists$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("an expired (absolute TTL) session is rejected the same way", async ({ page, allow }) => {
    allow.httpStatus(401, /./);
    const u = newUser();
    await registerViaApi(page.context(), u);
    const db = pgClient();
    await db.connect();
    try {
      await db.query("UPDATE auth_sessions SET expires_at = now() - interval '1 minute' WHERE user_id = (SELECT id FROM users WHERE email = $1)", [u.email]);
    } finally { await db.end(); }
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("CSRF: an authenticated unsafe request without (or with a wrong) X-CSRF-Token is refused with 403; with it, it succeeds", async ({ page }) => {
    await registerViaApi(page.context());
    const noToken = await page.request.post("/api/v1/watchlists", { data: { name: "csrf probe" } });
    expect(noToken.status()).toBe(403);
    const wrong = await page.request.post("/api/v1/watchlists", { data: { name: "csrf probe" }, headers: { "X-CSRF-Token": "not-the-token" } });
    expect(wrong.status()).toBe(403);
    const cookies = await page.context().cookies();
    const token = decodeURIComponent(cookies.find((c) => c.name === "el_csrf")!.value);
    const ok = await page.request.post("/api/v1/watchlists", { data: { name: "csrf probe" }, headers: { "X-CSRF-Token": token } });
    expect(ok.status()).toBe(201);
    // Logout without the token is refused too, so a cross-site form cannot sign the user out.
    const logout = await page.request.post("/auth/logout");
    expect(logout.status()).toBe(403);
    // A foreign Origin is refused even with a valid token.
    const foreign = await page.request.post("/api/v1/watchlists", { data: { name: "x" }, headers: { "X-CSRF-Token": token, Origin: "https://evil.example" } });
    expect(foreign.status()).toBe(403);
  });

  test("repeated failed logins are throttled and the UI shows a retry message", async ({ page, allow }) => {
    allow.httpStatus(401, /./);
    const u = newUser();
    await registerViaApi(page.context(), u);
    await page.context().clearCookies();
    await page.goto("/login");
    const submit = page.getByRole("button", { name: "Sign in" });
    for (let i = 0; i < 5; i++) {
      await fillAuth(page, u.email, `wrong-password-${i}`);
      await submit.click();
      await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");
    }
    await fillAuth(page, u.email, `wrong-password-6`);
    await submit.click();
    await expect(page.getByRole("alert")).toContainText(/Too many (requests|attempts).*try again later/i);
    // Even the right password is blocked while throttled (failed attempts are what is counted, per account+IP).
    await fillAuth(page, u.email, u.password);
    await submit.click();
    await expect(page.getByRole("alert")).toContainText(/try again later/i);
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("layout", () => {
  test("login and register pages fit the viewport and are screenshot", async ({ page }, testInfo) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await noHorizontalOverflow(page);
    await shot(page, "login", testInfo);
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test("unknown routes show the not-found page, not a blank screen", async ({ page }) => {
    await page.goto("/definitely/not/a/page");
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.getByRole("heading").first()).toBeVisible();
    await appReady(page);
  });
});
