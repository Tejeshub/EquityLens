from rag.citation_parser import citations_from_chunks
from rag.schemas import RagRetrievedChunk


def test_citations_from_chunks_dedupes_by_source_page_table_type():
    chunks = [
        RagRetrievedChunk(rank=1, document="Revenue up 20%", metadata={"source": "screener.in", "page": None, "table_type": "profit_loss"}, distance=0.1, score=0.9),
        RagRetrievedChunk(rank=2, document="Revenue up 20% duplicate", metadata={"source": "screener.in", "page": None, "table_type": "profit_loss"}, distance=0.2, score=0.8),
        RagRetrievedChunk(rank=3, document="Cash flow improved", metadata={"source": "filing.pdf", "page": 5, "table_type": "cash_flow"}, distance=0.3, score=0.7),
    ]

    citations = citations_from_chunks(chunks, max_citations=5)

    assert len(citations) == 2
    assert citations[0].document == "screener.in"
    assert citations[1].document == "filing.pdf"
    assert citations[1].page == 5
