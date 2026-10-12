from pathlib import Path

from tests.conftest import register
from services.companies import import_nse_equity_list, parse_nse_equity_csv

SAMPLE = """SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
SYNTHALPHA,Synthetic Alpha Limited,EQ,01-JAN-2000,10,1,INE000S01001,10
SYNTHBETA,Synthetic Beta Limited,EQ,01-JAN-2000,10,1,INE000S01002,10
SYNTHGAMMA,Synthetic Gamma Limited,EQ,01-JAN-2000,10,1,INE000S01003,10
BADROW,No Isin Ltd,EQ,01-JAN-2000,10,1,,10
50%OFF,Percent_Co Limited,EQ,01-JAN-2000,10,1,INE000A01010,10
"""


def load(db):
    rows = parse_nse_equity_csv(SAMPLE)
    return rows, import_nse_equity_list(db, rows)


def test_parse_skips_rows_without_valid_isin():
    rows = parse_nse_equity_csv(SAMPLE)
    assert {r["symbol"] for r in rows} == {"SYNTHALPHA", "SYNTHBETA", "SYNTHGAMMA", "50%OFF"}


def test_import_idempotent(db):
    _, r1 = load(db)
    _, r2 = load(db)
    assert r1["inserted"] == 4 and r2["inserted"] == 0 and r2["updated"] == 4


def test_empty_or_short_import_never_deactivates(db):
    load(db)
    assert import_nse_equity_list(db, [])["inserted"] == 0
    r = import_nse_equity_list(db, parse_nse_equity_csv(SAMPLE)[:1])
    assert r["deactivated"] == 0


def auth(client):
    register(client)


def test_search_requires_auth(client):
    assert client.get("/api/v1/companies/search?q=per").status_code == 401


def test_search_ranking_and_shape(client, db):
    load(db); auth(client)
    r = client.get("/api/v1/companies/search?q=synthalpha").json()
    assert r["items"][0]["primary_symbol"] == "SYNTHALPHA" and r["total"] >= 1
    assert r["items"][0]["listings"] == [{"exchange": "NSE", "symbol": "SYNTHALPHA"}]
    assert r["items"][0]["sector"] is None
    assert client.get("/api/v1/companies/search?q=INE000S01002").json()["items"][0]["primary_symbol"] == "SYNTHBETA"


def test_search_no_results_and_wildcards_literal(client, db):
    load(db); auth(client)
    assert client.get("/api/v1/companies/search?q=zzzz").json() == {"items": [], "total": 0, "limit": 10, "offset": 0, "source": "NSE equity list"}
    assert client.get("/api/v1/companies/search?q=50%25").json()["total"] == 1  # literal %, not a wildcard
    assert client.get("/api/v1/companies/search?q=%25").json()["total"] == 0
    assert client.get("/api/v1/companies/search?q=_").json()["total"] == 1


def test_search_bounds_validated(client, db):
    load(db); auth(client)
    assert client.get("/api/v1/companies/search?q=a&limit=1000").status_code == 422
    assert client.get("/api/v1/companies/search?q=a&offset=-1").status_code == 422
    assert client.get("/api/v1/companies/search?q=").status_code == 422
    assert client.get("/api/v1/companies/search?q=" + "a" * 61).status_code == 422


def test_pagination(client, db):
    load(db); auth(client)
    a = client.get("/api/v1/companies/search?q=limited&limit=1&offset=0").json()
    b = client.get("/api/v1/companies/search?q=limited&limit=1&offset=1").json()
    assert a["items"][0]["id"] != b["items"][0]["id"] and a["total"] >= 3


def test_get_company_404_and_bad_uuid(client, db):
    auth(client)
    assert client.get("/api/v1/companies/00000000-0000-0000-0000-000000000000").status_code == 404
    assert client.get("/api/v1/companies/not-a-uuid").status_code == 422
