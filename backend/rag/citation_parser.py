from typing import List, Tuple

from rag.schemas import RagCitation, RagRetrievedChunk


def _safe_page(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def citations_from_chunks(chunks: List[RagRetrievedChunk], max_citations: int = 5) -> List[RagCitation]:
    citations: List[RagCitation] = []
    seen: set[Tuple[str, int | None, str | None]] = set()

    for chunk in chunks:
        meta = chunk.metadata or {}
        source = str(meta.get("source", "unknown"))
        table_type = meta.get("table_type")
        page = _safe_page(meta.get("page"))
        key = (source, page, str(table_type) if table_type else None)
        if key in seen:
            continue

        seen.add(key)
        citations.append(
            RagCitation(
                document=source,
                page=page,
                excerpt=chunk.document[:240],
                source=source,
                table_type=str(table_type) if table_type else None,
                index=chunk.rank,
            )
        )

        if len(citations) >= max_citations:
            break

    return citations
