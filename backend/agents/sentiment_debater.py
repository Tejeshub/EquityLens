import json
import requests
from agents.grok_client import call_grok
from config import EXA_API_KEY, FIRECRAWL_API_KEY

def sentiment_debate(company: str) -> dict:
    # Use Exa to search for recent news and analyst reports
    exa_headers = {"Authorization": f"Bearer {EXA_API_KEY}", "Content-Type": "application/json"}
    exa_payload = {
        "query": f"{company} earnings sentiment news",
        "num_results": 5,
        "type": "keyword"
    }
    exa_resp = requests.post("https://api.exa.ai/search", json=exa_payload, headers=exa_headers, timeout=30)
    news_texts = []
    if exa_resp.status_code == 200:
        results = exa_resp.json().get("results", [])
        for r in results[:3]:
            news_texts.append(r.get("text", "")[:1000])
    
    # Use Firecrawl to scrape a known earnings call transcript page (mock URL)
    firecrawl_headers = {"Authorization": f"Bearer {FIRECRAWL_API_KEY}"}
    transcript_url = f"https://www.moneycontrol.com/company-article/{company}/transcript"
    transcript_text = ""
    try:
        fc_resp = requests.get(transcript_url, headers=firecrawl_headers, timeout=30)
        if fc_resp.status_code == 200:
            transcript_text = fc_resp.text[:2000]
    except:
        transcript_text = "Transcript not available"
    
    combined_context = f"News: {' '.join(news_texts)}\nTranscript excerpt: {transcript_text}"
    
    prompt = f"""
    You are a sentiment analyst. Based on the following news and earnings call transcript excerpt for {company}, assess market sentiment.
    
    {combined_context}
    
    Output JSON:
    - "position": "bullish", "bearish", or "neutral"
    - "confidence": integer 0-100
    - "key_signals": list of positive/negative signals from the text
    - "reasoning": short explanation
    """
    response = call_grok([{"role": "user", "content": prompt}])
    return json.loads(response)