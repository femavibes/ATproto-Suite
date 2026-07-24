"""Condition evaluator parity layer (Python, v1)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re
from typing import Any, Dict, List
from urllib.parse import urlparse
import math

CONDITION_TYPES = {
    "text", "regex", "language", "posttype", "hashtag", "labels", "dateage",
    "author", "media", "engagement", "poststructure", "mentions", "links",
    "image", "video", "quotepost", "recency", "engagementscore", "customscore",
}


def is_condition_type(node_type: str) -> bool:
    return node_type in CONDITION_TYPES


def evaluate_condition(node: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    node_type = node.get("type")
    data = node.get("data", {}) or {}
    fn = {
        "text": eval_text, "regex": eval_regex, "language": eval_language,
        "posttype": eval_posttype, "author": eval_author, "media": eval_media,
        "hashtag": eval_hashtag, "labels": eval_labels, "dateage": eval_dateage,
        "engagement": eval_engagement, "poststructure": eval_poststructure,
        "mentions": eval_mentions, "links": eval_links, "image": eval_image,
        "video": eval_video, "quotepost": eval_quotepost, "recency": eval_recency,
        "engagementscore": eval_engagementscore, "customscore": eval_customscore,
    }.get(node_type)
    if not fn:
        return {"passed": True, "reason": "Unknown condition type (always passes)", "scoreModifier": 0}
    result = fn(data, post)
    result.setdefault("scoreModifier", 0)
    return result


def _score(data: Dict[str, Any], passed: bool) -> float:
    # Condition-node score modifiers are deprecated; scoring nodes own scoring.
    return 0.0


def _compare(value: float, op: str, threshold: float) -> bool:
    return {
        "greater_than": value > threshold,
        "greater_equal": value >= threshold,
        "equal": value == threshold,
        "less_equal": value <= threshold,
        "less_than": value < threshold,
    }.get(op, False)


def _get_field(post: Dict[str, Any], field_path: str) -> Any:
    value: Any = post
    for part in str(field_path).split("."):
        if value is None:
            return None
        value = value.get(part) if isinstance(value, dict) else None
    return value


def _extract_field_values(root: Any, field_path: str) -> List[str]:
    """
    Extract all non-empty string values from a field path that may contain
    ``[*]`` wildcard segments, e.g.:
      "text"                          -> [post["text"]]
      "embed.images[*].alt"           -> alt text from every image
      "facets[*].features[*].tag"     -> every hashtag from every facet
      "tags[*]"                       -> every outline tag

    Non-wildcard paths fall through identically to _get_field.
    """
    segments = field_path.split(".")
    current: List[Any] = [root]

    for seg in segments:
        if seg.endswith("[*]"):
            key = seg[:-3]
            nxt: List[Any] = []
            for node in current:
                if isinstance(node, dict):
                    val = node.get(key)
                    if isinstance(val, list):
                        nxt.extend(val)
                    elif val is not None:
                        nxt.append(val)
            current = nxt
        else:
            nxt = []
            for node in current:
                if isinstance(node, dict):
                    val = node.get(seg)
                    if val is not None:
                        nxt.append(val)
            current = nxt

    out: List[str] = []
    for v in current:
        if isinstance(v, str):
            if v:
                out.append(v)
        elif v is not None and not isinstance(v, (dict, list)):
            s = str(v)
            if s:
                out.append(s)
    return out


def _post_langs(post: Dict[str, Any]) -> List[str]:
    langs = post.get("langs") or []
    return [str(pl).lower() for pl in langs if str(pl).strip()]


def _post_embed(post: Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(post.get("embed"), dict):
        return post["embed"]
    return {}


def _post_type(post: Dict[str, Any]) -> str:
    # Prefer denormalized classification when present (assignment worker merges DB columns).
    explicit = post.get("post_type")
    if isinstance(explicit, str):
        e = explicit.strip().lower()
        if e in ("post", "reply", "quote"):
            return e
    if post.get("reply"):
        return "reply"
    embed = post.get("embed") if isinstance(post.get("embed"), dict) else {}
    if embed.get("$type") in ("app.bsky.embed.record", "app.bsky.embed.recordWithMedia"):
        return "quote"
    return "post"


def _post_created_at(post: Dict[str, Any]) -> Any:
    return post.get("createdAt")


def _parse_post_datetime(created: Any) -> datetime | None:
    if not created:
        return None
    try:
        dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def eval_text(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    raw_keywords = data.get("keywords", [])
    keywords: List[Dict[str, Any]] = []
    for kw in raw_keywords:
        if isinstance(kw, str):
            t = kw.strip()
            if t:
                keywords.append({"value": t.lower(), "wholeWord": False})
        elif isinstance(kw, dict):
            t = str(kw.get("value") or "").strip()
            if t:
                keywords.append({"value": t.lower(), "wholeWord": bool(kw.get("wholeWord"))})
    fields = data.get("fields", ["text"])
    exclude = bool(data.get("exclude"))
    if not keywords:
        return {"passed": True, "reason": "No keywords configured (always passes)", "scoreModifier": 0}
    found = False
    for f in fields:
        for field_raw in _extract_field_values(post, f):
            field_l = field_raw.lower()
            for kw in keywords:
                k = kw["value"]
                if kw["wholeWord"]:
                    if re.search(rf"\b{re.escape(k)}\b", field_raw, flags=re.IGNORECASE):
                        found = True
                        break
                elif k in field_l:
                    found = True
                    break
            if found:
                break
        if found:
            break
    passed = (not found) if exclude else found
    return {"passed": passed, "reason": "Keyword match" if found else "No keyword match", "scoreModifier": _score(data, passed)}


def eval_regex(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    pattern = data.get("pattern") or ""
    fields = data.get("fields", ["text"])
    exclude = bool(data.get("exclude"))
    flags = re.I if "i" in str(data.get("flags", "i")) else 0
    if not pattern:
        return {"passed": True, "reason": "No regex pattern configured (always passes)", "scoreModifier": 0}
    try:
        rx = re.compile(pattern, flags)
    except re.error as exc:
        return {"passed": False, "reason": f"Invalid regex pattern: {exc}", "scoreModifier": 0}
    found = any(rx.search(v) for f in fields for v in _extract_field_values(post, f))
    passed = (not found) if exclude else found
    return {"passed": passed, "reason": "Regex match" if found else "Regex not found", "scoreModifier": _score(data, passed)}


def eval_language(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    langs = data.get("languages", [])
    exclude = bool(data.get("exclude"))
    if not langs:
        return {"passed": True, "reason": "No languages configured (always passes)", "scoreModifier": 0}
    post_langs = _post_langs(post)
    post_langs = [str(pl).lower() for pl in post_langs if str(pl).strip()]
    langs = [str(l).lower() for l in langs if str(l).strip()]
    match = any(any(pl == l or str(pl).startswith(f"{l}-") for pl in post_langs) for l in langs)
    passed = (not match) if exclude else match
    return {"passed": passed, "reason": "Language matched" if match else "Language not matched", "scoreModifier": _score(data, passed)}


def eval_posttype(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    types = data.get("types", [])
    exclude = bool(data.get("exclude"))
    if not types:
        return {"passed": True, "reason": "No post types configured (always passes)", "scoreModifier": 0}
    ptype = _post_type(post)
    match = ptype in types
    passed = (not match) if exclude else match
    return {"passed": passed, "reason": "Post type matched" if match else "Post type not matched", "scoreModifier": _score(data, passed)}


def eval_author(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    authors = [str(a).strip().lower() for a in (data.get("authors", []) or []) if str(a).strip()]
    exclude = bool(data.get("exclude"))
    list_uris = data.get("listUris", []) or []
    if not authors and not list_uris:
        return {"passed": True, "reason": "No authors configured (always passes)", "scoreModifier": 0}
    post_author = str(post.get("author_did", "")).strip().lower()
    matched_direct = post_author in set(authors)
    resolved = post.get("__resolved_list_members") or {}
    list_dids = set()
    if isinstance(resolved, dict):
        for uri in list_uris:
            members = resolved.get(uri)
            if isinstance(members, (list, set, tuple)):
                list_dids.update(str(x).strip().lower() for x in members if str(x).strip())
    matched_list = bool(post_author and post_author in list_dids)
    match = matched_direct or matched_list
    passed = (not match) if exclude else match
    details = f"(direct={matched_direct}, list={matched_list})"
    return {
        "passed": passed,
        "reason": f"{'Author matched' if match else 'Author not matched'} {details}",
        "scoreModifier": _score(data, passed),
    }


def eval_media(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    types = set(data.get("types", []))
    exclude = bool(data.get("exclude"))
    if not types:
        return {"passed": True, "reason": "No media types configured (always passes)", "scoreModifier": 0}
    actual = "none"
    embed = _post_embed(post)
    embed_type = embed.get("$type", "")
    # For recordWithMedia, the actual media lives under embed.media
    media = embed.get("media") or {} if isinstance(embed.get("media"), dict) else {}
    media_type = media.get("$type", "")
    if post.get("has_images") or embed_type == "app.bsky.embed.images" or media_type == "app.bsky.embed.images":
        actual = "images"
    elif post.get("has_video") or embed_type == "app.bsky.embed.video" or media_type == "app.bsky.embed.video":
        # Distinguish GIFs from regular video (embed.presentation === "gif")
        video_embed = embed if embed_type == "app.bsky.embed.video" else media
        is_gif = (embed.get("presentation") == "gif" or video_embed.get("presentation") == "gif"
                  or (video_embed.get("video") or {}).get("presentation") == "gif")
        actual = "gif" if is_gif else "video"
    elif post.get("has_link") or embed_type == "app.bsky.embed.external" or media_type == "app.bsky.embed.external":
        actual = "link"
    elif _post_type(post) == "quote":
        actual = "quote"
    # "video" type in the filter matches both video and gif unless "gif" is explicitly selected
    match = actual in types or (actual == "gif" and "video" in types and "gif" not in types)
    passed = (not match) if exclude else match
    return {"passed": passed, "reason": f"Media type: {actual}", "scoreModifier": _score(data, passed)}


def eval_hashtag(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    tags = set(data.get("tags", []))
    exclude = bool(data.get("exclude"))
    if not tags:
        return {"passed": True, "reason": "No tags configured (always passes)", "scoreModifier": 0}
    post_tags = set(post.get("tags") or [])
    match = bool(tags.intersection(post_tags))
    if not match:
        for facet in post.get("facets", []) or []:
            for feat in facet.get("features", []) or []:
                if feat.get("tag") in tags:
                    match = True
                    break
    passed = (not match) if exclude else match
    return {"passed": passed, "reason": "Tag matched" if match else "Tag not matched", "scoreModifier": _score(data, passed)}


def eval_labels(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    labels = set(data.get("labels", []))
    exclude = bool(data.get("exclude"))
    if not labels:
        return {"passed": True, "reason": "No labels configured (always passes)", "scoreModifier": 0}
    post_labels = {l.get("val") for l in ((post.get("labels") or {}).get("values") or [])}
    match = bool(labels.intersection(post_labels))
    passed = (not match) if exclude else match
    return {"passed": passed, "reason": "Label matched" if match else "Label not matched", "scoreModifier": _score(data, passed)}


def eval_dateage(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    created = _post_created_at(post)
    if not created:
        return {"passed": False, "reason": "Post has no createdAt date", "scoreModifier": 0}
    mode = data.get("mode", "newer_than")
    value = data.get("value", {}) or {}
    amount = int(value.get("amount", 24))
    unit = value.get("unit", "hours")
    post_dt = _parse_post_datetime(created)
    if post_dt is None:
        return {"passed": False, "reason": "Invalid createdAt date", "scoreModifier": 0}
    delta = {"minutes": timedelta(minutes=amount), "hours": timedelta(hours=amount), "days": timedelta(days=amount), "weeks": timedelta(weeks=amount)}.get(unit, timedelta(hours=amount))
    threshold = datetime.now(timezone.utc) - delta
    passed = post_dt > threshold if mode == "newer_than" else post_dt < threshold
    return {"passed": passed, "reason": f"Date mode {mode}", "scoreModifier": _score(data, passed)}


def eval_engagement(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    metric = data.get("metricType", "likes")
    op = data.get("operator", "greater_than")
    threshold = float(data.get("threshold", 0))
    value = float(post.get(f"{metric[:-1]}_count", post.get(metric, 0)) if metric.endswith("s") else post.get(metric, 0))
    passed = _compare(value, op, threshold)
    if data.get("exclude"):
        passed = not passed
    return {"passed": passed, "reason": f"Engagement {metric}={value}", "scoreModifier": _score(data, passed)}


def eval_poststructure(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    structure = data.get("structureType", "is_reply")
    reply_parent = ((post.get("reply") or {}).get("parent") or {}).get("uri")
    reply_root = ((post.get("reply") or {}).get("root") or {}).get("uri")
    embed_type = (post.get("embed") or {}).get("$type", "")
    if structure == "is_reply":
        passed = bool(reply_parent or reply_root)
    elif structure == "is_quote":
        passed = embed_type in ("app.bsky.embed.record", "app.bsky.embed.recordWithMedia")
    elif structure == "has_quote":
        record = (post.get("embed") or {}).get("record") or {}
        passed = bool(record.get("uri") or (record.get("record") or {}).get("uri"))
    else:
        passed = False
    return {"passed": passed, "reason": f"Structure {structure}", "scoreModifier": _score(data, passed)}


def eval_mentions(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    mentions = {str(m).strip().lower() for m in data.get("mentions", []) if str(m).strip()}
    exclude = bool(data.get("exclude"))
    list_uris = data.get("listUris", []) or []
    resolved = post.get("__resolved_list_members") or {}
    list_dids = set()
    if isinstance(resolved, dict):
        for uri in list_uris:
            members = resolved.get(uri)
            if isinstance(members, (list, set, tuple)):
                list_dids.update(str(x).strip().lower() for x in members if str(x).strip())
    if not mentions and not list_uris:
        return {"passed": True, "reason": "No mentions configured (always passes)", "scoreModifier": 0}
    found = False
    found_mention = None
    for facet in post.get("facets", []) or []:
        for feat in facet.get("features", []) or []:
            if feat.get("$type") != "#mention":
                continue
            did = str(feat.get("did") or "").strip().lower()
            handle = str(feat.get("handle") or feat.get("displayHandle") or "").strip().lower()
            matched_direct = (did and did in mentions) or (handle and handle in mentions)
            matched_list = bool(did and did in list_dids)
            if matched_direct or matched_list:
                found = True
                found_mention = did or handle
                break
    passed = (not found) if exclude else found
    if found:
        reason = f"Mention matched ({found_mention})"
    else:
        reason = "Mention not matched"
    if list_uris:
        reason = f"{reason}; listUris resolved_members={len(list_dids)}"
    return {"passed": passed, "reason": reason, "scoreModifier": _score(data, passed)}


def _url_host(value: str) -> str:
    if not value:
        return ""
    text = value if value.startswith("http") else f"https://{value}"
    try:
        return (urlparse(text).hostname or "").removeprefix("www.")
    except ValueError:
        return ""


def eval_quotepost(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    """Match posts that quote a specific post URI or any post by a specific author DID."""
    uris = [str(u) for u in (data.get("uris") or [])]
    dids = [str(d) for d in (data.get("dids") or [])]
    exclude = bool(data.get("exclude"))
    if not uris and not dids:
        return {"passed": True, "reason": "No quote targets configured (always passes)", "scoreModifier": 0}

    embed = post.get("embed") or {}
    record = embed.get("record") or {}
    # recordWithMedia nests the quoted record one level deeper
    if "record" in record and isinstance(record.get("record"), dict):
        quoted_uri = record["record"].get("uri") or record.get("uri") or ""
    else:
        quoted_uri = record.get("uri") or ""

    if not quoted_uri:
        passed = True if exclude else False
        return {"passed": passed, "reason": "Post has no quote embed", "scoreModifier": 0}

    match = quoted_uri in uris if uris else False
    if not match and dids:
        # AT-URI format: at://DID/collection/rkey
        parts = quoted_uri.split("/")
        if len(parts) >= 3 and parts[0] == "at:":
            quoted_did = parts[2]
            match = quoted_did in dids

    passed = (not match) if exclude else match
    return {"passed": passed, "reason": f"Quoted post {'matched' if match else 'not matched'}", "scoreModifier": 0}


def eval_links(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    urls = [str(u) for u in data.get("urls", [])]
    exclude = bool(data.get("exclude"))
    require_thumbnail = bool(data.get("requireThumbnail"))

    embed = post.get("embed") or {}
    external = embed.get("external") or (embed.get("media") or {}).get("external") or {}

    if not urls and not require_thumbnail:
        return {"passed": True, "reason": "No URLs configured (always passes)", "scoreModifier": 0}

    # Thumbnail check (independent of URL matching when no URLs configured)
    if require_thumbnail and not urls:
        has_thumb = bool(external.get("thumb"))
        passed = (not has_thumb) if exclude else has_thumb
        return {"passed": passed, "reason": "Link card has thumbnail" if has_thumb else "Link card has no thumbnail", "scoreModifier": _score(data, passed)}

    candidates: List[str] = []
    for facet in post.get("facets", []) or []:
        for feat in facet.get("features", []) or []:
            if feat.get("$type") == "#link" and feat.get("uri"):
                candidates.append(str(feat["uri"]))
    external_uri = external.get("uri")
    if external_uri:
        candidates.append(str(external_uri))

    hosts = {_url_host(c) for c in candidates}
    query_hosts = {_url_host(u) for u in urls}
    found = bool(hosts.intersection(query_hosts))
    if not found:
        found = any(any(u in c or c in u for u in urls) for c in candidates)

    if found and require_thumbnail:
        has_thumb = bool(external.get("thumb"))
        if not has_thumb:
            found = False

    passed = (not found) if exclude else found
    return {"passed": passed, "reason": "Link matched" if found else "Link not matched", "scoreModifier": _score(data, passed)}


def eval_image(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    embed = post.get("embed") or {}
    # recordWithMedia: images are under embed.media.images, not embed.images
    media = embed.get("media") or {} if isinstance(embed.get("media"), dict) else {}
    images = embed.get("images") or media.get("images") or []
    exclude = bool(data.get("exclude"))
    count = data.get("imageCount")
    has = len(images) > 0
    if not has:
        passed = True if exclude else False
        return {"passed": passed, "reason": "Post has no images", "scoreModifier": 0}
    if count is not None and len(images) != count:
        passed = True if exclude else False
        return {"passed": passed, "reason": f"Image count {len(images)} != {count}", "scoreModifier": 0}
    passed = True if not exclude else False
    return {"passed": passed, "reason": "Image criteria matched", "scoreModifier": _score(data, passed)}


def eval_video(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    embed = post.get("embed") or {}
    # recordWithMedia: video is under embed.media.video, not embed.video
    media = embed.get("media") or {} if isinstance(embed.get("media"), dict) else {}
    video = embed.get("video") or media.get("video") or None
    exclude = bool(data.get("exclude"))
    has = bool(video)
    if not has:
        passed = True if exclude else False
        return {"passed": passed, "reason": "Post has no video", "scoreModifier": 0}

    # Check presentation type (GIF vs regular video)
    presentation = data.get("presentation") or "any"
    if presentation and presentation != "any":
        actual_presentation = (embed.get("presentation") or (video or {}).get("presentation") or "video")
        if presentation == "gif" and actual_presentation != "gif":
            passed = True if exclude else False
            return {"passed": passed, "reason": f"Video is not a GIF (is: {actual_presentation})", "scoreModifier": 0}
        if presentation == "video" and actual_presentation == "gif":
            passed = True if exclude else False
            return {"passed": passed, "reason": "Video is a GIF (not regular video)", "scoreModifier": 0}

    passed = True if not exclude else False
    return {"passed": passed, "reason": "Video criteria matched", "scoreModifier": _score(data, passed)}


def _engagement_value(post: Dict[str, Any], key: str) -> float:
    # Accept multiple payload styles (canonical future columns + debug aliases)
    return float(
        post.get(key)
        or post.get(key.replace("_count", "s"))
        or ((post.get("engagement") or {}).get(key))
        or 0
    )


def eval_customscore(data: Dict[str, Any], _post: Dict[str, Any]) -> Dict[str, Any]:
    score = float(data.get("score") or 0)
    return {"passed": True, "reason": f"Custom score applied: {score}", "scoreModifier": score}


def eval_engagementscore(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    lw = float(data.get("likeWeight", 1) or 0)
    rw = float(data.get("replyWeight", 2) or 0)
    repw = float(data.get("repostWeight", 3) or 0)
    qw = float(data.get("quoteWeight", 4) or 0)
    bw = float(data.get("bookmarkWeight", 1) or 0)
    likes = _engagement_value(post, "like_count")
    replies = _engagement_value(post, "reply_count")
    reposts = _engagement_value(post, "repost_count")
    quotes = _engagement_value(post, "quote_count")
    bookmarks = _engagement_value(post, "bookmark_count")
    score = (likes * lw) + (replies * rw) + (reposts * repw) + (quotes * qw) + (bookmarks * bw)
    return {"passed": True, "reason": f"Engagement score applied: {score}", "scoreModifier": score}


def eval_recency(data: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    created = _post_created_at(post)
    if not created:
        return {"passed": True, "reason": "Recency skipped (missing createdAt)", "scoreModifier": 0}
    post_dt = _parse_post_datetime(created)
    if post_dt is None:
        return {"passed": True, "reason": "Recency skipped (invalid createdAt)", "scoreModifier": 0}

    decay_hours = max(float(data.get("decayHours", 24) or 24), 0.1)
    max_boost = float(data.get("maxBoost", 100) or 0)
    age_hours = max((datetime.now(timezone.utc) - post_dt).total_seconds() / 3600.0, 0.0)
    score = max_boost * math.pow(0.5, age_hours / decay_hours)
    return {"passed": True, "reason": f"Recency score applied: {score:.2f}", "scoreModifier": score}
