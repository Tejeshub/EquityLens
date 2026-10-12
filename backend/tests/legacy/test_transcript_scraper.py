import pytest
import tempfile
import os
from unittest.mock import Mock, patch, MagicMock
from bs4 import BeautifulSoup
from transcript_scraper import TranscriptScraper


class TestTranscriptScraperDocType:
    """Test document type inference."""
    
    def test_infer_annual_transcript(self):
        scraper = TranscriptScraper("TEST")
        doc_type = scraper._infer_doc_type("Annual General Meeting Transcript 2024")
        assert doc_type == "annual_transcript"
    
    def test_infer_quarterly_transcript(self):
        scraper = TranscriptScraper("TEST")
        doc_type = scraper._infer_doc_type("Q3 FY2025 Earnings Transcript")
        assert doc_type == "quarterly_transcript"
    
    def test_infer_quarterly_results(self):
        scraper = TranscriptScraper("TEST")
        doc_type = scraper._infer_doc_type("Q2 FY2025 Financial Results")
        assert doc_type == "quarterly_results"
    
    def test_infer_annual_report(self):
        scraper = TranscriptScraper("TEST")
        doc_type = scraper._infer_doc_type("Annual Report 2024-25")
        assert doc_type == "annual_report"


class TestTranscriptScraperExtractLinks:
    """Test PDF link extraction from HTML."""
    
    def test_extract_pdf_links_basic(self):
        """Test basic PDF link extraction."""
        scraper = TranscriptScraper("TEST")
        
        html = """
        <html>
            <a href="https://example.com/doc1.pdf">Q3 2024 Results</a>
            <a href="https://example.com/doc2.pdf">Annual Report 2024</a>
            <a href="https://example.com/page.html">Not a PDF</a>
        </html>
        """
        soup = BeautifulSoup(html, "html.parser")
        links = scraper._extract_pdf_links(soup)
        
        assert len(links) == 2
        assert links[0]["title"] == "Q3 2024 Results"
        assert links[1]["title"] == "Annual Report 2024"
        assert ".pdf" in links[0]["url"]
    
    def test_extract_pdf_links_with_dates(self):
        """Test date extraction from PDF link text."""
        scraper = TranscriptScraper("TEST")
        
        html = """
        <html>
            <a href="https://example.com/doc.pdf">Q3 FY2025 Results 2025-03-15</a>
        </html>
        """
        soup = BeautifulSoup(html, "html.parser")
        links = scraper._extract_pdf_links(soup)
        
        assert len(links) == 1
        assert "2025-03-15" in links[0]["date"]
    
    def test_extract_pdf_links_relative_urls(self):
        """Test handling of relative URLs."""
        scraper = TranscriptScraper("TEST")
        
        html = """
        <html>
            <a href="/documents/annual.pdf">Annual Report</a>
        </html>
        """
        soup = BeautifulSoup(html, "html.parser")
        links = scraper._extract_pdf_links(soup)
        
        assert len(links) == 1
        assert "screener.in" in links[0]["url"]
        assert "/documents/annual.pdf" in links[0]["url"]


class TestTranscriptScraperChunking:
    """Test text chunking functionality."""
    
    def test_chunk_text_by_paragraphs_basic(self):
        """Short paragraphs are packed together up to ~1000 chars (context preserved).

        Updated contract: the chunker greedily merges paragraphs into chunks of
        at most 1000 chars rather than emitting one chunk per paragraph, so three
        short paragraphs yield ONE chunk containing all of them, in order. The
        old assertion (>= 2 chunks) predated that packing behaviour.
        """
        scraper = TranscriptScraper("TEST")

        text = """This is paragraph 1 with some content.

This is paragraph 2 with different content.

This is paragraph 3."""

        chunks = scraper._chunk_text_by_paragraphs(text, page_num=1)

        assert len(chunks) == 1
        assert chunks[0]["page_num"] == 1
        body = chunks[0]["text"]
        assert body.index("paragraph 1") < body.index("paragraph 2") < body.index("paragraph 3")

        # Paragraphs that cannot share a 1000-char chunk are split at the boundary.
        para = "Word " * 80  # ~400 chars
        chunks = scraper._chunk_text_by_paragraphs(f"{para}\n\n{para}\n\n{para}", page_num=7)
        assert len(chunks) == 2
        assert all(c["page_num"] == 7 and len(c["text"]) <= 1000 for c in chunks)

    def test_chunk_text_by_paragraphs_large_text(self):
        """An oversized paragraph is split at <=1000 chars and no content is lost."""
        scraper = TranscriptScraper("TEST")

        # Create a paragraph larger than 1000 characters
        large_para = "This is a sentence. " * 100  # ~2000 chars
        text = f"{large_para}\n\nAnother paragraph."

        chunks = scraper._chunk_text_by_paragraphs(text, page_num=1)

        assert len(chunks) >= 2
        for chunk in chunks:
            assert 0 < len(chunk["text"]) <= 1000 + len("\n\nAnother paragraph.")
            assert chunk["page_num"] == 1
        joined = " ".join(c["text"] for c in chunks)
        # Regression: the short trailing paragraph used to be dropped by min-size.
        assert "Another paragraph." in joined
        assert joined.count("This is a sentence.") == 100

    def test_chunk_respects_min_chunk_size(self):
        """Test that very small chunks are filtered."""
        scraper = TranscriptScraper("TEST")
        
        text = """Short.

Also short."""
        
        chunks = scraper._chunk_text_by_paragraphs(text, page_num=1, min_chunk_size=50)
        
        # Both are too short, should get 0 or 1 chunks
        for chunk in chunks:
            assert len(chunk["text"]) >= 50


class TestTranscriptScraperMetadata:
    """Test metadata generation."""
    
    def test_create_document_chunks_metadata(self):
        """Test metadata structure in created chunks."""
        scraper = TranscriptScraper("PERSISTENT", chroma_client=None)
        
        # Create a mock PDF with simple content
        pdf_content = b"%PDF-1.4\n1 0 obj\n<</Type/Catalog>>\nendobj\nxref\ntrailer\n<</Size 2/Root 1 0 R>>\nstartxref\n0\n%%EOF"
        
        with patch.object(scraper, '_extract_text_from_pdf_parallel') as mock_extract:  # renamed from _extract_text_from_pdf
            mock_extract.return_value = [
                {"text": "Sample document content here, long enough to survive the min chunk size.", "page_num": 1},
                {"text": "Second page content, also long enough to survive the min chunk size filter.", "page_num": 2},
            ]
            
            chunks = scraper._create_document_chunks(
                pdf_content,
                doc_title="Test Document",
                doc_type="financial_results",
                doc_date="2025-03-15",
                pdf_url="https://example.com/test.pdf",
                company_name="Test Company"
            )
            
            assert len(chunks) > 0
            chunk = chunks[0]
            
            # Check metadata structure
            assert "text" in chunk
            assert "metadata" in chunk
            
            metadata = chunk["metadata"]
            assert metadata["company"] == "Test Company"
            assert metadata["ticker"] == "PERSISTENT"
            assert metadata["source"] == "screener_documents"
            assert metadata["doc_type"] == "financial_results"
            assert metadata["doc_date"] == "2025-03-15"
            assert metadata["page_num"] == 1
            assert metadata["citation"] == "https://example.com/test.pdf"
            assert metadata["citation_label"] != ""
            assert metadata["doc_title"] == "Test Document"
            assert "2025-03-15" in metadata["citation_label"]

            # Page metadata is preserved per page.
            assert [c["metadata"]["page_num"] for c in chunks] == [1, 2]


class TestTranscriptScraperIntegration:
    """Integration tests for complete workflow."""
    
    def test_scrape_documents_no_documents_found(self):
        """Test scraping when no documents are found."""
        scraper = TranscriptScraper("NONEXISTENT")
        
        with patch.object(scraper, '_fetch_company_page') as mock_fetch:
            # Return empty page
            mock_fetch.return_value = BeautifulSoup("<html></html>", "html.parser")
            
            result = scraper.scrape_documents("Nonexistent Company")
            
            assert result["ok"] == False
            assert result["documents_found"] == 0
            assert result["embedded_chunks"] == 0
            assert "No documents found" in result["error"]
    
    def test_scrape_documents_fetch_fails(self):
        """Test scraping when page fetch fails."""
        scraper = TranscriptScraper("PERSISTENT")
        
        with patch.object(scraper, '_fetch_company_page') as mock_fetch:
            mock_fetch.return_value = None
            
            result = scraper.scrape_documents("Persistent Systems")
            
            assert result["ok"] == False
            assert "Failed to fetch" in result["error"]
    
    def test_infer_doc_type_earnings(self):
        """Test earnings document type inference."""
        scraper = TranscriptScraper("TEST")
        doc_type = scraper._infer_doc_type("Earnings Call Transcript Q4 FY2025")
        assert "earnings" in doc_type or "transcript" in doc_type


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
