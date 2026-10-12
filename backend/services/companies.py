"""Company master (NSE equity list) import and search."""
import csv
import io
import re
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from core.orm import Company, Listing

NSE_SOURCE = "NSE EQUITY_L.csv"
MIN_ROWS_FOR_DEACTIVATION = 1000  # never deactivate on a short/garbled file
_ISIN = re.compile(r"^IN[A-Z0-9]{10}$")


def parse_nse_equity_csv(text: str) -> List[dict]:
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for raw in reader:
        r = {(k or "").strip().upper(): (v or "").strip() for k, v in raw.items()}
        symbol, name, isin = r.get("SYMBOL"), r.get("NAME OF COMPANY"), r.get("ISIN NUMBER")
        if not symbol or not name or not isin or not _ISIN.match(isin):
            continue
        listed: Optional[date] = None
        try:
            listed = datetime.strptime(r.get("DATE OF LISTING", ""), "%d-%b-%Y").date()
        except ValueError:
            pass
        rows.append({"symbol": symbol.upper(), "name": name, "isin": isin, "series": r.get("SERIES"), "listing_date": listed})
    return rows


def import_nse_equity_list(db: Session, rows: List[dict], *, now: Optional[datetime] = None) -> dict:
    now = now or datetime.now(timezone.utc)
    if not rows:
        return {"inserted": 0, "updated": 0, "deactivated": 0, "skipped": "empty input; existing records untouched"}
    inserted = updated = 0
    seen_isins = set()
    existing = {c.isin: c for c in db.scalars(select(Company).options(selectinload(Company.listings)))}
    for r in rows:
        seen_isins.add(r["isin"])
        co = existing.get(r["isin"])
        if co is None:
            co = Company(isin=r["isin"], name=r["name"], source=NSE_SOURCE, source_updated_at=now, active=True)
            db.add(co)
            co.listings = []
            existing[r["isin"]] = co
            inserted += 1
        else:
            co.name, co.source_updated_at, co.active = r["name"], now, True
            updated += 1
        lst = next((l for l in co.listings if l.exchange == "NSE"), None)
        if lst is None:
            co.listings.append(Listing(exchange="NSE", symbol=r["symbol"], series=r["series"], listing_date=r["listing_date"]))
        else:
            lst.symbol, lst.series, lst.listing_date = r["symbol"], r["series"], r["listing_date"]
    deactivated = 0
    if len(rows) >= MIN_ROWS_FOR_DEACTIVATION:
        for isin, co in existing.items():
            if isin not in seen_isins and co.active and co.source == NSE_SOURCE:
                co.active = False
                deactivated += 1
    db.commit()
    return {"inserted": inserted, "updated": updated, "deactivated": deactivated}


def _escape_like(s: str) -> str:
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_companies(db: Session, q: str, limit: int = 10, offset: int = 0, *, sector: Optional[str] = None, segment: Optional[str] = None) -> Tuple[List[Tuple[Company, Listing]], int]:
    q = q.strip()
    if len(q) < 1 and not (sector or segment):
        return [], 0
    limit = max(1, min(limit, 25))
    offset = max(0, min(offset, 1000))
    like = _escape_like(q)
    sym_exact = func.upper(Listing.symbol) == q.upper()
    sym_prefix = Listing.symbol.ilike(f"{like}%", escape="\\")
    name_prefix = Company.name.ilike(f"{like}%", escape="\\")
    name_contains = Company.name.ilike(f"%{like}%", escape="\\")
    isin_match = func.upper(Company.isin) == q.upper()
    where = (Company.active.is_(True)) & or_(sym_exact, sym_prefix, name_contains, isin_match)
    rank = case((sym_exact | isin_match, 0), (sym_prefix, 1), (name_prefix, 2), else_=3)
    base = select(Company, Listing).join(Listing, Listing.company_id == Company.id).where(where)
    if sector:
        base = base.where(Company.sector == sector)
    if segment:
        from core.orm import IndexMembership
        names = [n for n, seg in INDEX_SEGMENT.items() if seg == segment]
        base = base.where(Company.id.in_(select(IndexMembership.company_id).where(IndexMembership.index_name.in_(names))))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.execute(base.order_by(rank, func.length(Company.name), Company.name).limit(limit).offset(offset)).all()
    return [(c, l) for c, l in rows], total


# ---- NSE index lists: real sector (Industry) and cap-segment membership ---------------------------------
INDEX_SEGMENT = {
    "NIFTY 50": "large", "NIFTY NEXT 50": "large", "NIFTY MIDCAP 100": "mid", "NIFTY SMALLCAP 100": "small",
}
INDEX_URLS = {
    "NIFTY 50": "ind_nifty50list", "NIFTY NEXT 50": "ind_niftynext50list",
    "NIFTY MIDCAP 100": "ind_niftymidcap100list", "NIFTY SMALLCAP 100": "ind_niftysmallcap100list",
}


def parse_index_csv(text: str) -> List[dict]:
    rows = []
    for raw in csv.DictReader(io.StringIO(text)):
        r = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
        isin, symbol = r.get("isin code"), r.get("symbol")
        if symbol and isin and _ISIN.match(isin):
            rows.append({"isin": isin, "symbol": symbol.upper(), "industry": r.get("industry") or None})
    return rows


def import_index_list(db: Session, index_name: str, rows: List[dict], *, now: Optional[datetime] = None) -> dict:
    from core.orm import IndexMembership
    from sqlalchemy import delete
    now = now or datetime.now(timezone.utc)
    if len(rows) < 20:  # indices have >=50 members; refuse to replace good data with a short/garbled file
        return {"index": index_name, "applied": False, "reason": f"only {len(rows)} rows parsed; existing membership untouched"}
    by_isin = {c.isin: c for c in db.scalars(select(Company))}
    db.execute(delete(IndexMembership).where(IndexMembership.index_name == index_name))
    matched = unknown = 0
    for r in rows:
        co = by_isin.get(r["isin"])
        if co is None:
            unknown += 1
            continue
        if r["industry"]:
            co.sector = r["industry"]
        db.add(IndexMembership(company_id=co.id, index_name=index_name, source_updated_at=now))
        matched += 1
    db.commit()
    return {"index": index_name, "applied": True, "matched": matched, "not_in_company_master": unknown}


def segment_symbols(db: Session, segment: str) -> List[Tuple[Company, Listing]]:
    from core.orm import IndexMembership
    names = [n for n, seg in INDEX_SEGMENT.items() if seg == segment or segment == "all"]
    rows = db.execute(
        select(Company, Listing).join(Listing, Listing.company_id == Company.id)
        .join(IndexMembership, IndexMembership.company_id == Company.id)
        .where(IndexMembership.index_name.in_(names), Company.active.is_(True), Listing.exchange == "NSE")
        .distinct().order_by(Company.name)
    ).all()
    return [(c, l) for c, l in rows]
