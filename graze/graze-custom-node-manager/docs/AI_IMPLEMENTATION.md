# AI Suggestion Feature - Implementation Summary

## What Was Built

An AI-powered term suggestion system that helps expand filter lists for NSFW and AdBlocker categories using Google Gemini API.

## Files Created

1. **`ai_helper.py`** - Backend AI integration
   - Gemini API client
   - Per-user API key storage
   - Denied terms tracking
   - Context-aware prompt generation

2. **`web/static/js/ai-suggestions.js`** - Frontend UI
   - AI configuration modal
   - Suggestions review interface
   - Approve/deny workflow

3. **`docs/AI_SUGGESTIONS.md`** - User documentation

4. **`data/user_configs/`** - Directory for per-user API keys

## Files Modified

1. **`web/app.py`** - Added API endpoints:
   - `GET /api/ai/config` - Check API key status
   - `POST /api/ai/config` - Save API key
   - `POST /api/ai/suggest` - Generate suggestions
   - `POST /api/ai/deny` - Mark term as denied

2. **`web/static/js/nsfw_filter.js`**
   - Added AI button integration
   - Added `addNSFWTermFromAI()` function

3. **`web/static/js/adblocker.js`**
   - Added AI button integration
   - Added `addAdBlockerTermFromAI()` function

4. **`web/static/app.js`**
   - Imported AI suggestions module

5. **`web/templates/index.html`**
   - Added "🤖 AI Suggest" buttons to both managers

## How It Works

### User Flow

1. User opens NSFW Manager or AdBlocker Manager
2. Selects a supported category (e.g., `oral_terms.json` or `ad_phrases.json`)
3. Clicks "🤖 AI Suggest" button
4. If no API key: prompted to configure Gemini API key
5. AI generates 15 suggestions based on existing terms
6. User reviews each suggestion:
   - **Approve**: Adds to current list (not saved until "Save Changes")
   - **Deny**: Logs to `{filename}_denied.json` to avoid future suggestions

### Backend Flow

1. Load user's API key from `data/user_configs/{handle}_config.json`
2. Load current terms from target JSON file
3. Load denied terms from `{filename}_denied.json`
4. Build context-aware prompt based on category type
5. Call Gemini API with prompt
6. Parse response into list of terms
7. Filter out duplicates and denied terms
8. Return suggestions to frontend

### Prompt Strategy

**For NSFW categories:**
```
Here are terms and phrases related to {category} NSFW content: [existing terms].

Suggest 15 more terms, slang, and euphemisms related to {category}. 
Include common misspellings. Primarily English but include common 
Spanish/Portuguese slang. Return only the terms, one per line.

Avoid suggesting these (previously rejected): [denied terms]
```

**For AdBlocker categories:**
```
Here are promotional spam phrases: [existing terms].

Suggest 15 more promotional phrases, call-to-actions, and spam patterns. 
Focus on English. Return only the phrases, one per line.

Avoid suggesting these (previously rejected): [denied terms]
```

## Supported Categories

### NSFW Manager
- All `*_terms.json` files (40+ categories)
- Examples: `oral_terms.json`, `anal_terms.json`, `fetish_terms.json`

### AdBlocker Manager
- `ad_hashtags.json` - Promotional hashtags
- `ad_phrases.json` - Spam phrases

## API Key Storage

- Per-user storage in `/data/user_configs/{handle}_config.json`
- Format:
```json
{
  "gemini_api_key": "AIza..."
}
```

## Denied Terms Storage

- Per-file storage in same directory as source JSON
- Format: `/data/{category}/{filename}_denied.json`
- Example: `/data/nsfw/oral_terms_denied.json`
```json
{
  "denied": ["term1", "term2", "term3"]
}
```

## Technical Details

- **AI Model**: Gemini 1.5 Flash
- **Temperature**: 0.9 (creative but controlled)
- **Max Tokens**: 500
- **Request Timeout**: 30 seconds
- **Suggestions per request**: 15 (filtered to remove duplicates)

## Security Considerations

- API keys stored in plaintext (acceptable for local deployment)
- No data sent to external servers except Google Gemini API
- Per-user isolation of API keys
- No logging of API keys in application logs

## Future Enhancements

Possible improvements:
- Batch approve/deny all suggestions
- Confidence scores for suggestions
- Learning from user's approve/deny patterns
- Support for more categories
- Local LLM option for privacy
- API usage tracking and limits
