from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class RagCitation(BaseModel):
    document: str
    page: Optional[int] = None
    excerpt: str
    source: Optional[str] = None
    table_type: Optional[str] = None
    index: Optional[int] = None


class RagRetrievedChunk(BaseModel):
    rank: int
    document: str
    metadata: Dict[str, Any]
    distance: Optional[float] = None
    score: Optional[float] = None


class RagPipelineResult(BaseModel):
    answer: str
    citations: List[RagCitation]
    retrieved_chunks: List[RagRetrievedChunk]
    retrieval_count: int
    fallback_used: bool = False
    error: Optional[str] = None
