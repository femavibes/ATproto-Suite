"""Session cookie auth (after Bluesky OAuth token verification)."""

from __future__ import annotations

from typing import Annotated, Optional

import jwt
from fastapi import Depends, HTTPException, Request

from config import SESSION_SECRET


SESSION_COOKIE = "feedgen_session"


def _decode_session(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SESSION_SECRET, algorithms=["HS256"])
        did = payload.get("sub")
        access_jwt = payload.get("access_jwt")
        if isinstance(did, str) and did.startswith("did:"):
            return {
                "did": did,
                "access_jwt": access_jwt if isinstance(access_jwt, str) else None,
            }
    except jwt.PyJWTError:
        return None
    return None


def get_session_did_from_request(request: Request) -> Optional[str]:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    payload = _decode_session(token)
    if not payload:
        return None
    return payload.get("did")


def get_session_access_jwt_from_request(request: Request) -> Optional[str]:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    payload = _decode_session(token)
    if not payload:
        return None
    value = payload.get("access_jwt")
    return value if isinstance(value, str) and value.strip() else None


async def require_user(request: Request) -> str:
    did = get_session_did_from_request(request)
    if not did:
        raise HTTPException(status_code=401, detail="Authentication required")
    return did


CurrentUser = Annotated[str, Depends(require_user)]
