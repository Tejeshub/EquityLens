"""Bounded background research jobs.

Why: research takes ~20-60 s (provider calls + sequential LLM calls with Retry-After waits), which is unsafe to hold open through a
Vercel rewrite and a sleeping Render instance. A request creates a job and returns at once; the client polls a protected endpoint.

Limits: <= RESEARCH_MAX_CONCURRENT workers per process (semaphore), <= RESEARCH_MAX_QUEUE queued+running globally, one active job per
(user, company) enforced by a partial unique index, per-user daily budget charged only when new model work actually runs, hard job timeout
enforced lazily on read (a job whose process died is reported failed instead of hanging forever). No external queue is used.
"""
import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core import ratelimit
from core.db import get_session
from core.orm import Company, ResearchJob, ResearchReport, User
from core.settings import get_settings
from providers.base import ProviderError
from services.research import service

log = logging.getLogger("equitylens.research.jobs")
_slots: Optional[threading.BoundedSemaphore] = None
_slots_n = 0
_guard = threading.Lock()


def _semaphore() -> threading.BoundedSemaphore:
    global _slots, _slots_n
    n = get_settings().research_max_concurrent
    with _guard:
        if _slots is None or _slots_n != n:
            _slots, _slots_n = threading.BoundedSemaphore(n), n
        return _slots


def _now() -> datetime:
    return datetime.now(timezone.utc)


def expire_if_stale(db: Session, job: ResearchJob) -> ResearchJob:
    if job.status in ("queued", "running"):
        ref = job.started_at or job.created_at
        if _now() - ref > timedelta(seconds=get_settings().research_job_timeout_s):
            job.status, job.error_code, job.error_message, job.finished_at = "failed", "timeout", "The research job did not finish in time.", _now()
            db.commit()
    return job


def submit(db: Session, user: User, company: Company) -> tuple[ResearchJob, bool]:
    """Returns (job, created). An existing active job for the same user+company is returned instead of starting a duplicate."""
    s = get_settings()
    active = db.scalars(select(ResearchJob).where(ResearchJob.user_id == user.id, ResearchJob.company_id == company.id,
                                                  ResearchJob.status.in_(("queued", "running")))).all()
    for j in active:
        expire_if_stale(db, j)
    live = [j for j in active if j.status in ("queued", "running")]
    if live:
        return live[0], False
    total_active = db.scalar(select(func.count()).select_from(ResearchJob).where(ResearchJob.status.in_(("queued", "running")))) or 0
    if total_active >= s.research_max_queue:
        raise HTTPException(status_code=503, detail={"code": "busy", "message": "Research is busy right now; try again in a few minutes."},
                            headers={"Retry-After": "60"})
    job = ResearchJob(user_id=user.id, company_id=company.id, status="queued")
    db.add(job)
    try:
        db.commit()
    except IntegrityError:  # lost a race with a concurrent identical submit
        db.rollback()
        j = db.scalar(select(ResearchJob).where(ResearchJob.user_id == user.id, ResearchJob.company_id == company.id,
                                                ResearchJob.status.in_(("queued", "running"))))
        if j is None:
            raise
        return j, False
    return job, True


def start(job_id) -> None:
    if get_settings().research_jobs_inline:
        run_job(job_id)
        return
    threading.Thread(target=run_job, args=(job_id,), name=f"research-{job_id}", daemon=True).start()


def run_job(job_id) -> None:
    sem = _semaphore()
    with sem:
        db = next(get_session())
        try:
            job = db.get(ResearchJob, job_id)
            if job is None or job.status != "queued":
                return
            job.status, job.started_at = "running", _now()
            db.commit()
            user, company = db.get(User, job.user_id), db.get(Company, job.company_id)
            s = get_settings()

            def budget():
                ratelimit.enforce(db, f"research:user:{user.id}", s.research_per_user_per_day, 86400,
                                  f"Daily research limit ({s.research_per_user_per_day}) reached; try again tomorrow")
            try:
                out = service.run_research(db, user, company, company.listings[0], before_generate=budget)
                job.report_id, job.status = out.id, "complete"
            except HTTPException as e:
                job.status = "failed"
                job.error_code = "rate_limited" if e.status_code == 429 else "rejected"
                job.error_message = str(e.detail)[:300]
            except ProviderError as e:
                job.status, job.error_code, job.error_message = "failed", e.kind[:24], "A data or model provider was unavailable."
            except Exception:  # noqa: BLE001
                log.exception("research job %s failed", job_id)
                db.rollback()
                job = db.get(ResearchJob, job_id)
                if job is None:  # row vanished (e.g. its user/company was deleted): nothing to report on
                    return
                job.status, job.error_code, job.error_message = "failed", "internal", "The research job failed unexpectedly."
            job.finished_at = _now()
            db.commit()
        finally:
            db.close()
