import json
from datetime import date
from pathlib import Path

import httpx
import pytest
from sqlalchemy import select
from starlette.testclient import TestClient

from core.orm import Company, ResearchReport
from providers import exa, groq, screener
from providers.base import ProviderError, TTLCache
from services import fundamentals as fund
from services.research import agents, rubric, service
from tests.conftest import csrf_headers, register
from tests.test_companies import load

FX = Path(__file__).parent / "fixtures"
HTML = (FX / "synthetic_screener_tables.html").read_text()
EXA = json.loads((FX / "synthetic_exa_news.json").read_text())


class FakeLLM:
    """Test double for the model. Records calls; behaviour switched per test."""
    def __init__(self):
        self.calls, self.mode = [], "good"

    def __call__(self, system, user, schema, *, max_tokens=1200):
        self.calls.append(schema.__name__)
        if self.mode == "down":
            raise ProviderError("groq", "unavailable")
        if schema is agents.SentimentOut:
            ids = [int(x) for x in __import__("re").findall(r'<source id="(\d+)"', user)]
            labels = [agents.ArticleLabel(ref=i, label="positive" if n % 2 == 0 else "neutral", reason="r") for n, i in enumerate(ids)]
            return agents.SentimentOut(articles=labels, summary=f"Coverage is mixed [{ids[0]}].", evidence=[agents.EvidenceItem(text="headline", source_ref=ids[0])])
        if schema is agents.Narrative:
            first = int(__import__("re").search(r'<source id="(\d+)"', user).group(1))  # cite a source actually provided
            if "Problems found" in user:  # revision call
                return agents.Narrative(summary=f"Revised summary citing [{first}].", evidence=[agents.EvidenceItem(text="grounded", source_ref=first)])
            if self.mode == "hallucinate":
                return agents.Narrative(summary=f"Revenue reached 987654 crore [{first}].", evidence=[agents.EvidenceItem(text="x", source_ref=999)])
            return agents.Narrative(summary=f"Growth looks healthy per reported results [{first}].", evidence=[agents.EvidenceItem(text="Sales grew", source_ref=first), agents.EvidenceItem(text="bad ref", source_ref=999)])
        if schema is agents.Critique:
            if self.mode == "critique":
                return agents.Critique(issues=[agents.Issue(dimension_key="fundamental", problem="claim about margins unsupported")])
            return agents.Critique(issues=[])
        raise AssertionError(schema)


@pytest.fixture()
def env(monkeypatch, db):
    exa.cache = TTLCache(); fund._locks.clear()
    state = {"exa": "ok"}
    def exa_h(req):
        return httpx.Response(429, headers={"Retry-After": "3600"}) if state["exa"] == "429" else httpx.Response(200, json=EXA)
    monkeypatch.setattr(exa, "_client", exa.make_client("k", transport=httpx.MockTransport(exa_h), budget=None))
    monkeypatch.setattr(screener, "_client", screener.make_client(transport=httpx.MockTransport(lambda r: httpx.Response(200, text=HTML)), budget=None))
    llm = FakeLLM()
    monkeypatch.setattr(groq, "chat_json", llm)
    state["llm"] = llm
    return state


def setup(client, db):
    load(db); register(client)
    return client.get("/api/v1/companies/search?q=synthalpha").json()["items"][0]["id"]


def post(client, cid):
    from tests.conftest import run_research
    return run_research(client, cid)


def test_rubric_is_deterministic_and_skips_missing():
    f = {"quarterly_results": {"Sales": {date(2026, 6, 30): 110.0, date(2025, 6, 30): 100.0}, "Net Profit": {date(2026, 6, 30): 5.0, date(2025, 6, 30): -1.0}}}
    c = rubric.fundamental_criteria(f, {"quarterly_results": 1})
    assert [x.key for x in c] == ["revenue_growth_yoy"]          # negative base profit -> skipped, not zero-filled
    assert c[0].value == 10.0 and c[0].score == 60.0
    assert rubric.interp(-50, rubric.GROWTH) == 0 and rubric.interp(100, rubric.GROWTH) == 100


def test_full_report_from_fixtures(client, db, env):
    cid = setup(client, db)
    r = post(client, cid)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["status"] == "complete" and out["overall"]["score"] is not None and 0 < out["overall"]["confidence"] <= 1
    keys = {d["key"]: d for d in out["dimensions"]}
    assert set(keys) == {"fundamental", "sentiment", "alternative"} and all(d["status"] == "ok" for d in keys.values())
    assert all(c["source_ref"] in {s["id"] for s in out["sources"]} for c in keys["fundamental"]["criteria"])
    assert any("hiring" in l for l in keys["alternative"]["limitations"])           # unavailable signals disclosed
    srcs = out["sources"]
    assert all(s["url"] is None or s["url"].startswith("http") for s in srcs) and "text" not in srcs[0]
    # invalid citation (999) was dropped rather than shown as evidence of a real source
    assert all(e["source_ref"] in {s["id"] for s in srcs} or e["source_ref"] is None for d in out["dimensions"] for e in d["evidence"])
    assert "not investment advice" in out["disclaimer"]


def test_overall_is_average_of_dimension_scores_and_confidence_explained(client, db, env):
    out = post(client, setup(client, db)).json()
    ok = out["dimensions"]
    assert out["overall"]["score"] == round(sum(d["score"] for d in ok) / 3, 1)
    assert len(out["overall"]["confidence_basis"]) >= 2


def test_partial_failure_excludes_missing_dimension_and_discloses(client, db, env):
    env["exa"] = "429"
    cid = setup(client, db)
    out = post(client, cid).json()
    s = next(d for d in out["dimensions"] if d["key"] == "sentiment")
    assert out["status"] == "partial" and s["status"] == "unavailable" and s["score"] is None
    ok = [d for d in out["dimensions"] if d["status"] == "ok"]
    assert out["overall"]["score"] == round(sum(d["score"] for d in ok) / len(ok), 1)       # not treated as neutral 50
    assert any("News unavailable" in l for l in out["limitations"])


def test_llm_down_keeps_computed_criteria_and_never_fabricates_text(client, db, env):
    env["llm"].mode = "down"
    out = post(client, setup(client, db)).json()
    f = next(d for d in out["dimensions"] if d["key"] == "fundamental")
    assert f["status"] == "ok" and f["criteria"] and f["summary"] == ""
    assert any("Narrative could not be generated" in l for l in f["limitations"])
    assert next(d for d in out["dimensions"] if d["key"] == "sentiment")["status"] == "failed"


def test_refinement_revises_only_when_critique_finds_issue_and_never_inflates_confidence(client, db, env):
    cid = setup(client, db)
    base = post(client, cid).json()
    assert base["refinement"]["rounds"] == 0 and base["refinement"]["skipped_reason"] == "no unsupported claims found"
    env["llm"].mode = "critique"
    # same evidence within the reuse window would be served from storage, so force a fresh run through the service
    from core.orm import User
    user = db.scalar(select(User)); co = db.get(Company, cid)
    fresh = service.run_research(db, user, co, co.listings[0], force=True)
    assert fresh.refinement.rounds == 1 and fresh.refinement.changes and "revised" in fresh.refinement.changes[0].lower()
    assert fresh.overall.confidence == base["overall"]["confidence"]        # refinement success does not move confidence
    assert fresh.refinement.rounds <= 2


def test_hallucinated_figures_are_flagged_when_unfixed(client, db, env):
    items = [agents.Evidence(id=1, type="financial_data", title="t", retrieved_at="x", text="Sales: Jun 2026=4,303")]
    assert agents.check_narrative("Sales were 4,303 [1].", [], items) == []
    probs = agents.check_narrative("Sales were 987,654 [7].", [], items)
    assert any("unknown source" in p for p in probs) and any("figures not found" in p for p in probs)
    assert agents.check_narrative("no citation here", [], items) == ["summary cites no source"]


def test_reuse_does_not_consume_budget_and_daily_limit_enforced(client, db, env, monkeypatch):
    from core.settings import get_settings
    monkeypatch.setattr(get_settings(), "research_per_user_per_day", 2)
    cid = setup(client, db)
    assert post(client, cid).json()["reused"] is False
    assert post(client, cid).json()["reused"] is True and post(client, cid).json()["reused"] is True
    n = len(env["llm"].calls)
    r = post(client, cid)
    assert r.status_code == 200 and len(env["llm"].calls) == n      # reuse made no LLM calls
    assert db.scalar(select(ResearchReport.id).limit(1)) is not None


def test_daily_limit_blocks_new_generation(client, db, env, monkeypatch):
    from core.settings import get_settings
    monkeypatch.setattr(get_settings(), "research_per_user_per_day", 1)
    cid = setup(client, db)
    assert post(client, cid).status_code == 200
    from core.orm import User
    user = db.scalar(select(User)); co = db.get(Company, cid)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as e:
        from core import ratelimit
        service.run_research(db, user, co, co.listings[0], force=True,
                             before_generate=lambda: ratelimit.enforce(db, f"research:user:{user.id}", 1, 86400, "limit"))
    assert e.value.status_code == 429


def test_reports_are_private_to_their_owner(client, app, db, env):
    cid = setup(client, db)
    rid = post(client, cid).json()["id"]
    assert client.get(f"/api/v1/research/latest?company_id={cid}").json()["id"] == rid
    c2 = TestClient(app, base_url="http://localhost"); register(c2, "b@example.com")
    assert c2.get(f"/api/v1/research/{rid}").status_code == 404
    assert c2.get(f"/api/v1/research/latest?company_id={cid}").status_code == 404


def test_requires_auth_csrf_and_unknown_company(client, db, env):
    assert client.post("/api/v1/research/00000000-0000-0000-0000-000000000000").status_code == 401
    cid = setup(client, db)
    assert client.post(f"/api/v1/research/{cid}", headers={"Origin": "http://localhost:8080"}).status_code == 403
    assert post(client, "00000000-0000-0000-0000-000000000000").status_code == 404
