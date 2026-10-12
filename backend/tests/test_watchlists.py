import pytest
from starlette.testclient import TestClient

from tests.conftest import csrf_headers, register
from tests.test_companies import load
from tests.test_market import fake_yahoo  # noqa: F401  (autouse provider double)

W = "/api/v1/watchlists"


def first_ids(client):
    items = client.get("/api/v1/companies/search?q=limited&limit=5").json()["items"]
    return [i["id"] for i in items]


def mk(client, name="Core"):
    r = client.post(W, json={"name": name}, headers=csrf_headers(client))
    assert r.status_code == 201, r.text
    return r.json()


def second_user(app):
    c2 = TestClient(app, base_url="http://localhost")
    register(c2, "b@example.com")
    return c2


def test_requires_auth(client):
    assert client.get(W).status_code == 401
    assert client.post(W, json={"name": "x"}).status_code == 401


def test_csrf_required_for_mutations(client, db):
    register(client)
    assert client.post(W, json={"name": "x"}, headers={"Origin": "http://localhost:8080"}).status_code == 403
    assert client.post(W, json={"name": "x"}, headers={"X-CSRF-Token": "wrong", "Origin": "http://localhost:8080"}).status_code == 403


def test_crud_and_persistence_across_logout_login(client, db):
    load(db); register(client)
    ids = first_ids(client)
    wl = mk(client)
    h = csrf_headers(client)
    r = client.post(f"{W}/{wl['id']}/items", json={"company_id": ids[0]}, headers=h)
    assert r.status_code == 201 and len(r.json()["items"]) == 1
    assert client.post(f"{W}/{wl['id']}/items", json={"company_id": ids[0]}, headers=h).status_code == 409  # duplicate
    assert client.patch(f"{W}/{wl['id']}", json={"name": "Renamed"}, headers=h).json()["name"] == "Renamed"
    client.post("/auth/logout", headers=csrf_headers(client))
    client.post("/auth/login", json={"email": "a@example.com", "password": "correct horse battery"}, headers={"Origin": "http://localhost:8080"})
    lists = client.get(W).json()
    assert lists[0]["name"] == "Renamed" and lists[0]["items"][0]["company_id"] == ids[0]
    h = csrf_headers(client)
    assert client.delete(f"{W}/{wl['id']}/items/{ids[0]}", headers=h).status_code == 204
    assert client.delete(f"{W}/{wl['id']}/items/{ids[0]}", headers=h).status_code == 404
    assert client.delete(f"{W}/{wl['id']}", headers=h).status_code == 204
    assert client.get(W).json() == []


def test_validation_and_limits(client, db):
    load(db); register(client)
    h = csrf_headers(client)
    assert client.post(W, json={"name": "   "}, headers=h).status_code == 422
    assert client.post(W, json={"name": "x" * 81}, headers=h).status_code == 422
    mk(client, "A")
    assert client.post(W, json={"name": "A"}, headers=h).status_code == 409
    wl = mk(client, "B")
    assert client.post(f"{W}/{wl['id']}/items", json={"company_id": "00000000-0000-0000-0000-000000000000"}, headers=h).status_code == 404
    assert client.post(f"{W}/{wl['id']}/items", json={"company_id": "nope"}, headers=h).status_code == 422


def test_cross_user_isolation(client, app, db):
    load(db); register(client)
    ids = first_ids(client)
    wl = mk(client, "Private")
    h = csrf_headers(client)
    client.post(f"{W}/{wl['id']}/items", json={"company_id": ids[0]}, headers=h)
    c2 = second_user(app)
    h2 = csrf_headers(c2)
    assert c2.get(W).json() == []                                                         # cannot enumerate
    assert c2.get(f"{W}/{wl['id']}/snapshot").status_code == 404                          # cannot read
    assert c2.patch(f"{W}/{wl['id']}", json={"name": "hacked"}, headers=h2).status_code == 404
    assert c2.post(f"{W}/{wl['id']}/items", json={"company_id": ids[1]}, headers=h2).status_code == 404
    assert c2.delete(f"{W}/{wl['id']}/items/{ids[0]}", headers=h2).status_code == 404
    assert c2.delete(f"{W}/{wl['id']}", headers=h2).status_code == 404
    mine = client.get(W).json()
    assert mine[0]["name"] == "Private" and len(mine[0]["items"]) == 1                   # untouched
    # same name allowed for a different user (uniqueness is per user)
    assert c2.post(W, json={"name": "Private"}, headers=h2).status_code == 201


def test_item_cap(client, db):
    load(db); register(client)
    h = csrf_headers(client)
    wl = mk(client)
    from core.orm import Company
    from sqlalchemy import select
    cos = db.scalars(select(Company)).all()
    # only 4 companies in the sample; cap behaviour is exercised by lowering the cap
    import routers.watchlists as w
    old, w.MAX_ITEMS = w.MAX_ITEMS, 2
    try:
        codes = [client.post(f"{W}/{wl['id']}/items", json={"company_id": str(c.id)}, headers=h).status_code for c in cos[:3]]
    finally:
        w.MAX_ITEMS = old
    assert codes == [201, 201, 422]


def test_snapshot_partial_failure_is_explicit(client, db, fake_yahoo):
    load(db); register(client)
    ids = first_ids(client)
    h = csrf_headers(client)
    wl = mk(client)
    client.post(f"{W}/{wl['id']}/items", json={"company_id": ids[0]}, headers=h)
    snap = client.get(f"{W}/{wl['id']}/snapshot").json()
    assert snap["delayed"] is True and snap["rows"][0]["status"] == "ok" and snap["rows"][0]["price"] > 0
    from providers import yahoo
    yahoo.cache.clear()
    fake_yahoo["mode"] = "429"
    row = client.get(f"{W}/{wl['id']}/snapshot").json()["rows"][0]
    assert row["status"] == "unavailable" and row["reason"] == "quota" and row["price"] is None


def test_compare_uses_reported_figures_and_discloses_unavailable(client, db, monkeypatch):
    import httpx
    from pathlib import Path
    from providers import screener
    from services import fundamentals as f
    html = (Path(__file__).parent / "fixtures" / "synthetic_screener_tables.html").read_text()
    def handler(req):
        return httpx.Response(404) if "SYNTHBETA" in req.url.path else httpx.Response(200, text=html)
    monkeypatch.setattr(screener, "_client", screener.make_client(transport=httpx.MockTransport(handler), budget=None))
    f._locks.clear()
    load(db); register(client)
    ids = {i["primary_symbol"]: i["id"] for i in client.get("/api/v1/companies/search?q=limited&limit=5").json()["items"]}
    h = csrf_headers(client)
    wl = mk(client)
    for sym in ("SYNTHALPHA", "SYNTHBETA"):
        cid = client.get(f"/api/v1/companies/search?q={sym}").json()["items"][0]["id"]
        client.post(f"{W}/{wl['id']}/items", json={"company_id": cid}, headers=h)
    out = client.post(f"{W}/{wl['id']}/compare", json={"statement": "quarterly_results"}, headers=h).json()
    by = {c["symbol"]: c for c in out["companies"]}
    assert by["SYNTHALPHA"]["status"] == "ok" and by["SYNTHALPHA"]["period"] == "2026-06-30"
    assert by["SYNTHBETA"]["status"] == "unavailable" and by["SYNTHBETA"]["reason"] == "not_found"
    sales = next(r for r in out["rows"] if r["metric"] == "Sales")
    assert sales["values"][by["SYNTHALPHA"]["company_id"]] == 1120.0 and sales["values"][by["SYNTHBETA"]["company_id"]] is None
    assert out["kind"] == "reported" and "No ranking" in out["notice"]


def test_compare_needs_two_companies_and_valid_statement_and_ownership(client, app, db):
    load(db); register(client)
    h = csrf_headers(client)
    wl = mk(client)
    assert client.post(f"{W}/{wl['id']}/compare", json={}, headers=h).status_code == 422
    assert client.post(f"{W}/{wl['id']}/compare", json={"statement": "bogus"}, headers=h).status_code == 422
    c2 = second_user(app)
    assert c2.post(f"{W}/{wl['id']}/compare", json={}, headers=csrf_headers(c2)).status_code == 404
