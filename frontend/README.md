# EquityLens frontend

Vite + React 18 + TypeScript + shadcn/ui + Tailwind + TanStack Query.

## Development

    npm install
    npm run dev          # http://localhost:8080

The dev server proxies `/auth` and `/api` to `http://127.0.0.1:8000` (see `vite.config.ts`),
so the HttpOnly `el_session` cookie and the readable `el_csrf` cookie work same-origin.
Start the backend separately (uvicorn on port 8000).

`VITE_API_URL` (optional) sets the API base URL. Default is empty = same origin.
Leave it empty when using the dev proxy or the Vercel rewrites below, otherwise
cookies become cross-site.

## Production (Vercel)

`vercel.json` contains an SPA fallback plus rewrites of `/api/*` and `/auth/*` to the backend.
Before deploying, replace the placeholder `RENDER_BACKEND_URL` in `vercel.json` with the
real backend origin (for example `https://<your-service>.onrender.com`, no trailing slash).
Do not commit a hostname you do not control.

## Scripts

    npm test             # vitest (fetch mocks are defined only inside test files)
    npm run lint
    npm run build
