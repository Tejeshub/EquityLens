"""PROVIDER_MODE=fixture: offline deterministic providers used by the browser E2E suite. Must never be reachable in production."""
import pytest

from core.settings import get_settings
from providers import exa, fixtures, gemini, groq, screener, yahoo
from providers.base import TTLCache
from tests.conftest import csrf_headers, register, run_research
from tests.test_companies import load


@pytest.fixture()
def fx(monkeypatch):
    monkeypatch.setattr(get_settings(), "provider_mode", "fixture")
    for m in (yahoo, exa, screener, groq, gemini):
        monkeypatch.setattr(m, "_client", None)
    yahoo.cache = TTLCache(); exa.cache = TTLCache()
    from services import fundamentals
    fundamentals._locks.clear()
    monkeypatch.setenv("FIXTURE_LLM_DELAY_MS", "0")
    yield
    for m in (yahoo, exa, screener, groq, gemini):
        m._client = None


def cid(client, db, q="synthalpha"):
    load(db); register(client)
    return client.get(f"/api/v1/companies/search?q={q}").json()["items"][0]["id"]


def test_production_refuses_fixture_mode(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production"); monkeypatch.setenv("PROVIDER_MODE", "fixture"); monkeypatch.setenv("ALLOWED_ORIGINS", "https://x.example"); monkeypatch.delenv("RESEARCH_JOBS_INLINE", raising=False)
    get_settings.cache_clear()
    try:
        from core.app import create_base_app
        with pytest.raises(RuntimeError, match="fixture"):
            create_base_app()
    finally:
        monkeypatch.setenv("ENVIRONMENT", "test"); monkeypatch.delenv("PROVIDER_MODE", raising=False); monkeypatch.setenv("RESEARCH_JOBS_INLINE", "true")
        get_settings.cache_clear()


def test_every_data_endpoint_works_offline_and_ranges_differ(client, db, fx):
    c = cid(client, db)
    assert client.get(f"/api/v1/companies/{c}/quote").json()["price"] > 0
    lens = {r: len(client.get(f"/api/v1/companies/{c}/history?range={r}").json()["bars"]) for r in ("1mo", "3mo", "1y")}
    assert lens["1mo"] < lens["3mo"] < lens["1y"]
    assert client.get(f"/api/v1/companies/{c}/news").json()["items"]
    assert client.get(f"/api/v1/companies/{c}/financials").json()["rows"]


def test_failure_triggers_by_symbol(client, db, fx):
    load(db); register(client)
    beta = client.get("/api/v1/companies/search?q=synthbeta").json()["items"][0]["id"]
    r = client.get(f"/api/v1/companies/{beta}/quote")
    assert r.status_code == 429 and r.json()["detail"]["code"] == "quota"


def test_research_and_copilot_run_end_to_end_on_fixtures(client, db, fx):
    c = cid(client, db)
    rep = run_research(client, c).json()
    assert rep["status"] == "complete" and all(d["status"] == "ok" for d in rep["dimensions"])
    a = client.post("/api/v1/ask", json={"company_id": c, "question": "What do the quarterly results show?"}, headers=csrf_headers(client)).json()
    assert a["grounded"] is True and a["citations"]
    bad = client.post("/api/v1/ask", json={"company_id": c, "question": "FAIL_PROVIDER please quarterly results"}, headers=csrf_headers(client))
    assert bad.status_code == 503 and "answer" not in bad.json()["detail"]
