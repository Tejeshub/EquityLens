from models import AskResponse, AskCitation, RetrievedChunk


def test_ask_response_serialization():
    response = AskResponse(
        answer="Revenue was 60000 Crore [1].",
        citations=[
            AskCitation(
                document="screener.in",
                page=None,
                excerpt="Revenue in Q3FY24 was 60000 Crore.",
                source="screener.in",
                table_type="quarterly_results",
                index=1,
            )
        ],
        retrieved_chunks=[
            RetrievedChunk(
                rank=1,
                document="Revenue in Q3FY24 was 60000 Crore.",
                metadata={"source": "screener.in", "table_type": "quarterly_results"},
                distance=0.12,
                score=0.89,
            )
        ],
        retrieval_count=1,
        fallback_used=False,
        error=None,
    )

    payload = response.model_dump()
    assert payload["answer"].startswith("Revenue")
    assert payload["retrieval_count"] == 1
    assert payload["citations"][0]["document"] == "screener.in"
    assert payload["retrieved_chunks"][0]["rank"] == 1
