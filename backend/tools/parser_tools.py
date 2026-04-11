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

def parse_table_to_metrics_records(table_dict: dict, table_name: str, company: str, source_url: str, quarter_hints: dict = None) -> list:
    """
    Parse a Screener table into financial metric records.
    
    Args:
        table_dict: {'headers': [...], 'rows': {label: [val1, val2, ...]}}
        table_name: 'quarterly_results', 'profit_loss', 'balance_sheet', 'cash_flow', 'ratios'
        company: Company ticker/name
        source_url: Source URL for citation
        quarter_hints: Dict mapping column index to quarter (e.g., {0: 'Q3FY24', 1: 'Q2FY24'})
    
    Returns:
        List of metric records: {company_name, quarter, metric_name, metric_value, unit, source_document_id, confidence}
    """
    print(f"parse_table_to_metrics_records: start for {table_name} {company}")
    records = []
    
    if not table_dict or not table_dict.get("rows"):
        print(f"parse_table_to_metrics_records: empty table, skipping")
        return records
    
    headers = table_dict.get("headers", [])
    rows = table_dict.get("rows", {})
    
    # Default unit mappings by table type
    unit_map = {
        "quarterly_results": "Crore",
        "profit_loss": "Crore",
        "balance_sheet": "Crore",
        "cash_flow": "Crore",
        "ratios": "%"  # Most financial ratios are percentages
    }
    default_unit = unit_map.get(table_name, "")
    
    for metric_name, values in rows.items():
        # Skip rows that are clearly headers or non-metric rows
        if metric_name.lower() in ["", "period", "date", "quarter"]:
            continue
        
        # Process each value in the row (corresponding to headers/quarters)
        for col_idx, value_str in enumerate(values):
            try:
                # Try to convert to float
                if not value_str or value_str.strip() == "":
                    continue
                
                # Strip commas and convert to float
                value_str_clean = str(value_str).strip().replace(",", "")
                metric_value = float(value_str_clean)
                
                # Determine quarter from hints or column index
                quarter = "Unknown"
                if quarter_hints and col_idx in quarter_hints:
                    quarter = quarter_hints[col_idx]
                elif col_idx < len(headers):
                    # Try to extract quarter from header (e.g., "Q3FY24", "2024-Q3", etc.)
                    header_text = headers[col_idx].strip()
                    quarter = header_text if header_text else f"Col{col_idx}"
                
                # Create metric record
                record = {
                    "company_name": company,
                    "quarter": quarter,
                    "metric_name": metric_name.strip(),
                    "metric_value": metric_value,
                    "unit": default_unit,
                    "source_document_id": source_url,
                    "confidence": 0.95  # High confidence for Screener primary source
                }
                records.append(record)
                
            except (ValueError, TypeError):
                # Non-numeric value, skip silently
                continue
    
    print(f"parse_table_to_metrics_records: end - created {len(records)} records")
    return records

def batch_insert_financial_metrics(db_engine, metrics_list: list) -> dict:
    """
    Batch insert financial metrics into PostgreSQL.
    
    Args:
        db_engine: SQLAlchemy engine
        metrics_list: List of metric dicts {company_name, quarter, metric_name, metric_value, unit, source_document_id, confidence}
    
    Returns:
        {inserted: int, skipped: int, errors: list}
    """
    print(f"batch_insert_financial_metrics: start with {len(metrics_list)} records")
    inserted = 0
    skipped = 0
    errors = []
    
    if not metrics_list:
        print(f"batch_insert_financial_metrics: empty list, skipping")
        return {"inserted": 0, "skipped": 0, "errors": []}
    
    sql = text("""
    INSERT INTO financials_quarterly (id, company_name, quarter, metric_name, metric_value, unit, source_document_id, confidence)
    VALUES (:id, :company_name, :quarter, :metric_name, :metric_value, :unit, :source_document_id, :confidence)
    """)
    
    try:
        with db_engine.begin() as conn:
            for metric in metrics_list:
                try:
                    # Validate metric before insert
                    if not metric.get("company_name") or not metric.get("metric_name"):
                        skipped += 1
                        continue
                    
                    # Check if metric_value is valid
                    if metric.get("metric_value") is None:
                        skipped += 1
                        continue
                    
                    doc_id = str(uuid.uuid4())
                    conn.execute(sql, {
                        "id": doc_id,
                        "company_name": metric["company_name"],
                        "quarter": metric.get("quarter", "Unknown"),
                        "metric_name": metric["metric_name"],
                        "metric_value": metric["metric_value"],
                        "unit": metric.get("unit", ""),
                        "source_document_id": metric.get("source_document_id", ""),
                        "confidence": metric.get("confidence", 1.0),
                    })
                    inserted += 1
                except Exception as e:
                    skipped += 1
                    errors.append(f"Metric {metric.get('metric_name')}: {str(e)}")
                    print(f"batch_insert_financial_metrics: error for metric {metric}: {str(e)}")
        
        print(f"batch_insert_financial_metrics: end - inserted {inserted}, skipped {skipped}, errors {len(errors)}")
        return {"inserted": inserted, "skipped": skipped, "errors": errors}
    except Exception as e:
        print(f"batch_insert_financial_metrics: ERROR - {type(e).__name__}: {str(e)}")
        return {"inserted": inserted, "skipped": skipped, "errors": [str(e)]}