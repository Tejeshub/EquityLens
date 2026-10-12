"""Screener.in HTML fetch (public company pages). Terms caveat in docs/PROVIDERS.md: Screener's terms grant
personal, non-commercial viewing only. Polite global rate limit, identifiable UA, no auth/anti-bot bypass."""
from typing import Callable, Optional

from core import ratelimit
from core.db import get_budget_session
from providers.base import ProviderClient

_client: Optional[ProviderClient] = None


def _budget() -> bool:
    db = get_budget_session()
    try:
        return ratelimit.hit(db, "provider:screener", 6, 60)[0]
    finally:
        db.close()


def make_client(transport=None, budget: Optional[Callable[[], bool]] = _budget) -> ProviderClient:
    return ProviderClient(name="screener", base_url="https://www.screener.in", timeout=20.0, max_retries=1,
                          headers={"User-Agent": "Mozilla/5.0 (compatible; EquityLens/1.0)"}, budget=budget, transport=transport)



def _fixture_client():
    """PROVIDER_MODE=fixture (tests/E2E only; refused in production): offline deterministic stand-in, no budget/DB use."""
    from core.settings import get_settings
    if get_settings().provider_mode != "fixture":
        return None
    from providers import fixtures
    return make_client(transport=fixtures.transport("screener"), budget=None)


def client() -> ProviderClient:
    global _client
    if _client is None:
        _client = _fixture_client() or make_client()
    return _client


def fetch_company_page(symbol: str) -> tuple[str, str]:
    """Returns (html, basis). Tries consolidated first, falls back to standalone when the company has none."""
    from providers.base import ProviderError
    try:
        r = client().request("GET", f"/company/{symbol}/consolidated/")
        return r.text, "consolidated"
    except ProviderError as e:
        if e.kind != "not_found":
            raise
    r = client().request("GET", f"/company/{symbol}/")
    return r.text, "standalone"
