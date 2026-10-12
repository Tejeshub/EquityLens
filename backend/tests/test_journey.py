"""API-level end-to-end journey with two users (provider responses are synthetic fixtures; not a live-provider test)."""
import json
from pathlib import Path

import httpx
from starlette.testclient import TestClient

from providers import exa, gemini, groq, screener, yahoo
from providers.base import TTLCache
from services import copilot, fundamentals as fund
from tests.conftest import csrf_headers, register
from tests.test_companies import load
from tests.test_research import FakeLLM
from tests.test_copilot import FakeAnswerLLM

FX = Path(__file__).parent / "fixtures"


def test_primary_journey_and_second_user_isolation(app, client, db, monkeypatch):
    html = (FX / "synthetic_screener_tables.html").read_text()
    exa.cache = TTLCache(); yahoo.cache = TTLCache(); fund._locks.clear()
    chart = json.loads((FX / "synthetic_yahoo_chart_5d.json").read_text())
    monkeypatch.setattr(yahoo, "_client", yahoo.make_client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=chart)), budget=None))
    monkeypatch.setattr(exa, "_client", exa.make_client("k", transport=httpx.MockTransport(lambda r: httpx.Response(200, json=json.loads((FX / "synthetic_exa_news.json").read_text()))), budget=None))
    monkeypatch.setattr(screener, "_client", screener.make_client(transport=httpx.MockTransport(lambda r: httpx.Response(200, text=html)), budget=None))
    monkeypatch.setattr(groq, "chat_json", FakeLLM())
    monkeypatch.setattr(gemini, "chat_json", FakeAnswerLLM())
    load(db)
    register(client)                                                                    # 1 register
    cid = client.get("/api/v1/companies/search?q=synthalpha").json()["items"][0]["id"]  # 3 search
    assert client.get(f"/api/v1/companies/{cid}/quote").json()["price"] > 0             # 5 quote
    assert client.get(f"/api/v1/companies/{cid}/history?range=1mo").json()["bars"]
    assert client.get(f"/api/v1/companies/{cid}/news").json()["items"]                  # 6 news
    assert client.get(f"/api/v1/companies/{cid}/financials").json()["rows"]
    h = csrf_headers(client)
    from tests.conftest import run_research
    rep = run_research(client, cid).json()                                               # 7 research (job -> report)
    assert rep["overall"]["score"] is not None
    assert client.post("/api/v1/ask", json={"company_id": cid, "question": "What were quarterly sales?"}, headers=h).json()["grounded"]  # 9 copilot
    wl = client.post("/api/v1/watchlists", json={"name": "Mine"}, headers=h).json()     # 10
    assert client.post(f"/api/v1/watchlists/{wl['id']}/items", json={"company_id": cid}, headers=h).status_code == 201
    client.post("/auth/logout", headers=csrf_headers(client))            # 13 sign out
    assert client.get("/api/v1/watchlists").status_code == 401 and client.get(f"/api/v1/research/latest?company_id={cid}").status_code == 401
    client.post("/auth/login", json={"email": "a@example.com", "password": "correct horse battery"}, headers={"Origin": "http://localhost:8080"})
    assert client.get("/api/v1/watchlists").json()[0]["items"]                          # 12 persistence across sessions
    c2 = TestClient(app, base_url="http://localhost"); register(c2, "b@example.com")    # 14 second user
    assert c2.get("/api/v1/watchlists").json() == []
    assert c2.get(f"/api/v1/research/{rep['id']}").status_code == 404
    assert c2.get(f"/api/v1/research/latest?company_id={cid}").status_code == 404
    assert c2.get(f"/api/v1/watchlists/{wl['id']}/snapshot").status_code == 404
