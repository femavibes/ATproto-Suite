"""Feed API endpoints for Bluesky AT Proto."""

import uuid as uuid_module
from datetime import datetime

from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from urllib.parse import urlparse
from pydantic import BaseModel
from database import get_db
import httpx

router = APIRouter()


class FeedSkeletonItem(BaseModel):
    """Single item in feed skeleton response."""
    post: str  # Post URI (at://...)


class FeedSkeletonResponse(BaseModel):
    """Response for getFeedSkeleton endpoint."""
    feed: list[FeedSkeletonItem]
    cursor: Optional[str] = None


@router.get(
    "/xrpc/app.bsky.feed.getFeedSkeleton",
    response_model=FeedSkeletonResponse,
    response_model_exclude_none=True,
)
async def get_feed_skeleton(
    feed: str = Query(..., description="Feed URI (at://...)"),
    limit: int = Query(50, ge=1, le=100, description="Number of posts to return"),
    cursor: Optional[str] = Query(None, description="Pagination cursor")
):
    """
    Get feed skeleton - returns post URIs for a feed.
    
    This implements the Bluesky AT Proto feed API specification.
    Returns only post URIs (skeleton), not full post content.
    """
    # Last path segment: UUID, 32-char hex (undashed UUID), or slug — see _resolve_feed_uuid
    rkey = _extract_generator_rkey_from_uri(feed)
    if not rkey:
        raise HTTPException(
            status_code=400,
            detail="Invalid feed URI format",
        )

    pool = await get_db()

    async with pool.acquire() as conn:
        feed_id = await _resolve_feed_uuid(conn, rkey)
        if not feed_id:
            raise HTTPException(
                status_code=404,
                detail="Feed not found",
            )
        
        # Get pinned posts first (always at top)
        pinned_rows = await conn.fetch(
            """
            SELECT post_uri, position
            FROM feed_pinned_posts
            WHERE feed_id = $1
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY position ASC
            """,
            feed_id
        )
        
        # Query feed posts
        # Order by base_score DESC, then assigned_at DESC
        # Use cursor for pagination if provided
        if cursor:
            # Parse cursor (format: "score:ISO-timestamp:post_cid")
            # Timestamp itself contains colons (e.g. 2026-04-22T01:29:40.277000),
            # so split on the FIRST colon only to get score, then the LAST to get cid.
            try:
                first_colon = cursor.index(":")
                last_colon = cursor.rindex(":")
                if first_colon == last_colon:
                    raise ValueError("cursor missing cid segment")
                cursor_score = int(cursor[:first_colon])
                cursor_cid = cursor[last_colon + 1:]
                cursor_timestamp = datetime.fromisoformat(cursor[first_colon + 1:last_colon])
            except (ValueError, IndexError):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid cursor format"
                )
            
            # Query with cursor (skip pinned posts in cursor)
            rows = await conn.fetch(
                """
                SELECT fp.post_cid, p.uri, fp.base_score, fp.assigned_at
                FROM feed_posts fp
                JOIN posts p ON fp.post_cid = p.cid
                WHERE fp.feed_id = $1
                  AND (
                    fp.base_score < $2
                    OR (fp.base_score = $2 AND fp.assigned_at < $3)
                    OR (fp.base_score = $2 AND fp.assigned_at = $3 AND fp.post_cid < $4)
                  )
                ORDER BY fp.base_score DESC, fp.assigned_at DESC, fp.post_cid DESC
                LIMIT $5
                """,
                feed_id, cursor_score, cursor_timestamp, cursor_cid, limit + 1
            )
        else:
            # First page - no cursor
            rows = await conn.fetch(
                """
                SELECT fp.post_cid, p.uri, fp.base_score, fp.assigned_at
                FROM feed_posts fp
                JOIN posts p ON fp.post_cid = p.cid
                WHERE fp.feed_id = $1
                ORDER BY fp.base_score DESC, fp.assigned_at DESC, fp.post_cid DESC
                LIMIT $2
                """,
                feed_id, limit + 1
            )
        
        # Check if there's a next page
        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]
        
        # Build response - pinned posts first, then regular posts
        feed_items = []
        
        # Add pinned posts at the top
        for pinned_row in pinned_rows:
            feed_items.append(FeedSkeletonItem(post=pinned_row["post_uri"]))
        
        # Add regular posts
        for row in rows:
            feed_items.append(FeedSkeletonItem(post=row["uri"]))
        
        # Generate cursor for next page if needed
        next_cursor = None
        if has_more and rows:
            last_row = rows[-1]
            # Format: score:timestamp:post_cid
            next_cursor = f"{last_row['base_score']}:{last_row['assigned_at'].isoformat()}:{last_row['post_cid']}"
        
        return FeedSkeletonResponse(
            feed=feed_items,
            cursor=next_cursor
        )


def _extract_generator_rkey_from_uri(uri: str) -> Optional[str]:
    """
    Extract generator record key (last segment) from AT URI.

    Example: at://did:plc:abc/app.bsky.feed.generator/<rkey>
    """
    try:
        if not uri.startswith("at://"):
            return None
        parts = uri.replace("at://", "").split("/")
        if len(parts) >= 3:
            return parts[-1]
        return None
    except Exception:
        return None


async def _resolve_feed_uuid(conn, rkey: str) -> Optional[str]:
    """
    Map generator rkey to feeds.id (UUID string).

    Supports:
    - Standard UUID string: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    - 32-char hex (undashed UUID), common rkey form for generator records
    - feeds.slug when slug matches rkey (case-insensitive)
    """
    if not rkey:
        return None
    rkey = rkey.strip()
    try:
        u = uuid_module.UUID(rkey)
        row = await conn.fetchval(
            "SELECT id::text FROM feeds WHERE id = $1::uuid",
            str(u),
        )
        if row:
            return str(row)
    except ValueError:
        pass

    hex_only = rkey.lower()
    if len(hex_only) == 32 and all(c in "0123456789abcdef" for c in hex_only):
        dashed = (
            f"{hex_only[0:8]}-{hex_only[8:12]}-{hex_only[12:16]}-"
            f"{hex_only[16:20]}-{hex_only[20:32]}"
        )
        try:
            u = uuid_module.UUID(dashed)
            row = await conn.fetchval(
                "SELECT id::text FROM feeds WHERE id = $1::uuid",
                str(u),
            )
            if row:
                return str(row)
        except ValueError:
            pass

    row = await conn.fetchval(
        """
        SELECT id::text FROM feeds
        WHERE slug IS NOT NULL AND lower(slug) = lower($1)
        """,
        rkey,
    )
    return str(row) if row else None


async def _resolve_handle_to_did(handle: str) -> Optional[str]:
    """
    Resolve a Bluesky handle (e.g., username.bsky.social) to a DID.
    
    Uses the public AT Protocol identity.resolveHandle endpoint.
    """
    try:
        # Remove @ prefix if present
        handle = handle.lstrip("@")
        
        # Use public Bluesky resolver (bsky.social)
        resolver_url = f"https://bsky.social/xrpc/com.atproto.identity.resolveHandle"
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(resolver_url, params={"handle": handle})
            if response.status_code == 200:
                data = response.json()
                return data.get("did")
        return None
    except Exception as e:
        print(f"Error resolving handle '{handle}' to DID: {e}")
        return None


async def _extract_at_uri_from_url_async(url: str) -> Optional[str]:
    """
    Extract AT URI from a Bluesky web URL or return the URI as-is.
    
    This is the async version that supports handle resolution.

    Supports:
    - at:// URIs directly (e.g., at://did:plc:xxx/app.bsky.feed.post/yyy)
    - https://bsky.app/profile/did:plc:xxx/post/yyy (DID-based)
    - https://bsky.app/profile/username.bsky.social/post/yyy (handle-based - resolves to DID)
    - https://bsky.app/profile/@username/post/yyy (handle-based with @ prefix)
    """
    try:
        # Direct AT URI
        if url.startswith("at://"):
            # Validate format: at://did:plc:xxx/app.bsky.feed.post/rkey
            if "/app.bsky.feed.post/" in url:
                return url
            # If it's just at://did:plc:xxx/rkey, try to construct full URI
            if url.count("/") == 2:
                parts = url.replace("at://", "").split("/")
                if len(parts) == 2 and parts[0].startswith("did:"):
                    return f"at://{parts[0]}/app.bsky.feed.post/{parts[1]}"
            return url

        # Parse web URL
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        if host not in ("bsky.app", "www.bsky.app"):
            return None

        parts = parsed.path.strip("/").split("/")
        # Expect: profile/<did or handle>/post/<rkey>
        # Or: profile/@<handle>/post/<rkey>
        if len(parts) >= 4 and parts[0] == "profile" and parts[2] == "post":
            did_or_handle = parts[1]
            rkey = parts[3]
            
            # Remove @ prefix if present
            if did_or_handle.startswith("@"):
                did_or_handle = did_or_handle[1:]
            
            # If it's a DID, construct AT URI directly
            if did_or_handle.startswith("did:"):
                return f"at://{did_or_handle}/app.bsky.feed.post/{rkey}"
            
            # Handle-based URLs: resolve handle to DID
            did = await _resolve_handle_to_did(did_or_handle)
            if did:
                return f"at://{did}/app.bsky.feed.post/{rkey}"
            
            # Failed to resolve handle
            return None
            
        return None
    except Exception as e:
        # Log the error for debugging but don't expose it to user
        print(f"Error parsing URL '{url}': {e}")
        return None


async def _fetch_post_from_bluesky(at_uri: str) -> Optional[dict]:
    """
    Fallback: fetch a post directly from Bluesky if it's not in our database.

    We normalize the response into a shape similar to our `posts` table so the
    existing frontend normalizer (`normalizeDebugPost`) can reuse it.
    """
    if not at_uri.startswith("at://"):
        return None

    try:
        # at://did:plc:xxx/app.bsky.feed.post/rkey
        parts = at_uri.replace("at://", "").split("/")
        if len(parts) < 3:
            return None

        repo = parts[0]
        collection = parts[1]
        rkey = parts[2]

        # Only support feed posts for now
        if collection != "app.bsky.feed.post":
            return None

        url = "https://bsky.social/xrpc/com.atproto.repo.getRecord"
        params = {
            "repo": repo,
            "collection": collection,
            "rkey": rkey,
        }

        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                print(
                    f"Bluesky getRecord failed for {at_uri}: "
                    f"{resp.status_code} {resp.text[:200]}"
                )
                return None

            data = resp.json()

        record = data.get("value") or {}
        uri = data.get("uri", at_uri)

        text = record.get("text", "") or ""
        created_at = record.get("createdAt") or record.get("created_at")
        langs = record.get("langs") or []

        embed = record.get("embed") or {}
        facets = record.get("facets") or []

        # Basic media/link detection, matching our ingestion booleans
        has_images = embed.get("$type") == "app.bsky.embed.images"
        has_video = embed.get("$type") == "app.bsky.embed.video"
        has_link = (
            embed.get("$type") == "app.bsky.embed.external"
            or any(
                any(f.get("uri") for f in (facet.get("features") or []))
                for facet in facets
            )
        )

        # Post type & reply structure
        reply = record.get("reply") or {}
        reply_parent = (reply.get("parent") or {}).get("uri")
        reply_root = (reply.get("root") or {}).get("uri")

        if reply_parent or reply_root:
            post_type = "reply"
        else:
            # Very lightweight quote detection: treat embed.record as quote
            if embed.get("$type") in (
                "app.bsky.embed.record",
                "app.bsky.embed.recordWithMedia",
            ):
                post_type = "quote"
            else:
                post_type = "post"

        # Approximate language: first langs entry if present
        language = None
        if isinstance(langs, list) and langs:
            language = str(langs[0])

        # Extract flat tag arrays matching the posts table columns
        facet_tags = [
            feature.get("tag")
            for facet in facets
            for feature in (facet.get("features") or [])
            if feature.get("$type") == "app.bsky.richtext.facet#tag"
            and feature.get("tag")
        ]
        outline_tags = [str(t) for t in (record.get("tags") or []) if t]

        # Shape this like a row from `posts` so the frontend normalizer works
        return {
            "cid": data.get("cid"),
            "uri": uri,
            "text": text,
            "author_did": repo,
            "has_images": has_images,
            "has_video": has_video,
            "has_link": has_link,
            "language": language,
            "post_type": post_type,
            "reply_parent": reply_parent,
            "reply_root": reply_root,
            "created_at": created_at,
            "facet_tags": facet_tags,
            "outline_tags": outline_tags,
            # The rest of the columns (source_type, etc.) are not needed for debug
        }
    except Exception as e:
        print(f"Error fetching post from Bluesky for {at_uri}: {e}")
        return None


@router.get("/debug/post")
async def debug_post(url: str = Query(..., description="Bluesky post URL or at:// URI")):
    """
    Debug endpoint to fetch a single post from the database or, if missing,
    directly from Bluesky by URL/URI.

    - Accepts a Bluesky web URL (https://bsky.app/...) or at:// URI.
    - Resolves handles to DIDs automatically.
    - First tries our `posts` table; if no row, falls back to Bluesky API.
    """
    at_uri = await _extract_at_uri_from_url_async(url)
    if not at_uri:
        # Provide helpful error message based on what we received
        error_msg = "Invalid post URL format. "
        if url.startswith("at://"):
            error_msg += (
                "AT URI format should be: at://did:plc:xxx/app.bsky.feed.post/rkey"
            )
        elif "bsky.app" in url:
            error_msg += (
                "Expected format: https://bsky.app/profile/did:plc:xxx/post/rkey or "
                "https://bsky.app/profile/username.bsky.social/post/rkey"
            )
        else:
            error_msg += (
                "Supported formats:\n"
                "- at://did:plc:xxx/app.bsky.feed.post/rkey\n"
                "- https://bsky.app/profile/did:plc:xxx/post/rkey\n"
                "- https://bsky.app/profile/username.bsky.social/post/rkey"
            )
        raise HTTPException(
            status_code=400,
            detail=error_msg,
        )

    # 1) Try our local database first
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM posts WHERE uri = $1", at_uri)

    if row:
        data = dict(row)
        return {"post": data}

    # 2) Fallback to fetching directly from Bluesky
    bluesky_post = await _fetch_post_from_bluesky(at_uri)
    if not bluesky_post:
        raise HTTPException(
            status_code=404,
            detail="Post not found in database or via Bluesky API",
        )

    return {"post": bluesky_post}
