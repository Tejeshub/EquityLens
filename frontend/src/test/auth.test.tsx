import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import Index from "@/pages/Index";
import { ME, jsonResponse, meRoute, mockFetch, renderWithProviders, route } from "./helpers";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const unauth = route("GET", "/auth/me", () => jsonResponse(401, { detail: "Not authenticated" }));
const fill = (email: string, pw: string) => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: pw } });
};

describe("login form", () => {
  it("shows inline validation and does not call the API", async () => {
    const { calls } = mockFetch(unauth);
    renderWithProviders(<LoginPage />, { path: "/login" });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname === "/auth/login")).toBe(false);
  });

  it("submits once (disabled while pending), then redirects to a safe next path", async () => {
    let resolveLogin: (r: Response) => void = () => {};
    const { calls } = mockFetch(
      unauth,
      route("POST", "/auth/login", () => new Promise<Response>((r) => { resolveLogin = r; })),
    );
    renderWithProviders(<LoginPage />, { path: "/login?next=%2Fwatchlists" });
    fill("me@example.com", "correct-horse");
    const btn = screen.getByRole("button", { name: "Sign in" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByRole("button", { name: /please wait/i })).toBeDisabled());
    expect(calls.filter((c) => c.url.pathname === "/auth/login")).toHaveLength(1);
    resolveLogin(jsonResponse(200, ME));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/watchlists"));
  });

  it("ignores an off-site next param", async () => {
    mockFetch(meRoute);
    renderWithProviders(<LoginPage />, { path: "/login?next=https%3A%2F%2Fevil.com" });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/));
  });

  it("shows a generic error on bad credentials", async () => {
    mockFetch(unauth, route("POST", "/auth/login", () => jsonResponse(401, { detail: "No such user foo" })));
    renderWithProviders(<LoginPage />, { path: "/login" });
    fill("me@example.com", "wrong-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid email or password.");
    expect(alert).not.toHaveTextContent("foo");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("shows try-again-later on 429", async () => {
    mockFetch(unauth, route("POST", "/auth/login", () => jsonResponse(429, { detail: "x" }, { "Retry-After": "30" })));
    renderWithProviders(<LoginPage />, { path: "/login" });
    fill("me@example.com", "whatever-long");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/try again later/i);
  });
});

describe("register form", () => {
  it("enforces the 10 character minimum client-side", async () => {
    const { calls } = mockFetch(unauth);
    renderWithProviders(<RegisterPage />, { path: "/register" });
    fill("new@example.com", "short");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/at least 10 characters\./i, { selector: "p[id]" })).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname === "/auth/register")).toBe(false);
  });

  it("registers and uses the session the register call set (no follow-up login)", async () => {
    const { calls } = mockFetch(
      unauth,
      route("POST", "/auth/register", () => jsonResponse(201, ME)),
    );
    renderWithProviders(<RegisterPage />, { path: "/register" });
    fill("me@example.com", "long-enough-pw");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/));
    expect(calls.map((c) => c.url.pathname)).toContain("/auth/register");
    expect(calls.some((c) => c.url.pathname === "/auth/login")).toBe(false);
  });

  it("shows a generic error on failure", async () => {
    mockFetch(unauth, route("POST", "/auth/register", () => jsonResponse(409, { detail: "email exists" })));
    renderWithProviders(<RegisterPage />, { path: "/register" });
    fill("me@example.com", "long-enough-pw");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent("exists");
  });
});

describe("route guard", () => {
  it("redirects unauthenticated users to /login with a safe next param", async () => {
    mockFetch(unauth);
    renderWithProviders(<div>SECRET</div>, { path: "/watchlists?tab=1", routePath: "/watchlists", guarded: true });
    await waitFor(() => expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument());
    expect(screen.queryByText("SECRET")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/login?next=%2Fwatchlists%3Ftab%3D1");
  });

  it("renders protected content when authenticated", async () => {
    mockFetch(meRoute);
    renderWithProviders(<div>SECRET</div>, { path: "/watchlists", routePath: "/watchlists", guarded: true });
    expect(await screen.findByText("SECRET")).toBeInTheDocument();
  });

  it("redirects to login when a later API call returns 401", async () => {
    mockFetch(meRoute, route("GET", "/api/v1/market/movers", () => jsonResponse(401, { detail: "Not authenticated" })));
    renderWithProviders(<Index />, { path: "/", routePath: "/", guarded: true });
    await waitFor(() => expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument());
  });
});
