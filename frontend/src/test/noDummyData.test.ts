import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const productionFiles = walk(SRC).filter(
  (p) => /\.(ts|tsx)$/.test(p) && !p.includes(`${join(SRC, "test")}`) && !/\.(test|spec)\.(ts|tsx)$/.test(p),
);

describe("no mock data in production code", () => {
  it("scans a non-trivial set of files", () => {
    expect(productionFiles.length).toBeGreaterThan(20);
  });
  it("does not reference dummyData", () => {
    const offenders = productionFiles.filter((p) => /dummyData/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("has no src/data/dummyData file", () => {
    expect(walk(SRC).some((p) => /dummyData/.test(p))).toBe(false);
  });
  it("does not contain known fabricated UI strings", () => {
    const banned = [/Confidence:\s*82%/, /Q3 FY26/, /real-?time/i, /console\.log/];
    const offenders = productionFiles.flatMap((p) => {
      const text = readFileSync(p, "utf8");
      return banned.filter((re) => re.test(text)).map((re) => `${p}: ${re}`);
    });
    expect(offenders).toEqual([]);
  });
});
