from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Text, MetaData, Table, insert
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import uuid
from config import POSTGRES_URL

engine = create_engine(POSTGRES_URL)
SessionLocal = sessionmaker(bind=engine)
metadata = MetaData()

# Define tables (will be created by init_db.py)
financials_quarterly = Table(
    "financials_quarterly", metadata,
    Column("id", String, primary_key=True, default=lambda: str(uuid.uuid4())),
    Column("company_name", String, nullable=False),
    Column("quarter", String, nullable=False),
    Column("metric_name", String, nullable=False),
    Column("metric_value", Float),
    Column("unit", String),
    Column("source_document_id", String),
    Column("confidence", Float, default=1.0),
    Column("created_at", DateTime, default=datetime.now)
)

raw_documents = Table(
    "raw_documents", metadata,
    Column("id", String, primary_key=True),
    Column("company", String),
    Column("source_type", String),
    Column("url", String),
    Column("file_path", String),
    Column("size_bytes", Integer),
    Column("downloaded_at", DateTime)
)

guidance_entries = Table(
    "guidance_entries", metadata,
    Column("id", String, primary_key=True, default=lambda: str(uuid.uuid4())),
    Column("company", String),
    Column("quarter", String),
    Column("metric", String),
    Column("guidance_lower", Float),
    Column("guidance_upper", Float),
    Column("actual", Float),
    Column("deviation_percent", Float),
    Column("source_page", Integer),
    Column("confidence", Float)
)

def insert_raw_document(raw_doc: dict) -> str:
    with engine.begin() as conn:
        ins = raw_documents.insert().values(
            id=raw_doc["raw_document_id"],
            company=raw_doc["company"],
            source_type=raw_doc["source_type"],
            url=raw_doc["url"],
            file_path=raw_doc["file_path"],
            size_bytes=raw_doc["size_bytes"],
            downloaded_at=raw_doc["downloaded_at"]
        )
        conn.execute(ins)
    return raw_doc["raw_document_id"]

# Other helper functions (insert_financial_metric, verify_metric) are in parser_tools and verification_tools