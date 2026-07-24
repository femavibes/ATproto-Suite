"""Per node-type evaluation cost (mirrors visual-editor/src/constants/evaluationCost.js).

Tiers:
  0 = always-pass / ingest-irrelevant  (customscore, recency, engagementscore)
  1 = low    — trivial field lookups    (language, posttype, dateage, image, video, media)
  2 = medium — array / facet iteration  (text, hashtag, mentions, links, labels, author, engagement)
  3 = high   — regex engine             (regex)
"""

from __future__ import annotations

from typing import Dict

CONDITION_EVAL_COST_RANK: Dict[str, int] = {
    # Tier 0 — always pass; no filtering value at ingest or cheap scoring-only nodes
    "customscore":      0,
    "recency":          0,
    "engagementscore":  0,

    # Tier 1 — simple field / boolean lookups
    "language":         1,
    "posttype":         1,
    "poststructure":    1,
    "dateage":          1,
    "image":            1,
    "video":            1,
    "media":            1,
    "quotepost":        1,

    # Tier 2 — array scans / facet iteration
    "text":             2,
    "hashtag":          2,
    "mentions":         2,
    "links":            2,
    "labels":           2,
    "author":           2,
    "engagement":       2,

    # Tier 3 — regex engine (most expensive)
    "regex":            3,
}

_DEFAULT_RANK = 2


def condition_cost_rank(node_type: str | None) -> int:
    if not node_type:
        return _DEFAULT_RANK
    return CONDITION_EVAL_COST_RANK.get(str(node_type), _DEFAULT_RANK)
