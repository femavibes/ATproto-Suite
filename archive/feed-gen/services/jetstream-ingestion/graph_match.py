"""
Optional ingestion gate: run the same graph engine as feed-assignment-worker (strict / short-circuit).
If enabled, a post is indexed only when it passes at least one live feed graph (any END).

Limitations vs assignment sweep: list-based author/mention resolution may be empty unless you
align with assignment's list cache; engagement counters are typically zero at ingest time.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(_ROOT / "assign_mirror"))

from langdetect import LangDetectException, detect  # noqa: E402

from engine import evaluate_graph_multi_end  # noqa: E402
from post_payload import canonical_post_payload  # noqa: E402

GraphBundle = Tuple[str, List[Dict[str, Any]], List[Dict[str, Any]]]


def augment_post_row_for_graph_eval(post_row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Jetstream commits often omit `langs` on the record. Graphs with a Language filter would
    then fail every post (see eval_language / _post_langs). The pre-graph-ingestion path used
    langdetect when Bluesky did not provide langs — mirror that here so the gate matches
    assignment on stored posts (which have langs populated).
    """
    out = dict(post_row)
    langs = out.get("langs")
    if isinstance(langs, list) and any(str(x).strip() for x in langs):
        return out
    record = out.get("record_json")
    if isinstance(record, dict):
        rl = record.get("langs")
        if isinstance(rl, list) and any(str(x).strip() for x in rl):
            return out
    text = (out.get("text") or "").strip()
    if not text:
        return out
    try:
        code = str(detect(text)).lower().split("-", 1)[0]
        if not code:
            return out
        merged = [code]
        out["langs"] = merged
        out["language"] = merged[0]
        if isinstance(out.get("record_json"), dict):
            rj = dict(out["record_json"])
            rj["langs"] = merged
            out["record_json"] = rj
    except (LangDetectException, ValueError, TypeError):
        pass
    except Exception:
        pass
    return out


def pick_parseable_graph_rules(live: Any, draft: Any, legacy: Any) -> Optional[Dict[str, Any]]:
    """
    Prefer live, then draft, then legacy — but skip blobs that are not visual graphs.

    Feeds often still have legacy assignment_rules = {"logic","groups"} while the real
    graph lives only in assignment_rules_draft until the user promotes. Using COALESCE(live, rules)
    alone would never read the draft.
    """
    for raw in (live, draft, legacy):
        if raw is None:
            continue
        g = _parse_graph(raw)
        if g:
            return g
    return None


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
    if not isinstance(nodes, list) or not isinstance(edges, list):
        return None
    normalized_nodes: List[Dict[str, Any]] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        n = dict(node)
        cfg = n.get("config")
        data = n.get("data")
        if isinstance(cfg, dict) and not isinstance(data, dict):
            n["data"] = dict(cfg)
        elif isinstance(cfg, dict) and isinstance(data, dict):
            merged = dict(cfg)
            merged.update(data)
            n["data"] = merged
        normalized_nodes.append(n)
    return {"nodes": normalized_nodes, "edges": edges}


_INGEST_SKIP_TYPES = frozenset({"engagement", "engagementscore"})


def _strip_ingest_unavailable_nodes(
    nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Remove node types that are meaningless at ingest time so they don't
    accidentally block posts.

    engagement / engagementscore: metrics are always 0 on a fresh post, so
    "likes >= 1" in a filter path would silently reject everything.  These
    nodes always pass in the assignment worker (which has real counts); mirror
    that by dropping them from the ingest graph so their logic edges are also
    gone and the junction ignores them.
    """
    skip_ids = {n["id"] for n in nodes if n.get("type") in _INGEST_SKIP_TYPES}
    if not skip_ids:
        return nodes, edges
    filtered_nodes = [n for n in nodes if n["id"] not in skip_ids]
    filtered_edges = [
        e for e in edges
        if e.get("source") not in skip_ids and e.get("target") not in skip_ids
    ]
    return filtered_nodes, filtered_edges


def post_matches_any_graph(
    post_row: Dict[str, Any],
    graphs: List[GraphBundle],
    resolved_members: Optional[Dict[str, Any]] = None,
) -> bool:
    """Return True if the post passes at least one END on any graph."""
    if not graphs:
        # Gate is on but nothing to match — do not index the whole firehose.
        return False
    canonical = canonical_post_payload(post_row)
    canonical["__resolved_list_members"] = resolved_members or {}
    for _feed_id, nodes, edges in graphs:
        nodes, edges = _strip_ingest_unavailable_nodes(nodes, edges)
        try:
            per = evaluate_graph_multi_end(nodes, edges, canonical, full_trace=False)
        except Exception as ex:
            print(f"graph_match: evaluate_graph_multi_end failed for feed {_feed_id}: {ex!r}")
            continue
        for _end_id, result in per.items():
            if result.passed:
                return True
    return False


class FeedGraphCache:
    """Reload feed graphs from DB on a TTL."""

    def __init__(self, ttl_seconds: float = 60.0) -> None:
        self.ttl_seconds = ttl_seconds
        self._graphs: List[GraphBundle] = []
        self._resolved_members: Dict[str, Any] = {}
        self._loaded_at: float = 0.0
        self._ever_loaded: bool = False

    def stale(self) -> bool:
        if not self._ever_loaded:
            return True
        return (time.monotonic() - self._loaded_at) > self.ttl_seconds

    def set_graphs(
        self,
        graphs: List[GraphBundle],
        resolved_members: Optional[Dict[str, Any]] = None,
    ) -> None:
        self._graphs = graphs
        self._resolved_members = resolved_members or {}
        self._loaded_at = time.monotonic()
        self._ever_loaded = True

    @property
    def graphs(self) -> List[GraphBundle]:
        return self._graphs

    @property
    def resolved_members(self) -> Dict[str, Any]:
        return self._resolved_members
