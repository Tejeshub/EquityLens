from pypdf import PdfReader
from agno.tools import tool
from sqlalchemy import text
from storage.structured_store import engine
import uuid

@tool
def parse_pdf_preview(file_path: str) -> dict:
    reader = PdfReader(file_path)
    pages = []
    for i, page in enumerate(reader.pages[:5], start=1):
        pages.append({"page": i, "text": (page.extract_text() or "")[:2000]})
    return {"ok": True, "file_path": file_path, "pages": pages}

@tool
def insert_financial_metric(company_name: str, quarter: str, metric_name: str, metric_value: float, unit: str, source_document_id: str, confidence: float = 1.0) -> dict:
    sql = text("""
    INSERT INTO financials_quarterly (id, company_name, quarter, metric_name, metric_value, unit, source_document_id, confidence)
    VALUES (:id, :company_name, :quarter, :metric_name, :metric_value, :unit, :source_document_id, :confidence)
    """)
    doc_id = str(uuid.uuid4())
    with engine.begin() as conn:
        conn.execute(sql, {
            "id": doc_id,
            "company_name": company_name,
            "quarter": quarter,
            "metric_name": metric_name,
            "metric_value": metric_value,
            "unit": unit,
            "source_document_id": source_document_id,
            "confidence": confidence,
        })
    return {"ok": True, "financial_metric_id": doc_id}