#!/usr/bin/env python3
import asyncio
import json
from websockets import connect
from datetime import datetime

JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post"

async def capture_samples(count=10):
    print(f"Capturing {count} Jetstream samples...\n")
    
    samples = []
    async with connect(JETSTREAM_URL) as websocket:
        for i in range(count):
            message = await websocket.recv()
            data = json.loads(message)
            
            if data.get('kind') == 'commit' and data.get('commit', {}).get('collection') == 'app.bsky.feed.post':
                samples.append(data)
                print(f"Sample {i+1}/{count} captured")
                
                if i == 0:  # Print first sample in detail
                    print("\n" + "="*80)
                    print("SAMPLE JETSTREAM MESSAGE:")
                    print("="*80)
                    print(json.dumps(data, indent=2))
                    print("="*80 + "\n")
    
    # Save to file
    filename = f"jetstream_samples_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w') as f:
        json.dump(samples, f, indent=2)
    
    print(f"\n✓ Saved {len(samples)} samples to {filename}")
    
    # Print summary
    print("\n" + "="*80)
    print("JETSTREAM DATA STRUCTURE:")
    print("="*80)
    if samples:
        sample = samples[0]
        print(f"Top-level keys: {list(sample.keys())}")
        print(f"Commit keys: {list(sample.get('commit', {}).keys())}")
        print(f"Record keys: {list(sample.get('commit', {}).get('record', {}).keys())}")
        
        record = sample.get('commit', {}).get('record', {})
        print(f"\nPost text: {record.get('text', 'N/A')[:100]}")
        print(f"Author DID: {sample.get('did')}")
        print(f"Created: {record.get('createdAt')}")
        print(f"Has embed: {bool(record.get('embed'))}")
        print(f"Has facets: {bool(record.get('facets'))}")
        print(f"Has reply: {bool(record.get('reply'))}")
        print(f"Languages: {record.get('langs')}")

if __name__ == "__main__":
    asyncio.run(capture_samples(10))
