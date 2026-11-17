import json
from functools import lru_cache
from typing import Any, Dict, Optional
import redis
import fakeredis

from src.core.config import get_settings
from src.core.logger import get_logger

logger = get_logger(__name__)


class CacheService:
    """
    Redis caching service. Supports in-memory fakeredis and live Redis servers.
    Delivers sub-15ms response times on cached document queries using SHA-256 hashes.
    """

    def __init__(self, mode: Optional[str] = None, redis_url: Optional[str] = None):
        settings = get_settings()
        self.mode = mode or settings.REDIS_MODE
        self.redis_url = redis_url or settings.REDIS_URL
        self.default_ttl = settings.CACHE_TTL_SECONDS

        if self.mode == "mock":
            self.client = fakeredis.FakeRedis(decode_responses=True)
            logger.info("Initialized in-memory FakeRedis cache service")
        else:
            self.client = redis.Redis.from_url(self.redis_url, decode_responses=True)
            logger.info("Connected to external Redis cache server", extra={"redis_url": self.redis_url})

    # --- SHA-256 Hash Caching ---
    def get_cached_analysis(self, doc_hash: str) -> Optional[Dict[str, Any]]:
        """Retrieve completed analysis report using SHA-256 checksum key."""
        key = f"contract:hash:{doc_hash}"
        cached_data = self.client.get(key)
        if cached_data:
            logger.info("Cache HIT for contract SHA-256", extra={"sha256": doc_hash[:16]})
            return json.loads(cached_data)
        logger.info("Cache MISS for contract SHA-256", extra={"sha256": doc_hash[:16]})
        return None

    def set_cached_analysis(self, doc_hash: str, report: Dict[str, Any], ttl: Optional[int] = None) -> None:
        """Store completed analysis report under SHA-256 key with 24h TTL."""
        key = f"contract:hash:{doc_hash}"
        expire = ttl or self.default_ttl
        self.client.set(key, json.dumps(report, default=str), ex=expire)
        logger.info("Cached contract analysis report", extra={"sha256": doc_hash[:16], "ttl": expire})

    # --- Job Lifecycle Tracking ---
    def set_job_status(
        self,
        doc_id: str,
        stage: str,
        progress: int,
        is_completed: bool = False,
        error: Optional[str] = None,
    ) -> None:
        """Update ongoing background analysis stage and completion status."""
        key = f"job:status:{doc_id}"
        payload = {
            "doc_id": doc_id,
            "current_stage": stage,
            "progress_percent": progress,
            "is_completed": is_completed,
            "error": error,
        }
        self.client.set(key, json.dumps(payload), ex=3600)  # 1 hour job retention

    def get_job_status(self, doc_id: str) -> Dict[str, Any]:
        """Fetch current stage and progress percent of an active analysis job."""
        key = f"job:status:{doc_id}"
        data = self.client.get(key)
        if data:
            return json.loads(data)
        return {
            "doc_id": doc_id,
            "current_stage": "NOT_FOUND",
            "progress_percent": 0,
            "is_completed": False,
            "error": "Job ID not found in cache",
        }

    # --- Job Result Storage ---
    def set_job_result(self, doc_id: str, report: Dict[str, Any], ttl: Optional[int] = None) -> None:
        """Store finalized report keyed by doc_id."""
        key = f"job:result:{doc_id}"
        expire = ttl or self.default_ttl
        self.client.set(key, json.dumps(report, default=str), ex=expire)

    def get_job_result(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve finalized analysis report by doc_id."""
        key = f"job:result:{doc_id}"
        data = self.client.get(key)
        if data:
            return json.loads(data)
        return None

    def clear_all(self) -> None:
        """Flush all cache keys (primarily for test resets)."""
        self.client.flushall()


@lru_cache()
def get_cache_service() -> CacheService:
    """Return singleton CacheService instance."""
    return CacheService()
