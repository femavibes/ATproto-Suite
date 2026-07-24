from __future__ import annotations

import asyncio
from typing import Dict, List
from urllib.parse import quote_plus

import httpx

from config import (
    BSKY_PUBLIC_HOST,
    ENGAGEMENT_REFRESH_BATCH_SIZE,
    ENGAGEMENT_REFRESH_POLL_SECONDS,
    ENGAGEMENT_REFRESH_STALE_MINUTES,
)
from database import (
    close_db,
    fetch_posts_for_engagement_refresh,
    get_db,
    update_post_engagement_counters,
)


def _build_get_posts_url(uris: List[str]) -> str:
    query = "&".join(f"uris={quote_plus(uri)}" for uri in uris)
    return f"{BSKY_PUBLIC_HOST}/xrpc/app.bsky.feed.getPosts?{query}"


async def _fetch_engagement_batch(uris: List[str]) -> Dict[str, Dict[str, int]]:
    if not uris:
        return {}
    url = _build_get_posts_url(uris)
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    out: Dict[str, Dict[str, int]] = {}
    for post in data.get("posts", []) or []:
        uri = str(post.get("uri") or "").strip()
        if not uri:
            continue
        out[uri] = {
            "like_count": int(post.get("likeCount") or 0),
            "reply_count": int(post.get("replyCount") or 0),
            "repost_count": int(post.get("repostCount") or 0),
            "quote_count": int(post.get("quoteCount") or 0),
            "bookmark_count": 0,
        }
    return out


async def run_once() -> Dict[str, int]:
    stats = {"candidates": 0, "updated": 0, "missing": 0, "errors": 0}
    pool = await get_db()
    async with pool.acquire() as conn:
        candidates = await fetch_posts_for_engagement_refresh(
            conn, ENGAGEMENT_REFRESH_BATCH_SIZE, ENGAGEMENT_REFRESH_STALE_MINUTES
        )
        stats["candidates"] = len(candidates)
        if not candidates:
            return stats

        uris = [str(r["uri"]) for r in candidates if str(r.get("uri") or "").strip()]
        try:
            fetched = await _fetch_engagement_batch(uris)
        except Exception:
            stats["errors"] += len(uris)
            return stats

        for uri in uris:
            counters = fetched.get(uri)
            if not counters:
                stats["missing"] += 1
                continue
            try:
                await update_post_engagement_counters(
                    conn,
                    uri,
                    counters["like_count"],
                    counters["reply_count"],
                    counters["repost_count"],
                    counters["quote_count"],
                    counters["bookmark_count"],
                )
                stats["updated"] += 1
            except Exception:
                stats["errors"] += 1
    return stats


async def run_forever() -> None:
    print("engagement-refresh-worker started")
    try:
        while True:
            stats = await run_once()
            print(
                "engagement refresh: "
                f"candidates={stats['candidates']} updated={stats['updated']} "
                f"missing={stats['missing']} errors={stats['errors']}"
            )
            await asyncio.sleep(ENGAGEMENT_REFRESH_POLL_SECONDS)
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(run_forever())
