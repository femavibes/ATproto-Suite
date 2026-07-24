"""Host DID document for did:web feed service (required for Bluesky custom feeds)."""

from __future__ import annotations

import json
from urllib.parse import urlparse

from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse

from config import PUBLIC_BASE_URL

router = APIRouter(tags=["well-known"])


def _hostname_from_public_url(url: str) -> str | None:
    if not url or not url.strip():
        return None
    parsed = urlparse(url.strip())
    host = parsed.hostname
    if not host:
        return None
    return host.lower()


def _did_web_for_host(hostname: str) -> str:
    # did:web uses dot-separated labels; punycode for IDNA (hostname may already be ASCII)
    return f"did:web:{hostname}"


@router.get("/.well-known/did.json")
async def did_web_document():
    """
    Serves DID document for did:web:<host> so Bluesky can resolve the feed generator service.

    Set PUBLIC_BASE_URL (e.g. https://feeds.example.com) to the public HTTPS origin of this API.
    """
    if not PUBLIC_BASE_URL:
        return JSONResponse(
            status_code=503,
            content={
                "error": "PUBLIC_BASE_URL is not configured",
                "hint": "Set PUBLIC_BASE_URL to your public HTTPS origin (e.g. https://feeds.example.com)",
            },
        )

    hostname = _hostname_from_public_url(PUBLIC_BASE_URL)
    if not hostname:
        return JSONResponse(
            status_code=503,
            content={"error": "Could not parse hostname from PUBLIC_BASE_URL"},
        )

    # No path/query in did:web host part — only host
    base = PUBLIC_BASE_URL.strip().rstrip("/")
    did_id = _did_web_for_host(hostname)

    doc = {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/suites/ed25519-2020/v1",
        ],
        "id": did_id,
        "service": [
            {
                "id": "#bsky_fg",
                "type": "BskyFeedGenerator",
                "serviceEndpoint": base,
            }
        ],
    }
    return Response(
        content=json.dumps(doc, indent=2),
        media_type="application/did+json",
    )
