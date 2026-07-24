"""Jetstream prefilter hints (Python port of visual-editor ingestionPrefilterHints.js)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set

from condition_eval import is_condition_type

FLOW_SOURCE_TYPES = {"start", "manualposts"}


@dataclass
class PrefilterHints:
    ok: bool
    reason: Optional[str]
    jetstream_seed_id: Optional[str]
    keyword_stems: List[str]
    language_codes: List[str]
    unsafe_to_drop_for_keyword_gate: bool
    unsafe_to_drop_for_language_gate: bool
    notes: List[str]


def compute_feed_scoped_node_ids(
    seed_id: str, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]
) -> Set[str]:
    node_ids = {str(n.get("id")) for n in nodes}
    if seed_id not in node_ids:
        return set()

    reachable: Set[str] = {seed_id}
    queue: List[str] = [seed_id]

    # Flow reachability.
    while queue:
        nid = queue.pop(0)
        flow_out = [
            e
            for e in edges
            if e.get("source") == nid
            and e.get("sourceHandle") == "output-right"
            and e.get("targetHandle") == "input-left"
        ]
        for e in flow_out:
            target = str(e.get("target"))
            if target not in reachable and target in node_ids:
                reachable.add(target)
                queue.append(target)

    # Pull in logic-connected sources.
    changed = True
    while changed:
        changed = False
        for e in edges:
            source_handle = str(e.get("sourceHandle") or "")
            if not source_handle.startswith("logic-"):
                continue
            target = str(e.get("target"))
            source = str(e.get("source"))
            if target not in reachable:
                continue
            if source not in reachable and source in node_ids:
                reachable.add(source)
                changed = True

    # Pull in container descendants.
    changed = True
    while changed:
        changed = False
        for n in nodes:
            nid = str(n.get("id"))
            parent = str((n.get("data") or {}).get("containerParent") or "")
            if not parent:
                continue
            if parent in reachable and nid not in reachable:
                reachable.add(nid)
                changed = True

    return reachable


def extract_jetstream_prefilter_hints(
    nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]
) -> PrefilterHints:
    notes: List[str] = []
    root_start = next(
        (n for n in nodes if n.get("type") == "start" and not (n.get("data") or {}).get("containerParent")),
        None,
    )
    if not root_start:
        return PrefilterHints(
            ok=False,
            reason="No root START node - jetstream scope undefined",
            jetstream_seed_id=None,
            keyword_stems=[],
            language_codes=[],
            unsafe_to_drop_for_keyword_gate=True,
            unsafe_to_drop_for_language_gate=True,
            notes=notes,
        )

    scope = compute_feed_scoped_node_ids(str(root_start.get("id")), nodes, edges)
    cond_nodes = [
        n for n in nodes if str(n.get("id")) in scope and is_condition_type(str(n.get("type")))
    ]

    keyword_stems: Set[str] = set()
    has_text_or_regex = False
    for n in cond_nodes:
        ntype = n.get("type")
        data = n.get("data") or {}
        if ntype == "text":
            has_text_or_regex = True
            for kw in data.get("keywords", []):
                value = kw.get("value") if isinstance(kw, dict) else kw
                t = str(value).strip().lower()
                if t:
                    keyword_stems.add(t)
        if ntype == "regex":
            has_text_or_regex = True
            p = data.get("pattern")
            if p and str(p).strip():
                keyword_stems.add(f"regex:{str(p)[:64]}")

    language_codes: Set[str] = set()
    has_language_condition = False
    for n in cond_nodes:
        if n.get("type") != "language":
            continue
        has_language_condition = True
        for lang in (n.get("data") or {}).get("languages", []):
            t = str(lang).strip().lower()
            if t:
                language_codes.add(t)

    has_non_text_regex_condition = any(
        n.get("type") not in {"text", "regex"} for n in cond_nodes
    )
    unsafe_keyword = (not has_text_or_regex) or has_non_text_regex_condition
    has_only_language_text_regex = all(
        n.get("type") in {"language", "text", "regex"} for n in cond_nodes
    )
    unsafe_language = (not has_language_condition) or (not has_only_language_text_regex)

    if has_non_text_regex_condition:
        notes.append(
            "In-scope conditions include types other than text/regex; keyword-only gate is unsafe for dropping."
        )
    if unsafe_language and has_language_condition:
        notes.append(
            "Language nodes coexist with other condition types; language-only gate is unsafe for dropping."
        )
    if has_text_or_regex and not has_non_text_regex_condition:
        notes.append(
            "Only text/regex filters in scope; keyword union can safely narrow candidates."
        )

    return PrefilterHints(
        ok=True,
        reason=None,
        jetstream_seed_id=str(root_start.get("id")),
        keyword_stems=sorted(keyword_stems),
        language_codes=sorted(language_codes),
        unsafe_to_drop_for_keyword_gate=unsafe_keyword,
        unsafe_to_drop_for_language_gate=unsafe_language,
        notes=notes,
    )


def post_passes_prefilter(post: Dict[str, Any], hints: PrefilterHints) -> bool:
    # Conservative: if hints are undefined/unsafe, keep candidate.
    if not hints.ok:
        return True

    text = str(post.get("text") or "").lower()
    langs = _extract_post_langs(post)

    if not hints.unsafe_to_drop_for_keyword_gate and hints.keyword_stems:
        if not _matches_any_keyword_or_regex(text, hints.keyword_stems):
            return False

    if not hints.unsafe_to_drop_for_language_gate and hints.language_codes:
        if not _matches_any_language(langs, hints.language_codes):
            return False

    return True


def _extract_post_langs(post: Dict[str, Any]) -> List[str]:
    raw = post.get("langs")
    if isinstance(raw, list):
        return [str(x).lower() for x in raw if str(x).strip()]
    record = post.get("record_json")
    if isinstance(record, dict) and isinstance(record.get("langs"), list):
        return [str(x).lower() for x in record.get("langs") if str(x).strip()]
    language = post.get("language")
    if language:
        return [str(language).lower()]
    return []


def _matches_any_language(post_langs: List[str], allowed: List[str]) -> bool:
    for pl in post_langs:
        for lang in allowed:
            if pl == lang or pl.startswith(f"{lang}-"):
                return True
    return False


def _matches_any_keyword_or_regex(text: str, keyword_stems: List[str]) -> bool:
    for k in keyword_stems:
        if k.startswith("regex:"):
            pat = k[len("regex:") :]
            try:
                if re.search(pat, text, flags=re.IGNORECASE):
                    return True
            except re.error:
                # Invalid regex hints should never filter out posts.
                return True
        elif k and k in text:
            return True
    return False
