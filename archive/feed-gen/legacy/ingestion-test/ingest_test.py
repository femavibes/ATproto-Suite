#!/usr/bin/env python3
import asyncio
import json
import time
import psycopg2
from datetime import datetime
from websockets import connect
import psutil
import sys

DB_CONFIG = {
    'dbname': 'firehose_test',
    'user': 'test',
    'password': 'test',
    'host': 'localhost',
    'port': 5435
}

JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post"

class IngestionTest:
    def __init__(self, duration_minutes, run_name=None):
        self.duration_minutes = duration_minutes
        self.run_name = run_name or f"Run {datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.run_id = None
        self.posts_received = 0
        self.posts_saved = 0
        self.errors = 0
        self.start_time = None
        self.second_counter = 0
        self.second_start = None
        self.peak_per_second = 0
        self.error_log = {}
        
    def init_db(self):
        self.conn = psycopg2.connect(**DB_CONFIG)
        self.conn.autocommit = False
        self.cursor = self.conn.cursor()
        
        # Create run record
        self.cursor.execute("""
            INSERT INTO ingestion_runs (run_name, duration_minutes, started_at, status)
            VALUES (%s, %s, %s, 'running')
            RETURNING id
        """, (self.run_name, self.duration_minutes, datetime.now()))
        self.run_id = self.cursor.fetchone()[0]
        self.conn.commit()
        
    def save_post(self, post_data):
        try:
            commit = post_data.get('commit', {})
            record = commit.get('record', {})
            
            cid = commit.get('cid')
            uri = f"at://{post_data.get('did')}/app.bsky.feed.post/{commit.get('rkey')}"
            text = record.get('text', '')
            author_did = post_data.get('did')
            
            # Validate required fields
            if not cid:
                self.errors += 1
                self.log_error("Missing CID", post_data)
                return
            if not author_did:
                self.errors += 1
                self.log_error("Missing author DID", post_data)
                return
            
            # Extract metadata
            embed = record.get('embed', {})
            has_images = 'images' in embed
            has_video = 'video' in embed
            has_link = 'external' in embed
            
            created_at = record.get('createdAt', datetime.now().isoformat())
            
            self.cursor.execute("""
                INSERT INTO posts (cid, uri, text, author_did, has_images, has_video, has_link, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (cid) DO NOTHING
            """, (cid, uri, text, author_did, has_images, has_video, has_link, created_at))
            
            if self.cursor.rowcount > 0:
                self.posts_saved += 1
            
        except Exception as e:
            self.errors += 1
            self.log_error(f"{type(e).__name__}: {str(e)}", post_data)
    
    def log_error(self, error_msg, post_data):
        error_type = error_msg.split(':')[0]
        if error_type not in self.error_log:
            self.error_log[error_type] = {'count': 0, 'samples': []}
        
        self.error_log[error_type]['count'] += 1
        if len(self.error_log[error_type]['samples']) < 3:
            self.error_log[error_type]['samples'].append({
                'error': error_msg,
                'cid': post_data.get('commit', {}).get('cid'),
                'did': post_data.get('did')
            })
            
    def record_second_metric(self):
        try:
            memory_mb = psutil.Process().memory_info().rss / 1024 / 1024
            
            self.cursor.execute("""
                INSERT INTO ingestion_metrics (run_id, timestamp, posts_count, memory_mb)
                VALUES (%s, %s, %s, %s)
            """, (self.run_id, datetime.now(), self.second_counter, int(memory_mb)))
            
            if self.second_counter > self.peak_per_second:
                self.peak_per_second = self.second_counter
                
            self.second_counter = 0
            
        except Exception as e:
            print(f"Metric error: {e}")
            
    async def run(self):
        self.init_db()
        self.start_time = time.time()
        self.second_start = time.time()
        end_time = self.start_time + (self.duration_minutes * 60)
        
        print(f"Starting ingestion test: {self.run_name}")
        print(f"Duration: {self.duration_minutes} minutes")
        print(f"Connecting to Jetstream...")
        
        try:
            async with connect(JETSTREAM_URL) as websocket:
                print("Connected! Ingesting posts...")
                
                while time.time() < end_time:
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                        data = json.loads(message)
                        
                        if data.get('kind') == 'commit' and data.get('commit', {}).get('collection') == 'app.bsky.feed.post':
                            self.posts_received += 1
                            self.second_counter += 1
                            self.save_post(data)
                            
                            # Commit every 100 posts
                            if self.posts_saved % 100 == 0:
                                self.conn.commit()
                                
                            # Record metrics every second
                            if time.time() - self.second_start >= 1.0:
                                self.record_second_metric()
                                self.conn.commit()
                                self.second_start = time.time()
                                
                                # Progress update
                                elapsed = int(time.time() - self.start_time)
                                remaining = int(end_time - time.time())
                                print(f"[{elapsed}s] Received: {self.posts_received} | Saved: {self.posts_saved} | Errors: {self.errors} | Remaining: {remaining}s")
                                
                    except asyncio.TimeoutError:
                        continue
                    except Exception as e:
                        self.errors += 1
                        
        except Exception as e:
            print(f"Connection error: {e}")
            
        finally:
            self.finalize()
            
    def finalize(self):
        duration = time.time() - self.start_time
        avg_per_second = self.posts_received / duration if duration > 0 else 0
        
        self.cursor.execute("""
            UPDATE ingestion_runs
            SET ended_at = %s,
                posts_received = %s,
                posts_saved = %s,
                errors = %s,
                avg_posts_per_second = %s,
                peak_posts_per_second = %s,
                status = 'completed'
            WHERE id = %s
        """, (datetime.now(), self.posts_received, self.posts_saved, self.errors, 
              avg_per_second, self.peak_per_second, self.run_id))
        
        self.conn.commit()
        self.cursor.close()
        self.conn.close()
        
        print("\n" + "="*60)
        print(f"INGESTION TEST COMPLETE: {self.run_name}")
        print("="*60)
        print(f"Duration: {duration:.1f}s ({self.duration_minutes} min)")
        print(f"Posts Received: {self.posts_received}")
        print(f"Posts Saved: {self.posts_saved}")
        print(f"Errors: {self.errors}")
        print(f"Avg Posts/Second: {avg_per_second:.2f}")
        print(f"Peak Posts/Second: {self.peak_per_second}")
        print("="*60)
        
        if self.error_log:
            print("\nERROR BREAKDOWN:")
            print("="*60)
            for error_type, data in sorted(self.error_log.items(), key=lambda x: x[1]['count'], reverse=True):
                print(f"\n{error_type}: {data['count']} occurrences")
                if data['samples']:
                    print("  Sample errors:")
                    for sample in data['samples'][:2]:
                        print(f"    - {sample['error'][:80]}")
                        print(f"      CID: {sample['cid']}, DID: {sample['did']}")
            print("="*60)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 ingest_test.py <duration_minutes> [run_name]")
        sys.exit(1)
        
    duration = int(sys.argv[1])
    run_name = sys.argv[2] if len(sys.argv) > 2 else None
    
    test = IngestionTest(duration, run_name)
    asyncio.run(test.run())
