from agents.grok_client import call_grok
from tools.verification_tools import verify_metric
import json

def fundamental_debate(company: str) -> dict:
    print(f"fundamental_debate: start for {company}")
    try:
        # Fetch key metrics
        metrics = ["revenue", "pat", "roce", "debt_equity"]
        data = {}
        for m in metrics:
            res = verify_metric(company, "Q3FY24", m)
            data[m] = res.get("metric_value") if res.get("ok") else None
        
        print(f"fundamental_debate: metrics retrieved - {data}")
        
        prompt = f"""
        You are a fundamental equity analyst. Analyze {company} based on:
        Revenue: {data['revenue']}
        PAT: {data['pat']}
        ROCE: {data['roce']}
        Debt/Equity: {data['debt_equity']}
        
        Provide:
        1. Position (bullish/bearish/neutral) on financial quality.
        2. Confidence score (0-100).
        3. Three evidence points with sources (use metric names as sources).
        4. If any metric missing, state "Data missing".
        Output as JSON.
        """
        
        print(f"fundamental_debate: calling call_grok")
        response = call_grok([{"role": "user", "content": prompt}])
        
        if not response or not response.strip():
            print(f"fundamental_debate: ERROR - Empty response from call_grok")
            return {
                "position": "neutral",
                "confidence": 0,
                "evidence": ["Unable to fetch Grok response"],
                "reasoning": "API response was empty"
            }
        
        print(f"fundamental_debate: response received, length={len(response)}")
        
        # Try to parse JSON
        try:
            # Try to extract JSON if it's wrapped in markdown or text
            from agents.grok_client import extract_json_from_text
            json_str = extract_json_from_text(response)
            if not json_str:
                json_str = response
            
            print(f"fundamental_debate: attempting to parse JSON")
            result = json.loads(json_str)
            print(f"fundamental_debate: JSON parsed successfully")
            return result
        except json.JSONDecodeError as je:
            print(f"fundamental_debate: JSON decode error - {str(je)}")
            print(f"fundamental_debate: raw response - {response[:300]}")
            # Return a default response with all required fields
            return {
                "position": "neutral",
                "confidence": 0,
                "evidence": [response[:200]],
                "reasoning": "Failed to parse JSON response from Grok",
                "source": "fundamental_debater"
            }
    except Exception as e:
        print(f"fundamental_debate: ERROR - {type(e).__name__}: {str(e)}")
        raise