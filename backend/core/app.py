"""Base FastAPI application: CORS, security headers, sanitized errors, health/readiness."""
import asyncio
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from core.db import get_engine
from core.logging import configure_logging
from core.settings import get_settings

log = logging.getLogger("equitylens")


def _expected_revision():
    """Head revision shipped with this build (None if migration files are not present, e.g. a trimmed image)."""
    try:
        from pathlib import Path
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        root = Path(__file__).resolve().parents[1]
        cfg = Config(str(root / "alembic.ini"))
        cfg.set_main_option("script_location", str(root / "migrations"))
        return ScriptDirectory.from_config(cfg).get_current_head()
    except Exception:  # noqa: BLE001
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    try:  # bound the sync-request threadpool to what the DB pool can serve
        import anyio.to_thread
        anyio.to_thread.current_default_thread_limiter().total_tokens = s.threadpool_size
    except Exception:  # noqa: BLE001
        log.warning("could not set threadpool size")
    if s.environment != "test":
        try:
            from core.db import get_session
            from core.security import purge_expired
            db = next(get_session())
            try:
                log.info("startup purge: %s", purge_expired(db))
            finally:
                db.close()
        except Exception:  # database may not be reachable yet; /ready reports that
            log.warning("startup purge skipped")
    yield


def create_base_app() -> FastAPI:
    configure_logging()
    s = get_settings()
    docs = None if s.is_production else "/docs"
    app = FastAPI(
        title="EquityLens API",
        description="Equity research for Indian listed companies. Informational only; not investment advice.",
        lifespan=lifespan, docs_url=docs, redoc_url=None, openapi_url=None if s.is_production else "/openapi.json",
    )
    if s.is_production and s.provider_mode == "fixture":
        raise RuntimeError("PROVIDER_MODE=fixture is for tests/E2E only and is refused when ENVIRONMENT=production")
    if s.is_production and s.research_jobs_inline:
        raise RuntimeError("RESEARCH_JOBS_INLINE is for tests only and is refused when ENVIRONMENT=production")
    if s.is_production and not s.origins_configured:
        raise RuntimeError("ALLOWED_ORIGINS must be set explicitly when ENVIRONMENT=production")

    # Middleware order (last added = outermost): catch-all -> security headers -> CORS. The catch-all sits INSIDE CORS so that
    # even sanitized 500 responses carry CORS headers and the browser can read them.
    gate: dict = {}

    @app.middleware("http")
    async def admission(request: Request, call_next):
        """Bound in-flight requests to the worker-thread/DB-pool capacity; the rest wait cheaply in the event loop (or get 503)."""
        if request.url.path == "/health":
            return await call_next(request)
        sem = gate.get("sem")
        if sem is None:
            sem = gate["sem"] = asyncio.Semaphore(s.inflight_limit)
        try:
            await asyncio.wait_for(sem.acquire(), timeout=s.queue_wait_s)
        except asyncio.TimeoutError:
            return JSONResponse(status_code=503, content={"detail": {"code": "busy", "message": "The server is busy; please retry shortly."}},
                                headers={"Retry-After": "5"})
        try:
            return await call_next(request)
        finally:
            sem.release()

    chain_log = {"left": 20}

    @app.middleware("http")
    async def proxy_chain_probe(request: Request, call_next):
        """OFF by default. With DEBUG_PROXY_CHAIN=true logs the peer address and X-Forwarded-For entries of the first 20 requests to the public
        /api/v1/capabilities route (no cookies, no bodies) so the owner can work out how many trusted proxy hops precede the app."""
        if s.debug_proxy_chain and chain_log["left"] > 0 and request.url.path == "/api/v1/capabilities":
            chain_log["left"] -= 1
            peer = request.client.host if request.client else "?"
            xff = [x.strip() for x in request.headers.get("x-forwarded-for", "").split(",") if x.strip()]
            log.warning("proxy-chain probe: peer=%s xff_entries=%d xff=%s x_vercel_forwarded_for=%s", peer, len(xff), xff,
                        request.headers.get("x-vercel-forwarded-for", "-"))
        return await call_next(request)

    @app.middleware("http")
    async def catch_unhandled(request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:  # noqa: BLE001
            rid = uuid.uuid4().hex[:12]
            log.error("unhandled error rid=%s path=%s type=%s", rid, request.url.path, type(exc).__name__, exc_info=exc)
            return JSONResponse(status_code=500, content={"detail": "Internal server error", "request_id": rid})

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        if request.url.path.startswith(("/auth", "/api")):
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
        expose_headers=["Retry-After"],
    )

    @app.get("/health", tags=["ops"])
    def health():
        """Process liveness only. Does not touch dependencies."""
        return {"status": "ok"}

    @app.get("/ready", tags=["ops"])
    def ready():
        """Dependency readiness: database reachable. No detail leaked on failure."""
        try:
            with get_engine().connect() as c:
                c.execute(text("SELECT 1"))
                try:
                    current = c.execute(text("SELECT version_num FROM alembic_version")).scalar()
                except Exception:  # table missing: migrations were never applied
                    current = None
        except Exception:
            return JSONResponse(status_code=503, content={"status": "unavailable", "database": False})
        expected = _expected_revision()
        schema_ok = expected is None or current == expected
        if not schema_ok:
            # No revision strings or details in the body: just whether the schema matches this build.
            return JSONResponse(status_code=503, content={"status": "schema_mismatch", "database": True, "schema": False})
        return {"status": "ready", "database": True, "schema": True}

    from core.security import current_user
    from routers import ask, auth, capabilities, companies, financials, market, news, research, watchlists
    app.include_router(auth.router)
    app.include_router(capabilities.router)  # public by design: booleans + reasons only
    # Authentication is enforced at router level for the whole /api/v1 surface: a new route cannot be public by omission.
    for r in (companies, market, financials, news, research, ask, watchlists):
        app.include_router(r.router, dependencies=[Depends(current_user)])

    return app
