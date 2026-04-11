import json
import requests
from bs4 import BeautifulSoup
from agents.grok_client import call_grok
from config import USER_AGENT

def alt_debate(company: str) -> dict:
    # Alternative data: hiring trends (LinkedIn jobs), government filings (MCA), web traffic (SimilarWeb mock)
    headers = {"User-Agent": USER_AGENT}
    
    # Mock job postings count (in reality, scrape LinkedIn)
    jobs_count = 0
    try:
        # Example: search Google for "company name hiring"
        search_url = f"https://www.google.com/search?q={company}+hiring"
        resp = requests.get(search_url, headers=headers, timeout=10)
        if "hiring" in resp.text.lower():
            jobs_count = 15  # mock
    except:
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
    response = call_grok([{"role": "user", "content": prompt}])
    return json.loads(response)