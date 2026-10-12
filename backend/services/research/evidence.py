"""Collect real evidence for a company: stored financial facts (refreshing from the source when stale) and news."""
import logging
from datetime import date, datetime, timezone
from typing import Dict, List, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.orm import Company, FinancialFact, Listing
from providers.base import ProviderError
from services import fundamentals, news
from services.research.models import Evidence
from services.research.rubric import Facts

log = logging.getLogger("equitylens.research")
MAX_NEWS = 8


def load_facts(db: Session, company_id) -> Tuple[Facts, str, str, str]:
    rows = db.scalars(select(FinancialFact).where(FinancialFact.company_id == company_id)).all()
    if not rows:
        return {}, "", "", ""
    basis = "consolidated" if any(r.basis == "consolidated" for r in rows) else "standalone"
    facts: Facts = {}
    url, retrieved = "", max(r.retrieved_at for r in rows)
    for r in rows:
        if r.basis != basis:
            continue
        url = r.source_url
        facts.setdefault(r.statement, {}).setdefault(r.metric, {})[r.period_end] = float(r.value)
    return facts, basis, url, retrieved.isoformat()


def _line(facts: Facts, statement: str, metric: str, n: int = 4) -> str:
    s = facts.get(statement, {}).get(metric, {})
    if not s:
        return ""
    pts = sorted(s)[-n:]
    return f"{metric}: " + ", ".join(f"{p:%b %Y}={s[p]:,.2f}".rstrip("0").rstrip(".") for p in pts)


FIN_LINES = {
    "quarterly_results": ["Sales", "Net Profit", "OPM %", "Operating Profit"],
    "profit_loss": ["Sales", "Net Profit", "EPS in Rs"],
    "ratios": ["ROCE %", "Debtor Days"],
    "balance_sheet": ["Borrowings", "Equity Capital", "Reserves"],
    "shareholding": ["Promoters", "FIIs", "DIIs", "Public"],
}
TITLES = {"quarterly_results": "Quarterly results", "profit_loss": "Annual profit & loss", "ratios": "Ratios",
          "balance_sheet": "Balance sheet", "shareholding": "Shareholding pattern"}


def collect(db: Session, company: Company, listing: Listing) -> dict:
    """Returns {evidence, refs, facts, news_ids, limitations, latest_quarter}. Provider failures become limitations."""
    limitations: List[str] = []
    evidence: List[Evidence] = []
    refs: Dict[str, int] = {}
    from core import policy
    if policy.enabled("screener"):
        r = fundamentals.refresh_company(db, company, listing)
        if r["error"]:
            limitations.append(f"Financial data refresh failed ({r['error']}); using previously stored data if any.")
        facts, basis, fin_url, retrieved = load_facts(db, company.id)
        if not facts:
            limitations.append("No financial statements available from the current source for this company.")
    else:
        facts, basis, fin_url, retrieved = {}, "", "", ""
        limitations.append(policy.REASONS["screener"])
    for statement, metrics in FIN_LINES.items():
        lines = [l for l in (_line(facts, statement, m) for m in metrics) if l]
        if not lines:
            continue
        periods = [p for m in metrics for p in facts.get(statement, {}).get(m, {})]
        eid = len(evidence) + 1
        refs[statement] = eid
        evidence.append(Evidence(id=eid, type="financial_data", title=f"Screener.in {basis} {TITLES[statement].lower()}", url=fin_url or None,
                                 retrieved_at=retrieved, as_of=max(periods).isoformat() if periods else None,
                                 text=f"{TITLES[statement]} ({basis}; units as stated by source):\n" + "\n".join(lines)))
    news_ids: List[int] = []
    if not policy.enabled("news"):
        limitations.append(policy.REASONS["news"])
        q = facts.get("quarterly_results", {}).get("Sales", {})
        return {"evidence": evidence, "refs": refs, "facts": facts, "news_ids": news_ids, "limitations": limitations,
                "latest_quarter": max(q) if q else None}
    try:
        items, _ = news.company_news(company.name, listing.symbol, limit=MAX_NEWS)
        for it in items[:MAX_NEWS]:
            eid = len(evidence) + 1
            news_ids.append(eid)
            evidence.append(Evidence(id=eid, type="news", title=it["title"], url=it["url"], retrieved_at=datetime.now(timezone.utc).isoformat(),
                                     as_of=it["published_at"], text=f"{it['title']} ({it['source']}, {it['published_at'] or 'date unknown'}): {(it['excerpt'] or '')[:300]}"))
        if not items:
            limitations.append("No recent news articles were found.")
    except ProviderError as e:
        limitations.append(f"News unavailable ({e.kind}).")
    q = facts.get("quarterly_results", {}).get("Sales", {})
    return {"evidence": evidence, "refs": refs, "facts": facts, "news_ids": news_ids, "limitations": limitations,
            "latest_quarter": max(q) if q else None}
