from tools.chroma_tools import retrieve_evidence
from tools.verification_tools import verify_metric
from config import QA_MODEL
# For Gemini or Grok
import google.generativeai as genai
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def answer_with_citations(question: str, company: str = None) -> tuple:
    # Retrieve semantic chunks
    evidence = retrieve_evidence(question, n_results=5)
    if not evidence["documents"]:
        return "I cannot verify that claim from available sources.", []
    
    # Verify any numeric claim using structured DB
    # (simplified: we assume LLM will check)
    prompt = f"""
    Question: {question}
    Company: {company if company else "any"}
    Retrieved evidence: {evidence['documents']}
    
    Answer only using the evidence. For each numerical fact, cite the source document and page from metadata.
    If the evidence does not contain the answer, say: "I cannot verify that claim from available sources."
    """
    if QA_MODEL == "gemini":
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        answer = response.text
    else:
        # use Grok
        from agents.grok_client import call_grok
        answer = call_grok([{"role": "user", "content": prompt}])
    
    # Extract citations from metadata (simplified)
    citations = [{"document": m.get("source", "unknown"), "page": m.get("page")} for m in evidence["metadatas"]]
    return answer, citations