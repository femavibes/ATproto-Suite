"""Auth policy helpers (beta owner lock)."""

from __future__ import annotations

import time
from typing import Optional

import httpx

from config import ALLOWED_HANDLES, OWNER_HANDLE

_OWNER_DID_CACHE: Optional[str] = None
_OWNER_DID_CACHE_AT: float = 0
_ALLOWED_DIDS_CACHE: set[str] = set()
_ALLOWED_DIDS_CACHE_AT: float = 0


async def resolve_handle_to_did(handle: str) -> Optional[str]:
    h = (handle or "").strip().lstrip("@")
    if not h:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                "https://bsky.social/xrpc/com.atproto.identity.resolveHandle",
                params={"handle": h},
            )
            if r.status_code != 200:
                return None
            return (r.json() or {}).get("did")
    except Exception:
        return None


async def owner_lock_allows_did(did: str) -> bool:
    """
    If no whitelist handles are configured, allow all.
    If configured, only allow DIDs resolved from those handles.
    """
    allow_handles = list(ALLOWED_HANDLES)
    if OWNER_HANDLE and OWNER_HANDLE not in allow_handles:
        allow_handles.append(OWNER_HANDLE)
    if not allow_handles:
        return True

    # Backward-compatible single-handle cache behavior.
    if len(allow_handles) == 1:
        global _OWNER_DID_CACHE, _OWNER_DID_CACHE_AT
        now = time.time()
        if _OWNER_DID_CACHE and (now - _OWNER_DID_CACHE_AT) < 300:
            return did == _OWNER_DID_CACHE
        resolved = await resolve_handle_to_did(allow_handles[0])
        if resolved:
            _OWNER_DID_CACHE = resolved
            _OWNER_DID_CACHE_AT = now
            return did == resolved
        return False

    global _ALLOWED_DIDS_CACHE, _ALLOWED_DIDS_CACHE_AT
    now = time.time()
    if _ALLOWED_DIDS_CACHE and (now - _ALLOWED_DIDS_CACHE_AT) < 300:
        return did in _ALLOWED_DIDS_CACHE

    resolved_dids: set[str] = set()
    for handle in allow_handles:
        resolved = await resolve_handle_to_did(handle)
        if resolved:
            resolved_dids.add(resolved)

    if resolved_dids:
        _ALLOWED_DIDS_CACHE = resolved_dids
        _ALLOWED_DIDS_CACHE_AT = now
        return did in resolved_dids
    return False


async def owner_lock_allows_handle(handle: str) -> bool:
    """
    Check whether a handle is allowed by resolving it to DID first.
    """
    resolved = await resolve_handle_to_did(handle)
    if not resolved:
        return False
    return await owner_lock_allows_did(resolved)
