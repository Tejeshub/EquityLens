"""Data-source policy: which third-party sources may be shown to users in this deployment, and why not when disabled."""
from typing import Dict

from fastapi import HTTPException

from core.settings import get_settings

REASONS: Dict[str, str] = {
    "screener": "Reported financials and shareholding are not available in this deployment: the only integrated source (Screener.in) "
                "does not permit public display of its data. A licensed source is required.",
    "yahoo": "Market prices are not available in this deployment: the integrated price source (Yahoo Finance, unofficial) does not "
             "permit public display or automated collection. A licensed source is required.",
    "news": "News is not available in this deployment: the news provider (Exa) has not confirmed that its results may be displayed to end "
            "users. Written permission is required.",
    "nse_index": "Sector and market-cap segment labels (derived from NSE index membership lists) are not shown in this deployment "
                 "pending confirmation of NSE's terms.",
}


def enabled(name: str) -> bool:
    return get_settings().source_enabled(name)


def require(name: str) -> None:
    """Raise HTTP 503 {code: source_disabled} when a restricted source is switched off for this deployment."""
    if not enabled(name):
        raise HTTPException(status_code=503, detail={"code": "source_disabled", "message": REASONS[name]})


NO_SOURCES = ("No data source is enabled in this deployment, so there is nothing to base this on. Sources are switched off until their "
              "public-display rights are confirmed (see the data-source notices).")


def require_any(*names: str) -> None:
    """AI features need at least one evidence source; with none enabled they refuse instead of producing an empty or invented result."""
    if not any(enabled(n) for n in names):
        raise HTTPException(status_code=503, detail={"code": "source_disabled", "message": NO_SOURCES})


def market_data_enabled() -> bool:
    return enabled("yahoo")


def capabilities() -> dict:
    s = get_settings()
    def src(name: str, label: str, **extra):
        on = enabled(name)
        return {"enabled": on, "reason": None if on else REASONS[name], **extra}
    any_evidence = enabled("screener") or enabled("news")
    gemini_ok = s.copilot_provider == "gemini" and (s.gemini_billing_enabled or s.profile == "personal")
    return {
        "profile": s.profile,
        "market_data": src("yahoo", "Market prices", provider="Yahoo Finance (unofficial, delayed)", delayed=True),
        "fundamentals": src("screener", "Reported financials", provider="Screener.in"),
        "index_segments": src("nse_index", "Sector / cap segment", provider="NSE index lists"),
        "news": {"enabled": enabled("news"), "reason": None if enabled("news") else REASONS["news"],
                 "excerpts_displayed": enabled("news_excerpts"), "provider": "Exa web search"},
        "ai": {"research": any_evidence, "reason": None if any_evidence else NO_SOURCES,
               "copilot_provider": "gemini" if gemini_ok else "groq",
               "note": "AI output is generated from the listed sources, may contain errors and is not investment advice."},
    }
