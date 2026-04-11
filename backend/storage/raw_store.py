import os
import hashlib
import requests
from datetime import datetime
from app.config import USER_AGENT

RAW_DATA_DIR = "./raw_data"
os.makedirs(RAW_DATA_DIR, exist_ok=True)

def save_raw_document(company: str, source_type: str, url: str) -> dict:
    """Download and save raw document, return metadata dict."""
    # Create company subdirectory
    company_dir = os.path.join(RAW_DATA_DIR, company)
    os.makedirs(company_dir, exist_ok=True)
    
    # Generate filename from URL
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    ext = ".pdf" if ".pdf" in url.lower() else ".html"
    filename = f"{source_type}_{datetime.now().strftime('%Y%m%d')}_{url_hash}{ext}"
    filepath = os.path.join(company_dir, filename)
    
    # Download
    headers = {"User-Agent": USER_AGENT}
    resp = requests.get(url, headers=headers, timeout=60)
    resp.raise_for_status()
    with open(filepath, "wb") as f:
        f.write(resp.content)
    
    return {
        "raw_document_id": f"{company}_{source_type}_{url_hash}",
        "company": company,
        "source_type": source_type,
        "url": url,
        "file_path": filepath,
        "size_bytes": os.path.getsize(filepath),
        "downloaded_at": datetime.now().isoformat()
    }