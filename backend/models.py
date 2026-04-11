from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

class CompanyInput(BaseModel):
    name: str
    screener_id: Optional[str] = None
    ir_page_url: Optional[str] = None
    sector: str

class EquityResearchRequest(BaseModel):
    companies: List[CompanyInput]
    quarters: int = 4
    debate_refinement_threshold: float = 0.7

class SourceCitation(BaseModel):
    document: str
    page: Optional[int]
    excerpt: str

class DimensionScore(BaseModel):
    dimension: str
    score: float
    confidence: float
    reasoning: str
    citations: List[SourceCitation]

class Scorecard(BaseModel):
    company: str
    overall_grade: str
    dimensions: List[DimensionScore]
    debate_summary: str
    coordinator_confidence: float
    refinement_cycles: int

class GuidanceEntry(BaseModel):
    company: str
    quarter: str
    metric: str
    guidance_lower: float
    guidance_upper: float
    actual: Optional[float]
    deviation_percent: Optional[float]
    source_page: int

class PeerMetric(BaseModel):
    metric_name: str
    ranking: List[Dict[str, Any]]

class EquityResearchResponse(BaseModel):
    scorecards: List[Scorecard]
    guidance_tracker: List[GuidanceEntry]
    peer_comparisons: List[PeerMetric]
    execution_status: str