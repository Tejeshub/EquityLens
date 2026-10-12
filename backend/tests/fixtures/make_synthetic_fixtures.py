"""Generate the SYNTHETIC test fixtures in this directory.

Everything produced here is invented, deterministic test data (smooth arithmetic sequences, reserved
example.com / example.org domains, fake ISINs). It is NOT copied from Screener.in, Yahoo Finance, Exa,
publishers or NSE; it only mirrors the *structure* of those payloads so the parsers are exercised.

Regenerate with:  python tests/fixtures/make_synthetic_fixtures.py
"""
import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).parent
IST = timezone(timedelta(hours=5, minutes=30))

# ---------------------------------------------------------------- Screener-shaped HTML
QUARTERS = ["Jun 2023", "Sep 2023", "Dec 2023", "Mar 2024", "Jun 2024", "Sep 2024", "Dec 2024", "Mar 2025",
            "Jun 2025", "Sep 2025", "Dec 2025", "Mar 2026", "Jun 2026"]
YEARS = [f"Mar {y}" for y in range(2015, 2027)]
SHP_PERIODS = ["Dec 2023", "Mar 2024", "Jun 2024", "Sep 2024", "Dec 2024", "Mar 2025", "Jun 2025", "Sep 2025",
               "Dec 2025", "Mar 2026", "Jun 2026", "Sep 2026"]


def indian(n: int) -> str:
    """Indian digit grouping: 284983 -> '2,84,983'."""
    s, neg = str(abs(n)), n < 0
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    return ("-" if neg else "") + s


def fmt(v: float, kind: str) -> str:
    if kind == "pct":
        return f"{v:g}%"
    if kind == "dec":
        return f"{v:.2f}"
    return indian(int(round(v)))


def seq(n, start, step):
    return [start + step * i for i in range(n)]


def sub(consolidated=True, units=True):
    return ('<p class="sub" style="margin: 0;">\n      ' + ("Consolidated\n      " if consolidated else "") +
            ("Figures in Rs. Crores\n      " if units else "") + "/\n      "
            '<a class="" href="/company/SYNTHALPHA/">View Standalone</a>\n</p>')


def th_row(periods):
    return '<tr>\n<th class="text"></th>\n' + "\n".join(f"<th>{p}</th>" for p in periods) + "\n</tr>"


def td_row(label, cells, expandable, stripe):
    lab = f'<button class="button-plain">{label}&nbsp;<span class="blue-icon">+</span></button>' if expandable else label
    return (f'<tr class="{"stripe" if stripe else ""}">\n<td class="text">{lab}</td>\n' +
            "\n".join(f"<td>{c}</td>" for c in cells) + "\n</tr>")


def table(periods, rows, ttm=False):
    cols = periods + (["TTM"] if ttm else [])
    body = []
    for i, (label, start, step, kind, exp) in enumerate(rows):
        vals = seq(len(periods), start, step)
        if ttm:
            vals = vals + [vals[-1]]
        body.append(td_row(label, [fmt(v, kind) for v in vals], exp, i % 2 == 0))
    return ('<table class="data-table responsive-text-nowrap">\n<thead>\n' + th_row(cols) + "\n</thead>\n<tbody>\n" +
            "\n".join(body) + "\n</tbody>\n</table>")


Q_ROWS = [("Sales", 1000, 10, "int", True), ("Expenses", 800, 8, "int", True), ("Operating Profit", 200, 2, "int", False),
          ("OPM %", 20, 0, "pct", False), ("Other Income", 20, 1, "int", True), ("Interest", 5, 0, "int", False),
          ("Depreciation", 40, 1, "int", False), ("Profit before tax", 175, 2, "int", False), ("Tax %", 25, 0, "pct", False),
          ("Net Profit", 130, 2, "int", True), ("EPS in Rs", 10, 0.25, "dec", False)]
PL_ROWS = [("Sales", 4000, 400, "int", True), ("Expenses", 3300, 330, "int", True), ("Operating Profit", 700, 70, "int", False),
           ("OPM %", 17, 0.5, "pct", False), ("Other Income", 60, 5, "int", True), ("Interest", 20, 1, "int", False),
           ("Depreciation", 120, 10, "int", False), ("Profit before tax", 620, 60, "int", False), ("Tax %", 25, 0, "pct", False),
           ("Net Profit", 465, 45, "int", True), ("EPS in Rs", 30, 2.5, "dec", False), ("Dividend Payout %", 20, 1, "pct", False)]
BS_ROWS = [("Equity Capital", 80, 0, "int", False), ("Reserves", 2000, 250, "int", False), ("Borrowings", 300, 20, "int", True),
           ("Other Liabilities", 900, 90, "int", True), ("Total Liabilities", 3280, 360, "int", False),
           ("Fixed Assets", 500, 40, "int", True), ("CWIP", 10, 1, "int", False), ("Investments", 900, 100, "int", False),
           ("Other Assets", 1870, 219, "int", True), ("Total Assets", 3280, 360, "int", False)]
CF_ROWS = [("Cash from Operating Activity", 500, 50, "int", True), ("Cash from Investing Activity", -300, -20, "int", True),
           ("Cash from Financing Activity", -150, -10, "int", True), ("Net Cash Flow", 50, 20, "int", False),
           ("Free Cash Flow", 400, 40, "int", False), ("CFO/OP", 70, 1, "pct", False)]
RATIO_ROWS = [("Debtor Days", 60, 1, "int", False), ("Inventory Days", 10, 0, "int", False), ("Days Payable", 30, 1, "int", False),
              ("Cash Conversion Cycle", 40, 0, "int", False), ("Working Capital Days", 35, 1, "int", False),
              ("ROCE %", 18, 0.5, "pct", False)]
SHP_ROWS = [("Promoters", 50.0, -0.1, "pct"), ("FIIs", 20.0, 0.1, "pct"), ("DIIs", 20.0, 0.1, "pct"),
            ("Public", 9.0, -0.1, "pct"), ("Others", 1.0, 0.0, "pct")]


def shareholding():
    n = len(SHP_PERIODS)
    body = []
    for i, (label, start, step, kind) in enumerate(SHP_ROWS):
        cells = [f"{start + step * j:.2f}%" for j in range(n)]
        body.append(td_row(f"{label} <span class=\"blue-icon\">+</span>", cells, False, i % 2 == 0))
    holders = [indian(100000 + 1234 * j) for j in range(n)]
    body.append('<tr class="sub">\n<td class="text">No. of Shareholders</td>\n' + "\n".join(f"<td>{h}</td>" for h in holders) + "\n</tr>")
    return ('<p class="sub">Numbers in percentages</p><div id="quarterly-shp">\n<div class="responsive-holder fill-card-width">\n'
            '<table class="data-table">\n<thead>\n' + th_row(SHP_PERIODS) + "\n</thead>\n<tbody>\n" + "\n".join(body) +
            "\n</tbody>\n</table>\n</div>\n</div>")


def screener_html() -> str:
    secs = [
        ("quarters", sub() + table(QUARTERS, Q_ROWS)),
        ("profit-loss", sub() + table(YEARS, PL_ROWS, ttm=True)),
        ("balance-sheet", sub() + table(YEARS, BS_ROWS)),
        ("cash-flow", sub() + table(YEARS, CF_ROWS)),
        ("ratios", sub(units=False) + table(YEARS, RATIO_ROWS)),
        ("shareholding", shareholding()),
    ]
    return ("<html><body>\n<!-- SYNTHETIC TEST DATA - not from any real company -->\n" +
            "".join(f'<section id="{sid}">{inner}</section>\n' for sid, inner in secs) + "</body></html>\n")


# ---------------------------------------------------------------- Yahoo-shaped JSON
def trading_days_ending(end_day: datetime, n: int):
    days, d = [], end_day
    while len(days) < n:
        if d.weekday() < 5:
            days.append(d)
        d -= timedelta(days=1)
    return days[::-1]


def yahoo_chart() -> dict:
    days = trading_days_ending(datetime(2026, 10, 12, 9, 15, tzinfo=IST), 5)
    ts = [int(d.timestamp()) for d in days]
    close = [100.0, 101.0, 102.0, 104.0, 105.0]
    opens = [99.5, 100.5, 101.5, 102.5, 104.0]
    high = [c + 2.0 for c in close]
    low = [c - 2.0 for c in close]
    vol = [100000, 110000, 120000, 130000, 140000]
    reg_time = int(datetime(2026, 10, 12, 15, 29, 38, tzinfo=IST).timestamp())
    return {"chart": {"result": [{
        "meta": {"currency": "INR", "symbol": "SYNTHALPHA.NS", "exchangeName": "NSI", "fullExchangeName": "NSE",
                 "instrumentType": "EQUITY", "firstTradeDate": ts[0], "regularMarketTime": reg_time,
                 "hasPrePostMarketData": False, "gmtoffset": 19800, "timezone": "IST",
                 "exchangeTimezoneName": "Asia/Kolkata", "regularMarketPrice": 105.0,
                 "fiftyTwoWeekHigh": 120.0, "fiftyTwoWeekLow": 80.0, "regularMarketDayHigh": 107.0,
                 "regularMarketDayLow": 103.0, "regularMarketVolume": 140000,
                 "longName": "Synthetic Test Company Limited", "shortName": "SYNTHETIC TEST CO LTD",
                 "chartPreviousClose": 100.0, "priceHint": 2, "dataGranularity": "1d", "range": "5d",
                 "validRanges": ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]},
        "timestamp": ts,
        "indicators": {"quote": [{"open": opens, "close": close, "high": high, "low": low, "volume": vol}],
                       "adjclose": [{"adjclose": close}]}}], "error": None}}


def yahoo_spark() -> dict:
    ts = yahoo_chart()["chart"]["result"][0]["timestamp"]
    series = {"SYNTHALPHA.NS": [100.0, 101.0, 102.0, 104.0, 105.0],
              "SYNTHBETA.NS": [200.0, 198.0, 196.0, 199.0, 195.0],
              "SYNTHGAMMA.NS": [300.0, 301.0, 302.0, 303.0, 306.0]}
    out = {}
    for sym, close in series.items():
        out[sym] = {"timestamp": ts, "symbol": sym, "end": None, "previousClose": None, "chartPreviousClose": close[0],
                    "start": None, "dataGranularity": 300, "fulldayPrice": close[-1],
                    "fulldayChange": round(close[-1] - close[-2], 2),
                    "fulldayChangePercent": round((close[-1] - close[-2]) / close[-2] * 100, 3), "close": close}
    return out


# ---------------------------------------------------------------- Exa-shaped JSON
def exa_news() -> dict:
    items = [
        {"title": "Synthetic headline 1", "url": "https://news.example.com/synthetic/1", "publishedDate": "2026-10-12T09:46:38.000Z",
         "text": "# Synthetic headline 1\n\nSynthetic placeholder body for testing only. Quarterly sales commentary is invented."},
        {"title": "Synthetic headline 2", "url": "https://news.example.org/synthetic/2", "publishedDate": "2026-10-10T11:20:54.000Z",
         "author": "Synthetic Author", "text": "Synthetic headline 2\n\nInvented text used only by automated tests."},
        {"title": "Synthetic headline 3", "url": "https://markets.example.com/synthetic/3", "publishedDate": "2026-10-09T14:34:35.000Z",
         "author": "Test Writer", "text": "Synthetic headline 3\n\nAnother invented excerpt for the news pipeline."},
        {"title": "Synthetic headline 4", "url": "https://blog.example.org/synthetic/4", "publishedDate": "2026-10-06T17:00:18.000Z",
         "text": "Synthetic headline 4\n\nPlaceholder text. Not a real article."},
        {"title": "Synthetic headline 5", "url": "https://wire.example.com/synthetic/5", "publishedDate": "2026-10-03T08:00:00.000Z",
         "text": "Synthetic headline 5\n\nPlaceholder text. Not a real article."},
        {"title": "Synthetic headline 6 (undated)", "url": "https://archive.example.org/synthetic/6",
         "text": "Synthetic headline 6\n\nThis synthetic item intentionally has no publishedDate."},
    ]
    for it in items:
        it["id"] = it["url"]
    return {"resolvedSearchType": "", "results": items, "searchTime": 1.0,
            "costDollars": {"total": 0.007, "search": {"neural": 0.007}}}


# ---------------------------------------------------------------- Index-list CSV
def nifty_csv() -> str:
    inds = ["Information Technology", "Financial Services", "Healthcare", "Capital Goods", "Services"]
    rows = [(f"Synthetic Company {i:02d} Ltd.", inds[i % len(inds)], f"SYNTH{i:02d}", "EQ", f"INE000S02{i:03d}") for i in range(1, 23)]
    import io
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["Company Name", "Industry", "Symbol", "Series", "ISIN Code"])
    w.writerows(rows)
    return buf.getvalue()


def main():
    (OUT / "synthetic_screener_tables.html").write_text(screener_html())
    (OUT / "synthetic_yahoo_chart_5d.json").write_text(json.dumps(yahoo_chart(), indent=1) + "\n")
    (OUT / "synthetic_yahoo_spark.json").write_text(json.dumps(yahoo_spark(), indent=1) + "\n")
    (OUT / "synthetic_exa_news.json").write_text(json.dumps(exa_news(), indent=1) + "\n")
    (OUT / "synthetic_nifty_sample.csv").write_text(nifty_csv())


if __name__ == "__main__":
    main()
