"""Market data service: quote, history, movers. All outputs carry provenance (source, as_of, delayed, cached, stale)."""
from datetime import datetime, timezone
from typing import Dict, List, Optional

from providers import yahoo
from providers.base import ProviderError

SOURCE = "Yahoo Finance (unofficial, delayed)"
DELAY_NOTE = "Prices are delayed (typically ~15 minutes) and come from an unofficial source; not real-time."


def change(price: float, previous_close: Optional[float]) -> tuple[Optional[float], Optional[float]]:
    if previous_close is None or previous_close == 0:
        return None, None
    return price - previous_close, (price - previous_close) / previous_close * 100.0


def movers_from_spark(spark: Dict[str, list], names: Dict[str, str], *, top: int) -> dict:
    """Policy: only symbols with >=2 non-null daily closes whose latest bar date equals the most recent date
    seen in the batch are ranked. Others are excluded (counted), never zero-filled."""
    if not spark:
        return {"as_of_date": None, "gainers": [], "losers": [], "evaluated": 0, "excluded": 0}
    latest = max(v[-1][0] for v in spark.values())
    rows, excluded = [], 0
    for sym, series in spark.items():
        if series[-1][0] != latest:
            excluded += 1
            continue
        (_, prev), (_, last) = series[-2], series[-1]
        if prev == 0:
            excluded += 1
            continue
        rows.append({"symbol": sym, "name": names.get(sym, sym), "price": last, "previous_close": prev,
                     "change_percent": (last - prev) / prev * 100.0})
    rows.sort(key=lambda r: r["change_percent"], reverse=True)
    gainers = [r for r in rows if r["change_percent"] > 0][:top]
    losers = [r for r in reversed(rows) if r["change_percent"] < 0][:top]
    return {"as_of_date": latest, "gainers": gainers, "losers": losers, "evaluated": len(rows), "excluded": excluded}


def fetch_movers(universe: List[tuple], top: int = 5) -> dict:
    """universe: [(company_id, name, yahoo_symbol, nse_symbol)]. Bounded: caller caps the universe."""
    names = {y: n for _, n, y, _s in universe}
    ids = {y: str(cid) for cid, _, y, _s in universe}
    nse = {y: sym for _, _, y, sym in universe}
    spark: Dict[str, list] = {}
    cached_all, stale_any, fetched = True, False, []
    errors = 0
    syms = [y for _, _, y, _s in universe]
    for i in range(0, len(syms), yahoo.SPARK_BATCH):
        try:
            res = yahoo.get_spark(syms[i:i + yahoo.SPARK_BATCH])
        except ProviderError as e:
            errors += 1
            last_error = e
            continue
        spark.update({k: v for k, v in res.value.items() if k in ids})  # ignore anything we did not ask for
        fetched.append(res.fetched_at)
        cached_all &= res.cached
        stale_any |= res.stale
    if not spark and errors:
        raise last_error
    out = movers_from_spark(spark, names, top=top)
    for side in ("gainers", "losers"):
        for r in out[side]:
            r["company_id"] = ids[r["symbol"]]
            r["symbol"] = nse[r["symbol"]]
    out.update(
        source=SOURCE, delayed=True, note=DELAY_NOTE, cached=cached_all, stale=stale_any or errors > 0,
        fetched_at=datetime.fromtimestamp(min(fetched), tz=timezone.utc).isoformat() if fetched else None,
        batches_failed=errors, partial=errors > 0, universe_size=len(universe),
    )
    return out
