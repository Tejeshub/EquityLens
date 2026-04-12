from agents.grok_client import call_grok
from tools.verification_tools import verify_metric
import json

def fundamental_debate(company: str) -> dict:
    print(f"fundamental_debate: start for {company}")
    try:
        # Fetch key metrics
        metrics = ["revenue", "pat", "roce", "debt_equity"]
        data = {}
        print(f"fundamental_debate: fetching metrics for quarter Q3FY24")
        for m in metrics:
            print(f"fundamental_debate:   fetching {m}...")
            res = verify_metric(company, "Q3FY24", m)
            if res.get("ok"):
                data[m] = res.get("metric_value")
                print(f"fundamental_debate:     {m} = {data[m]} {res.get('unit', '')}")
            else:
                data[m] = None
                print(f"fundamental_debate:     {m} = NONE (error: {res.get('error', 'unknown')})")
        
        print(f"fundamental_debate: metrics retrieved - {data}")
        
        system_prompt = """You are an expert fundamental equity analyst with 20+ years of experience analyzing financial statements and metrics.

Your analysis must be:
1. Data-driven: Back every claim with specific metric values
2. Comprehensive: Provide detailed step-by-step reasoning, not just conclusions
3. Methodical: Follow a clear analytical framework
4. Balanced: Consider both strengths and concerns
5. Specific: Give exact numbers, ratios, and comparisons

For each analysis, include:
- Key ratio analysis and trend direction
- Peer/sector comparison context
- Growth sustainability assessment
- Risk identification with evidence
- Overall financial quality verdict

Output reasoning as a detailed narrative explaining your analytical approach and findings."""

        user_prompt = f"""Analyze {company}'s fundamental financial quality using the following metrics from Q3FY24:
        - Revenue: {data['revenue']}
        - PAT (Net Profit): {data['pat']}
        - ROCE (Return on Capital Employed): {data['roce']}
        - Debt/Equity Ratio: {data['debt_equity']}

Please provide a comprehensive fundamental analysis with:

1. Position Assessment: Based on the metrics above, is the company's financial health BULLISH, BEARISH, or NEUTRAL? Explain specifically why.

2. Detailed Reasoning (3-4 sentences minimum): Walk through your analytical methodology:
   - Analyze each metric trend and what it indicates
   - Compare ROCE against industry benchmarks (target: >15% healthy)
   - Evaluate debt sustainability (D/E <1 is generally safer)
   - Consider revenue quality and PAT trend
   - Identify specific financial strengths and concerns
   
3. Confidence Score (0-100): How confident are you in this position? Account for data completeness.

4. Three Evidence Points: 
   - Point 1 (specific metric and its implication)
   - Point 2 (ratio analysis result)
   - Point 3 (trend or comparison finding)

5. Data Quality Note: If any metric is missing, state "Data missing: [metric_name]" and explain impact on analysis.

Output as valid JSON with fields: position, confidence, evidence (array of 3 strings), reasoning (detailed narrative string), source"""
        
        print(f"fundamental_debate: calling call_grok with enhanced prompt")
        response = call_grok([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ])
        
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