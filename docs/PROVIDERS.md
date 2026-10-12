# Providers, terms, quotas and the public-display policy

EquityLens is a **public multi-user app**. A source that is fine for one person's private research is not automatically allowed to be
*displayed to other people*. This file records, per provider, what the documents literally say (fetched 2026-10-12 by research agents;
quotes are from the cited pages and were not re-verified by a lawyer — **this is not legal advice**), how the app uses the provider, and what
the app does about it. "Verified" = read in the provider's own text or observed by calling it; "suspected/unclear" = the text is silent or
ambiguous; third-party summaries are never treated as verified.

## Capability matrix (what is shown to users in each profile)

| Capability | Source | Public profile (production default) | Personal profile (dev/own use) |
|---|---|---|---|
| Company search (name, symbol, ISIN) | NSE `EQUITY_L.csv` | **on** — the minimum identity data the product cannot work without; **NSE written confirmation outstanding (P3)** | on |
| Sector, Large/Mid/Small segment | NSE index lists | **off** (`ENABLE_NSE_INDEX`) | on |
| Quotes, charts, movers, watchlist prices | Yahoo chart/spark (unofficial) | **off** (`ENABLE_YAHOO`) | on, labelled delayed/unofficial |
| Reported financials, shareholding, compare | Screener.in | **off** (`ENABLE_SCREENER`) | on |
| News (headlines, links, excerpts) | Exa | **off** (`ENABLE_NEWS`; excerpts additionally need `ENABLE_NEWS_EXCERPTS`) — display rights unresolved (P4) | on |
| AI research | Groq over the enabled sources | **refuses (503 `source_disabled`)** while no evidence source is enabled; with only news enabled: sentiment dimension only | all dimensions |
| Copilot | Groq (default) or Gemini over stored documents | **refuses (503)** while no source is enabled; Gemini only if `COPILOT_PROVIDER=gemini` **and** `GEMINI_BILLING_ENABLED=true` | Gemini allowed |

When a source is off the API answers `503 {code:"source_disabled", message}` (or a per-row `unavailable/source_disabled`), `GET /api/v1/capabilities` (public, no data) tells the UI which sources
are on and why not, the UI neither requests nor renders the data, and **no provider call is made** (verified by backend tests and by browser tests that assert the absence of the requests).
Nothing is substituted or invented. **An environment flag is not a licence**: enabling a source is an owner decision taken at the owner's risk.

### Outstanding written permissions and exactly what each blocks
| Outstanding | Features affected while unresolved |
|---|---|
| Screener.in written permission, or a licensed fundamentals source | reported financials, shareholding, compare, research fundamental + alternative dimensions, Copilot over financial tables |
| A licensed/permitted NSE/BSE price source (Yahoo is prohibited; no free compliant source found) | quotes, charts, movers, watchlist prices |
| NSE (Data & Analytics / Indices) written confirmation | **company search itself** (name/symbol/ISIN master) until confirmed; sector & segment labels, movers universe |
| Exa written display permission | news, research sentiment, Copilot over headlines |
| BSE terms (unreadable by automation) | BSE-only listings (not covered) |
| Gemini billing decision | only the optional Gemini Copilot path |

## Provider details

### P1 Screener.in — public display **prohibited** by its terms
- Verified (screener.in/guides/terms, "last updated Aug 01, 2018"): licence is for "personal, non-commercial transitory viewing only"; you may not "modify or copy the
  materials", "use the materials for any commercial purpose, or for any public display (commercial or non-commercial)", or "mirror the materials on any other server";
  the licence ends automatically on violation and downloaded materials must then be destroyed. `robots.txt` does not disallow `/company/` (technical access ≠ licence).
  Screener states it provides **no API** (support.screener.in "Export" article); no data-licensing page exists (`/api`, `/export`, `/about` → 404).
- Use in the app (only when enabled): scrape consolidated tables + shareholding, store as `financial_facts`, show to users, feed research/Copilot. That is copying + persisting + displaying.
- **Decision:** off in the public profile. Re-enable only with written permission (support@screener.in) or replace with a licensed source.
- Quota: none published (no API). App budget when enabled: 6 req/min, one refresh per company per 7 days, failure cooldowns (5 min; 6 h for "not found").

### P2 Yahoo Finance chart/spark — public display **prohibited** by its terms
- Verified (legal.yahoo.com/us/en/yahoo/terms/otos): no access/collection "using any automated means … robots, spiders, scrapers" without express permission;
  no use "other than the interface and instructions that we provide"; no reproducing/distributing/publicly performing any portion of the Services "unless you have
  explicit written permission"; no reuse for any commercial purpose. Yahoo publishes **no official finance API** (developer.yahoo.com lists only Fantasy Sports and
  Sign-In); yfinance describes the data as "intended for personal use only … research and educational purposes".
- **Decision:** off in the public profile (the Phase 1 owner acceptance of 2026-10-12 predates these verified clauses; the owner's decision now is whether to supply a
  licensed source). Quota: none published; app budget 30 req/min + 2 min quote / 15 min history cache, stale ≤ 6 h flagged.
- Candidate replacements checked (none qualifies for free public display): NSE/BSE end-of-day files (NSE terms require written permission to display; BSE terms unreadable),
  Alpha Vantage (free = personal, "commercial" includes letting others access; 25 req/day; Indian coverage unconfirmed), Twelve Data (free tier is non-display),
  Tiingo (internal use, no India), Finnhub (personal use; redistribution barred), EODHD (20 calls/day; no NSE on free), Stooq (India coverage unconfirmed).

### P3 NSE (company master and index lists) — **unclear**
- Verified: NSE Terms of Use forbid copying/storing/displaying site content without prior written permission and forbid "systematic or automated data collection
  (including scraping…)"; the copyright page allows personal/non-commercial/educational download only; NSE Indices says "use or distribution" of index data needs a licence.
  No clause either permits or forbids showing a plain securities list; the files are served from `nsearchives.nseindia.com` and imported by a script (not scraped per request).
- **Decision:** keep identity data (name, symbol, ISIN) which the product cannot work without; hide index-derived fields (sector, segment) in the public profile.
  **Owner action:** ask NSE Data & Analytics / NSE Indices for written confirmation (keep the reply). BSE-only listings are not covered.

### P4 Exa (news) — display rights **unclear**
- Verified: Exa ToS §4.2(a) bars copying, displaying, distributing or publishing information obtained through the Services except as expressly permitted in the Terms or in
  writing; §4.2(e) bars reselling/sublicensing; no clause grants display rights to end users. Free tier: $10 credits/month (+ one-time bonus), 10 QPS on `/search`; observed
  cost `costDollars` 0.007 per search.
- **Decision:** news is **off in the public profile** (`ENABLE_NEWS`). When an owner enables it, only **headlines + URLs** are requested (no `contents` parameter) and shown with attribution; article text is never fetched/stored/shown unless `ENABLE_NEWS_EXCERPTS=true` (personal profile default). App budget 40 searches/day, 6 h cache per company (48 h stale). **Owner action:** ask Exa for written display permission.

### P5 Gemini — free tier unsuitable for public user text
- Verified (ai.google.dev/gemini-api/terms, /docs/pricing): on Unpaid services "content used to improve our products", human reviewers may read/annotate API input and output,
  developers are told not to submit personal information; EEA/UK/CH clients must use Paid Services only; 18+ requirement. A "Paid Service" means a billing-enabled Cloud project.
- **Decision:** Copilot uses **Groq** by default; Gemini only when selected explicitly and billing is confirmed (`GEMINI_BILLING_ENABLED=true`). Whether the current key's project has billing is unknown.
  Live check (Phase 2, one request): real Exa headlines → real Gemini answer, grounded with a citation (profile public, headline-only, billing flag set only for that process).
- Free-tier numeric limits were not published on the fetched page → unknown; app budget 200/day.

### P6 Groq — suitable
- Verified (console.groq.com/docs/legal/services-agreement, /your-data): no use of inputs/outputs for training and no retention by default. Observed free-tier headers:
  ~1000 req/day, ~8,000 tokens/min (`openai/gpt-oss-20b`); documentation lists the Developer plan at 30 RPM / 1K RPD / 8K TPM / 200K TPD. The old default model
  `llama-3.1-8b-instant` no longer exists (404). App budget 500/day; `Retry-After` ≤ 20 s honoured, never after the final attempt.

### Others
Firecrawl (never actually called by working code; its key was sent to a third-party host by the pre-Phase-1 code → rotate), LlamaCloud (unused),
discountingcashflows earnings API (legacy, unreachable, unused).

## Unresolved licensing questions (owner)
1. Screener.in written permission or a licensed fundamentals source. 2. A licensed (or permitted) price source for NSE/BSE. 3. NSE written confirmation for company-master/index data.
4. Exa written display permission. 5. Whether to enable billing on a Cloud project to use Gemini for public text. 6. BSE terms (page unreadable by automation).
