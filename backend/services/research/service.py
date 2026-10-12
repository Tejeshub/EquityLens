"""Research orchestration: evidence -> three dimensions -> bounded critique/revise -> overall -> stored report."""
import hashlib
import json
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from statistics import pstdev
from typing import Callable, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.orm import Company, Listing, ResearchReport, User
from providers import groq
from providers.base import ProviderError
from services.research import agents, evidence as ev_mod, rubric
from services.research.models import (DISCLAIMER, METHOD_NOTE, Criterion, Dimension, Evidence, Overall, Refinement, ResearchOut)

log = logging.getLogger("equitylens.research")
RUBRIC_VERSION = "1"
MAX_REFINEMENT_ROUNDS = 1  # hard ceiling is 2; default 1 to respect provider token limits
REUSE_WINDOW = timedelta(hours=24)
FUND_DEFINED, ALT_DEFINED = 5, 2


def _dim_fail(key, title, kind, why) -> Dimension:
    return Dimension(key=key, title=title, status=kind, limitations=[why])


def _fundamental(collected, today) -> Dimension:
    title = "Fundamentals"
    from core import policy
    if not policy.enabled("screener"):
        return _dim_fail("fundamental", title, "unavailable", policy.REASONS["screener"])
    crit = rubric.fundamental_criteria(collected["facts"], collected["refs"])
    if len(crit) < 2:
        return _dim_fail("fundamental", title, "unavailable", f"Only {len(crit)} of {FUND_DEFINED} fundamental criteria could be computed from reported data (need at least 2).")
    score = round(sum(c.score for c in crit) / len(crit), 1)
    conf = rubric.criteria_confidence(len(crit), FUND_DEFINED, collected["latest_quarter"], today)
    lim = [f"{FUND_DEFINED - len(crit)} of {FUND_DEFINED} rubric criteria unavailable."] if len(crit) < FUND_DEFINED else []
    return Dimension(key="fundamental", title=title, status="ok", position=rubric.position_from_score(score), score=score, confidence=conf, criteria=crit, limitations=lim)


def _alternative(collected, today) -> Dimension:
    title = "Alternative / ownership signals"
    from core import policy
    if not policy.enabled("screener"):
        return _dim_fail("alternative", title, "unavailable", "Shareholding data is not available in this deployment (no source licensed for public display). "
                         "Hiring activity, website traffic and MCA filing signals are not measured either.")
    crit = rubric.alternative_criteria(collected["facts"], collected["refs"])
    unavailable = ("Not measured (no compliant free source integrated): hiring activity, website traffic, MCA filing signals. "
                   "These are reported as unavailable, not as neutral.")
    if not crit:
        return _dim_fail("alternative", title, "unavailable", "Shareholding history (needs 5 quarters) not available. " + unavailable)
    score = round(sum(c.score for c in crit) / len(crit), 1)
    sh = collected["facts"].get("shareholding", {}).get("Promoters", {})
    conf = rubric.criteria_confidence(len(crit), ALT_DEFINED, max(sh) if sh else None, today)
    return Dimension(key="alternative", title=title, status="ok", position=rubric.position_from_score(score), score=score, confidence=conf,
                     criteria=crit, limitations=[unavailable])


def _sentiment_prepare(collected):
    items = [e for e in collected["evidence"] if e.type == "news"]
    return items


def _sentiment(items: List[Evidence], today) -> tuple[Dimension, Optional[agents.SentimentOut]]:
    title = "News sentiment"
    from core import policy
    if not policy.enabled("news"):
        return _dim_fail("sentiment", title, "unavailable", policy.REASONS["news"]), None
    if len(items) < 2:
        return _dim_fail("sentiment", title, "unavailable", f"Only {len(items)} recent article(s) found; at least 2 are needed."), None
    try:
        out = agents.label_news(items)
    except ProviderError as e:
        return _dim_fail("sentiment", title, "failed", f"Language model step failed ({e.kind}); sentiment not computed."), None
    valid = {e.id for e in items}
    labels = {a.ref: a.label.lower() for a in out.articles if a.ref in valid and a.label.lower() in ("positive", "neutral", "negative")}
    if len(labels) < 2:
        return _dim_fail("sentiment", title, "failed", "Model did not label enough articles; sentiment not computed."), None
    pos, neg = sum(v == "positive" for v in labels.values()), sum(v == "negative" for v in labels.values())
    score = round(50 + 50 * (pos - neg) / len(labels), 1)
    recent = [i for i in items if i.as_of and (datetime.now(timezone.utc) - datetime.fromisoformat(i.as_of)).days <= 30]
    conf = round(min(rubric.CONFIDENCE_CAP, min(len(labels), 8) / 8 * (0.5 + 0.5 * len(recent) / len(items))), 2)
    crit = [Criterion(key="net_sentiment", label="Net article sentiment", value=round((pos - neg) / len(labels) * 100, 1), unit="% net",
                      score=score, detail=f"{pos} positive, {neg} negative, {len(labels) - pos - neg} neutral of {len(labels)} labelled articles")]
    d = Dimension(key="sentiment", title=title, status="ok", position=rubric.position_from_score(score), score=score, confidence=conf, criteria=crit,
                  summary=out.summary, evidence=agents.sanitize_evidence(out.evidence, items),
                  limitations=["Sentiment comes from article headlines/excerpts only (full text may be paywalled) and is labelled by a language model."])
    return d, out


def _narrate(d: Dimension, items: List[Evidence], collected) -> None:
    if d.status != "ok" or d.key == "sentiment":
        return
    try:
        n = agents.narrate(d.title, d.criteria, items)
        d.summary, d.evidence = n.summary, agents.sanitize_evidence(n.evidence, items)
    except ProviderError as e:
        d.limitations.append(f"Narrative could not be generated ({e.kind}); showing computed criteria only.")


def _items_for(d: Dimension, collected) -> List[Evidence]:
    if d.key == "sentiment":
        return [e for e in collected["evidence"] if e.type == "news"]
    kinds = {"fundamental": {"quarterly_results", "profit_loss", "ratios", "balance_sheet"}, "alternative": {"shareholding"}}[d.key]
    ids = {collected["refs"][k] for k in kinds if k in collected["refs"]}
    return [e for e in collected["evidence"] if e.id in ids]


def _refine(dims: List[Dimension], collected, max_rounds: int) -> Refinement:
    ref = Refinement()
    narr = [d for d in dims if d.status == "ok" and d.summary]
    if not narr:
        ref.skipped_reason = "no narratives to audit"
        return ref
    all_items = collected["evidence"]
    for _ in range(min(max_rounds, 2)):
        issues: Dict[str, List[str]] = {}
        for d in narr:
            items = _items_for(d, collected)
            for p in agents.check_narrative(d.summary, d.evidence, items, d.criteria):
                issues.setdefault(d.key, []).append(p)
        try:
            c = agents.critique({d.key: d.summary for d in narr}, all_items)
            for i in c.issues:
                if i.dimension_key in {d.key for d in narr}:
                    issues.setdefault(i.dimension_key, []).append(i.problem)
        except ProviderError as e:
            ref.changes.append(f"Critique step unavailable ({e.kind}); only programmatic grounding checks were applied.")
        if not issues:
            ref.skipped_reason = ref.skipped_reason or "no unsupported claims found"
            return ref
        for d in narr:
            if d.key not in issues:
                continue
            items = _items_for(d, collected)
            try:
                rev = agents.revise(d.title, agents.Narrative(summary=d.summary, evidence=d.evidence), issues[d.key], items)
            except ProviderError as e:
                d.limitations.append(f"Unresolved grounding issue(s): {'; '.join(issues[d.key])[:240]}")
                ref.changes.append(f"{d.title}: revision failed ({e.kind}); issues disclosed.")
                continue
            before = len(agents.check_narrative(d.summary, d.evidence, items, d.criteria))
            after = agents.check_narrative(rev.summary, rev.evidence, items, d.criteria)
            if len(after) < before or (not after and rev.summary != d.summary):
                ref.changes.append(f"{d.title}: revised after audit ({'; '.join(issues[d.key])[:200]})")
                d.summary, d.evidence = rev.summary, agents.sanitize_evidence(rev.evidence, items)
            else:
                ref.changes.append(f"{d.title}: revision did not resolve the issues; original kept and issue disclosed.")
                d.limitations.append(f"Unresolved grounding issue(s): {'; '.join(issues[d.key])[:240]}")
        ref.rounds += 1
        break  # one revision round per call; the ceiling above bounds any future increase
    return ref


def _overall(dims: List[Dimension]) -> Overall:
    ok = [d for d in dims if d.status == "ok"]
    if not ok:
        return Overall(score=None, confidence=None, confidence_basis=["No dimension had enough evidence; no overall score is given."])
    score = round(sum(d.score for d in ok) / len(ok), 1)
    base = sum(d.confidence for d in ok) / len(ok)
    basis = ["Confidence measures how much fresh evidence supports the scores (coverage x freshness, capped at 0.90); it is not a probability that the view is correct.",
             f"Average of per-dimension confidence ({', '.join(f'{d.title} {d.confidence:.2f}' for d in ok)}): {base:.2f}"]
    cov = (len(ok) / len(dims)) ** 0.5
    basis.append(f"Coverage factor {cov:.2f}: {len(ok)} of {len(dims)} dimensions had evidence (missing ones are excluded from the score, not treated as neutral).")
    conf = base * cov
    if len(ok) > 1 and max(d.score for d in ok) - min(d.score for d in ok) > 40:
        conf *= 0.85
        basis.append("Disagreement factor 0.85: dimension scores differ by more than 40 points.")
    return Overall(score=score, confidence=round(conf, 2), confidence_basis=basis)


def evidence_version(collected) -> str:
    h = hashlib.sha256()
    for e in collected["evidence"]:
        h.update(e.text.encode())
    h.update(f"{groq.model_name()}|{RUBRIC_VERSION}".encode())
    return h.hexdigest()[:32]


def to_out(report: ResearchReport, company: Company, reused: bool = False) -> ResearchOut:
    out = ResearchOut.model_validate(report.result)
    out.reused = reused
    return out


def run_research(db: Session, user: User, company: Company, listing: Listing, *, force: bool = False,
                 today: Optional[date] = None, before_generate: Optional[Callable[[], None]] = None) -> ResearchOut:
    today = today or date.today()
    collected = ev_mod.collect(db, company, listing)
    version = evidence_version(collected)
    if not force:
        prev = db.scalar(select(ResearchReport).where(ResearchReport.user_id == user.id, ResearchReport.company_id == company.id,
                                                      ResearchReport.evidence_version == version,
                                                      ResearchReport.created_at > datetime.now(timezone.utc) - REUSE_WINDOW)
                         .order_by(ResearchReport.created_at.desc()))
        if prev is not None:
            return to_out(prev, company, reused=True)
    if before_generate:
        before_generate()  # budget check happens only when new LLM work would actually run
    fund, alt = _fundamental(collected, today), _alternative(collected, today)
    sent, _ = _sentiment(_sentiment_prepare(collected), today)
    dims = [fund, sent, alt]
    for d in (fund, alt):
        _narrate(d, _items_for(d, collected), collected)
    refinement = _refine(dims, collected, MAX_REFINEMENT_ROUNDS)
    overall = _overall(dims)
    limitations = list(collected["limitations"])
    if any(d.status != "ok" for d in dims):
        limitations.append("One or more dimensions were unavailable or failed; see each dimension's limitations.")
    status = "complete" if all(d.status == "ok" for d in dims) else "partial"
    now = datetime.now(timezone.utc)
    rid = uuid.uuid4()
    out = ResearchOut(id=str(rid), company_id=str(company.id), company_name=company.name, status=status, generated_at=now.isoformat(),
                      disclaimer=DISCLAIMER, overall=overall, dimensions=dims, sources=collected["evidence"], refinement=refinement,
                      limitations=limitations, method_note=METHOD_NOTE)
    db.add(ResearchReport(id=rid, user_id=user.id, company_id=company.id, status=status, result=json.loads(out.model_dump_json()),
                          evidence_version=version, model_config_hash=hashlib.sha256(groq.model_name().encode()).hexdigest()[:16], created_at=now))
    db.commit()
    return out
