"""Per-user fixed-window limits for provider-backed reads, so one account cannot drain the shared provider budgets for everyone."""
from fastapi import Depends
from sqlalchemy.orm import Session

from core import ratelimit
from core.db import get_session
from core.orm import User
from core.security import current_user

# name -> (requests, window seconds). Cached responses count too (a user cannot probe the cache to amplify cold misses).
LIMITS = {
    "quote": (60, 60), "history": (60, 60), "movers": (12, 60), "snapshot": (10, 60), "compare": (12, 3600),
    "news": (120, 3600), "financials": (60, 3600), "company_read": (240, 60),
}


def per_user(name: str):
    assert name in LIMITS

    def dep(db: Session = Depends(get_session), user: User = Depends(current_user)) -> None:
        limit, window = LIMITS[name]  # read at call time so deployments/tests can tune it
        ratelimit.enforce(db, f"read:{name}:{user.id}", limit, window, "Too many requests; slow down and try again shortly")
    return dep
