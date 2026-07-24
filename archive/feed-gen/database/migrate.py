"""Simple SQL migration runner for local/dev environments."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import asyncpg


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://feedgen:feedgen@localhost:5440/feedgen",
)
MIGRATIONS_DIR = Path(__file__).parent / "migrations"


async def ensure_migrations_table(conn: asyncpg.Connection) -> None:
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT NOW()
        )
        """
    )


async def apply_migrations() -> None:
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        print("No migration files found.")
        return

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await ensure_migrations_table(conn)
        applied = {
            row["version"]
            for row in await conn.fetch("SELECT version FROM schema_migrations")
        }
        for migration_file in files:
            version = migration_file.name
            if version in applied:
                continue
            sql = migration_file.read_text(encoding="utf-8")
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES ($1)",
                    version,
                )
            print(f"Applied migration: {version}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(apply_migrations())
