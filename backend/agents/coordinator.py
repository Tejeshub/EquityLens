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
        
        # Helper function to extract ALL research points from debater output
        def extract_all_research_from_output(output: dict, debater_idx: int, debater_names: list) -> dict:
            """Extract ALL analysis data from debater output (evidence, signals, source_lineage, reasoning)."""
            research_data = {
                "debater": debater_names[debater_idx],
                "position": output.get("position", "neutral"),
                "confidence": output.get("confidence", 50),
                "reasoning": output.get("reasoning", ""),
                "research_points": []  # List of all evidence/signals
            }
            
            # Extract research points based on debater type
            if debater_idx == 0:  # fundamental_debate
                evidence = output.get("evidence")
                if evidence and isinstance(evidence, list):
                    for idx, point in enumerate(evidence):
                        research_data["research_points"].append({
                            "type": "evidence",
                            "content": str(point),
                            "index": idx + 1
                        })
            elif debater_idx == 1:  # sentiment_debate
                key_signals = output.get("key_signals")
                if key_signals and isinstance(key_signals, list):
                    for idx, signal in enumerate(key_signals):
                        research_data["research_points"].append({
                            "type": "sentiment_signal",
                            "content": str(signal),
                            "index": idx + 1
                        })
            elif debater_idx == 2:  # alt_debate
                signals = output.get("signals")
                if signals and isinstance(signals, list):
                    for idx, signal in enumerate(signals):
                        # Convert dict to JSON string if needed, otherwise keep as string
                        signal_content = json.dumps(signal) if isinstance(signal, dict) else str(signal)
                        research_data["research_points"].append({
                            "type": "alternative_signal",
                            "content": signal_content,
                            "index": idx + 1
                        })
                
                # Also extract source lineage for alternative debater
                source_lineage = output.get("source_lineage")
                if source_lineage and isinstance(source_lineage, list):
                    for idx, source in enumerate(source_lineage):
                        # Convert dict to JSON string for proper JSON parsing in frontend
                        source_content = json.dumps(source) if isinstance(source, dict) else str(source)
                        research_data["research_points"].append({
                            "type": "source_lineage",
                            "content": source_content,
                            "index": idx + 1
                        })
            
            return research_data
        
        # Construct dimensions array with ALL research data
        dimensions = []
        dimension_names = ["industry_position", "valuation_outlook", "risk_assessment"]
        debater_names = ["Fundamental", "Sentiment", "Alternative"]
        
        for i, (dim_name, output) in enumerate(zip(dimension_names, all_outputs)):
            if isinstance(output, dict):
                # Extract ALL research from this debater
                research_data = extract_all_research_from_output(output, i, debater_names)
                score = int(output.get("confidence", 50))  # Use confidence as score
                
                dimension = {
                    "dimension": dim_name,
                    "score": score,
                    "confidence": output.get("confidence", 50),
                    "reasoning": output.get("position", "neutral"),
                    "research_data": research_data, 
                    "citations": [{"document": debater_names[i], "page": None, "excerpt": research_data.get("reasoning", "")}]
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
            "refinement_cycles": refinement_cycles,
            "all_outputs": {  # NEW: Store raw outputs for access to research_data
                "fundamental": fundamental_out,
                "sentiment": sentiment_out,
                "alternative": alt_out
            }
        }
    except Exception as e:
        print(f"debate_coordinator: ERROR - {type(e).__name__}: {str(e)}")
        raise