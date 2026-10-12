"""ORM models for the application tables added in Stage B.

The three pre-existing tables (financials_quarterly, raw_documents, guidance_entries) stay defined in
storage/structured_store.py but share this Base.metadata so Alembic sees one schema.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, Column, Computed, Date, DateTime, ForeignKey, Index, Integer, JSON,
    Numeric, String, Text, UniqueConstraint, func, text,
)
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_canonical: Mapped[str] = mapped_column(String(320), nullable=False)  # uniqueness key (see core/emailnorm.py)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # No email delivery mechanism exists, so verification is NOT implemented; this stays False.
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    __table_args__ = (Index("uq_users_email_lower", func.lower(email), unique=True),
                      Index("uq_users_email_canonical", "email_canonical", unique=True))


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # sha256(token)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    user_agent: Mapped[str] = mapped_column(String(255), nullable=True)


class RateLimitCounter(Base):
    """Fixed-window counters shared by all backend instances (auth throttling, per-user and provider budgets)."""
    __tablename__ = "rate_limit_counters"
    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Company(Base):
    """One row per legal issuer, identified by ISIN (dedupes NSE/BSE listings of the same company)."""
    __tablename__ = "companies"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    isin: Mapped[str] = mapped_column(String(12), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    sector: Mapped[str] = mapped_column(String(120), nullable=True)
    source: Mapped[str] = mapped_column(String(80), nullable=False)
    source_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    listings = relationship("Listing", back_populates="company", cascade="all, delete-orphan")


class Listing(Base):
    __tablename__ = "listings"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    exchange: Mapped[str] = mapped_column(String(8), nullable=False)  # NSE | BSE
    symbol: Mapped[str] = mapped_column(String(40), nullable=False)
    series: Mapped[str] = mapped_column(String(8), nullable=True)
    listing_date: Mapped[datetime] = mapped_column(Date, nullable=True)
    company = relationship("Company", back_populates="listings")
    __table_args__ = (
        UniqueConstraint("exchange", "symbol", name="uq_listing_exchange_symbol"),
        CheckConstraint("exchange in ('NSE','BSE')", name="ck_listing_exchange"),
        Index("ix_listings_symbol", "symbol"),
    )

    @property
    def yahoo_symbol(self) -> str:
        return f"{self.symbol}.{'NS' if self.exchange == 'NSE' else 'BO'}"

    @property
    def screener_slug(self) -> str:
        return self.symbol


class Watchlist(Base):
    __tablename__ = "watchlists"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    items = relationship("WatchlistItem", back_populates="watchlist", cascade="all, delete-orphan", order_by="WatchlistItem.added_at")
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_watchlist_user_name"),)


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    watchlist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    watchlist = relationship("Watchlist", back_populates="items")
    company = relationship("Company")
    __table_args__ = (UniqueConstraint("watchlist_id", "company_id", name="uq_watchlist_company"),)


class ResearchReport(Base):
    __tablename__ = "research_reports"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)  # complete | partial | failed
    result: Mapped[dict] = mapped_column(JSON, nullable=False)
    evidence_version: Mapped[str] = mapped_column(String(64), nullable=True)
    model_config_hash: Mapped[str] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class IndexMembership(Base):
    """Membership of a company in an NSE index (NIFTY 50 / NEXT 50 / MIDCAP 100 / SMALLCAP 100)."""
    __tablename__ = "index_memberships"
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
    index_name: Mapped[str] = mapped_column(String(40), primary_key=True)
    source_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class FinancialFact(Base):
    """A single reported figure with provenance. Replaces nothing destructively: legacy financials_quarterly is untouched."""
    __tablename__ = "financial_facts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    basis: Mapped[str] = mapped_column(String(14), nullable=False, default="standalone")  # consolidated | standalone
    statement: Mapped[str] = mapped_column(String(24), nullable=False)  # quarterly_results|profit_loss|balance_sheet|cash_flow|ratios|shareholding
    period_type: Mapped[str] = mapped_column(String(2), nullable=False)  # Q | FY
    period_end: Mapped[datetime] = mapped_column(Date, nullable=False)
    metric: Mapped[str] = mapped_column(String(120), nullable=False)
    value: Mapped[float] = mapped_column(Numeric(24, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(24), nullable=True)  # null = unit not stated by the source
    currency: Mapped[str] = mapped_column(String(3), nullable=True)
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="reported")  # reported | computed
    source: Mapped[str] = mapped_column(String(60), nullable=False)
    source_url: Mapped[str] = mapped_column(String(300), nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    __table_args__ = (
        UniqueConstraint("company_id", "basis", "statement", "period_end", "metric", name="uq_fact_identity"),
        CheckConstraint("period_type in ('Q','FY')", name="ck_fact_period_type"),
        Index("ix_fact_company_statement", "company_id", "statement"),
    )


class Document(Base):
    """A retrievable source document. owner_user_id NULL = public source material; set = private to that user."""
    __tablename__ = "documents"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # financials | news | filing
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=True)
    as_of: Mapped[str] = mapped_column(String(40), nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    __table_args__ = (Index("ix_documents_company_kind", "company_id", "kind"),)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    page: Mapped[int] = mapped_column(Integer, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    tsv = mapped_column(TSVECTOR, Computed("to_tsvector('english', text)", persisted=True))
    __table_args__ = (Index("ix_chunks_company_owner", "company_id", "owner_user_id"), Index("ix_chunks_tsv", "tsv", postgresql_using="gin"))


class ResearchJob(Base):
    """A bounded background research run. At most one active (queued/running) job per (user, company)."""
    __tablename__ = "research_jobs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="queued")  # queued | running | complete | failed
    error_code: Mapped[str] = mapped_column(String(24), nullable=True)
    error_message: Mapped[str] = mapped_column(String(300), nullable=True)
    report_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("research_reports.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        Index("ix_research_jobs_user_created", "user_id", "created_at"),
        Index("uq_research_job_active", "user_id", "company_id", unique=True, postgresql_where=text("status in ('queued','running')")),
        CheckConstraint("status in ('queued','running','complete','failed')", name="ck_research_job_status"),
    )
