"""Every provider-backed endpoint under 429 / 5xx / invalid payload / empty result / timeout: explicit, bounded, never fabricated."""
import json
from pathlib import Path

import httpx
import pytest

from providers import exa, screener, yahoo
from providers.base import TTLCache
from services import fundamentals
from tests.conftest import register
from tests.test_companies import load

FX = Path(__file__).parent / "fixtures"
CHART = json.loads((FX / "synthetic_yahoo_chart_5d.json").read_text())
NEWS = json.loads((FX / "synthetic_exa_news.json").read_text())
HTML = (FX / "synthetic_screener_tables.html").read_text()


def timeout(req):
    raise httpx.ReadTimeout("slow", request=req)


MODES = {  # mode -> handler factory(ok_response)
    "429": lambda ok: lambda r: httpx.Response(429, headers={"Retry-After": "3600"}),
    "500": lambda ok: lambda r: httpx.Response(500, text="boom"),
    "invalid": lambda ok: lambda r: httpx.Response(200, text="<<not json>>"),
    "timeout": lambda ok: timeout,
}
# status each failure mode must map to
EXPECT = {"429": 429, "500": 503, "invalid": 502, "timeout": 504}


@pytest.fixture()
def cid(client, db):
    load(db); register(client)
    yahoo.cache = TTLCache(); exa.cache = TTLCache()
    return client.get("/api/v1/companies/search?q=synthalpha").json()["items"][0]["id"]


def install(monkeypatch, name, handler):
    mod = {"yahoo": yahoo, "exa": exa, "screener": screener}[name]
    c = mod.make_client("k", transport=httpx.MockTransport(handler), budget=None) if name == "exa" else mod.make_client(transport=httpx.MockTransport(handler), budget=None)
    c.sleep = lambda s: None
    monkeypatch.setattr(mod, "_client", c)


@pytest.mark.parametrize("mode", ["429", "500", "invalid", "timeout"])
@pytest.mark.parametrize("path", ["quote", "history?range=1mo"])
def test_market_endpoints_degrade_explicitly(client, cid, monkeypatch, mode, path):
    install(monkeypatch, "yahoo", MODES[mode](CHART))
    r = client.get(f"/api/v1/companies/{cid}/{path}")
    assert r.status_code == EXPECT[mode], r.text
    d = r.json()["detail"]
    assert d["code"] and d["message"] and "price" not in json.dumps(r.json())      # a code + message, and no invented numbers


def test_market_empty_result_is_not_found_not_zero(client, cid, monkeypatch):
    install(monkeypatch, "yahoo", lambda r: httpx.Response(200, json={"chart": {"result": [], "error": None}}))
    r = client.get(f"/api/v1/companies/{cid}/quote")
    assert r.status_code == 404 and r.json()["detail"]["code"] == "not_found"


@pytest.mark.parametrize("mode", ["429", "500", "invalid", "timeout"])
def test_news_endpoint_degrades_explicitly(client, cid, monkeypatch, mode):
    install(monkeypatch, "exa", MODES[mode](NEWS))
    r = client.get(f"/api/v1/companies/{cid}/news")
    assert r.status_code == EXPECT[mode], r.text
    assert r.json()["detail"]["code"] and "items" not in r.json()


def test_news_empty_results_is_a_valid_empty_state(client, cid, monkeypatch):
    install(monkeypatch, "exa", lambda r: httpx.Response(200, json={"results": []}))
    r = client.get(f"/api/v1/companies/{cid}/news")
    assert r.status_code == 200 and r.json()["items"] == [] and r.json()["total"] == 0


@pytest.mark.parametrize("mode", ["429", "500", "invalid", "timeout"])
def test_financials_endpoint_degrades_explicitly_and_stores_nothing(client, db, cid, monkeypatch, mode):
    from sqlalchemy import func, select
    from core.orm import FinancialFact
    fundamentals._failures.clear()
    install(monkeypatch, "screener", MODES[mode](HTML))
    r = client.get(f"/api/v1/companies/{cid}/financials")
    assert r.status_code in (EXPECT[mode], 503) and r.json()["detail"]["code"]
    assert db.scalar(select(func.count()).select_from(FinancialFact)) == 0


def test_financials_page_without_tables_is_rejected_not_stored(client, db, cid, monkeypatch):
    from sqlalchemy import func, select
    from core.orm import FinancialFact
    install(monkeypatch, "screener", lambda r: httpx.Response(200, text="<html><body>maintenance</body></html>"))
    assert client.get(f"/api/v1/companies/{cid}/financials").status_code == 503
    assert db.scalar(select(func.count()).select_from(FinancialFact)) == 0


def test_stale_data_is_served_flagged_when_the_provider_then_fails(client, cid, monkeypatch):
    state = {"fail": False}
    def h(r):
        return httpx.Response(500) if state["fail"] else httpx.Response(200, json=CHART)
    install(monkeypatch, "yahoo", h)
    now = [1000.0]
    yahoo.cache = TTLCache(clock=lambda: now[0])
    assert client.get(f"/api/v1/companies/{cid}/quote").json()["provenance"]["stale"] is False
    now[0] += 500; state["fail"] = True                     # past the 2-minute TTL, within the 6-hour stale window
    r = client.get(f"/api/v1/companies/{cid}/quote").json()
    assert r["provenance"]["stale"] is True and r["provenance"]["cached"] is True and r["price"] > 0
    now[0] += 7 * 3600                                      # beyond the stale window: an explicit error, not old data
    assert client.get(f"/api/v1/companies/{cid}/quote").status_code == 503


def test_no_uncontrolled_retries(client, cid, monkeypatch):
    calls = []
    def h(r):
        calls.append(1)
        return httpx.Response(500)
    install(monkeypatch, "yahoo", h)
    client.get(f"/api/v1/companies/{cid}/quote")
    assert len(calls) <= 2                                   # 1 attempt + at most 1 bounded retry (yahoo max_retries=1)
    n = len(calls)
    client.get(f"/api/v1/companies/{cid}/quote")
    assert len(calls) == n                                   # the failure is remembered briefly: no repeat hit
