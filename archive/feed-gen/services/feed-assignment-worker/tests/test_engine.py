import json
import unittest
from pathlib import Path

from engine import evaluate_graph_for_end, evaluate_graph_multi_end


class EngineTests(unittest.TestCase):
    def test_multi_end_returns_results_for_all_ends(self):
        fixture = Path(__file__).parent / "fixtures" / "multi_end_sample.json"
        payload = json.loads(fixture.read_text())
        result = evaluate_graph_multi_end(
            payload["graph"]["nodes"],
            payload["graph"]["edges"],
            payload["post"],
        )

        self.assertIn("end-trending", result)
        self.assertIn("end-video", result)
        self.assertTrue(result["end-trending"].passed)
        self.assertTrue(result["end-video"].passed)

    def test_end_pipeline_contract_stage_order_present(self):
        nodes = [
            {"id": "start", "type": "start", "data": {}},
            {"id": "junction", "type": "junction", "data": {}},
            {"id": "end-a", "type": "end", "data": {}},
            {"id": "sort-a", "type": "chronological", "data": {"containerParent": "end-a", "endPipelineSlotIndex": 0}},
            {"id": "inj-a", "type": "feedads", "data": {"containerParent": "end-a", "endPipelineInjectionSlotIndex": 0}},
            {"id": "fix-a", "type": "dynamicpinned", "data": {"containerParent": "end-a", "endPipelineFixedSlotIndex": 0}},
            {"id": "acc-a", "type": "whitelist", "data": {"containerParent": "end-a", "endPipelineAccessSlotIndex": 0}},
        ]
        edges = [
            {"source": "start", "target": "junction", "sourceHandle": "output-right", "targetHandle": "input-left"},
            {"source": "junction", "target": "end-a", "sourceHandle": "output-right", "targetHandle": "input-left"},
        ]
        post = {"uri": "at://did:plc:x/app.bsky.feed.post/1"}
        result = evaluate_graph_multi_end(nodes, edges, post)["end-a"]
        self.assertEqual(result.pipeline["stageOrder"], ["sorting", "injection", "fixed", "access"])
        self.assertEqual(len(result.pipeline["sorting"]), 1)
        self.assertEqual(len(result.pipeline["injection"]), 1)
        self.assertEqual(len(result.pipeline["fixed"]), 1)
        self.assertEqual(len(result.pipeline["access"]), 1)

    def test_or_branch_passes_when_one_port_passes(self):
        nodes = [
            {"id": "start", "type": "start", "data": {}},
            {"id": "junction", "type": "junction", "data": {"logicModeTop": "or"}},
            {"id": "end-a", "type": "end", "data": {}},
            {"id": "text-good", "type": "text", "data": {"keywords": ["urban"]}},
            {"id": "text-bad", "type": "text", "data": {"keywords": ["nomatch"]}},
        ]
        edges = [
            {"source": "start", "target": "junction", "sourceHandle": "output-right", "targetHandle": "input-left"},
            {"source": "junction", "target": "end-a", "sourceHandle": "output-right", "targetHandle": "input-left"},
            {"source": "text-good", "target": "junction", "sourceHandle": "logic-right", "targetHandle": "logic-top"},
            {"source": "text-bad", "target": "junction", "sourceHandle": "logic-right", "targetHandle": "logic-top"},
        ]
        post = {"text": "urban planning", "uri": "at://did:plc:x/app.bsky.feed.post/1"}
        result = evaluate_graph_multi_end(nodes, edges, post)["end-a"]
        self.assertTrue(result.passed)

    def test_nof_branch_fails_when_below_threshold(self):
        nodes = [
            {"id": "start", "type": "start", "data": {}},
            {"id": "junction", "type": "junction", "data": {"logicModeTop": "nof", "logicNTop": 2}},
            {"id": "end-a", "type": "end", "data": {}},
            {"id": "a", "type": "text", "data": {"keywords": ["urban"]}},
            {"id": "b", "type": "text", "data": {"keywords": ["transit"]}},
        ]
        edges = [
            {"source": "start", "target": "junction", "sourceHandle": "output-right", "targetHandle": "input-left"},
            {"source": "junction", "target": "end-a", "sourceHandle": "output-right", "targetHandle": "input-left"},
            {"source": "a", "target": "junction", "sourceHandle": "logic-right", "targetHandle": "logic-top"},
            {"source": "b", "target": "junction", "sourceHandle": "logic-right", "targetHandle": "logic-top"},
        ]
        post = {"text": "urban only", "uri": "at://did:plc:x/app.bsky.feed.post/1"}
        result = evaluate_graph_multi_end(nodes, edges, post)["end-a"]
        self.assertFalse(result.passed)

    def test_loose_flow_handles_and_regex_or_into_text(self):
        """Sparse exports (no flow/logic handles) + regex OR→text must match editor semantics."""
        nodes = [
            {"id": "start", "type": "start", "data": {}},
            {"id": "junction-main", "type": "junction", "data": {}},
            {"id": "text-1", "type": "text", "data": {"keywords": ["banana"]}},
            {"id": "language-1", "type": "language", "data": {"languages": ["en"]}},
            {"id": "posttype-1", "type": "posttype", "data": {"types": ["reply"], "exclude": True}},
            {"id": "regex-1", "type": "regex", "data": {"pattern": "FRIENDO", "flags": "i", "fields": ["text"]}},
            {"id": "end", "type": "end", "data": {}},
        ]
        edges = [
            {"source": "start", "target": "junction-main", "type": "flow"},
            {"source": "junction-main", "target": "end", "type": "flow"},
            {"source": "text-1", "target": "junction-main", "type": "logic", "logic": "and"},
            {"source": "language-1", "target": "junction-main", "type": "logic", "logic": "and"},
            {"source": "posttype-1", "target": "junction-main", "type": "logic", "logic": "and"},
            {"source": "regex-1", "target": "text-1", "type": "logic", "logic": "or"},
        ]
        post_friendo = {"text": "friendo", "langs": ["en"], "reply": None, "embed": {}, "author_did": "x"}
        r1 = evaluate_graph_for_end(nodes, edges, post_friendo, "end", full_trace=False)
        self.assertTrue(r1.passed)
        self.assertTrue(r1.results["text-1"]["passed"])

        post_banana = {"text": "bananas", "langs": ["en"], "reply": None, "embed": {}, "author_did": "x"}
        r2 = evaluate_graph_for_end(nodes, edges, post_banana, "end", full_trace=False)
        self.assertTrue(r2.passed)
        self.assertTrue(r2.results["text-1"]["passed"])


if __name__ == "__main__":
    unittest.main()
