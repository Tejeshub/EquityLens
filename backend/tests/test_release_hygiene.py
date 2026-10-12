"""Release hygiene: credentials only reach their own provider, dormant legacy code cannot run, test-only switches cannot reach production."""
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

import pytest

ROOT = Path(__file__).resolve().parents[1]
ACTIVE = ["core", "routers", "services", "providers", "main.py", "config.py"]


def _py_files():
    for a in ACTIVE:
        p = ROOT / a
        yield from ([p] if p.is_file() else sorted(p.rglob("*.py")))


def test_importing_the_app_loads_no_legacy_module_or_third_party_scraper_sdk():
    code = ("import sys, main; bad=[m for m in sys.modules if m.split('.')[0] in "
            "('agents','rag','tools','scraper','transcript_scraper','earnings_scraper','requests','firecrawl','exa_py','groq','chromadb') "
            "or m in ('google.generativeai','providers.fixtures','storage.raw_store','storage.semantic_store')]; print(','.join(bad))")
    env = dict(os.environ, ENVIRONMENT="test")
    out = subprocess.run([sys.executable, "-c", code], cwd=ROOT, env=env, capture_output=True, text=True, timeout=60)
    assert out.returncode == 0, out.stderr[-500:]
    assert out.stdout.strip() == "", f"unexpected modules imported: {out.stdout}"


def test_no_active_code_references_firecrawl_llamacloud_or_the_moneycontrol_path():
    for f in _py_files():
        text = f.read_text().lower()
        for needle in ("firecrawl", "llama_cloud", "moneycontrol"):
            assert needle not in text, f"{f} mentions {needle}"


def test_active_code_uses_no_unmanaged_http_client():
    """Every outbound call goes through providers.base.ProviderClient (timeouts, budgets, redaction, host pinning)."""
    allowed = {"providers/base.py", "scripts"}
    for f in _py_files():
        rel = str(f.relative_to(ROOT))
        if rel in allowed:
            continue
        text = f.read_text()
        assert not re.search(r"^\s*(import requests|from requests|import urllib\.request|import aiohttp)", text, re.M), rel
        assert "httpx.Client(" not in text and "httpx.get(" not in text and "httpx.post(" not in text, rel


EXPECTED_HOSTS = {"groq": "api.groq.com", "exa": "api.exa.ai", "gemini": "generativelanguage.googleapis.com",
                  "yahoo": "query1.finance.yahoo.com", "screener": "www.screener.in"}


def test_each_provider_client_is_pinned_to_its_own_host_and_keys_go_nowhere_else():
    from providers import exa, gemini, groq, screener, yahoo
    clients = {"groq": groq.make_client("SENTINEL-KEY", budget=None), "exa": exa.make_client("SENTINEL-KEY", budget=None),
               "gemini": gemini.make_client("SENTINEL-KEY", budget=None), "yahoo": yahoo.make_client(budget=None),
               "screener": screener.make_client(budget=None)}
    for name, c in clients.items():
        assert urlparse(c.base_url).netloc == EXPECTED_HOSTS[name] and c.base_url.startswith("https://")
        if name in ("yahoo", "screener"):
            assert not any("SENTINEL" in v for v in c.headers.values())
        with pytest.raises(ValueError, match="different host"):
            c.request("GET", "https://attacker.example/steal")           # an absolute URL must never carry our headers elsewhere


def test_secrets_are_only_read_from_the_server_environment_and_never_referenced_by_the_frontend():
    fe = ROOT.parent / "frontend" / "src"
    names = ("GROK_API_KEY", "GEMINI_API_KEY", "EXA_API_KEY", "DATABASE_URL", "POSTGRES_URL")
    for f in fe.rglob("*"):
        if f.is_file() and f.suffix in {".ts", ".tsx", ".js", ".html"} and "/test/" not in str(f):
            t = f.read_text(errors="ignore")
            assert not any(n in t for n in names), f
    assert not [f for f in (ROOT.parent / "frontend").glob(".env*") if f.is_file()], "frontend must not ship env files"


@pytest.mark.parametrize("name,value", [("PROVIDER_MODE", "fixture"), ("RESEARCH_JOBS_INLINE", "true")])
def test_test_only_switches_are_refused_in_production(monkeypatch, name, value):
    from core.settings import get_settings
    monkeypatch.setenv("ENVIRONMENT", "production"); monkeypatch.setenv("ALLOWED_ORIGINS", "https://x.example")
    monkeypatch.delenv("RESEARCH_JOBS_INLINE", raising=False); monkeypatch.delenv("PROVIDER_MODE", raising=False)
    monkeypatch.setenv(name, value)               # only the switch under test is set, so the refusal is attributable to it
    get_settings.cache_clear()
    try:
        from core.app import create_base_app
        with pytest.raises(RuntimeError, match=name):
            create_base_app()
    finally:
        monkeypatch.setenv("ENVIRONMENT", "test"); monkeypatch.delenv(name, raising=False); monkeypatch.setenv("RESEARCH_JOBS_INLINE", "true")
        monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:8080")
        get_settings.cache_clear()


def test_production_has_no_dependency_on_test_fixtures():
    """Production-reachable code may reference tests/fixtures only inside providers/fixtures.py (fixture mode, refused in production)."""
    for f in _py_files():
        if f.name == "fixtures.py" and f.parent.name == "providers":
            continue
        assert "tests/fixtures" not in f.read_text() and "tests\" / \"fixtures" not in f.read_text(), f
