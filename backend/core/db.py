"""SQLAlchemy engine/session management. The engine is created lazily (no import-time connection)."""
from typing import Iterator, Optional

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from core.settings import get_settings


class Base(DeclarativeBase):
    pass


_engine: Optional[Engine] = None
_SessionLocal: Optional[sessionmaker] = None


def _refuse_remote_in_tests(url: str) -> None:
    """Tests and migrations in ENVIRONMENT=test must never touch a remote (e.g. Supabase) database."""
    if get_settings().environment == "test":
        host = make_url(url).host or ""
        if host not in ("localhost", "127.0.0.1", "::1", ""):
            raise RuntimeError(f"Refusing to use non-local database host {host!r} in test environment")


def get_engine() -> Engine:
    global _engine, _SessionLocal
    if _engine is None:
        url = get_settings().db_url
        if not url:
            raise RuntimeError("DATABASE_URL (or legacy POSTGRES_URL) is not configured")
        _refuse_remote_in_tests(url)
        s = get_settings()
        # Capacity invariant: admitted requests (<= inflight_limit, enforced by the admission middleware) <= worker threads, and the pool
        # holds one connection per admitted request + the research workers. A sync request keeps its connection while it waits for a
        # thread to run later dependencies/teardown, so WITHOUT admission control even pool == threads deadlocks (measured:
        # 80 concurrent trivial requests -> 40 HTTP 500 after a 30 s pool timeout).
        _engine = create_engine(url, pool_pre_ping=True, pool_size=s.db_pool_size, max_overflow=s.db_pool_extra, pool_recycle=1800, pool_timeout=10)
        _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


_budget_engine: Optional[Engine] = None


def get_budget_session() -> Session:
    """Session on a SEPARATE tiny pool for provider-budget counters. Budget checks happen while the request already holds a
    connection from the main pool; drawing from the same pool made leaders wait on waiters (deadlock)."""
    global _budget_engine
    if _budget_engine is None:
        url = get_settings().db_url
        if not url:
            raise RuntimeError("DATABASE_URL (or legacy POSTGRES_URL) is not configured")
        _refuse_remote_in_tests(url)
        _budget_engine = create_engine(url, pool_pre_ping=True, pool_size=3, max_overflow=2, pool_recycle=1800, pool_timeout=5)
    return sessionmaker(bind=_budget_engine, expire_on_commit=False)()


def set_engine_for_tests(engine: Engine) -> None:
    global _engine, _SessionLocal
    _engine = engine
    _SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    get_engine()
    assert _SessionLocal is not None
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()
