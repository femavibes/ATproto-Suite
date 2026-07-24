"""Project/feed management endpoints for feed builder workflows."""

from __future__ import annotations

import json
import os
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from auth_deps import CurrentUser
from config import PUBLIC_BASE_URL, PUBLIC_URL
from database import get_db

router = APIRouter(prefix="/api", tags=["projects"])
BSKY_HOST = os.getenv("BSKY_PDS", "https://bsky.social")
_MEMORY_SAMPLES: dict[str, deque] = defaultdict(lambda: deque(maxlen=120))


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)


class ProjectDraftUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assignment_rules_draft: dict


class FeedCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)
    avatar_url: Optional[str] = None


class FeedUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    slug: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)
    avatar_url: Optional[str] = None


class FeedPublishUpdate(BaseModel):
    is_published: Optional[bool] = None
    promote_draft_to_live: bool = True


class FeedDraftUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assignment_rules_draft: dict


class FeedPublishedUriUpdate(BaseModel):
    bluesky_feed_uri: str = Field(min_length=1, max_length=512)


class DebugMemorySample(BaseModel):
    usedMB: float
    totalMB: float
    limitMB: float
    trend10MB: float = 0.0
    results: int = 0
    samples: int = 0
    panelOpen: Optional[bool] = None
    ts: Optional[int] = None


def _service_did(public_base: str) -> str:
    parsed = urlparse(public_base.strip().rstrip("/"))
    host = parsed.hostname
    if not host:
        raise HTTPException(status_code=400, detail=f"Invalid PUBLIC_URL/PUBLIC_BASE_URL: {public_base!r}")
    return f"did:web:{host.lower()}"


def _truncate(value: str, size: int) -> str:
    s = (value or "").strip()
    return s if len(s) <= size else s[: size - 1] + "..."


async def _register_bluesky_generator(
    *,
    actor_did: str,
    access_jwt: str,
    feed_id: str,
    slug: Optional[str],
    name: str,
    description: Optional[str],
) -> str:
    public_base = (PUBLIC_BASE_URL or PUBLIC_URL or "").strip().rstrip("/")
    if not public_base:
        raise HTTPException(status_code=400, detail="PUBLIC_URL must be set before publishing")

    slug_raw = (slug or "").strip().lower()
    rkey = "".join(ch if (ch.isalnum() or ch in "._~-") else "-" for ch in slug_raw).strip("-")
    if not rkey:
        rkey = feed_id.replace("-", "")
    rkey = rkey[:512]

    service_did = _service_did(public_base)
    record: dict = {
        "$type": "app.bsky.feed.generator",
        "did": service_did,
        "displayName": _truncate(name, 24),
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    desc = _truncate(description or "", 300)
    if desc:
        record["description"] = desc

    async with httpx.AsyncClient(timeout=30.0) as client:
        put_res = await client.post(
            f"{BSKY_HOST}/xrpc/com.atproto.repo.putRecord",
            headers={"Authorization": f"Bearer {access_jwt}"},
            json={
                "repo": actor_did,
                "collection": "app.bsky.feed.generator",
                "rkey": rkey,
                "record": record,
            },
        )
        if put_res.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Generator registration failed: {put_res.status_code} {put_res.text}",
            )
        payload = put_res.json()
        return payload.get("uri") or f"at://{actor_did}/app.bsky.feed.generator/{rkey}"


async def _assert_project_owner(conn, project_id: str, user_did: str) -> None:
    row = await conn.fetchval(
        "SELECT 1 FROM feed_projects WHERE id = $1::uuid AND owner_did = $2",
        project_id,
        user_did,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")


async def _assert_feed_owner(conn, feed_id: str, user_did: str) -> None:
    row = await conn.fetchval(
        """
        SELECT 1 FROM feeds f
        INNER JOIN feed_projects p ON f.project_id = p.id
        WHERE f.id = $1::uuid AND p.owner_did = $2
        """,
        feed_id,
        user_did,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Feed not found")


@router.get("/projects")
async def list_projects(user_did: CurrentUser):
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, name, description, owner_did, assignment_rules_draft,
                   assignment_rules_live, created_at, updated_at
            FROM feed_projects
            WHERE owner_did = $1
            ORDER BY updated_at DESC
            """,
            user_did,
        )
        return {"projects": [dict(r) for r in rows]}


@router.post("/projects")
async def create_project(payload: ProjectCreate, user_did: CurrentUser):
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO feed_projects (name, description, owner_did)
            VALUES ($1, $2, $3)
            RETURNING id, name, description, owner_did, assignment_rules_draft,
                      assignment_rules_live, created_at, updated_at
            """,
            payload.name.strip(),
            payload.description,
            user_did,
        )
        return {"project": dict(row)}


@router.put("/projects/{project_id}")
async def update_project(project_id: str, payload: ProjectUpdate, user_did: CurrentUser):
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No updates provided")

    set_clauses = []
    values = []
    idx = 1
    for column in ("name", "description"):
        if column in fields:
            set_clauses.append(f"{column} = ${idx}")
            values.append(
                fields[column].strip() if isinstance(fields[column], str) else fields[column]
            )
            idx += 1
    set_clauses.append("updated_at = NOW()")
    values.append(project_id)

    pool = await get_db()
    async with pool.acquire() as conn:
        await _assert_project_owner(conn, project_id, user_did)
        row = await conn.fetchrow(
            f"""
            UPDATE feed_projects
            SET {", ".join(set_clauses)}
            WHERE id = ${idx}::uuid
            RETURNING id, name, description, owner_did, assignment_rules_draft,
                      assignment_rules_live, created_at, updated_at
            """,
            *values,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"project": dict(row)}


@router.put("/projects/{project_id}/draft")
async def update_project_draft(
    project_id: str, payload: ProjectDraftUpdate, user_did: CurrentUser
):
    pool = await get_db()
    async with pool.acquire() as conn:
        await _assert_project_owner(conn, project_id, user_did)
        row = await conn.fetchrow(
            """
            UPDATE feed_projects
            SET assignment_rules_draft = $1::jsonb,
                updated_at = NOW()
            WHERE id = $2::uuid AND owner_did = $3
            RETURNING id, updated_at
            """,
            json.dumps(payload.assignment_rules_draft),
            project_id,
            user_did,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"project": dict(row)}


@router.put("/projects/{project_id}/publish")
async def publish_project_draft(project_id: str, user_did: CurrentUser):
    pool = await get_db()
    async with pool.acquire() as conn:
        await _assert_project_owner(conn, project_id, user_did)
        row = await conn.fetchrow(
            """
            UPDATE feed_projects
            SET assignment_rules_live = assignment_rules_draft,
                updated_at = NOW()
            WHERE id = $1::uuid AND owner_did = $2
            RETURNING id, updated_at
            """,
            project_id,
            user_did,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"project": dict(row)}


@router.put("/projects/{project_id}/ingestion-filters")
async def update_project_ingestion_filters(project_id: str, user_did: CurrentUser):
    """
    Promote feed drafts to live for the selected project only.
    This updates ingestion/assignment live filters without publishing feed generators.
    """
    pool = await get_db()
    async with pool.acquire() as conn:
        await _assert_project_owner(conn, project_id, user_did)
        result = await conn.execute(
            """
            UPDATE feeds
            SET assignment_rules_live = assignment_rules_draft,
                assignment_rules = assignment_rules_draft,
                updated_at = NOW()
            WHERE project_id = $1::uuid
            """,
            project_id,
        )
        updated_count = int(str(result).split()[-1]) if result else 0
        return {"project_id": project_id, "updated_feeds": updated_count}


@router.get("/debug/engagement-stats")
async def get_engagement_stats(user_did: CurrentUser):
    """
    Lightweight stats for Jetstream engagement counter updates.
    Scoped to posts relevant to this user's projects/feeds.
    """
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            WITH owned_posts AS (
              SELECT DISTINCT p.uri, p.created_at, p.engagement_updated_at
              FROM posts p
              JOIN feed_posts fp ON fp.post_cid = p.cid
              JOIN feeds f ON f.id = fp.feed_id
              JOIN feed_projects pr ON pr.id = f.project_id
              WHERE pr.owner_did = $1
            ),
            recent_events AS (
              SELECT kind, COUNT(*)::int AS n
              FROM post_engagement_events
              WHERE created_at > NOW() - INTERVAL '15 minutes'
              GROUP BY kind
            )
            SELECT
              (SELECT COUNT(*)::int FROM owned_posts) AS tracked_posts,
              (SELECT COUNT(*)::int FROM owned_posts WHERE engagement_updated_at IS NOT NULL) AS posts_with_engagement_refresh,
              (SELECT COUNT(*)::int FROM owned_posts WHERE engagement_updated_at > NOW() - INTERVAL '15 minutes') AS posts_refreshed_last_15m,
              COALESCE((SELECT n FROM recent_events WHERE kind = 'like'), 0) AS open_like_events,
              COALESCE((SELECT n FROM recent_events WHERE kind = 'repost'), 0) AS open_repost_events,
              COALESCE((SELECT n FROM recent_events WHERE kind = 'reply'), 0) AS open_reply_events,
              COALESCE((SELECT n FROM recent_events WHERE kind = 'quote'), 0) AS open_quote_events
            """,
            user_did,
        )
    data = dict(row) if row else {}
    return {
        "engagement": {
            "tracked_posts": data.get("tracked_posts", 0),
            "posts_with_engagement_refresh": data.get("posts_with_engagement_refresh", 0),
            "posts_refreshed_last_15m": data.get("posts_refreshed_last_15m", 0),
            "open_events_last_15m": {
                "like": data.get("open_like_events", 0),
                "repost": data.get("open_repost_events", 0),
                "reply": data.get("open_reply_events", 0),
                "quote": data.get("open_quote_events", 0),
            },
        }
    }


@router.post("/debug/memory-sample")
async def post_debug_memory_sample(payload: DebugMemorySample, user_did: CurrentUser):
    sample = {
        "ts": int(payload.ts or int(datetime.now(timezone.utc).timestamp() * 1000)),
        "usedMB": float(payload.usedMB),
        "totalMB": float(payload.totalMB),
        "limitMB": float(payload.limitMB),
        "trend10MB": float(payload.trend10MB),
        "results": int(payload.results),
        "samples": int(payload.samples),
        "panelOpen": bool(payload.panelOpen) if payload.panelOpen is not None else None,
    }
    _MEMORY_SAMPLES[user_did].append(sample)
    print(
        f"debug-mem-sample did={user_did} used={sample['usedMB']:.1f}MB "
        f"trend10={sample['trend10MB']:.1f}MB panelOpen={sample['panelOpen']} samples={sample['samples']}"
    )
    if len(_MEMORY_SAMPLES[user_did]) % 10 == 0:
        print(
            f"debug-mem did={user_did} used={sample['usedMB']:.1f}MB "
            f"total={sample['totalMB']:.1f}MB trend10={sample['trend10MB']:.1f}MB "
            f"results={sample['results']} panelOpen={sample['panelOpen']}"
        )
    return {"ok": True}


@router.get("/debug/memory-samples")
async def get_debug_memory_samples(user_did: CurrentUser):
    rows = list(_MEMORY_SAMPLES.get(user_did, deque()))
    return {"samples": rows}


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user_did: CurrentUser):
    pool = await get_db()
    async with pool.acquire() as conn:
        await _assert_project_owner(conn, project_id, user_did)
        async with conn.transaction():
            # Keep ownership/authorization semantics clean by removing feeds under
            # the project instead of leaving detached rows with NULL project_id.
            await conn.execute("DELETE FROM feeds WHERE project_id = $1::uuid", project_id)
            deleted = await conn.fetchval(
                "DELETE FROM feed_projects WHERE id = $1::uuid AND owner_did = $2 RETURNING id::text",
                project_id,
                user_did,
            )
        if not deleted:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"deleted_project_id": deleted}


@router.get("/projects/{project_id}/feeds")
async def list_project_feeds(project_id: str, user_did: CurrentUser):
    pool = await get_db()
    async with pool.acquire() as conn:
        await _assert_project_owner(conn, project_id, user_did)
        rows = await conn.fetch(
            """
            SELECT id, project_id, name, slug, description, avatar_url, is_published,
                   assignment_rules_draft, assignment_rules_live, prefilter_hints, created_at, updated_at
            FROM feeds
            WHERE project_id = $1::uuid
            ORDER BY updated_at DESC
            """,
            project_id,
        )
        return {"feeds": [dict(r) for r in rows]}


@router.post("/projects/{project_id}/feeds")
async def create_project_feed(
    project_id: str, payload: FeedCreate, user_did: CurrentUser
):
    import asyncpg as _asyncpg
    pool = await get_db()
    async with pool.acquire() as conn:
        await _assert_project_owner(conn, project_id, user_did)
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO feeds (
                  project_id, name, slug, description, avatar_url, is_published,
                  assignment_rules, assignment_rules_draft, assignment_rules_live
                )
                VALUES (
                  $1::uuid, $2, $3, $4, $5, FALSE,
                  '{"nodes":[],"edges":[]}'::jsonb,
                  '{"nodes":[],"edges":[]}'::jsonb,
                  '{"nodes":[],"edges":[]}'::jsonb
                )
                RETURNING id, project_id, name, slug, description, avatar_url, is_published, created_at, updated_at
                """,
                project_id,
                payload.name.strip(),
                payload.slug.strip(),
                payload.description,
                payload.avatar_url,
            )
        except _asyncpg.UniqueViolationError:
            raise HTTPException(
                status_code=409,
                detail=f'A feed with slug "{payload.slug.strip()}" already exists in this project. Choose a different slug.',
            )
        return {"feed": dict(row)}


@router.put("/feeds/{feed_id}")
async def update_feed(feed_id: str, payload: FeedUpdate, user_did: CurrentUser):
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No updates provided")

    set_clauses = []
    values = []
    idx = 1
    for column in ("name", "slug", "description", "avatar_url"):
        if column in fields:
            set_clauses.append(f"{column} = ${idx}")
            values.append(
                fields[column].strip() if isinstance(fields[column], str) else fields[column]
            )
            idx += 1
    set_clauses.append("updated_at = NOW()")
    values.append(feed_id)

    import asyncpg as _asyncpg
    pool = await get_db()
    async with pool.acquire() as conn:
        await _assert_feed_owner(conn, feed_id, user_did)
        try:
            row = await conn.fetchrow(
                f"""
                UPDATE feeds
                SET {", ".join(set_clauses)}
                WHERE id = ${idx}::uuid
                RETURNING id, project_id, name, slug, description, avatar_url, is_published, updated_at
                """,
                *values,
            )
        except _asyncpg.UniqueViolationError:
            slug = fields.get("slug", "").strip()
            raise HTTPException(
                status_code=409,
                detail=f'A feed with slug "{slug}" already exists in this project. Choose a different slug.',
            )
        if not row:
            raise HTTPException(status_code=404, detail="Feed not found")
        return {"feed": dict(row)}


@router.put("/feeds/{feed_id}/publish")
async def update_feed_publish_state(
    feed_id: str, payload: FeedPublishUpdate, user_did: CurrentUser
):
    pool = await get_db()
    async with pool.acquire() as conn:
        await _assert_feed_owner(conn, feed_id, user_did)
        if payload.promote_draft_to_live:
            row = await conn.fetchrow(
                """
                UPDATE feeds
                SET is_published = COALESCE($1, is_published),
                    assignment_rules_live = assignment_rules_draft,
                    assignment_rules = assignment_rules_draft,
                    updated_at = NOW()
                WHERE id = $2::uuid
                RETURNING id, is_published, bluesky_feed_uri, updated_at
                """,
                payload.is_published,
                feed_id,
            )
        else:
            row = await conn.fetchrow(
                """
                UPDATE feeds
                SET is_published = COALESCE($1, is_published),
                    updated_at = NOW()
                WHERE id = $2::uuid
                RETURNING id, is_published, bluesky_feed_uri, updated_at
                """,
                payload.is_published,
                feed_id,
            )
        if not row:
            raise HTTPException(status_code=404, detail="Feed not found")

        feed = dict(row)
        # Bluesky generator registration is handled client-side via the OAuth Agent
        # (DPoP-bound tokens cannot be used server-side without the DPoP private key).
        # The frontend calls com.atproto.repo.putRecord directly, then saves the URI
        # via PUT /feeds/{id}/published-uri.
        return {"feed": feed}


@router.put("/feeds/{feed_id}/draft")
async def update_feed_draft(feed_id: str, payload: FeedDraftUpdate, user_did: CurrentUser):
    pool = await get_db()
    async with pool.acquire() as conn:
        await _assert_feed_owner(conn, feed_id, user_did)
        row = await conn.fetchrow(
            """
            UPDATE feeds
            SET assignment_rules_draft = $1::jsonb,
                updated_at = NOW()
            WHERE id = $2::uuid
            RETURNING id, updated_at
            """,
            json.dumps(payload.assignment_rules_draft),
            feed_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Feed not found")
        return {"feed": dict(row)}


@router.put("/feeds/{feed_id}/published-uri")
async def update_feed_published_uri(
    feed_id: str, payload: FeedPublishedUriUpdate, user_did: CurrentUser
):
    pool = await get_db()
    async with pool.acquire() as conn:
        await _assert_feed_owner(conn, feed_id, user_did)
        row = await conn.fetchrow(
            """
            UPDATE feeds
            SET bluesky_feed_uri = $1,
                is_published = TRUE,
                updated_at = NOW()
            WHERE id = $2::uuid
            RETURNING id, is_published, bluesky_feed_uri, updated_at
            """,
            payload.bluesky_feed_uri.strip(),
            feed_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Feed not found")
        return {"feed": dict(row)}
