"""READ-ONLY inspection of a Postgres database before any migration. Prints schema names, relation/row counts and alembic status.
Never prints connection strings, credentials or row contents. Usage:  DATABASE_URL=... python scripts/inspect_db_readonly.py"""
import os
import sys
from urllib.parse import urlparse

import psycopg2

url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
if not url:
    sys.exit("set DATABASE_URL")
u = urlparse(url.replace("postgresql+psycopg2://", "postgresql://"))
print(f"target: host={u.hostname} port={u.port} db={u.path.lstrip('/')}")
conn = psycopg2.connect(url.replace("postgresql+psycopg2://", "postgresql://"), connect_timeout=15,
                        options="-c default_transaction_read_only=on -c statement_timeout=15000")
conn.set_session(readonly=True, autocommit=True)
cur = conn.cursor()
q = lambda sql: (cur.execute(sql), cur.fetchall())[1]
print("server:", q("select version()")[0][0][:40])
print("public relations:", [(r[0], r[1]) for r in q("select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','m') order by 1")] or "NONE (empty)")
av = q("select to_regclass('public.alembic_version')")[0][0]
print("alembic_version table:", "present" if av else "absent", "-> revision:", q("select version_num from alembic_version")[0][0] if av else None)
for t in ("users", "watchlists", "research_reports", "financials_quarterly"):
    if q(f"select to_regclass('public.{t}')")[0][0]:
        print(f"row count {t}:", q(f"select count(*) from {t}")[0][0])
print("auth.users (Supabase) count:", q("select count(*) from auth.users")[0][0] if q("select to_regclass('auth.users')")[0][0] else "n/a")
