# Research method

Dimensions: **Fundamentals**, **News sentiment**, **Alternative / ownership signals**. Scores 0–100; position = bullish ≥60, bearish ≤40, else neutral.

- **Fundamentals** = mean of available criteria (≥2 needed), piecewise-linear: revenue growth YoY (−10%→0, 0→40, 10→60, 25→100); net profit
  growth YoY (same, needs positive base); OPM change YoY (−5pp→0, 0→50, +5pp→100); ROCE latest FY (5→0, 15→60, 25→100); borrowings/equity
  (0→100, 0.5→70, 1→40, 2→0). Thresholds are EquityLens heuristics, not valuation models.
- **Alternative** = promoter holding change over 4 quarters (−5pp→0, 0→55, +3pp→100) and FII+DII change (−5→0, 0→50, +5→100). Hiring, web traffic and
  MCA signals are **not measured** and are listed as such, never treated as neutral.
- **Sentiment** = 50 + 50·(positive−negative)/labelled, where a language model labels each retrieved article; ≥2 articles required.
- **Confidence** = evidence coverage × freshness, capped at 0.90 — not a probability of being right. Overall = mean of available dimension scores ×
  √(coverage) (×0.85 if scores differ by >40). Missing dimensions are excluded, never zero/neutral-filled.
- The model writes narratives and labels articles only. Every narrative is checked programmatically (citations exist; figures appear in sources),
  then critiqued by the model; **at most one** revision round, accepted only if it reduces issues; unresolved issues are disclosed. Refinement never
  changes scores or confidence.
- Reuse: an identical evidence set for the same user within 24 h returns the stored report without new model calls.
