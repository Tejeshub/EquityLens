from typing import List, Optional

from rag.schemas import RagRetrievedChunk
from storage.semantic_store import search_chunks


def _normalize_distance(distance) -> Optional[float]:
    try:
        return float(distance)
    except (TypeError, ValueError):
        return None


def _distance_to_score(distance: Optional[float]) -> Optional[float]:
    if distance is None:
        return None
    return 1.0 / (1.0 + max(distance, 0.0))


def retrieve_chunks(query: str, company: Optional[str] = None, n_results: int = 8) -> List[RagRetrievedChunk]:
    """Retrieve chunks from ChromaDB and normalize into typed records."""
    result = search_chunks(query, n_results=n_results)
    documents = result.get("documents", [])
    metadatas = result.get("metadatas", [])
    distances = result.get("distances", [])

    chunks: List[RagRetrievedChunk] = []
    for idx, doc in enumerate(documents):
        meta = metadatas[idx] if idx < len(metadatas) and isinstance(metadatas[idx], dict) else {}
        distance = _normalize_distance(distances[idx]) if idx < len(distances) else None

        if company:
            meta_company = str(meta.get("company", "")).strip().lower()
            if meta_company and company.strip().lower() not in meta_company:
                continue

        chunks.append(
            RagRetrievedChunk(
                rank=idx + 1,
                document=str(doc),
                metadata=meta,
                distance=distance,
                score=_distance_to_score(distance),
            )
        )

    return chunks
