from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.db import get_session
from core import policy
from core.limits import per_user
from core.orm import Company, User
from core.security import current_user
from providers import yahoo
from providers.base import ProviderError
from services import market
from services.companies import segment_symbols

router = APIRouter(prefix="/api/v1", tags=["market"])

_ERRORS = {"quota": (429, "Market data provider rate limit reached; try again later"),
           "budget": (429, "Market data request budget reached; try again shortly"),
           "timeout": (504, "Market data provider timed out"),
           "unavailable": (503, "Market data provider temporarily unavailable"),
           "circuit_open": (503, "Market data provider temporarily unavailable"),
           "not_found": (404, "No market data found for this symbol"),
           "bad_payload": (502, "Market data provider returned an unexpected response")}


def provider_http_error(e: ProviderError) -> HTTPException:
    code, msg = _ERRORS.get(e.kind, (502, "Market data unavailable"))
    return HTTPException(status_code=code, detail={"code": e.kind, "message": msg})


class Provenance(BaseModel):
    source: str = market.SOURCE
    delayed: bool = True
    note: str = market.DELAY_NOTE
    cached: bool
    stale: bool
    fetched_at: str


class QuoteOut(BaseModel):
    company_id: str
    symbol: str
    currency: str
    price: float
    previous_close: Optional[float]
    change: Optional[float]
    change_percent: Optional[float]
    change_basis: str = "Last price vs. previous trading-day close"
    week52_high: Optional[float]
    week52_low: Optional[float]
    volume: Optional[int]
    as_of: str
    provenance: Provenance


class BarOut(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: Optional[int]


class HistoryOut(BaseModel):
    company_id: str
    symbol: str
    range: str
    interval: str
    bars: List[BarOut]
    provenance: Provenance


def _prov(res) -> Provenance:
    return Provenance(cached=res.cached, stale=res.stale, fetched_at=datetime.fromtimestamp(res.fetched_at, tz=timezone.utc).isoformat())


def _listing(db: Session, company_id: UUID):
    co = db.get(Company, company_id)
    if co is None or not co.active or not co.listings:
        raise HTTPException(status_code=404, detail="Company not found")
    return co, co.listings[0]


@router.get("/companies/{company_id}/quote", response_model=QuoteOut, dependencies=[Depends(per_user("quote"))])
def quote(company_id: UUID, db: Session = Depends(get_session), _: User = Depends(current_user)):
    policy.require("yahoo")
    co, lst = _listing(db, company_id)
    try:
        res = yahoo.get_quote(lst.yahoo_symbol)
    except ProviderError as e:
        raise provider_http_error(e)
    q = res.value
    chg, pct = market.change(q.price, q.previous_close)
    return QuoteOut(company_id=str(co.id), symbol=lst.symbol, currency=q.currency, price=q.price, previous_close=q.previous_close,
                    change=chg, change_percent=pct, week52_high=q.week52_high, week52_low=q.week52_low, volume=q.volume,
                    as_of=q.as_of.isoformat(), provenance=_prov(res))


@router.get("/companies/{company_id}/history", response_model=HistoryOut, dependencies=[Depends(per_user("history"))])
def history(company_id: UUID, range: str = Query("3mo", pattern="^(1mo|3mo|6mo|1y|5y)$"),
            db: Session = Depends(get_session), _: User = Depends(current_user)):
    policy.require("yahoo")
    co, lst = _listing(db, company_id)
    try:
        res = yahoo.get_history(lst.yahoo_symbol, range)
    except ProviderError as e:
        raise provider_http_error(e)
    return HistoryOut(company_id=str(co.id), symbol=lst.symbol, range=range, interval=yahoo.VALID_RANGES[range],
                      bars=[BarOut(**b.__dict__) for b in res.value], provenance=_prov(res))


class Mover(BaseModel):
    company_id: str
    symbol: str  # NSE symbol (same as search/quote), never the provider's symbol
    name: str
    price: float
    previous_close: float
    change_percent: float


class MoversOut(BaseModel):
    segment: str
    as_of_date: Optional[str] = None
    gainers: List[Mover] = []
    losers: List[Mover] = []
    evaluated: int = 0
    excluded: int = 0
    universe_size: int = 0
    source: Optional[str] = None
    delayed: bool = True
    note: Optional[str] = None
    cached: Optional[bool] = None
    stale: Optional[bool] = None
    fetched_at: Optional[str] = None
    batches_failed: int = 0
    partial: bool = False          # True when some provider batches failed and the ranking covers only part of the universe
    reason: Optional[str] = None   # set when nothing could be ranked, e.g. no index membership loaded


@router.get("/market/movers", response_model=MoversOut, dependencies=[Depends(per_user("movers"))])
def movers(segment: str = Query("mid", pattern="^(large|mid|small)$"), top: int = Query(5, ge=1, le=10),
           db: Session = Depends(get_session), _: User = Depends(current_user)):
    policy.require("yahoo")
    policy.require("nse_index")  # the ranking universe comes from NSE index membership
    universe = segment_symbols(db, segment)
    if not universe:
        return MoversOut(segment=segment, reason="No index membership loaded for this segment. Run scripts/import_companies.py.")
    try:
        out = market.fetch_movers([(c.id, c.name, l.yahoo_symbol, l.symbol) for c, l in universe], top=top)
    except ProviderError as e:
        raise provider_http_error(e)
    return MoversOut(segment=segment, **out)
