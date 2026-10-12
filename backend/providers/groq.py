"""Groq chat-completions client (OpenAI-compatible). Observed free-tier headers (2026-10-12, not documentation):
~1000 requests/day, ~8000 tokens/minute -> prompts are kept compact and calls are sequential."""
import json
import os
from typing import Callable, Optional, Type, TypeVar

from pydantic import BaseModel, ValidationError

from core import ratelimit
from core.db import get_budget_session
from core.settings import get_settings
from providers.base import ProviderClient, ProviderError

T = TypeVar("T", bound=BaseModel)
DEFAULT_MODEL = "openai/gpt-oss-20b"  # llama-3.1-8b-instant (the old hard-coded default) no longer exists on Groq


def model_name() -> str:
    return os.getenv("GROQ_MODEL", DEFAULT_MODEL)


def _budget() -> bool:
    db = get_budget_session()
    try:
        return ratelimit.hit(db, "provider:groq", get_settings().groq_requests_per_day, 86400)[0]
    finally:
        db.close()


def make_client(api_key: Optional[str], transport=None, budget: Optional[Callable[[], bool]] = _budget) -> ProviderClient:
    return ProviderClient(name="groq", base_url="https://api.groq.com/openai/v1", timeout=60.0, max_retries=2, max_retry_after=20.0,
                          headers={"Authorization": f"Bearer {api_key or ''}", "Content-Type": "application/json"}, budget=budget, transport=transport)


_client: Optional[ProviderClient] = None



def _fixture_client():
    """PROVIDER_MODE=fixture (tests/E2E only; refused in production): offline deterministic stand-in, no budget/DB use."""
    from core.settings import get_settings
    if get_settings().provider_mode != "fixture":
        return None
    from providers import fixtures
    return make_client("fixture-key", transport=fixtures.transport("groq"), budget=None)


def client() -> ProviderClient:
    global _client
    if _client is None:
        from config import GROK_API_KEY  # legacy env name; the key is a Groq key
        _client = _fixture_client() or make_client(GROK_API_KEY)
    return _client


def chat_json(system: str, user: str, schema: Type[T], *, max_tokens: int = 1200) -> T:
    """One structured call. Output is validated against `schema`; a single repair attempt on invalid JSON.
    Raises ProviderError(kind='bad_payload') if the model never produces valid output - never fabricates a result."""
    if client().headers.get("Authorization", "").endswith("Bearer "):
        raise ProviderError("groq", "unavailable", "GROK_API_KEY not configured")
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    last_err = ""
    for attempt in range(2):
        resp = client().request("POST", "/chat/completions", retry=True, json={
            "model": model_name(), "messages": messages, "temperature": 0.1, "max_tokens": max_tokens,
            "response_format": {"type": "json_object"}, "reasoning_effort": "low"})
        try:
            content = resp.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            raise ProviderError("groq", "bad_payload", "unexpected response envelope")
        if not content or not content.strip():
            last_err = "empty completion"
        else:
            try:
                return schema.model_validate(json.loads(content))
            except (ValueError, ValidationError) as e:
                last_err = type(e).__name__
        messages = messages + [{"role": "assistant", "content": content or ""},
                               {"role": "user", "content": "Your previous reply was not valid for the required JSON schema. Reply again with ONLY the corrected JSON object."}]
    raise ProviderError("groq", "bad_payload", f"model output failed validation ({last_err})")
