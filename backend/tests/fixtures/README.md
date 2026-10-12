# Test fixtures

All files here are **synthetic**: invented, deterministic data that only mirrors the *structure* of the
payloads the providers return (Screener-style HTML tables, Yahoo chart/spark JSON, Exa news JSON, an index
constituents CSV). Nothing is copied from Screener.in, Yahoo Finance, Exa, news publishers or NSE.
Company names, symbols and ISINs (`Synthetic Alpha Limited`, `SYNTHALPHA`, `INE000S0...`) are fake, and URLs
use the reserved `example.com` / `example.org` domains.

Regenerate (no network, no randomness) from the `backend` directory:

    .venv/bin/python tests/fixtures/make_synthetic_fixtures.py

Edit the generator, not the generated files. Do not add captured third-party content here.
