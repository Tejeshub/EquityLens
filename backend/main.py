from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import EquityResearchRequest, EquityResearchResponse
from agents.ingestion_agent import run_ingestion
from agents.guidance_tracker import track_guidance
from agents.fundamental_debater import fundamental_debate
from agents.sentiment_debater import sentiment_debate
from agents.alt_debater import alt_debate
from agents.coordinator import debate_coordinator
from agents.comparator import compare_companies
from agents.qa_agent import answer_with_citations
import asyncio

app = FastAPI(title="Equity Research AI Agent", description="Multi-agent debate system for Indian equities")
app.add_middleware(CORSMiddleware, allow_origins=["*"])

@app.post("/analyze", response_model=EquityResearchResponse)
async def analyze(request: EquityResearchRequest):
    print("analyze: start")
    scorecards = []
    guidance_entries = []
    try:
        for company in request.companies:
            # 1. Ingest (skip if no IR url)
            if company.ir_page_url:
                ingest_result = run_ingestion(company.name, company.ir_page_url)
            else:
                ingest_result = {"ok": True, "note": "No IR page provided, using pre-loaded data"}

            # 2. Guidance tracking (needs transcript chunks – simplified with empty list for demo)
            transcript_chunks = []  # In production, fetch from ChromaDB
            guidance = track_guidance(company.name, transcript_chunks)
            guidance_entries.extend(guidance)

            # 3. Run three debaters in parallel (in thread pool since they're sync functions)
            loop = asyncio.get_event_loop()
            print(f"analyze: running debaters in parallel")
            fund_out, sent_out, alt_out = await asyncio.gather(
                loop.run_in_executor(None, fundamental_debate, company.name),
                loop.run_in_executor(None, sentiment_debate, company.name),
                loop.run_in_executor(None, alt_debate, company.name)
            )
            print(f"analyze: debaters completed")

            # 4. Coordinator produces final scorecard
            final = debate_coordinator(company.name, fund_out, sent_out, alt_out, request.debate_refinement_threshold)
            scorecards.append(final)

        # 5. Cross-company comparison (using revenue as example)
        company_names = [c.name for c in request.companies]
        comparisons = [compare_companies(company_names, "revenue")]

        return EquityResearchResponse(
            scorecards=scorecards,
            guidance_tracker=guidance_entries,
            peer_comparisons=comparisons,
            execution_status="success"
        )
    finally:
        print("analyze: end")

@app.post("/ask")
async def ask(question: str, company: str = None):
    print("ask: start")
    try:
        answer, citations = answer_with_citations(question, company)
        return {"answer": answer, "citations": citations}
    finally:
        print("ask: end")

@app.get("/health")
def health():
    print("health: start")
    print("health: end")
    return {"status": "ok"}