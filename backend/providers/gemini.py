"""Gemini generateContent client (used for Copilot answers; spreads load off Groq's tight token limits)."""
import json
import os
from typing import Callable, Optional, Type, TypeVar

from pydantic import BaseModel, ValidationError

from core import ratelimit
from core.db import get_budget_session
from providers.base import ProviderClient, ProviderError

T = TypeVar("T", bound=BaseModel)
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
DAILY_BUDGET = int(os.getenv("GEMINI_REQUESTS_PER_DAY", "200"))  # conservative; real quota unverified


def _budget() -> bool:
    db = get_budget_session()
    try:
        return ratelimit.hit(db, "provider:gemini", DAILY_BUDGET, 86400)[0]
    finally:
        db.close()


def make_client(api_key: Optional[str], transport=None, budget: Optional[Callable[[], bool]] = _budget) -> ProviderClient:
    return ProviderClient(name="gemini", base_url="https://generativelanguage.googleapis.com", timeout=45.0, max_retries=1, max_retry_after=20.0,
                          headers={"x-goog-api-key": api_key or "", "Content-Type": "application/json"}, budget=budget, transport=transport)


_client: Optional[ProviderClient] = None



def _fixture_client():
    """PROVIDER_MODE=fixture (tests/E2E only; refused in production): offline deterministic stand-in, no budget/DB use."""
    from core.settings import get_settings
    if get_settings().provider_mode != "fixture":
        return None
    from providers import fixtures
    return make_client("fixture-key", transport=fixtures.transport("gemini"), budget=None)


def client() -> ProviderClient:
    global _client
    if _client is None:
        from config import GEMINI_API_KEY
        _client = _fixture_client() or make_client(GEMINI_API_KEY)
    return _client


def chat_json(system: str, user: str, schema: Type[T], *, max_tokens: int = 1500) -> T:
    if not client().headers.get("x-goog-api-key"):
        raise ProviderError("gemini", "unavailable", "GEMINI_API_KEY not configured")
    body = {"systemInstruction": {"parts": [{"text": system}]}, "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": max_tokens, "responseMimeType": "application/json",
                                 "thinkingConfig": {"thinkingBudget": 0}}}
    last = ""
    for _ in range(2):
        resp = client().request("POST", f"/v1beta/models/{MODEL}:generateContent", retry=True, json=body)
        try:
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        except (ValueError, KeyError, IndexError, TypeError):
            raise ProviderError("gemini", "bad_payload", "unexpected response envelope")
        try:
            return schema.model_validate(json.loads(text))
        except (ValueError, ValidationError) as e:
            last = type(e).__name__
            body["contents"].append({"role": "model", "parts": [{"text": text}]})
            body["contents"].append({"role": "user", "parts": [{"text": "Invalid. Reply with ONLY the corrected JSON object."}]})
    raise ProviderError("gemini", "bad_payload", f"model output failed validation ({last})")
