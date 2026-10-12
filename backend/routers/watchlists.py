from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from core.db import get_session
from core import policy
from core.limits import per_user
from core.orm import Company, User, Watchlist, WatchlistItem
from core.security import current_user
from providers import yahoo
from providers.base import ProviderError
from services import market

router = APIRouter(prefix="/api/v1/watchlists", tags=["watchlists"])
MAX_WATCHLISTS = 20
MAX_ITEMS = 10  # also bounds snapshot/compare provider fan-out


class NameBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("name must not be blank")
        return v


class AddItemBody(BaseModel):
    company_id: UUID


class ItemOut(BaseModel):
    company_id: str
    name: str
    symbol: str
    added_at: datetime


class WatchlistOut(BaseModel):
    id: str
    name: str
    created_at: datetime
    items: List[ItemOut]
    max_items: int = MAX_ITEMS


def _out(w: Watchlist) -> WatchlistOut:
    return WatchlistOut(id=str(w.id), name=w.name, created_at=w.created_at, items=[
        ItemOut(company_id=str(i.company_id), name=i.company.name, symbol=i.company.listings[0].symbol, added_at=i.added_at)
        for i in w.items if i.company.listings])


def _owned(db: Session, user: User, wid: UUID) -> Watchlist:
    # Ownership is part of the query; another user's id is indistinguishable from a missing one.
    w = db.scalar(select(Watchlist).where(Watchlist.id == wid, Watchlist.user_id == user.id)
                  .options(selectinload(Watchlist.items).selectinload(WatchlistItem.company).selectinload(Company.listings)))
    if w is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return w


@router.get("", response_model=List[WatchlistOut])
def list_watchlists(db: Session = Depends(get_session), user: User = Depends(current_user)):
    rows = db.scalars(select(Watchlist).where(Watchlist.user_id == user.id).order_by(Watchlist.created_at)
                      .options(selectinload(Watchlist.items).selectinload(WatchlistItem.company).selectinload(Company.listings))).all()
    return [_out(w) for w in rows]


@router.post("", response_model=WatchlistOut, status_code=201)
def create_watchlist(body: NameBody, db: Session = Depends(get_session), user: User = Depends(current_user)):
    if (db.scalar(select(func.count()).select_from(Watchlist).where(Watchlist.user_id == user.id)) or 0) >= MAX_WATCHLISTS:
        raise HTTPException(status_code=422, detail=f"At most {MAX_WATCHLISTS} watchlists are allowed")
    w = Watchlist(user_id=user.id, name=body.name)
    db.add(w)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You already have a watchlist with that name")
    return _out(_owned(db, user, w.id))


@router.patch("/{watchlist_id}", response_model=WatchlistOut)
def rename_watchlist(watchlist_id: UUID, body: NameBody, db: Session = Depends(get_session), user: User = Depends(current_user)):
    w = _owned(db, user, watchlist_id)
    w.name = body.name
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You already have a watchlist with that name")
    return _out(_owned(db, user, watchlist_id))


@router.delete("/{watchlist_id}", status_code=204)
def delete_watchlist(watchlist_id: UUID, db: Session = Depends(get_session), user: User = Depends(current_user)):
    db.delete(_owned(db, user, watchlist_id))
    db.commit()
    return Response(status_code=204)


@router.post("/{watchlist_id}/items", response_model=WatchlistOut, status_code=201)
def add_item(watchlist_id: UUID, body: AddItemBody, db: Session = Depends(get_session), user: User = Depends(current_user)):
    w = _owned(db, user, watchlist_id)
    co = db.get(Company, body.company_id)
    if co is None or not co.active or not co.listings:
        raise HTTPException(status_code=404, detail="Company not found")
    if len(w.items) >= MAX_ITEMS:
        raise HTTPException(status_code=422, detail=f"A watchlist can hold at most {MAX_ITEMS} companies")
    db.add(WatchlistItem(watchlist_id=w.id, company_id=co.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Company is already in this watchlist")
    db.expire_all()
    return _out(_owned(db, user, watchlist_id))


@router.delete("/{watchlist_id}/items/{company_id}", status_code=204)
def remove_item(watchlist_id: UUID, company_id: UUID, db: Session = Depends(get_session), user: User = Depends(current_user)):
    w = _owned(db, user, watchlist_id)
    item = next((i for i in w.items if i.company_id == company_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Company is not in this watchlist")
    db.delete(item)
    db.commit()
    return Response(status_code=204)


class SnapshotRow(BaseModel):
    company_id: str
    name: str
    symbol: str
    status: str  # ok | unavailable
    reason: Optional[str] = None  # quota | timeout | unavailable | not_found | bad_payload ...
    price: Optional[float] = None
    change_percent: Optional[float] = None
    as_of: Optional[str] = None
    cached: Optional[bool] = None
    stale: Optional[bool] = None


class SnapshotOut(BaseModel):
    watchlist_id: str
    rows: List[SnapshotRow]
    source: str = market.SOURCE
    delayed: bool = True
    note: str = market.DELAY_NOTE


@router.get("/{watchlist_id}/snapshot", response_model=SnapshotOut, dependencies=[Depends(per_user("snapshot"))])
def snapshot(watchlist_id: UUID, db: Session = Depends(get_session), user: User = Depends(current_user)):
    w = _owned(db, user, watchlist_id)
    items = [(i.company_id, i.company.name, i.company.listings[0]) for i in w.items if i.company.listings]
    if not policy.enabled("yahoo"):  # no provider call is made; every row says why
        return SnapshotOut(watchlist_id=str(w.id), rows=[
            SnapshotRow(company_id=str(c), name=n, symbol=l.symbol, status="unavailable", reason="source_disabled") for c, n, l in items])

    def one(t) -> SnapshotRow:
        cid, name, lst = t
        base = dict(company_id=str(cid), name=name, symbol=lst.symbol)
        try:
            res = yahoo.get_quote(lst.yahoo_symbol)
        except ProviderError as e:
            return SnapshotRow(**base, status="unavailable", reason=e.kind)
        _, pct = market.change(res.value.price, res.value.previous_close)
        return SnapshotRow(**base, status="ok", price=res.value.price, change_percent=pct, as_of=res.value.as_of.isoformat(),
                           cached=res.cached, stale=res.stale)

    with ThreadPoolExecutor(max_workers=4) as pool:  # bounded concurrency
        rows = list(pool.map(one, items))
    return SnapshotOut(watchlist_id=str(w.id), rows=rows)


COMPARE_METRICS = {
    "quarterly_results": ["Sales", "Operating Profit", "OPM %", "Net Profit"],
    "profit_loss": ["Sales", "Operating Profit", "OPM %", "Net Profit", "EPS in Rs"],
    "ratios": ["ROCE %", "Debtor Days", "Working Capital Days", "Cash Conversion Cycle"],
    "balance_sheet": ["Borrowings", "Equity Capital", "Reserves", "Total Assets"],
    "shareholding": ["Promoters", "FIIs", "DIIs", "Public"],
}


class CompareBody(BaseModel):
    statement: str = Field("quarterly_results", pattern="^(quarterly_results|profit_loss|ratios|balance_sheet|shareholding)$")


class CompareCompany(BaseModel):
    company_id: str
    name: str
    symbol: str
    period: Optional[str] = None  # latest period reported by the source for this company
    basis: Optional[str] = None
    status: str  # ok | unavailable
    reason: Optional[str] = None


class CompareRow(BaseModel):
    metric: str
    unit: Optional[str]
    values: dict  # company_id -> number | null (null = not reported by the source)


class CompareOut(BaseModel):
    watchlist_id: str
    statement: str
    companies: List[CompareCompany]
    rows: List[CompareRow]
    period: Optional[str]  # set only when every available company reports the same latest period
    source: str = "Screener.in"
    basis_note: str
    retrieved_at: Optional[str]
    kind: str = "reported"
    notice: str = ("Side-by-side reported figures. Each company's latest available period is used and shown; periods and "
                   "consolidated/standalone bases may differ between companies. No ranking or AI interpretation is applied.")


@router.post("/{watchlist_id}/compare", response_model=CompareOut, dependencies=[Depends(per_user("compare"))])
def compare(watchlist_id: UUID, body: CompareBody = CompareBody(), db: Session = Depends(get_session), user: User = Depends(current_user)):
    from core.orm import FinancialFact
    from services import fundamentals
    policy.require("screener")
    w = _owned(db, user, watchlist_id)
    if len(w.items) < 2:
        raise HTTPException(status_code=422, detail="Add at least two companies to compare")
    metrics = COMPARE_METRICS[body.statement]
    companies, values, units = [], {m: {} for m in metrics}, {}
    retrieved = []
    for item in w.items:
        co = item.company
        lst = co.listings[0]
        base = dict(company_id=str(co.id), name=co.name, symbol=lst.symbol)
        res = fundamentals.refresh_company(db, co, lst)
        data = fundamentals.read_statement(db, co.id, body.statement)
        if not data["rows"]:
            companies.append(CompareCompany(**base, status="unavailable", reason=res["error"] or "no_data"))
            continue
        latest = max(data["periods"])
        retrieved.append(data["retrieved_at"])
        for r in data["rows"]:
            if r["metric"] in metrics:
                units.setdefault(r["metric"], r["unit"])
                if latest in r["values"]:
                    values[r["metric"]][str(co.id)] = r["values"][latest]
        companies.append(CompareCompany(**base, status="ok", period=latest, basis=data["basis"]))
    ok = [c for c in companies if c.status == "ok"]
    periods = {c.period for c in ok}
    bases = {c.basis for c in ok}
    if len(bases) == 1:
        note = f"All available companies use {next(iter(bases))} figures."
    elif bases:
        note = "Companies use a mix of consolidated and standalone figures; compare with care."
    else:
        note = "No figures were available."
    rows = [CompareRow(metric=m, unit=units.get(m), values={str(i.company.id): values[m].get(str(i.company.id)) for i in w.items}) for m in metrics if m in units]
    return CompareOut(watchlist_id=str(w.id), statement=body.statement, companies=companies, rows=rows,
                      period=next(iter(periods)) if len(periods) == 1 else None, basis_note=note, retrieved_at=max(retrieved) if retrieved else None)
