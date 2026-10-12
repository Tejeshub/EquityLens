"""Application settings. Read lazily from the environment; never logs secret values."""
import os
from functools import lru_cache
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = Field("development", alias="ENVIRONMENT")  # development | test | production
    database_url: Optional[str] = Field(None, alias="DATABASE_URL")
    postgres_url: Optional[str] = Field(None, alias="POSTGRES_URL")  # legacy name

    allowed_origins: str = Field("http://localhost:8080,http://localhost:5173", alias="ALLOWED_ORIGINS")
    cookie_secure: Optional[bool] = Field(None, alias="COOKIE_SECURE")
    session_ttl_hours: int = Field(168, alias="SESSION_TTL_HOURS")

    # Per-user budgets (fixed window). Conservative defaults; provider quotas are unverified.
    research_per_user_per_day: int = Field(5, alias="RESEARCH_PER_USER_PER_DAY")
    ask_per_user_per_hour: int = Field(30, alias="ASK_PER_USER_PER_HOUR")
    login_attempts_per_15min: int = Field(8, alias="LOGIN_ATTEMPTS_PER_15MIN")

    # Data-source policy (see docs/PROVIDERS.md). 'public' (default in production) disables every source whose documented
    # terms do not clearly permit public display; 'personal' (default elsewhere) enables them for single-owner/dev use.
    data_profile: Optional[str] = Field(None, alias="DATA_PROFILE")
    enable_screener: Optional[bool] = Field(None, alias="ENABLE_SCREENER")
    enable_yahoo: Optional[bool] = Field(None, alias="ENABLE_YAHOO")
    enable_nse_index: Optional[bool] = Field(None, alias="ENABLE_NSE_INDEX")
    enable_news: Optional[bool] = Field(None, alias="ENABLE_NEWS")  # Exa: display rights unresolved -> off in the public profile
    enable_news_excerpts: Optional[bool] = Field(None, alias="ENABLE_NEWS_EXCERPTS")
    copilot_provider: str = Field("groq", alias="COPILOT_PROVIDER")  # groq | gemini
    gemini_billing_enabled: bool = Field(False, alias="GEMINI_BILLING_ENABLED")  # free-tier Gemini may train on prompts
    provider_mode: str = Field("live", alias="PROVIDER_MODE")  # live | fixture (fixture refused in production)

    research_jobs_inline: bool = Field(False, alias="RESEARCH_JOBS_INLINE")  # tests only: run the job synchronously
    research_max_concurrent: int = Field(2, alias="RESEARCH_MAX_CONCURRENT", ge=1, le=8)
    research_max_queue: int = Field(20, alias="RESEARCH_MAX_QUEUE", ge=1, le=200)
    research_job_timeout_s: int = Field(600, alias="RESEARCH_JOB_TIMEOUT_S")

    # Capacity: every request thread must be able to obtain a DB connection or the process can deadlock (verified under load).
    threadpool_size: int = Field(24, alias="THREADPOOL_SIZE", ge=4, le=200)
    db_pool_extra: int = Field(4, alias="DB_POOL_EXTRA", ge=0, le=50)
    max_inflight: Optional[int] = Field(None, alias="MAX_INFLIGHT", ge=1, le=400)  # default: THREADPOOL_SIZE
    queue_wait_s: float = Field(20.0, alias="QUEUE_WAIT_S")

    debug_proxy_chain: bool = Field(False, alias="DEBUG_PROXY_CHAIN")  # temporary: log the forwarding chain of the first requests (see DEPLOYMENT.md §7)
    trusted_proxy_hops: int = Field(0, alias="TRUSTED_PROXY_HOPS", ge=0, le=5)  # proxies in front of the app incl. the direct peer
    session_idle_hours: int = Field(72, alias="SESSION_IDLE_HOURS")
    login_fail_per_account_ip: int = Field(5, alias="LOGIN_FAIL_PER_ACCOUNT_IP")      # per 15 min
    login_fail_per_account: int = Field(50, alias="LOGIN_FAIL_PER_ACCOUNT")           # per 15 min (high: lockout-DoS resistant)
    login_fail_per_ip: int = Field(30, alias="LOGIN_FAIL_PER_IP")                     # per 15 min
    register_per_ip_per_hour: int = Field(10, alias="REGISTER_PER_IP_PER_HOUR")
    register_global_per_hour: int = Field(300, alias="REGISTER_GLOBAL_PER_HOUR")
    hash_concurrency: int = Field(3, alias="HASH_CONCURRENCY", ge=1, le=16)

    yahoo_requests_per_minute: int = Field(30, alias="YAHOO_REQUESTS_PER_MINUTE")
    exa_requests_per_day: int = Field(40, alias="EXA_REQUESTS_PER_DAY")
    groq_requests_per_day: int = Field(500, alias="GROQ_REQUESTS_PER_DAY")

    @field_validator("environment")
    @classmethod
    def _env(cls, v: str) -> str:
        return v.lower()

    @property
    def inflight_limit(self) -> int:
        return min(self.max_inflight or self.threadpool_size, self.threadpool_size)

    @property
    def db_pool_size(self) -> int:
        """Every admitted request may hold one connection, plus the background research workers."""
        return self.inflight_limit + self.research_max_concurrent + 2

    @property
    def profile(self) -> str:
        p = (self.data_profile or ("public" if self.is_production else "personal")).lower()
        return p if p in ("public", "personal") else "public"

    def source_enabled(self, name: str) -> bool:
        override = {"screener": self.enable_screener, "yahoo": self.enable_yahoo, "nse_index": self.enable_nse_index,
                    "news": self.enable_news, "news_excerpts": self.enable_news_excerpts}[name]
        if name == "news_excerpts" and not self.source_enabled("news"):
            return False  # excerpts are a subset of news
        return override if override is not None else self.profile == "personal"

    @property
    def origins_configured(self) -> bool:
        return bool(os.environ.get("ALLOWED_ORIGINS", "").strip())

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def db_url(self) -> Optional[str]:
        return self.database_url or self.postgres_url

    @property
    def origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def secure_cookies(self) -> bool:
        return self.is_production if self.cookie_secure is None else self.cookie_secure


@lru_cache
def get_settings() -> Settings:
    return Settings()
