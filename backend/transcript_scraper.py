import requests
import tempfile
import os
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from bs4 import BeautifulSoup
from pathlib import Path
import chromadb
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

from tools.chroma_tools import embed_text_chunks


class TranscriptScraper:
    """Scrape PDF transcripts and documents from Screener.in's documents section."""
    
    BASE_URL = "https://www.screener.in"
    CACHE_DIR = Path(tempfile.gettempdir()) / "pdf_cache"
    MAX_WORKERS = 5  # Concurrent downloads
    
    def __init__(self, ticker: str, chroma_client: Optional[chromadb.Client] = None, max_pdfs: int = 5):
        """
        Initialize transcript scraper.
        
        Args:
            ticker: Company ticker (e.g., 'PERSISTENT')
            chroma_client: ChromaDB client for embedding chunks
            max_pdfs: Maximum number of PDFs to download and process (default: 5)
        """
        self.ticker = ticker.upper()
        self.company_url = f"{self.BASE_URL}/company/{self.ticker}/"
        self.chroma_client = chroma_client
        self.max_pdfs = max_pdfs
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        
        # Create cache directory
        self.CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
        if pdfplumber is None:
            print("WARNING: pdfplumber not installed. PDF extraction will fail. Install with: pip install pdfplumber")
    
    def scrape_documents(self, company_name: str) -> Dict:
        """
        Scrape all documents with concurrent downloads and parallel page extraction.
        
        Key optimizations:
        - Concurrent PDF downloads (up to 5 at a time)
        - Skip HEAD requests - download with size check inline
        - Parallel page extraction using ThreadPoolExecutor
        - Local caching to avoid re-downloads
        
        Args:
            company_name: Full company name for metadata
        
        Returns:
            {ok: bool, documents_found: int, embedded_chunks: int, doc_types: list, error: str}
        """
        print(f"scrape_documents: start for {self.ticker}")
        all_chunks = []
        doc_types_list = []
        errors = []
        
        try:
            # Fetch Screener company page
            print(f"scrape_documents: fetching Screener page for {self.ticker}")
            soup = self._fetch_company_page()
            if not soup:
                msg = "Failed to fetch Screener company page"
                print(msg)
                return {
                    "ok": False,
                    "documents_found": 0,
                    "embedded_chunks": 0,
                    "doc_types": [],
                    "error": msg
                }
            
            # Extract PDF links from documents section
            print(f"scrape_documents: extracting PDF links")
            pdf_links = self._extract_pdf_links(soup)
            print(f"scrape_documents: found {len(pdf_links)} PDF links")
            
            if not pdf_links:
                msg = f"No documents found for {self.ticker}"
                print(msg)
                return {
                    "ok": False,
                    "documents_found": 0,
                    "embedded_chunks": 0,
                    "doc_types": [],
                    "error": msg
                }
            
            # Limit to max_pdfs and prepare download tasks
            tasks_to_process = pdf_links[:self.max_pdfs]
            print(f"scrape_documents: processing {len(tasks_to_process)} PDFs with concurrent downloads (max {self.MAX_WORKERS} parallel)")
            
            # Download PDFs concurrently
            downloaded_pdfs = []
            with ThreadPoolExecutor(max_workers=self.MAX_WORKERS) as executor:
                future_to_pdf = {
                    executor.submit(self._download_pdf_cached, doc_info.get("url"), doc_info.get("title")): doc_info
                    for doc_info in tasks_to_process
                }
                
                completed = 0
                for future in as_completed(future_to_pdf):
                    completed += 1
                    doc_info = future_to_pdf[future]
                    pdf_title = doc_info.get("title", "Unknown")
                    
                    try:
                        pdf_content = future.result()
                        if pdf_content:
                            downloaded_pdfs.append((pdf_content, doc_info))
                            print(f"scrape_documents: downloaded {completed}/{len(tasks_to_process)} - {pdf_title}")
                        else:
                            print(f"scrape_documents: skipped {pdf_title} (size or validation failed)")
                            errors.append(f"Failed to download: {pdf_title}")
                    except Exception as e:
                        print(f"scrape_documents: error downloading {pdf_title}: {str(e)}")
                        errors.append(f"Download error: {pdf_title}")
            
            # Process PDFs - extract text and chunks (sequential, but pages are parallel)
            print(f"scrape_documents: extracting text from {len(downloaded_pdfs)} PDFs")
            for pdf_content, doc_info in downloaded_pdfs:
                try:
                    pdf_url = doc_info.get("url")
                    doc_title = doc_info.get("title", "Unknown")
                    doc_date = doc_info.get("date", "")
                    doc_type = self._infer_doc_type(doc_title)
                    
                    # Extract text and create chunks (pages extracted in parallel)
                    chunks = self._create_document_chunks(
                        pdf_content, doc_title, doc_type, doc_date, pdf_url, company_name
                    )
                    
                    if chunks:
                        all_chunks.extend(chunks)
                        if doc_type not in doc_types_list:
                            doc_types_list.append(doc_type)
                        print(f"scrape_documents: created {len(chunks)} chunks for {doc_title}")
                    else:
                        print(f"scrape_documents: no chunks created for {doc_title}")
                        errors.append(f"No text extracted from: {doc_title}")
                
                except Exception as e:
                    msg = f"Error processing {doc_title}: {type(e).__name__}: {str(e)}"
                    print(f"scrape_documents: {msg}")
                    errors.append(msg)
            
            documents_found = len(downloaded_pdfs)
            
            # Embed all chunks to ChromaDB if present
            embedded_count = 0
            if all_chunks and self.chroma_client:
                try:
                    result = embed_text_chunks(all_chunks)
                    embedded_count = result.get("count", 0)
                    print(f"scrape_documents: embedded {embedded_count} chunks to ChromaDB")
                except Exception as e:
                    msg = f"ChromaDB embedding failed: {str(e)}"
                    print(f"scrape_documents: {msg}")
                    errors.append(msg)
            
            success = documents_found > 0
            if success:
                print(f"scrape_documents: end (success) - {documents_found} documents, {embedded_count} chunks, types: {doc_types_list}")
            else:
                print(f"scrape_documents: end (no documents found)")
            
            return {
                "ok": success,
                "documents_found": documents_found,
                "embedded_chunks": embedded_count,
                "doc_types": doc_types_list,
                "error": "; ".join(errors) if errors else None
            }
        
        except Exception as e:
            msg = f"Scraping failed: {type(e).__name__}: {str(e)}"
            print(f"scrape_documents: ERROR - {msg}")
            return {
                "ok": False,
                "documents_found": 0,
                "embedded_chunks": 0,
                "doc_types": [],
                "error": msg
            }
    
    def _get_cache_path(self, url: str) -> Path:
        """Get cache file path for URL (using hash)."""
        url_hash = hashlib.md5(url.encode()).hexdigest()
        return self.CACHE_DIR / f"{url_hash}.pdf"
    
    def _download_pdf_cached(self, pdf_url: str, title: str = "", timeout: int = 30, max_size_mb: int = 10) -> Optional[bytes]:
        """
        Download PDF with caching. Skip HEAD request - just download with size check.
        
        Optimization: Direct download without HEAD request saves ~500ms per file
        
        Args:
            pdf_url: PDF URL
            title: Document title for logging
            timeout: Download timeout in seconds
            max_size_mb: Maximum size in MB (default: 10)
        
        Returns:
            PDF content as bytes, or None if failed or exceeds size limit
        """
        try:
            max_size_bytes = max_size_mb * 1024 * 1024
            
            # Check cache first
            cache_path = self._get_cache_path(pdf_url)
            if cache_path.exists():
                cached_size = cache_path.stat().st_size
                print(f"_download_pdf_cached: using cache for {title} ({cached_size / 1024 / 1024:.1f}MB)")
                return cache_path.read_bytes()
            
            # Download directly (skip HEAD request to save time)
            print(f"_download_pdf_cached: downloading {title}...")
            resp = self.session.get(pdf_url, timeout=timeout, stream=True)
            resp.raise_for_status()
            
            # Check content-length during download
            content_length = resp.headers.get('content-length')
            if content_length and int(content_length) > max_size_bytes:
                file_size_mb = int(content_length) / 1024 / 1024
                print(f"_download_pdf_cached: skipping {title} ({file_size_mb:.1f}MB exceeds {max_size_mb}MB)")
                return None
            
            # Download and validate
            pdf_content = resp.content
            if b"%PDF" not in pdf_content[:10]:
                print(f"_download_pdf_cached: invalid PDF for {title}")
                return None
            
            # Cache it
            cache_path.write_bytes(pdf_content)
            file_size_mb = len(pdf_content) / 1024 / 1024
            print(f"_download_pdf_cached: cached {title} ({file_size_mb:.1f}MB)")
            return pdf_content
        
        except Exception as e:
            print(f"_download_pdf_cached: ERROR - {str(e)}")
            return None
    
    def _extract_text_from_pdf_parallel(self, pdf_content: bytes, max_workers: int = 4) -> List[Dict]:
        """
        Extract text from PDF pages in parallel.
        
        Optimization: For 282-page PDFs, parallel extraction is 3-4x faster
        
        Args:
            pdf_content: PDF content as bytes
            max_workers: Number of parallel workers for page extraction
        
        Returns:
            List of dicts: {text, page_num}
        """
        if pdfplumber is None:
            print("_extract_text_from_pdf_parallel: pdfplumber not installed")
            return []
        
        try:
            # Save PDF to temp file
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
                tmp_file.write(pdf_content)
                tmp_path = tmp_file.name
            
            try:
                # Get total pages first
                with pdfplumber.open(tmp_path) as pdf:
                    total_pages = len(pdf.pages)
                    print(f"_extract_text_from_pdf_parallel: extracting {total_pages} pages (parallel, {max_workers} workers)")
                
                # Extract pages in parallel
                pages_data = []
                def extract_page(args):
                    page_num, tmp_path = args
                    try:
                        with pdfplumber.open(tmp_path) as pdf:
                            page = pdf.pages[page_num - 1]
                            text = page.extract_text()
                            if text and text.strip():
                                return {"text": text, "page_num": page_num}
                    except Exception as e:
                        print(f"_extract_text_from_pdf_parallel: error page {page_num}: {str(e)}")
                    return None
                
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    futures = [executor.submit(extract_page, (i, tmp_path)) for i in range(1, total_pages + 1)]
                    for future in as_completed(futures):
                        result = future.result()
                        if result:
                            pages_data.append(result)
                
                print(f"_extract_text_from_pdf_parallel: extracted {len(pages_data)}/{total_pages} pages")
                return pages_data
            
            finally:
                try:
                    os.unlink(tmp_path)
                except:
                    pass
        
        except Exception as e:
            print(f"_extract_text_from_pdf_parallel: ERROR - {str(e)}")
            return []
    
    def _fetch_company_page(self) -> Optional[BeautifulSoup]:
        """Fetch Screener company page HTML."""
        try:
            resp = self.session.get(self.company_url, timeout=30)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except Exception as e:
            print(f"_fetch_company_page: ERROR - {str(e)}")
            return None
    
    def _extract_pdf_links(self, soup: BeautifulSoup) -> List[Dict]:
        """
        Extract PDF links from Screener documents section.
        
        Returns:
            List of dicts: {url, title, date}
        """
        pdf_links = []
        
        try:
            # Look for all links that end with .pdf
            for link in soup.find_all("a", href=True):
                href = link.get("href", "")
                text = link.get_text(strip=True)
                
                # Match PDF links
                if ".pdf" in href.lower() and text.strip():
                    # Extract date if present in text
                    date_match = re.search(r"(\d{4}-\d{2}-\d{2}|\d{4}-\d{2}|\w+FY\d{2})", text)
                    doc_date = date_match.group(1) if date_match else ""
                    
                    # Normalize URL (handle relative URLs)
                    if href.startswith("http"):
                        url = href
                    elif href.startswith("/"):
                        url = self.BASE_URL + href
                    else:
                        continue  # Skip invalid URLs
                    
                    pdf_links.append({
                        "url": url,
                        "title": text,
                        "date": doc_date
                    })
            
            print(f"_extract_pdf_links: found {len(pdf_links)} PDF links")
            return pdf_links
        
        except Exception as e:
            print(f"_extract_pdf_links: ERROR - {str(e)}")
            return []
    
    def _infer_doc_type(self, doc_title: str) -> str:
        """Infer document type from title."""
        title_lower = doc_title.lower()
        
        if "annual" in title_lower and "transcript" in title_lower:
            return "annual_transcript"
        elif "quarterly" in title_lower and "transcript" in title_lower:
            return "quarterly_transcript"
        elif "q1" in title_lower or "q2" in title_lower or "q3" in title_lower or "q4" in title_lower:
            if "transcript" in title_lower:
                return "quarterly_transcript"
            elif "result" in title_lower:
                return "quarterly_results"
        elif "annual" in title_lower and "report" in title_lower:
            return "annual_report"
        elif "earnings" in title_lower:
            return "earnings_document"
        elif "transcript" in title_lower:
            return "transcript"
        elif "result" in title_lower:
            return "financial_results"
        elif "pdf" in title_lower or "document" in title_lower:
            return "document"
        else:
            return "other"
    
    def _chunk_text_by_paragraphs(self, text: str, page_num: int, min_chunk_size: int = 50) -> List[Dict]:
        """
        Chunk text by paragraph boundaries (preserve context).
        
        Args:
            text: Full page text
            page_num: Page number
            min_chunk_size: Minimum characters per chunk
        
        Returns:
            List of dicts: {text, page_num}
        """
        max_chunk_size = 1000

        # Split by double newlines (paragraph boundaries)
        pieces: List[str] = []
        for para in re.split(r"\n\s*\n", text):
            para = para.strip()
            if not para:
                continue
            # A single paragraph larger than the cap is split on sentence/word
            # boundaries so no chunk exceeds max_chunk_size.
            while len(para) > max_chunk_size:
                window = para[:max_chunk_size]
                cut = max(window.rfind(". "), window.rfind("? "), window.rfind("! "))
                cut = cut + 1 if cut > 0 else window.rfind(" ")
                if cut <= 0:
                    cut = max_chunk_size
                pieces.append(para[:cut].strip())
                para = para[cut:].strip()
            if para:
                pieces.append(para)

        # Greedily pack pieces into chunks of at most max_chunk_size chars.
        packed: List[str] = []
        current_chunk = ""
        for piece in pieces:
            potential = (current_chunk + "\n\n" + piece) if current_chunk else piece
            if len(potential) > max_chunk_size and current_chunk:
                packed.append(current_chunk)
                current_chunk = piece
            else:
                current_chunk = potential
        if current_chunk:
            packed.append(current_chunk)

        # Enforce min_chunk_size without losing content: an undersized chunk is
        # merged into its neighbour (previous, or next if it is first). Only if
        # the whole page is smaller than min_chunk_size is it dropped as noise.
        merged: List[str] = []
        carry = ""
        for chunk in packed:
            if carry:
                chunk = carry + "\n\n" + chunk
                carry = ""
            if len(chunk) < min_chunk_size:
                if merged:
                    merged[-1] = merged[-1] + "\n\n" + chunk
                else:
                    carry = chunk
            else:
                merged.append(chunk)

        return [{"text": c.strip(), "page_num": page_num} for c in merged if c.strip()]

    def _create_document_chunks(
        self,
        pdf_content: bytes,
        doc_title: str,
        doc_type: str,
        doc_date: str,
        pdf_url: str,
        company_name: str
    ) -> List[Dict]:
        """
        Extract text from PDF and create chunks with metadata.
        
        Args:
            pdf_content: PDF content as bytes
            doc_title: Document title
            doc_type: Document type (inferred)
            doc_date: Document date
            pdf_url: PDF URL for citation
            company_name: Company name for metadata
        
        Returns:
            List of chunk dicts: {text, metadata}
        """
        chunks = []
        
        try:
            # Extract text using parallel page extraction
            pages_data = self._extract_text_from_pdf_parallel(pdf_content, max_workers=4)
            if not pages_data:
                print(f"_create_document_chunks: no text extracted from {doc_title}")
                return chunks
            
            # Chunk each page
            for page_data in pages_data:
                page_text = page_data.get("text", "")
                page_num = page_data.get("page_num", 1)
                
                # Split by paragraphs
                page_chunks = self._chunk_text_by_paragraphs(page_text, page_num)
                
                # Add metadata to each chunk
                for page_chunk in page_chunks:
                    chunk_text = page_chunk.get("text", "")
                    chunk_page = page_chunk.get("page_num", page_num)
                    
                    # Citation setup
                    citation_label = f"{company_name} — {doc_type.replace('_', ' ').title()} ({doc_date})" if doc_date else f"{company_name} — {doc_type.replace('_', ' ').title()}"
                    
                    metadata = {
                        "company": company_name,
                        "ticker": self.ticker,
                        "source": "screener_documents",
                        "doc_type": doc_type,
                        "doc_date": doc_date,
                        "doc_title": doc_title,
                        "page_num": chunk_page,
                        "citation": pdf_url,
                        "citation_label": citation_label,
                    }
                    
                    chunks.append({
                        "text": chunk_text,
                        "metadata": metadata
                    })
            
            print(f"_create_document_chunks: created {len(chunks)} chunks from {doc_title}")
            return chunks
        
        except Exception as e:
            print(f"_create_document_chunks: ERROR - {str(e)}")
            return []
