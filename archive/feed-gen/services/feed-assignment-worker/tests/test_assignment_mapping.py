import unittest

from assignment_worker import _extract_end_feed_map, _validate_end_mapping


class AssignmentMappingTests(unittest.TestCase):
    def test_single_end_falls_back_to_root_feed(self):
        nodes = [{"id": "end-1", "type": "end", "data": {}}]
        end_map = _extract_end_feed_map(nodes)
        ok, err, resolved = _validate_end_mapping("root-feed", end_map)
        self.assertTrue(ok)
        self.assertIsNone(err)
        self.assertEqual(resolved["end-1"], "root-feed")

    def test_multi_end_requires_explicit_feed_ids(self):
        nodes = [
            {"id": "end-1", "type": "end", "data": {"feedId": "feed-a"}},
            {"id": "end-2", "type": "end", "data": {}},
        ]
        end_map = _extract_end_feed_map(nodes)
        ok, err, resolved = _validate_end_mapping("root-feed", end_map)
        self.assertFalse(ok)
        self.assertIn("missing: end-2", err or "")
        self.assertEqual(resolved, {})

    def test_multi_end_uses_explicit_mapping(self):
        nodes = [
            {"id": "end-1", "type": "end", "data": {"feedId": "feed-a"}},
            {"id": "end-2", "type": "end", "data": {"feedId": "feed-b"}},
        ]
        end_map = _extract_end_feed_map(nodes)
        ok, err, resolved = _validate_end_mapping("root-feed", end_map)
        self.assertTrue(ok)
        self.assertIsNone(err)
        self.assertEqual(resolved["end-1"], "feed-a")
        self.assertEqual(resolved["end-2"], "feed-b")

    def test_inner_group_end_ignored_for_feed_mapping(self):
        """END inside a Group (logicgroup) has containerParent; not a separate feed output."""
        nodes = [
            {"id": "end-1", "type": "end", "data": {"feedId": "feed-a"}},
            {"id": "end-2", "type": "end", "data": {"feedId": "feed-b"}},
            {
                "id": "end-logicgroup-1776884665003",
                "type": "end",
                "data": {"containerParent": "logicgroup-1"},
            },
        ]
        end_map = _extract_end_feed_map(nodes)
        self.assertEqual(set(end_map.keys()), {"end-1", "end-2"})
        ok, err, resolved = _validate_end_mapping("root-feed", end_map)
        self.assertTrue(ok)
        self.assertIsNone(err)
        self.assertEqual(resolved["end-1"], "feed-a")
        self.assertEqual(resolved["end-2"], "feed-b")


if __name__ == "__main__":
    unittest.main()
