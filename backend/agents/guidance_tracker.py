from tools.verification_tools import verify_metric
import re

def track_guidance(company: str, transcript_chunks: list):
    guidance_entries = []
    # Simple regex extraction
    for chunk in transcript_chunks:
        # pattern: "we expect revenue growth of 10-12%"
        match = re.search(r"(?:expect|guidance|forecast).*?(\w+).*?(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\%", chunk, re.I)
        if match:
            metric = match.group(1)
            low = float(match.group(2))
            high = float(match.group(3))
            # verify actual from structured DB
            actual_res = verify_metric(company, "Q3FY24", metric)
            actual = actual_res.get("metric_value") if actual_res.get("ok") else None
            deviation = None
            if actual:
                mid = (low + high)/2
                deviation = (actual - mid)/mid * 100
            guidance_entries.append({
                "company": company,
                "quarter": "Q3FY24",
                "metric": metric,
                "guidance_lower": low,
                "guidance_upper": high,
                "actual": actual,
                "deviation": deviation
            })
    return guidance_entries