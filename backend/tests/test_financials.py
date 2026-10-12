from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import httpx
import pytest
from sqlalchemy import func, select

from core.orm import FinancialFact
from providers import screener
from services import fundamentals as f
from tests.conftest import register
from tests.test_companies import load

HTML = (Path(__file__).parent / "fixtures" / "synthetic_screener_tables.html").read_text()  # synthetic fixture


def test_parse_period_and_values():
    assert f.parse_period("Mar 2024") == date(2024, 3, 31) and f.parse_period("Feb 2024") == date(2024, 2, 29)
    assert f.parse_period("TTM") is None and f.parse_period("") is None
    assert f.parse_value("1,545") == Decimal("1545") and f.parse_value("-12.5") == Decimal("-12.5") and f.parse_value("45%") == Decimal("45")
    assert f.parse_value("") is None and f.parse_value("-") is None and f.parse_value("abc") is None and f.parse_value("1e99") is None


def test_units_only_when_stated_or_obvious():
    assert f.infer_unit("Sales", "profit_loss", "INR crore") == "INR crore"
    assert f.infer_unit("ROCE %", "ratios", "INR crore") == "%"
    assert f.infer_unit("Debtor Days", "ratios", "INR crore") == "days"
    assert f.infer_unit("EPS in Rs", "profit_loss", "INR crore") == "INR"
    assert f.infer_unit("Mystery ratio", "ratios", "INR crore") is None
    assert f.clean_label("Sales\xa0+") == "Sales"


def test_parse_page_structure():
    facts = f.parse_page(HTML, "consolidated")
    assert {x["statement"] for x in facts} == set(f.STATEMENTS.values())
    q = [x for x in facts if x["statement"] == "quarterly_results" and x["metric"] == "Sales"]
    assert q and all(x["period_type"] == "Q" and x["basis"] == "consolidated" and x["unit"] == "INR crore" for x in q)
    assert q[0]["period_end"] == date(2023, 6, 30) and q[0]["value"] == Decimal("1000")
    assert not any(x["period_end"] is None for x in facts)
    roce = [x for x in facts if x["metric"] == "ROCE %"]
    assert roce and roce[0]["unit"] == "%"


def _seed(db):
    load(db)
    from core.orm import Company
    return db.scalar(select(Company).where(Company.isin == "INE000S01001"))


def test_upsert_is_idempotent_and_never_deletes(db):
    co = _seed(db)
    facts = f.parse_page(HTML, "consolidated")
    n1 = f.upsert_facts(db, co.id, facts, "https://x")
    c1 = db.scalar(select(func.count()).select_from(FinancialFact))
    f.upsert_facts(db, co.id, facts, "https://x")
    assert db.scalar(select(func.count()).select_from(FinancialFact)) == c1 == n1
    assert f.upsert_facts(db, co.id, [], "https://x") == 0          # empty scrape cannot wipe history
    assert db.scalar(select(func.count()).select_from(FinancialFact)) == c1
    changed = [dict(facts[0], value=Decimal("999"))]
    f.upsert_facts(db, co.id, changed, "https://x")
    assert db.scalar(select(FinancialFact.value).where(FinancialFact.metric == facts[0]["metric"], FinancialFact.period_end == facts[0]["period_end"], FinancialFact.statement == facts[0]["statement"])) == Decimal("999")


@pytest.fixture()
def fake_screener(monkeypatch):
    state = {"n": 0, "mode": "ok"}
    def handler(req):
        state["n"] += 1
        if state["mode"] == "429":
            return httpx.Response(429, headers={"Retry-After": "3600"})
        if state["mode"] == "404":
            return httpx.Response(404)
        if state["mode"] == "empty":
            return httpx.Response(200, text="<html><body>no tables</body></html>")
        return httpx.Response(200, text=HTML)
    monkeypatch.setattr(screener, "_client", screener.make_client(transport=httpx.MockTransport(handler), budget=None))
    f._locks.clear(); f._failures.clear()
    return state


def get(client, db):
    load(db); register(client)
    return client.get("/api/v1/companies/search?q=synthalpha").json()["items"][0]["id"]


def test_endpoint_returns_provenance_and_single_scrape(client, db, fake_screener):
    cid = get(client, db)
    r = client.get(f"/api/v1/companies/{cid}/financials?statement=quarterly_results").json()
    assert r["basis"] == "consolidated" and r["source"] == "Screener.in" and r["period_type"] == "Q" and not r["stale"]
    sales = next(x for x in r["rows"] if x["metric"] == "Sales")
    assert sales["unit"] == "INR crore" and sales["values"]["2023-06-30"] == 1000.0
    client.get(f"/api/v1/companies/{cid}/financials?statement=ratios")
    assert fake_screener["n"] == 1  # fresh data is served from the database, not re-scraped


def test_refresh_failure_serves_stale_rows_flagged(client, db, fake_screener):
    cid = get(client, db)
    client.get(f"/api/v1/companies/{cid}/financials")
    db.execute(FinancialFact.__table__.update().values(retrieved_at=datetime.now(timezone.utc) - timedelta(days=30)))
    db.commit()
    fake_screener["mode"] = "429"
    r = client.get(f"/api/v1/companies/{cid}/financials").json()
    assert r["stale"] is True and r["refresh_error"] == "quota" and r["rows"]


def test_not_covered_and_bad_page_are_explicit(client, db, fake_screener):
    cid = get(client, db)
    fake_screener["mode"] = "404"
    r = client.get(f"/api/v1/companies/{cid}/financials")
    assert r.status_code == 404 and r.json()["detail"]["code"] == "not_covered"
    f._locks.clear(); f._failures.clear(); fake_screener["mode"] = "empty"
    assert client.get(f"/api/v1/companies/{cid}/financials").status_code == 503
    assert db.scalar(select(func.count()).select_from(FinancialFact)) == 0   # nothing invented


def test_validation_and_auth(client, db, fake_screener):
    assert client.get("/api/v1/companies/00000000-0000-0000-0000-000000000000/financials").status_code == 401
    cid = get(client, db)
    assert client.get(f"/api/v1/companies/{cid}/financials?statement=bogus").status_code == 422


def test_failed_or_uncovered_company_is_not_refetched_on_every_request(client, db, fake_screener):
    cid = get(client, db)
    fake_screener["mode"] = "404"
    for _ in range(5):
        assert client.get(f"/api/v1/companies/{cid}/financials").status_code == 404
    assert fake_screener["n"] == 2        # one consolidated + one standalone attempt, then the cooldown answers the rest
