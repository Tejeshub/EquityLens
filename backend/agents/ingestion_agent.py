from app.tools.discovery_tools import find_pdf_links
from app.tools.download_tools import ingest_raw_document
from app.tools.parser_tools import parse_pdf_preview, insert_financial_metric
from app.tools.chroma_tools import embed_text_chunks
import re

def run_ingestion(company: str, ir_page_url: str):
    # Step 1: find PDFs
    pdf_result = find_pdf_links(ir_page_url)
    if not pdf_result["ok"]:
        return {"error": "No PDFs found"}
    
    for pdf_info in pdf_result["pdf_links"]:
        # Step 2: download raw
        raw = ingest_raw_document(company, "filing", pdf_info["pdf_url"])
        raw_doc_id = raw["raw_document_id"]
        file_path = raw["file_path"]
        
        # Step 3: parse preview and extract metrics (simplified example)
        preview = parse_pdf_preview(file_path)
        # Here you would use LLM to extract metrics; for demo, we do regex
        text = " ".join([p["text"] for p in preview["pages"]])
        # Example: find revenue
        match = re.search(r"Revenue[:\s]*([\d,]+\.?\d*)\s*(crore|million|billion)", text, re.I)
        if match:
            value = float(match.group(1).replace(",", ""))
            unit = match.group(2)
            insert_financial_metric(company, "Q3FY24", "revenue", value, unit, raw_doc_id)
        
        # Step 4: chunk and embed (for semantic search)
        chunks = [{"text": p["text"], "metadata": {"company": company, "source": file_path, "page": p["page"]}} for p in preview["pages"]]
        embed_text_chunks(chunks)
    
    return {"ok": True, "company": company}