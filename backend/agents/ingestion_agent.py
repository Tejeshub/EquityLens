from tools.discovery_tools import find_pdf_links
from tools.download_tools import ingest_raw_document
from tools.parser_tools import parse_pdf_preview, insert_financial_metric
from tools.chroma_tools import embed_text_chunks
import re

def run_ingestion(company: str, ir_page_url: str):
    print(f"run_ingestion: start for company={company}")
    try:
        # Step 1: find PDFs
        print(f"run_ingestion: calling find_pdf_links for {ir_page_url}")
        pdf_result = find_pdf_links(ir_page_url)
        print(f"run_ingestion: find_pdf_links returned {len(pdf_result.get('pdf_links', []))} PDFs")
        if not pdf_result["ok"]:
            return {"error": "No PDFs found"}
        
        processed_count = 0
        skipped_count = 0
        for pdf_info in pdf_result["pdf_links"]:
            print(f"run_ingestion: processing PDF {pdf_info['pdf_url']}")
            try:
                # Step 2: download raw
                print(f"run_ingestion: calling ingest_raw_document")
                raw = ingest_raw_document(company, "filing", pdf_info["pdf_url"])
                raw_doc_id = raw["raw_document_id"]
                file_path = raw["file_path"]
                print(f"run_ingestion: ingest_raw_document returned file_path={file_path}")
                
                # Step 3: parse preview and extract metrics (simplified example)
                print(f"run_ingestion: calling parse_pdf_preview for {file_path}")
                preview = parse_pdf_preview(file_path)
                if not preview.get("ok"):
                    print(f"run_ingestion: skipping PDF - {preview.get('error', 'unknown error')}")
                    skipped_count += 1
                    continue
                    
                print(f"run_ingestion: parse_pdf_preview returned {len(preview['pages'])} pages")
                # Here you would use LLM to extract metrics; for demo, we do regex
                text = " ".join([p["text"] for p in preview["pages"]])
                # Example: find revenue
                match = re.search(r"Revenue[:\s]*([\d,]+\.?\d*)\s*(crore|million|billion)", text, re.I)
                if match:
                    value = float(match.group(1).replace(",", ""))
                    unit = match.group(2)
                    print(f"run_ingestion: calling insert_financial_metric")
                    insert_financial_metric(company, "Q3FY24", "revenue", value, unit, raw_doc_id)
                    print(f"run_ingestion: insert_financial_metric completed")
                
                # Step 4: chunk and embed (for semantic search)
                print(f"run_ingestion: calling embed_text_chunks")
                chunks = [{"text": p["text"], "metadata": {"company": company, "source": file_path, "page": p["page"]}} for p in preview["pages"]]
                embed_text_chunks(chunks)
                print(f"run_ingestion: embed_text_chunks completed")
                processed_count += 1
            except Exception as e:
                print(f"run_ingestion: ERROR processing PDF - {type(e).__name__}: {str(e)}")
                skipped_count += 1
                continue
        
        print(f"run_ingestion: end (success) - processed {processed_count} PDFs, skipped {skipped_count}")
        return {"ok": True, "company": company, "processed": processed_count, "skipped": skipped_count}
    except Exception as e:
        print(f"run_ingestion: ERROR - {type(e).__name__}: {str(e)}")
        raise