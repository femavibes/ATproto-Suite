"""OAuth client metadata for AT Protocol (browser client)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from config import APP_PUBLIC_ORIGIN

router = APIRouter(tags=["oauth"])


@router.get("/oauth/client-metadata.json")
async def oauth_client_metadata():
    if not APP_PUBLIC_ORIGIN:
        raise HTTPException(
            status_code=503,
            detail="APP_PUBLIC_ORIGIN is not set (public origin of this app, e.g. https://feeds.example.com)",
        )
    origin = APP_PUBLIC_ORIGIN.rstrip("/")
    cid = f"{origin}/oauth/client-metadata.json"
    return {
        "client_id": cid,
        "client_name": "Feed Rule Builder",
        "client_uri": origin,
        "redirect_uris": [f"{origin}/"],
        "scope": "atproto repo:app.bsky.feed.generator transition:generic",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none",
        "application_type": "web",
        "dpop_bound_access_tokens": True,
    }
