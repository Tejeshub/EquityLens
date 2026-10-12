"""Password hashing, session tokens, CSRF checks and auth dependencies."""
import hashlib
import hmac
import secrets
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.db import get_session
from core.orm import AuthSession, User, utcnow
from core.settings import get_settings

SESSION_COOKIE = "el_session"
CSRF_COOKIE = "el_csrf"
CSRF_HEADER = "x-csrf-token"
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

_hasher = PasswordHasher()  # Argon2id defaults (~64 MiB, t=3)
# Verified against when the account does not exist, to keep login timing uniform.
_DUMMY_HASH = _hasher.hash("equitylens-dummy-password")
_hash_slots = threading.BoundedSemaphore(get_settings().hash_concurrency)


@contextmanager
def _hash_slot():
    """Bound concurrent Argon2 work so a burst of auth requests cannot exhaust memory on a small instance."""
    if not _hash_slots.acquire(timeout=3.0):
        raise HTTPException(status_code=503, detail="Server is busy; please retry shortly", headers={"Retry-After": "3"})
    try:
        yield
    finally:
        _hash_slots.release()


def hash_password(password: str) -> str:
    with _hash_slot():
        return _hasher.hash(password)


def verify_password(password_hash: Optional[str], password: str) -> bool:
    try:
        with _hash_slot():
            return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def ip_is_reliable(request: Request) -> bool:
    """False when the only address we can see is a private/loopback proxy hop (e.g. Render's load balancer) and no trusted-hop
    configuration tells us the real client. Per-IP ceilings are then DISABLED: they would pool every user behind one address, letting
    a handful of bad requests lock everybody out. Per-(account,IP) and per-account counters and the global caps still apply."""
    import ipaddress
    if get_settings().trusted_proxy_hops > 0:
        return True
    host = request.client.host if request.client else ""
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return True  # not an IP literal (e.g. the in-process test client): treat as a distinct client
    return not (ip.is_private or ip.is_loopback or ip.is_link_local)


def client_ip(request: Request) -> str:
    """Client address for throttling. With TRUSTED_PROXY_HOPS=N the client is taken from the N-th trusted hop of
    X-Forwarded-For (never the left-most, attacker-controlled entry). Default 0 = direct peer only."""
    peer = request.client.host if request.client else "unknown"
    hops = get_settings().trusted_proxy_hops
    if hops <= 0:
        return peer
    xff = [x.strip() for x in request.headers.get("x-forwarded-for", "").split(",") if x.strip()]
    chain = xff + [peer]
    return chain[-(hops + 1)] if len(chain) >= hops + 1 else peer


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User, request: Request, response: Response) -> AuthSession:
    s = get_settings()
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    now = utcnow()
    row = AuthSession(
        id=_digest(token), user_id=user.id, csrf_token=csrf, created_at=now, last_seen_at=now,
        expires_at=now + timedelta(hours=s.session_ttl_hours),
        user_agent=(request.headers.get("user-agent") or "")[:255],
    )
    db.add(row)
    db.commit()
    max_age = s.session_ttl_hours * 3600
    response.set_cookie(SESSION_COOKIE, token, max_age=max_age, httponly=True, secure=s.secure_cookies, samesite="lax", path="/")
    response.set_cookie(CSRF_COOKIE, csrf, max_age=max_age, httponly=False, secure=s.secure_cookies, samesite="lax", path="/")
    return row


def clear_cookies(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


def _origin_ok(request: Request) -> bool:
    """Browsers always send Origin (or at least Referer) on cross-site unsafe requests; if present it must be allow-listed.
    Requests with neither header are non-browser clients; for cookie sessions the CSRF token is still required."""
    allowed = {o.rstrip("/") for o in get_settings().origins}
    origin = request.headers.get("origin")
    if not origin:
        ref = request.headers.get("referer")
        if not ref:
            return True
        p = urlparse(ref)
        origin = f"{p.scheme}://{p.netloc}"
    return origin.rstrip("/") in allowed


def check_origin(request: Request) -> None:
    if request.method in UNSAFE_METHODS and not _origin_ok(request):
        raise HTTPException(status_code=403, detail="Origin not allowed")


def csrf_matches(request: Request, sess: AuthSession) -> bool:
    sent = request.headers.get(CSRF_HEADER, "").encode("utf-8", "ignore")
    return hmac.compare_digest(sent, sess.csrf_token.encode())


def current_user(request: Request, db: Session = Depends(get_session)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sess = db.get(AuthSession, _digest(token))
    now = datetime.now(timezone.utc)
    if sess is None or sess.expires_at <= now:
        if sess is not None:
            db.delete(sess)
            db.commit()
        raise HTTPException(status_code=401, detail="Session expired")
    if (now - sess.last_seen_at).total_seconds() > get_settings().session_idle_hours * 3600:
        db.delete(sess)
        db.commit()
        raise HTTPException(status_code=401, detail="Session expired")
    user = db.get(User, sess.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if request.method in UNSAFE_METHODS:
        check_origin(request)
        if not csrf_matches(request, sess):
            raise HTTPException(status_code=403, detail="CSRF token missing or invalid")
    if (now - sess.last_seen_at).total_seconds() > 300:
        sess.last_seen_at = now
        db.commit()
    request.state.session = sess
    return user


def revoke_session(db: Session, request: Request) -> None:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        sess = db.get(AuthSession, _digest(token))
        if sess:
            db.delete(sess)
            db.commit()


def revoke_all_sessions(db: Session, user_id, except_id: Optional[str] = None) -> int:
    from sqlalchemy import delete
    q = delete(AuthSession).where(AuthSession.user_id == user_id)
    if except_id:
        q = q.where(AuthSession.id != except_id)
    n = db.execute(q).rowcount or 0
    db.commit()
    return n


def purge_expired(db: Session) -> dict:
    """Delete expired/idle sessions and old rate-limit windows. Called opportunistically and at startup."""
    from sqlalchemy import delete
    from core import ratelimit
    now = datetime.now(timezone.utc)
    idle = now - timedelta(hours=get_settings().session_idle_hours)
    n = db.execute(delete(AuthSession).where((AuthSession.expires_at <= now) | (AuthSession.last_seen_at <= idle))).rowcount or 0
    db.commit()
    return {"sessions": n, "rate_limit_rows": ratelimit.purge_old(db)}
