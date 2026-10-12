from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core import policy
from core.db import get_session
from core.limits import per_user
from core.orm import Company, User
from core.security import current_user
from providers.base import ProviderError
from services import news

router = APIRouter(prefix="/api/v1/companies", tags=["news"])


class NewsItem(BaseModel):
    title: str
    url: str
    source: str
    published_at: Optional[str]
    excerpt: Optional[str]
    author: Optional[str]


class NewsOut(BaseModel):
    company_id: str
    items: List[NewsItem]
    total: int
    limit: int
    offset: int
    source: str = "Exa web search (category: news)"
    attribution: str = "Headlines and excerpts belong to their publishers; follow the link for the full article. Some articles may be paywalled."
    cached: bool
    stale: bool
    fetched_at: str


_ERR = {"quota": 429, "budget": 429, "timeout": 504, "unavailable": 503, "circuit_open": 503, "bad_payload": 502, "not_found": 404}


@router.get("/{company_id}/news", response_model=NewsOut, dependencies=[Depends(per_user("news"))])
def company_news(company_id: UUID, limit: int = Query(10, ge=1, le=20), offset: int = Query(0, ge=0, le=40),
                 db: Session = Depends(get_session), _: User = Depends(current_user)):
    policy.require("news")
    co = db.get(Company, company_id)
    if co is None or not co.active or not co.listings:
        raise HTTPException(status_code=404, detail="Company not found")
    try:
        items, res = news.company_news(co.name, co.listings[0].symbol, limit=50)
    except ProviderError as e:
        code = {"quota": "News provider quota reached", "budget": "News request budget reached for today"}.get(e.kind, "News provider unavailable")
        raise HTTPException(status_code=_ERR.get(e.kind, 502), detail={"code": e.kind, "message": code})
    page = items[offset:offset + limit]
    return NewsOut(company_id=str(co.id), items=[NewsItem(**i) for i in page], total=len(items), limit=limit, offset=offset,
                   cached=res.cached, stale=res.stale, fetched_at=datetime.fromtimestamp(res.fetched_at, tz=timezone.utc).isoformat())
