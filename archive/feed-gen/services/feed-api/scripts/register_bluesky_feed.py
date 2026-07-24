#!/usr/bin/env python3
"""
Create an app.bsky.feed.generator record on the account that OWNS the feed on Bluesky.

Prerequisites:
  - feed-api reachable at PUBLIC_BASE_URL over HTTPS
  - PUBLIC_BASE_URL set on the server so /.well-known/did.json works
  - This script knows DATABASE_URL and feed row (name, id)

Environment:
  DATABASE_URL       PostgreSQL URL (same as feed-api)
  PUBLIC_BASE_URL    Same as feed-api PUBLIC_BASE_URL (https://your-domain.com, no trailing slash)
  PUBLISH_IDENTIFIER Default publisher account handle or DID (recommended service account, e.g. @Branch)
  PUBLISH_APP_PASSWORD App password for service publisher account
  BSKY_IDENTIFIER    Optional override (advanced: publish with user account)
  BSKY_APP_PASSWORD  Optional override app password (advanced)

Usage:
  python scripts/register_bluesky_feed.py <feed_uuid>

The generator record rkey is the feed UUID with hyphens removed (32 hex chars), so the
feed URI becomes: at://<your-did>/app.bsky.feed.generator/<32hex>
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

import asyncpg
import httpx

BSKY_HOST = os.getenv("BSKY_PDS", "https://bsky.social")


def _service_did(public_base: str) -> str:
    parsed = urlparse(public_base.strip().rstrip("/"))
    host = parsed.hostname
    if not host:
        raise SystemExit(f"Invalid PUBLIC_BASE_URL: {public_base!r}")
    return f"did:web:{host.lower()}"


def _truncate(s: str, n: int) -> str:
    s = (s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


async def main() -> None:
    parser = argparse.ArgumentParser(description="Register Bluesky feed generator record")
    parser.add_argument("feed_id", help="Feed UUID from database")
    args = parser.parse_args()

    database_url = os.getenv("DATABASE_URL")
    public_base = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")
    ident = (
        os.getenv("BSKY_IDENTIFIER", "").strip()
        or os.getenv("PUBLISH_IDENTIFIER", "").strip()
    )
    password = os.getenv("BSKY_APP_PASSWORD", "") or os.getenv("PUBLISH_APP_PASSWORD", "")

    if not database_url:
        sys.exit("DATABASE_URL is required")
    if not public_base:
        sys.exit("PUBLIC_BASE_URL is required (e.g. https://feeds.example.com)")
    if not ident or not password:
        sys.exit(
            "Set publisher credentials: PUBLISH_IDENTIFIER + PUBLISH_APP_PASSWORD "
            "(or advanced override BSKY_IDENTIFIER + BSKY_APP_PASSWORD)."
        )

    feed_uuid = args.feed_id.strip()
    rkey = feed_uuid.replace("-", "")
    if len(rkey) != 32:
        sys.exit("feed_id must be a UUID")

    conn = await asyncpg.connect(database_url)
    try:
        row = await conn.fetchrow(
            """
            SELECT id::text, name, COALESCE(description, '') AS description
            FROM feeds
            WHERE id = $1::uuid
            """,
            feed_uuid,
        )
        if not row:
            sys.exit(f"No feed with id {feed_uuid}")
        name = row["name"]
        desc = row["description"] or ""
    finally:
        await conn.close()

    service_did = _service_did(public_base)
    display = _truncate(name, 24)
    description = _truncate(desc, 300) or None
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    record: dict = {
        "$type": "app.bsky.feed.generator",
        "did": service_did,
        "displayName": display,
        "createdAt": created_at,
    }
    if description:
        record["description"] = description

    uri = None
    async with httpx.AsyncClient(timeout=60.0) as client:
        sess = await client.post(
            f"{BSKY_HOST}/xrpc/com.atproto.server.createSession",
            json={"identifier": ident, "password": password},
        )
        if sess.status_code != 200:
            sys.exit(f"Login failed: {sess.status_code} {sess.text}")
        session = sess.json()
        access = session.get("accessJwt")
        repo_did = session.get("did")
        if not access or not repo_did:
            sys.exit("Session response missing accessJwt or did")

        put = await client.post(
            f"{BSKY_HOST}/xrpc/com.atproto.repo.createRecord",
            headers={"Authorization": f"Bearer {access}"},
            json={
                "repo": repo_did,
                "collection": "app.bsky.feed.generator",
                "rkey": rkey,
                "record": record,
            },
        )
        if put.status_code != 200:
            sys.exit(f"createRecord failed: {put.status_code} {put.text}")
        out = put.json()
        uri = out.get("uri")
        print("OK — generator record created.")
        print(f"  URI: {uri}")
        print(f"  Feed skeleton last segment / rkey: {rkey}")
        print("  Test: open Bluesky → Feeds → paste this feed URI (or search your feed name).")

    # Persist URI on feed row
    if uri:
        conn = await asyncpg.connect(database_url)
        try:
            await conn.execute(
                "UPDATE feeds SET bluesky_feed_uri = $1, updated_at = NOW() WHERE id = $2::uuid",
                uri,
                feed_uuid,
            )
            print("  Stored bluesky_feed_uri on feeds row.")
        finally:
            await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
