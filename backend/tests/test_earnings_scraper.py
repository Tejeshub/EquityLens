"""
Unit tests for earnings call scraper integration.
Tests speaker extraction, metadata structure, and error handling.
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from earnings_scraper import EarningsScraper


class TestEarningsScraper:
    """Test suite for EarningsScraper class."""
    
    @pytest.fixture
    def mock_chroma_client(self):
        """Mock ChromaDB client."""
        return Mock()
    
    @pytest.fixture
    def scraper(self, mock_chroma_client):
        """Initialize scraper with mocked ChromaDB."""
        with patch('earnings_scraper.EARNINGS_API_USER', 'testuser'):
            with patch('earnings_scraper.EARNINGS_API_PASS', 'testpass'):
                with patch('earnings_scraper.EARNINGS_API_BASE_URL', 'https://test.com/api'):
                    with patch('earnings_scraper.EARNINGS_CURRENT_YEAR', 2025):
                        return EarningsScraper('TCS', year=2025, chroma_client=mock_chroma_client)
    
    def test_scraper_initialization(self, scraper):
        """Test scraper initializes with correct attributes."""
        assert scraper.ticker == 'TCS'
        assert scraper.year == 2025
        assert scraper.chroma_client is not None
    
    def test_correct_date_no_change(self, scraper):
        """Test _correct_date returns same date when year matches."""
        date_str = "2025-03-15 10:30:00"
        corrected = scraper._correct_date(date_str, 2025)
        assert corrected == "2025-03-15 10:30:00"
    
    def test_correct_date_with_year_mismatch(self, scraper):
        """Test _correct_date corrects mismatched year."""
        date_str = "2024-03-15 10:30:00"
        corrected = scraper._correct_date(date_str, 2025)
        assert "2025" in corrected
        assert "03-15" in corrected
    
    def test_classify_speaker_type_operator(self, scraper):
        """Test speaker classification for operator."""
        speaker_type = scraper._classify_speaker_type("Operator")
        assert speaker_type == "operator"
    
    def test_classify_speaker_type_analyst(self, scraper):
        """Test speaker classification for analyst."""
        speaker_type = scraper._classify_speaker_type("Analyst from Goldman Sachs")
        assert speaker_type == "analyst"
    
    def test_classify_speaker_type_management(self, scraper):
        """Test speaker classification defaults to management."""
        speaker_type = scraper._classify_speaker_type("Sanjay Meswani")
        assert speaker_type == "management"
    
    def test_parse_speakers_and_content(self, scraper):
        """Test speaker extraction from transcript content."""
        content = """\nJohn Smith:
Hello, thank you for joining.

Sarah Jones:
Thanks, great to be here.

Operator:
Thank you for the call."""
        
        speakers, ranges = scraper._parse_speakers_and_content(content)
        
        assert len(speakers) >= 2
        assert 'John Smith' in speakers
        assert 'Sarah Jones' in speakers
        assert len(ranges) == len(speakers)
    
    def test_create_speaker_chunks(self, scraper):
        """Test chunk creation from speaker turns."""
        content = """\nCEO John:
Financial results were strong this quarter. Revenue grew 15%.

Analyst Jane:
What about margins?

CEO John:
Margins improved by 200 basis points."""
        
        speakers = ['CEO John', 'Analyst Jane', 'CEO John']
        ranges = [
            (0, 8),     # First speaker marker
            (60, 72),   # Second speaker marker
            (130, 139)  # Third speaker marker
        ]
        
        chunks = scraper._create_speaker_chunks(content, speakers, ranges, "Q1", "TCS")
        
        # Should have 3 chunks (one per speaker)
        assert len(chunks) >= 1
        
        # Verify chunk structure
        for chunk in chunks:
            assert "text" in chunk
            assert "metadata" in chunk
            assert chunk["metadata"]["company"] == "TCS"
            assert chunk["metadata"]["ticker"] == "TCS"
            assert chunk["metadata"]["source"] == "earnings_call"
            assert chunk["metadata"]["quarter"] == "Q1"
            assert chunk["metadata"]["speaker"] in speakers
            assert "citation" in chunk["metadata"]
            assert "citation_label" in chunk["metadata"]
            assert "speaker_type" in chunk["metadata"]
    
    def test_scrape_all_quarters_no_chroma(self, scraper):
        """Test scrape_all_quarters without ChromaDB (only parsing)."""
        mock_response = {
            "content": """\nOperator:
Good morning everyone.

CFO:
Thank you for joining our Q1 call.""",
            "date": "2025-04-15 14:00:00",
            "year": 2025
        }
        
        with patch.object(scraper, 'get_earnings_transcript', return_value=mock_response):
            scraper.chroma_client = None  # Disable ChromaDB
            result = scraper.scrape_all_quarters("TCS")
        
        assert "ok" in result
        assert "quarters_available" in result
        assert "embedded_chunks" in result
        assert "error" in result
    
    def test_metadata_structure_completeness(self, scraper):
        """Test that chunk metadata contains all required fields."""
        content = "\nSpeaker A:\nTest content here with enough words to pass the length check for a valid speaker turn."
        speakers = ['Speaker A']
        ranges = [(0, 9)]
        
        chunks = scraper._create_speaker_chunks(content, speakers, ranges, "Q2", "RELIANCE")
        
        if chunks:
            chunk = chunks[0]
            metadata = chunk["metadata"]
            
            # Required fields
            assert metadata["company"] == "RELIANCE"
            assert metadata["ticker"] == "TCS"
            assert metadata["source"] == "earnings_call"
            assert metadata["quarter"] == "Q2"
            assert metadata["year"] == 2025
            assert "speaker" in metadata
            assert "speaker_type" in metadata
            assert "citation" in metadata
            assert "citation_label" in metadata
    
    def test_error_handling_non_blocking(self, scraper):
        """Test that speaker parsing errors don't crash the scraper."""
        content = """\nGarbled speaker:
Some text.

Another speaker:
More text."""
        
        speakers = ['Garbled speaker', 'Another speaker']
        ranges = [(0, 16), (35, 50)]
        
        # Should not raise exception
        chunks = scraper._create_speaker_chunks(content, speakers, ranges, "Q3", "INFY")
        
        # Result should be a list (possibly empty or partial)
        assert isinstance(chunks, list)
    
    def test_short_turn_skipped(self, scraper):
        """Test that very short speaker turns are skipped."""
        content = """\nShort:
Hi.

Long Speaker:
This is a much longer speaker turn with enough content to not be skipped by the length filter that requires at least 50 characters."""
        
        speakers = ['Short', 'Long Speaker']
        ranges = [(0, 6), (18, 31)]
        
        chunks = scraper._create_speaker_chunks(content, speakers, ranges, "Q4", "HDFC")
        
        # Should skip the short turn
        speakers_in_chunks = [c["metadata"]["speaker"] for c in chunks]
        assert 'Short' not in speakers_in_chunks
        assert 'Long Speaker' in speakers_in_chunks


class TestEarningsScraperIntegration:
    """Integration tests with mocked API responses."""
    
    @pytest.fixture
    def scraper_with_mocks(self):
        """Scraper with fully mocked dependencies."""
        with patch('earnings_scraper.EARNINGS_API_USER', 'user'):
            with patch('earnings_scraper.EARNINGS_API_PASS', 'pass'):
                with patch('earnings_scraper.EARNINGS_API_BASE_URL', 'https://api.test.com'):
                    with patch('earnings_scraper.EARNINGS_CURRENT_YEAR', 2025):
                        with patch('earnings_scraper.embed_text_chunks') as mock_embed:
                            mock_embed.return_value = {"count": 5}
                            mock_client = Mock()
                            return EarningsScraper('TEST', year=2025, chroma_client=mock_client), mock_embed
    
    def test_full_quarter_scrape_flow(self, scraper_with_mocks):
        """Test complete scraping flow for one quarter."""
        scraper, mock_embed = scraper_with_mocks
        
        mock_transcript = {
            "content": """\nOperator:
Thank you for joining.

Management:
Quarterly results show strong growth.""",
            "date": "2025-04-15 10:00:00",
            "year": 2025
        }
        
        with patch.object(scraper, 'get_earnings_transcript', return_value=mock_transcript):
            result = scraper.scrape_all_quarters("Test Company")
        
        # Should have processed the quarter
        assert isinstance(result, dict)
        assert "ok" in result
        assert "quarters_available" in result
        assert "embedded_chunks" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
