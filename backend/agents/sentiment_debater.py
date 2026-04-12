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
        
        system_prompt = """You are a senior equity research analyst specializing in market sentiment and investor psychology analysis.

Your sentiment analysis must be:
1. Evidence-based: Find specific quotes or statements backing your sentiment assessment
2. Detailed: Explain the reasoning behind sentiment signals, not just list them
3. Multi-dimensional: Consider management tone, guidance, competitive positioning, and market reaction
4. Forward-looking: Assess what signals indicate about future company trajectory
5. Balanced: Identify both bullish and bearish signals, then synthesize into overall position

For each analysis, provide:
- Specific positive signals with direct quotes where possible
- Specific negative signals or concerns noted
- Management guidance quality and credibility assessment
- Market sentiment indicators and what they suggest
- Synthesis of all signals into coherent narrative"""

        user_prompt = f"""Analyze the market sentiment for {company} based on the news and earnings call materials provided below:

{combined_context}

Provide a comprehensive sentiment analysis including:

1. Overall Position: Is the market sentiment BULLISH, BEARISH, or NEUTRAL? Rate your confidence 0-100.

2. Key Bullish Signals (if any):
   - Signal 1: [Specific quote or fact] - [Why this is positive]
   - Signal 2: [Specific quote or fact] - [Why this is positive]
   
3. Key Bearish/Concern Signals (if any):
   - Signal 1: [Specific quote or fact] - [Why this is concerning]
   - Signal 2: [Specific quote or fact] - [Why this is concerning]

4. Management Guidance Assessment:
   - Revenue/growth guidance: [What was promised]
   - Profitability outlook: [What was promised]
   - Capital allocation: [Any new strategic direction]
   - Tone and confidence level: [How confident did they sound]
   - Credibility: [Previous guidance track record if mentioned]

5. Detailed Reasoning (minimum 4-5 sentences):
   - Synthesize the signals above into a coherent narrative
   - Explain what the aggregate sentiment indicates about company trajectory
   - Note any surprises or warnings
   - Link sentiment to fundamental health indicators
   - Assess sustainability of this sentiment

Output as valid JSON with fields: position, confidence, reasoning (detailed narrative string, minimum 300 characters), key_signals (array of signal descriptions), source"""
        
        print(f"sentiment_debate: calling call_grok with enhanced prompt")
        response = call_grok([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ])
        
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