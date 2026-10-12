from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core import policy, ratelimit
from core.db import get_session
from core.orm import Company, User
from core.security import current_user
from core.settings import get_settings
from providers.base import ProviderError
from services import copilot

router = APIRouter(prefix="/api/v1", tags=["copilot"])


class AskBody(BaseModel):
    company_id: UUID
    question: str = Field(min_length=3, max_length=copilot.MAX_Q)
    top_k: int = Field(5, ge=1, le=copilot.MAX_TOP_K)


class Citation(BaseModel):
    index: int
    title: str
    url: Optional[str]
    page: Optional[int]
    excerpt: str
    as_of: Optional[str]


class AskOut(BaseModel):
    answer: str
    grounded: bool
    citations: List[Citation]
    retrieval_count: int
    notice: Optional[str]


@router.post("/ask", response_model=AskOut)
def ask(body: AskBody, db: Session = Depends(get_session), user: User = Depends(current_user)):
    policy.require_any("screener", "news")  # nothing to retrieve from: refuse rather than answer ungrounded
    co = db.get(Company, body.company_id)
    if co is None or not co.active or not co.listings:
        raise HTTPException(status_code=404, detail="Company not found")
    ratelimit.enforce(db, f"ask:user:{user.id}", get_settings().ask_per_user_per_hour, 3600, "Copilot question limit reached; try again later")
    try:
        res = copilot.answer_question(db, user.id, co, co.listings[0], body.question.strip(), body.top_k)
    except ProviderError as e:
        code = 429 if e.kind in ("quota", "budget") else 503
        raise HTTPException(status_code=code, detail={"code": e.kind, "message": "The answer service is temporarily unavailable; no answer was generated."})
    return AskOut(**res)
