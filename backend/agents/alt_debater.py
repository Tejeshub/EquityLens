import json
import requests
from bs4 import BeautifulSoup
from agents.grok_client import call_grok
from config import USER_AGENT

def alt_debate(company: str) -> dict:
    print(f"alt_debate: start for {company}")
    try:
        # Alternative data: hiring trends (LinkedIn jobs), government filings (MCA), web traffic (SimilarWeb mock)
        headers = {"User-Agent": USER_AGENT}
        
        # Mock job postings count (in reality, scrape LinkedIn)
        jobs_count = 0
        try:
            # Example: search Google for "company name hiring"
            search_url = f"https://www.google.com/search?q={company}+hiring"
            print(f"alt_debate: fetching job postings")
            resp = requests.get(search_url, headers=headers, timeout=10)
            if "hiring" in resp.text.lower():
                jobs_count = 15  # mock
        except Exception as e:
            print(f"alt_debate: WARNING - failed to fetch job postings: {type(e).__name__}")
            jobs_count = 5
        
        # Mock web traffic rank (lower is better)
        traffic_rank = 5000  # placeholder
        
        # MCA filing trends (simplified)
        mca_risk = "low"
        
        context = f"""
        Alternative data for {company}:
        - Job postings count (past month): {jobs_count}
        - Web traffic rank (SimilarWeb): {traffic_rank}
        - MCA compliance risk: {mca_risk}
        """
        
        prompt = f"""
        You are an alternative data analyst. Use the following non-traditional signals to assess the company's health and outlook.
        
        {context}
        
        Output JSON:
        - "position": "bullish", "bearish", or "neutral"
        - "confidence": integer 0-100
        - "signals": list of interpretations (e.g., "increasing hiring suggests growth")
        - "reasoning": short explanation
        """
        print(f"alt_debate: calling call_grok")
        response = call_grok([{"role": "user", "content": prompt}])
        
        if not response or not response.strip():
            print(f"alt_debate: ERROR - Empty response from call_grok")
            return {
                "position": "neutral",
                "confidence": 0,
                "signals": ["Unable to fetch response"],
                "reasoning": "API response was empty"
            }
        
        print(f"alt_debate: parsing response")
        try:
            # Try to extract JSON if it's wrapped in markdown or text
            from agents.grok_client import extract_json_from_text
            json_str = extract_json_from_text(response)
            if not json_str:
                json_str = response
            
            print(f"alt_debate: attempting to parse JSON")
            result = json.loads(json_str)
            print(f"alt_debate: JSON parsed successfully")
            return result
        except json.JSONDecodeError as je:
            print(f"alt_debate: JSON decode error - {str(je)}")
            return {
                "position": "neutral",
                "confidence": 0,
                "signals": [response[:200]],
                "reasoning": "Failed to parse JSON response from Grok",
                "source": "alt_debater"
            }
    except Exception as e:
        print(f"alt_debate: ERROR - {type(e).__name__}: {str(e)}")
        raise