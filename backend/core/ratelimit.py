"""Postgres-backed fixed-window rate limiter, shared across backend instances."""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session


def _window_start(now: datetime, window_seconds: int) -> datetime:
    epoch = int(now.timestamp())
    return datetime.fromtimestamp(epoch - epoch % window_seconds, tz=timezone.utc)


def hit(db: Session, key: str, limit: int, window_seconds: int, *, now: datetime | None = None) -> tuple[bool, int, int]:
    """Count one event. Returns (allowed, current_count, retry_after_seconds)."""
    now = now or datetime.now(timezone.utc)
    start = _window_start(now, window_seconds)
    count = db.execute(
        text(
            "INSERT INTO rate_limit_counters (key, window_start, count) VALUES (:k, :w, 1) "
            "ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limit_counters.count + 1 "
            "RETURNING count"
        ),
        {"k": key, "w": start},
    ).scalar_one()
    db.commit()
    retry_after = int((start + timedelta(seconds=window_seconds) - now).total_seconds()) + 1
    return count <= limit, count, retry_after


def enforce(db: Session, key: str, limit: int, window_seconds: int, message: str = "Too many requests") -> None:
    allowed, _, retry_after = hit(db, key, limit, window_seconds)
    if not allowed:
        raise HTTPException(status_code=429, detail=message, headers={"Retry-After": str(retry_after)})


def peek(db: Session, key: str, window_seconds: int, *, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    start = _window_start(now, window_seconds)
    row = db.execute(text("SELECT count FROM rate_limit_counters WHERE key=:k AND window_start=:w"), {"k": key, "w": start}).scalar()
    return int(row or 0)


def purge_old(db: Session, older_than: timedelta = timedelta(days=2)) -> int:
    res = db.execute(text("DELETE FROM rate_limit_counters WHERE window_start < :t"), {"t": datetime.now(timezone.utc) - older_than})
    db.commit()
    return res.rowcount or 0


def blocked(db: Session, key: str, limit: int, window_seconds: int) -> int:
    """Return retry-after seconds if `key` has already reached `limit` in the current window, else 0 (does not count)."""
    if peek(db, key, window_seconds) >= limit:
        now = datetime.now(timezone.utc)
        return int((_window_start(now, window_seconds) + timedelta(seconds=window_seconds) - now).total_seconds()) + 1
    return 0


def reset(db: Session, key: str) -> None:
    db.execute(text("DELETE FROM rate_limit_counters WHERE key=:k"), {"k": key})
    db.commit()
