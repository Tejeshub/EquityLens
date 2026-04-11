#!/usr/bin/env python3

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from datetime import datetime, timedelta
from textwrap import dedent
import os

from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools.exa import ExaTools
from agno.tools.firecrawl import FirecrawlTools

import uvicorn

load_dotenv()

agent = None

def calculate_start_date(days: int):
    return (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global agent
    try:
        agent = Agent(
            model=Gemini(id="gemini-2.0-flash"),
            tools=[
                ExaTools(start_published_date=calculate_start_date(30), type="keyword"),
                FirecrawlTools(),
            ],
            description="Equity Research AI Agent – Indian small/mid-cap fundamental analysis",
            instructions=dedent("""
                You are an equity research analyst covering Indian small and mid-cap companies.
                Your role is to provide evidence-backed, source-cited investment analysis.
                
                **Critical rules:**
                1. Every numerical claim must be traceable to a specific source document (PDF, transcript, filing) with page number or timestamp.
                2. If you cannot verify a fact from the provided tools or context, respond: "I cannot verify that claim from available sources."
                3. Never hallucinate financial data, guidance, or market comparisons.
                4. Structure your analysis across four dimensions: industry position, financial quality, management credibility, and risk identification.
                5. When comparing companies, always rank and differentiate using at least three peer metrics.
                6. Track management guidance vs. actual delivery across quarters – highlight deviations.
                7. Output confidence levels (Low/Medium/High) based on source recency and reliability.
                
                Use ExaTools to find latest filings, transcripts, and news. Use FirecrawlTools to extract structured data from IR pages and BSE/NSE filings.
                Always cite your sources inline like: [Source: Sun Pharma Annual Report FY24, page 42].
            """),
        )
    except Exception:
        agent = None
    yield
    agent = None

app = FastAPI(
    title="Equity Research AI Agent API",
    description="AI-powered equity research for Indian small/mid-cap companies – source-cited, verifiable analysis",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Equity Research AI Agent is running – every answer cites its source"}

if __name__ == "__main__":
    required_vars = ["GEMINI_API_KEY"]
    missing = [v for v in required_vars if not os.getenv(v)]

    if missing:
        print(f"Missing env vars: {', '.join(missing)}")
        exit(1)

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)