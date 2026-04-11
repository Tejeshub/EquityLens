from agno.tools import tool
from storage.raw_store import save_raw_document
from storage.structured_store import insert_raw_document

@tool
def ingest_raw_document(company: str, source_type: str, url: str) -> dict:
    raw_doc = save_raw_document(company, source_type, url)
    raw_doc_id = insert_raw_document(raw_doc)
    raw_doc["raw_document_id"] = raw_doc_id
    return raw_doc