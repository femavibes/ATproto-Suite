"""Run SQL migrations on feed-api startup."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import List

import asyncpg

from config import DATABASE_URL


def _migration_dirs() -> List[Path]:
    raw = os.getenv("DATABASE_MIGRATIONS_DIR", "").strip()
    candidates: List[Path] = []
    if raw:
        candidates.append(Path(raw))
    here = Path(__file__).resolve().parent
    candidates.extend(
        [
            Path("/app/database/migrations"),
            here.parent.parent / "database" / "migrations",
            here.parent / "database" / "migrations",
        ]
    )
    out = []
    for p in candidates:
        rp = p.expanduser().resolve()
        if rp not in out:
            out.append(rp)
    return out


def _pick_migrations_dir() -> Path | None:
    for d in _migration_dirs():
        if d.is_dir() and any(d.glob("*.sql")):
            return d
    return None


async def run_startup_migrations() -> int:
    migrations_dir = _pick_migrations_dir()
    if not migrations_dir:
        print("startup migrations: no migration directory found, skipping")
        return 0

    files = sorted(migrations_dir.glob("*.sql"))
    if not files:
        return 0

    conn = await asyncpg.connect(DATABASE_URL)
    applied_count = 0
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version TEXT PRIMARY KEY,
              applied_at TIMESTAMP DEFAULT NOW()
            )
            """
        )
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
            applied_count += 1
            print(f"startup migrations: applied {version}")
    finally:
        await conn.close()
    return applied_count


if __name__ == "__main__":
    asyncio.run(run_startup_migrations())
