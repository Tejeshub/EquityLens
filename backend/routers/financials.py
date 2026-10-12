from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.db import get_session
from core import policy
from core.limits import per_user
from core.orm import Company, User
from core.security import current_user
from services import fundamentals

router = APIRouter(prefix="/api/v1/companies", tags=["financials"])


class MetricRow(BaseModel):
    metric: str
    unit: Optional[str]
    values: Dict[str, float]  # period_end (ISO date) -> reported value; missing period = not reported


class FinancialsOut(BaseModel):
    company_id: str
    statement: str
    period_type: str
    basis: Optional[str]
    periods: List[str]
    rows: List[MetricRow]
    source: str = fundamentals.SOURCE
    source_url: Optional[str]
    retrieved_at: Optional[str]
    stale: bool
    refresh_error: Optional[str] = None
    notice: str = "Reported figures as published by the source; not audited by EquityLens. Units are shown only where the source states them."


@router.get("/{company_id}/financials", response_model=FinancialsOut, dependencies=[Depends(per_user("financials"))])
def financials(company_id: UUID, statement: str = Query("quarterly_results", pattern="^(quarterly_results|profit_loss|balance_sheet|cash_flow|ratios|shareholding)$"),
               db: Session = Depends(get_session), _: User = Depends(current_user)):
    policy.require("screener")
    co = db.get(Company, company_id)
    if co is None or not co.active or not co.listings:
        raise HTTPException(status_code=404, detail="Company not found")
    result = fundamentals.refresh_company(db, co, co.listings[0])
    data = fundamentals.read_statement(db, co.id, statement)
    if not data["rows"]:
        code = result["error"] or "no_data"
        status = {"quota": 429, "budget": 429, "timeout": 504, "not_found": 404, "no_data": 404}.get(code, 503)
        code = "not_covered" if code in ("not_found", "no_data") else code  # one empty-state code for the UI
        messages = {"quota": "The financial data provider rate limit was reached; try again later.",
                    "budget": "The financial data request budget was reached; try again later.",
                    "timeout": "The financial data provider timed out.",
                    "not_covered": "Financial data is not available from the current source for this company."}
        raise HTTPException(status_code=status, detail={"code": code, "message": messages.get(code, "Financial data is temporarily unavailable.")})
    from datetime import datetime, timezone
    age = datetime.now(timezone.utc) - datetime.fromisoformat(data["retrieved_at"])
    return FinancialsOut(company_id=str(co.id), statement=statement, period_type="Q" if statement in ("quarterly_results", "shareholding") else "FY",
                         basis=data["basis"], periods=data["periods"], rows=[MetricRow(**r) for r in data["rows"]],
                         source_url=data["source_url"], retrieved_at=data["retrieved_at"],
                         stale=age > fundamentals.REFRESH_AFTER, refresh_error=result["error"])
