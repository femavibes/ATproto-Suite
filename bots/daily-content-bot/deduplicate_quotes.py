#!/usr/bin/env python3
import json
from datetime import datetime

def deduplicate_quotes(file_path):
    with open(file_path, 'r') as f:
        quotes = json.load(f)
    
    # Group by unique content (text, author, source)
    unique_quotes = {}
    
    for quote in quotes:
        key = (quote['text'], quote['author'], quote['source'])
        
        if key not in unique_quotes:
            unique_quotes[key] = quote
        else:
            # Merge usage data
            existing = unique_quotes[key]
            existing['usageCount'] += quote['usageCount']
            
            # Keep earliest firstUsed
            if quote['firstUsed'] < existing['firstUsed']:
                existing['firstUsed'] = quote['firstUsed']
            
            # Keep latest lastUsed
            if quote['lastUsed'] > existing['lastUsed']:
                existing['lastUsed'] = quote['lastUsed']
            
            # Merge other fields if they're more complete
            if not existing.get('image_path') and quote.get('image_path'):
                existing['image_path'] = quote['image_path']
            
            if not existing.get('display_type') and quote.get('display_type'):
                existing['display_type'] = quote['display_type']
            
            if not existing.get('hidden_tags') and quote.get('hidden_tags'):
                existing['hidden_tags'] = quote['hidden_tags']
    
    # Convert back to list
    deduplicated = list(unique_quotes.values())
    
    # Write back to file
    with open(file_path, 'w') as f:
        json.dump(deduplicated, f, indent=2)
    
    print(f"Reduced from {len(quotes)} to {len(deduplicated)} quotes")

if __name__ == "__main__":
    deduplicate_quotes("used_quotes.json")