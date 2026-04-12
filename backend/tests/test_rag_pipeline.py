from rag.pipeline import answer_with_rag
from rag.schemas import RagRetrievedChunk


def test_answer_with_rag_no_chunks_returns_cannot_verify(monkeypatch):
    monkeypatch.setattr("rag.pipeline.retrieve_chunks", lambda query, company=None, n_results=8: [])

    result = answer_with_rag("What is revenue?", company="PERSISTENT", top_k=3)

    assert result.retrieval_count == 0
    assert result.answer == "I cannot verify that claim from available sources."
    assert result.citations == []


def test_answer_with_rag_success_path(monkeypatch):
    mock_chunks = [
        RagRetrievedChunk(
            rank=1,
            document="Revenue in Q3FY24 was 60000 Crore.",
            metadata={"source": "screener.in", "table_type": "quarterly_results", "page": None},
            distance=0.1,
            score=0.91,
        )
    ]

    monkeypatch.setattr("rag.pipeline.retrieve_chunks", lambda query, company=None, n_results=8: mock_chunks)
    monkeypatch.setattr("rag.pipeline._generate_answer", lambda question, company, context: "Revenue was 60000 Crore [1].")

    result = answer_with_rag("What is revenue?", company="PERSISTENT", top_k=3)

    assert result.retrieval_count == 1
    assert "60000" in result.answer
    assert len(result.citations) == 1
    assert result.citations[0].document == "screener.in"
