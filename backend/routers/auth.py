import logging
import random
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core import ratelimit
from core.db import get_session
from core.emailnorm import canonical_email, normalize_email
from core.orm import User
from core.security import (
    CSRF_COOKIE, SESSION_COOKIE, _digest, check_origin, clear_cookies, client_ip, create_session, csrf_matches, current_user, ip_is_reliable,
    hash_password, needs_rehash, purge_expired, revoke_all_sessions, revoke_session, verify_password,
)
from core.settings import get_settings
from core.orm import AuthSession

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger("equitylens.auth")
WINDOW = 900


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return normalize_email(v)


class RegisterBody(Credentials):
    password: str = Field(min_length=10, max_length=256)


class UserOut(BaseModel):
    id: str
    email: str


def _out(u: User) -> UserOut:
    return UserOut(id=str(u.id), email=u.email)


def _retry(retry_after: int) -> HTTPException:
    return HTTPException(status_code=429, detail="Too many attempts; try again later", headers={"Retry-After": str(retry_after)})


@router.post("/register", response_model=UserOut, status_code=201)
def register(body: RegisterBody, request: Request, response: Response, db: Session = Depends(get_session)):
    check_origin(request)
    s = get_settings()
    ip = client_ip(request)
    if ip_is_reliable(request):
        ratelimit.enforce(db, f"register:ip:{ip}", s.register_per_ip_per_hour, 3600, "Too many registration attempts")
    ratelimit.enforce(db, "register:global", s.register_global_per_hour, 3600, "Registrations are temporarily limited; try again later")
    user = User(email=body.email, email_canonical=canonical_email(body.email), password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Unable to register with those details")
    create_session(db, user, request, response)
    return _out(user)


@router.post("/login", response_model=UserOut)
def login(body: Credentials, request: Request, response: Response, db: Session = Depends(get_session)):
    """Only FAILED attempts are counted, so a successful login is never blocked by an attacker's earlier guesses and a
    victim cannot be locked out by someone who does not also share their (account, IP) pair."""
    check_origin(request)
    s = get_settings()
    ip, acct = client_ip(request), body.email
    k_pair, k_acct, k_ip = f"loginfail:pair:{acct}:{ip}", f"loginfail:acct:{acct}", f"loginfail:ip:{ip}"
    reliable = ip_is_reliable(request)
    checks = [(k_pair, s.login_fail_per_account_ip), (k_acct, s.login_fail_per_account)] + ([(k_ip, s.login_fail_per_ip)] if reliable else [])
    for key, limit in checks:
        ra = ratelimit.blocked(db, key, limit, WINDOW)
        if ra:
            raise _retry(ra)
    user = db.scalar(select(User).where(User.email == acct))
    ok = verify_password(user.password_hash if user else None, body.password)
    if not ok or user is None or not user.is_active:
        for key in (k_pair, k_acct, k_ip):
            ratelimit.hit(db, key, 10**9, WINDOW)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    ratelimit.reset(db, k_pair)
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
        db.commit()
    old = request.cookies.get(SESSION_COOKIE)
    if old:  # rotate: never keep a pre-login session id
        sess = db.get(AuthSession, _digest(old))
        if sess is not None:
            db.delete(sess)
            db.commit()
    create_session(db, user, request, response)
    if random.random() < 0.02:  # opportunistic housekeeping (no scheduler on the free tier)
        try:
            purge_expired(db)
        except Exception:
            db.rollback()
            log.warning("purge_expired failed")
    return _out(user)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_session)):
    check_origin(request)
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        sess = db.get(AuthSession, _digest(token))
        if sess is not None and not csrf_matches(request, sess):
            raise HTTPException(status_code=403, detail="CSRF token missing or invalid")
    revoke_session(db, request)
    clear_cookies(response)
    response.status_code = 204
    return response


@router.post("/logout-all", status_code=204)
def logout_all(request: Request, response: Response, db: Session = Depends(get_session), user: User = Depends(current_user)):
    revoke_all_sessions(db, user.id)
    clear_cookies(response)
    response.status_code = 204
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return _out(user)
