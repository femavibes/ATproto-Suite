"""Main worker for Jetstream ingestion."""

import asyncio
import json
from datetime import datetime
from typing import Optional
from websockets import connect
from langdetect import detect, LangDetectException

from config import (
    JETSTREAM_URL,
    LANGUAGE_FILTER,
    BATCH_SIZE,
    BATCH_FLUSH_SECONDS,
    INGESTION_GRAPH_MATCH_ENABLED,
    INGESTION_FEED_GRAPH_CACHE_SECONDS,
)
from database import (
    get_db,
    save_post,
    update_cursor,
    get_cursor,
    fetch_live_feed_keywords,
    fetch_live_feed_graph_rules,
    register_engagement_event_and_increment,
    consume_engagement_event_and_decrement,
)
from keyword_matcher import KeywordMatcher
from graph_match import (
    FeedGraphCache,
    augment_post_row_for_graph_eval,
    pick_parseable_graph_rules,
    post_matches_any_graph,
)


def _normalize_atproto_langs(record: dict) -> list:
    """
    Bluesky records use langs: string[] but Jetstream/JSON may use odd shapes (string, dict, etc.).
    Ensures 'en' from the app is visible to the graph engine the same as in the PDS view.
    """
    raw = record.get("langs")
    if raw is None:
        return []
    if isinstance(raw, str):
        s = raw.strip()
        return [s] if s else []
    if isinstance(raw, list):
        out: list[str] = []
        for x in raw:
            if isinstance(x, str) and x.strip():
                out.append(x.strip())
            elif x is not None and str(x).strip():
                out.append(str(x).strip())
        return out
    if isinstance(raw, dict):
        return [str(v).strip() for v in raw.values() if v is not None and str(v).strip()]
    return []


class JetstreamWorker:
    """Worker that connects to Jetstream and ingests posts."""
    
    def __init__(self):
        self.keyword_matcher = KeywordMatcher()
        self.dynamic_keywords_loaded = False
        self.posts_received = 0
        self.posts_empty = 0
        self.posts_no_keyword_match = 0
        self.posts_matched_keywords = 0
        self.posts_not_english = 0
        self.posts_lang_detection_failed = 0
        self.posts_english = 0
        self.posts_saved = 0
        self.posts_duplicate = 0
        self.posts_error = 0
        self.errors = 0
        self.batch = []
        self.start_time = None
        self._last_flush_monotonic = asyncio.get_event_loop().time()
        self.feed_graph_cache = FeedGraphCache(ttl_seconds=INGESTION_FEED_GRAPH_CACHE_SECONDS)
        self.posts_graph_rejected = 0
        self.posts_graph_candidates = 0

    async def _refresh_feed_graph_cache(self, conn) -> None:
        from database import get_cached_list_members
        rows = await fetch_live_feed_graph_rules(conn)
        bundles = []
        all_list_uris: set[str] = set()
        for row in rows:
            g = pick_parseable_graph_rules(row.get("live"), row.get("draft"), row.get("legacy"))
            if g:
                bundles.append((str(row["id"]), g["nodes"], g["edges"]))
                # Collect listUris from author/mentions nodes for pre-resolution
                for node in g["nodes"]:
                    if node.get("type") in ("author", "mentions"):
                        data = node.get("data") or node.get("config") or {}
                        for uri in (data.get("listUris") or []):
                            if str(uri).startswith("at://"):
                                all_list_uris.add(str(uri))
            else:
                print(
                    f"ingestion graph gate: feed {row['id']} skipped (no visual graph in live/draft/legacy)"
                )
        resolved = await get_cached_list_members(conn, sorted(all_list_uris))
        self.feed_graph_cache.set_graphs(bundles, resolved_members=resolved)
        print(
            f"ingestion graph gate: loaded {len(bundles)} feed graph(s), "
            f"{len(all_list_uris)} list(s) resolved ({sum(len(v) for v in resolved.values())} total members)"
        )

    async def refresh_dynamic_keywords(self) -> None:
        """Merge live feed keywords from DB into matcher."""
        try:
            pool = await get_db()
            async with pool.acquire() as conn:
                db_keywords = await fetch_live_feed_keywords(conn)
            if db_keywords:
                self.keyword_matcher.merge_keywords(db_keywords)
                self.dynamic_keywords_loaded = True
                print(f"Loaded {len(db_keywords)} dynamic feed keywords from DB")
            else:
                print("No dynamic feed keywords found in DB; using static keyword list")
        except Exception as e:
            self.errors += 1
            print(f"Failed to load dynamic feed keywords: {e}")
    
    async def process_message(self, message: dict) -> None:
        """Process a single message from Jetstream."""
        try:
            # Check if it's a commit
            if message.get('kind') != 'commit':
                return
            
            commit = message.get('commit', {})
            collection = commit.get('collection')
            operation = commit.get('operation')
            if collection not in ('app.bsky.feed.post', 'app.bsky.feed.like', 'app.bsky.feed.repost'):
                return

            did = message.get('did')
            rkey = commit.get('rkey')
            if did and rkey:
                action_uri = f"at://{did}/{collection}/{rkey}"
            else:
                action_uri = None

            if collection in ('app.bsky.feed.like', 'app.bsky.feed.repost'):
                pool = await get_db()
                async with pool.acquire() as conn:
                    if operation == 'delete':
                        if action_uri:
                            await consume_engagement_event_and_decrement(conn, action_uri)
                    else:
                        record = commit.get('record', {}) or {}
                        subject = record.get('subject') if isinstance(record.get('subject'), dict) else {}
                        subject_uri = subject.get('uri')
                        if action_uri and subject_uri:
                            kind = 'like' if collection.endswith('.like') else 'repost'
                            await register_engagement_event_and_increment(
                                conn, action_uri, str(subject_uri), kind
                            )
                return
            
            self.posts_received += 1
            
            # Extract post data
            record = commit.get('record', {})
            text = record.get('text', '')
            
            # Skip empty posts
            if not text:
                self.posts_empty += 1
                return

            langs = _normalize_atproto_langs(record)

            if INGESTION_GRAPH_MATCH_ENABLED:
                # Graph gate is the admission filter: do not require global keywords or English.
                # (Otherwise a regex-only feed would never index — prefilters ran first and dropped posts.)
                self.posts_graph_candidates += 1
            else:
                # Filter 1: Aho-Corasick keyword matching
                if not self.keyword_matcher.match(text):
                    self.posts_no_keyword_match += 1
                    return  # No keyword match, skip

                self.posts_matched_keywords += 1

                # Filter 2: Language check (use Bluesky's langs field if available, fallback to langdetect)
                is_english = False

                if langs:
                    # Use Bluesky's language detection (more accurate)
                    is_english = 'en' in langs or 'en-US' in langs or 'en-GB' in langs
                else:
                    # Fallback to langdetect if langs field not present
                    try:
                        detected_lang = detect(text)
                        is_english = detected_lang == LANGUAGE_FILTER
                    except LangDetectException:
                        # If detection fails, skip (better safe than sorry)
                        self.posts_lang_detection_failed += 1
                        return

                if not is_english:
                    self.posts_not_english += 1
                    return  # Not English, skip

                self.posts_english += 1
            
            # Extract all post data
            cid = commit.get('cid')
            rkey = commit.get('rkey')
            if not cid or not rkey or not did:
                self.errors += 1
                return
            
            uri = f"at://{did}/app.bsky.feed.post/{rkey}"
            
            # Extract metadata
            embed = record.get('embed', {})
            has_images = 'images' in embed or 'image' in embed
            has_video = 'video' in embed
            has_link = 'external' in embed
            
            # Extract language (use first lang from langs array, or 'en' if not present)
            language = langs[0] if langs else 'en'
            
            # Determine post type
            if record.get('reply'):
                post_type = 'reply'
                reply_parent = record.get('reply', {}).get('parent', {}).get('uri')
                reply_root = record.get('reply', {}).get('root', {}).get('uri')
            elif record.get('embed', {}).get('$type') == 'app.bsky.embed.record':
                post_type = 'quote'
                reply_parent = None
                reply_root = None
            else:
                post_type = 'post'
                reply_parent = None
                reply_root = None
            
            created_at = record.get('createdAt', datetime.now().isoformat())

            langs_norm = langs
            record_for_store = dict(record)
            record_for_store["langs"] = langs_norm
            extracted = self._extract_record_fields(record_for_store)
            post_data = {
                'cid': cid,
                'uri': uri,
                'text': text,
                'author_did': did,
                'has_images': has_images,
                'has_video': has_video,
                'has_link': has_link,
                'language': language,
                'langs': langs_norm,
                'post_type': post_type,
                'reply_parent': reply_parent,
                'reply_root': reply_root,
                'created_at': created_at,
                'record_json': record_for_store,
                'extracted': extracted,
                'cursor_seq': message.get('seq', 0),
                'cursor_time': message.get('time', datetime.now().isoformat()),
                'like_count': 0,
                'reply_count': 0,
                'repost_count': 0,
                'quote_count': 0,
                'bookmark_count': 0,
            }

            # Event-driven engagement counters for replies/quotes on tracked posts.
            pool = await get_db()
            async with pool.acquire() as conn:
                if operation == 'delete':
                    if action_uri:
                        await consume_engagement_event_and_decrement(conn, action_uri)
                else:
                    if record.get('reply'):
                        parent_uri = record.get('reply', {}).get('parent', {}).get('uri')
                        if action_uri and parent_uri:
                            await register_engagement_event_and_increment(
                                conn, action_uri, str(parent_uri), 'reply'
                            )
                    embed_type = record.get('embed', {}).get('$type')
                    if embed_type in ('app.bsky.embed.record', 'app.bsky.embed.recordWithMedia'):
                        embedded_uri = (
                            record.get('embed', {}).get('record', {}).get('uri')
                            or record.get('embed', {}).get('record', {}).get('record', {}).get('uri')
                        )
                        if action_uri and embedded_uri:
                            await register_engagement_event_and_increment(
                                conn, action_uri, str(embedded_uri), 'quote'
                            )

                if INGESTION_GRAPH_MATCH_ENABLED:
                    if self.feed_graph_cache.stale():
                        await self._refresh_feed_graph_cache(conn)
                    gated = augment_post_row_for_graph_eval(post_data)
                    if not post_matches_any_graph(gated, self.feed_graph_cache.graphs, self.feed_graph_cache.resolved_members):
                        self.posts_graph_rejected += 1
                        return
                    # Persist langs/language hint used by the graph gate (assignment parity).
                    post_data = gated

            self.batch.append(post_data)
            
            # Commit batch when full
            if len(self.batch) >= BATCH_SIZE:
                await self.commit_batch()
        
        except Exception as e:
            self.errors += 1
            self.posts_error += 1
            print(f"Error processing message: {e}")
    
    async def commit_batch(self) -> None:
        """Commit current batch to database."""
        if not self.batch:
            return
        
        pool = await get_db()
        async with pool.acquire() as conn:
            # Save posts individually so one malformed row does not poison
            # the entire batch transaction.
            for post_data in self.batch:
                try:
                    saved = await save_post(
                        conn,
                        post_data['cid'],
                        post_data['uri'],
                        post_data['text'],
                        post_data['author_did'],
                        post_data['has_images'],
                        post_data['has_video'],
                        post_data['has_link'],
                        post_data['language'],
                        post_data['langs'],
                        post_data['post_type'],
                        post_data['reply_parent'],
                        post_data['reply_root'],
                        post_data['created_at'],
                        post_data['record_json'],
                        post_data['extracted'],
                    )
                    if saved:
                        self.posts_saved += 1
                    else:
                        self.posts_duplicate += 1
                except Exception as e:
                    self.posts_error += 1
                    self.errors += 1
                    print(f"Error committing post {post_data.get('cid')}: {e}")

            # Always advance cursor to keep ingestion moving despite bad rows.
            if self.batch:
                last = self.batch[-1]
                try:
                    await update_cursor(conn, last['cursor_seq'], last['cursor_time'])
                except Exception as e:
                    self.errors += 1
                    print(f"Error updating cursor: {e}")
        
        # Clear batch
        self.batch.clear()
        self._last_flush_monotonic = asyncio.get_event_loop().time()
    
    def print_stats(self) -> None:
        """Print detailed statistics."""
        if self.start_time:
            elapsed = (datetime.now() - self.start_time).total_seconds()
            rate = self.posts_received / elapsed if elapsed > 0 else 0
        else:
            elapsed = 0
            rate = 0
        
        print("\n" + "="*70)
        print("INGESTION STATISTICS")
        print("="*70)
        print(f"Duration: {elapsed:.1f}s | Rate: {rate:.1f} posts/sec")
        print(f"\n📥 INCOMING:")
        print(f"  Posts Received:     {self.posts_received:,}")
        print(f"  Empty Posts:        {self.posts_empty:,} ({self._pct(self.posts_empty, self.posts_received)}%)")
        print(f"\n🔍 FILTERING:")
        if INGESTION_GRAPH_MATCH_ENABLED:
            print(
                f"  Graph mode: keyword + language prefilters OFF; non-empty posts evaluated: "
                f"{self.posts_graph_candidates:,}"
            )
            print(
                f"  Graph gate rejected: {self.posts_graph_rejected:,} "
                f"({self._pct(self.posts_graph_rejected, self.posts_graph_candidates)}% of candidates)"
            )
        else:
            print(f"  No Keyword Match:   {self.posts_no_keyword_match:,} ({self._pct(self.posts_no_keyword_match, self.posts_received)}%)")
            print(f"  Keyword Matched:    {self.posts_matched_keywords:,} ({self._pct(self.posts_matched_keywords, self.posts_received)}%)")
            print(f"  Not English:        {self.posts_not_english:,} ({self._pct(self.posts_not_english, self.posts_matched_keywords)}% of matched)")
            print(f"  Lang Detect Failed: {self.posts_lang_detection_failed:,}")
            print(f"  English Posts:      {self.posts_english:,} ({self._pct(self.posts_english, self.posts_matched_keywords)}% of matched)")
        print(f"\n💾 SAVING:")
        if INGESTION_GRAPH_MATCH_ENABLED:
            print(f"  Saved Successfully: {self.posts_saved:,} ({self._pct(self.posts_saved, self.posts_graph_candidates)}% of graph candidates)")
        else:
            print(f"  Saved Successfully: {self.posts_saved:,} ({self._pct(self.posts_saved, self.posts_english)}% of English)")
        print(f"  Duplicates:         {self.posts_duplicate:,}")
        print(f"  Save Errors:         {self.posts_error:,}")
        print(f"\n❌ ERRORS:")
        print(f"  Total Errors:       {self.errors:,}")
        print("="*70 + "\n")
    
    def _pct(self, part: int, whole: int) -> float:
        """Calculate percentage."""
        return (part / whole * 100) if whole > 0 else 0.0
    
    async def run(self) -> None:
        """Main run loop - connect to Jetstream and process messages."""
        from datetime import datetime as dt
        self.start_time = dt.now()
        
        pool = await get_db()
        
        # Get last cursor position
        async with pool.acquire() as conn:
            cursor_seq, cursor_time = await get_cursor(conn)
            if cursor_seq > 0:
                print(f"Resuming from cursor: seq={cursor_seq}, time={cursor_time}")
        
        print(f"Connecting to Jetstream: {JETSTREAM_URL}")
        await self.refresh_dynamic_keywords()
        if INGESTION_GRAPH_MATCH_ENABLED:
            print(
                "INGESTION_GRAPH_MATCH enabled: keyword + language prefilters disabled; "
                "only posts passing at least one live feed graph are indexed."
            )
        else:
            print(
                f"Filtering for: {LANGUAGE_FILTER} language, keywords: "
                f"{len(self.keyword_matcher.keywords)}"
            )
        
        try:
            async with connect(JETSTREAM_URL) as websocket:
                print("Connected to Jetstream! Starting ingestion...")
                
                async for message_raw in websocket:
                    try:
                        message = json.loads(message_raw)
                        await self.process_message(message)
                        now = asyncio.get_event_loop().time()
                        if self.batch and (now - self._last_flush_monotonic) >= BATCH_FLUSH_SECONDS:
                            await self.commit_batch()
                        
                        # Periodic status update every 1000 posts
                        if self.posts_received % 1000 == 0:
                            self.print_stats()
                    
                    except json.JSONDecodeError:
                        self.errors += 1
                        continue
                    except Exception as e:
                        self.errors += 1
                        print(f"Error processing message: {e}")
                        continue
        
        except KeyboardInterrupt:
            print("\nShutting down...")
        except Exception as e:
            print(f"Connection error: {e}")
        finally:
            # Commit any remaining batch
            await self.commit_batch()
            print("\n" + "="*70)
            print("FINAL STATISTICS")
            print("="*70)
            self.print_stats()

    def _extract_record_fields(self, record: dict) -> dict:
        facets = record.get('facets') if isinstance(record.get('facets'), list) else []
        facet_link_uris = []
        facet_tags = []
        for facet in facets:
            features = facet.get('features') if isinstance(facet, dict) and isinstance(facet.get('features'), list) else []
            for feature in features:
                if not isinstance(feature, dict):
                    continue
                uri = feature.get('uri')
                tag = feature.get('tag')
                if uri:
                    facet_link_uris.append(str(uri))
                if tag:
                    facet_tags.append(str(tag))

        outline_tags = [str(t) for t in (record.get('tags') or []) if str(t).strip()]
        embed = record.get('embed') if isinstance(record.get('embed'), dict) else {}
        external = embed.get('external') if isinstance(embed.get('external'), dict) else {}
        thumb = external.get('thumb') if isinstance(external.get('thumb'), dict) else {}
        images = embed.get('images') if isinstance(embed.get('images'), list) else []
        embed_images_alt_texts = [str(img.get('alt')) for img in images if isinstance(img, dict) and img.get('alt')]

        aspect = embed.get('aspectRatio') if isinstance(embed.get('aspectRatio'), dict) else {}
        video = embed.get('video') if isinstance(embed.get('video'), dict) else {}

        media = embed.get('media') if isinstance(embed.get('media'), dict) else {}
        media_external = media.get('external') if isinstance(media.get('external'), dict) else {}
        media_images = media.get('images') if isinstance(media.get('images'), list) else []
        embed_media_images_alt_texts = [str(img.get('alt')) for img in media_images if isinstance(img, dict) and img.get('alt')]

        return {
            'facet_link_uris': list(dict.fromkeys(facet_link_uris)),
            'facet_tags': list(dict.fromkeys(facet_tags)),
            'outline_tags': list(dict.fromkeys(outline_tags)),
            'embed_external_uri': external.get('uri'),
            'embed_external_title': external.get('title'),
            'embed_external_description': external.get('description'),
            'embed_external_thumb_mime': thumb.get('mimeType'),
            'embed_external_thumb_size': thumb.get('size'),
            'embed_images_alt_texts': list(dict.fromkeys(embed_images_alt_texts)),
            'embed_video_alt_text': embed.get('alt'),
            'embed_video_mime': video.get('mimeType'),
            'embed_video_size': video.get('size'),
            'embed_video_aspect_width': aspect.get('width'),
            'embed_video_aspect_height': aspect.get('height'),
            'embed_media_images_alt_texts': list(dict.fromkeys(embed_media_images_alt_texts)),
            'embed_media_external_uri': media_external.get('uri'),
            'embed_media_external_title': media_external.get('title'),
            'embed_media_external_description': media_external.get('description'),
            'bridgy_original_text': record.get('bridgyOriginalText'),
        }
