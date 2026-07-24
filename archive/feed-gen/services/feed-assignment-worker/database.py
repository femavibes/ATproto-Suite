"""Database helpers for assignment worker."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set

import asyncpg

from config import DATABASE_URL

_pool: Optional[asyncpg.Pool] = None


async def init_db() -> None:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )


async def close_db() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_db() -> asyncpg.Pool:
    if _pool is None:
        await init_db()
    return _pool


async def fetch_feeds_with_graph(conn: asyncpg.Connection) -> List[asyncpg.Record]:
    """
    Return live, draft, and legacy rule columns separately. The assignment loop must pick the
    first parseable *visual* graph — legacy default {"logic","groups"} is not a graph and would
    otherwise shadow a valid draft.
    """
    return await conn.fetch(
        """
        SELECT
            id,
            assignment_rules_live,
            assignment_rules_draft,
            assignment_rules AS assignment_rules_legacy,
            prefilter_hints
        FROM feeds
        WHERE assignment_rules_live IS NOT NULL
           OR assignment_rules_draft IS NOT NULL
           OR assignment_rules IS NOT NULL
        """
    )


async def fetch_candidate_posts(
    conn: asyncpg.Connection,
    limit: int,
) -> List[asyncpg.Record]:
    # Conservative initial strategy: scan latest posts.
    return await conn.fetch(
        """
        SELECT *
        FROM posts
        ORDER BY created_at DESC
        LIMIT $1
        """,
        limit,
    )


async def fetch_candidate_posts_for_feed(
    conn: asyncpg.Connection,
    limit: int,
    hints_payload: Dict[str, Any],
) -> List[asyncpg.Record]:
    """
    Conservative SQL-side narrowing:
    - If a gate is unsafe, do not apply it in SQL.
    - Regex hints are ignored at SQL stage (handled by full evaluator).
    """
    if not isinstance(hints_payload, dict):
        return await fetch_candidate_posts(conn, limit)

    ok = bool(hints_payload.get("ok"))
    if not ok:
        return await fetch_candidate_posts(conn, limit)

    unsafe_keyword = bool(hints_payload.get("unsafeToDropForKeywordGate", True))
    unsafe_language = bool(hints_payload.get("unsafeToDropForLanguageGate", True))

    keyword_stems = [
        str(x).lower()
        for x in (hints_payload.get("keywordStems") or [])
        if str(x).strip() and not str(x).lower().startswith("regex:")
    ]
    language_codes = [
        str(x).lower() for x in (hints_payload.get("languageCodes") or []) if str(x).strip()
    ]

    # If both gates are unsafe (or empty), fallback to latest posts scan.
    use_keyword = (not unsafe_keyword) and bool(keyword_stems)
    use_language = (not unsafe_language) and bool(language_codes)
    if not use_keyword and not use_language:
        return await fetch_candidate_posts(conn, limit)

    where_parts: List[str] = []
    args: List[Any] = []
    idx = 1

    if use_keyword:
        where_parts.append(f"LOWER(COALESCE(text, '')) LIKE ANY(${idx}::text[])")
        args.append([f"%{k}%" for k in keyword_stems])
        idx += 1

    if use_language:
        # Support exact language and regional variants (en, en-US).
        where_parts.append(
            f"""(
                EXISTS (
                    SELECT 1
                    FROM unnest(${idx}::text[]) AS lang
                    WHERE LOWER(COALESCE(language, '')) = lang
                       OR LOWER(COALESCE(language, '')) LIKE (lang || '-%')
                )
            )"""
        )
        args.append(language_codes)
        idx += 1

    sql = f"""
        SELECT *
        FROM posts
        WHERE {' AND '.join(where_parts)}
        ORDER BY created_at DESC
        LIMIT ${idx}
    """
    args.append(limit)
    return await conn.fetch(sql, *args)


async def upsert_feed_post(
    conn: asyncpg.Connection,
    feed_id: str,
    post_cid: str,
    score: float,
) -> None:
    await conn.execute(
        """
        INSERT INTO feed_posts (feed_id, post_cid, base_score, assigned_at)
        VALUES ($1::uuid, $2, $3::int, NOW())
        ON CONFLICT (feed_id, post_cid)
        DO UPDATE SET
            base_score = EXCLUDED.base_score,
            assigned_at = NOW()
        """,
        feed_id,
        post_cid,
        int(score),
    )


async def clear_feed_posts(
    conn: asyncpg.Connection,
    feed_id: str,
) -> None:
    await conn.execute(
        """
        DELETE FROM feed_posts
        WHERE feed_id = $1::uuid
        """,
        feed_id,
    )


async def clear_feed_pinned_posts(
    conn: asyncpg.Connection,
    feed_id: str,
) -> None:
    await conn.execute(
        """
        DELETE FROM feed_pinned_posts
        WHERE feed_id = $1::uuid
        """,
        feed_id,
    )


async def upsert_feed_pinned_post(
    conn: asyncpg.Connection,
    feed_id: str,
    post_cid: str,
    post_uri: str,
    position: int,
) -> None:
    await conn.execute(
        """
        INSERT INTO feed_pinned_posts (feed_id, post_cid, post_uri, position, expires_at)
        VALUES ($1::uuid, $2, $3, $4, NULL)
        ON CONFLICT (feed_id, post_cid)
        DO UPDATE SET
            post_uri = EXCLUDED.post_uri,
            position = EXCLUDED.position,
            expires_at = EXCLUDED.expires_at,
            created_at = NOW()
        """,
        feed_id,
        post_cid,
        post_uri,
        int(position),
    )


async def fetch_feed_ranked_posts(
    conn: asyncpg.Connection,
    feed_id: str,
) -> List[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT
            fp.post_cid,
            fp.base_score,
            fp.assigned_at,
            p.uri,
            p.created_at,
            p.like_count,
            p.reply_count,
            p.repost_count,
            p.quote_count,
            p.bookmark_count
        FROM feed_posts fp
        JOIN posts p ON p.cid = fp.post_cid
        WHERE fp.feed_id = $1::uuid
        ORDER BY fp.base_score DESC, fp.assigned_at DESC, fp.post_cid DESC
        """,
        feed_id,
    )


async def resolve_post_cids_by_uri(
    conn: asyncpg.Connection,
    uris: List[str],
) -> Dict[str, str]:
    if not uris:
        return {}
    rows = await conn.fetch(
        """
        SELECT uri, cid
        FROM posts
        WHERE uri = ANY($1::text[])
        """,
        uris,
    )
    return {str(r["uri"]): str(r["cid"]) for r in rows}


async def upsert_feed_prefilter_hints(
    conn: asyncpg.Connection,
    feed_id: str,
    payload: Dict[str, Any],
) -> None:
    await conn.execute(
        """
        UPDATE feeds
        SET prefilter_hints = $2::jsonb,
            updated_at = NOW()
        WHERE id = $1::uuid
        """,
        feed_id,
        json.dumps(payload),
    )


async def list_cache_needs_refresh(
    conn: asyncpg.Connection,
    list_uri: str,
    ttl_seconds: int,
) -> bool:
    row = await conn.fetchrow(
        """
        SELECT last_refreshed_at
        FROM external_list_refresh_state
        WHERE list_uri = $1
        """,
        list_uri,
    )
    if not row or not row.get("last_refreshed_at"):
        return True
    last = row["last_refreshed_at"]
    return last < (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=ttl_seconds))


async def replace_external_list_members(
    conn: asyncpg.Connection,
    list_uri: str,
    member_dids: Set[str],
    did_to_handle: Dict[str, str],
    source_type: str,
    error: Optional[str] = None,
) -> None:
    async with conn.transaction():
        await conn.execute("DELETE FROM external_list_members WHERE list_uri = $1", list_uri)
        if member_dids:
            values = [
                (
                    list_uri,
                    did,
                    did_to_handle.get(did),
                    source_type,
                )
                for did in sorted(member_dids)
            ]
            await conn.executemany(
                """
                INSERT INTO external_list_members (list_uri, member_did, member_handle, source_type, refreshed_at)
                VALUES ($1, $2, $3, $4, NOW())
                """,
                values,
            )
        await conn.execute(
            """
            INSERT INTO external_list_refresh_state (list_uri, last_refreshed_at, last_error, updated_at)
            VALUES ($1, NOW(), $2, NOW())
            ON CONFLICT (list_uri) DO UPDATE
              SET last_refreshed_at = EXCLUDED.last_refreshed_at,
                  last_error = EXCLUDED.last_error,
                  updated_at = NOW()
            """,
            list_uri,
            error,
        )


async def get_cached_list_members(
    conn: asyncpg.Connection,
    list_uris: List[str],
) -> Dict[str, Set[str]]:
    if not list_uris:
        return {}
    rows = await conn.fetch(
        """
        SELECT list_uri, member_did
        FROM external_list_members
        WHERE list_uri = ANY($1::text[])
        """,
        list_uris,
    )
    out: Dict[str, Set[str]] = {u: set() for u in list_uris}
    for r in rows:
        out.setdefault(str(r["list_uri"]), set()).add(str(r["member_did"]))
    return out


async def fetch_posts_for_engagement_refresh(
    conn: asyncpg.Connection,
    limit: int,
    stale_minutes: int,
) -> List[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT cid, uri, created_at, engagement_updated_at
        FROM posts
        WHERE engagement_updated_at IS NULL
           OR engagement_updated_at < (NOW() - ($2::int || ' minutes')::interval)
        ORDER BY created_at DESC
        LIMIT $1
        """,
        limit,
        stale_minutes,
    )


async def update_post_engagement_counters(
    conn: asyncpg.Connection,
    uri: str,
    like_count: int,
    reply_count: int,
    repost_count: int,
    quote_count: int,
    bookmark_count: int = 0,
) -> None:
    await conn.execute(
        """
        UPDATE posts
        SET like_count = $2,
            reply_count = $3,
            repost_count = $4,
            quote_count = $5,
            bookmark_count = $6,
            engagement_updated_at = NOW()
        WHERE uri = $1
        """,
        uri,
        like_count,
        reply_count,
        repost_count,
        quote_count,
        bookmark_count,
    )
