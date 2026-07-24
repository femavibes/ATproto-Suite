# AI Suggestion Feature

## Overview

The AI Suggestion feature uses Google Gemini to automatically generate additional terms, hashtags, and phrases for your NSFW and AdBlocker filters.

## Setup

1. **Get a Gemini API Key**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a new API key (free tier available)
   - Copy the API key

2. **Configure in the App**
   - Login to the Custom Node Manager
   - Open NSFW Manager or AdBlocker Manager
   - Click the "🤖 AI Suggest" button (appears for supported categories)
   - If no API key is configured, you'll be prompted to enter one
   - Paste your API key and save

## Supported Categories

### NSFW Manager
- All `*_terms.json` files (e.g., oral_terms, anal_terms, etc.)
- AI suggests both terms and hashtags based on existing content

### AdBlocker Manager
- `ad_hashtags.json` - Promotional hashtags
- `ad_phrases.json` - Spam phrases and call-to-actions

## How It Works

1. **Click "🤖 AI Suggest"** on a supported category
2. AI reads your current terms/hashtags
3. Generates 15 new suggestions based on:
   - Similar terms and variations
   - Common slang and euphemisms
   - Intentional misspellings
   - Related phrases
4. Review each suggestion:
   - **✓ Approve** - Adds to your list
   - **✗ Deny** - Rejects and remembers (won't suggest again for this file)

## Denied Terms

- Denied terms are saved per-file in `*_denied.json` files
- AI won't suggest the same term again for that specific file
- Denied terms CAN appear in suggestions for different files
- Example: Denying "xxx" in `oral_terms.json` won't prevent it from appearing in `general_terms.json`

## API Usage

- Uses Gemini 1.5 Flash (fast and cheap)
- Free tier: 1500 requests/day
- Each suggestion request counts as 1 API call
- Cost: ~$0.0005 per request (if exceeding free tier)

## Privacy

- API keys are stored per-user in `/data/user_configs/{handle}_config.json`
- Keys are stored in plaintext (local deployment only)
- No data is sent to any server except Google's Gemini API

## Troubleshooting

**"No API key configured"**
- Click the prompt to configure your API key
- Make sure you're logged in

**"AI generation failed"**
- Check your API key is valid
- Verify you haven't exceeded free tier limits
- Check internet connection

**No suggestions generated**
- Make sure the category has existing terms to base suggestions on
- Try a different category
- AI may have filtered out all suggestions as duplicates

## Tips

- Start with categories that have at least 5-10 existing terms
- Review suggestions carefully - AI isn't perfect
- Use deny liberally to train the AI for your preferences
- Save your changes after approving terms
