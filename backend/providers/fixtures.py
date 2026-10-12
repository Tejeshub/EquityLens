"""TEST/E2E ONLY: deterministic offline stand-ins for every external provider (PROVIDER_MODE=fixture).

Refused when ENVIRONMENT=production (see core/app.py). Data is synthetic (tests/fixtures, generated bars) and exists so browser E2E
tests can exercise real code paths (parsing, caching, budgets, failure mapping) without consuming live quota. Behaviour by symbol:
  SYNTHBETA  -> upstream 429 (quota)         SYNTHDELTA -> upstream 404 (unsupported)       everything else -> data
Behaviour by Copilot question text: contains FAIL_PROVIDER -> upstream 500.   LLM delay: FIXTURE_LLM_DELAY_MS (default 400).
"""
import json
import math
import os
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

FX = Path(__file__).resolve().parent.parent / "tests" / "fixtures"
IST = timezone(timedelta(hours=5, minutes=30))
RANGE_BARS = {"1mo": 21, "3mo": 63, "6mo": 126, "1y": 252, "5y": 260}


def _symbol(path: str) -> str:
    return path.rsplit("/", 1)[-1].replace(".NS", "").replace(".BO", "")


def _bars(symbol: str, rng: str, interval: str):
    n = RANGE_BARS.get(rng, 63)
    seed = sum(map(ord, symbol)) % 17
    end = datetime(2026, 10, 12, 9, 15, tzinfo=IST)
    ts, o, h, l, c, v = [], [], [], [], [], []
    d, count = end, 0
    step = timedelta(days=7 if interval == "1wk" else 1)
    while count < n:
        if interval == "1wk" or d.weekday() < 5:
            i = n - count
            base = 100 + 8 * math.sin(i / 9 + seed) + (n - i) * 0.05
            ts.append(int(d.timestamp())); o.append(round(base - 0.4, 2)); c.append(round(base + 0.3, 2))
            h.append(round(base + 1.2, 2)); l.append(round(base - 1.1, 2)); v.append(100000 + (i * 997 + seed * 131) % 50000)
            count += 1
        d -= step
    for a in (ts, o, h, l, c, v):
        a.reverse()
    return ts, o, h, l, c, v


def yahoo(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    if "/spark" in path:
        syms = request.url.params.get("symbols", "").split(",")
        out = {}
        for s in syms:
            seed = sum(map(ord, s)) % 11
            ts = [1791258300 + i * 86400 for i in range(5)]
            ts[-1] = 1791776700
            base = 100 + seed
            out[s] = {"symbol": s, "timestamp": ts, "close": [base, base + 1, base - 1, base + 2, base + 2 + (seed - 5) * 0.8], "chartPreviousClose": base}
        return httpx.Response(200, json=out)
    sym = _symbol(path)
    if sym == "SYNTHBETA":
        return httpx.Response(429, headers={"Retry-After": "3600"})
    if sym == "SYNTHDELTA":
        return httpx.Response(404, json={"chart": {"result": None, "error": {"code": "Not Found"}}})
    rng, interval = request.url.params.get("range", "5d"), request.url.params.get("interval", "1d")
    if rng == "5d":
        data = json.loads((FX / "synthetic_yahoo_chart_5d.json").read_text())
        data["chart"]["result"][0]["meta"]["symbol"] = f"{sym}.NS"
        return httpx.Response(200, json=data)
    ts, o, h, l, c, v = _bars(sym, rng, interval)
    meta = {"currency": "INR", "symbol": f"{sym}.NS", "exchangeTimezoneName": "Asia/Kolkata", "regularMarketPrice": c[-1],
            "regularMarketTime": ts[-1], "chartPreviousClose": c[-2]}
    return httpx.Response(200, json={"chart": {"result": [{"meta": meta, "timestamp": ts, "indicators": {"quote": [
        {"open": o, "high": h, "low": l, "close": c, "volume": v}]}}], "error": None}})


def exa(request: httpx.Request) -> httpx.Response:
    body = json.loads(request.content or b"{}")
    data = json.loads((FX / "synthetic_exa_news.json").read_text())
    if "contents" not in body:
        for r in data["results"]:
            r.pop("text", None)
    return httpx.Response(200, json=data)


def screener(request: httpx.Request) -> httpx.Response:
    sym = request.url.path.strip("/").split("/")[1] if request.url.path.count("/") >= 2 else ""
    if sym == "SYNTHDELTA":
        return httpx.Response(404)
    if sym == "SYNTHBETA":
        return httpx.Response(429, headers={"Retry-After": "3600"})
    return httpx.Response(200, text=(FX / "synthetic_screener_tables.html").read_text())


def _llm_text(prompt: str) -> str:
    ids = [int(x) for x in re.findall(r'<source id="(\d+)"', prompt)] or [1]
    if '"articles"' in prompt:
        return json.dumps({"articles": [{"ref": i, "label": ("positive", "neutral", "negative")[n % 3 if n % 3 != 2 else 1], "reason": "synthetic label"} for n, i in enumerate(ids)],
                           "summary": f"Synthetic sentiment summary [{ids[0]}].", "evidence": [{"text": "synthetic point", "source_ref": ids[0]}]})
    if "Draft narratives to audit" in prompt:
        return json.dumps({"issues": []})
    if '"citations"' in prompt and "Question:" in prompt:
        return json.dumps({"answer": f"Synthetic answer based on the stored sources [{ids[0]}].", "citations": [ids[0]]})
    return json.dumps({"summary": f"Synthetic narrative of the computed criteria [{ids[0]}].", "evidence": [{"text": "synthetic evidence", "source_ref": ids[0]}]})


def _delay():
    time.sleep(int(os.getenv("FIXTURE_LLM_DELAY_MS", "400")) / 1000)


def groq(request: httpx.Request) -> httpx.Response:
    body = json.loads(request.content)
    prompt = "\n".join(m["content"] for m in body["messages"])
    if "FAIL_PROVIDER" in prompt:
        return httpx.Response(500, json={"error": "synthetic upstream failure"})
    _delay()
    return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": _llm_text(prompt)}}]})


def gemini(request: httpx.Request) -> httpx.Response:
    body = json.loads(request.content)
    prompt = "\n".join(p["text"] for c in body["contents"] for p in c["parts"])
    if "FAIL_PROVIDER" in prompt:
        return httpx.Response(500, json={"error": "synthetic upstream failure"})
    _delay()
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": _llm_text(prompt)}]}}]})


HANDLERS = {"yahoo": yahoo, "exa": exa, "screener": screener, "groq": groq, "gemini": gemini}


def transport(name: str) -> httpx.MockTransport:
    return httpx.MockTransport(HANDLERS[name])
