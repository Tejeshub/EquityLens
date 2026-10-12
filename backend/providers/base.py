"""Central provider-control layer: timeouts, bounded retries with jittered backoff, Retry-After,
circuit breaker, budget enforcement, TTL cache with single-flight and stale-if-error.

Design notes
- Retries only for idempotent GETs by default and only for 429/5xx/timeouts; a 429 whose Retry-After exceeds
  `max_retry_after` is surfaced as `quota` immediately (no waiting, no retry storm).
- Circuit breaker and cache are process-local. Quota *budgets* (the thing that must be global across Render
  instances) use the Postgres-backed counter passed in as `budget`.
- There is no automatic fallback to any paid provider.
"""
import logging
import os
import random
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Generic, Optional, Tuple, TypeVar

import httpx

log = logging.getLogger("equitylens.providers")
T = TypeVar("T")


class ProviderError(Exception):
    """kind: quota | timeout | unavailable | circuit_open | not_found | bad_payload | budget"""

    def __init__(self, provider: str, kind: str, message: str = ""):
        super().__init__(f"{provider}: {kind} {message}".strip())
        self.provider, self.kind, self.message = provider, kind, message


@dataclass
class CircuitBreaker:
    """Thread-safe. Counts only provider-side failures (5xx, timeouts, connection errors, 429) - NOT caller errors (400/401/403/422),
    which must not be able to disable a provider for everyone. Half-open admits exactly one probe at a time."""
    failure_threshold: int = 5
    reset_after: float = 60.0
    clock: Callable[[], float] = time.monotonic
    _failures: int = 0
    _opened_at: Optional[float] = None
    _probing: bool = False
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def allow(self) -> bool:
        with self._lock:
            if self._opened_at is None:
                return True
            if self.clock() - self._opened_at >= self.reset_after and not self._probing:
                self._probing = True  # the single half-open probe; everyone else is refused until it reports back
                return True
            return False

    def success(self) -> None:
        with self._lock:
            self._failures, self._opened_at, self._probing = 0, None, False

    def failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._probing or self._failures >= self.failure_threshold:
                self._opened_at, self._probing = self.clock(), False

    def neutral(self) -> None:
        """A caller error (4xx) says nothing about provider health: release a half-open probe without changing state."""
        with self._lock:
            self._probing = False


@dataclass
class CacheResult(Generic[T]):
    value: T
    fetched_at: float  # epoch seconds
    cached: bool
    stale: bool = False


# How long a FAILED fetch is remembered per error kind, so a missing/limited resource does not hit the upstream on every request
# and concurrent waiters do not each retry sequentially behind the per-key lock.
NEGATIVE_TTL = {"not_found": 600.0, "quota": 60.0, "unavailable": 30.0, "timeout": 30.0, "bad_payload": 30.0}


class TTLCache:
    """Thread-safe TTL cache with single-flight (concurrent identical misses share one fetch), stale-if-error, negative caching
    and reference-counted per-key locks (a lock is dropped only when nobody holds or awaits it)."""

    def __init__(self, clock: Callable[[], float] = time.time, max_entries: int = 2000):
        self._data: Dict[str, Tuple[Any, float]] = {}
        self._errors: Dict[str, Tuple[ProviderError, float]] = {}
        self._locks: Dict[str, list] = {}  # key -> [lock, refcount]
        self._guard = threading.Lock()
        self._clock = clock
        self._max = max_entries

    def _acquire(self, key: str) -> threading.Lock:
        with self._guard:
            entry = self._locks.setdefault(key, [threading.Lock(), 0])
            entry[1] += 1
            return entry[0]

    def _release(self, key: str) -> None:
        with self._guard:
            entry = self._locks.get(key)
            if entry:
                entry[1] -= 1
                if entry[1] <= 0:
                    self._locks.pop(key, None)

    def _neg(self, key: str):
        e = self._errors.get(key)
        if e and self._clock() - e[1] < NEGATIVE_TTL.get(e[0].kind, 0.0):
            return e[0]
        return None

    def get_or_fetch(self, key: str, ttl: float, fetch: Callable[[], T], *, stale_ttl: float = 0.0) -> "CacheResult[T]":
        now = self._clock()
        hit = self._data.get(key)
        if hit and now - hit[1] < ttl:
            return CacheResult(hit[0], hit[1], cached=True)
        lock = self._acquire(key)
        try:
            with lock:
                hit = self._data.get(key)  # another thread may have filled it
                now = self._clock()
                if hit and now - hit[1] < ttl:
                    return CacheResult(hit[0], hit[1], cached=True)
                neg = self._neg(key)
                if neg is not None:  # a recent identical failure: do not re-hit the upstream
                    if hit and now - hit[1] < ttl + stale_ttl:
                        return CacheResult(hit[0], hit[1], cached=True, stale=True)
                    raise neg
                try:
                    value = fetch()
                except ProviderError as e:
                    if e.kind in NEGATIVE_TTL:
                        with self._guard:
                            self._errors[key] = (e, self._clock())
                    if hit and now - hit[1] < ttl + stale_ttl:
                        return CacheResult(hit[0], hit[1], cached=True, stale=True)
                    raise
                with self._guard:
                    self._errors.pop(key, None)
                    if len(self._data) >= self._max:
                        oldest = min(self._data, key=lambda k: self._data[k][1])
                        self._data.pop(oldest, None)
                    if len(self._errors) > self._max:
                        self._errors.pop(next(iter(self._errors)), None)
                    self._data[key] = (value, self._clock())
                return CacheResult(value, self._clock(), cached=False)
        finally:
            self._release(key)

    def clear(self) -> None:
        with self._guard:
            self._data.clear()
            self._errors.clear()


class _DeadlineExceeded(Exception):
    pass


@dataclass
class ProviderClient:
    """One upstream. `timeout` bounds each connect/read/write phase; `total_timeout` bounds a whole attempt (slow-drip protection);
    `max_bytes` caps the body read into memory."""
    name: str
    base_url: str = ""
    timeout: float = 10.0
    total_timeout: Optional[float] = None
    max_bytes: int = 2_000_000
    max_retries: int = 2
    backoff_base: float = 0.5
    backoff_cap: float = 8.0
    max_retry_after: float = 10.0
    headers: Dict[str, str] = field(default_factory=dict)
    breaker: CircuitBreaker = field(default_factory=CircuitBreaker)
    budget: Optional[Callable[[], bool]] = None  # returns False when the budget is exhausted
    sleep: Callable[[float], None] = time.sleep
    transport: Optional[httpx.BaseTransport] = None  # injectable for tests
    clock: Callable[[], float] = time.monotonic

    def _send(self, method: str, url: str, kwargs: dict) -> httpx.Response:
        deadline = self.clock() + (self.total_timeout or self.timeout * 1.5)
        with httpx.Client(timeout=self.timeout, headers=self.headers, base_url=self.base_url, transport=self.transport, follow_redirects=False) as c:
            with c.stream(method, url, **kwargs) as r:
                body = bytearray()
                for chunk in r.iter_bytes():
                    body.extend(chunk)
                    if len(body) > self.max_bytes:
                        raise ProviderError(self.name, "bad_payload", "response too large")
                    if self.clock() > deadline:
                        raise _DeadlineExceeded()
                if self.clock() > deadline:
                    raise _DeadlineExceeded()
                headers = {k: v for k, v in r.headers.items() if k.lower() not in ("content-encoding", "content-length", "transfer-encoding")}
                return httpx.Response(r.status_code, headers=headers, content=bytes(body), request=r.request)

    def request(self, method: str, url: str, *, retry: Optional[bool] = None, **kwargs) -> httpx.Response:
        if url.lower().startswith(("http://", "https://")) and self.base_url:
            from urllib.parse import urlparse
            if urlparse(url).netloc != urlparse(self.base_url).netloc:
                # httpx would ignore base_url for an absolute URL and our auth headers would go to another host
                raise ValueError(f"provider '{self.name}': refusing absolute URL on a different host than its base_url")
        if self.transport is None and os.getenv("ENVIRONMENT", "").lower() == "test" and os.getenv("ALLOW_LIVE_PROVIDERS") != "1":
            # Automated tests must never reach a real provider (quota, cost, terms). Live checks opt in explicitly.
            raise RuntimeError(f"live call to provider '{self.name}' blocked in test environment (set ALLOW_LIVE_PROVIDERS=1 for a deliberate live check)")
        retry = (method.upper() == "GET") if retry is None else retry
        attempts = 1 + (self.max_retries if retry else 0)
        last: Optional[ProviderError] = None
        for attempt in range(attempts):
            if not self.breaker.allow():
                raise ProviderError(self.name, "circuit_open", "provider temporarily disabled after repeated failures")
            if self.budget is not None and not self.budget():
                self.breaker.neutral()
                raise ProviderError(self.name, "budget", "configured request budget exhausted")
            try:
                resp = self._send(method, url, kwargs)
            except ProviderError:
                self.breaker.neutral()
                raise
            except (httpx.TimeoutException, _DeadlineExceeded):
                last = ProviderError(self.name, "timeout")
            except httpx.HTTPError as e:
                last = ProviderError(self.name, "unavailable", type(e).__name__)
            else:
                code = resp.status_code
                if code == 429:
                    ra = _retry_after(resp)
                    self.breaker.failure()
                    last = ProviderError(self.name, "quota", "rate limited by provider")
                    if ra is None or ra > self.max_retry_after or attempt == attempts - 1:
                        raise last  # never sleep after the final attempt or beyond the cap
                    self.sleep(ra)
                    continue
                if code == 404:
                    self.breaker.success()
                    raise ProviderError(self.name, "not_found")
                if code >= 500:
                    last = ProviderError(self.name, "unavailable", f"HTTP {code}")
                elif code >= 400:  # caller error: says nothing about provider health, so it must not trip the breaker
                    self.breaker.neutral()
                    log.warning("provider=%s HTTP %s body=%s", self.name, code, resp.text[:200].replace("\n", " "))
                    raise ProviderError(self.name, "rejected", f"HTTP {code}")
                else:
                    self.breaker.success()
                    return resp
            self.breaker.failure()
            if attempt < attempts - 1:
                self.sleep(min(self.backoff_cap, self.backoff_base * (2 ** attempt)) * random.uniform(0.5, 1.0))
        assert last is not None
        log.warning("provider=%s failed kind=%s after %d attempt(s)", self.name, last.kind, attempts)
        raise last


def _retry_after(resp: httpx.Response) -> Optional[float]:
    raw = resp.headers.get("retry-after")
    if raw is None:
        return None
    try:
        return max(0.0, float(raw))
    except ValueError:
        return None
