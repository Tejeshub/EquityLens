from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.db import get_session
from core import policy
from core.orm import Company, Listing, User
from core.security import current_user
from services.companies import search_companies

router = APIRouter(prefix="/api/v1/companies", tags=["companies"])


class ListingOut(BaseModel):
    exchange: str
    symbol: str


class CompanyOut(BaseModel):
    id: str
    name: str
    isin: str
    sector: Optional[str] = None  # null = not available from the company master source
    listings: List[ListingOut]
    primary_symbol: str
    exchange: str


class SearchOut(BaseModel):
    items: List[CompanyOut]
    total: int
    limit: int
    offset: int
    source: str = "NSE equity list"


def to_out(co: Company, lst: Listing) -> CompanyOut:
    return CompanyOut(
        id=str(co.id), name=co.name, isin=co.isin, sector=co.sector if policy.enabled("nse_index") else None,
        listings=[ListingOut(exchange=l.exchange, symbol=l.symbol) for l in co.listings],
        primary_symbol=lst.symbol, exchange=lst.exchange,
    )


@router.get("/search", response_model=SearchOut)
def search(q: str = Query("", max_length=60), sector: Optional[str] = Query(None, max_length=120),
           segment: Optional[str] = Query(None, pattern="^(large|mid|small)$"), limit: int = Query(10, ge=1, le=25),
           offset: int = Query(0, ge=0, le=1000), db: Session = Depends(get_session), _: User = Depends(current_user)):
    if sector or segment:
        policy.require("nse_index")
    if not q.strip() and not (sector or segment):
        raise HTTPException(status_code=422, detail="Provide q, sector or segment")
    rows, total = search_companies(db, q, limit, offset, sector=sector, segment=segment)
    return SearchOut(items=[to_out(c, l) for c, l in rows], total=total, limit=limit, offset=offset)


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: UUID, db: Session = Depends(get_session), _: User = Depends(current_user)):
    co = db.get(Company, company_id)
    if co is None or not co.active or not co.listings:
        raise HTTPException(status_code=404, detail="Company not found")
    return to_out(co, co.listings[0])
