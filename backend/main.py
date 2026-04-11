from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import AskRequest, AskResponse, AskCitation, RetrievedChunk, EquityResearchRequest, EquityResearchResponse
from agents.ingestion_agent import run_ingestion
from agents.guidance_tracker import track_guidance
from agents.fundamental_debater import fundamental_debate
from agents.sentiment_debater import sentiment_debate
from agents.alt_debater import alt_debate
from agents.coordinator import debate_coordinator
from agents.comparator import compare_companies
from agents.qa_agent import answer_with_citations
from rag import answer_with_rag
from scraper import ScreenerScraper
from earnings_scraper import EarningsScraper
from storage.structured_store import engine as db_engine
from storage.semantic_store import client as chroma_client
import asyncio

app = FastAPI(title="Equity Research AI Agent", description="Multi-agent debate system for Indian equities")
app.add_middleware(CORSMiddleware, allow_origins=["*"])

def scrape_screener_data(company_name: str, ticker: str = None):
    """
    Scrape Screener.in for structured financial data.
    
    Args:
        company_name: Full company name (for logging)
        ticker: Company ticker (for Screener lookup). If None, uses company_name
    
    Returns:
        {ok: bool, inserted_metrics: int, embedded_chunks: int, error: str}
    """
    print(f"scrape_screener_data: start for {company_name} (ticker={ticker})")
    try:
        # Use ticker if provided, otherwise try company_name as fallback
        lookup_ticker = ticker if ticker else company_name
        
        # Initialize scraper with DB clients for direct insertion
        scraper = ScreenerScraper(lookup_ticker, db_engine=db_engine, chroma_client=chroma_client)
        result = scraper.scrape_all()
        
        # Count inserted metrics and chunks
        total_inserted = 0
        total_chunks = 0
        
        for table_name, insert_result in result.get("db_insertion_results", {}).items():
            db_result = insert_result.get("db_result", {})
            chroma_result = insert_result.get("chroma_result", {})
            
            if "inserted" in db_result:
                total_inserted += db_result["inserted"]
            if "count" in chroma_result:
                total_chunks += chroma_result["count"]
        
        print(f"scrape_screener_data: end - inserted {total_inserted} metrics, {total_chunks} chunks")
        return {
            "ok": True,
            "inserted_metrics": total_inserted,
            "embedded_chunks": total_chunks,
            "error": None
        }
    except Exception as e:
        print(f"scrape_screener_data: ERROR - {type(e).__name__}: {str(e)}")
        # Non-fatal error - return info but don't block pipeline
        return {
            "ok": False,
            "inserted_metrics": 0,
            "embedded_chunks": 0,
            "error": str(e)
        }


def scrape_earnings_for_ticker(company_name: str, ticker: str = None, year: int = None):
    """
    Scrape earnings call transcripts for all quarters.
    
    Args:
        company_name: Full company name (for metadata)
        ticker: Company ticker (for API lookup). If None, uses company_name
        year: Year for earnings calls (defaults to current year from config)
    
    Returns:
        {ok: bool, embedded_chunks: int, quarters: list, error: str}
    """
    print(f"scrape_earnings_for_ticker: start for {company_name} (ticker={ticker}, year={year})")
    try:
        # Use ticker if provided, otherwise try company_name as fallback
        lookup_ticker = ticker if ticker else company_name
        
        # Initialize earnings scraper with ChromaDB client
        scraper = EarningsScraper(lookup_ticker, year=year, chroma_client=chroma_client)
        result = scraper.scrape_all_quarters(company_name)
        
        print(f"scrape_earnings_for_ticker: end - embedded {result.get('embedded_chunks', 0)} chunks, quarters {result.get('quarters_available', [])}")
        return {
            "ok": result.get("ok", False),
            "embedded_chunks": result.get("embedded_chunks", 0),
            "quarters": result.get("quarters_available", []),
            "error": result.get("error", None)
        }
    except Exception as e:
        print(f"scrape_earnings_for_ticker: ERROR - {type(e).__name__}: {str(e)}")
        # Non-fatal error - return info but don't block pipeline
        return {
            "ok": False,
            "embedded_chunks": 0,
            "quarters": [],
            "error": str(e)
        }


@app.post("/analyze", response_model=EquityResearchResponse)
async def analyze(request: EquityResearchRequest):
    print("analyze: start")
    scorecards = []
    guidance_entries = []
    try:
        for company in request.companies:
            # 0. Scrape Screener.in for structured financial data (direct DB + ChromaDB insertion)
            print(f"analyze: scraping Screener for {company.name}")
            screener_result = scrape_screener_data(company.name, ticker=company.screener_id)
            if screener_result["ok"]:
                print(f"✅ Screener: inserted {screener_result['inserted_metrics']} metrics, {screener_result['embedded_chunks']} chunks")
            else:
                print(f"⚠️ Screener scrape warning: {screener_result['error']}")
            
            # 0.5. Scrape earnings call transcripts (optional, non-blocking)
            print(f"analyze: scraping earnings calls for {company.name}")
            earnings_result = scrape_earnings_for_ticker(company.name, ticker=company.screener_id)
            if earnings_result["ok"]:
                print(f"✅ Earnings: embedded {earnings_result['embedded_chunks']} chunks, quarters {earnings_result['quarters']}")
            else:
                print(f"⚠️ Earnings scrape warning: {earnings_result['error']}")
            
            # 1. Ingest PDFs from IR page (skip if no IR url)
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
            print("analyze: running debaters in parallel")
            fund_out, sent_out, alt_out = await asyncio.gather(
                loop.run_in_executor(None, fundamental_debate, company.name),
                loop.run_in_executor(None, sentiment_debate, company.name),
                loop.run_in_executor(None, alt_debate, company.name)
            )
            print("analyze: debaters completed")

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

@app.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest):
    print("ask: start")
    try:
        try:
            rag_result = answer_with_rag(
                question=request.question,
                company=request.company,
                top_k=request.top_k,
            )

            if rag_result.retrieval_count == 0:
                raise RuntimeError("No retrieval results from RAG pipeline")

            return AskResponse(
                answer=rag_result.answer,
                citations=[AskCitation(**c.model_dump()) for c in rag_result.citations],
                retrieved_chunks=[RetrievedChunk(**c.model_dump()) for c in rag_result.retrieved_chunks],
                retrieval_count=rag_result.retrieval_count,
                fallback_used=False,
                error=None,
            )
        except Exception as rag_err:
            print(f"ask: RAG failed, using fallback - {type(rag_err).__name__}: {str(rag_err)}")
            answer, citations = answer_with_citations(request.question, request.company)
            mapped_citations = [
                AskCitation(
                    document=str(c.get("document", "unknown")),
                    page=c.get("page"),
                    excerpt="",
                    source=str(c.get("document", "unknown")),
                    table_type=None,
                    index=None,
                )
                for c in citations
            ]
            return AskResponse(
                answer=answer,
                citations=mapped_citations,
                retrieved_chunks=[],
                retrieval_count=0,
                fallback_used=True,
                error=str(rag_err),
            )
    finally:
        print("ask: end")

@app.get("/health")
def health():
    print("health: start")
    print("health: end")
    return {"status": "ok"}