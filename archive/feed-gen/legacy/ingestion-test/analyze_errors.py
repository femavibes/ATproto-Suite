#!/usr/bin/env python3
import asyncio
import json
from websockets import connect
import psycopg2

DB_CONFIG = {
    'dbname': 'firehose_test',
    'user': 'test',
    'password': 'test',
    'host': 'localhost',
    'port': 5435
}

JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post"

async def test_errors():
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    error_types = {}
    success = 0
    
    print("Testing 100 posts to see what errors occur...\n")
    
    async with connect(JETSTREAM_URL) as websocket:
        for i in range(100):
            message = await websocket.recv()
            data = json.loads(message)
            
            if data.get('kind') == 'commit' and data.get('commit', {}).get('collection') == 'app.bsky.feed.post':
                try:
                    commit = data.get('commit', {})
                    record = commit.get('record', {})
                    
                    cid = commit.get('cid')
                    uri = f"at://{data.get('did')}/app.bsky.feed.post/{commit.get('rkey')}"
                    text = record.get('text', '')
                    author_did = data.get('did')
                    created_at = record.get('createdAt')
                    
                    cursor.execute("""
                        INSERT INTO posts (cid, uri, text, author_did, created_at)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (cid, uri, text, author_did, created_at))
                    
                    conn.commit()
                    success += 1
                    
                except Exception as e:
                    error_type = type(e).__name__
                    error_msg = str(e)
                    
                    # Categorize error
                    if 'duplicate key' in error_msg.lower():
                        category = "Duplicate CID"
                    elif 'null value' in error_msg.lower():
                        category = "Missing required field"
                    elif 'invalid' in error_msg.lower():
                        category = "Invalid data format"
                    else:
                        category = f"{error_type}: {error_msg[:50]}"
                    
                    error_types[category] = error_types.get(category, 0) + 1
                    conn.rollback()
    
    cursor.close()
    conn.close()
    
    print("="*60)
    print("ERROR ANALYSIS (100 posts)")
    print("="*60)
    print(f"Successful saves: {success}")
    print(f"Total errors: {sum(error_types.values())}")
    print(f"\nError breakdown:")
    for error, count in sorted(error_types.items(), key=lambda x: x[1], reverse=True):
        print(f"  {error}: {count}")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(test_errors())
