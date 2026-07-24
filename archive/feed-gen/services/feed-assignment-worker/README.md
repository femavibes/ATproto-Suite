# Feed Assignment Worker (Engine Pass)

Initial Python assignment engine scaffold with multi-END evaluation support.

## What exists

- `engine.py`
  - `evaluate_graph_multi_end(nodes, edges, post)` returns one result per END node.
  - Flow semantics: `output-right -> input-left`.
  - Junction/container semantics: per-port AND/OR/N-OF.
  - Includes END pipeline execution contract per END (`sorting -> injection -> fixed -> access`) in `EngineResult.pipeline`.
- `condition_eval.py`
  - Python condition evaluators for current visual-editor condition node types.
- `assignment_worker.py`
  - Poll loop: reads `feeds.assignment_rules`, evaluates candidate posts, upserts `feed_posts`.
  - END->feed mapping policy:
    - single END: falls back to owning `feeds.id` if `end.data.feedId` is absent.
    - multi-END: every END must set `end.data.feedId`; otherwise feed is skipped (fail-safe).
- `tests/test_engine.py`
  - `unittest` suite for multi-END, OR/N-OF behavior, and pipeline contract shape.

## Quick run

```bash
cd services/feed-assignment-worker
python3 main.py
```

## Run tests

```bash
cd services/feed-assignment-worker
python3 -m unittest -v
```
