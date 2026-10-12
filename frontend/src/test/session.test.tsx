import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import Navbar from "@/components/Navbar";
import { Toaster } from "@/components/ui/toaster";
import { authErrorMessage } from "@/components/AuthForm";
import { ApiError } from "@/services/api";
import { ME, jsonResponse, meRoute, mockFetch, renderWithProviders, route } from "./helpers";

beforeEach(() => { document.cookie = "el_csrf=tok-9; path=/"; });
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  document.cookie = "el_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

const err = (status: number, code: string | null = null, fields: Record<string, string> = {}) => new ApiError({ status, code, message: `msg-${status}`, fields });

describe("auth error mapping", () => {
  it("'Invalid email or password' only for 401", () => {
    expect(authErrorMessage(err(401), "login")).toBe("Invalid email or password.");
    for (const e of [err(403), err(500), err(503), err(0, "network"), err(200, "invalid_response"), err(404)]) {
      expect(authErrorMessage(e, "login")).not.toMatch(/invalid email or password/i);
    }
  });
  it("403, 5xx, network and invalid_response get accurate messages", () => {
    expect(authErrorMessage(err(403), "login")).toMatch(/refused/i);
    expect(authErrorMessage(err(502), "login")).toMatch(/server had a problem/i);
    expect(authErrorMessage(err(0, "network"), "login")).toBe("msg-0");
    expect(authErrorMessage(err(200, "invalid_response"), "login")).toBe("msg-200");
    expect(authErrorMessage(err(429, "rate_limited"), "login")).toBe("msg-429");
  });
  it("422 email shows a clean ASCII message without pydantic text", () => {
    const m = authErrorMessage(err(422, "validation_error", { email: "invalid email address" }), "register");
    expect(m).toMatch(/ASCII/);
    expect(m).not.toMatch(/Value error/);
  });
});

describe("auth form behaviour", () => {
  const fill = (email: string, pw: string) => {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: pw } });
  };
  const unauth = route("GET", "/auth/me", () => jsonResponse(401, { detail: "Not authenticated" }));

  it("a 500 on login is not reported as bad credentials", async () => {
    mockFetch(unauth, route("POST", "/auth/login", () => jsonResponse(500, { detail: "boom" })));
    renderWithProviders(<LoginPage />, { path: "/login" });
    fill("me@example.com", "long-enough-pw");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/server had a problem/i);
  });

  it("a non-ASCII email is rejected client-side with a clear message and no request", async () => {
    const { calls } = mockFetch(unauth);
    renderWithProviders(<RegisterPage />, { path: "/register" });
    fill("josé@example.com", "long-enough-pw");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/ASCII/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname === "/auth/register")).toBe(false);
  });

  it("a server 422 for the email shows the cleaned message", async () => {
    mockFetch(unauth, route("POST", "/auth/register", () => jsonResponse(422, { detail: [{ loc: ["body", "email"], msg: "Value error, invalid email address" }] })));
    renderWithProviders(<RegisterPage />, { path: "/register" });
    fill("zero@example.com", "long-enough-pw");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    const a = await screen.findByRole("alert");
    expect(a).toHaveTextContent(/ASCII/);
    expect(a).not.toHaveTextContent("Value error");
  });
});

describe("session check failure", () => {
  it("a network/5xx failure of /auth/me shows a retry screen, not the login page", async () => {
    let n = 0;
    mockFetch(route("GET", "/auth/me", () => (n++ === 0 ? jsonResponse(503, { detail: "down" }) : jsonResponse(200, ME))));
    renderWithProviders(<div>SECRET</div>, { path: "/watchlists", routePath: "/watchlists", guarded: true });
    expect(await screen.findByText(/could not check your session/i)).toBeInTheDocument();
    expect(screen.queryByText("LOGIN PAGE")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/watchlists");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("SECRET")).toBeInTheDocument();
  });

  it("an unreachable server also gives the retry screen", async () => {
    mockFetch(); // every fetch throws -> network ApiError
    renderWithProviders(<div>SECRET</div>, { path: "/", routePath: "/", guarded: true });
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("logout", () => {
  const renderNav = () => renderWithProviders(<><Navbar /><Toaster /></>, { path: "/watchlists", guarded: true, routePath: "*" });
  const openMenu = async () => fireEvent.click(await screen.findByRole("button", { name: /Account menu/ }));

  it("sends the CSRF header, clears the session and navigates to /login", async () => {
    const { calls } = mockFetch(meRoute, route("POST", "/auth/logout", () => jsonResponse(204)));
    renderNav();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
    await waitFor(() => expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument());
    const call = calls.find((c) => c.url.pathname === "/auth/logout")!;
    expect((call.init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("tok-9");
  });

  it("'Sign out everywhere' calls logout-all with CSRF", async () => {
    const { calls } = mockFetch(meRoute, route("POST", "/auth/logout-all", () => jsonResponse(204)));
    renderNav();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out everywhere" }));
    await waitFor(() => expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument());
    expect((calls.find((c) => c.url.pathname === "/auth/logout-all")!.init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("tok-9");
  });

  it("a failed logout keeps the user signed in and shows a toast", async () => {
    mockFetch(meRoute, route("POST", "/auth/logout", () => jsonResponse(403, { detail: "CSRF token missing or invalid" })));
    renderNav();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(await screen.findByText("Could not sign you out")).toBeInTheDocument();
    expect(screen.queryByText("LOGIN PAGE")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Account menu/ })).toBeInTheDocument();
  });
});

describe("Navbar responsiveness and landmarks", () => {
  it("nav links keep accessible names while labels are hidden below sm; email is hidden below md", async () => {
    mockFetch(meRoute);
    renderWithProviders(<Navbar />);
    const discover = await screen.findByRole("link", { name: "Discover" });
    expect(discover).toHaveAttribute("aria-label", "Discover");
    expect(discover.querySelector("span")!.className).toMatch(/hidden sm:inline/);
    const menuBtn = await screen.findByRole("button", { name: /Account menu for me@example.com/ });
    expect(menuBtn.querySelector("span")!.className).toMatch(/hidden md:inline/);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
