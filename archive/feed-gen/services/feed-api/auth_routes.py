"""Login session endpoints (cookie) after Bluesky OAuth in the browser."""

from __future__ import annotations

import time
import jwt
import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from atproto_token import verify_atproto_access_token
from auth_policy import owner_lock_allows_did, owner_lock_allows_handle
from auth_deps import SESSION_COOKIE, get_session_did_from_request
from config import FORCE_SECURE_COOKIES, SESSION_COOKIE_MAX_AGE, SESSION_SECRET

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SessionCreate(BaseModel):
    accessJwt: str = Field(min_length=10)
    tokenType: str = "DPoP"


class AllowlistCheckRequest(BaseModel):
    handle: str = Field(min_length=1, max_length=253)


def _issue_session_cookie(response: Response, did: str, access_jwt: str) -> None:
    token = jwt.encode(
        {
            "sub": did,
            "access_jwt": access_jwt,
            "exp": int(time.time()) + SESSION_COOKIE_MAX_AGE,
        },
        SESSION_SECRET,
        algorithm="HS256",
    )
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=FORCE_SECURE_COOKIES,
        samesite="lax",
        max_age=SESSION_COOKIE_MAX_AGE,
        path="/",
    )


@router.post("/session")
async def create_session(body: SessionCreate, response: Response):
    did = await verify_atproto_access_token(body.accessJwt, body.tokenType)
    if not did:
        raise HTTPException(
            status_code=401,
            detail="Invalid Bluesky access token (session verify failed). Try signing in again.",
        )
    if not await owner_lock_allows_did(did):
        raise HTTPException(
            status_code=403,
            detail="This beta instance is restricted to the configured owner handle.",
        )
    _issue_session_cookie(response, did, body.accessJwt)
    return {"did": did}


@router.post("/allowlist-check")
async def allowlist_check(body: AllowlistCheckRequest):
    handle = body.handle.strip().lstrip("@").lower()
    allowed = await owner_lock_allows_handle(handle)
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="This deployment only allows approved handles to sign in.",
        )
    return {"ok": True, "handle": handle}


@router.get("/me")
async def me(request: Request):
    did = get_session_did_from_request(request)
    if not did:
        raise HTTPException(status_code=401, detail="Not logged in")
    profile = {"did": did, "handle": None, "avatar": None}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile",
                params={"actor": did},
            )
            if r.status_code == 200:
                data = r.json() or {}
                profile["handle"] = data.get("handle")
                profile["avatar"] = data.get("avatar")
    except Exception:
        # Best-effort enrich; never fail /me when profile lookup has issues.
        pass
    return profile


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}
