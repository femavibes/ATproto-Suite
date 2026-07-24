# Testing the AI Suggestion Feature

## Quick Start

1. **Start the application**
   ```bash
   cd /root/custom-nodes
   docker compose up
   ```

2. **Login**
   - Open http://localhost:5000
   - Click "Login"
   - Enter your Bluesky handle and app password

3. **Configure Gemini API Key**
   - Get free API key: https://aistudio.google.com/app/apikey
   - Open NSFW Manager or AdBlocker Manager
   - Click "🤖 AI Suggest" on any supported category
   - Enter your API key when prompted
   - Click "Save"

4. **Test AI Suggestions**
   
   **For NSFW:**
   - Open NSFW Manager
   - Select "Oral Terms" (has existing data)
   - Click "🤖 AI Suggest"
   - Wait for suggestions to generate
   - Review and approve/deny suggestions
   
   **For AdBlocker:**
   - Open AdBlocker Manager
   - Select "Ad Hashtags" or "Ad Phrases"
   - Click "🤖 AI" button
   - Review suggestions

## Test Cases

### Test 1: First Time Setup
- [ ] Click AI button without API key
- [ ] Should prompt for API key
- [ ] Enter valid API key
- [ ] Should save successfully

### Test 2: Generate Suggestions
- [ ] Select category with existing terms
- [ ] Click AI button
- [ ] Should show "Generating suggestions..."
- [ ] Should display 10-15 suggestions
- [ ] Suggestions should be relevant to category

### Test 3: Approve Suggestions
- [ ] Click "✓ Approve" on a suggestion
- [ ] Term should disappear from suggestions
- [ ] Term should appear in the category list
- [ ] Click "Save Changes" to persist

### Test 4: Deny Suggestions
- [ ] Click "✗ Deny" on a suggestion
- [ ] Term should disappear from suggestions
- [ ] Generate suggestions again
- [ ] Denied term should NOT reappear

### Test 5: Error Handling
- [ ] Enter invalid API key
- [ ] Should show error message
- [ ] Try category with no existing terms
- [ ] Should show appropriate error

## Expected Behavior

### NSFW Categories
- **oral_terms.json**: Should suggest terms like "fellatio", "head", "suck", etc.
- **anal_terms.json**: Should suggest related terms
- **fetish_terms.json**: Should suggest various kink-related terms

### AdBlocker Categories
- **ad_hashtags.json**: Should suggest hashtags like "sale", "discount", "limited", etc.
- **ad_phrases.json**: Should suggest phrases like "buy now", "limited time", "act fast", etc.

## Troubleshooting

**"No API key configured"**
- Make sure you're logged in
- Click the prompt to configure

**"AI generation failed"**
- Check API key is valid
- Check internet connection
- Verify Gemini API is accessible

**No suggestions appear**
- Check browser console for errors
- Verify category has existing terms
- Try a different category

**Suggestions are duplicates**
- AI filters duplicates automatically
- If all suggestions are duplicates, you'll see "No new suggestions"

## API Key Management

**View current API key:**
- Open browser console
- Run: `fetch('/api/ai/config').then(r => r.json()).then(console.log)`

**Update API key:**
- Click AI button
- Click "Configure" or settings icon
- Enter new API key

## Files to Check

**User config:**
```bash
cat /root/custom-nodes/data/user_configs/{your_handle}_config.json
```

**Denied terms:**
```bash
cat /root/custom-nodes/data/nsfw/oral_terms_denied.json
cat /root/custom-nodes/data/adblocker/ad_phrases_denied.json
```

## Manual API Test

Test the Gemini API directly:

```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Suggest 5 promotional hashtags for social media ads"
      }]
    }]
  }'
```

## Success Criteria

✅ API key can be saved and retrieved
✅ AI generates relevant suggestions
✅ Approved terms are added to lists
✅ Denied terms are logged and not re-suggested
✅ Changes persist after saving
✅ Works for both NSFW and AdBlocker categories
