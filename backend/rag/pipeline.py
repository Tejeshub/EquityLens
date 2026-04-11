from typing import Optional

import google.generativeai as genai

from config import GEMINI_API_KEY, QA_MODEL
from rag.citation_parser import citations_from_chunks
from rag.ranker import rerank_chunks
from rag.retriever import retrieve_chunks
from rag.schemas import RagPipelineResult


genai.configure(api_key=GEMINI_API_KEY)


def _build_context(chunks) -> str:
    parts = []
    for chunk in chunks:
        meta = chunk.metadata or {}
        source = meta.get("source", "unknown")
        page = meta.get("page", "unknown")
        table_type = meta.get("table_type", "unknown")
        parts.append(
            f"[{chunk.rank}] {chunk.document}\nSource: {source}, page: {page}, table_type: {table_type}"
        )
    return "\n\n".join(parts)


def _generate_answer(question: str, company: Optional[str], context: str) -> str:
    prompt = f"""
You are an equity research Q&A assistant.
Answer ONLY using the supplied context.
For each factual statement, add citation tags like [1], [2] based on context item index.
If insufficient evidence exists, respond exactly:
I cannot verify that claim from available sources.

Question: {question}
Company: {company if company else 'any'}

Context:
{context}

Answer:
"""

    if QA_MODEL == "gemini":
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        return (response.text or "").strip()

    from agents.grok_client import call_grok

    return (call_grok([{"role": "user", "content": prompt}]) or "").strip()


def answer_with_rag(question: str, company: Optional[str] = None, top_k: int = 8) -> RagPipelineResult:
    """RAG-first QA: retrieve, rerank, generate answer, return citations + retrieval diagnostics."""
    print(f"answer_with_rag: start (company={company}, top_k={top_k})")

    chunks = retrieve_chunks(question, company=company, n_results=top_k)
    print(f"answer_with_rag: retrieved {len(chunks)} chunks")

    ranked = rerank_chunks(chunks)
    citations = citations_from_chunks(ranked)

    if not ranked:
        print("answer_with_rag: no chunks found")
        return RagPipelineResult(
            answer="I cannot verify that claim from available sources.",
            citations=[],
            retrieved_chunks=[],
            retrieval_count=0,
            fallback_used=False,
        )

    context = _build_context(ranked)

    answer = _generate_answer(question, company, context)
    print(f"answer_with_rag: generated answer length={len(answer)}")

    if not answer:
        raise RuntimeError("RAG generator produced empty answer")

    return RagPipelineResult(
        answer=answer,
        citations=citations,
        retrieved_chunks=ranked,
        retrieval_count=len(ranked),
        fallback_used=False,
    )
