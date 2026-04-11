from pypdf import PdfReader
from sqlalchemy import text
from storage.structured_store import engine
import uuid
import os

def parse_pdf_preview(file_path: str) -> dict:
    print(f"parse_pdf_preview: start for {file_path}")
    try:
        # Check file existence and size
        if not os.path.exists(file_path):
            print(f"parse_pdf_preview: ERROR - file not found: {file_path}")
            return {"ok": False, "error": f"File not found: {file_path}"}
        
        file_size = os.path.getsize(file_path)
        print(f"parse_pdf_preview: file size: {file_size} bytes")
        
        # Check if it's actually a PDF
        with open(file_path, "rb") as f:
            header = f.read(4)
            if header != b"%PDF":
                print(f"parse_pdf_preview: WARNING - file header is {header}, not a valid PDF")
                return {"ok": False, "error": f"File is not a valid PDF (header: {header})"}
        
        print(f"parse_pdf_preview: creating PdfReader")
        try:
            reader = PdfReader(file_path)
        except Exception as pdf_err:
            print(f"parse_pdf_preview: PdfReader failed - {type(pdf_err).__name__}: {str(pdf_err)}")
            return {"ok": False, "error": f"PDF corrupted or unreadable: {type(pdf_err).__name__}"}
        
        print(f"parse_pdf_preview: PdfReader created, total pages: {len(reader.pages)}")
        if len(reader.pages) == 0:
            print(f"parse_pdf_preview: WARNING - PDF has no pages")
            return {"ok": False, "error": "PDF has no pages"}
        
        pages = []
        for i, page in enumerate(reader.pages[:5], start=1):
            print(f"parse_pdf_preview: extracting text from page {i}")
            try:
                text = page.extract_text() or ""
                pages.append({"page": i, "text": text[:2000]})
            except Exception as page_err:
                print(f"parse_pdf_preview: WARNING - failed to extract page {i}: {type(page_err).__name__}")
                pages.append({"page": i, "text": ""})
        
        print(f"parse_pdf_preview: end (success) - extracted {len(pages)} pages")
        return {"ok": True, "file_path": file_path, "pages": pages}
    except Exception as e:
        print(f"parse_pdf_preview: ERROR - {type(e).__name__}: {str(e)}")
        return {"ok": False, "error": f"Unexpected error: {type(e).__name__}: {str(e)}"}

def insert_financial_metric(company_name: str, quarter: str, metric_name: str, metric_value: float, unit: str, source_document_id: str, confidence: float = 1.0) -> dict:
    print(f"insert_financial_metric: start for {company_name} {metric_name}")
    try:
        sql = text("""
        INSERT INTO financials_quarterly (id, company_name, quarter, metric_name, metric_value, unit, source_document_id, confidence)
        VALUES (:id, :company_name, :quarter, :metric_name, :metric_value, :unit, :source_document_id, :confidence)
        """)
        doc_id = str(uuid.uuid4())
        print(f"insert_financial_metric: inserting with id={doc_id}, value={metric_value}")
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
        print(f"insert_financial_metric: end (success)")
        return {"ok": True, "financial_metric_id": doc_id}
    except Exception as e:
        print(f"insert_financial_metric: ERROR - {type(e).__name__}: {str(e)}")
        raise