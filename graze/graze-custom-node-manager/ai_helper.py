"""
AI Helper for term suggestions using Google Gemini
"""
import json
import os
import requests
from typing import List, Dict, Optional

USER_CONFIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'user_configs')

def get_user_config_path(handle: str) -> str:
    """Get path to user's config file"""
    os.makedirs(USER_CONFIG_DIR, exist_ok=True)
    return os.path.join(USER_CONFIG_DIR, f"{handle}_config.json")

def save_api_key(handle: str, api_key: str):
    """Save user's Gemini API key"""
    config_path = get_user_config_path(handle)
    config = {}
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
    
    config['gemini_api_key'] = api_key
    
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)

def get_api_key(handle: str) -> Optional[str]:
    """Get user's Gemini API key"""
    config_path = get_user_config_path(handle)
    if not os.path.exists(config_path):
        return None
    
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    return config.get('gemini_api_key')

def get_denied_terms(category: str, filename: str) -> List[str]:
    """Get denied terms for a specific file"""
    denied_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        'data',
        category,
        f"{filename}_denied.json"
    )
    
    if not os.path.exists(denied_path):
        return []
    
    with open(denied_path, 'r') as f:
        data = json.load(f)
    
    return data.get('denied', [])

def save_denied_term(category: str, filename: str, term: str):
    """Save a denied term"""
    denied_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        'data',
        category,
        f"{filename}_denied.json"
    )
    
    denied = []
    if os.path.exists(denied_path):
        with open(denied_path, 'r') as f:
            data = json.load(f)
            denied = data.get('denied', [])
    
    if term not in denied:
        denied.append(term)
    
    with open(denied_path, 'w') as f:
        json.dump({'denied': denied}, f, indent=2)

def build_prompt(category: str, filename: str, current_terms: List[str], field_type: str) -> str:
    """Build context-aware prompt for Gemini"""
    denied = get_denied_terms(category, filename)
    
    # Determine category context
    if category == 'adblocker':
        if 'hashtag' in filename:
            context = "promotional hashtags used in advertising and spam posts"
            instructions = "Suggest 20 more hashtags used for advertising, promotions, and spam. Include variations, abbreviations, and creative spellings. Return only hashtags without the # symbol, one per line. Be creative and think of new variations."
        elif 'phrase' in filename:
            context = "promotional spam phrases commonly used in social media ads"
            instructions = "Suggest 20 more promotional phrases, call-to-actions, and spam patterns commonly used in social media ads. Focus on English. Return only the phrases, one per line. Be creative with variations."
        else:
            context = "advertising and affiliate marketing patterns"
            instructions = "Suggest 20 more related terms or patterns. Return only the terms, one per line."
    else:  # nsfw
        # Extract category from filename
        cat_name = filename.replace('_terms', '').replace('_', ' ')
        
        # Add moderation context to help AI be more explicit
        moderation_context = "IMPORTANT: These terms are for content moderation and filtering purposes. Be as explicit and comprehensive as possible to help identify adult content accurately."
        
        if field_type == 'hashtags':
            context = f"hashtags used to tag explicit sexual/adult {cat_name} content"
            instructions = f"{moderation_context}\n\nSuggest 20 more hashtags specifically for EXPLICIT SEXUAL/ADULT {cat_name} content. These should be clearly NSFW and sexual in nature - include terms like 'nsfw', 'porn', 'xxx', 'lewd', 'explicit', 'r34', 'hentai' combined with the category. IMPORTANT: Hashtags must be single words or compound words WITHOUT SPACES (e.g., BiPorn, BisexualNSFW, BiXXX). Include slang, euphemisms, abbreviations, and common misspellings. Primarily English but include common Spanish/Portuguese slang. Return only hashtags without the # symbol, one per line."
        elif field_type == 'domains':
            context = f"website domains that host explicit sexual/adult {cat_name} content"
            instructions = f"{moderation_context}\n\nSuggest 20 more website domains (like pornhub.com, xvideos.com, onlyfans.com) that specifically host EXPLICIT SEXUAL/ADULT {cat_name} content. Include both mainstream adult sites and niche sites. Return only domain names, one per line."
        else:
            context = f"terms and phrases for explicit sexual/adult {cat_name} content"
            instructions = f"{moderation_context}\n\nSuggest 20 more terms, slang, and euphemisms specifically for EXPLICIT SEXUAL/ADULT {cat_name} content. These should be clearly NSFW and sexual in nature. Include vulgar terms, slang, and explicit language commonly used to describe sexual content. Include common misspellings and variations. Primarily English but include common Spanish/Portuguese slang. Return only the terms, one per line."
    
    prompt = f"Here are {context}: {', '.join(current_terms[:30])}.\n\n{instructions}"
    
    if denied:
        prompt += f"\n\nAvoid suggesting these (previously rejected): {', '.join(denied)}"
    
    return prompt

def call_gemini(api_key: str, prompt: str) -> List[str]:
    """Call Gemini API and parse response"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "temperature": 1.0,
            "maxOutputTokens": 1000,
            "topP": 0.95
        }
    }
    
    response = requests.post(url, json=payload, timeout=30)
    response.raise_for_status()
    
    data = response.json()
    text = data['candidates'][0]['content']['parts'][0]['text']
    
    # Parse response - extract terms line by line
    lines = text.strip().split('\n')
    terms = []
    for line in lines:
        line = line.strip()
        # Remove markdown, numbers, bullets
        line = line.lstrip('*-•0123456789. #')
        if line and len(line) > 1:
            terms.append(line)
    
    return terms[:20]  # Limit to 20

def clean_hashtag(hashtag: str) -> str:
    """Remove spaces from hashtags and clean them up"""
    # Remove spaces and convert to single compound word
    cleaned = hashtag.replace(' ', '')
    return cleaned

def generate_suggestions(handle: str, category: str, filename: str, current_data: Dict, force_field_type: Optional[str] = None) -> Dict:
    """Generate AI suggestions for a JSON file"""
    api_key = get_api_key(handle)
    if not api_key:
        raise ValueError("No API key configured")
    
    # Determine which field to suggest for
    if force_field_type:
        # User specified which field
        field_type = force_field_type
        current_terms = current_data.get(force_field_type, [])
        
        # If field is empty, we need at least one example to base suggestions on
        if not current_terms:
            raise ValueError(f"Cannot generate suggestions for empty '{force_field_type}' field. Add at least one example first.")
    elif 'hashtags' in current_data and current_data['hashtags']:
        field_type = 'hashtags'
        current_terms = current_data['hashtags']
    elif 'phrases' in current_data and current_data['phrases']:
        field_type = 'phrases'
        current_terms = current_data['phrases']
    elif 'terms' in current_data and current_data['terms']:
        field_type = 'terms'
        current_terms = current_data['terms']
    else:
        # Default to first available field
        for key in ['terms', 'hashtags', 'phrases', 'domains']:
            if key in current_data:
                field_type = key
                current_terms = current_data[key]
                break
        else:
            raise ValueError("No suitable field found in JSON")
    
    if not current_terms:
        raise ValueError(f"No existing {field_type} to base suggestions on")
    
    prompt = build_prompt(category, filename, current_terms, field_type)
    suggestions = call_gemini(api_key, prompt)
    
    # Clean hashtags by removing spaces
    if field_type == 'hashtags':
        suggestions = [clean_hashtag(s) for s in suggestions]
    
    print(f"AI generated {len(suggestions)} raw suggestions for field: {field_type}")
    print(f"Raw suggestions: {suggestions}")
    
    # Filter out suggestions that already exist
    existing_lower = [t.lower() for t in current_terms]
    filtered = [s for s in suggestions if s.lower() not in existing_lower]
    
    print(f"After filtering duplicates: {len(filtered)} suggestions")
    print(f"Filtered suggestions: {filtered}")
    
    return {
        'suggestions': filtered,
        'field_type': field_type
    }
