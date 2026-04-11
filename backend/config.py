import os
from dotenv import load_dotenv

load_dotenv()

GROK_API_KEY = os.getenv("GROK_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
EXA_API_KEY = os.getenv("EXA_API_KEY")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
POSTGRES_URL = os.getenv("POSTGRES_URL")
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")

DEBATER_MODEL = os.getenv("DEBATER_MODEL", "grok")
COORDINATOR_MODEL = os.getenv("COORDINATOR_MODEL", "grok")
QA_MODEL = os.getenv("QA_MODEL", "gemini")

USER_AGENT = "Mozilla/5.0 (EquityResearchAgent/1.0)"