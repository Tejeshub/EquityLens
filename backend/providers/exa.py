"""Exa search client for company news. Costs money per request beyond free credits -> hard daily budget + long cache."""
import logging
from typing import Callable, List, Optional

from core import ratelimit
from core.db import get_budget_session
from core.settings import get_settings
from providers.base import ProviderClient, ProviderError, TTLCache

log = logging.getLogger("equitylens.exa")
cache = TTLCache(max_entries=500)
NEWS_TTL = 6 * 3600.0
STALE_OK = 48 * 3600.0


def _budget() -> bool:
    db = get_budget_session()
    try:
        allowed, _, _ = ratelimit.hit(db, "provider:exa", get_settings().exa_requests_per_day, 86400)
        return allowed
    finally:
        db.close()


def make_client(api_key: Optional[str], transport=None, budget: Optional[Callable[[], bool]] = _budget) -> ProviderClient:
    return ProviderClient(name="exa", base_url="https://api.exa.ai", timeout=20.0, max_retries=1,
                          headers={"x-api-key": api_key or "", "Content-Type": "application/json"}, budget=budget, transport=transport)


_client: Optional[ProviderClient] = None



def _fixture_client():
    """PROVIDER_MODE=fixture (tests/E2E only; refused in production): offline deterministic stand-in, no budget/DB use."""
    from core.settings import get_settings
    if get_settings().provider_mode != "fixture":
        return None
    from providers import fixtures
    return make_client("fixture-key", transport=fixtures.transport("exa"), budget=None)


def client() -> ProviderClient:
    global _client
    if _client is None:
        from config import EXA_API_KEY
        _client = _fixture_client() or make_client(EXA_API_KEY)
    return _client


def search_news(query: str, num_results: int = 15, include_text: bool = False) -> List[dict]:
    """include_text=False (the public-profile default) requests headlines/URLs only: no article text is fetched or stored."""
    if not client().headers.get("x-api-key"):
        raise ProviderError("exa", "unavailable", "EXA_API_KEY not configured")
    body = {"query": query, "numResults": num_results, "category": "news"}
    if include_text:
        body["contents"] = {"text": {"maxCharacters": 400}}
    resp = client().request("POST", "/search", retry=False, json=body)
    try:
        results = resp.json().get("results")
    except ValueError:
        raise ProviderError("exa", "bad_payload")
    if not isinstance(results, list):
        raise ProviderError("exa", "bad_payload")
    return results
