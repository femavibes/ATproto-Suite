# Source Node Taxonomy (Draft)

This defines the modular contract for source-like nodes so each node stays self-contained and swappable.

## Source Types

- `native_start`: default firehose-backed entry point.
- `manualposts`: explicit URI list.
- `feed_import`: references another feed's output as input (future).
- `module_source:*`: third-party source adapter.

## Source Adapter Contract

Each source node adapter returns records in this normalized shape:

```json
{
  "cursor": "opaque-source-cursor",
  "records": [
    {
      "uri": "at://did:.../app.bsky.feed.post/...",
      "cid": "bafy...",
      "source": {
        "type": "native_start",
        "nodeId": "start",
        "provenance": {
          "moduleId": null,
          "ingestedAt": "2026-04-21T00:00:00Z"
        }
      },
      "prefilter": {
        "allow": true,
        "reason": "passes-source-prefilter"
      }
    }
  ]
}
```

## Provenance Requirements

- Every emitted post must include source provenance (`type`, `nodeId`, optional `moduleId`).
- Downstream modules may use provenance for auditing and debugging.
- Provenance must persist into assignment traces.

## Per-Source Prefilters

- Prefilters apply only to posts entering from that source.
- They execute before shared graph logic.
- Prefilter results are attached to provenance for explainability.

## Ads and Injection Rule

- Ads are represented only via injection stages (`feedads`, `rotatingposts`), never as source nodes.
- This keeps source ingestion semantics clean and deterministic.

## Feed Import Semantics (Open)

- URI-only import vs copied/stored records still undecided.
- Pending decisions: dedup key strategy, rate limits, staleness policy.
