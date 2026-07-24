"""Strict evaluation short-circuit and cost-ordered junction children."""

import unittest

from engine import evaluate_graph_for_end, evaluate_graph_multi_end


class EngineShortCircuitTests(unittest.TestCase):
    def test_strict_spine_skips_nodes_after_failed_condition(self):
        nodes = [
            {"id": "start", "type": "start", "data": {}},
            {"id": "a", "type": "text", "data": {"keywords": ["nomatch"]}},
            {"id": "b", "type": "regex", "data": {"pattern": ".*", "flags": "i"}},
            {"id": "end", "type": "end", "data": {}},
        ]
        edges = [
            {
                "source": "start",
                "target": "a",
                "sourceHandle": "output-right",
                "targetHandle": "input-left",
            },
            {
                "source": "a",
                "target": "b",
                "sourceHandle": "output-right",
                "targetHandle": "input-left",
            },
            {
                "source": "b",
                "target": "end",
                "sourceHandle": "output-right",
                "targetHandle": "input-left",
            },
        ]
        post = {"text": "hello world", "uri": "at://did:plc:x/app.bsky.feed.post/abc"}
        r = evaluate_graph_for_end(nodes, edges, post, "end", full_trace=False)
        self.assertFalse(r.passed)
        self.assertIn("a", r.results)
        self.assertNotIn("b", r.results)

    def test_full_trace_evaluates_all_spine_conditions(self):
        nodes = [
            {"id": "start", "type": "start", "data": {}},
            {"id": "a", "type": "text", "data": {"keywords": ["nomatch"]}},
            {"id": "b", "type": "regex", "data": {"pattern": ".*", "flags": "i"}},
            {"id": "end", "type": "end", "data": {}},
        ]
        edges = [
            {
                "source": "start",
                "target": "a",
                "sourceHandle": "output-right",
                "targetHandle": "input-left",
            },
            {
                "source": "a",
                "target": "b",
                "sourceHandle": "output-right",
                "targetHandle": "input-left",
            },
            {
                "source": "b",
                "target": "end",
                "sourceHandle": "output-right",
                "targetHandle": "input-left",
            },
        ]
        post = {"text": "hello world", "uri": "at://did:plc:x/app.bsky.feed.post/abc"}
        r = evaluate_graph_for_end(nodes, edges, post, "end", full_trace=True)
        self.assertIn("a", r.results)
        self.assertIn("b", r.results)

    def test_junction_and_short_circuit_cheap_first(self):
        """Language (rank 0) before text (rank 1); AND fails on language — text not evaluated in strict mode."""
        nodes = [
            {"id": "start", "type": "start", "data": {}},
            {"id": "j", "type": "junction", "data": {"logicModeTop": "and"}},
            {"id": "lang", "type": "language", "data": {"languages": ["de"], "exclude": False}},
            {"id": "txt", "type": "text", "data": {"keywords": ["hello"]}},
            {"id": "end", "type": "end", "data": {}},
        ]
        edges = [
            {
                "source": "start",
                "target": "j",
                "sourceHandle": "output-right",
                "targetHandle": "input-left",
            },
            {
                "source": "j",
                "target": "end",
                "sourceHandle": "output-right",
                "targetHandle": "input-left",
            },
            {
                "source": "lang",
                "target": "j",
                "sourceHandle": "logic-right",
                "targetHandle": "logic-top",
            },
            {
                "source": "txt",
                "target": "j",
                "sourceHandle": "logic-right",
                "targetHandle": "logic-top",
            },
        ]
        post = {"text": "hello", "uri": "at://x", "langs": ["en"]}
        r = evaluate_graph_for_end(nodes, edges, post, "end", full_trace=False)
        self.assertIn("lang", r.results)
        self.assertNotIn("txt", r.results)

    def test_multi_end_defaults_to_strict(self):
        nodes = [
            {"id": "start", "type": "start", "data": {}},
            {"id": "a", "type": "text", "data": {"keywords": ["x"]}},
            {"id": "end", "type": "end", "data": {}},
        ]
        edges = [
            {
                "source": "start",
                "target": "a",
                "sourceHandle": "output-right",
                "targetHandle": "input-left",
            },
            {
                "source": "a",
                "target": "end",
                "sourceHandle": "output-right",
                "targetHandle": "input-left",
            },
        ]
        post = {"text": "no", "uri": "at://x"}
        m = evaluate_graph_multi_end(nodes, edges, post)
        self.assertFalse(m["end"].passed)


if __name__ == "__main__":
    unittest.main()
