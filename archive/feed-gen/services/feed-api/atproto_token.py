"""Verify AT Protocol OAuth access tokens against Bluesky endpoints."""

from __future__ import annotations

import base64
import time
import json
from typing import Any, Dict, Optional

import httpx

# Default AppView / PDS hosts.
BSKY_APPVIEW = "https://bsky.social"
PUBLIC_APPVIEW = "https://public.api.bsky.app"


def _decode_jwt_payload_unverified(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        pad = "=" * (4 - len(payload_b64) % 4)
        raw = base64.urlsafe_b64decode((payload_b64 + pad).encode("ascii"))
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return None


async def verify_atproto_access_token(
    access_token: str, token_type: str = "DPoP"
) -> Optional[str]:
    """
    Returns the account DID if the token works for app.bsky.actor.getProfile on bsky.social.

    AT Protocol OAuth uses DPoP-bound access tokens (Authorization: DPoP <jwt>), not Bearer.
    """
    payload = _decode_jwt_payload_unverified(access_token)
    if not payload:
        return None
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub.startswith("did:"):
        return None

    exp = payload.get("exp")
    if isinstance(exp, (int, float)) and int(exp) < int(time.time()) - 30:
        return None

    ordered: list[str] = []
    for s in (token_type, "DPoP", "Bearer", "dpop", "bearer"):
        if s not in ordered:
            ordered.append(s)

    async with httpx.AsyncClient(timeout=20.0) as client:
        for scheme in ordered:
            # Most reliable for access token verification.
            r = await client.get(
                f"{BSKY_APPVIEW}/xrpc/com.atproto.server.getSession",
                headers={"Authorization": f"{scheme} {access_token}"},
            )
            if r.status_code == 200:
                data = r.json()
                did = data.get("did")
                if did == sub:
                    return did

            # Fallback: profile checks on both appview hosts.
            for host in (BSKY_APPVIEW, PUBLIC_APPVIEW):
                pr = await client.get(
                    f"{host}/xrpc/app.bsky.actor.getProfile",
                    headers={"Authorization": f"{scheme} {access_token}"},
                    params={"actor": sub},
                )
                if pr.status_code != 200:
                    continue
                pdata = pr.json()
                did = pdata.get("did")
                if did == sub:
                    return did
        return None
