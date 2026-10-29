import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import Home from "@/pages/Home";
import { ME, jsonResponse, meRoute, mockFetch, renderWithProviders, route } from "./helpers";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const unauth = route("GET", "/auth/me", () => jsonResponse(401, { detail: "Not authenticated" }));

describe("landing page at /", () => {
  it("shows the landing page to a signed-out visitor, with Get Started and Sign in leading to the existing auth pages", async () => {
    mockFetch(unauth);
    renderWithProviders(<Home />, { path: "/", routePath: "/" });
    expect(await screen.findByRole("heading", { level: 1, name: /See the Market With a Clearer Lens/ })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Get Started" })).toHaveAttribute("href", "/register");
    expect(within(nav).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Explore Features" })).toHaveAttribute("href", "#features");
    expect(screen.getByRole("heading", { name: /Make Your Next Insight Count/ })).toBeInTheDocument();
  });

  it("labels every figure as sample data and makes no data requests", async () => {
    const { calls } = mockFetch(unauth);
    renderWithProviders(<Home />, { path: "/", routePath: "/" });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByText(/sample data|illustrative/i).length).toBeGreaterThan(0);
    // Only the session check; no capabilities, quotes, movers or news.
    expect(calls.map((c) => c.url.pathname)).toEqual(["/auth/me"]);
  });

  it("shows the existing dashboard (not the landing page) once signed in", async () => {
    mockFetch(meRoute);
    renderWithProviders(<Home />, { path: "/", routePath: "/" });
    expect(await screen.findByRole("button", { name: `Account menu for ${ME.email}` })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /See the Market With a Clearer Lens/ })).not.toBeInTheDocument();
  });

  it("keeps the retry screen when the session check fails, instead of the landing page", async () => {
    mockFetch(route("GET", "/auth/me", () => jsonResponse(503, { detail: "down" })));
    renderWithProviders(<Home />, { path: "/", routePath: "/" });
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows the Copilot demo as labelled sample content (finished state when motion is unavailable)", async () => {
    mockFetch(unauth);
    renderWithProviders(<Home />, { path: "/", routePath: "/" });
    const demo = await screen.findByRole("img", { name: /Illustrative sample: a question typed into the Copilot/ });
    expect(demo).toBeInTheDocument();
    expect(screen.getAllByText(/Sample answer/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Grounded in sample documents/)).toBeInTheDocument();
  });
});
