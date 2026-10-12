import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, setUnauthorizedHandler } from "@/services/api";
import { jsonResponse, mockFetch, route } from "./helpers";

beforeEach(() => {
  document.cookie = "el_csrf=tok-123; path=/";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setUnauthorizedHandler(null);
  document.cookie = "el_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

describe("api client", () => {
  it("sends credentials:'include' and no CSRF header on GET", async () => {
    const { calls } = mockFetch(route("GET", "/auth/me", () => jsonResponse(200, { id: "1", email: "a@b.co" })));
    await api.auth.me();
    expect(calls[0].init.credentials).toBe("include");
    expect((calls[0].init.headers as Record<string, string>)["X-CSRF-Token"]).toBeUndefined();
  });

  it.each([
    ["POST", () => api.watchlists.create("x"), "/api/v1/watchlists", 201, { id: "w", name: "x", created_at: "t", items: [], max_items: 5 }],
    ["PATCH", () => api.watchlists.rename("w1", "y"), "/api/v1/watchlists/w1", 200, { id: "w1", name: "y", created_at: "t", items: [], max_items: 5 }],
    ["DELETE", () => api.watchlists.remove("w1"), "/api/v1/watchlists/w1", 204, undefined],
  ])("sends X-CSRF-Token from el_csrf on %s", async (method, call, path, status, body) => {
    const { calls } = mockFetch(route(method, path, () => jsonResponse(status as number, body)));
    await call();
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["X-CSRF-Token"]).toBe("tok-123");
    expect(calls[0].init.credentials).toBe("include");
  });

  it("treats 204 as success with no body", async () => {
    mockFetch(route("DELETE", "/api/v1/watchlists/w1", () => jsonResponse(204)));
    await expect(api.watchlists.remove("w1")).resolves.toBeUndefined();
  });

  it("calls the unauthorized handler on 401 and throws ApiError", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(route("GET", "/api/v1/watchlists", () => jsonResponse(401, { detail: "Not authenticated" })));
    await expect(api.watchlists.list()).rejects.toMatchObject({ status: 401, message: "Not authenticated" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not treat a failed login (401) as session expiry", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(route("POST", "/auth/login", () => jsonResponse(401, { detail: "Invalid credentials" })));
    await expect(api.auth.login("a@b.co", "pw")).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("maps {code,message} detail", async () => {
    mockFetch(route("GET", "/api/v1/companies/c-1/quote", () => jsonResponse(503, { detail: { code: "provider_unavailable", message: "Quotes down" } })));
    await expect(api.companies.quote("c-1")).rejects.toMatchObject({ status: 503, code: "provider_unavailable", message: "Quotes down" });
  });

  it("maps 422 validation list to a readable message", async () => {
    mockFetch(route("POST", "/auth/register", () => jsonResponse(422, { detail: [{ loc: ["body", "password"], msg: "too short", type: "x" }] })));
    await expect(api.auth.register("a@b.co", "short")).rejects.toMatchObject({ status: 422, code: "validation_error", message: "password: too short" });
  });

  it("maps 500 with request_id", async () => {
    mockFetch(route("GET", "/api/v1/watchlists", () => jsonResponse(500, { detail: "boom", request_id: "req-9" })));
    await expect(api.watchlists.list()).rejects.toMatchObject({ status: 500, requestId: "req-9" });
  });

  it("maps 429 with Retry-After", async () => {
    mockFetch(route("GET", "/api/v1/market/movers", () => jsonResponse(429, { detail: "slow down" }, { "Retry-After": "42" })));
    const err = (await api.market.movers("mid").catch((e) => e)) as ApiError;
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe(42);
    expect(err.message).toMatch(/try again later/i);
    expect(err.message).toContain("42");
  });

  it("rejects malformed responses for validated endpoints", async () => {
    mockFetch(route("GET", "/api/v1/companies/c-1/quote", () => jsonResponse(200, { price: "not-a-number" })));
    await expect(api.companies.quote("c-1")).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("maps network failure and timeout to ApiError status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
    await expect(api.auth.me()).rejects.toMatchObject({ status: 0, code: "network" });

    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
    })));
    const p = api.auth.me().catch((e) => e as ApiError);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(await p).toMatchObject({ status: 0, code: "timeout" });
  });

  it("propagates caller aborts as AbortError", async () => {
    vi.stubGlobal("fetch", vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
    })));
    const ctrl = new AbortController();
    const p = api.auth.me(ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not log request or response bodies", async () => {
    const spy = vi.spyOn(console, "log");
    mockFetch(route("POST", "/auth/login", () => jsonResponse(200, { id: "1", email: "a@b.co" })));
    await api.auth.login("a@b.co", "secret-password");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
