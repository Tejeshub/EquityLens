"""Company news from Exa: dedupe, attribute, sort. No summaries or sentiment are invented."""
import re
from datetime import datetime, timezone
from typing import List, Optional
from urllib.parse import urlparse, urlunparse

from providers import exa

_TRACKING = re.compile(r"^(utm_|fbclid|gclid|mc_)")


def normalize_url(url: str) -> str:
    p = urlparse(url.strip())
    q = "&".join(x for x in p.query.split("&") if x and not _TRACKING.match(x))
    host = p.netloc.lower().removeprefix("www.")
    return urlunparse((p.scheme.lower(), host, p.path.rstrip("/"), "", q, ""))


def _norm_title(t: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()


def _http_url(u: str) -> bool:
    return urlparse(u).scheme in ("http", "https") and bool(urlparse(u).netloc)


def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def build_items(results: List[dict], limit: int) -> List[dict]:
    seen_url, seen_title, items = set(), set(), []
    for r in results:
        url, title = r.get("url") or "", (r.get("title") or "").strip()
        if not title or not _http_url(url):
            continue  # unusable record; never fabricate a title or link
        nu, nt = normalize_url(url), _norm_title(title)
        if nu in seen_url or nt in seen_title:
            continue
        seen_url.add(nu); seen_title.add(nt)
        published = _parse_date(r.get("publishedDate"))
        text = (r.get("text") or "").strip()
        items.append({
            "title": title, "url": url, "source": urlparse(url).netloc.lower().removeprefix("www."),
            "published_at": published.isoformat() if published else None,
            "excerpt": text[:400] if text else None,  # first characters of the article as returned by the provider
            "author": r.get("author") or None,
        })
    items.sort(key=lambda i: (i["published_at"] is None, -(datetime.fromisoformat(i["published_at"]).timestamp() if i["published_at"] else 0)))
    return items[:limit]


def company_news(name: str, symbol: str, limit: int = 10, max_age_days: Optional[int] = 90):
    from core import policy
    text = policy.enabled("news_excerpts")
    q = f"{name} ({symbol}) NSE India stock news"
    res = exa.cache.get_or_fetch(f"news:{symbol}:{'t' if text else 'h'}", exa.NEWS_TTL, lambda: exa.search_news(q, include_text=text),
                                 stale_ttl=exa.STALE_OK)
    items = build_items(res.value, 50)
    if max_age_days:
        cutoff = datetime.now(timezone.utc).timestamp() - max_age_days * 86400
        items = [i for i in items if i["published_at"] is None or datetime.fromisoformat(i["published_at"]).timestamp() >= cutoff]
    return items, res
