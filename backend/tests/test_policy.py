"""Data-source policy: restricted sources are OFF in the public profile and say why; nothing is fabricated in their place."""
import pytest
from starlette.testclient import TestClient

from core.settings import get_settings
from tests.conftest import csrf_headers, register
from tests.test_companies import load

W = "/api/v1/watchlists"


@pytest.fixture()
def public(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "data_profile", "public")
    for f in ("enable_screener", "enable_yahoo", "enable_nse_index", "enable_news", "enable_news_excerpts"):
        monkeypatch.setattr(s, f, None)
    return s


def company_id(client, db):
    load(db); register(client)
    return client.get("/api/v1/companies/search?q=synthalpha").json()["items"][0]["id"]


def test_capabilities_is_public_and_explains_disabled_sources(client, public):
    r = client.get("/api/v1/capabilities")
    assert r.status_code == 200
    c = r.json()
    assert c["profile"] == "public"
    for k in ("market_data", "fundamentals", "index_segments"):
        assert c[k]["enabled"] is False and "licen" in c[k]["reason"] or "pending" in c[k]["reason"]
    assert c["news"]["enabled"] is False and "Exa" in c["news"]["reason"] and c["news"]["excerpts_displayed"] is False
    assert c["ai"]["research"] is False and c["ai"]["reason"] and c["ai"]["copilot_provider"] == "groq"
    assert "key" not in str(c).lower()


def test_profile_defaults(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "data_profile", None)
    monkeypatch.setattr(s, "environment", "production")
    assert s.profile == "public" and not s.source_enabled("yahoo")
    monkeypatch.setattr(s, "environment", "development")
    assert s.profile == "personal" and s.source_enabled("yahoo")
    monkeypatch.setattr(s, "enable_yahoo", False)
    assert not s.source_enabled("yahoo") and s.source_enabled("screener")  # explicit override wins


@pytest.mark.parametrize("path", ["quote", "history", "financials"])
def test_restricted_company_endpoints_return_source_disabled_and_make_no_provider_call(client, db, public, path, monkeypatch):
    from providers import screener, yahoo
    def boom(*a, **k):
        raise AssertionError("provider must not be called when its source is disabled")
    monkeypatch.setattr(yahoo, "get_quote", boom); monkeypatch.setattr(yahoo, "get_history", boom)
    monkeypatch.setattr(screener, "fetch_company_page", boom)
    cid = company_id(client, db)
    r = client.get(f"/api/v1/companies/{cid}/{path}")
    assert r.status_code == 503 and r.json()["detail"]["code"] == "source_disabled" and r.json()["detail"]["message"]


def test_movers_snapshot_compare_and_filters_are_gated(client, db, public, monkeypatch):
    from providers import yahoo
    monkeypatch.setattr(yahoo, "get_quote", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no provider call")))
    cid = company_id(client, db)
    assert client.get("/api/v1/market/movers?segment=mid").json()["detail"]["code"] == "source_disabled"
    assert client.get("/api/v1/companies/search?q=synth&segment=mid").json()["detail"]["code"] == "source_disabled"
    assert client.get("/api/v1/companies/search?q=synth&sector=Information%20Technology").status_code == 503
    h = csrf_headers(client)
    wl = client.post(W, json={"name": "P"}, headers=h).json()
    client.post(f"{W}/{wl['id']}/items", json={"company_id": cid}, headers=h)
    snap = client.get(f"{W}/{wl['id']}/snapshot").json()
    assert snap["rows"][0]["status"] == "unavailable" and snap["rows"][0]["reason"] == "source_disabled" and snap["rows"][0]["price"] is None
    r = client.post(f"{W}/{wl['id']}/compare", json={}, headers=h)
    assert r.status_code == 503 and r.json()["detail"]["code"] == "source_disabled"


def test_sector_not_exposed_when_index_source_disabled(client, db, public):
    from core.orm import Company
    load(db); register(client)
    co = db.query(Company).filter(Company.isin == "INE000S01001").one()
    co.sector = "Information Technology"; db.commit()
    item = client.get("/api/v1/companies/search?q=synthalpha").json()["items"][0]
    assert item["sector"] is None


def test_public_profile_with_no_enabled_source_refuses_news_research_and_copilot(client, db, public, monkeypatch):
    """Strict default: every evidence source is off, so the AI features refuse instead of producing empty/invented output, and make no provider or LLM call."""
    from providers import exa, gemini, groq
    from core.orm import ResearchJob
    from sqlalchemy import select
    boom = lambda *a, **k: (_ for _ in ()).throw(AssertionError("no provider/LLM call may happen"))
    monkeypatch.setattr(exa, "search_news", boom); monkeypatch.setattr(groq, "chat_json", boom); monkeypatch.setattr(gemini, "chat_json", boom)
    cid = company_id(client, db)
    n = client.get(f"/api/v1/companies/{cid}/news")
    assert n.status_code == 503 and n.json()["detail"]["code"] == "source_disabled" and "Exa" in n.json()["detail"]["message"]
    r = client.post(f"/api/v1/research/{cid}", headers=csrf_headers(client))
    assert r.status_code == 503 and r.json()["detail"]["code"] == "source_disabled"
    assert db.scalars(select(ResearchJob)).all() == []                       # no job was created
    a = client.post("/api/v1/ask", json={"company_id": cid, "question": "What happened recently?"}, headers=csrf_headers(client))
    assert a.status_code == 503 and a.json()["detail"]["code"] == "source_disabled"


def test_excerpts_require_news_and_each_source_has_its_own_switch(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "data_profile", "personal")
    for f in ("enable_screener", "enable_yahoo", "enable_nse_index", "enable_news", "enable_news_excerpts"):
        monkeypatch.setattr(s, f, None)
    assert s.source_enabled("news") and s.source_enabled("news_excerpts")
    monkeypatch.setattr(s, "enable_news", False)
    assert not s.source_enabled("news") and not s.source_enabled("news_excerpts")      # excerpts are a subset of news
    monkeypatch.setattr(s, "enable_news", True); monkeypatch.setattr(s, "data_profile", "public")
    assert s.source_enabled("news") and not s.source_enabled("news_excerpts")           # enabling news alone never enables excerpts


def test_research_marks_restricted_dimensions_unavailable_not_neutral(client, db, public, monkeypatch):
    import httpx, json
    monkeypatch.setattr(public, "enable_news", True)       # owner explicitly enabled headlines only; Screener stays off
    from pathlib import Path
    from providers import exa, groq
    from providers.base import TTLCache
    from tests.test_research import FakeLLM
    FX = Path(__file__).parent / "fixtures"
    exa.cache = TTLCache()
    seen = {}
    def exa_h(req):
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json=json.loads((FX / "synthetic_exa_news.json").read_text()))
    monkeypatch.setattr(exa, "_client", exa.make_client("k", transport=httpx.MockTransport(exa_h), budget=None))
    monkeypatch.setattr(groq, "chat_json", FakeLLM())
    cid = company_id(client, db)
    from tests.conftest import run_research
    out = run_research(client, cid).json()
    d = {x["key"]: x for x in out["dimensions"]}
    assert d["fundamental"]["status"] == "unavailable" and d["alternative"]["status"] == "unavailable"
    assert d["fundamental"]["score"] is None and out["overall"]["score"] == d["sentiment"]["score"]
    assert "contents" not in seen["body"]            # headline-only request: no article text fetched in the public profile


def test_news_excerpts_not_fetched_or_returned_in_public_profile(client, db, public, monkeypatch):
    import httpx, json
    monkeypatch.setattr(public, "enable_news", True)
    from pathlib import Path
    from providers import exa
    from providers.base import TTLCache
    exa.cache = TTLCache()
    FX = Path(__file__).parent / "fixtures"
    seen = {}
    def h(req):
        seen["body"] = json.loads(req.content)
        data = json.loads((FX / "synthetic_exa_news.json").read_text())
        if "contents" not in seen["body"]:
            for r in data["results"]:
                r.pop("text", None)
        return httpx.Response(200, json=data)
    monkeypatch.setattr(exa, "_client", exa.make_client("k", transport=httpx.MockTransport(h), budget=None))
    cid = company_id(client, db)
    r = client.get(f"/api/v1/companies/{cid}/news").json()
    assert "contents" not in seen["body"] and r["items"] and all(i["excerpt"] is None for i in r["items"])


def test_copilot_provider_selection_protects_user_text(monkeypatch):
    from providers import gemini, groq
    from services import copilot
    s = get_settings()
    monkeypatch.setattr(s, "data_profile", "public")
    monkeypatch.setattr(s, "copilot_provider", "gemini"); monkeypatch.setattr(s, "gemini_billing_enabled", False)
    assert copilot.select_llm() is groq.chat_json                       # free-tier Gemini may train on prompts -> not used publicly
    monkeypatch.setattr(s, "gemini_billing_enabled", True)
    assert copilot.select_llm() is gemini.chat_json
    monkeypatch.setattr(s, "copilot_provider", "groq")
    assert copilot.select_llm() is groq.chat_json


def test_live_provider_calls_are_blocked_in_tests():
    from providers import yahoo
    from providers.base import ProviderClient
    c = ProviderClient(name="x", base_url="https://example.invalid")
    with pytest.raises(RuntimeError, match="blocked in test"):
        c.request("GET", "/")
