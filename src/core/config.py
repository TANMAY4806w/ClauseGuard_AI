from functools import lru_cache
from typing import Literal, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings validated via pydantic-settings.
    Loads from environment variables or .env file.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

    # Application Metadata
    PROJECT_NAME: str = Field(default="ClauseGuard AI", description="Microservice name")
    APP_ENV: Literal["development", "staging", "production", "test"] = Field(
        default="development", description="Execution environment"
    )
    DEBUG: bool = Field(default=True, description="Enable debug mode")
    API_V1_STR: str = Field(default="/api/v1", description="API Version 1 prefix")

    # Security & Auth
    SECRET_KEY: str = Field(
        default="dev_super_secret_clauseguard_jwt_key_change_in_production",
        description="JWT signature secret key"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=60 * 24, description="Access token expiration in minutes"
    )
    ALGORITHM: str = Field(default="HS256", description="JWT hashing algorithm")

    # LLM Providers (Multi-Provider Fallback: Groq -> Gemini -> OpenRouter)
    GROQ_API_KEY: Optional[str] = Field(default=None, description="Groq API Key")
    GEMINI_API_KEY: Optional[str] = Field(default=None, description="Google Gemini API Key")
    OPENROUTER_API_KEY: Optional[str] = Field(default=None, description="OpenRouter API Key")
    DEFAULT_LLM_PROVIDER: str = Field(default="groq", description="Primary LLM provider")
    PRIMARY_GROQ_MODEL: str = Field(default="qwen/qwen3.8-27b", description="Primary Groq model")
    FALLBACK_GROQ_MODEL: str = Field(default="openai/gpt-oss-120b", description="Fallback Groq model")
    PRIMARY_GEMINI_MODEL: str = Field(default="gemma-4-26b-a4b-it", description="Primary Gemini model")
    FALLBACK_GEMINI_MODEL: str = Field(default="gemini-flash-latest", description="Fallback Gemini model")

    # Vector Database (Qdrant)
    QDRANT_MODE: Literal["local", "server", "memory"] = Field(
        default="local",
        description="Qdrant runtime mode: 'local' (disk path), 'memory' (in-memory), or 'server' (remote host)"
    )
    QDRANT_PATH: str = Field(default="./qdrant_storage", description="Local on-disk storage path for Qdrant")
    QDRANT_HOST: str = Field(default="localhost", description="Remote Qdrant host")
    QDRANT_PORT: int = Field(default=6333, description="Remote Qdrant port")
    QDRANT_COLLECTION_NAME: str = Field(default="contract_clauses", description="Default collection name")

    # Caching & Queue (Redis)
    REDIS_MODE: Literal["mock", "server"] = Field(
        default="mock",
        description="'mock' uses in-process fakeredis; 'server' connects to live Redis URL"
    )
    REDIS_URL: str = Field(default="redis://localhost:6379/0", description="Redis connection URL")
    CACHE_TTL_SECONDS: int = Field(default=86400, description="Cached analysis TTL (24 hours)")

    # Document Ingestion Constraints
    MAX_UPLOAD_SIZE_MB: int = Field(default=25, description="Max allowed PDF upload size in megabytes")
    UPLOAD_STORAGE_DIR: str = Field(default="./data/raw_uploads", description="Directory to store uploaded contracts")

    # Reranker & Retrieval
    RERANKER_MODEL_NAME: str = Field(default="ms-marco-TinyBERT-L-2-v2", description="FlashRank model")
    TOP_K_RETRIEVAL: int = Field(default=25, description="Top-k chunks to retrieve from Qdrant before reranking")
    TOP_K_RERANKED: int = Field(default=5, description="Top-k chunks to retain after cross-encoder reranking")

    @field_validator("MAX_UPLOAD_SIZE_MB")
    @classmethod
    def validate_upload_size(cls, v: int) -> int:
        if v <= 0 or v > 100:
            raise ValueError("MAX_UPLOAD_SIZE_MB must be between 1 and 100 MB")
        return v

    @property
    def has_llm_key(self) -> bool:
        """Check if at least one real (non-placeholder) LLM provider key is present."""
        def is_real(k: Optional[str]) -> bool:
            if not k:
                return False
            clean = k.strip().lower()
            return not (clean.startswith("your_") or "placeholder" in clean or "dummy" in clean)
        return is_real(self.GROQ_API_KEY) or is_real(self.GEMINI_API_KEY) or is_real(self.OPENROUTER_API_KEY)


@lru_cache()
def get_settings() -> Settings:
    """Return a cached singleton instance of Settings."""
    return Settings()
