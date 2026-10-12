from tests.conftest import csrf_headers, register
from core.orm import User
from sqlalchemy import select

ORIGIN = {"Origin": "http://localhost:8080"}


def test_register_login_logout_me(client, db):
    register(client)
    assert client.get("/auth/me").json()["email"] == "a@example.com"
    user = db.scalar(select(User))
    assert user.password_hash.startswith("$argon2id$")
    assert "correct horse" not in user.password_hash
    assert client.post("/auth/logout", headers=csrf_headers(client)).status_code == 204
    assert client.get("/auth/me").status_code == 401
    r = client.post("/auth/login", json={"email": "A@Example.com", "password": "correct horse battery"}, headers=ORIGIN)
    assert r.status_code == 200 and client.get("/auth/me").status_code == 200


def test_cookie_flags(client):
    r = register(client)
    sc = r.headers.get_list("set-cookie")
    sess = next(c for c in sc if c.startswith("el_session"))
    assert "HttpOnly" in sess and "SameSite=lax" in sess
    assert not any("HttpOnly" in c for c in sc if c.startswith("el_csrf"))


def test_duplicate_email_is_generic_409(client):
    register(client)
    r = client.post("/auth/register", json={"email": "a@example.com", "password": "another long password"}, headers=ORIGIN)
    assert r.status_code == 409 and "exist" not in r.text.lower()


def test_weak_and_invalid_input_rejected(client):
    assert client.post("/auth/register", json={"email": "a@example.com", "password": "short"}, headers=ORIGIN).status_code == 422
    assert client.post("/auth/register", json={"email": "not-an-email", "password": "long enough password"}, headers=ORIGIN).status_code == 422
    assert client.post("/auth/register", json={"email": "a@example.com"}, headers=ORIGIN).status_code == 422


def test_login_wrong_password_and_unknown_user_same_error(client):
    register(client)
    client.cookies.clear()
    a = client.post("/auth/login", json={"email": "a@example.com", "password": "wrong password!!"}, headers=ORIGIN)
    b = client.post("/auth/login", json={"email": "nobody@example.com", "password": "wrong password!!"}, headers=ORIGIN)
    assert a.status_code == b.status_code == 401 and a.json() == b.json()


def test_login_failures_throttled_per_account_and_ip_pair(client):
    register(client)
    client.cookies.clear()
    codes = [client.post("/auth/login", json={"email": "a@example.com", "password": "bad password x"}, headers=ORIGIN).status_code for _ in range(7)]
    assert codes[:5] == [401] * 5 and codes[5] == 429
    r = client.post("/auth/login", json={"email": "a@example.com", "password": "bad password x"}, headers=ORIGIN)
    assert r.status_code == 429 and "retry-after" in r.headers


def test_attacker_cannot_lock_out_victim_from_another_ip(client, app):
    """Failures are counted per (account, ip): guesses from the attacker's IP do not block the victim's own IP."""
    from starlette.testclient import TestClient
    register(client)
    client.cookies.clear()
    attacker = TestClient(app, base_url="http://localhost", client=("203.0.113.9", 5555))
    for _ in range(8):
        attacker.post("/auth/login", json={"email": "a@example.com", "password": "bad password x"}, headers=ORIGIN)
    assert attacker.post("/auth/login", json={"email": "a@example.com", "password": "bad password x"}, headers=ORIGIN).status_code == 429
    ok = client.post("/auth/login", json={"email": "a@example.com", "password": "correct horse battery"}, headers=ORIGIN)
    assert ok.status_code == 200          # victim (different ip) unaffected


def test_success_resets_pair_counter_and_successes_are_not_counted(client):
    register(client)
    for _ in range(12):
        assert client.post("/auth/login", json={"email": "a@example.com", "password": "correct horse battery"}, headers=ORIGIN).status_code == 200


def test_email_normalisation_blocks_variants(client):
    register(client, "first@example.com")
    for variant in ["first+promo@example.com", "FIRST@Example.COM"]:
        r = client.post("/auth/register", json={"email": variant, "password": "another long password"}, headers=ORIGIN)
        assert r.status_code == 409, variant
    register(client, "john.smith@gmail.com")
    assert client.post("/auth/register", json={"email": "johnsmith+x@gmail.com", "password": "another long password"}, headers=ORIGIN).status_code == 409
    for bad in ["a@example.com\u200b", "a\u200b@example.com", "a@exämple.com", "a b@example.com", ".a@example.com", "a..b@example.com"]:
        r = client.post("/auth/register", json={"email": bad, "password": "another long password"}, headers=ORIGIN)
        assert r.status_code == 422, bad
    # fullwidth letters NFKC-fold to the ASCII mailbox, so they cannot create a second account for it
    assert client.post("/auth/register", json={"email": "ｆｉｒｓｔ@example.com", "password": "another long password"}, headers=ORIGIN).status_code == 409


def test_global_registration_cap(client, monkeypatch):
    from core.settings import get_settings
    monkeypatch.setattr(get_settings(), "register_global_per_hour", 2)
    codes = [client.post("/auth/register", json={"email": f"u{i}@example.com", "password": "long enough password"}, headers=ORIGIN).status_code for i in range(3)]
    assert codes == [201, 201, 429]


def test_login_rotates_session_and_logout_all_revokes_every_session(client, app, db):
    from starlette.testclient import TestClient
    from core.orm import AuthSession
    register(client)
    first = client.cookies.get("el_session")
    client.post("/auth/login", json={"email": "a@example.com", "password": "correct horse battery"}, headers=ORIGIN)
    assert client.cookies.get("el_session") != first
    other = TestClient(app, base_url="http://localhost")
    other.post("/auth/login", json={"email": "a@example.com", "password": "correct horse battery"}, headers=ORIGIN)
    assert other.get("/auth/me").status_code == 200
    assert client.post("/auth/logout-all", headers=csrf_headers(client)).status_code == 204
    assert other.get("/auth/me").status_code == 401 and client.get("/auth/me").status_code == 401


def test_logout_requires_csrf_when_session_exists(client):
    register(client)
    assert client.post("/auth/logout", headers=ORIGIN).status_code == 403
    assert client.get("/auth/me").status_code == 200
    assert client.post("/auth/logout", headers=csrf_headers(client)).status_code == 204


def test_non_ascii_csrf_header_is_403_not_500(client):
    register(client)
    r = client.post("/api/v1/watchlists", json={"name": "x"}, headers={"X-CSRF-Token": "caf\u00e9".encode("latin-1"), "Origin": "http://localhost:8080"})
    assert r.status_code == 403


def test_idle_session_expires(client, db):
    from datetime import timedelta
    from sqlalchemy import select
    from core.orm import AuthSession, utcnow
    register(client)
    s = db.scalar(select(AuthSession))
    s.last_seen_at = utcnow() - timedelta(hours=100)
    db.commit()
    assert client.get("/auth/me").status_code == 401


def test_purge_expired_removes_stale_rows(client, db):
    from datetime import timedelta
    from sqlalchemy import select
    from core.orm import AuthSession, utcnow
    from core.security import purge_expired
    register(client)
    s = db.scalar(select(AuthSession)); s.expires_at = utcnow() - timedelta(seconds=1); db.commit()
    assert purge_expired(db)["sessions"] == 1


def test_client_ip_uses_trusted_hop_not_leftmost(monkeypatch):
    from starlette.requests import Request
    from core.security import client_ip
    from core.settings import get_settings
    def req(xff):
        return Request({"type": "http", "headers": [(b"x-forwarded-for", xff.encode())] if xff else [], "client": ("10.0.0.5", 1)})
    assert client_ip(req("1.2.3.4")) == "10.0.0.5"                                   # hops=0: ignore XFF entirely
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", 2)
    assert client_ip(req("9.9.9.9, 198.51.100.7, 10.1.1.1")) == "198.51.100.7"        # [client(spoofable)..., real hops, peer]
    assert client_ip(req("")) == "10.0.0.5"                                           # short chain -> peer
    assert client_ip(req("8.8.8.8")) == "10.0.0.5"


def test_cors_exposes_retry_after_and_500_has_cors(app, client, db):
    from fastapi import APIRouter
    from fastapi.testclient import TestClient
    boom = APIRouter()
    @boom.get("/boom")
    def _b():
        raise RuntimeError("x")
    app.include_router(boom)
    c = TestClient(app, base_url="http://localhost", raise_server_exceptions=False)
    r = c.get("/boom", headers={"Origin": "http://localhost:8080"})
    assert r.status_code == 500 and r.headers.get("access-control-allow-origin") == "http://localhost:8080"
    ok = client.get("/health", headers={"Origin": "http://localhost:8080"})
    assert "Retry-After" in ok.headers.get("access-control-expose-headers", "")
def test_disallowed_origin_rejected(client):
    r = client.post("/auth/register", json={"email": "b@example.com", "password": "long enough password"}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


def test_expired_session_rejected(client, db):
    from datetime import timedelta
    from core.orm import AuthSession, utcnow
    register(client)
    s = db.scalar(select(AuthSession))
    s.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert client.get("/auth/me").status_code == 401


def test_health_and_ready(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/ready").json()["database"] is True


def test_per_ip_ceilings_are_skipped_when_only_a_private_proxy_address_is_visible(app, db):
    """Behind Render's load balancer every user shares one private peer address: a per-IP ceiling would let 30 bad requests lock out all
    users, so it must not apply (per-account/pair counters and the global registration cap still do)."""
    from starlette.testclient import TestClient
    from core.settings import get_settings
    proxy = TestClient(app, base_url="http://localhost", client=("10.1.2.3", 4000))
    s = get_settings()
    old = s.login_fail_per_ip
    s.login_fail_per_ip = 3
    try:
        for i in range(8):                                     # 8 failures against 8 different accounts from the shared proxy address
            proxy.post("/auth/login", json={"email": f"nobody{i}@example.com", "password": "bad password x"}, headers=ORIGIN)
        client2 = TestClient(app, base_url="http://localhost", client=("10.1.2.3", 4001))
        client2.post("/auth/register", json={"email": "legit@example.com", "password": "long enough password"}, headers=ORIGIN)
        ok = client2.post("/auth/login", json={"email": "legit@example.com", "password": "long enough password"}, headers=ORIGIN)
        assert ok.status_code == 200                           # not locked out by other people's failures
        # ...whereas a public peer address IS subject to the per-IP ceiling
        pub = TestClient(app, base_url="http://localhost", client=("8.8.8.8", 4002))
        for i in range(4):
            pub.post("/auth/login", json={"email": f"x{i}@example.com", "password": "bad password x"}, headers=ORIGIN)
        assert pub.post("/auth/login", json={"email": "legit@example.com", "password": "long enough password"}, headers=ORIGIN).status_code == 429
    finally:
        s.login_fail_per_ip = old
