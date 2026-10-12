"""Production entrypoint: `uvicorn main:app`.

The previous unauthenticated /analyze and /ask handlers (kept for reference in legacy/main_legacy.py.txt) were
replaced by authenticated, rate-limited routers under /api/v1.
"""
from core.app import create_base_app

app = create_base_app()
