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
        
        system_prompt = """You are a data-driven alternative analyst who identifies non-traditional signals of company health.

Your alternative data analysis must be:
1. Integrative: Connect alternative signals to fundamental insights (hiring → expansion potential, traffic → demand)
2. Interpretive: Explain what each signal means for company trajectory, not just report raw metrics
3. Comparative: Provide context - is the signal strong/weak relative to peers or historical levels?
4. Forward-looking: What do these signals predict about near-term company performance?
5. Transparent: Clearly state source, methodology, and limitations of each data point

For each analysis:
- Interpret hiring trends as leading indicator of management confidence/growth
- Assess web traffic changes as proxy for demand, user engagement, competitive position
- Evaluate governance/compliance signals for operational discipline
- Synthesize all signals into coherent bull/bear case
- Note data quality and limitations"""

        user_prompt = f"""Conduct a comprehensive alternative data analysis for {company} using the following non-traditional signals:

{context}

Your analysis should include:

1. Overall Position Assessment: Based on alternative data signals, is the company BULLISH, BEARISH, or NEUTRAL? Confidence 0-100?

2. Hiring Trends Analysis:
   - Jobs posted ({jobs_count} in past month): What does this volume signal about expansion plans?
   - Month-over-month trend: Is it accelerating or slowing?
   - Skill profiles: What roles are they hiring for (growth or maintenance)?
   - What does this suggest about management confidence in future growth?

3. Web Traffic Trends Analysis:
   - Current rank: {traffic_rank} (lower is better)
   - Recent trend: Is traffic improving or declining?
   - Peer comparison: Is this strong/weak vs peers?
   - What does traffic change indicate about customer demand/engagement?

4. Governance & Compliance Signals:
   - MCA filing status: {mca_risk}
   - Promoter pledge levels: Low vs sector average
   - What do these signals suggest about governance quality and insider confidence?

5. Synthesis and Signals List:
   List each alternative signal as a numbered finding:
   - Signal 1: [Data point] indicates [interpretation]
   - Signal 2: [Data point] indicates [interpretation]
   - Signal 3: [Data point] indicates [interpretation]

6. Detailed Reasoning (minimum 4-5 sentences):
   - How do these signals collectively indicate company health?
   - Which signals are most predictive of near-term performance?
   - Any contradictions between signals? How to reconcile?
   - What early warning signs (if any) are present?
   - How confident are you given data quality and timing?

7. Source Lineage (for each signal):
   - Source: [Where data comes from]
   - Source URL: [Link to data source]
   - Last updated: [When was this measured]
   - Methodology: [How was metric calculated]

Output as valid JSON with fields: position, confidence, reasoning (detailed narrative, minimum 300 characters), signals (array of detailed findings), source_lineage (array with source details), source"""
        
        print(f"alt_debate: calling call_grok with enhanced prompt")
        response = call_grok([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ])
        
        if not response or not response.strip():
            print(f"alt_debate: ERROR - Empty response from call_grok")
            return {
                "position": "neutral",
                "confidence": 0,
                "signals": ["Unable to fetch response"],
                "reasoning": "API response was empty"
            }
        
        print(f"alt_debate: parsing response : {response[:200]}")
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