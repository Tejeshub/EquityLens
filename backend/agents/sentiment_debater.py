import json
import requests
from agents.grok_client import call_grok
from config import EXA_API_KEY, FIRECRAWL_API_KEY

def sentiment_debate(company: str) -> dict:
    print(f"sentiment_debate: start for {company}")
    try:
        # Use Exa to search for recent news and analyst reports
        exa_headers = {"Authorization": f"Bearer {EXA_API_KEY}", "Content-Type": "application/json"}
        exa_payload = {
            "query": f"{company} earnings sentiment news",
            "num_results": 5,
            "type": "keyword"
        }
        print(f"sentiment_debate: calling Exa search")
        exa_resp = requests.post("https://api.exa.ai/search", json=exa_payload, headers=exa_headers, timeout=30)
        news_texts = []
        if exa_resp.status_code == 200:
            results = exa_resp.json().get("results", [])
            for r in results[:3]:
                news_texts.append(r.get("text", "")[:1000])
            print(f"sentiment_debate: Exa search returned {len(results)} results")
        else:
            print(f"sentiment_debate: Exa search failed with status {exa_resp.status_code}")
        
        # Use Firecrawl to scrape a known earnings call transcript page (mock URL)
        firecrawl_headers = {"Authorization": f"Bearer {FIRECRAWL_API_KEY}"}
        transcript_url = f"https://www.moneycontrol.com/company-article/{company}/transcript"
        transcript_text = ""
        try:
            print(f"sentiment_debate: fetching transcript from {transcript_url}")
            fc_resp = requests.get(transcript_url, headers=firecrawl_headers, timeout=30)
            if fc_resp.status_code == 200:
                transcript_text = fc_resp.text[:2000]
                print(f"sentiment_debate: transcript fetched successfully")
        except Exception as e:
            print(f"sentiment_debate: WARNING - failed to fetch transcript: {type(e).__name__}")
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
        print(f"sentiment_debate: calling call_grok")
        response = call_grok([{"role": "user", "content": prompt}])
        
        if not response or not response.strip():
            print(f"sentiment_debate: ERROR - Empty response from call_grok")
            return {
                "position": "neutral",
                "confidence": 0,
                "key_signals": ["Unable to fetch response"],
                "reasoning": "API response was empty"
            }
        
        print(f"sentiment_debate: parsing response")
        try:
            # Try to extract JSON if it's wrapped in markdown or text
            from agents.grok_client import extract_json_from_text
            json_str = extract_json_from_text(response)
            if not json_str:
                json_str = response
            
            print(f"sentiment_debate: attempting to parse JSON")
            result = json.loads(json_str)
            print(f"sentiment_debate: JSON parsed successfully")
            return result
        except json.JSONDecodeError as je:
            print(f"sentiment_debate: JSON decode error - {str(je)}")
            return {
                "position": "neutral",
                "confidence": 0,
                "key_signals": [response[:200]],
                "reasoning": "Failed to parse JSON response from Grok",
                "source": "sentiment_debater"
            }
    except Exception as e:
        print(f"sentiment_debate: ERROR - {type(e).__name__}: {str(e)}")
        raise