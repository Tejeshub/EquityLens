"""Import the NSE equity list into the company master. Idempotent. Usage: python scripts/import_companies.py [csv_path]"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

from core.db import get_session
from services.companies import INDEX_URLS, import_index_list, import_nse_equity_list, parse_index_csv, parse_nse_equity_csv

URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"
MAX_BYTES = 5_000_000


def fetch() -> str:
    with httpx.Client(timeout=30, headers={"User-Agent": "EquityLens/1.0 (company master import)"}) as c:
        r = c.get(URL)
        r.raise_for_status()
        if len(r.content) > MAX_BYTES:
            raise RuntimeError("NSE list unexpectedly large")
        return r.text


if __name__ == "__main__":
    text = Path(sys.argv[1]).read_text() if len(sys.argv) > 1 else fetch()
    rows = parse_nse_equity_csv(text)
    print(f"parsed {len(rows)} rows")
    db = next(get_session())
    print(import_nse_equity_list(db, rows))
    if len(sys.argv) <= 1:  # live import also loads index membership (sector + cap segment)
        with httpx.Client(timeout=30, headers={"User-Agent": "EquityLens/1.0 (company master import)"}) as c:
            for name, slug in INDEX_URLS.items():
                r = c.get(f"https://nsearchives.nseindia.com/content/indices/{slug}.csv")
                r.raise_for_status()
                print(import_index_list(db, name, parse_index_csv(r.text)))
