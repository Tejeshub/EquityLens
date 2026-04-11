import chromadb
from chromadb.utils import embedding_functions
from config import CHROMA_PERSIST_DIR

client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
collection_name = "equity_chunks"
# Use sentence-transformers for embeddings (or OpenAI)
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

def get_collection():
    return client.get_or_create_collection(name=collection_name, embedding_function=embedding_fn)

def add_chunks(texts: list, metadatas: list, ids: list):
    col = get_collection()
    col.add(documents=texts, metadatas=metadatas, ids=ids)

def search_chunks(query: str, n_results: int = 5) -> dict:
    col = get_collection()
    results = col.query(query_texts=[query], n_results=n_results)
    return {
        "documents": results["documents"][0] if results["documents"] else [],
        "metadatas": results["metadatas"][0] if results["metadatas"] else [],
        "distances": results["distances"][0] if results["distances"] else []
    }