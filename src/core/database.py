import os
from pathlib import Path
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from src.core.config import get_settings
from src.core.logger import get_logger

logger = get_logger(__name__)

Base = declarative_base()

_engine = None
_session_maker = None


def get_database_url() -> str:
    """
    Resolves the async database connection string.
    Defaults to SQLite aiosqlite for zero-friction local development.
    Supports PostgreSQL asyncpg for free-tier cloud deployment (Neon, Supabase).
    """
    settings = get_settings()
    raw_url = settings.DATABASE_URL

    if not raw_url:
        # Local SQLite default: ensure parent folder exists
        db_path = Path(settings.SQLITE_DB_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        # SQLite async format requires absolute or relative path with 3 slashes
        clean_path = str(db_path).replace("\\", "/")
        return f"sqlite+aiosqlite:///{clean_path}"

    # Auto-convert standard postgres:// URLs from Supabase / Render / Railway
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif raw_url.startswith("postgresql://") and "+asyncpg" not in raw_url:
        raw_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    return raw_url


def get_engine():
    """Lazily initializes and returns the SQLAlchemy async engine singleton."""
    global _engine
    if _engine is None:
        db_url = get_database_url()
        # SQLite needs check_same_thread=False
        connect_args = {}
        if "sqlite" in db_url:
            connect_args = {"check_same_thread": False}

        _engine = create_async_engine(
            db_url,
            echo=False,
            future=True,
            connect_args=connect_args,
        )
        logger.info(
            "Initialized async database engine",
            extra={"db_type": "sqlite" if "sqlite" in db_url else "postgresql"}
        )
    return _engine


def get_session_maker() -> async_sessionmaker[AsyncSession]:
    """Lazily initializes and returns the async session maker."""
    global _session_maker
    if _session_maker is None:
        engine = get_engine()
        _session_maker = async_sessionmaker(
            engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )
    return _session_maker


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides an isolated AsyncSession per request.
    Handles commit, rollback on error, and automatic session closing.
    """
    session_factory = get_session_maker()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initializes database tables on application startup.
    Creates all tables defined by SQLAlchemy models if they do not exist.
    """
    # Import all models so metadata is populated
    import src.models  # noqa: F401

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema validated and initialized successfully")
