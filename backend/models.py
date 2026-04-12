from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

class CompanyInput(BaseModel):
    name: str
    screener_id: Optional[str] = None
    ir_page_url: Optional[str] = None
    sector: Optional[str] = None

class EquityResearchRequest(BaseModel):
    companies: List[CompanyInput]
    quarters: int = 4
    debate_refinement_threshold: float = 0.7

# === Frontend-aligned data models ===

class AgentMessage(BaseModel):
    """Message from agent during analysis (reasoning trace)."""
    agent: str
    message: str
    timestamp: str
    type: str  # "analysis", "challenge", "agreement", "verdict", "hallucination_flag"

class ScoreDimension(BaseModel):
    """Single dimension of analysis (e.g., fundamentals, sentiment, alternatives)."""
    dimension: str
    score: float  # 0-100 numeric score
    max_score: float = 100
    confidence: float  # 0-1 (used as (confidence * 100) in UI)
    evidence: str  # Key finding/evidence from analysis
    source: str  # Which agent/source produced this (e.g., "Fundamental Debater")
    reasoning: List[AgentMessage] = Field(default_factory=list)  # Full reasoning trace

class Scorecard(BaseModel):
    """Complete analysis report for one company."""
    company_name: str
    dimensions: List[ScoreDimension]
    overall_score: float  # 0-100 numeric score
    confidence_score: float  # 0-100 percentage
    timestamp: str
    agents_participated: List[str]  # List of agent names (e.g., ["Fundamental Debater", "Sentiment Debater", ...])

class GuidanceEntry(BaseModel):
    company: str
    quarter: str
    metric: str
    guidance_lower: Optional[float] = None
    guidance_upper: Optional[float] = None
    actual: Optional[float] = None
    deviation_percent: Optional[float] = None
    source_page: Optional[int] = None
    confidence: float = 0.5

class PeerComparison(BaseModel):
    """Peer comparison metrics for the UI."""
    metric: str
    companies: List[Dict[str, Any]]  # [{name: str, value: float, rank: int}, ...]
    benchmark: Optional[float] = None

class EquityResearchResponse(BaseModel):
    scorecards: List[Scorecard]
    guidance_tracker: List[GuidanceEntry] = Field(default_factory=list)
    peer_comparisons: List[PeerComparison] = Field(default_factory=list)
    execution_status: str  # "success", "partial", "failed"
    error: Optional[str] = None


class AskRequest(BaseModel):
    question: str
    company: Optional[str] = None
    top_k: int = 8


class AskCitation(BaseModel):
    document: str
    page: Optional[int] = None
    excerpt: str = ""
    source: Optional[str] = None
    table_type: Optional[str] = None
    index: Optional[int] = None


class RetrievedChunk(BaseModel):
    rank: int
    document: str
    metadata: Dict[str, Any]
    distance: Optional[float] = None
    score: Optional[float] = None


class AskResponse(BaseModel):
    answer: str
    citations: List[AskCitation]
    retrieved_chunks: List[RetrievedChunk] = Field(default_factory=list)
    retrieval_count: int = 0
    fallback_used: bool = False
    error: Optional[str] = None