"""Feed assignment worker loop (initial engine wiring)."""

from __future__ import annotations

import asyncio
import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple

from config import ASSIGNMENT_BATCH_SIZE, ASSIGNMENT_POLL_SECONDS
from engine import evaluate_graph_multi_end
from engine import extract_end_pipeline_contract
from prefilter_hints import (
    PrefilterHints,
    extract_jetstream_prefilter_hints,
    post_passes_prefilter,
)
from list_resolver import resolve_list_uri_members
from config import LIST_CACHE_TTL_SECONDS
from post_payload import canonical_post_payload


def _parse_graph(assignment_rules: Any) -> Optional[Dict[str, Any]]:
    if isinstance(assignment_rules, str):
        try:
            assignment_rules = json.loads(assignment_rules)
        except Exception:
            return None
    if not isinstance(assignment_rules, dict):
        return None
    nodes = assignment_rules.get("nodes")
    edges = assignment_rules.get("edges")
    if isinstance(nodes, list) and isinstance(edges, list):
        normalized_nodes: list[Dict[str, Any]] = []
        for node in nodes:
            if not isinstance(node, dict):
                continue
            n = dict(node)
            cfg = n.get("config")
            data = n.get("data")
            # Visual-editor persistence stores node settings under `config`.
            # Engine expects them under `data`.
            if isinstance(cfg, dict) and not isinstance(data, dict):
                n["data"] = dict(cfg)
            elif isinstance(cfg, dict) and isinstance(data, dict):
                merged = dict(cfg)
                merged.update(data)
                n["data"] = merged
            normalized_nodes.append(n)
        return {"nodes": normalized_nodes, "edges": edges}
    return None


def _extract_end_feed_map(nodes: list[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    """Map only top-level END ids to feedId. Inner ENDs inside Group/AND/OR/N-OF have
    data.containerParent set; they are not separate feed outputs (matches visual editor)."""
    mapping: Dict[str, Optional[str]] = {}
    for node in nodes:
        if node.get("type") != "end":
            continue
        data = node.get("data") or {}
        if data.get("containerParent"):
            continue
        end_id = str(node.get("id"))
        feed_id = data.get("feedId")
        mapping[end_id] = str(feed_id) if feed_id else None
    return mapping


def _validate_end_mapping(
    root_feed_id: str, end_feed_map: Dict[str, Optional[str]]
) -> Tuple[bool, Optional[str], Dict[str, str]]:
    """Strict mapping policy:
    - Single-END graph: fallback to root feed id if feedId missing.
    - Multi-END graph: every END must declare data.feedId.
    """
    end_ids = list(end_feed_map.keys())
    if not end_ids:
        return False, "No END nodes found in graph", {}
    if len(end_ids) == 1:
        only = end_ids[0]
        return True, None, {only: end_feed_map[only] or root_feed_id}

    missing = [end_id for end_id, feed_id in end_feed_map.items() if not feed_id]
    if missing:
        return (
            False,
            f"Multi-END graph requires end.data.feedId for every END; missing: {', '.join(missing)}",
            {},
        )
    return True, None, {end_id: feed_id for end_id, feed_id in end_feed_map.items() if feed_id}


def _graph_digest(nodes: list[Dict[str, Any]], edges: list[Dict[str, Any]]) -> str:
    canonical = json.dumps(
        {"nodes": nodes, "edges": edges},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _hints_to_payload(hints: PrefilterHints, graph_digest: str) -> Dict[str, Any]:
    return {
        "version": 1,
        "graphDigest": graph_digest,
        "ok": hints.ok,
        "reason": hints.reason,
        "jetstreamSeedId": hints.jetstream_seed_id,
        "keywordStems": hints.keyword_stems,
        "languageCodes": hints.language_codes,
        "unsafeToDropForKeywordGate": hints.unsafe_to_drop_for_keyword_gate,
        "unsafeToDropForLanguageGate": hints.unsafe_to_drop_for_language_gate,
        "notes": hints.notes,
    }


def _hints_from_payload(payload: Dict[str, Any]) -> Optional[PrefilterHints]:
    if not isinstance(payload, dict):
        return None
    if not isinstance(payload.get("ok"), bool):
        return None
    return PrefilterHints(
        ok=bool(payload.get("ok")),
        reason=payload.get("reason"),
        jetstream_seed_id=payload.get("jetstreamSeedId"),
        keyword_stems=[str(x) for x in payload.get("keywordStems", [])],
        language_codes=[str(x) for x in payload.get("languageCodes", [])],
        unsafe_to_drop_for_keyword_gate=bool(
            payload.get("unsafeToDropForKeywordGate", True)
        ),
        unsafe_to_drop_for_language_gate=bool(
            payload.get("unsafeToDropForLanguageGate", True)
        ),
        notes=[str(x) for x in payload.get("notes", [])],
    )


def _extract_list_uris(nodes: list[Dict[str, Any]]) -> list[str]:
    uris: set[str] = set()
    for node in nodes:
        data = node.get("data") or {}
        if not isinstance(data, dict):
            continue
        node_type = str(node.get("type") or "")
        if node_type not in {"author", "mentions"}:
            continue
        for uri in (data.get("listUris") or []):
            text = str(uri or "").strip()
            if text.startswith("at://"):
                uris.add(text)
    return sorted(uris)


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _normalize_range(start_value: Any, end_value: Any) -> Tuple[int, int]:
    start = max(_safe_int(start_value, 0), 0)
    end = _safe_int(end_value, start)
    if end < start:
        end = start
    return start, end


def _extract_static_pinned_items(config: Dict[str, Any]) -> List[Tuple[str, int]]:
    items: List[Tuple[str, int]] = []
    raw_items = config.get("items")
    if isinstance(raw_items, list):
        for idx, entry in enumerate(raw_items):
            if isinstance(entry, dict):
                uri = str(entry.get("uri") or entry.get("postUri") or "").strip()
                priority = _safe_int(entry.get("priority"), idx + 1)
            else:
                uri = str(entry or "").strip()
                priority = idx + 1
            if uri:
                items.append((uri, max(priority, 1)))

    raw_urls = config.get("postUrls")
    if isinstance(raw_urls, list):
        for idx, uri in enumerate(raw_urls):
            text = str(uri or "").strip()
            if text:
                items.append((text, idx + 1))

    raw_posts = config.get("posts")
    if isinstance(raw_posts, list):
        for idx, entry in enumerate(raw_posts):
            if isinstance(entry, dict):
                uri = str(entry.get("uri") or entry.get("postUri") or "").strip()
                priority = _safe_int(entry.get("priority"), idx + 1)
            else:
                uri = str(entry or "").strip()
                priority = idx + 1
            if uri:
                items.append((uri, max(priority, 1)))

    single = str(config.get("postUri") or config.get("uri") or "").strip()
    if single:
        items.append((single, 1))

    return items


def _engagement_value(row: Dict[str, Any]) -> int:
    return (
        _safe_int(row.get("like_count"), 0)
        + _safe_int(row.get("reply_count"), 0)
        + _safe_int(row.get("repost_count"), 0)
        + _safe_int(row.get("quote_count"), 0)
        + _safe_int(row.get("bookmark_count"), 0)
    )


def _deterministic_random_key(node_id: str, post_cid: str) -> str:
    return hashlib.sha256(f"{node_id}:{post_cid}".encode("utf-8")).hexdigest()


async def _apply_fixed_pins_for_feed(
    conn,
    feed_id: str,
    fixed_nodes: List[Dict[str, Any]],
) -> None:
    from database import (
        clear_feed_pinned_posts,
        fetch_feed_ranked_posts,
        resolve_post_cids_by_uri,
        upsert_feed_pinned_post,
    )

    ranked_rows = [dict(r) for r in await fetch_feed_ranked_posts(conn, feed_id)]
    by_cid = {str(r["post_cid"]): r for r in ranked_rows}

    collected: List[Tuple[str, str]] = []  # (post_cid, post_uri)

    static_uri_candidates: List[Tuple[str, int, int]] = []  # uri, node_order, local_priority
    for node_order, fixed_node in enumerate(fixed_nodes):
        node_type = str(fixed_node.get("type") or "")
        config = fixed_node.get("config") or {}
        node_id = str(fixed_node.get("id") or f"fixed-{node_order}")

        if node_type in {"pinnedposts", "dynamicpinned", "featuredpost"}:
            for uri, local_priority in _extract_static_pinned_items(config):
                static_uri_candidates.append((uri, node_order, local_priority))
            continue

        start_pos, end_pos = _normalize_range(
            config.get("startPosition"),
            config.get("endPosition"),
        )
        if not ranked_rows:
            continue

        candidates = list(ranked_rows)
        if node_type == "fixedbyscore":
            candidates.sort(
                key=lambda r: (
                    -_safe_int(r.get("base_score"), 0),
                    str(r.get("assigned_at") or ""),
                    str(r.get("post_cid") or ""),
                )
            )
        elif node_type == "fixedmostlikes":
            candidates.sort(
                key=lambda r: (
                    -_safe_int(r.get("like_count"), 0),
                    -_safe_int(r.get("base_score"), 0),
                    str(r.get("post_cid") or ""),
                )
            )
        elif node_type == "fixedmostengagement":
            candidates.sort(
                key=lambda r: (
                    -_engagement_value(r),
                    -_safe_int(r.get("base_score"), 0),
                    str(r.get("post_cid") or ""),
                )
            )
        elif node_type == "fixedchronological":
            newest_first = str(config.get("order") or "newest").lower() != "oldest"
            candidates.sort(
                key=lambda r: (
                    str(r.get("created_at") or ""),
                    str(r.get("post_cid") or ""),
                ),
                reverse=newest_first,
            )
        elif node_type == "fixedrandom":
            candidates.sort(
                key=lambda r: _deterministic_random_key(
                    node_id,
                    str(r.get("post_cid") or ""),
                )
            )
        else:
            continue

        end_idx = min(end_pos, len(candidates) - 1)
        if start_pos > end_idx:
            continue
        window = candidates[start_pos : end_idx + 1]
        for row in window:
            cid = str(row.get("post_cid") or "").strip()
            uri = str(row.get("uri") or "").strip()
            if cid and uri:
                collected.append((cid, uri))

    if static_uri_candidates:
        static_uri_candidates.sort(key=lambda x: (x[1], x[2], x[0]))
        uris = [u for (u, _, _) in static_uri_candidates]
        uri_to_cid = await resolve_post_cids_by_uri(conn, uris)
        for uri, _, _ in static_uri_candidates:
            cid = uri_to_cid.get(uri)
            if cid:
                collected.append((cid, uri))

    deduped: List[Tuple[str, str]] = []
    seen: set[str] = set()
    for cid, uri in collected:
        if cid in seen:
            continue
        seen.add(cid)
        deduped.append((cid, uri))

    await clear_feed_pinned_posts(conn, feed_id)
    for idx, (cid, uri) in enumerate(deduped):
        await upsert_feed_pinned_post(conn, feed_id, cid, uri, idx)


async def run_once() -> Dict[str, int]:
    from database import (
        clear_feed_posts,
        fetch_candidate_posts_for_feed,
        fetch_feeds_with_graph,
        get_db,
        get_cached_list_members,
        list_cache_needs_refresh,
        replace_external_list_members,
        upsert_feed_prefilter_hints,
        upsert_feed_post,
    )

    stats = {
        "feeds": 0,
        "posts": 0,
        "assignments": 0,
        "errors": 0,
        "skipped_feeds": 0,
        "prefilter_dropped": 0,
        "prefilter_cache_updates": 0,
    }
    pool = await get_db()
    async with pool.acquire() as conn:
        feeds = await fetch_feeds_with_graph(conn)
        stats["feeds"] = len(feeds)
        stats["posts"] = 0

        for feed in feeds:
            graph = None
            for raw in (
                feed.get("assignment_rules_live"),
                feed.get("assignment_rules_draft"),
                feed.get("assignment_rules_legacy"),
            ):
                graph = _parse_graph(raw)
                if graph:
                    break
            if not graph:
                continue
            nodes = graph["nodes"]
            edges = graph["edges"]
            root_feed_id = str(feed["id"])
            end_feed_map = _extract_end_feed_map(nodes)
            valid, mapping_error, target_by_end = _validate_end_mapping(
                root_feed_id, end_feed_map
            )
            if not valid:
                stats["skipped_feeds"] += 1
                print(f"skip feed {root_feed_id}: {mapping_error}")
                continue

            node_index_by_id = {str(n.get("id")): i for i, n in enumerate(nodes)}
            fixed_nodes_by_target_feed: Dict[str, List[Dict[str, Any]]] = {}
            for end_id, target_feed_id in target_by_end.items():
                if not target_feed_id:
                    continue
                pipeline = extract_end_pipeline_contract(nodes, edges, end_id)
                fixed_list = pipeline.get("fixed") or []
                end_rank = node_index_by_id.get(end_id, 0)
                for fixed_node in fixed_list:
                    fixed_nodes_by_target_feed.setdefault(target_feed_id, []).append(
                        {
                            **fixed_node,
                            "__end_rank": end_rank,
                            "__slot_rank": _safe_int((fixed_node.get("slot") or {}).get("fixed"), 0),
                        }
                    )

            graph_digest = _graph_digest(nodes, edges)
            cached_payload = feed.get("prefilter_hints")
            cached_digest = (
                cached_payload.get("graphDigest")
                if isinstance(cached_payload, dict)
                else None
            )
            hints = (
                _hints_from_payload(cached_payload)
                if isinstance(cached_payload, dict) and cached_digest == graph_digest
                else None
            )
            if hints is None:
                hints = extract_jetstream_prefilter_hints(nodes, edges)
                payload = _hints_to_payload(hints, graph_digest)
                await upsert_feed_prefilter_hints(
                    conn,
                    root_feed_id,
                    payload,
                )
                stats["prefilter_cache_updates"] += 1
            else:
                payload = cached_payload if isinstance(cached_payload, dict) else _hints_to_payload(hints, graph_digest)

            posts = await fetch_candidate_posts_for_feed(
                conn,
                ASSIGNMENT_BATCH_SIZE,
                payload,
            )
            list_uris = _extract_list_uris(nodes)
            for list_uri in list_uris:
                try:
                    if await list_cache_needs_refresh(conn, list_uri, LIST_CACHE_TTL_SECONDS):
                        member_dids, did_to_handle, source_type = await resolve_list_uri_members(list_uri)
                        await replace_external_list_members(
                            conn,
                            list_uri,
                            member_dids,
                            did_to_handle,
                            source_type,
                            None,
                        )
                except Exception as exc:
                    await replace_external_list_members(
                        conn,
                        list_uri,
                        set(),
                        {},
                        "error",
                        str(exc),
                    )
            resolved_members = await get_cached_list_members(conn, list_uris)

            # Rebuild assignment set each sweep to prevent stale rows from
            # previous logic versions from lingering in feed_posts.
            await clear_feed_posts(conn, root_feed_id)
            feed_sql_candidates = len(posts)
            feed_prefilter_dropped = 0
            feed_evaluated = 0
            feed_assigned = 0
            stats["posts"] += len(posts)
            for post in posts:
                post_row = dict(post)
                if not post_passes_prefilter(post_row, hints):
                    stats["prefilter_dropped"] += 1
                    feed_prefilter_dropped += 1
                    continue
                try:
                    feed_evaluated += 1
                    canonical_post = canonical_post_payload(post_row)
                    canonical_post["__resolved_list_members"] = {
                        k: sorted(v) for k, v in resolved_members.items()
                    }
                    per_end = evaluate_graph_multi_end(nodes, edges, canonical_post)
                    for end_id, end_result in per_end.items():
                        if not end_result.passed:
                            continue
                        target_feed_id = target_by_end.get(end_id)
                        if not target_feed_id:
                            continue
                        await upsert_feed_post(
                            conn,
                            target_feed_id,
                            post_row["cid"],
                            end_result.score,
                        )
                        stats["assignments"] += 1
                        feed_assigned += 1
                except Exception:
                    stats["errors"] += 1
            print(
                f"feed {root_feed_id}: sql_candidates={feed_sql_candidates} "
                f"prefilter_dropped={feed_prefilter_dropped} "
                f"evaluated={feed_evaluated} assigned={feed_assigned}"
            )
            for target_feed_id, fixed_nodes in fixed_nodes_by_target_feed.items():
                ordered = sorted(
                    fixed_nodes,
                    key=lambda n: (
                        _safe_int(n.get("__end_rank"), 0),
                        _safe_int(n.get("__slot_rank"), 0),
                        str(n.get("id") or ""),
                    ),
                )
                await _apply_fixed_pins_for_feed(conn, target_feed_id, ordered)
    return stats


async def run_forever() -> None:
    from database import close_db

    print("feed-assignment-worker started")
    try:
        while True:
            stats = await run_once()
            print(
                f"assignment sweep: feeds={stats['feeds']} posts={stats['posts']} "
                f"assignments={stats['assignments']} errors={stats['errors']} "
                f"skipped_feeds={stats['skipped_feeds']} "
                f"prefilter_dropped={stats['prefilter_dropped']} "
                f"prefilter_cache_updates={stats['prefilter_cache_updates']}"
            )
            await asyncio.sleep(ASSIGNMENT_POLL_SECONDS)
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(run_forever())
