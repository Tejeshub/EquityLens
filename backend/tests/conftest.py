"""Test harness: ENVIRONMENT=test and a *local* disposable Postgres. Refuses remote hosts."""
import os

os.environ["ENVIRONMENT"] = "test"
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://postgres:equitylens_dev@127.0.0.1:55433/equitylens_test")
os.environ.pop("POSTGRES_URL", None)
os.environ["ALLOWED_ORIGINS"] = "http://localhost:8080"
os.environ.setdefault("RESEARCH_JOBS_INLINE", "true")  # jobs run synchronously in tests; the threaded path has its own tests
os.environ.setdefault("COPILOT_PROVIDER", "gemini")  # existing tests stub providers.gemini.chat_json; selection logic has its own tests

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from core import db as core_db
from core.settings import get_settings

get_settings.cache_clear()


@pytest.fixture(scope="session")
def engine():
    eng = core_db.get_engine()  # raises if host is not local
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "migrations"))
    with eng.begin() as c:
        c.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))  # disposable test DB only
    command.upgrade(cfg, "head")
    return eng


@pytest.fixture()
def db(engine):
    with engine.begin() as c:
        c.execute(text("TRUNCATE users, companies, rate_limit_counters RESTART IDENTITY CASCADE"))
    gen = core_db.get_session()
    s = next(gen)
    yield s
    s.close()


@pytest.fixture()
def app(db):
    from core.app import create_base_app
    return create_base_app()


@pytest.fixture()
def client(app):
    return TestClient(app, base_url="http://localhost")


def register(client, email="a@example.com", password="correct horse battery"):
    r = client.post("/auth/register", json={"email": email, "password": password}, headers={"Origin": "http://localhost:8080"})
    assert r.status_code == 201, r.text
    return r


def csrf_headers(client):
    return {"X-CSRF-Token": client.cookies.get("el_csrf"), "Origin": "http://localhost:8080"}


class JobResult:
    """Adapter: submit a research job, poll it, and expose the finished report like the old synchronous endpoint."""
    def __init__(self, submit, job=None, report=None):
        self.submit, self.job_json, self._report = submit, job, report
        self.status_code = submit.status_code
        if submit.status_code == 202 and job is not None:
            if job["status"] == "complete":
                self.status_code = 200
            elif job["status"] == "failed":
                self.status_code = 429 if (job["error"] or {}).get("code") == "rate_limited" else 500
    def json(self):
        return self._report if self._report is not None else (self.job_json if self.job_json is not None else self.submit.json())
    @property
    def text(self):
        return self.submit.text


def run_research(client, company_id):
    r = client.post(f"/api/v1/research/{company_id}", headers=csrf_headers(client))
    if r.status_code != 202:
        return JobResult(r)
    job = client.get(f"/api/v1/research/jobs/{r.json()['job_id']}").json()
    return JobResult(r, job, job.get("report"))


@pytest.fixture(autouse=True)
def _reset_process_local_state():
    """Caches, cooldowns and breakers are process-local by design; isolate every test from the previous one."""
    from services import fundamentals
    fundamentals._locks.clear()
    fundamentals._failures.clear()
    yield
