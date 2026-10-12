import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "../..");
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const script = join(root, "scripts/check-vercel-config.mjs");

describe("vercel.json", () => {
  const headers: Record<string, string> = Object.fromEntries(
    vercel.headers.find((h: { source: string }) => h.source === "/(.*)").headers.map((h: { key: string; value: string }) => [h.key, h.value]),
  );
  it("sets security headers for every route", () => {
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
  });
  it("has a strict CSP without unsafe-eval or remote origins", () => {
    const csp = headers["Content-Security-Policy"];
    for (const d of ["default-src 'self'", "script-src 'self'", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'", "img-src 'self' data:"]) expect(csp).toContain(d);
    expect(csp).not.toMatch(/unsafe-eval|https?:/);
  });
  it("index.html needs no inline script (script-src 'self')", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<style/);
  });
  it("index.html makes no unbackable claims", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).not.toMatch(/institutional-grade|multi-agent|confidence scoring/i);
  });
});

describe("check-vercel-config script", () => {
  const run = (content: string, args: string[] = [], env: Record<string, string> = {}) => {
    const dir = mkdtempSync(join(tmpdir(), "vc-"));
    const file = join(dir, "vercel.json");
    writeFileSync(file, content);
    const cleanEnv = { ...process.env, ...env, VERCEL_CONFIG_PATH: file } as Record<string, string | undefined>;
    if (!("VERCEL" in env)) delete cleanEnv.VERCEL;
    return spawnSync(process.execPath, [script, ...args], { env: cleanEnv as NodeJS.ProcessEnv, encoding: "utf8" });
  };
  const placeholder = '{"rewrites":[{"destination":"RENDER_BACKEND_URL/api"}]}';
  it("is a no-op locally even with the placeholder", () => expect(run(placeholder).status).toBe(0));
  it("fails on Vercel while the placeholder remains", () => {
    const r = run(placeholder, [], { VERCEL: "1" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/RENDER_BACKEND_URL/);
  });
  it("fails with --strict while the placeholder remains", () => expect(run(placeholder, ["--strict"]).status).toBe(1));
  it("passes on Vercel once replaced", () => expect(run('{"rewrites":[{"destination":"https://api.example.com/api"}]}', ["--strict"], { VERCEL: "1" }).status).toBe(0));
});
