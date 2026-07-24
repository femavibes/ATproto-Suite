"""Assignment engine v1 (Python).

Authoritative goal: mirror visual-editor graph semantics for Stage 2 assignment:
- flow path (entry -> END)
- junction/container logic (AND/OR/N-OF on each port)
- condition node evaluation

This first pass adds multi-END support so one shared graph can output multiple feeds.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple

from condition_eval import evaluate_condition, is_condition_type
from evaluation_cost import condition_cost_rank

# Nodes that may be chosen as the flow entry for the current node list (root graph or subgraph).
FLOW_ENTRY_CANDIDATE_TYPES = frozenset({"start", "manualposts", "containerin"})
CONTAINER_TYPES = {"junction", "logicgroup", "and", "or", "nof"}
LOGIC_BOX_TYPE = "logicbox"
SORT_CONTAINER_TYPES = CONTAINER_TYPES | {LOGIC_BOX_TYPE}
FLOW_TERMINAL_TYPES = frozenset({"end", "containerout"})
PORTS = ("top", "bottom", "left", "right")


@dataclass
class EngineResult:
    passed: bool
    score: float
    results: Dict[str, Dict[str, Any]]
    pipeline: Dict[str, Any]
    error: Optional[str] = None


def evaluate_graph_multi_end(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    post: Dict[str, Any],
    *,
    full_trace: bool = False,
) -> Dict[str, EngineResult]:
    """Evaluate graph once for each END node.

    Returns map: {end_node_id: EngineResult}

    full_trace: If True, evaluate all spine/junction children and run fill_missing for debug.
        If False (default, assignment), short-circuit on first hard failure and skip off-path fill.
    """
    end_ids = [n["id"] for n in nodes if n.get("type") in FLOW_TERMINAL_TYPES]
    if not end_ids:
        return {
            "__global__": EngineResult(
                passed=False,
                score=0,
                results={},
                pipeline={},
                error="Graph must have at least one END or OUT node",
            )
        }

    out: Dict[str, EngineResult] = {}
    for end_id in end_ids:
        out[end_id] = evaluate_graph_for_end(
            nodes, edges, post, end_id, full_trace=full_trace
        )
    return out


def evaluate_graph_for_end(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    post: Dict[str, Any],
    end_id: str,
    *,
    full_trace: bool = False,
) -> EngineResult:
    node_by_id = {n["id"]: n for n in nodes}
    if end_id not in node_by_id or str(node_by_id[end_id].get("type") or "") not in FLOW_TERMINAL_TYPES:
        return EngineResult(False, 0, {}, {}, f"Flow terminal not found: {end_id}")

    entry = pick_flow_entry_node(nodes, post)
    if not entry:
        return EngineResult(
            False,
            0,
            {},
            {},
            "No applicable flow entry (START or matching Manual Posts URI)",
        )

    flow_path = trace_flow_path(entry["id"], end_id, edges)
    if not flow_path:
        return EngineResult(False, 0, {}, {}, "No flow path from entry to END")

    results: Dict[str, Dict[str, Any]] = {}
    total_score = 0.0
    # Scoring semantics decision (2026-04):
    # For the upcoming "dedicated scoring nodes" model, score should be applied
    # once per scoring node id even if graph merges could revisit equivalent paths.
    # This avoids accidental score inflation from topology artifacts.
    # NOTE: this is a product decision and may be changed later; keep documented.
    overall_passed = True

    for node_id in flow_path:
        node = node_by_id.get(node_id)
        if not node:
            continue
        node_type = node.get("type")
        if node_type in ("start", "containerin", "manualposts", "end", "containerout", "videofeed"):
            results[node_id] = {"passed": True, "reason": "Flow anchor"}
            continue

        if node_type == LOGIC_BOX_TYPE:
            box_result = evaluate_logic_box(
                node, nodes, edges, post, results, full_trace=full_trace
            )
            results[node_id] = box_result
            total_score += float(box_result.get("score") or 0)
            if not box_result.get("passed"):
                overall_passed = False
                if not full_trace:
                    break
            continue

        if node_type in CONTAINER_TYPES:
            junction_result = evaluate_junction(
                node, nodes, edges, post, results, full_trace=full_trace
            )
            results[node_id] = junction_result
            total_score += float(junction_result.get("score") or 0)
            if not junction_result.get("passed"):
                overall_passed = False
                if not full_trace:
                    break
            continue

        if is_condition_type(node_type):
            cond = evaluate_condition(node, post)
            results[node_id] = cond
            if cond["passed"]:
                total_score += float(cond.get("scoreModifier") or 0)
            else:
                overall_passed = False
                if not full_trace:
                    break

    if full_trace:
        fill_missing_condition_evaluations(nodes, post, results)
    pipeline = extract_end_pipeline_contract(nodes, edges, end_id)
    return EngineResult(overall_passed, total_score, results, pipeline, None)


def _is_flow_edge_loose(e: Dict[str, Any]) -> bool:
    """Match strict React Flow handles or sparse exports (type \"flow\" / missing handles)."""
    if e.get("sourceHandle") == "output-right" and e.get("targetHandle") == "input-left":
        return True
    if str(e.get("type") or "").lower() == "flow":
        return True
    if not e.get("sourceHandle") and not e.get("targetHandle") and e.get("target"):
        return True
    return False


def _is_logic_edge(e: Dict[str, Any]) -> bool:
    """Return True for any edge that represents a logic (condition→junction or condition→condition) connection.

    The visual editor exports edges with ``type: "logic"`` and ``logic: "or"|"and"``.
    When saved to the database via the setup API the fields become ``logicType: "or"|"and"``
    with no ``type`` key.  Both formats must be accepted.
    """
    if str(e.get("type") or "").lower() == "logic":
        return True
    if e.get("logicType") is not None:
        return True
    if str(e.get("sourceHandle") or "").startswith("logic-"):
        return True
    return False


def _edge_logic_mode(e: Dict[str, Any]) -> str:
    """Return the AND/OR mode for a logic edge, accepting both ``logic`` and ``logicType`` keys."""
    return str(e.get("logic") or e.get("logicType") or "and").lower()


def _logic_edges_to_junction(junction_id: str, edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [e for e in edges if e.get("target") == junction_id and _is_logic_edge(e)]


def _infer_logic_port(edge: Dict[str, Any]) -> Optional[str]:
    th = str(edge.get("targetHandle") or "")
    if "logic-top" in th:
        return "top"
    if "logic-bottom" in th:
        return "bottom"
    if "logic-left" in th:
        return "left"
    if "logic-right" in th:
        return "right"
    return None


def _partition_junction_logic_edges(
    junction_id: str, edges: List[Dict[str, Any]]
) -> Dict[str, List[Dict[str, Any]]]:
    """Assign each logic edge to a port; unknown handle → top (matches editor loose exports)."""
    by_port: Dict[str, List[Dict[str, Any]]] = {p: [] for p in PORTS}
    for e in _logic_edges_to_junction(junction_id, edges):
        p = _infer_logic_port(e)
        key = p if p in by_port else "top"
        by_port[key].append(e)
    return by_port


def evaluate_condition_with_incoming_edges(
    child: Dict[str, Any],
    all_nodes: List[Dict[str, Any]],
    all_edges: List[Dict[str, Any]],
    post: Dict[str, Any],
    results: Dict[str, Dict[str, Any]],
    *,
    full_trace: bool = False,
) -> Dict[str, Any]:
    """Evaluate a condition plus any logic edges from other conditions (e.g. regex OR→text)."""
    node_by_id = {n["id"]: n for n in all_nodes}
    cid = child["id"]
    incoming = [
        e
        for e in all_edges
        if e.get("target") == cid
        and _is_logic_edge(e)
        and is_condition_type(str(node_by_id.get(e.get("source"), {}).get("type") or ""))
    ]
    intrinsic = evaluate_condition(child, post)
    if not incoming:
        results[cid] = intrinsic
        return intrinsic

    others: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []
    for e in incoming:
        src_id = e.get("source")
        src = node_by_id.get(src_id) if src_id else None
        if not src or not is_condition_type(str(src.get("type") or "")):
            continue
        others.append((e, src))
    others.sort(
        key=lambda t: (
            condition_cost_rank(str(t[1].get("type") or "")),
            str(t[1].get("id") or ""),
        )
    )

    combined = bool(intrinsic.get("passed"))
    and_or_others = [(e, src) for e, src in others if _edge_logic_mode(e) != "nof"]
    nof_others = [(e, src) for e, src in others if _edge_logic_mode(e) == "nof"]

    has_and_incoming = any(_edge_logic_mode(e) == "and" for e, _ in and_or_others)
    if not full_trace and combined and not has_and_incoming and not nof_others:
        results[cid] = intrinsic
        return intrinsic

    reasons: List[str] = [str(intrinsic.get("reason") or "")]

    # AND / OR edges
    for e, src in and_or_others:
        src_res = evaluate_condition(src, post)
        results[src["id"]] = src_res
        mode = _edge_logic_mode(e)
        sp = bool(src_res.get("passed"))
        if mode == "or":
            combined = combined or sp
        else:
            combined = combined and sp
        reasons.append(str(src_res.get("reason") or ""))
        if not full_trace and mode == "or" and combined:
            break
        if not full_trace and mode == "and" and not combined:
            break

    # N-of edges — group by port; passCount >= N → port passes; OR'd into combined (substitution)
    if nof_others:
        port_groups: Dict[str, Dict] = {}
        for e, src in nof_others:
            port = _infer_logic_port(e) or "top"
            if port not in port_groups:
                n_key = f"logicN{port.capitalize()}"
                data = child.get("data") or {}
                port_groups[port] = {"sources": [], "n": int(data.get(n_key) or 2)}
            port_groups[port]["sources"].append((e, src))
        for port, group in port_groups.items():
            pass_count = 0
            for _, src in group["sources"]:
                src_res = evaluate_condition(src, post)
                results[src["id"]] = src_res
                if src_res.get("passed"):
                    pass_count += 1
                reasons.append(str(src_res.get("reason") or ""))
            n = group["n"]
            nof_port_passed = pass_count >= n
            combined = combined or nof_port_passed
            reasons.append(f"N-OF({port}): {pass_count}/{len(group['sources'])} passed (need {n}) → {'PASS' if nof_port_passed else 'FAIL'}")

    out = {
        **intrinsic,
        "passed": combined,
        "reason": " | ".join(reasons) if combined else (intrinsic.get("reason") or "Condition failed"),
    }
    results[cid] = out
    return out


def _sort_port_edges_by_cost(
    port_edges: List[Dict[str, Any]], node_by_id: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    def key(e: Dict[str, Any]) -> Tuple[int, str]:
        sid = str(e.get("source") or "")
        child = node_by_id.get(sid)
        if not child:
            return (1, sid)
        ct = str(child.get("type") or "")
        if ct in SORT_CONTAINER_TYPES:
            return (1, sid)
        return (condition_cost_rank(ct), sid)

    return sorted(port_edges, key=key)


def evaluate_logic_box(
    box: Dict[str, Any],
    all_nodes: List[Dict[str, Any]],
    all_edges: List[Dict[str, Any]],
    post: Dict[str, Any],
    results: Dict[str, Dict[str, Any]],
    *,
    full_trace: bool = False,
) -> Dict[str, Any]:
    """Combine direct `containerParent` children with AND / OR / N-of (single on-canvas box)."""
    mode = str((box.get("data") or {}).get("logicContainerMode") or "and").lower()
    need_n = max(1, int((box.get("data") or {}).get("logicN") or 2))
    bid = box["id"]
    direct = [n for n in all_nodes if (n.get("data") or {}).get("containerParent") == bid]

    def sort_key(n: Dict[str, Any]) -> Tuple[int, str]:
        t = str(n.get("type") or "")
        if t == LOGIC_BOX_TYPE or t == "junction":
            return (1, n["id"])
        if t in ("recency", "engagementscore", "customscore"):
            return (2, n["id"])
        return (condition_cost_rank(t), n["id"])

    direct.sort(key=sort_key)
    child_results: List[Dict[str, Any]] = []
    total_score = 0.0

    for child in direct:
        ct = str(child.get("type") or "")
        if ct == LOGIC_BOX_TYPE:
            child_result = evaluate_logic_box(
                child, all_nodes, all_edges, post, results, full_trace=full_trace
            )
            results[child["id"]] = {
                "passed": child_result.get("passed"),
                "reason": child_result.get("reason"),
                "score": child_result.get("score"),
            }
        elif is_condition_type(ct):
            child_result = evaluate_condition_with_incoming_edges(
                child, all_nodes, all_edges, post, results, full_trace=full_trace
            )
        elif ct in ("recency", "engagementscore", "customscore"):
            child_result = evaluate_scoring_node(child, post)
            results[child["id"]] = child_result
        else:
            continue

        child_results.append(
            {"id": child["id"], "passed": bool(child_result.get("passed")), "result": child_result}
        )
        if child_result.get("passed"):
            total_score += float(
                child_result.get("scoreModifier") or child_result.get("score") or 0
            )

        if not full_trace:
            if mode == "and" and not child_result.get("passed"):
                break
            if mode == "or" and child_result.get("passed"):
                break
            if mode == "nof":
                pc = sum(1 for r in child_results if r.get("passed"))
                if pc >= need_n:
                    break

    pass_count = sum(1 for r in child_results if r.get("passed"))
    if not child_results:
        passed = True
        reason = "Logic box: no child filters (vacuous pass)"
    elif mode == "and":
        passed = pass_count == len(child_results)
        reason = f"AND: {pass_count}/{len(child_results)} passed"
    elif mode == "or":
        passed = pass_count > 0
        reason = f"OR: {pass_count}/{len(child_results)} passed"
    else:
        passed = pass_count >= need_n
        reason = f"N-OF: {pass_count}/{len(child_results)} passed (need {need_n})"

    return {"passed": passed, "reason": reason, "score": total_score, "childResults": child_results}


def evaluate_scoring_node(node: Dict[str, Any], post: Dict[str, Any]) -> Dict[str, Any]:
    """Minimal scoring mirror for logic-box children (matches editor scoring pass-through)."""
    nt = str(node.get("type") or "")
    if nt == "customscore":
        sm = float((node.get("data") or {}).get("score") or 0)
        return {"passed": True, "reason": "Custom score", "scoreModifier": sm}
    if nt == "engagementscore":
        return {"passed": True, "reason": "Engagement score", "scoreModifier": 0}
    if nt == "recency":
        return {"passed": True, "reason": "Recency", "scoreModifier": 0}
    return {"passed": True, "reason": "Scoring", "scoreModifier": 0}


def evaluate_junction(
    junction: Dict[str, Any],
    all_nodes: List[Dict[str, Any]],
    all_edges: List[Dict[str, Any]],
    post: Dict[str, Any],
    results: Dict[str, Dict[str, Any]],
    *,
    full_trace: bool = False,
) -> Dict[str, Any]:
    junction_id = junction["id"]
    node_by_id = {n["id"]: n for n in all_nodes}
    total_score = 0.0
    port_results: List[Dict[str, Any]] = []
    condition_results: List[Dict[str, Any]] = []

    by_port = _partition_junction_logic_edges(junction_id, all_edges)
    for port in PORTS:
        port_edges = by_port.get(port) or []
        if not port_edges:
            continue

        mode_key = f"logicMode{port.capitalize()}"
        n_key = f"logicN{port.capitalize()}"
        mode = str(junction.get("data", {}).get(mode_key, "and")).lower()
        need_n = int(junction.get("data", {}).get(n_key, 2))

        port_edges_ordered = _sort_port_edges_by_cost(port_edges, node_by_id)

        child_results: List[Dict[str, Any]] = []
        for edge in port_edges_ordered:
            child = node_by_id.get(edge.get("source"))
            if not child:
                continue
            child_type = child.get("type")

            if child_type == LOGIC_BOX_TYPE:
                child_result = evaluate_logic_box(
                    child,
                    all_nodes,
                    all_edges,
                    post,
                    results,
                    full_trace=full_trace,
                )
                results[child["id"]] = {
                    "passed": child_result.get("passed"),
                    "reason": child_result.get("reason"),
                    "score": child_result.get("score"),
                }
            elif child_type in CONTAINER_TYPES - {"junction"}:
                group_nodes, group_edges = collect_descendant_subgraph(
                    child["id"], all_nodes, all_edges
                )
                group_eval = evaluate_graph_multi_end(
                    group_nodes, group_edges, post, full_trace=full_trace
                )
                # Nested groups are expected to contain one local END; pick first deterministic.
                nested = next(iter(group_eval.values()))
                child_result = {
                    "passed": nested.passed,
                    "reason": "Group passed" if nested.passed else "Group failed",
                    "score": nested.score,
                }
                for k, v in nested.results.items():
                    results[k] = v
            elif child_type == "junction":
                child_result = evaluate_junction(
                    child,
                    all_nodes,
                    all_edges,
                    post,
                    results,
                    full_trace=full_trace,
                )
            elif is_condition_type(child_type):
                child_result = evaluate_condition_with_incoming_edges(
                    child,
                    all_nodes,
                    all_edges,
                    post,
                    results,
                    full_trace=full_trace,
                )
            else:
                continue

            results[child["id"]] = child_result
            child_results.append(child_result)
            condition_results.append(
                {
                    "nodeId": child["id"],
                    "type": child_type,
                    "passed": bool(child_result.get("passed")),
                    "port": port,
                    "reason": child_result.get("reason"),
                }
            )
            if child_result.get("passed"):
                total_score += float(
                    child_result.get("scoreModifier") or child_result.get("score") or 0
                )

            if not full_trace:
                if mode == "and" and not child_result.get("passed"):
                    break
                if mode == "or" and child_result.get("passed"):
                    break
                if mode == "nof":
                    pc = sum(1 for r in child_results if r.get("passed"))
                    if pc >= need_n:
                        break

        pass_count = sum(1 for r in child_results if r.get("passed"))
        if not child_results:
            port_passed = True
            reason = f"{port}: no conditions"
        elif mode == "and":
            port_passed = pass_count == len(child_results)
            reason = f"{port} AND: {pass_count}/{len(child_results)} passed"
        elif mode == "or":
            port_passed = pass_count > 0
            reason = f"{port} OR: {pass_count}/{len(child_results)} passed"
        else:
            port_passed = pass_count >= need_n
            reason = f"{port} N-OF: {pass_count}/{len(child_results)} passed (need {need_n})"

        port_results.append({"port": port, "passed": port_passed, "reason": reason})

        if not full_trace and not port_passed:
            break

    all_ports_passed = (not port_results) or all(p["passed"] for p in port_results)
    return {
        "passed": all_ports_passed,
        "reason": " | ".join(p["reason"] for p in port_results) or "No logic connections",
        "score": total_score,
        "portResults": port_results,
        "conditionResults": condition_results,
    }


def collect_descendant_subgraph(
    root_id: str, all_nodes: List[Dict[str, Any]], all_edges: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    descendant_ids: Set[str] = set()
    queue = [root_id]
    while queue:
        parent = queue.pop(0)
        children = [n for n in all_nodes if n.get("data", {}).get("containerParent") == parent]
        for child in children:
            cid = child["id"]
            if cid in descendant_ids:
                continue
            descendant_ids.add(cid)
            queue.append(cid)
    sub_nodes = [n for n in all_nodes if n["id"] in descendant_ids]
    sub_edges = [
        e
        for e in all_edges
        if e.get("source") in descendant_ids and e.get("target") in descendant_ids
    ]
    return sub_nodes, sub_edges


def pick_flow_entry_node(nodes: List[Dict[str, Any]], post: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    candidates = [n for n in nodes if n.get("type") in FLOW_ENTRY_CANDIDATE_TYPES]
    if not candidates:
        return None

    def _is_root_source(n: Dict[str, Any]) -> bool:
        return not (n.get("data") or {}).get("containerParent")

    root_sources = [n for n in candidates if _is_root_source(n)]
    use_sources = root_sources if root_sources else candidates

    candidate_uri = str(
        post.get("uri")
        or post.get("atUri")
        or post.get("at_uri")
        or post.get("url")
        or post.get("postUri")
        or ""
    ).strip().lower()

    for node in use_sources:
        if node.get("type") != "manualposts":
            continue
        uris = [str(u).strip().lower() for u in node.get("data", {}).get("posts", [])]
        if candidate_uri and any(u and (u == candidate_uri or u in candidate_uri or candidate_uri in u) for u in uris):
            return node

    for node in use_sources:
        if node.get("type") in ("start", "containerin"):
            return node
    return None


def trace_flow_path(start_id: str, end_id: str, edges: List[Dict[str, Any]]) -> List[str]:
    visited: Set[str] = set()
    path: List[str] = []

    def walk(node_id: str) -> bool:
        if node_id in visited:
            return False
        visited.add(node_id)
        path.append(node_id)
        if node_id == end_id:
            return True
        flow_out = [e for e in edges if e.get("source") == node_id and _is_flow_edge_loose(e)]
        for edge in flow_out:
            if walk(edge.get("target")):
                return True
        path.pop()
        return False

    walk(start_id)
    return path


def fill_missing_condition_evaluations(
    nodes: List[Dict[str, Any]],
    post: Dict[str, Any],
    results: Dict[str, Dict[str, Any]],
) -> None:
    for node in nodes:
        if not is_condition_type(node.get("type")):
            continue
        if node["id"] in results:
            continue
        cond = evaluate_condition(node, post)
        cond["evaluatedOutsideFlowPath"] = True
        results[node["id"]] = cond


def extract_end_pipeline_contract(
    nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], end_id: str
) -> Dict[str, Any]:
    """Build per-END Stage-3 contract: sorting -> injection -> fixed -> access."""
    in_end = [n for n in nodes if n.get("data", {}).get("containerParent") == end_id]

    sorting_types = {"chronological", "byscore", "mostlikes", "mostengagement", "random"}
    injection_types = {"rotatingposts", "feedads"}
    fixed_types = {
        "pinnedposts",
        "dynamicpinned",
        "featuredpost",
        "fixedchronological",
        "fixedbyscore",
        "fixedmostlikes",
        "fixedmostengagement",
        "fixedrandom",
    }
    access_types = {"whitelist"}

    def ordered(node_list: List[Dict[str, Any]], slot_key: str) -> List[Dict[str, Any]]:
        return sorted(
            node_list,
            key=lambda n: int(n.get("data", {}).get(slot_key, 0)),
        )

    sorting_nodes = ordered(
        [n for n in in_end if n.get("type") in sorting_types], "endPipelineSlotIndex"
    )
    injection_nodes = ordered(
        [n for n in in_end if n.get("type") in injection_types], "endPipelineInjectionSlotIndex"
    )
    fixed_nodes = ordered(
        [n for n in in_end if n.get("type") in fixed_types], "endPipelineFixedSlotIndex"
    )
    access_nodes = ordered(
        [n for n in in_end if n.get("type") in access_types], "endPipelineAccessSlotIndex"
    )

    return {
        "endId": end_id,
        "stageOrder": ["sorting", "injection", "fixed", "access"],
        "sorting": [serialize_pipeline_node(n) for n in sorting_nodes],
        "injection": [serialize_pipeline_node(n) for n in injection_nodes],
        "fixed": [serialize_pipeline_node(n) for n in fixed_nodes],
        "access": [serialize_pipeline_node(n) for n in access_nodes],
        "edgeCountInEndContainer": sum(
            1
            for e in edges
            if e.get("source") in {n["id"] for n in in_end}
            or e.get("target") in {n["id"] for n in in_end}
        ),
    }


def serialize_pipeline_node(node: Dict[str, Any]) -> Dict[str, Any]:
    data = node.get("data", {}) or {}
    return {
        "id": node.get("id"),
        "type": node.get("type"),
        "name": data.get("name") or data.get("label"),
        "slot": {
            "sorting": data.get("endPipelineSlotIndex"),
            "injection": data.get("endPipelineInjectionSlotIndex"),
            "fixed": data.get("endPipelineFixedSlotIndex"),
            "access": data.get("endPipelineAccessSlotIndex"),
        },
        "config": data,
    }
