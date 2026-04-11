from typing import List

from rag.schemas import RagRetrievedChunk


def rerank_chunks(chunks: List[RagRetrievedChunk]) -> List[RagRetrievedChunk]:
    """Deterministic v1 reranker: closest distance first, then by rank."""
    ranked = sorted(
        chunks,
        key=lambda c: (
            c.distance if c.distance is not None else float("inf"),
            c.rank,
        ),
    )

    for idx, chunk in enumerate(ranked, start=1):
        chunk.rank = idx

    return ranked
