import google.generativeai as genai
from config import GEMINI_API_KEY, QA_MODEL
from tools.chroma_tools import retrieve_evidence
from tools.verification_tools import verify_metric
import json

genai.configure(api_key=GEMINI_API_KEY)

def answer_with_citations(question: str, company: str = None) -> tuple:
    # Step 1: Retrieve relevant chunks from ChromaDB
    evidence = retrieve_evidence(question, n_results=5)
    if not evidence["documents"]:
        return "I cannot verify that claim from available sources.", []
    
    # Step 2: Build context from retrieved chunks
    context_parts = []
    citations_meta = []
    for i, (doc, meta) in enumerate(zip(evidence["documents"], evidence["metadatas"])):
        source = meta.get("source", "unknown")
        page = meta.get("page", "unknown")
        context_parts.append(f"[{i+1}] {doc}\nSource: {source}, page {page}")
        citations_meta.append({"document": source, "page": page, "index": i+1})
    
    context = "\n\n".join(context_parts)
    
    # Step 3: LLM prompt with strict citation requirement
    prompt = f"""
You are an equity research Q&A assistant. Answer the user's question using ONLY the provided context.
For every factual statement, cite the source using its index number like [1] or [2] at the end of the sentence.
If the context does NOT contain the answer, say exactly: "I cannot verify that claim from available sources."

Question: {question}
Company: {company if company else "any"}

Context:
{context}

Answer:
"""
    
    # Step 4: Call LLM (Gemini or Grok)
    # if QA_MODEL == "gemini":
    #     model = genai.GenerativeModel("gemini-2.5-flash")
    #     response = model.generate_content(prompt)
    #     answer = response.text
    # else:
    from agents.grok_client import call_grok
    answer = call_grok([{"role": "user", "content": prompt}])
    
    # Step 5: Extract citations used in answer (optional: parse indices)
    # For simplicity, return all retrieved citations
    citations = []
    for meta in citations_meta:
        citations.append({
            "document": meta["document"],
            "page": meta["page"]
        })
    
    return answer, citations