import os
import hashlib
import requests
from datetime import datetime
from config import USER_AGENT

RAW_DATA_DIR = "./raw_data"
os.makedirs(RAW_DATA_DIR, exist_ok=True)

def save_raw_document(company: str, source_type: str, url: str) -> dict:
    """Download and save raw document, return metadata dict."""
    print(f"save_raw_document: start for {company} from {url}")
    try:
        # Create company subdirectory
        company_dir = os.path.join(RAW_DATA_DIR, company)
        print(f"save_raw_document: creating directory {company_dir}")
        os.makedirs(company_dir, exist_ok=True)
        
        # Generate filename from URL
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        ext = ".pdf" if ".pdf" in url.lower() else ".html"
        filename = f"{source_type}_{datetime.now().strftime('%Y%m%d')}_{url_hash}{ext}"
        filepath = os.path.join(company_dir, filename)
        print(f"save_raw_document: downloading to {filepath}")
        
        # Download
        headers = {"User-Agent": USER_AGENT}
        resp = requests.get(url, headers=headers, timeout=60)
        resp.raise_for_status()
        print(f"save_raw_document: writing {resp.headers.get('content-length', 'unknown')} bytes")
        with open(filepath, "wb") as f:
            f.write(resp.content)
        
        file_size = os.path.getsize(filepath)
        print(f"save_raw_document: end (success) - saved {file_size} bytes")
        return {
            "raw_document_id": f"{company}_{source_type}_{url_hash}",
            "company": company,
            "source_type": source_type,
            "url": url,
            "file_path": filepath,
            "size_bytes": file_size,
            "downloaded_at": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"save_raw_document: ERROR - {type(e).__name__}: {str(e)}")
        raise