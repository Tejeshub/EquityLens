import json
from pathlib import Path

import httpx
import pytest

from providers import yahoo
from providers.base import ProviderError, TTLCache
from services import market
from tests.conftest import register
from tests.test_companies import load

FX = Path(__file__).parent / "fixtures"
CHART = json.loads((FX / "synthetic_yahoo_chart_5d.json").read_text())   # synthetic fixtures
SPARK = json.loads((FX / "synthetic_yahoo_spark.json").read_text())


@pytest.fixture(autouse=True)
def fake_yahoo(monkeypatch):
    yahoo.cache = TTLCache()
    calls = {"n": 0, "mode": "ok"}
    def handler(req: httpx.Request):
        calls["n"] += 1
        if calls["mode"] == "429":
            return httpx.Response(429, headers={"Retry-After": "3600"})
        if calls["mode"] == "404":
            return httpx.Response(404, json={"chart": {"result": None}})
        if "spark" in req.url.path:
            return httpx.Response(200, json=SPARK)
        return httpx.Response(200, json=CHART)
    monkeypatch.setattr(yahoo, "_client", yahoo.make_client(transport=httpx.MockTransport(handler), budget=None))
    return calls


def setup(client, db):
    load(db); register(client)
    return client.get("/api/v1/companies/search?q=synthalpha").json()["items"][0]["id"]


def test_parse_chart_drops_null_rows_never_zero_fills():
    p = json.loads(json.dumps(CHART))
    p["chart"]["result"][0]["indicators"]["quote"][0]["close"][1] = None
    _, bars = yahoo.parse_chart(p, "X")
    assert len(bars) == len(CHART["chart"]["result"][0]["timestamp"]) - 1
    assert all(b.close > 0 for b in bars)


def test_quote_endpoint_values_and_provenance(client, db, fake_yahoo):
    cid = setup(client, db)
    q = client.get(f"/api/v1/companies/{cid}/quote").json()
    meta = CHART["chart"]["result"][0]["meta"]
    assert q["price"] == meta["regularMarketPrice"] and q["currency"] == "INR"
    assert q["previous_close"] == 104.0  # last close strictly before the quote's trading date
    assert q["change"] == pytest.approx(q["price"] - 104.0)
    assert q["provenance"]["delayed"] is True and "unofficial" in q["provenance"]["source"].lower()
    assert q["provenance"]["cached"] is False
    assert client.get(f"/api/v1/companies/{cid}/quote").json()["provenance"]["cached"] is True
    assert fake_yahoo["n"] == 1  # second request served from cache


def test_history_endpoint_and_invalid_range(client, db):
    cid = setup(client, db)
    h = client.get(f"/api/v1/companies/{cid}/history?range=1mo").json()
    assert h["interval"] == "1d" and len(h["bars"]) == 5 and h["bars"][-1]["date"] == "2026-10-12"
    assert client.get(f"/api/v1/companies/{cid}/history?range=10y").status_code == 422


def test_provider_quota_maps_to_429_without_retry_storm(client, db, fake_yahoo):
    cid = setup(client, db)
    fake_yahoo["mode"] = "429"
    r = client.get(f"/api/v1/companies/{cid}/quote")
    assert r.status_code == 429 and r.json()["detail"]["code"] == "quota" and fake_yahoo["n"] == 1


def test_unknown_symbol_404(client, db, fake_yahoo):
    cid = setup(client, db)
    fake_yahoo["mode"] = "404"
    assert client.get(f"/api/v1/companies/{cid}/quote").status_code == 404


def test_market_requires_auth_and_unknown_company(client, db):
    assert client.get("/api/v1/companies/00000000-0000-0000-0000-000000000000/quote").status_code == 401
    register(client)
    assert client.get("/api/v1/companies/00000000-0000-0000-0000-000000000000/quote").status_code == 404


def test_movers_policy_excludes_stale_and_insufficient():
    spark = {
        "A.NS": [("2026-10-09", 100.0), ("2026-10-12", 110.0)],
        "B.NS": [("2026-10-09", 100.0), ("2026-10-12", 95.0)],
        "STALE.NS": [("2026-10-08", 100.0), ("2026-10-09", 300.0)],   # last bar older than batch's latest date
        "ZERO.NS": [("2026-10-09", 0.0), ("2026-10-12", 5.0)],        # cannot compute % from a zero base
    }
    out = market.movers_from_spark(spark, {}, top=5)
    assert out["as_of_date"] == "2026-10-12" and out["evaluated"] == 2 and out["excluded"] == 2
    assert [r["symbol"] for r in out["gainers"]] == ["A.NS"] and out["gainers"][0]["change_percent"] == pytest.approx(10.0)
    assert [r["symbol"] for r in out["losers"]] == ["B.NS"]


def test_movers_endpoint_uses_membership(client, db):
    from services.companies import import_index_list, parse_index_csv
    rows = [{"isin": "INE000S01001", "symbol": "SYNTHALPHA", "industry": "Information Technology"}] * 1
    load(db); register(client)
    # membership requires >=20 rows to apply; pad with the sample rows (unknown ISINs are ignored)
    pad = parse_index_csv((FX / "synthetic_nifty_sample.csv").read_text())
    res = import_index_list(db, "NIFTY MIDCAP 100", rows + pad)
    assert res["applied"] and res["matched"] == 1
    out = client.get("/api/v1/market/movers?segment=mid").json()
    assert out["universe_size"] == 1 and out["evaluated"] == 1 and out["gainers"] + out["losers"]
    assert {r["symbol"] for r in out["gainers"] + out["losers"]} == {"SYNTHALPHA"}
    assert out["delayed"] is True and out["segment"] == "mid"
    assert client.get("/api/v1/companies/search?q=synthalpha&sector=Information%20Technology&segment=mid").json()["total"] == 1
    assert client.get("/api/v1/companies/search?q=synthalpha&segment=small").json()["total"] == 0
    assert client.get("/api/v1/market/movers?segment=huge").status_code == 422
