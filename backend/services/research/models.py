from typing import List, Optional

from pydantic import BaseModel, Field


class Evidence(BaseModel):
    id: int
    type: str  # financial_data | news | filing | alternative
    title: str
    url: Optional[str] = None
    retrieved_at: str
    as_of: Optional[str] = None
    text: str = Field(default="", exclude=True)  # evidence text is sent to the LLM but not duplicated in the API response


class EvidenceItem(BaseModel):
    text: str
    source_ref: Optional[int] = None


class Criterion(BaseModel):
    """One deterministic, inspectable input to a dimension score."""
    key: str
    label: str
    value: float
    unit: str
    score: float  # 0..100 under the documented rubric
    detail: str
    source_ref: Optional[int] = None


class Dimension(BaseModel):
    key: str  # fundamental | sentiment | alternative
    title: str
    status: str  # ok | unavailable | failed
    position: Optional[str] = None
    score: Optional[float] = None
    confidence: Optional[float] = None
    summary: str = ""
    evidence: List[EvidenceItem] = []
    criteria: List[Criterion] = []
    limitations: List[str] = []


class Overall(BaseModel):
    score: Optional[float]
    confidence: Optional[float]
    confidence_basis: List[str]


class Refinement(BaseModel):
    rounds: int = 0
    changes: List[str] = []
    skipped_reason: Optional[str] = None


class ResearchOut(BaseModel):
    id: str
    company_id: str
    company_name: str
    status: str  # complete | partial
    generated_at: str
    disclaimer: str
    overall: Overall
    dimensions: List[Dimension]
    sources: List[Evidence]
    refinement: Refinement
    limitations: List[str]
    method_note: str
    reused: bool = False


DISCLAIMER = ("AI-assisted, informational research only. It is not investment advice or a recommendation to buy or sell, "
              "and scores are heuristic summaries of the listed sources, not predictions of future performance.")
METHOD_NOTE = ("Dimension scores come from a fixed, published rubric over reported figures (fundamental, alternative) or from per-article "
               "labels (sentiment). The language model only writes the narrative and labels articles; it does not set scores or confidence.")
