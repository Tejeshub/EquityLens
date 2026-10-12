import threading
import time

import httpx
import pytest

from providers.base import CircuitBreaker, ProviderClient, ProviderError, TTLCache


def client(handler, **kw):
    sleeps = []
    c = ProviderClient(name="t", base_url="http://x", transport=httpx.MockTransport(handler), sleep=sleeps.append, **kw)
    return c, sleeps


def test_retries_5xx_then_succeeds():
    calls = []
    def h(req):
        calls.append(1)
        return httpx.Response(503) if len(calls) < 3 else httpx.Response(200, json={"ok": 1})
    c, sleeps = client(h)
    assert c.request("GET", "/a").json() == {"ok": 1}
    assert len(calls) == 3 and len(sleeps) == 2


def test_retry_count_bounded():
    calls = []
    def h(req):
        calls.append(1)
        return httpx.Response(500)
    c, _ = client(h)
    with pytest.raises(ProviderError) as e:
        c.request("GET", "/a")
    assert e.value.kind == "unavailable" and len(calls) == 3


def test_post_not_retried_by_default():
    calls = []
    def h(req):
        calls.append(1)
        return httpx.Response(500)
    c, _ = client(h)
    with pytest.raises(ProviderError):
        c.request("POST", "/a")
    assert len(calls) == 1


def test_429_long_retry_after_is_quota_without_waiting():
    calls = []
    def h(req):
        calls.append(1)
        return httpx.Response(429, headers={"Retry-After": "3600"})
    c, sleeps = client(h)
    with pytest.raises(ProviderError) as e:
        c.request("GET", "/a")
    assert e.value.kind == "quota" and len(calls) == 1 and sleeps == []


def test_429_short_retry_after_respected():
    seq = iter([httpx.Response(429, headers={"Retry-After": "2"}), httpx.Response(200, json={})])
    c, sleeps = client(lambda r: next(seq))
    c.request("GET", "/a")
    assert sleeps == [2.0]


def test_timeout_maps_to_timeout_kind():
    def h(req):
        raise httpx.ReadTimeout("slow")
    c, _ = client(h, max_retries=0)
    with pytest.raises(ProviderError) as e:
        c.request("GET", "/a")
    assert e.value.kind == "timeout"


def test_circuit_opens_and_resets():
    t = [0.0]
    br = CircuitBreaker(failure_threshold=2, reset_after=30, clock=lambda: t[0])
    calls = []
    def h(req):
        calls.append(1)
        return httpx.Response(500)
    c, _ = client(h, max_retries=0, breaker=br)
    for _ in range(2):
        with pytest.raises(ProviderError):
            c.request("GET", "/a")
    with pytest.raises(ProviderError) as e:
        c.request("GET", "/a")
    assert e.value.kind == "circuit_open" and len(calls) == 2
    t[0] = 31
    with pytest.raises(ProviderError) as e:
        c.request("GET", "/a")
    assert e.value.kind == "unavailable" and len(calls) == 3  # probe allowed


def test_budget_exhausted_blocks_request():
    c, _ = client(lambda r: httpx.Response(200), budget=lambda: False)
    with pytest.raises(ProviderError) as e:
        c.request("GET", "/a")
    assert e.value.kind == "budget"


def test_cache_ttl_and_expiry():
    now = [100.0]
    cache = TTLCache(clock=lambda: now[0])
    n = []
    f = lambda: n.append(1) or len(n)
    assert not cache.get_or_fetch("k", 10, f).cached
    assert cache.get_or_fetch("k", 10, f).cached and len(n) == 1
    now[0] += 11
    r = cache.get_or_fetch("k", 10, f)
    assert not r.cached and r.value == 2


def test_single_flight_concurrent_identical_requests():
    cache = TTLCache()
    n = []
    def slow():
        n.append(1)
        time.sleep(0.2)
        return "v"
    out = []
    ts = [threading.Thread(target=lambda: out.append(cache.get_or_fetch("k", 60, slow))) for _ in range(8)]
    [t.start() for t in ts]; [t.join() for t in ts]
    assert len(n) == 1 and len(out) == 8 and all(o.value == "v" for o in out)


def test_stale_if_error_marked_stale_and_never_fresh():
    now = [0.0]
    cache = TTLCache(clock=lambda: now[0])
    cache.get_or_fetch("k", 10, lambda: "old")
    now[0] = 15
    def boom():
        raise ProviderError("t", "unavailable")
    r = cache.get_or_fetch("k", 10, boom, stale_ttl=100)
    assert r.value == "old" and r.stale and r.cached
    now[0] = 500
    with pytest.raises(ProviderError):
        cache.get_or_fetch("k", 10, boom, stale_ttl=100)
