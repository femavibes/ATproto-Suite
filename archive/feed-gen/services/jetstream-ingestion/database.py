"""Database connection for jetstream-ingestion service."""

import asyncpg
import json
from datetime import datetime
from typing import Dict, List, Optional, Set
from config import DATABASE_URL

# Connection pool (will be initialized in main)
_pool: Optional[asyncpg.Pool] = None


async def init_db() -> None:
    """Initialize database connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
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


async def save_post(
    conn: asyncpg.Connection,
    cid: str,
    uri: str,
    text: str,
    author_did: str,
    has_images: bool,
    has_video: bool,
    has_link: bool,
    language: str,
    langs: list[str],
    post_type: str,
    reply_parent: Optional[str],
    reply_root: Optional[str],
    created_at: str,
    record_json: dict,
    extracted: dict,
) -> bool:
    """
    Save a post to the database.
    Returns True if post was inserted, False if it already existed.
    """
    try:
        # Parse ISO datetime string to datetime object (timezone-naive UTC)
        # asyncpg works best with timezone-naive datetimes for TIMESTAMP columns
        if isinstance(created_at, str):
            try:
                # Handle ISO format with 'Z' suffix (UTC)
                if created_at.endswith('Z'):
                    created_at = created_at[:-1] + '+00:00'
                created_at_dt = datetime.fromisoformat(created_at)
                # Convert to timezone-naive UTC (remove timezone info)
                if created_at_dt.tzinfo is not None:
                    created_at_dt = created_at_dt.replace(tzinfo=None)
            except (ValueError, AttributeError):
                # Fallback to current time if parsing fails
                created_at_dt = datetime.utcnow()
        else:
            created_at_dt = created_at
            # Convert to timezone-naive if it's timezone-aware
            if isinstance(created_at_dt, datetime) and created_at_dt.tzinfo is not None:
                created_at_dt = created_at_dt.replace(tzinfo=None)
        
        result = await conn.execute(
            """
            INSERT INTO posts (
                cid, uri, text, author_did, has_images, has_video, has_link,
                language, langs, post_type, reply_parent, reply_root, created_at, record_json,
                facet_link_uris, facet_tags, outline_tags,
                embed_external_uri, embed_external_title, embed_external_description,
                embed_external_thumb_mime, embed_external_thumb_size,
                embed_images_alt_texts,
                embed_video_alt_text, embed_video_mime, embed_video_size, embed_video_aspect_width, embed_video_aspect_height,
                embed_media_images_alt_texts,
                embed_media_external_uri, embed_media_external_title, embed_media_external_description,
                bridgy_original_text
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9::text[], $10, $11, $12, $13, $14::jsonb,
                $15::text[], $16::text[], $17::text[],
                $18, $19, $20,
                $21, $22,
                $23::text[],
                $24, $25, $26, $27, $28,
                $29::text[],
                $30, $31, $32,
                $33
            )
            ON CONFLICT (cid) DO NOTHING
            """,
            cid, uri, text, author_did, has_images, has_video, has_link,
            language,
            [str(x).strip().lower() for x in (langs or []) if str(x).strip()],
            post_type,
            reply_parent,
            reply_root,
            created_at_dt,
            json.dumps(record_json or {}),
            extracted.get("facet_link_uris", []),
            extracted.get("facet_tags", []),
            extracted.get("outline_tags", []),
            extracted.get("embed_external_uri"),
            extracted.get("embed_external_title"),
            extracted.get("embed_external_description"),
            extracted.get("embed_external_thumb_mime"),
            extracted.get("embed_external_thumb_size"),
            extracted.get("embed_images_alt_texts", []),
            extracted.get("embed_video_alt_text"),
            extracted.get("embed_video_mime"),
            extracted.get("embed_video_size"),
            extracted.get("embed_video_aspect_width"),
            extracted.get("embed_video_aspect_height"),
            extracted.get("embed_media_images_alt_texts", []),
            extracted.get("embed_media_external_uri"),
            extracted.get("embed_media_external_title"),
            extracted.get("embed_media_external_description"),
            extracted.get("bridgy_original_text"),
        )
        
        # Check if row was actually inserted (INSERT 0 1) or skipped (INSERT 0 0)
        return result == "INSERT 0 1"
        return True
    except Exception as e:
        # Log error but don't crash
        print(f"Error saving post {cid}: {e}")
        return False


async def update_cursor(conn: asyncpg.Connection, cursor_seq: int, cursor_time: str) -> None:
    """Update Jetstream cursor position."""
    # Parse cursor_time string to datetime if needed
    if isinstance(cursor_time, str):
        try:
            if cursor_time.endswith('Z'):
                cursor_time = cursor_time[:-1] + '+00:00'
            cursor_time_dt = datetime.fromisoformat(cursor_time)
            # Convert to timezone-naive
            if cursor_time_dt.tzinfo is not None:
                cursor_time_dt = cursor_time_dt.replace(tzinfo=None)
        except (ValueError, AttributeError):
            cursor_time_dt = datetime.utcnow()
    else:
        cursor_time_dt = cursor_time
        if isinstance(cursor_time_dt, datetime) and cursor_time_dt.tzinfo is not None:
            cursor_time_dt = cursor_time_dt.replace(tzinfo=None)
    
    await conn.execute(
        """
        UPDATE jetstream_cursor
        SET cursor_seq = $1, cursor_time = $2, updated_at = NOW()
        WHERE id = 1
        """,
        cursor_seq, cursor_time_dt
    )


async def get_cursor(conn: asyncpg.Connection) -> tuple[int, str]:
    """Get current Jetstream cursor position."""
    row = await conn.fetchrow(
        "SELECT cursor_seq, cursor_time FROM jetstream_cursor WHERE id = 1"
    )
    if row:
        return (row["cursor_seq"], row["cursor_time"].isoformat())
    return (0, "")


def _parse_graph(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


async def fetch_live_feed_graph_rules(conn: asyncpg.Connection):
    """Rows for graph_match: feed id + live/draft/legacy columns (caller picks first parseable graph)."""
    return await conn.fetch(
        """
        SELECT
            id::text AS id,
            assignment_rules_live AS live,
            assignment_rules_draft AS draft,
            assignment_rules AS legacy
        FROM feeds
        WHERE assignment_rules_live IS NOT NULL
           OR assignment_rules_draft IS NOT NULL
           OR assignment_rules IS NOT NULL
        """
    )


async def get_cached_list_members(
    conn: asyncpg.Connection,
    list_uris: List[str],
) -> Dict[str, Set[str]]:
    """Load already-synced list members from external_list_members (no API call)."""
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


async def fetch_live_feed_keywords(conn: asyncpg.Connection) -> Set[str]:
    """
    Extract text-node keywords from live feed graphs.
    This keeps ingestion candidate filtering aligned with builder logic.
    """
    rows = await conn.fetch(
        """
        SELECT assignment_rules_live AS graph
        FROM feeds
        WHERE assignment_rules_live IS NOT NULL
        """
    )
    out: Set[str] = set()
    for row in rows:
        graph = _parse_graph(row["graph"])
        nodes = graph.get("nodes")
        if not isinstance(nodes, list):
            continue
        for node in nodes:
            if not isinstance(node, dict) or node.get("type") != "text":
                continue
            data = node.get("data") if isinstance(node.get("data"), dict) else {}
            cfg = node.get("config") if isinstance(node.get("config"), dict) else {}
            source = data or cfg
            keywords = source.get("keywords") if isinstance(source.get("keywords"), list) else []
            for keyword in keywords:
                value = keyword.get("value") if isinstance(keyword, dict) else keyword
                k = str(value or "").strip().lower()
                if k:
                    out.add(k)
    return out


async def adjust_post_counter(
    conn: asyncpg.Connection,
    subject_post_uri: str,
    kind: str,
    delta: int,
) -> bool:
    field_by_kind = {
        "like": "like_count",
        "repost": "repost_count",
        "reply": "reply_count",
        "quote": "quote_count",
    }
    field = field_by_kind.get(kind)
    if not field:
        return False
    result = await conn.execute(
        f"""
        UPDATE posts
        SET {field} = GREATEST(0, COALESCE({field}, 0) + $2),
            engagement_updated_at = NOW()
        WHERE uri = $1
        """,
        subject_post_uri,
        int(delta),
    )
    return result.endswith(" 1")


async def register_engagement_event_and_increment(
    conn: asyncpg.Connection,
    action_uri: str,
    subject_post_uri: str,
    kind: str,
) -> None:
    # Only count first-seen create for this interaction URI.
    inserted = await conn.fetchval(
        """
        INSERT INTO post_engagement_events (action_uri, subject_post_uri, kind)
        VALUES ($1, $2, $3)
        ON CONFLICT (action_uri) DO NOTHING
        RETURNING 1
        """,
        action_uri,
        subject_post_uri,
        kind,
    )
    if inserted:
        await adjust_post_counter(conn, subject_post_uri, kind, +1)


async def consume_engagement_event_and_decrement(
    conn: asyncpg.Connection,
    action_uri: str,
) -> None:
    row = await conn.fetchrow(
        """
        DELETE FROM post_engagement_events
        WHERE action_uri = $1
        RETURNING subject_post_uri, kind
        """,
        action_uri,
    )
    if not row:
        return
    await adjust_post_counter(conn, str(row["subject_post_uri"]), str(row["kind"]), -1)
