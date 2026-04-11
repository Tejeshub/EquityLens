import requests
import json
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_random_exponential, RetryError
import chromadb

from tools.chroma_tools import embed_text_chunks
from config import EARNINGS_API_USER, EARNINGS_API_PASS, EARNINGS_API_BASE_URL, EARNINGS_CURRENT_YEAR


class EarningsScraper:
    """Scrape earnings call transcripts from discountingcashflows.com API and store in ChromaDB."""
    
    def __init__(self, ticker: str, year: int = None, chroma_client: Optional[chromadb.Client] = None):
        """
        Initialize earnings scraper.
        
        Args:
            ticker: Company ticker (e.g., 'TCS')
            year: Year for earnings calls (defaults to current year from config)
            chroma_client: ChromaDB client for embedding chunks
        """
        self.ticker = ticker.upper()
        self.year = year or EARNINGS_CURRENT_YEAR
        self.chroma_client = chroma_client
        self.api_base_url = EARNINGS_API_BASE_URL
        self.api_user = EARNINGS_API_USER
        self.api_pass = EARNINGS_API_PASS
        self.session = requests.Session()
        self.session.auth = (self.api_user, self.api_pass)
    
    @retry(
        wait=wait_random_exponential(min=1, max=5),
        stop=stop_after_attempt(2)
    )
    def get_earnings_transcript(self, quarter: str) -> Dict:
        """
        Fetch earnings transcript from discountingcashflows.com API.
        
        Args:
            quarter: Quarter string ('Q1', 'Q2', 'Q3', 'Q4')
        
        Returns:
            Response dict with 'content', 'date', 'year' fields
        
        Raises:
            requests.RequestException: If API call fails
        """
        print(f"get_earnings_transcript: fetching {self.ticker} {quarter} {self.year}")
        url = f"{self.api_base_url}/{self.ticker}/{quarter}/{self.year}/"
        
        response = self.session.get(url)
        response.raise_for_status()
        
        resp_list = json.loads(response.text)
        if not resp_list or len(resp_list) == 0:
            raise ValueError(f"No transcript found for {self.ticker} {quarter} {self.year}")
        
        resp_text = resp_list[0]
        
        # Correct date if year mismatch
        corrected_date = self._correct_date(resp_text.get("date", ""), self.year)
        resp_text["date"] = corrected_date
        
        return resp_text
    
    def _correct_date(self, date_str: str, year: int) -> str:
        """
        Correct transcript date if year doesn't match.
        
        Args:
            date_str: Date string from API (format: "YYYY-MM-DD HH:MM:SS")
            year: Expected year
        
        Returns:
            Corrected date string
        """
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
            if dt.year != year:
                dt = dt.replace(year=year)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception as e:
            print(f"_correct_date: error parsing date {date_str} - {str(e)}")
            return date_str
    
    def _parse_speakers_and_content(self, content: str) -> Tuple[List[str], List[Dict]]:
        """
        Extract speaker names and turn boundaries from transcript content.
        
        Args:
            content: Full transcript content
        
        Returns:
            Tuple of (speakers_list, speaker_turns_with_ranges)
        """
        print(f"_parse_speakers_and_content: start")
        pattern = re.compile(r"\n(.*?):")
        matches = list(pattern.finditer(content))
        
        speakers_list = []
        ranges = []
        
        for match_ in matches:
            span_range = match_.span()
            ranges.append(span_range)
            speaker_raw = match_.group(1).strip()
            # Clean speaker name (remove newlines and colons)
            speaker = re.sub(r"\n", "", speaker_raw)
            speaker = re.sub(r":", "", speaker)
            speakers_list.append(speaker)
        
        print(f"_parse_speakers_and_content: extracted {len(speakers_list)} speakers")
        return speakers_list, ranges
    
    def _classify_speaker_type(self, speaker_name: str) -> str:
        """
        Classify speaker as 'management', 'analyst', or 'operator' based on name patterns.
        
        Args:
            speaker_name: Speaker name from transcript
        
        Returns:
            Speaker type classification
        """
        name_lower = speaker_name.lower()
        
        # Operator/moderator patterns
        if any(x in name_lower for x in ["operator", "moderator"]):
            return "operator"
        
        # Analyst patterns
        if any(x in name_lower for x in ["analyst", "question", "attendee"]):
            return "analyst"
        
        # Default to management
        return "management"
    
    def _create_speaker_chunks(
        self,
        content: str,
        speakers_list: List[str],
        ranges: List[Tuple[int, int]],
        quarter: str,
        company_name: str
    ) -> List[Dict]:
        """
        Generate text chunks from speaker turns.
        
        Args:
            content: Full transcript content
            speakers_list: List of speaker names
            ranges: List of (start, end) character positions for each speaker
            quarter: Quarter (e.g., 'Q1')
            company_name: Company name for metadata
        
        Returns:
            List of chunk dicts {text, metadata}
        """
        print(f"_create_speaker_chunks: start for {len(speakers_list)} speakers")
        chunks = []
        
        for idx, speaker in enumerate(speakers_list[:-1]):
            try:
                start_range = ranges[idx][1]
                end_range = ranges[idx + 1][0]
                speaker_text = content[start_range + 1 : end_range].strip()
                
                # Skip very short turns (< 50 chars - likely parsing artifacts)
                if len(speaker_text) < 50:
                    print(f"_create_speaker_chunks: skipping short turn for {speaker}")
                    continue
                
                speaker_type = self._classify_speaker_type(speaker)
                
                # Generate citation metadata
                citation_url = f"{self.api_base_url}/{self.ticker}/{quarter}/{self.year}/"
                citation_label = f"Earnings Call {quarter} {self.year} — {speaker}"
                
                chunk = {
                    "text": f"{speaker} ({speaker_type}):\n{speaker_text}",
                    "metadata": {
                        "company": company_name,
                        "ticker": self.ticker,
                        "source": "earnings_call",
                        "quarter": quarter,
                        "year": self.year,
                        "speaker": speaker,
                        "speaker_type": speaker_type,
                        "citation": citation_url,
                        "citation_label": citation_label,
                    }
                }
                chunks.append(chunk)
            except Exception as e:
                print(f"_create_speaker_chunks: error processing speaker {speaker} - {str(e)}")
                continue
        
        # Add last speaker's turn
        try:
            if len(ranges) > 0:
                last_speaker = speakers_list[-1] if len(speakers_list) > 0 else "Unknown"
                speaker_text = content[ranges[-1][1] :].strip()
                
                if len(speaker_text) >= 50:
                    speaker_type = self._classify_speaker_type(last_speaker)
                    citation_url = f"{self.api_base_url}/{self.ticker}/{quarter}/{self.year}/"
                    citation_label = f"Earnings Call {quarter} {self.year} — {last_speaker}"
                    
                    chunk = {
                        "text": f"{last_speaker} ({speaker_type}):\n{speaker_text}",
                        "metadata": {
                            "company": company_name,
                            "ticker": self.ticker,
                            "source": "earnings_call",
                            "quarter": quarter,
                            "year": self.year,
                            "speaker": last_speaker,
                            "speaker_type": speaker_type,
                            "citation": citation_url,
                            "citation_label": citation_label,
                        }
                    }
                    chunks.append(chunk)
        except Exception as e:
            print(f"_create_speaker_chunks: error processing last speaker - {str(e)}")
        
        print(f"_create_speaker_chunks: created {len(chunks)} chunks")
        return chunks
    
    def scrape_all_quarters(self, company_name: str) -> Dict:
        """
        Scrape earnings transcripts for all quarters of the year.
        
        Args:
            company_name: Company name for metadata
        
        Returns:
            {ok: bool, quarters_available: list, embedded_chunks: int, error: str}
        """
        print(f"scrape_all_quarters: start for {self.ticker} {self.year}")
        all_chunks = []
        quarters_available = []
        errors = []
        
        for quarter in ["Q1", "Q2", "Q3", "Q4"]:
            print(f"scrape_all_quarters: processing {quarter}")
            try:
                resp_dict = self.get_earnings_transcript(quarter)
                content = resp_dict.get("content", "")
                
                if not content:
                    print(f"scrape_all_quarters: no content for {quarter}, skipping")
                    continue
                
                # Parse speakers and generate chunks
                speakers_list, ranges = self._parse_speakers_and_content(content)
                quarter_chunks = self._create_speaker_chunks(
                    content, speakers_list, ranges, quarter, company_name
                )
                
                if quarter_chunks:
                    all_chunks.extend(quarter_chunks)
                    quarters_available.append(quarter)
                    print(f"✅ {quarter}: {len(quarter_chunks)} chunks")
                else:
                    print(f"⚠️ {quarter}: no chunks generated")
            
            except RetryError:
                msg = f"No data available for {quarter} (API retry limit reached)"
                print(f"scrape_all_quarters: {msg}")
                errors.append(msg)
            except Exception as e:
                msg = f"{quarter}: {type(e).__name__}: {str(e)}"
                print(f"scrape_all_quarters: error - {msg}")
                errors.append(msg)
        
        # Embed all chunks to ChromaDB if present
        embedded_count = 0
        if all_chunks and self.chroma_client:
            try:
                result = embed_text_chunks(all_chunks)
                embedded_count = result.get("count", 0)
                print(f"scrape_all_quarters: embedded {embedded_count} chunks to ChromaDB")
            except Exception as e:
                print(f"scrape_all_quarters: ChromaDB embedding error - {str(e)}")
                errors.append(f"ChromaDB embedding failed: {str(e)}")
        
        # Determine success: at least one quarter with chunks
        success = len(quarters_available) > 0
        
        if success:
            print(f"scrape_all_quarters: end (success) - {len(quarters_available)} quarters, {embedded_count} chunks")
        else:
            print(f"scrape_all_quarters: end (failed) - no quarters available")
        
        return {
            "ok": success,
            "quarters_available": quarters_available,
            "embedded_chunks": embedded_count,
            "chunks_count": len(all_chunks),
            "error": "; ".join(errors) if errors else None
        }
