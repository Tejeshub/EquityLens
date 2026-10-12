import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import SearchBar from "@/components/SearchBar";
import { COMPANY, jsonResponse, mockFetch, renderWithProviders, route } from "./helpers";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const searchOf = (calls: { url: URL }[]) => calls.filter((c) => c.url.pathname === "/api/v1/companies/search");
const type = (v: string) => act(() => { fireEvent.change(screen.getByLabelText("Search companies"), { target: { value: v } }); });
const page = (items: unknown[]) => ({ items, total: items.length, limit: 10, offset: 0, source: "db" });

describe("SearchBar", () => {
  it("debounces: rapid typing issues one request with the final query", async () => {
    const { calls } = mockFetch(route("GET", "/api/v1/companies/search", () => jsonResponse(200, page([COMPANY]))));
    renderWithProviders(<SearchBar />, { withAuth: false });
    type("a"); type("ac"); type("acm");
    expect(searchOf(calls)).toHaveLength(0);
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    expect(searchOf(calls)).toHaveLength(0); // still inside the 300ms window
    expect(await screen.findByText("Acme Chemicals Ltd")).toBeInTheDocument();
    expect(searchOf(calls)).toHaveLength(1);
    expect(searchOf(calls)[0].url.searchParams.get("q")).toBe("acm");
    expect(screen.getByText(/ACME · NSE · Chemicals/)).toBeInTheDocument();
  });

  it("aborts the stale in-flight request when the query changes", async () => {
    const signals: AbortSignal[] = [];
    mockFetch(route("GET", "/api/v1/companies/search", (url, init) => {
      const q = url.searchParams.get("q");
      if (q === "first") {
        signals.push(init.signal as AbortSignal);
        return new Promise<Response>((_r, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("a", "AbortError"))));
      }
      return jsonResponse(200, page([COMPANY]));
    }));
    renderWithProviders(<SearchBar />, { withAuth: false });
    type("first");
    await waitFor(() => expect(signals).toHaveLength(1), { timeout: 1500 });
    expect(signals[0].aborted).toBe(false);
    type("second");
    await waitFor(() => expect(signals[0].aborted).toBe(true), { timeout: 1500 });
    expect(await screen.findByText("Acme Chemicals Ltd")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    mockFetch(route("GET", "/api/v1/companies/search", () => jsonResponse(200, page([]))));
    renderWithProviders(<SearchBar />, { withAuth: false });
    type("zzz");
    expect(await screen.findByText("No companies found")).toBeInTheDocument();
  });

  it("shows an error state with retry", async () => {
    mockFetch(route("GET", "/api/v1/companies/search", () => jsonResponse(503, { detail: { code: "db_down", message: "Search is down" } })));
    renderWithProviders(<SearchBar />, { withAuth: false });
    type("acme");
    expect(await screen.findByText("Search is down")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("does not search for an empty query without filters", async () => {
    const { calls } = mockFetch(route("GET", "/api/v1/companies/search", () => jsonResponse(200, page([]))));
    renderWithProviders(<SearchBar />, { withAuth: false });
    type("  ");
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(searchOf(calls)).toHaveLength(0);
  });

  it("allows an empty query when a segment filter is chosen", async () => {
    const { calls } = mockFetch(route("GET", "/api/v1/companies/search", () => jsonResponse(200, page([COMPANY]))));
    renderWithProviders(<SearchBar />, { withAuth: false });
    fireEvent.click(await screen.findByLabelText("Toggle filters"));
    fireEvent.click(screen.getByRole("button", { name: "Mid Cap" }));
    await waitFor(() => expect(searchOf(calls)).toHaveLength(1));
    expect(searchOf(calls)[0].url.searchParams.get("segment")).toBe("mid");
    expect(searchOf(calls)[0].url.searchParams.has("q")).toBe(false);
  });
});
