"""Post type must respect DB denormalization when record_json omits reply."""

import unittest

from condition_eval import eval_posttype
from post_payload import canonical_post_payload


class PostTypeExcludeReplyTests(unittest.TestCase):
    def test_exclude_reply_fails_when_only_post_type_column_set(self):
        """Regression: _post_type used to ignore posts.post_type if `reply` was missing."""
        row = {
            "cid": "abc",
            "uri": "at://did:plc:x/app.bsky.feed.post/rkey",
            "text": "banana",
            "author_did": "did:plc:x",
            "created_at": "2026-01-01T00:00:00Z",
            "post_type": "reply",
            "reply_parent": None,
            "reply_root": None,
            "record_json": {"text": "banana", "langs": ["en"]},
            "like_count": 0,
            "reply_count": 0,
            "repost_count": 0,
            "quote_count": 0,
            "bookmark_count": 0,
        }
        canonical = canonical_post_payload(row)
        self.assertEqual(canonical.get("post_type"), "reply")
        data = {"types": ["reply"], "exclude": True}
        out = eval_posttype(data, canonical)
        self.assertFalse(out["passed"], "exclude reply should reject reply posts")

    def test_synthetic_reply_from_parent_root_uris(self):
        row = {
            "cid": "abc",
            "uri": "at://did:plc:x/app.bsky.feed.post/rkey",
            "text": "banana",
            "author_did": "did:plc:x",
            "created_at": "2026-01-01T00:00:00Z",
            "post_type": "reply",
            "reply_parent": "at://did:plc:p/app.bsky.feed.post/parent",
            "reply_root": "at://did:plc:r/app.bsky.feed.post/root",
            "record_json": {"text": "banana"},
            "like_count": 0,
            "reply_count": 0,
            "repost_count": 0,
            "quote_count": 0,
            "bookmark_count": 0,
        }
        canonical = canonical_post_payload(row)
        self.assertIn("reply", canonical)
        self.assertEqual(
            canonical["reply"]["parent"]["uri"],
            "at://did:plc:p/app.bsky.feed.post/parent",
        )
        data = {"types": ["reply"], "exclude": True}
        self.assertFalse(eval_posttype(data, canonical)["passed"])

    def test_eval_posttype_reads_explicit_post_type_without_merge(self):
        data = {"types": ["reply"], "exclude": True}
        post = {"text": "x", "post_type": "reply"}
        self.assertFalse(eval_posttype(data, post)["passed"])


if __name__ == "__main__":
    unittest.main()
