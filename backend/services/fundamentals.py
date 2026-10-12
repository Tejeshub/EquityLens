"""Fundamentals: parse Screener tables into validated, provenance-carrying facts; upsert; serve."""
import calendar
import logging
import re
import threading
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional
from urllib.parse import quote

from bs4 import BeautifulSoup
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from core.orm import Company, FinancialFact, Listing
from providers import screener
from providers.base import ProviderError

log = logging.getLogger("equitylens.fundamentals")
SOURCE = "Screener.in"
STATEMENTS = {"quarters": "quarterly_results", "profit-loss": "profit_loss", "balance-sheet": "balance_sheet",
              "cash-flow": "cash_flow", "ratios": "ratios", "shareholding": "shareholding"}
REFRESH_AFTER = timedelta(days=7)
_MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_abbr) if m}
_MAX_ABS = Decimal("1e12")
_locks: Dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def parse_period(header: str) -> Optional[date]:
    m = re.fullmatch(r"([A-Za-z]{3})\s+(\d{4})", header.strip())
    if not m or m.group(1).lower() not in _MONTHS:
        return None  # e.g. "TTM", blank
    mo, yr = _MONTHS[m.group(1).lower()], int(m.group(2))
    return date(yr, mo, calendar.monthrange(yr, mo)[1])


def clean_label(label: str) -> str:
    return re.sub(r"\s+", " ", label.replace("\xa0", " ")).strip().rstrip("+").strip()


def infer_unit(label: str, statement: str, stated_unit: Optional[str]) -> Optional[str]:
    l = label.lower()
    if l.endswith("%") or "opm" in l or l.startswith("dividend payout"):
        return "%"
    if statement == "shareholding":
        return "count" if l.startswith("no. of") else "%"
    if "days" in l or "cycle" in l:
        return "days"
    if l.startswith("eps"):
        return "INR"
    if statement == "ratios":
        return None  # ratio rows without an explicit marker: do not guess
    return stated_unit  # statement tables: the page states "Figures in Rs. Crores"


def parse_value(raw: str) -> Optional[Decimal]:
    s = raw.replace(",", "").replace("%", "").replace("\xa0", "").strip()
    if not s or s in ("-", "—"):
        return None
    try:
        d = Decimal(s)
    except InvalidOperation:
        return None
    if not d.is_finite() or abs(d) >= _MAX_ABS:
        return None
    return d


def parse_page(html: str, basis: str) -> List[dict]:
    soup = BeautifulSoup(html, "lxml")
    facts: List[dict] = []
    for sid, statement in STATEMENTS.items():
        sec = soup.find("section", {"id": sid})
        if sec is not None and statement == "shareholding":
            holder = sec.find("div", {"id": "quarterly-shp"})  # the yearly table is hidden alongside it
            table = holder.find("table", {"class": "data-table"}) if holder else None
        else:
            table = sec.find("table", {"class": "data-table"}) if sec else None
        if table is None:
            continue
        sub = " ".join(sec.find("p", class_="sub").get_text().split()) if sec.find("p", class_="sub") else ""
        sub_basis = "consolidated" if "Consolidated" in sub else "standalone" if "Standalone" in sub else basis
        um = re.search(r"Figures in (Rs\. Crores|Rs\. Lakhs)", sub)
        stated_unit = "INR crore" if um and "Crores" in um.group(1) else None  # lakhs/unknown -> unit not asserted
        periods = [parse_period(th.get_text(strip=True)) for th in table.find_all("th")][1:]
        period_type = "Q" if statement in ("quarterly_results", "shareholding") else "FY"
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if len(cells) < 2:
                continue
            label = clean_label(cells[0].get_text())
            if not label:
                continue
            unit = infer_unit(label, statement, stated_unit)
            for p, c in zip(periods, cells[1:]):
                if p is None:
                    continue
                v = parse_value(c.get_text())
                if v is None:
                    continue
                facts.append({"basis": sub_basis, "statement": statement, "period_type": period_type, "period_end": p,
                              "metric": label, "value": v, "unit": unit, "currency": "INR" if unit in ("INR crore", "INR") else None})
    return facts


def upsert_facts(db: Session, company_id, facts: List[dict], source_url: str, now: Optional[datetime] = None) -> int:
    """Upsert only valid parsed facts. Never deletes existing rows, so an empty/failed scrape cannot erase history."""
    if not facts:
        return 0
    now = now or datetime.now(timezone.utc)
    rows = [dict(f, company_id=company_id, source=SOURCE, source_url=source_url, retrieved_at=now, kind="reported") for f in facts]
    stmt = pg_insert(FinancialFact).values(rows)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_fact_identity",
        set_={"value": stmt.excluded.value, "unit": stmt.excluded.unit, "currency": stmt.excluded.currency,
              "source_url": stmt.excluded.source_url, "retrieved_at": stmt.excluded.retrieved_at})
    db.execute(stmt)
    db.commit()
    return len(rows)


def _lock(key: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(key, threading.Lock())


def latest_retrieved(db: Session, company_id) -> Optional[datetime]:
    return db.scalar(select(func.max(FinancialFact.retrieved_at)).where(FinancialFact.company_id == company_id))


_failures: Dict[str, tuple] = {}  # company id -> (monotonic ts, error kind): cooldown so a failing/uncovered company is not re-fetched per request
COOLDOWN = {"not_found": 6 * 3600.0, "bad_payload": 1800.0}
DEFAULT_COOLDOWN = 300.0


def refresh_company(db: Session, company: Company, listing: Listing, *, force: bool = False) -> dict:
    """Single-flight per company. Returns {refreshed: bool, error: kind|None}."""
    import time as _t
    key = str(company.id)
    f = _failures.get(key)
    if f and not force and _t.monotonic() - f[0] < COOLDOWN.get(f[1], DEFAULT_COOLDOWN):
        return {"refreshed": False, "error": f[1]}
    with _lock(str(company.id)):
        last = latest_retrieved(db, company.id)
        if last and not force and datetime.now(timezone.utc) - last < REFRESH_AFTER:
            return {"refreshed": False, "error": None}
        try:
            html, basis = screener.fetch_company_page(quote(listing.symbol, safe=""))
        except ProviderError as e:
            if e.kind not in ("budget", "circuit_open"):  # those are our own limits, not facts about the company
                _failures[key] = (_t.monotonic(), e.kind)
            return {"refreshed": False, "error": e.kind}
        facts = parse_page(html, basis)
        if not facts:
            _failures[key] = (_t.monotonic(), "bad_payload")
            return {"refreshed": False, "error": "bad_payload"}
        _failures.pop(key, None)
        url = f"https://www.screener.in/company/{quote(listing.symbol, safe='')}/{'consolidated/' if basis == 'consolidated' else ''}"
        upsert_facts(db, company.id, facts, url)
        return {"refreshed": True, "error": None}


def read_statement(db: Session, company_id, statement: str) -> dict:
    rows = db.scalars(select(FinancialFact).where(FinancialFact.company_id == company_id, FinancialFact.statement == statement)).all()
    if not rows:
        return {"periods": [], "rows": [], "basis": None, "retrieved_at": None, "source_url": None}
    basis = "consolidated" if any(r.basis == "consolidated" for r in rows) else "standalone"
    rows = [r for r in rows if r.basis == basis]
    periods = sorted({r.period_end for r in rows})
    by_metric: Dict[str, dict] = {}
    order: Dict[str, int] = {}
    for r in sorted(rows, key=lambda r: r.retrieved_at):
        order.setdefault(r.metric, len(order))
        m = by_metric.setdefault(r.metric, {"metric": r.metric, "unit": r.unit, "values": {}})
        m["values"][r.period_end.isoformat()] = float(r.value)
    return {
        "periods": [p.isoformat() for p in periods],
        "rows": sorted(by_metric.values(), key=lambda m: order[m["metric"]]),
        "basis": basis,
        "retrieved_at": max(r.retrieved_at for r in rows).isoformat(),
        "source_url": rows[0].source_url,
    }
