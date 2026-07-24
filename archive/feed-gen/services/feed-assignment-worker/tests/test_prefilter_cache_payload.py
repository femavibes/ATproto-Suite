import unittest

from assignment_worker import (
    _graph_digest,
    _hints_from_payload,
    _hints_to_payload,
)
from prefilter_hints import PrefilterHints


class PrefilterCachePayloadTests(unittest.TestCase):
    def test_digest_changes_when_graph_changes(self):
        nodes_a = [{"id": "start", "type": "start", "data": {}}]
        edges_a = []
        nodes_b = [{"id": "start", "type": "start", "data": {}}, {"id": "end", "type": "end", "data": {}}]
        edges_b = []
        self.assertNotEqual(_graph_digest(nodes_a, edges_a), _graph_digest(nodes_b, edges_b))

    def test_payload_roundtrip(self):
        hints = PrefilterHints(
            ok=True,
            reason=None,
            jetstream_seed_id="start",
            keyword_stems=["urban"],
            language_codes=["en"],
            unsafe_to_drop_for_keyword_gate=True,
            unsafe_to_drop_for_language_gate=False,
            notes=["note"],
        )
        payload = _hints_to_payload(hints, "abc123")
        parsed = _hints_from_payload(payload)
        self.assertIsNotNone(parsed)
        self.assertTrue(parsed.ok)
        self.assertEqual(parsed.jetstream_seed_id, "start")
        self.assertEqual(parsed.keyword_stems, ["urban"])
        self.assertEqual(parsed.language_codes, ["en"])
        self.assertTrue(parsed.unsafe_to_drop_for_keyword_gate)
        self.assertFalse(parsed.unsafe_to_drop_for_language_gate)


if __name__ == "__main__":
    unittest.main()
