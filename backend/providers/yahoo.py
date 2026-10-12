"""Yahoo Finance chart/spark endpoints (UNOFFICIAL, delayed). See docs/PROVIDERS.md for the terms caveat.

Everything returned is exactly what the provider supplied; nothing is synthesised. Rows with null OHLC
(holidays, halts, provider gaps) are dropped, never zero-filled.
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, List, Optional
from zoneinfo import ZoneInfo

from core.db import get_budget_session
from core import ratelimit
from core.settings import get_settings
from providers.base import ProviderClient, ProviderError, TTLCache

log = logging.getLogger("equitylens.yahoo")
IST = ZoneInfo("Asia/Kolkata")
BASE = "https://query1.finance.yahoo.com"
VALID_RANGES = {"1mo": "1d", "3mo": "1d", "6mo": "1d", "1y": "1d", "5y": "1wk"}
SPARK_BATCH = 20

cache = TTLCache()


@dataclass
class Bar:
    date: str  # exchange-local trading date (YYYY-MM-DD)
    open: float
    high: float
    low: float
    close: float
    volume: Optional[int]


@dataclass
class QuoteData:
    symbol: str
    price: float
    previous_close: Optional[float]
    as_of: datetime  # provider's regularMarketTime (UTC)
    currency: str
    week52_high: Optional[float]
    week52_low: Optional[float]
    volume: Optional[int]
    name: Optional[str]


def _budget() -> bool:
    s = get_settings()
    db = get_budget_session()
    try:
        allowed, _, _ = ratelimit.hit(db, "provider:yahoo", s.yahoo_requests_per_minute, 60)
        return allowed
    finally:
        db.close()


def make_client(transport=None, budget: Optional[Callable[[], bool]] = _budget) -> ProviderClient:
    return ProviderClient(
        name="yahoo", base_url=BASE, timeout=8.0, max_retries=1,
        headers={"User-Agent": "Mozilla/5.0 (compatible; EquityLens/1.0)"}, budget=budget, transport=transport,
    )


_client: Optional[ProviderClient] = None



def _fixture_client():
    """PROVIDER_MODE=fixture (tests/E2E only; refused in production): offline deterministic stand-in, no budget/DB use."""
    from core.settings import get_settings
    if get_settings().provider_mode != "fixture":
        return None
    from providers import fixtures
    return make_client(transport=fixtures.transport("yahoo"), budget=None)


def client() -> ProviderClient:
    global _client
    if _client is None:
        _client = _fixture_client() or make_client()
    return _client


def _local_date(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(IST).date().isoformat()


def parse_chart(payload: dict, symbol: str) -> tuple[dict, List[Bar]]:
    try:
        result = payload["chart"]["result"]
        if not result:
            raise ProviderError("yahoo", "not_found", symbol)
        r = result[0]
        meta = r["meta"]
        ts = r.get("timestamp") or []
        q = r["indicators"]["quote"][0]
    except (KeyError, IndexError, TypeError):
        raise ProviderError("yahoo", "bad_payload", symbol)
    bars: List[Bar] = []
    for i, t in enumerate(ts):
        try:
            o, h, l, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
        except (IndexError, KeyError):
            continue
        if None in (o, h, l, c):
            continue
        v = q.get("volume", [None] * len(ts))[i]
        bars.append(Bar(_local_date(t), float(o), float(h), float(l), float(c), int(v) if v is not None else None))
    return meta, bars


def _fetch_chart(symbol: str, rng: str, interval: str) -> tuple[dict, List[Bar]]:
    resp = client().request("GET", f"/v8/finance/chart/{symbol}", params={"range": rng, "interval": interval})
    try:
        payload = resp.json()
    except ValueError:
        raise ProviderError("yahoo", "bad_payload", symbol)
    return parse_chart(payload, symbol)


QUOTE_TTL = 120.0
HISTORY_TTL = 900.0
STALE_OK = 6 * 3600.0


def get_quote(symbol: str):
    def fetch() -> QuoteData:
        meta, bars = _fetch_chart(symbol, "5d", "1d")
        price, t = meta.get("regularMarketPrice"), meta.get("regularMarketTime")
        if price is None or t is None:
            raise ProviderError("yahoo", "bad_payload", symbol)
        as_of = datetime.fromtimestamp(t, tz=timezone.utc)
        today = _local_date(t)
        prior = [b for b in bars if b.date < today]
        return QuoteData(
            symbol=symbol, price=float(price), previous_close=prior[-1].close if prior else None, as_of=as_of,
            currency=meta.get("currency", "INR"), week52_high=meta.get("fiftyTwoWeekHigh"),
            week52_low=meta.get("fiftyTwoWeekLow"), volume=meta.get("regularMarketVolume"),
            name=meta.get("longName") or meta.get("shortName"),
        )
    return cache.get_or_fetch(f"quote:{symbol}", QUOTE_TTL, fetch, stale_ttl=STALE_OK)


def get_history(symbol: str, rng: str):
    if rng not in VALID_RANGES:
        raise ValueError(rng)
    def fetch() -> List[Bar]:
        _, bars = _fetch_chart(symbol, rng, VALID_RANGES[rng])
        return bars
    return cache.get_or_fetch(f"hist:{symbol}:{rng}", HISTORY_TTL, fetch, stale_ttl=STALE_OK)


def parse_spark(payload: dict) -> dict:
    out = {}
    for sym, d in (payload or {}).items():
        if not isinstance(d, dict):
            continue
        ts, closes = d.get("timestamp") or [], d.get("close") or []
        pairs = [(t, c) for t, c in zip(ts, closes) if t is not None and c is not None]
        if len(pairs) >= 2:
            out[sym] = [(_local_date(t), float(c)) for t, c in pairs]
    return out


def get_spark(symbols: List[str]):
    """Batch of daily closes per symbol. Cached per batch; returns {symbol: [(date, close), ...]}."""
    key = "spark:" + ",".join(sorted(symbols))
    def fetch() -> dict:
        resp = client().request("GET", "/v8/finance/spark", params={"symbols": ",".join(symbols), "range": "5d", "interval": "1d"})
        try:
            return parse_spark(resp.json())
        except ValueError:
            raise ProviderError("yahoo", "bad_payload", "spark")
    return cache.get_or_fetch(key, QUOTE_TTL * 2.5, fetch, stale_ttl=STALE_OK)
