import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "node:fs";

// The dev proxy target is configurable so several stacks can run side by side (see docs/E2E.md).
const proxyTarget = process.env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:8000";

// `vite preview` (used by `npm run e2e:prod`) serves the real production build with the exact response headers that
// vercel.json defines, so there is a single source of truth for the CSP and the other security headers.
const vercelHeaders: Record<string, string> = {};
for (const rule of JSON.parse(readFileSync(path.resolve(__dirname, "vercel.json"), "utf8")).headers ?? []) {
  if (rule.source === "/(.*)") for (const h of rule.headers) vercelHeaders[h.key] = h.value;
}
const proxy = {
  "/auth": { target: proxyTarget, changeOrigin: false },
  "/api": { target: proxyTarget, changeOrigin: false },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "127.0.0.1",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Same-origin in dev so the HttpOnly session cookie and CSRF cookie work.
    proxy,
  },
  preview: {
    host: "127.0.0.1",
    port: 8080,
    proxy,
    headers: vercelHeaders,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
