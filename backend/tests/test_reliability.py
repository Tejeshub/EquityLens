"""Regression tests for the reliability audit (capacity deadlock, breaker semantics, negative caching, deadlines, per-user limits)."""
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest

from providers.base import CircuitBreaker, ProviderClient, ProviderError, TTLCache
from tests.conftest import csrf_headers, register
from tests.test_companies import load


def mk(handler, **kw):
    sleeps = []
    return ProviderClient(name="t", base_url="http://x", transport=httpx.MockTransport(handler), sleep=sleeps.append, **kw), sleeps


# ---- circuit breaker -------------------------------------------------------------------------------------------------
def test_caller_errors_do_not_trip_the_breaker():
    c, _ = mk(lambda r: httpx.Response(400, json={"error": "bad input"}), breaker=CircuitBreaker(failure_threshold=2))
    for _ in range(6):
        with pytest.raises(ProviderError) as e:
            c.request("GET", "/a")
        assert e.value.kind == "rejected"
    c2, _ = mk(lambda r: httpx.Response(200, json={}), breaker=c.breaker)
    assert c2.request("GET", "/a").status_code == 200          # a valid request still goes through


def test_half_open_admits_exactly_one_probe():
    t = [0.0]
    br = CircuitBreaker(failure_threshold=1, reset_after=10, clock=lambda: t[0])
    br.failure()
    assert not br.allow()
    t[0] = 11
    results = [br.allow() for _ in range(30)]
    assert results.count(True) == 1                              # one probe, everyone else refused
    br.success()
    assert br.allow() and br.allow()
    br.failure(); t[0] = 30
    assert br.allow()                                            # probe again
    br.failure()                                                  # failed probe re-opens immediately
    assert not br.allow()


def test_budget_refusal_does_not_leak_the_probe_slot():
    t = [0.0]
    br = CircuitBreaker(failure_threshold=1, reset_after=1, clock=lambda: t[0])
    br.failure(); t[0] = 5
    c, _ = mk(lambda r: httpx.Response(200, json={}), breaker=br, budget=lambda: False)
    with pytest.raises(ProviderError) as e:
        c.request("GET", "/a")
    assert e.value.kind == "budget"
    assert br.allow()                                            # probe slot released, not stuck forever


# ---- retries / deadlines ---------------------------------------------------------------------------------------------
def test_no_sleep_after_final_429_attempt():
    c, sleeps = mk(lambda r: httpx.Response(429, headers={"Retry-After": "5"}), max_retries=2)
    with pytest.raises(ProviderError) as e:
        c.request("GET", "/a")
    assert e.value.kind == "quota" and sleeps == [5.0, 5.0]       # 3 attempts, 2 sleeps (the old code slept a third time for nothing)


def test_total_deadline_stops_slow_drip_upstream():
    now = [0.0]

    class Drip(httpx.SyncByteStream):
        def __iter__(self):
            for _ in range(100):
                now[0] += 1.5                                     # each chunk "arrives" 1.5 s later: every read is within the phase timeout
                yield b"x"

    def handler(req):
        return httpx.Response(200, stream=Drip())
    c, _ = mk(handler, timeout=3.0, max_retries=0, clock=lambda: now[0])
    with pytest.raises(ProviderError) as e:
        c.request("GET", "/a")
    assert e.value.kind == "timeout" and now[0] < 20              # gave up after ~4.5 s of drip, not 150 s


def test_response_size_is_capped():
    c, _ = mk(lambda r: httpx.Response(200, content=b"x" * 5000), max_bytes=1000, max_retries=0)
    with pytest.raises(ProviderError) as e:
        c.request("GET", "/a")
    assert e.value.kind == "bad_payload"


# ---- cache: negative caching, single flight, lock lifecycle ----------------------------------------------------------
def test_failures_are_cached_briefly_and_waiters_do_not_retry_sequentially():
    cache = TTLCache()
    calls = []
    def boom():
        calls.append(1)
        time.sleep(0.1)
        raise ProviderError("t", "unavailable")
    errs = []
    def worker():
        try:
            cache.get_or_fetch("k", 60, boom)
        except ProviderError as e:
            errs.append(e)
    ts = [threading.Thread(target=worker) for _ in range(20)]
    [t.start() for t in ts]; [t.join() for t in ts]
    assert len(calls) == 1 and len(errs) == 20                    # was 20 sequential upstream calls
    with pytest.raises(ProviderError):
        cache.get_or_fetch("k", 60, boom)
    assert len(calls) == 1                                        # still remembered


def test_not_found_is_remembered_longer_and_expires():
    now = [0.0]
    cache = TTLCache(clock=lambda: now[0])
    calls = []
    def nf():
        calls.append(1)
        raise ProviderError("t", "not_found")
    for _ in range(3):
        with pytest.raises(ProviderError):
            cache.get_or_fetch("k", 60, nf)
    assert len(calls) == 1
    now[0] = 601
    with pytest.raises(ProviderError):
        cache.get_or_fetch("k", 60, nf)
    assert len(calls) == 2


def test_budget_and_breaker_errors_are_never_cached():
    cache = TTLCache()
    n = []
    def f():
        n.append(1)
        raise ProviderError("t", "budget")
    for _ in range(3):
        with pytest.raises(ProviderError):
            cache.get_or_fetch("k", 60, f)
    assert len(n) == 3


def test_locks_are_released_for_failing_keys_and_never_popped_while_held():
    cache = TTLCache()
    for i in range(500):
        with pytest.raises(ProviderError):
            cache.get_or_fetch(f"k{i}", 60, lambda: (_ for _ in ()).throw(ProviderError("t", "bad_payload")))
    assert len(cache._locks) == 0                                 # was: one leaked lock per failing key
    # eviction of a key whose refresh is in flight must not allow a duplicate concurrent fetch
    small = TTLCache(max_entries=1)
    small.get_or_fetch("old", 60, lambda: 1)
    started, release, calls = threading.Event(), threading.Event(), []
    def slow():
        calls.append(1); started.set(); release.wait(2); return 2
    t = threading.Thread(target=lambda: small.get_or_fetch("hot", 60, slow)); t.start()
    started.wait(2)
    small.get_or_fetch("other", 60, lambda: 3)                    # triggers eviction while 'hot' is in flight
    t2 = threading.Thread(target=lambda: small.get_or_fetch("hot", 60, slow)); t2.start()
    time.sleep(0.2); release.set(); t.join(); t2.join()
    assert len(calls) == 1


# ---- per-user limits on provider-backed reads ------------------------------------------------------------------------
def test_per_user_read_limits(client, db, monkeypatch):
    from core import limits
    monkeypatch.setitem(limits.LIMITS, "news", (3, 3600))
    load(db); register(client)
    cid = client.get("/api/v1/companies/search?q=synthalpha").json()["items"][0]["id"]
    from providers import exa
    import json
    from pathlib import Path
    data = json.loads((Path(__file__).parent / "fixtures" / "synthetic_exa_news.json").read_text())
    exa.cache = TTLCache()
    monkeypatch.setattr(exa, "_client", exa.make_client("k", transport=httpx.MockTransport(lambda r: httpx.Response(200, json=data)), budget=None))
    codes = [client.get(f"/api/v1/companies/{cid}/news").status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    r = client.get(f"/api/v1/companies/{cid}/news")
    assert r.headers.get("retry-after")


def test_one_users_limit_does_not_affect_another(client, app, db, monkeypatch):
    from core import limits
    from starlette.testclient import TestClient
    monkeypatch.setitem(limits.LIMITS, "company_read", (1, 60))
    load(db); register(client)
    # company_read is not wired to a route yet; the generic per-user key must be distinct per user
    from core import ratelimit
    from core.orm import User
    from sqlalchemy import select
    u1 = db.scalar(select(User))
    c2 = TestClient(app, base_url="http://localhost"); register(c2, "b@example.com")
    u2 = db.scalar(select(User).where(User.email == "b@example.com"))
    assert ratelimit.hit(db, f"read:news:{u1.id}", 1, 60)[0] and not ratelimit.hit(db, f"read:news:{u1.id}", 1, 60)[0]
    assert ratelimit.hit(db, f"read:news:{u2.id}", 1, 60)[0]


# ---- capacity: no deadlock when many concurrent requests exceed the pool ---------------------------------------------
def test_no_threadpool_db_pool_deadlock_under_concurrency(engine, tmp_path):
    """Boots a real uvicorn with a deliberately small pool/threadpool and fires far more concurrent authenticated requests than threads.
    Before the fix (pool 10 < 40 threads) 80 concurrent trivial requests produced HTTP 500s after a 30 s pool timeout."""
    import os, socket
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]
    env = dict(os.environ, ENVIRONMENT="test", THREADPOOL_SIZE="6", DB_POOL_EXTRA="0", PORT=str(port), ALLOWED_ORIGINS="http://localhost:8080")
    p = subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--port", str(port), "--log-level", "warning"], env=env,
                         cwd=os.path.join(os.path.dirname(__file__), ".."), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        base = f"http://127.0.0.1:{port}"
        for _ in range(80):
            try:
                httpx.get(base + "/health", timeout=1); break
            except Exception:
                time.sleep(0.25)
        with httpx.Client(base_url=base, headers={"Origin": "http://localhost:8080"}) as c:
            assert c.post("/auth/register", json={"email": "cap@example.com", "password": "capacity test pw"}).status_code in (201, 409)
            if c.get("/auth/me").status_code != 200:
                assert c.post("/auth/login", json={"email": "cap@example.com", "password": "capacity test pw"}).status_code == 200
            cookies = dict(c.cookies)
        def hit(_):
            return httpx.get(base + "/auth/me", cookies=cookies, timeout=30).status_code
        t0 = time.time()
        with ThreadPoolExecutor(max_workers=120) as ex:
            codes = list(ex.map(hit, range(240)))
        assert codes.count(200) == 240, {c: codes.count(c) for c in set(codes)}
        assert time.time() - t0 < 25
    finally:
        p.terminate()
        try:
            p.wait(5)
        except Exception:
            p.kill()
