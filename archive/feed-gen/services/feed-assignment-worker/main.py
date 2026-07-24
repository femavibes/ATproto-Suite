"""Local runner for assignment engine development."""

from __future__ import annotations

import json
from pathlib import Path

from engine import evaluate_graph_multi_end


def main() -> None:
    fixture_path = Path(__file__).parent / "tests" / "fixtures" / "multi_end_sample.json"
    payload = json.loads(fixture_path.read_text())
    result = evaluate_graph_multi_end(
        payload["graph"]["nodes"],
        payload["graph"]["edges"],
        payload["post"],
    )
    for end_id, end_result in result.items():
        print(f"{end_id}: passed={end_result.passed} score={end_result.score} error={end_result.error}")


if __name__ == "__main__":
    main()
