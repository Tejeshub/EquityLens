import os
from dotenv import load_dotenv

load_dotenv()

GROK_API_KEY = os.getenv("GROK_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
EXA_API_KEY = os.getenv("EXA_API_KEY")
LLAMA_CLOUD_API_KEY = os.getenv("LLAMA_CLOUD_API_KEY")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
POSTGRES_URL = os.getenv("POSTGRES_URL")
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")

DEBATER_MODEL = os.getenv("DEBATER_MODEL", "grok")
COORDINATOR_MODEL = os.getenv("COORDINATOR_MODEL", "grok")
QA_MODEL = os.getenv("QA_MODEL", "gemini")

# Earnings Call API Configuration
EARNINGS_API_USER = os.getenv("EARNINGS_API_USER", "user")
EARNINGS_API_PASS = os.getenv("EARNINGS_API_PASS", "pass")
EARNINGS_API_BASE_URL = os.getenv("EARNINGS_API_BASE_URL", "https://discountingcashflows.com/api/transcript")
EARNINGS_CURRENT_YEAR = int(os.getenv("EARNINGS_CURRENT_YEAR", "2024"))

USER_AGENT = "Mozilla/5.0 (EquityResearchAgent/1.0)"