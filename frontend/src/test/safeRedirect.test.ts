import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safeRedirect";

describe("safeNextPath", () => {
  it("allows same-origin relative paths", () => {
    expect(safeNextPath("/company/abc?x=1")).toBe("/company/abc?x=1");
    expect(safeNextPath("/watchlists")).toBe("/watchlists");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil.com", "", "/login", "/a\nb"])("rejects %j", (v) => {
    expect(safeNextPath(v)).toBe("/");
  });
  it("handles null/undefined", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined, "/x")).toBe("/x");
  });
});
