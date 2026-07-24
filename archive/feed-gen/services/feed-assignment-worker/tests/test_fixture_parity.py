import json
import unittest
from pathlib import Path

from engine import evaluate_graph_multi_end


class EngineFixtureParityTests(unittest.TestCase):
    def test_shared_engine_fixtures(self):
        fixtures_dir = Path(__file__).resolve().parents[3] / "fixtures" / "engine"
        fixture_files = sorted(fixtures_dir.glob("*.json"))
        self.assertTrue(fixture_files, "No shared engine fixtures found")

        for fixture_path in fixture_files:
            payload = json.loads(fixture_path.read_text())
            result = evaluate_graph_multi_end(
                payload["graph"]["nodes"],
                payload["graph"]["edges"],
                payload["post"],
            )

            expected_map = payload["expected"]["python"]["endResults"]
            for end_id, expected in expected_map.items():
                self.assertIn(end_id, result, f"{fixture_path.name}: missing END {end_id}")
                self.assertEqual(
                    result[end_id].passed,
                    expected["passed"],
                    f"{fixture_path.name}: pass mismatch for {end_id}",
                )
                self.assertEqual(
                    int(result[end_id].score),
                    int(expected["score"]),
                    f"{fixture_path.name}: score mismatch for {end_id}",
                )


if __name__ == "__main__":
    unittest.main()
