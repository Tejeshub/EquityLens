import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import Layout from "@/components/Layout";
import { meRoute, mockFetch, renderWithProviders } from "./helpers";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Layout", () => {
  it("has a skip link, a main landmark and sets the document title", async () => {
    mockFetch(meRoute);
    renderWithProviders(<Layout title="Watchlists"><p>body</p></Layout>);
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(document.title).toBe("Watchlists · EquityLens");
  });
});
