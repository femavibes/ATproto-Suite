from __future__ import annotations

from typing import Dict, List, Set, Tuple

import httpx

from config import BSKY_PUBLIC_HOST


def _parse_at_uri(uri: str) -> Tuple[str, str, str]:
    # at://did:plc:xyz/app.bsky.graph.list/abc
    u = str(uri or "").strip()
    if not u.startswith("at://"):
        return "", "", ""
    parts = u[len("at://") :].split("/")
    if len(parts) < 3:
        return "", "", ""
    return parts[0], parts[1], parts[2]


async def _fetch_list_members(client: httpx.AsyncClient, list_uri: str) -> Tuple[Set[str], Dict[str, str]]:
    dids: Set[str] = set()
    did_to_handle: Dict[str, str] = {}
    cursor = None
    while True:
        params = {"list": list_uri, "limit": 100}
        if cursor:
            params["cursor"] = cursor
        resp = await client.get(f"{BSKY_PUBLIC_HOST}/xrpc/app.bsky.graph.getList", params=params)
        resp.raise_for_status()
        data = resp.json()
        for item in data.get("items", []) or []:
            subject = item.get("subject") or {}
            did = str(subject.get("did") or "").strip()
            if not did:
                continue
            dids.add(did)
            handle = str(subject.get("handle") or "").strip()
            if handle:
                did_to_handle[did] = handle
        cursor = data.get("cursor")
        if not cursor:
            break
    return dids, did_to_handle


async def resolve_list_uri_members(list_uri: str) -> Tuple[Set[str], Dict[str, str], str]:
    """
    Resolve members for list-like URIs.
    Supports:
    - app.bsky.graph.list (direct list members)
    - app.bsky.graph.starterpack (expands embedded list when present)
    """
    repo, collection, _rkey = _parse_at_uri(list_uri)
    if not repo or not collection:
        return set(), {}, "invalid_uri"

    async with httpx.AsyncClient(timeout=20.0) as client:
        if collection == "app.bsky.graph.list":
            dids, did_to_handle = await _fetch_list_members(client, list_uri)
            return dids, did_to_handle, "list"

        if collection == "app.bsky.graph.starterpack":
            # Best-effort starter-pack expansion.
            resp = await client.get(
                f"{BSKY_PUBLIC_HOST}/xrpc/app.bsky.graph.getStarterPack",
                params={"starterPack": list_uri},
            )
            resp.raise_for_status()
            data = resp.json()
            out_dids: Set[str] = set()
            did_to_handle: Dict[str, str] = {}

            # Some responses include sampled users.
            for user in data.get("listItemsSample", []) or []:
                did = str((user or {}).get("did") or "").strip()
                if not did:
                    continue
                out_dids.add(did)
                handle = str((user or {}).get("handle") or "").strip()
                if handle:
                    did_to_handle[did] = handle

            # Expand full list if record points to one.
            list_ref = (((data.get("starterPack") or {}).get("record") or {}).get("list"))
            if isinstance(list_ref, str) and list_ref.startswith("at://"):
                dids, handles = await _fetch_list_members(client, list_ref)
                out_dids.update(dids)
                did_to_handle.update(handles)

            return out_dids, did_to_handle, "starterpack"

    return set(), {}, "unsupported"
