"""Baseline: the three tables that already exist in deployed databases.

For a database that already has these tables (created by scripts/init_db.py) run
`alembic stamp 0001` instead of upgrading, then `alembic upgrade head`.
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "financials_quarterly",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_name", sa.String(), nullable=False),
        sa.Column("quarter", sa.String(), nullable=False),
        sa.Column("metric_name", sa.String(), nullable=False),
        sa.Column("metric_value", sa.Float()),
        sa.Column("unit", sa.String()),
        sa.Column("source_document_id", sa.String()),
        sa.Column("confidence", sa.Float()),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_table(
        "raw_documents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company", sa.String()),
        sa.Column("source_type", sa.String()),
        sa.Column("url", sa.String()),
        sa.Column("file_path", sa.String()),
        sa.Column("size_bytes", sa.Integer()),
        sa.Column("downloaded_at", sa.DateTime()),
    )
    op.create_table(
        "guidance_entries",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company", sa.String()),
        sa.Column("quarter", sa.String()),
        sa.Column("metric", sa.String()),
        sa.Column("guidance_lower", sa.Float()),
        sa.Column("guidance_upper", sa.Float()),
        sa.Column("actual", sa.Float()),
        sa.Column("deviation_percent", sa.Float()),
        sa.Column("source_page", sa.Integer()),
        sa.Column("confidence", sa.Float()),
    )


def downgrade() -> None:
    # Intentionally not dropping legacy data tables.
    raise RuntimeError("Refusing to drop legacy financial data tables")
