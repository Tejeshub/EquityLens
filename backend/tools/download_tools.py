from storage.raw_store import save_raw_document
from storage.structured_store import insert_raw_document

def ingest_raw_document(company: str, source_type: str, url: str) -> dict:
    print(f"ingest_raw_document: start for {company} from {url}")
    try:
        print(f"ingest_raw_document: calling save_raw_document")
        raw_doc = save_raw_document(company, source_type, url)
        print(f"ingest_raw_document: save_raw_document completed, file_path={raw_doc['file_path']}")
        print(f"ingest_raw_document: calling insert_raw_document")
        raw_doc_id = insert_raw_document(raw_doc)
        print(f"ingest_raw_document: insert_raw_document completed, id={raw_doc_id}")
        raw_doc["raw_document_id"] = raw_doc_id
        print(f"ingest_raw_document: end (success)")
        return raw_doc
    except Exception as e:
        print(f"ingest_raw_document: ERROR - {type(e).__name__}: {str(e)}")
        raise