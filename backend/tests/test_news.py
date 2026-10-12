import json
from pathlib import Path

import httpx
import pytest

from providers import exa
from providers.base import TTLCache
from services import news
from tests.conftest import register
from tests.test_companies import load

EXA = json.loads((Path(__file__).parent / "fixtures" / "synthetic_exa_news.json").read_text())  # synthetic fixture


@pytest.fixture(autouse=True)
def fake_exa(monkeypatch):
    exa.cache = TTLCache()
    state = {"n": 0, "mode": "ok", "payload": EXA}
    def handler(req):
        state["n"] += 1
        if state["mode"] == "429":
            return httpx.Response(429, headers={"Retry-After": "3600"})
        if state["mode"] == "html":
            return httpx.Response(200, text="<html>nope</html>")
        return httpx.Response(200, json=state["payload"])
    monkeypatch.setattr(exa, "_client", exa.make_client("test-key", transport=httpx.MockTransport(handler), budget=None))
    return state


def cid(client, db):
    load(db); register(client)
    return client.get("/api/v1/companies/search?q=synthalpha").json()["items"][0]["id"]


def test_build_items_dedupes_sorts_and_never_fabricates():
    results = [
        {"title": "A story", "url": "https://www.site.com/a?utm_source=x", "publishedDate": "2026-10-01T00:00:00Z", "text": "body"},
        {"title": "A story (copy)", "url": "https://site.com/a/", "publishedDate": "2026-10-01T00:00:00Z"},   # same URL
        {"title": "A STORY", "url": "https://other.com/z", "publishedDate": "2026-10-02T00:00:00Z"},          # same title
        {"title": "Newer", "url": "https://n.com/1", "publishedDate": "2026-10-05T00:00:00Z"},
        {"title": "No date", "url": "https://n.com/2"},
        {"title": "", "url": "https://n.com/3"},                    # no title -> dropped
        {"title": "Bad link", "url": "javascript:alert(1)"},        # non-http -> dropped
    ]
    items = news.build_items(results, 10)
    assert [i["title"] for i in items] == ["Newer", "A story", "No date"]
    assert items[2]["published_at"] is None and items[0]["source"] == "n.com" and items[1]["excerpt"] == "body"


def test_endpoint_shape_and_attribution(client, db, fake_exa):
    c = cid(client, db)
    r = client.get(f"/api/v1/companies/{c}/news?limit=3").json()
    assert 0 < len(r["items"]) <= 3 and r["total"] >= len(r["items"])
    assert all(i["url"].startswith("http") and i["title"] for i in r["items"])
    assert r["cached"] is False and "publishers" in r["attribution"]
    assert client.get(f"/api/v1/companies/{c}/news?limit=3").json()["cached"] is True
    assert fake_exa["n"] == 1


def test_pagination_bounds(client, db):
    c = cid(client, db)
    assert client.get(f"/api/v1/companies/{c}/news?limit=21").status_code == 422
    assert client.get(f"/api/v1/companies/{c}/news?offset=41").status_code == 422
    assert client.get(f"/api/v1/companies/{c}/news?limit=2&offset=40").json()["items"] == []


def test_quota_and_bad_payload_are_explicit_errors(client, db, fake_exa):
    c = cid(client, db)
    fake_exa["mode"] = "429"
    r = client.get(f"/api/v1/companies/{c}/news")
    assert r.status_code == 429 and r.json()["detail"]["code"] == "quota" and fake_exa["n"] == 1
    exa.cache.clear(); fake_exa["mode"] = "html"
    assert client.get(f"/api/v1/companies/{c}/news").status_code == 502


def test_requires_auth(client):
    assert client.get("/api/v1/companies/00000000-0000-0000-0000-000000000000/news").status_code == 401
