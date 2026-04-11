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
    print(f"add_chunks: start with {len(texts)} chunks")
    try:
        col = get_collection()
        print(f"add_chunks: adding to collection")
        col.add(documents=texts, metadatas=metadatas, ids=ids)
        print(f"add_chunks: end (success)")
    except Exception as e:
        print(f"add_chunks: ERROR - {type(e).__name__}: {str(e)}")
        raise

def search_chunks(query: str, n_results: int = 5) -> dict:
    print(f"search_chunks: start for query='{query}'")
    try:
        col = get_collection()
        print(f"search_chunks: querying collection")
        results = col.query(query_texts=[query], n_results=n_results)
        result_dict = {
            "documents": results["documents"][0] if results["documents"] else [],
            "metadatas": results["metadatas"][0] if results["metadatas"] else [],
            "distances": results["distances"][0] if results["distances"] else []
        }
        print(f"search_chunks: end (success) - found {len(result_dict['documents'])} results")
        return result_dict
    except Exception as e:
        print(f"search_chunks: ERROR - {type(e).__name__}: {str(e)}")
        raise