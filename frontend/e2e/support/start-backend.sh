#!/usr/bin/env bash
# Seeds a throw-away LOCAL Postgres database with synthetic data, then runs the real FastAPI backend against it with
# offline fixture providers. Used by playwright.config.ts (webServer). TEST ONLY: never point this at a real database.
#   usage: start-backend.sh <port> <database> <personal|public> <allowed-origin> [news]
#   (optional 5th arg "news" = public profile with ONLY ENABLE_NEWS=true; excerpts stay off)
set -euo pipefail
PORT="$1"; DB="$2"; PROFILE="$3"; ORIGIN="$4"; EXTRA="${5:-}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$(cd "$HERE/../../../backend" && pwd)"
PGHOST_="${E2E_PG_HOST:-127.0.0.1}"; PGPORT_="${E2E_PG_PORT:-55433}"
PGUSER_="${E2E_PG_USER:-postgres}"; PGPASS_="${E2E_PG_PASSWORD:-equitylens_dev}"
PY="${E2E_PYTHON:-$BACKEND/.venv/bin/python}"
case "$PGHOST_" in 127.0.0.1|localhost) ;; *) echo "refusing: E2E database host must be local" >&2; exit 1;; esac
case "$DB" in e2e_*) ;; *) echo "refusing: database name must start with e2e_" >&2; exit 1;; esac

export ENVIRONMENT=test
export DATABASE_URL="postgresql+psycopg2://${PGUSER_}:${PGPASS_}@${PGHOST_}:${PGPORT_}/${DB}"
cd "$BACKEND"
"$PY" scripts/seed_e2e.py --reset >&2

export PROVIDER_MODE=fixture RESEARCH_JOBS_INLINE=false FIXTURE_LLM_DELAY_MS="${FIXTURE_LLM_DELAY_MS:-700}"
export ALLOWED_ORIGINS="$ORIGIN" REGISTER_PER_IP_PER_HOUR=1000 REGISTER_GLOBAL_PER_HOUR=1000 COPILOT_PROVIDER=gemini
export DATA_PROFILE="$PROFILE"
unset ENABLE_NEWS ENABLE_NEWS_EXCERPTS ENABLE_YAHOO ENABLE_SCREENER ENABLE_NSE_INDEX   # the profile default decides, nothing leaks in from the shell
if [ "$EXTRA" = "news" ]; then export ENABLE_NEWS=true; fi
LOGDIR="$HERE/../.logs"; mkdir -p "$LOGDIR"   # backend log (provider traffic is mocked; see docs/E2E.md)
exec "$PY" -m uvicorn main:app --host 127.0.0.1 --port "$PORT" --log-level warning >"$LOGDIR/backend-$PORT.log" 2>&1
