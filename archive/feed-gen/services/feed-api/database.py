"""Database connection for feed-api service."""

import asyncpg
from typing import Optional
from config import DATABASE_URL

# Connection pool (will be initialized in main)
_pool: Optional[asyncpg.Pool] = None


async def init_db() -> None:
    """Initialize database connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=5,
            max_size=20,
            command_timeout=60
        )


async def close_db() -> None:
    """Close database connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_db() -> asyncpg.Pool:
    """Get database connection pool."""
    if _pool is None:
        await init_db()
    return _pool
