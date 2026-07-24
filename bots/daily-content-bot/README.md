# Daily Content Bot

A customizable Bluesky bot for posting daily quotes and words with seasonal weighting, usage tracking, and a web management interface.

<!-- Updated: Auto-deployment with persistent data -->

## Quick Start

1. **Create docker-compose.yml file**:
   ```yaml
   services:
     daily-content-bot:
       image: ghcr.io/femavibes/daily-content-bot:latest
       ports:
         - "4000:3000"
       volumes:
         - ./data:/app/data
         - ./uploads:/app/uploads
         - ./.env:/app/.env
       restart: unless-stopped
       user: root
       env_file:
         - .env
       environment:
         - NODE_ENV=production
         - QUOTE_TAG=${QUOTE_TAG:-#QuoteOfTheDay}
         - WORD_TAG=${WORD_TAG:-#WordOfTheDay}
         - BLUESKY_HANDLE=${BLUESKY_HANDLE}
         - BLUESKY_PASSWORD=${BLUESKY_PASSWORD}
         - TIMEZONE=${TIMEZONE:-America/New_York}
   ```

2. **Create empty .env file** (required for Docker volume mount):
   ```bash
   touch .env
   ```

3. **Start the bot**:
   ```bash
   docker-compose up -d
   ```

4. **Configure the bot**:
   - Visit http://localhost:4000
   - Go to Settings (gear icon)
   - Add your Bluesky credentials
   - Set your posting schedule

5. **Add content**:
   - Use the web interface to add quotes and words
   - Or import from JSON files

That's it! The bot will automatically:
- ✅ Create all necessary directories and files
- ✅ Generate a default .env configuration
- ✅ Start with empty quote/word collections
- ✅ Provide a web interface for management

## Features

- 📝 **Quote & Word Management**: Add, edit, and organize content
- 🕒 **Flexible Scheduling**: Configure posting times and timezone
- 🎯 **Seasonal Weighting**: Boost relevant content during specific periods
- 📊 **Usage Tracking**: Avoid repetition with smart cooldowns
- 🖼️ **Image Support**: Upload images for quotes and words
- 🔄 **Import/Export**: Backup and restore your content
- ☁️ **Cloud Backup**: Optional Google Cloud Storage integration
- 🎨 **Rich Link Cards**: Automatic link previews
- 📱 **Mobile Friendly**: Responsive web interface

## Configuration

The bot creates a `.env` file automatically with default settings. Key options:

- `BLUESKY_HANDLE`: Your Bluesky username
- `BLUESKY_PASSWORD`: Your Bluesky app password
- `QUOTE_TIME_CRON`: When to post quotes (default: 9 AM)
- `WORD_TIME_CRON`: When to post words (default: 12 PM)
- `TIMEZONE`: Your timezone (default: America/New_York)
- `DRY_RUN`: Set to `true` to test without posting

## Data Persistence

Your data is stored in:
- `./data/` - JSON files with quotes, words, and settings
- `./uploads/` - Uploaded images
- `./.env` - Bot configuration (created automatically on first run)

These are mounted as Docker volumes, so your data persists across container updates.

## Advanced Usage

### Import Content
```bash
# Import quotes from JSON
curl -X POST http://localhost:4000/import-quote \
  -H "Content-Type: application/json" \
  -d @quotes.json

# Import words from JSON
curl -X POST http://localhost:4000/import-word \
  -H "Content-Type: application/json" \
  -d @words.json
```

### Backup Data
```bash
# Export all data
curl http://localhost:4000/export-all > backup.zip
```

### Development
For local development, use the development compose file:
```bash
git clone https://github.com/femavibes/daily-content-bot
cd daily-content-bot
docker-compose -f docker-compose.dev.yml up -d
```

## Support

- 📖 [Full Documentation](./DEPLOYMENT.md)
- 🐛 [Report Issues](https://github.com/femavibes/daily-content-bot/issues)
- 💬 [Discussions](https://github.com/femavibes/daily-content-bot/discussions)

## License

MIT License - see [LICENSE](LICENSE) file for details.