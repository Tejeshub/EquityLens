import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import SearchBar, { SEARCH_MAX_LEN, SECTOR_MAX_LEN } from "@/components/SearchBar";
import { COMPANY, jsonResponse, mockFetch, renderWithProviders, route } from "./helpers";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const items = [COMPANY, { ...COMPANY, id: "c-2", name: "Beta Ltd", primary_symbol: "BETA" }, { ...COMPANY, id: "c-3", name: "Gamma Ltd", primary_symbol: "GAMA" }];
const setup = async () => {
  mockFetch(route("GET", "/api/v1/companies/search", () => jsonResponse(200, { items, total: 3, limit: 10, offset: 0, source: "db" })));
  const r = renderWithProviders(<SearchBar />, { withAuth: false });
  const input = screen.getByRole("combobox", { name: "Search companies" });
  fireEvent.change(input, { target: { value: "a" } });
  await screen.findByRole("listbox");
  return { input, ...r };
};
const key = (el: HTMLElement, k: string) => fireEvent.keyDown(el, { key: k });
const activeId = (input: HTMLElement) => input.getAttribute("aria-activedescendant");

describe("SearchBar combobox (ARIA 1.2)", () => {
  it("exposes combobox semantics, options with ids, and announces the result count", async () => {
    const { input } = await setup();
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("listbox");
    expect(input).toHaveAttribute("aria-controls", list.id);
    const opts = screen.getAllByRole("option");
    expect(opts).toHaveLength(3);
    opts.forEach((o) => expect(o.id).toBeTruthy());
    expect(screen.getByText("3 results", { selector: "[role=status]" })).toBeInTheDocument();
  });

  it("ArrowDown/ArrowUp move the active option (wrapping) via aria-activedescendant", async () => {
    const { input } = await setup();
    const opts = screen.getAllByRole("option");
    expect(activeId(input)).toBeNull();
    key(input, "ArrowDown");
    expect(activeId(input)).toBe(opts[0].id);
    expect(opts[0]).toHaveAttribute("aria-selected", "true");
    key(input, "ArrowDown"); key(input, "ArrowDown");
    expect(activeId(input)).toBe(opts[2].id);
    key(input, "ArrowDown");
    expect(activeId(input)).toBe(opts[0].id);
    key(input, "ArrowUp");
    expect(activeId(input)).toBe(opts[2].id);
  });

  it("Home and End jump to the first and last option", async () => {
    const { input } = await setup();
    const opts = screen.getAllByRole("option");
    key(input, "End");
    expect(activeId(input)).toBe(opts[2].id);
    key(input, "Home");
    expect(activeId(input)).toBe(opts[0].id);
  });

  it("Enter opens the active option; Enter with none active does nothing", async () => {
    const { input } = await setup();
    key(input, "Enter");
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
    key(input, "ArrowDown"); key(input, "ArrowDown");
    key(input, "Enter");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/company/c-2"));
  });

  it("Escape closes the popup first, then clears the query", async () => {
    const { input } = await setup();
    key(input, "Escape");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("a");
    key(input, "Escape");
    expect(input).toHaveValue("");
  });

  it("clear button is type=button, clears, and returns focus to the input", async () => {
    const { input } = await setup();
    const clear = screen.getByRole("button", { name: "Clear search" });
    expect(clear).toHaveAttribute("type", "button");
    clear.focus();
    fireEvent.click(clear);
    expect(input).toHaveValue("");
    expect(document.activeElement).toBe(input);
  });

  it("limits input lengths (60 for query, 120 for sector)", async () => {
    const { input } = await setup();
    expect(input).toHaveAttribute("maxlength", String(SEARCH_MAX_LEN));
    expect(SEARCH_MAX_LEN).toBe(60);
    fireEvent.click(await screen.findByLabelText("Toggle filters"));
    expect(screen.getByLabelText(/Sector/)).toHaveAttribute("maxlength", String(SECTOR_MAX_LEN));
    expect(SECTOR_MAX_LEN).toBe(120);
  });

  it("announces 'No results' for an empty result set", async () => {
    mockFetch(route("GET", "/api/v1/companies/search", () => jsonResponse(200, { items: [], total: 0, limit: 10, offset: 0, source: "db" })));
    renderWithProviders(<SearchBar />, { withAuth: false });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    await screen.findByText("No companies found");
    expect(screen.getByText("No results", { selector: "[role=status]" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
  });
});
