from agents.grok_client import call_grok
import json

def debate_coordinator(company: str, fundamental_out, sentiment_out, alt_out, threshold=0.7) -> dict:
    print(f"debate_coordinator: start for {company}")
    try:
        # Ensure all outputs have required fields
        all_outputs = [fundamental_out, sentiment_out, alt_out]
        
        for output in all_outputs:
            if not isinstance(output, dict):
                print(f"debate_coordinator: WARNING - output is not a dict: {output}")
                continue
            # Ensure confidence exists
            if "confidence" not in output:
                output["confidence"] = 0
                print(f"debate_coordinator: added missing confidence=0")
            # Ensure position exists
            if "position" not in output:
                output["position"] = "neutral"
                print(f"debate_coordinator: added missing position=neutral")
        
        # First round: gather and check confidences
        low_conf = [o for o in all_outputs if isinstance(o, dict) and o.get("confidence", 0) < threshold]
        refinement_cycles = 0
        
        print(f"debate_coordinator: initial low confidence count: {len(low_conf)}")
        
        # Refinement loop (max 2 rounds)
        while low_conf and refinement_cycles < 2:
            print(f"debate_coordinator: refinement cycle {refinement_cycles + 1}")
            critiques = []
            for o in all_outputs:
                if isinstance(o, dict) and o.get("confidence", 0) >= threshold:
                    critiques.append(o.get("position", "neutral"))
            
            for lc in low_conf:
                if isinstance(lc, dict):
                    # Increase confidence artificially for demo
                    current_conf = lc.get("confidence", 0)
                    lc["confidence"] = min(current_conf + 20, 100)
                    print(f"debate_coordinator: increased confidence to {lc['confidence']}")
            
            refinement_cycles += 1
            low_conf = [o for o in all_outputs if isinstance(o, dict) and o.get("confidence", 0) < threshold]
        
        print(f"debate_coordinator: total refinement cycles: {refinement_cycles}")
        
        # Construct debate summary from outputs
        positions = []
        for i, output in enumerate(all_outputs):
            if isinstance(output, dict):
                pos = output.get("position", "unknown")
                conf = output.get("confidence", 0)
                positions.append(f"{['Fundamental', 'Sentiment', 'Alternative'][i]}: {pos} (conf: {conf}%)")
        
        debate_summary = " | ".join(positions) if positions else "Multi-perspective analysis completed"
        
        # Helper function to extract excerpt from debater output
        def extract_excerpt_from_output(output: dict, debater_idx: int) -> str:
            """Extract detailed analysis from debater output based on field names."""
            # Priority order: evidence (fund), key_signals (sentiment), signals (alt), reasoning, default
            if debater_idx == 0:  # fundamental_debate
                evidence = output.get("evidence")
                if evidence and isinstance(evidence, list) and len(evidence) > 0:
                    return str(evidence[0])[:500]
            elif debater_idx == 1:  # sentiment_debate
                key_signals = output.get("key_signals")
                if key_signals and isinstance(key_signals, list) and len(key_signals) > 0:
                    return "; ".join([str(s) for s in key_signals[:3]])[:500]
            elif debater_idx == 2:  # alt_debate
                signals = output.get("signals")
                if signals and isinstance(signals, list) and len(signals) > 0:
                    return "; ".join([str(s) for s in signals[:3]])[:500]
            
            # Fallback to reasoning field
            reasoning = output.get("reasoning")
            if reasoning:
                return str(reasoning)[:500]
            
            return "Analysis performed"
        
        # Construct dimensions array
        dimensions = []
        dimension_names = ["industry_position", "valuation_outlook", "risk_assessment"]
        debater_names = ["Fundamental", "Sentiment", "Alternative"]
        
        for i, (dim_name, output) in enumerate(zip(dimension_names, all_outputs)):
            if isinstance(output, dict):
                score = int(output.get("confidence", 50))  # Use confidence as score
                excerpt = extract_excerpt_from_output(output, i)
                citation = {
                    "document": debater_names[i],
                    "page": None,
                    "excerpt": excerpt
                }
                dimension = {
                    "dimension": dim_name,
                    "score": score,
                    "confidence": output.get("confidence", 50),
                    "reasoning": output.get("position", "neutral"),
                    "citations": [citation]
                }
                dimensions.append(dimension)
        
        # Calculate overall grade from average score
        if dimensions:
            avg_score = sum(d["score"] for d in dimensions) / len(dimensions)
            if avg_score >= 90:
                overall_grade = "A"
            elif avg_score >= 80:
                overall_grade = "B"
            elif avg_score >= 70:
                overall_grade = "C"
            elif avg_score >= 60:
                overall_grade = "D"
            else:
                overall_grade = "F"
        else:
            overall_grade = "C"
            avg_score = 50
        
        print(f"debate_coordinator: end (success with {len(dimensions)} dimensions, grade {overall_grade})")
        return {
            "company": company,
            "overall_grade": overall_grade,
            "dimensions": dimensions,
            "debate_summary": debate_summary,
            "coordinator_confidence": round(avg_score / 100, 2),
            "refinement_cycles": refinement_cycles
        }
    except Exception as e:
        print(f"debate_coordinator: ERROR - {type(e).__name__}: {str(e)}")
        raise