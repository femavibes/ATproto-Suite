import unittest

from prefilter_hints import extract_jetstream_prefilter_hints, post_passes_prefilter


class PrefilterHintsTests(unittest.TestCase):
    def test_extract_hints_text_plus_language_matches_js_safety_rules(self):
        nodes = [
            {"id": "start", "type": "start", "data": {}},
            {"id": "junction", "type": "junction", "data": {}},
            {"id": "end-a", "type": "end", "data": {}},
            {"id": "t1", "type": "text", "data": {"keywords": ["urban"]}},
            {"id": "l1", "type": "language", "data": {"languages": ["en"]}},
        ]
        edges = [
            {"source": "start", "target": "junction", "sourceHandle": "output-right", "targetHandle": "input-left"},
            {"source": "junction", "target": "end-a", "sourceHandle": "output-right", "targetHandle": "input-left"},
            {"source": "t1", "target": "junction", "sourceHandle": "logic-right", "targetHandle": "logic-top"},
            {"source": "l1", "target": "junction", "sourceHandle": "logic-right", "targetHandle": "logic-bottom"},
        ]
        hints = extract_jetstream_prefilter_hints(nodes, edges)
        self.assertTrue(hints.ok)
        self.assertIn("urban", hints.keyword_stems)
        self.assertIn("en", hints.language_codes)
        # JS parity: keyword-only dropping is unsafe when non-text/regex conditions
        # (including language) are in scope.
        self.assertTrue(hints.unsafe_to_drop_for_keyword_gate)
        self.assertFalse(hints.unsafe_to_drop_for_language_gate)

    def test_extract_hints_marks_unsafe_when_other_condition_types_exist(self):
        nodes = [
            {"id": "start", "type": "start", "data": {}},
            {"id": "junction", "type": "junction", "data": {}},
            {"id": "end-a", "type": "end", "data": {}},
            {"id": "t1", "type": "text", "data": {"keywords": ["urban"]}},
            {"id": "a1", "type": "author", "data": {"authors": ["did:plc:x"]}},
        ]
        edges = [
            {"source": "start", "target": "junction", "sourceHandle": "output-right", "targetHandle": "input-left"},
            {"source": "junction", "target": "end-a", "sourceHandle": "output-right", "targetHandle": "input-left"},
            {"source": "t1", "target": "junction", "sourceHandle": "logic-right", "targetHandle": "logic-top"},
            {"source": "a1", "target": "junction", "sourceHandle": "logic-right", "targetHandle": "logic-bottom"},
        ]
        hints = extract_jetstream_prefilter_hints(nodes, edges)
        self.assertTrue(hints.unsafe_to_drop_for_keyword_gate)
        self.assertTrue(hints.unsafe_to_drop_for_language_gate)

    def test_post_passes_prefilter_enforces_safe_gates(self):
        nodes = [
            {"id": "start", "type": "start", "data": {}},
            {"id": "junction", "type": "junction", "data": {}},
            {"id": "end-a", "type": "end", "data": {}},
            {"id": "t1", "type": "text", "data": {"keywords": ["urban"]}},
            {"id": "l1", "type": "language", "data": {"languages": ["en"]}},
        ]
        edges = [
            {"source": "start", "target": "junction", "sourceHandle": "output-right", "targetHandle": "input-left"},
            {"source": "junction", "target": "end-a", "sourceHandle": "output-right", "targetHandle": "input-left"},
            {"source": "t1", "target": "junction", "sourceHandle": "logic-right", "targetHandle": "logic-top"},
            {"source": "l1", "target": "junction", "sourceHandle": "logic-right", "targetHandle": "logic-bottom"},
        ]
        hints = extract_jetstream_prefilter_hints(nodes, edges)
        self.assertTrue(post_passes_prefilter({"text": "urban planning", "langs": ["en-US"]}, hints))
        self.assertFalse(post_passes_prefilter({"text": "urban planning", "langs": ["es"]}, hints))
        # Keyword gate is unsafe in this shape, so keyword miss is not dropped here.
        self.assertTrue(post_passes_prefilter({"text": "gardening tips", "langs": ["en"]}, hints))


if __name__ == "__main__":
    unittest.main()
