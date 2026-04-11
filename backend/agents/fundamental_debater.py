# app/agents/fundamental_debater.py
from app.agents.grok_client import call_grok
from app.tools.verification_tools import verify_metric

def fundamental_debate(company: str) -> dict:
    # Fetch key metrics
    metrics = ["revenue", "pat", "roce", "debt_equity"]
    data = {}
    for m in metrics:
        res = verify_metric(company, "Q3FY24", m)
        data[m] = res.get("metric_value") if res.get("ok") else None
    
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
    response = call_grok([{"role": "user", "content": prompt}])
    # parse JSON
    import json
    return json.loads(response)