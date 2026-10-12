"""Background research jobs: bounded concurrency, de-duplication, ownership, failure reporting (real threads)."""
import json
import threading
import time
from datetime import timedelta
from pathlib import Path

import httpx
import pytest
from sqlalchemy import select
from starlette.testclient import TestClient

from core.orm import Company, ResearchJob, utcnow
from core.settings import get_settings
from providers import exa, groq, screener
from providers.base import TTLCache
from services import fundamentals as fund
from services.research import jobs
from tests.conftest import csrf_headers, register
from tests.test_companies import load
from tests.test_research import FakeLLM

FX = Path(__file__).parent / "fixtures"


class SlowLLM(FakeLLM):
    def __init__(self, delay=0.15):
        super().__init__()
        self.delay, self.active, self.max_active, self.lock = delay, 0, 0, threading.Lock()

    def __call__(self, *a, **k):
        with self.lock:
            self.active += 1
            self.max_active = max(self.max_active, self.active)
        try:
            time.sleep(self.delay)
            if self.mode == "boom":
                raise ValueError("unexpected")
            return super().__call__(*a, **k)
        finally:
            with self.lock:
                self.active -= 1


@pytest.fixture()
def env(monkeypatch, db):
    s = get_settings()
    monkeypatch.setattr(s, "research_jobs_inline", False)
    monkeypatch.setattr(jobs, "_slots", None)
    exa.cache = TTLCache(); fund._locks.clear()
    html = (FX / "synthetic_screener_tables.html").read_text()
    news = json.loads((FX / "synthetic_exa_news.json").read_text())
    monkeypatch.setattr(exa, "_client", exa.make_client("k", transport=httpx.MockTransport(lambda r: httpx.Response(200, json=news)), budget=None))
    monkeypatch.setattr(screener, "_client", screener.make_client(transport=httpx.MockTransport(lambda r: httpx.Response(200, text=html)), budget=None))
    llm = SlowLLM()
    monkeypatch.setattr(groq, "chat_json", llm)
    return llm


def companies(client, db):
    load(db); register(client)
    return [client.get(f"/api/v1/companies/search?q={q}").json()["items"][0]["id"] for q in ("synthalpha", "synthbeta", "synthgamma")]


def submit(client, cid):
    return client.post(f"/api/v1/research/{cid}", headers=csrf_headers(client))


def wait(client, job_id, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        j = client.get(f"/api/v1/research/jobs/{job_id}").json()
        if j["status"] in ("complete", "failed"):
            return j
        time.sleep(0.1)
    raise AssertionError("job did not finish")


def test_submit_returns_immediately_then_completes(client, db, env):
    cid = companies(client, db)[0]
    t = time.time()
    r = submit(client, cid)
    assert r.status_code == 202 and time.time() - t < 1.0            # does not hold the request open for the LLM work
    j = r.json()
    assert j["status"] in ("queued", "running") and j["report"] is None and j["poll_after_ms"] > 0
    done = wait(client, j["job_id"])
    assert done["status"] == "complete" and done["report"]["overall"]["score"] is not None and done["report_id"] == done["report"]["id"]


def test_duplicate_submit_returns_the_active_job(client, db, env):
    cid = companies(client, db)[0]
    a, b = submit(client, cid).json(), submit(client, cid).json()
    assert a["job_id"] == b["job_id"]
    wait(client, a["job_id"])
    assert len(db.scalars(select(ResearchJob)).all()) == 1


def test_concurrency_is_bounded(client, db, env, monkeypatch):
    monkeypatch.setattr(get_settings(), "research_max_concurrent", 1)
    monkeypatch.setattr(jobs, "_slots", None)
    ids = companies(client, db)
    js = [submit(client, c).json()["job_id"] for c in ids]
    for j in js:
        assert wait(client, j)["status"] == "complete"
    assert env.max_active == 1                                        # one LLM call at a time with a single slot


def test_queue_limit_returns_503_busy(client, db, env, monkeypatch):
    monkeypatch.setattr(get_settings(), "research_max_queue", 1)
    monkeypatch.setattr(get_settings(), "research_max_concurrent", 1)
    monkeypatch.setattr(jobs, "_slots", None)
    env.delay = 0.6
    a, b = companies(client, db)[:2]
    j1 = submit(client, a)
    assert j1.status_code == 202
    r = submit(client, b)
    assert r.status_code == 503 and r.json()["detail"]["code"] == "busy" and r.headers.get("retry-after")
    wait(client, j1.json()["job_id"])


def test_jobs_are_private_to_their_owner(client, app, db, env):
    cid = companies(client, db)[0]
    jid = submit(client, cid).json()["job_id"]
    wait(client, jid)
    c2 = TestClient(app, base_url="http://localhost"); register(c2, "b@example.com")
    assert c2.get(f"/api/v1/research/jobs/{jid}").status_code == 404
    assert client.get("/api/v1/research/jobs/not-a-uuid").status_code == 422
    assert client.get("/api/v1/research/jobs/00000000-0000-0000-0000-000000000000").status_code == 404


def test_unexpected_failure_is_reported_as_failed_not_hung(client, db, env):
    # an exception escaping the model layer must end the job, free the active slot, and leak no internals
    from services.research import service
    orig = service.run_research
    def boom(*a, **k):
        raise RuntimeError("secret detail postgresql://u:pw@h/db")
    import services.research.jobs as J
    J.service.run_research = boom
    try:
        cid = companies(client, db)[0]
        j = wait(client, submit(client, cid).json()["job_id"])
    finally:
        J.service.run_research = orig
    assert j["status"] == "failed" and j["error"]["code"] == "internal" and "secret" not in json.dumps(j) and "postgresql" not in json.dumps(j)
    cid2 = client.get("/api/v1/companies/search?q=synthalpha").json()["items"][0]["id"]
    r2 = submit(client, cid2)
    assert r2.status_code == 202                                       # failed job no longer blocks a new one
    wait(client, r2.json()["job_id"])


def test_daily_budget_exhaustion_is_a_failed_job_with_rate_limited_code(client, db, env, monkeypatch):
    monkeypatch.setattr(get_settings(), "research_per_user_per_day", 0)
    cid = companies(client, db)[0]
    j = wait(client, submit(client, cid).json()["job_id"])
    assert j["status"] == "failed" and j["error"]["code"] == "rate_limited" and "limit" in j["error"]["message"].lower()


def test_stale_job_is_reported_failed_after_timeout(client, db, env, monkeypatch):
    cid = companies(client, db)[0]
    from core.orm import User
    user = db.scalar(select(User))
    job = ResearchJob(user_id=user.id, company_id=cid, status="running", started_at=utcnow() - timedelta(hours=1), created_at=utcnow() - timedelta(hours=1))
    db.add(job); db.commit()
    j = client.get(f"/api/v1/research/jobs/{job.id}").json()
    assert j["status"] == "failed" and j["error"]["code"] == "timeout"
    r2 = submit(client, cid)
    assert r2.status_code == 202 and r2.json()["job_id"] != str(job.id)  # stale active job does not block resubmission
    wait(client, r2.json()["job_id"])


def test_requires_auth_and_csrf(client, db, env):
    assert client.get("/api/v1/research/jobs/00000000-0000-0000-0000-000000000000").status_code == 401
    cid = companies(client, db)[0]
    assert client.post(f"/api/v1/research/{cid}", headers={"Origin": "http://localhost:8080"}).status_code == 403


def test_active_endpoint_lets_the_ui_resume_after_reload(client, db, env):
    cid = companies(client, db)[0]
    env.delay = 0.5
    assert client.get(f"/api/v1/research/active?company_id={cid}").status_code == 404
    jid = submit(client, cid).json()["job_id"]
    a = client.get(f"/api/v1/research/active?company_id={cid}")
    assert a.status_code == 200 and a.json()["job_id"] == jid and a.json()["status"] in ("queued", "running")
    wait(client, jid)
    r = client.get(f"/api/v1/research/active?company_id={cid}")
    assert r.status_code == 404 and r.json()["detail"]["code"] == "no_active_job"
