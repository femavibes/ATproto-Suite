# Push to GitHub Instructions

The code is ready to push! Run these commands:

```bash
cd /root/modmaster-browser

# If you have SSH key set up:
git remote set-url origin git@github.com:femavibes/modmaster-browser.git
git push -u origin main

# OR if you prefer HTTPS (will ask for username/password):
git push -u origin main
```

If you get authentication errors:
1. **SSH Method** (recommended):
   - Make sure your SSH key is added to GitHub
   - Use: `git remote set-url origin git@github.com:femavibes/modmaster-browser.git`

2. **HTTPS Method**:
   - GitHub will ask for username and password/token
   - Use your GitHub username and personal access token

After pushing, the extension will be live at:
https://github.com/femavibes/modmaster-browser

Users can then:
1. Click "Code" → "Download ZIP"
2. Extract and install in Chrome
3. Start moderating on bsky.app!