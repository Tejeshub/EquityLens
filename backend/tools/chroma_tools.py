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

def generate_chunks_from_table(table_dict: dict, table_type: str, company: str, ticker: str, source_url: str = "https://screener.in") -> list:
    """
    Generate text chunks from Screener table data for ChromaDB embedding.
    
    Args:
        table_dict: {'headers': [...], 'rows': {label: [val1, val2, ...]}}
        table_type: 'quarterly_results', 'profit_loss', 'balance_sheet', 'cash_flow', 'ratios'
        company: Company name
        ticker: Company ticker
        source_url: Screener URL for citation
    
    Returns:
        List of chunk dicts: {text: str, metadata: dict}
    """
    print(f"generate_chunks_from_table: start for {table_type} {ticker}")
    chunks = []
    
    if not table_dict or not table_dict.get("rows"):
        print(f"generate_chunks_from_table: empty table, skipping")
        return chunks
    
    headers = table_dict.get("headers", [])
    rows = table_dict.get("rows", {})

    # Normalize citation URL once to avoid duplicate /company/<ticker> segments.
    base_url = str(source_url).strip().rstrip("/")
    if "/company/" in base_url:
        citation_url = base_url + "/"
    else:
        citation_url = f"{base_url}/company/{ticker}/"
    citation_label = f"{table_type.replace('_', ' ').title()} table"
    
    # Create a comprehensive chunk with full table context
    if rows and headers:
        try:
            # Build header row text
            header_text = " | ".join(headers) if headers else "Data"
            
            # Build row texts
            row_texts = []
            for metric_name, values in rows.items():
                if metric_name.lower() in ["", "period", "date"]:
                    continue
                
                # Create row with metric name and values
                row_str = f"{metric_name}: "
                value_pairs = []
                for col_idx, value_str in enumerate(values):
                    if col_idx < len(headers):
                        # Pair each value with its column header/quarter
                        col_header = headers[col_idx] if headers else f"Col{col_idx}"
                        value_pairs.append(f"{col_header}={value_str}")
                
                row_str += ", ".join(value_pairs)
                row_texts.append(row_str)
            
            # Build full chunk text (keeping exact values, no synthesis)
            chunk_text = f"{table_type.replace('_', ' ').title()} for {ticker}:\n"
            chunk_text += "Headers: " + header_text + "\n"
            chunk_text += "\n".join(row_texts[:20])  # Limit rows per chunk to avoid too-large text
            
            metadata = {
                "company": company,
                "ticker": ticker,
                "source": "screener.in",
                "table_type": table_type,
                "citation": citation_url,
                "citation_label": citation_label,
            }
            
            chunks.append({
                "text": chunk_text,
                "metadata": metadata
            })
            
            # If many rows, create additional chunks for remaining rows
            remaining_rows = row_texts[20:]
            chunk_num = 2
            for i in range(0, len(remaining_rows), 20):
                chunk_slice = remaining_rows[i:i+20]
                chunk_text_continued = f"{table_type.replace('_', ' ').title()} for {ticker} (continued):\n"
                chunk_text_continued += "\n".join(chunk_slice)
                
                metadata_continued = metadata.copy()
                metadata_continued["chunk_num"] = chunk_num
                
                chunks.append({
                    "text": chunk_text_continued,
                    "metadata": metadata_continued
                })
                chunk_num += 1
            
        except Exception as e:
            print(f"generate_chunks_from_table: error generating chunks - {str(e)}")
    
    print(f"generate_chunks_from_table: end - created {len(chunks)} chunks")
    return chunks