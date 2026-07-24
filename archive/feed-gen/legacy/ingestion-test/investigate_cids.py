#!/usr/bin/env python3
import asyncio
import json
from websockets import connect

JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post"

async def investigate_missing_cids():
    print("Investigating messages with missing CIDs...\n")
    
    total = 0
    with_cid = 0
    without_cid = 0
    samples_without = []
    
    async with connect(JETSTREAM_URL) as websocket:
        for i in range(200):
            message = await websocket.recv()
            data = json.loads(message)
            
            if data.get('kind') == 'commit' and data.get('commit', {}).get('collection') == 'app.bsky.feed.post':
                total += 1
                commit = data.get('commit', {})
                
                if commit.get('cid'):
                    with_cid += 1
                else:
                    without_cid += 1
                    if len(samples_without) < 5:
                        samples_without.append(data)
    
    print("="*80)
    print("CID INVESTIGATION (200 posts)")
    print("="*80)
    print(f"Total posts: {total}")
    print(f"With CID: {with_cid} ({with_cid/total*100:.1f}%)")
    print(f"Without CID: {without_cid} ({without_cid/total*100:.1f}%)")
    
    if samples_without:
        print(f"\n{'='*80}")
        print("SAMPLE MESSAGES WITHOUT CID:")
        print("="*80)
        for i, sample in enumerate(samples_without[:3], 1):
            print(f"\nSample {i}:")
            print(f"  Operation: {sample.get('commit', {}).get('operation')}")
            print(f"  Collection: {sample.get('commit', {}).get('collection')}")
            print(f"  Has record: {bool(sample.get('commit', {}).get('record'))}")
            print(f"  Keys in commit: {list(sample.get('commit', {}).keys())}")
            print(f"  Full message:")
            print(json.dumps(sample, indent=4)[:500])
    
    print("\n" + "="*80)
    print("WHAT IS A CID?")
    print("="*80)
    print("CID = Content Identifier")
    print("- Cryptographic hash of the post content")
    print("- Unique identifier for each post")
    print("- Used as primary key in database")
    print("- Format: bafyrei... (IPFS CID)")
    print("\nWhy missing?")
    print("- Delete operations don't have content (no CID)")
    print("- Update operations may reference old CID")
    print("- Malformed messages")
    print("="*80)

if __name__ == "__main__":
    asyncio.run(investigate_missing_cids())
