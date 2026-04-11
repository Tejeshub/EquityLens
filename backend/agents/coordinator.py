from app.agents.grok_client import call_grok
import json

def debate_coordinator(company: str, fundamental_out, sentiment_out, alt_out, threshold=0.7) -> dict:
    # First round: gather and check confidences
    all_outputs = [fundamental_out, sentiment_out, alt_out]
    low_conf = [o for o in all_outputs if o.get("confidence", 0) < threshold]
    refinement_cycles = 0
    
    # Refinement loop (max 2 rounds)
    while low_conf and refinement_cycles < 2:
        critiques = []
        for o in all_outputs:
            if o.get("confidence", 0) >= threshold:
                critiques.append(o.get("position", ""))
        for lc in low_conf:
            # ask each low-confidence debater to revise (simplified: we just re-prompt)
            revise_prompt = f"Your previous analysis had low confidence. Here are critiques from others: {critiques}. Revise your position and provide updated confidence."
            # In real code, you'd call the debater again with this prompt.
            # For demo, we just increase confidence artificially.
            lc["confidence"] = min(lc["confidence"] + 20, 100)
        refinement_cycles += 1
        low_conf = [o for o in all_outputs if o.get("confidence", 0) < threshold]
    
    # Final synthesis
    synthesis_prompt = f"""
    Company: {company}
    Fundamental analyst: {fundamental_out}
    Sentiment analyst: {sentiment_out}
    Alternative data analyst: {alt_out}
    Refinement cycles: {refinement_cycles}
    
    Produce final scorecard as JSON with:
    - dimensions: list of { "dimension": "industry_position", "score": 0-100, "confidence": 0-100, "reasoning": "...", "citations": [...] }
    - overall_grade: "A" to "F"
    - coordinator_confidence: float
    - refinement_cycles: int
    """
    final = call_grok([{"role": "user", "content": synthesis_prompt}])
    return json.loads(final)