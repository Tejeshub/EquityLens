from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import (
    AskRequest, AskResponse, AskCitation, RetrievedChunk, 
    EquityResearchRequest, EquityResearchResponse, Scorecard, 
    ScoreDimension, AgentMessage, PeerComparison, GuidanceEntry
)
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
from transcript_scraper import TranscriptScraper
from storage.structured_store import engine as db_engine
from storage.semantic_store import client as chroma_client
import asyncio
from datetime import datetime, timezone

app = FastAPI(title="Equity Research AI Agent", description="Multi-agent debate system for Indian equities")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Helper Functions
# ============================================================================

def transform_coordinator_output_to_scorecard(company_name: str, coordinator_output: dict, agent_names: list) -> dict:
    """
    Transform coordinator output to match frontend expectations (Scorecard model).
    
    Maps:
    - coordinator output fields → frontend Scorecard fields
    - agent analysis → dimensions with evidence and reasoning
    - confidence scores → 0-100 scale
    
    Args:
        company_name: Company name
        coordinator_output: Output from debate_coordinator function
        agent_names: List of agent names that participated
    
    Returns:
        Dictionary matching Scorecard model
    """
    try:
        print(f"transform_coordinator_output_to_scorecard: start for {company_name}")
        
        # Calculate overall score (0-100) from dimensions
        dimensions = coordinator_output.get("dimensions", [])
        dimension_scores = []
        
        # Extract scores from coordinator dimensions
        for d in dimensions:
            if isinstance(d, dict):
                score = d.get("score", 50)
                if isinstance(score, (int, float)):
                    dimension_scores.append(float(score))
        
        overall_score = sum(dimension_scores) / len(dimension_scores) if dimension_scores else 50.0
        
        # Calculate confidence (0-100)
        confidence_score = coordinator_output.get("coordinator_confidence", 0.5)
        if isinstance(confidence_score, (int, float)):
            if confidence_score <= 1:
                confidence_score = confidence_score * 100
            confidence_score = float(confidence_score)
        else:
            confidence_score = 50.0
        
        # Ensure confidence_score is 0-100
        confidence_score = max(0, min(100, confidence_score))
        
        # Transform dimensions to match frontend structure
        transformed_dimensions = []
        dimension_name_mapping = {
            "industry_position": "Industry Position",
            "valuation_outlook": "Valuation Outlook",
            "risk_assessment": "Risk Assessment"
        }
        
        for idx, dim in enumerate(dimensions):
            if isinstance(dim, dict):
                dim_name = dim.get("dimension", f"Analysis Dimension {idx + 1}")
                dim_name_readable = dimension_name_mapping.get(dim_name, dim_name)
                
                # Get score and confidence
                score = float(dim.get("score", 50))
                conf_value = dim.get("confidence", 0.5)
                
                # Normalize confidence to 0-1 scale
                if isinstance(conf_value, (int, float)):
                    if conf_value > 1:
                        conf_value = conf_value / 100
                    confidence = float(conf_value)
                else:
                    confidence = 0.5
                
                # Get evidence and source
                evidence = str(dim.get("reasoning", "Multi-perspective analysis"))[:200]
                source = dim.get("source", "Analysis")
                
                # Build reasoning messages from ALL research points
                reasoning_messages = []
                
                # Extract research_data if available (from updated coordinator)
                research_data = dim.get("research_data", {})
                if research_data and isinstance(research_data, dict):
                    debater_name = research_data.get("debater", "Unknown Debater")
                    position = research_data.get("position", "")
                    reasoning_text = research_data.get("reasoning", "")
                    research_points = research_data.get("research_points", [])
                    
                    # Add position as first message
                    if position:
                        reasoning_messages.append({
                            "agent": debater_name,
                            "message": f"Position: {position}",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "type": "position"
                        })
                    
                    # Add reasoning as second message
                    if reasoning_text:
                        reasoning_messages.append({
                            "agent": debater_name,
                            "message": str(reasoning_text)[:500],
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "type": "reasoning"
                        })
                    
                    # Add ALL research points (evidence, signals, source_lineage)
                    for point in research_points:
                        if isinstance(point, dict):
                            point_type = point.get("type", "analysis")
                            point_content = point.get("content", "")
                            point_index = point.get("index", "")
                            
                            message_text = point_content
                            if point_index:
                                message_text = f"[{point.get('type', 'Point')} #{point_index}] {point_content}"
                            
                            # Don't truncate source_lineage messages (they contain JSON)
                            msg_length = 500 if point_type != "source_lineage" else 5000
                            
                            reasoning_messages.append({
                                "agent": debater_name,
                                "message": str(message_text)[:msg_length],
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "type": point_type
                            })
                else:
                    # Fallback to old behavior if research_data not available
                    if evidence and source:
                        reasoning_messages.append({
                            "agent": str(source),
                            "message": evidence,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "type": "analysis"
                        })
                
                # Create dimension
                transformed_dim = {
                    "dimension": dim_name_readable,
                    "score": score,
                    "max_score": 100.0,
                    "confidence": confidence,
                    "evidence": evidence,
                    "source": str(source),
                    "reasoning": reasoning_messages
                }
                transformed_dimensions.append(ScoreDimension(**transformed_dim))
        
        # Build timestamp
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create scorecard
        scorecard_data = {
            "company_name": company_name,
            "dimensions": transformed_dimensions,
            "overall_score": overall_score,
            "confidence_score": confidence_score,
            "timestamp": timestamp,
            "agents_participated": agent_names
        }
        
        print(f"transform_coordinator_output_to_scorecard: end - created scorecard with {len(transformed_dimensions)} dimensions")
        return scorecard_data
        
    except Exception as e:
        print(f"transform_coordinator_output_to_scorecard: ERROR - {type(e).__name__}: {str(e)}")
        # Return valid scorecard with minimal data on error
        return {
            "company_name": company_name,
            "dimensions": [],
            "overall_score": 50.0,
            "confidence_score": 50.0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agents_participated": agent_names
        }


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


def scrape_transcripts_for_ticker(company_name: str, ticker: str = None):
    """
    Scrape documents and transcripts from Screener.in documents section.
    
    Args:
        company_name: Full company name (for metadata)
        ticker: Company ticker (for Screener lookup). If None, uses company_name
    
    Returns:
        {ok: bool, documents_found: int, embedded_chunks: int, doc_types: list, error: str}
    """
    print(f"scrape_transcripts_for_ticker: start for {company_name} (ticker={ticker})")
    try:
        # Use ticker if provided, otherwise try company_name as fallback
        lookup_ticker = ticker if ticker else company_name
        
        # Initialize transcript scraper with ChromaDB client
        scraper = TranscriptScraper(lookup_ticker, chroma_client=chroma_client)
        result = scraper.scrape_documents(company_name)
        
        print(f"scrape_transcripts_for_ticker: end - found {result.get('documents_found', 0)} documents, embedded {result.get('embedded_chunks', 0)} chunks, types {result.get('doc_types', [])}")
        return result
    except Exception as e:
        print(f"scrape_transcripts_for_ticker: ERROR - {type(e).__name__}: {str(e)}")
        # Non-fatal error - return info but don't block pipeline
        return {
            "ok": False,
            "documents_found": 0,
            "embedded_chunks": 0,
            "doc_types": [],
            "error": str(e)
        }


@app.post("/analyze", response_model=EquityResearchResponse)
async def analyze(request: EquityResearchRequest):
    print("analyze: start")
    scorecards = []
    guidance_entries = []
    peer_comparisons = []
    agent_names = ["Fundamental Debater", "Sentiment Debater", "Alternative Debater"]
    
    try:
        for company in request.companies:
            # 0. Scrape Screener.in for structured financial data (direct DB + ChromaDB insertion)
            print(f"analyze: scraping Screener for {company.name}")
            screener_result = scrape_screener_data(company.name, ticker=company.screener_id)
            if screener_result["ok"]:
                print(f"✅ Screener: inserted {screener_result['inserted_metrics']} metrics, {screener_result['embedded_chunks']} chunks")
            else:
                print(f"⚠️ Screener scrape warning: {screener_result['error']}")
            
            # 0.5. Scrape documents and transcripts from Screener (optional, non-blocking)
            print(f"analyze: scraping documents for {company.name}")
            transcripts_result = scrape_transcripts_for_ticker(company.name, ticker=company.screener_id)
            if transcripts_result["ok"]:
                print(f"✅ Documents: found {transcripts_result['documents_found']} documents, embedded {transcripts_result['embedded_chunks']} chunks, types {transcripts_result['doc_types']}")
            else:
                print(f"⚠️ Document scrape warning: {transcripts_result['error']}")
            
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

            # 4. Coordinator produces final analysis
            coordinator_output = debate_coordinator(
                company.name, 
                fund_out, 
                sent_out, 
                alt_out, 
                request.debate_refinement_threshold
            )
            print(f"analyze: coordinator produced output for {company.name}")
            
            # 5. Transform coordinator output to frontend-compatible Scorecard
            scorecard_data = transform_coordinator_output_to_scorecard(
                company.name,
                coordinator_output,
                agent_names
            )
            scorecard = Scorecard(**scorecard_data)
            scorecards.append(scorecard)

        # 6. Cross-company comparison (if multiple companies)
        company_names = [c.name for c in request.companies]
        if len(company_names) > 1:
            comparison = compare_companies(company_names, "revenue")
            if comparison and isinstance(comparison, dict):
                # Ensure comparison matches PeerComparison structure
                peer_comp = PeerComparison(
                    metric=comparison.get("metric", "revenue"),
                    companies=comparison.get("companies", []),
                    benchmark=comparison.get("benchmark")
                )
                peer_comparisons.append(peer_comp)

        return EquityResearchResponse(
            scorecards=scorecards,
            guidance_tracker=guidance_entries,
            peer_comparisons=peer_comparisons,
            execution_status="success",
            error=None
        )
    except Exception as e:
        print(f"analyze: ERROR - {type(e).__name__}: {str(e)}")
        return EquityResearchResponse(
            scorecards=scorecards,
            guidance_tracker=guidance_entries,
            peer_comparisons=peer_comparisons,
            execution_status="partial",
            error=str(e)
        )
    finally:
        print("analyze: end")

@app.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest):
    print(f"ask: start (question='{request.question}', company='{request.company}', top_k={request.top_k})")
    try:
        try:
            # Try RAG pipeline first
            print("ask: attempting RAG pipeline")
            rag_result = answer_with_rag(
                question=request.question,
                company=request.company,
                top_k=request.top_k or 8,
            )

            if rag_result.retrieval_count == 0:
                raise RuntimeError("No retrieval results from RAG pipeline")

            print(f"ask: RAG success - answer length={len(rag_result.answer)}, citations={len(rag_result.citations)}")
            return AskResponse(
                answer=rag_result.answer,
                citations=[AskCitation(**c.model_dump()) for c in rag_result.citations],
                retrieved_chunks=[],
                retrieval_count=rag_result.retrieval_count,
                fallback_used=False,
                error=None,
            )
        except Exception as rag_err:
            print(f"ask: RAG failed ({type(rag_err).__name__}: {str(rag_err)}), using fallback")
            try:
                # Fallback to QA agent
                answer, citations = answer_with_citations(request.question, request.company)
                mapped_citations = [
                    AskCitation(
                        document=str(c.get("document", "unknown")),
                        page=c.get("page") if isinstance(c.get("page"), int) else None,
                        excerpt=c.get("excerpt", ""),
                        source=str(c.get("source", c.get("document", "unknown"))),
                        table_type=None,
                        index=None,
                    )
                    for c in (citations or [])
                ]
                print(f"ask: Fallback success - answer length={len(answer)}, citations={len(mapped_citations)}")
                return AskResponse(
                    answer=answer,
                    citations=mapped_citations,
                    retrieved_chunks=[],
                    retrieval_count=len(mapped_citations),
                    fallback_used=True,
                    error=str(rag_err),
                )
            except Exception as fallback_err:
                print(f"ask: Fallback also failed ({type(fallback_err).__name__}: {str(fallback_err)}), returning error response")
                # Both pipelines failed - return error response
                return AskResponse(
                    answer=f"Unable to answer your question: {str(fallback_err)}",
                    citations=[],
                    retrieved_chunks=[],
                    retrieval_count=0,
                    fallback_used=True,
                    error=f"RAG: {str(rag_err)} | Fallback: {str(fallback_err)}",
                )
    except Exception as e:
        print(f"ask: UNEXPECTED ERROR - {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return AskResponse(
            answer=f"An unexpected error occurred: {str(e)}",
            citations=[],
            retrieved_chunks=[],
            retrieval_count=0,
            fallback_used=False,
            error=str(e),
        )
    finally:
        print("ask: end")

@app.get("/health")
def health():
    print("health: start")
    print("health: end")
    return {"status": "ok"}