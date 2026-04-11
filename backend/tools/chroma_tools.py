import uuid
from agno.tools import tool
from storage.semantic_store import add_chunks, search_chunks

@tool
def embed_text_chunks(chunks: list[dict]) -> dict:
    texts, metadatas, ids = [], [], []
    for c in chunks:
        texts.append(c["text"])
        metadatas.append(c["metadata"])
        ids.append(str(uuid.uuid4()))
    add_chunks(texts, metadatas, ids)
    return {"ok": True, "count": len(ids), "ids": ids}

@tool
def retrieve_evidence(query: str, n_results: int = 5) -> dict:
    return search_chunks(query, n_results=n_results)