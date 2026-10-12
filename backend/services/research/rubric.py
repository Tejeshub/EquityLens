"""Deterministic scoring rubric. Thresholds are EquityLens heuristics (documented in docs/RESEARCH_METHOD.md),
not valuation models. Missing inputs are skipped, never defaulted."""
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from services.research.models import Criterion

Facts = Dict[str, Dict[str, Dict[date, float]]]  # statement -> metric -> period_end -> value


def interp(x: float, points: List[Tuple[float, float]]) -> float:
    pts = sorted(points)
    if x <= pts[0][0]:
        return pts[0][1]
    if x >= pts[-1][0]:
        return pts[-1][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def _series(facts: Facts, statement: str, metric: str) -> Dict[date, float]:
    return facts.get(statement, {}).get(metric, {})


def _year_ago(d: date) -> date:
    import calendar
    y = d.year - 1
    return date(y, d.month, min(d.day, calendar.monthrange(y, d.month)[1]))


def latest_period(facts: Facts, statement: str, metric: str) -> Optional[date]:
    s = _series(facts, statement, metric)
    return max(s) if s else None


GROWTH = [(-10, 0), (0, 40), (10, 60), (25, 100)]


def fundamental_criteria(facts: Facts, refs: Dict[str, int]) -> List[Criterion]:
    out: List[Criterion] = []
    q = latest_period(facts, "quarterly_results", "Sales")
    if q:
        ya = _year_ago(q)
        for key, metric, label in (("revenue_growth_yoy", "Sales", "Revenue growth (YoY)"), ("profit_growth_yoy", "Net Profit", "Net profit growth (YoY)")):
            s = _series(facts, "quarterly_results", metric)
            if q in s and ya in s and s[ya] > 0:
                g = (s[q] / s[ya] - 1) * 100
                out.append(Criterion(key=key, label=label, value=round(g, 1), unit="%", score=round(interp(g, GROWTH), 1),
                                     detail=f"{metric} {s[q]:,.0f} in {q:%b %Y} vs {s[ya]:,.0f} in {ya:%b %Y}", source_ref=refs.get("quarterly_results")))
        o = _series(facts, "quarterly_results", "OPM %")
        if q in o and ya in o:
            d = o[q] - o[ya]
            out.append(Criterion(key="opm_change", label="Operating margin change (YoY)", value=round(d, 1), unit="pp",
                                 score=round(interp(d, [(-5, 0), (0, 50), (5, 100)]), 1),
                                 detail=f"OPM {o[q]:.0f}% in {q:%b %Y} vs {o[ya]:.0f}% in {ya:%b %Y} (source rounds to whole %)", source_ref=refs.get("quarterly_results")))
    roce = _series(facts, "ratios", "ROCE %")
    if roce:
        p = max(roce)
        out.append(Criterion(key="roce", label="Return on capital employed (latest FY)", value=roce[p], unit="%",
                             score=round(interp(roce[p], [(5, 0), (15, 60), (25, 100)]), 1), detail=f"ROCE {roce[p]:.0f}% for FY ending {p:%b %Y}", source_ref=refs.get("ratios")))
    b, e, r = (_series(facts, "balance_sheet", m) for m in ("Borrowings", "Equity Capital", "Reserves"))
    common = sorted(set(b) & set(e) & set(r))
    if common:
        p = common[-1]
        equity = e[p] + r[p]
        if equity > 0:
            de = b[p] / equity
            out.append(Criterion(key="debt_to_equity", label="Borrowings / equity (latest FY)", value=round(de, 2), unit="x",
                                 score=round(interp(de, [(0, 100), (0.5, 70), (1, 40), (2, 0)]), 1),
                                 detail=f"Borrowings {b[p]:,.0f} vs equity capital + reserves {equity:,.0f} at {p:%b %Y}", source_ref=refs.get("balance_sheet")))
    return out


def alternative_criteria(facts: Facts, refs: Dict[str, int]) -> List[Criterion]:
    out: List[Criterion] = []
    prom = _series(facts, "shareholding", "Promoters")
    if len(prom) >= 5:
        ps = sorted(prom)
        last, base = ps[-1], ps[-5]  # four quarters apart
        d = prom[last] - prom[base]
        out.append(Criterion(key="promoter_holding_change", label="Promoter holding change (4 quarters)", value=round(d, 2), unit="pp",
                             score=round(interp(d, [(-5, 0), (0, 55), (3, 100)]), 1),
                             detail=f"{prom[base]:.2f}% in {base:%b %Y} to {prom[last]:.2f}% in {last:%b %Y}", source_ref=refs.get("shareholding")))
    fii, dii = _series(facts, "shareholding", "FIIs"), _series(facts, "shareholding", "DIIs")
    common = sorted(set(fii) & set(dii))
    if len(common) >= 5:
        last, base = common[-1], common[-5]
        d = (fii[last] + dii[last]) - (fii[base] + dii[base])
        out.append(Criterion(key="institutional_holding_change", label="Institutional (FII+DII) holding change (4 quarters)", value=round(d, 2), unit="pp",
                             score=round(interp(d, [(-5, 0), (0, 50), (5, 100)]), 1),
                             detail=f"{fii[base] + dii[base]:.2f}% in {base:%b %Y} to {fii[last] + dii[last]:.2f}% in {last:%b %Y}", source_ref=refs.get("shareholding")))
    return out


def position_from_score(score: float) -> str:
    return "bullish" if score >= 60 else "bearish" if score <= 40 else "neutral"


def freshness_factor(latest: Optional[date], today: date) -> float:
    if latest is None:
        return 0.0
    age = (today - latest).days
    return 1.0 if age <= 150 else 0.7 if age <= 300 else 0.4


CONFIDENCE_CAP = 0.9  # evidence coverage/freshness is never "certainty"


def criteria_confidence(n_available: int, n_defined: int, latest: Optional[date], today: date) -> float:
    """Evidence-coverage x freshness, capped. Measures how much data supports the score, not whether it is right."""
    return round(min(CONFIDENCE_CAP, (n_available / n_defined) * freshness_factor(latest, today)), 2)
