"""Seed a throw-away E2E database with SYNTHETIC companies (test use only). Refuses anything but a local DB in ENVIRONMENT=test.

Usage (see docs/E2E.md):  ENVIRONMENT=test DATABASE_URL=postgresql+psycopg2://...@127.0.0.1:PORT/DB python scripts/seed_e2e.py --reset
--reset drops and recreates the public schema of the (local, test) database, then runs migrations and loads the synthetic data.
"""
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

if os.environ.get("ENVIRONMENT", "").lower() != "test":
    sys.exit("refusing: set ENVIRONMENT=test (this script drops data)")

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from core.db import get_engine, get_session   # get_engine() itself refuses non-local hosts when ENVIRONMENT=test
from services.companies import import_index_list, import_nse_equity_list, parse_index_csv

COMPANIES = [
    {"symbol": "SYNTHALPHA", "name": "Synthetic Alpha Limited", "isin": "INE000S01001", "series": "EQ", "listing_date": None},
    {"symbol": "SYNTHBETA", "name": "Synthetic Beta Limited", "isin": "INE000S01002", "series": "EQ", "listing_date": None},      # fixture: provider quota (429)
    {"symbol": "SYNTHGAMMA", "name": "Synthetic Gamma Limited", "isin": "INE000S01003", "series": "EQ", "listing_date": None},
    {"symbol": "SYNTHDELTA", "name": "Synthetic Delta Limited", "isin": "INE000S01004", "series": "EQ", "listing_date": None},    # fixture: unsupported (404)
]


def main(reset: bool) -> None:
    eng = get_engine()
    if reset:
        with eng.begin() as c:
            c.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    command.upgrade(cfg, "head")
    db = next(get_session())
    print(import_nse_equity_list(db, COMPANIES))
    pad = parse_index_csv((ROOT / "tests" / "fixtures" / "synthetic_nifty_sample.csv").read_text())
    members = [{"isin": c["isin"], "symbol": c["symbol"], "industry": "Synthetic Industry"} for c in COMPANIES]
    print(import_index_list(db, "NIFTY MIDCAP 100", members + pad))
    print("E2E seed complete: 4 synthetic companies")


if __name__ == "__main__":
    main("--reset" in sys.argv)
