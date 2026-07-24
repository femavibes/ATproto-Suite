"""Build ATProto-shaped post dict for assignment graph evaluation."""

from __future__ import annotations

from typing import Any, Dict


def canonical_post_payload(post_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Canonical ATProto-first payload for evaluator:
    - prefer record_json fields (text, langs, embed, facets, reply, createdAt, etc.)
    - merge posts.post_type / reply_parent / reply_root when record_json omits `reply`
    - keep DB identifiers/metadata (cid, uri, author_did) for joins/writes
    """
    record = post_dict.get("record_json")
    canonical: Dict[str, Any] = dict(record) if isinstance(record, dict) else {}
    canonical.setdefault("text", post_dict.get("text"))
    canonical.setdefault("langs", post_dict.get("langs") or [])
    canonical.setdefault("createdAt", post_dict.get("created_at"))
    canonical["cid"] = post_dict.get("cid")
    canonical["uri"] = post_dict.get("uri")
    canonical["author_did"] = post_dict.get("author_did")
    pt = post_dict.get("post_type")
    if isinstance(pt, str) and pt.strip():
        canonical["post_type"] = pt.strip().lower()
    if not canonical.get("reply"):
        rp = post_dict.get("reply_parent")
        rr = post_dict.get("reply_root")
        if rp or rr:
            reply_blk: Dict[str, Any] = {}
            if rp:
                reply_blk["parent"] = {"uri": str(rp)}
            if rr:
                reply_blk["root"] = {"uri": str(rr)}
            canonical["reply"] = reply_blk
    canonical["like_count"] = post_dict.get("like_count", 0)
    canonical["reply_count"] = post_dict.get("reply_count", 0)
    canonical["repost_count"] = post_dict.get("repost_count", 0)
    canonical["quote_count"] = post_dict.get("quote_count", 0)
    canonical["bookmark_count"] = post_dict.get("bookmark_count", 0)
    # Backfill facets/tags from flat DB columns when record_json doesn't provide them.
    # The evaluator checks post["facets"][*]["features"][*]["tag"] and post["tags"][*].
    if not canonical.get("facets"):
        db_facet_tags = post_dict.get("facet_tags") or []
        if db_facet_tags:
            canonical["facets"] = [
                {"features": [{"$type": "app.bsky.richtext.facet#tag", "tag": t}]}
                for t in db_facet_tags
            ]
    if not canonical.get("tags"):
        db_outline_tags = post_dict.get("outline_tags") or []
        if db_outline_tags:
            canonical["tags"] = list(db_outline_tags)
    return canonical
