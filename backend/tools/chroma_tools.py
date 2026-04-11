import uuid
from storage.semantic_store import add_chunks, search_chunks

def embed_text_chunks(chunks: list[dict]) -> dict:
    print(f"embed_text_chunks: start with {len(chunks)} chunks")
    try:
        texts, metadatas, ids = [], [], []
        for c in chunks:
            texts.append(c["text"])
            metadatas.append(c["metadata"])
            ids.append(str(uuid.uuid4()))
        print(f"embed_text_chunks: calling add_chunks")
        add_chunks(texts, metadatas, ids)
        print(f"embed_text_chunks: end (success) - added {len(ids)} chunks")
        return {"ok": True, "count": len(ids), "ids": ids}
    except Exception as e:
        print(f"embed_text_chunks: ERROR - {type(e).__name__}: {str(e)}")
        raise

def retrieve_evidence(query: str, n_results: int = 5) -> dict:
    print(f"retrieve_evidence: start for query='{query}'")
    try:
        result = search_chunks(query, n_results=n_results)
        print(f"retrieve_evidence: end (success) - found {len(result.get('documents', []))} results")
        return result
    except Exception as e:
        print(f"retrieve_evidence: ERROR - {type(e).__name__}: {str(e)}")
        raise