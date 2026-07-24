# Daily Content Bot Feature Plan

This document outlines the planned features for the Daily Content Bot - a customizable Bluesky bot for posting quotes and words.

## Core Feature: Web Interface

- **Quote Management:** Add, edit, and delete quotes.
- **Word Management:** Add, edit, and delete words for the "Word of the Day" feature.
- **Schedule Management:** View and update the cron schedules for both "Quote of the Day" and "Word of the Day".
- **Manual Posting:**
  - "Post Quote Now" button to manually trigger a quote post.
  - "Post Word Now" button to manually trigger a word of the day post.
- **Posting History:** View a log of previously posted quotes and words.

## Content Features

### Quotes

- **JSON Data Structure:** Quotes will be stored in a `quotes.json` file with the following structure:
  ```json
  {
    "text": "The quote itself.",
    "author": "The author of the quote.",
    "source": "An optional source for the quote (e.g., a book, a movie).",
    "image_url": "An optional URL to an image to attach to the post.",
    "link_url": "An optional URL to attach to the post.",
    "category": "An optional category for the quote.",
    "seasonal_tags": ["winter", "christmas"]
  }
  ```
- **Categorization:** The ability to categorize quotes for more advanced posting logic.

### Word of the Day

- **Dual Bot Functionality:** The bot will post a "Word of the Day" in addition to the "Quote of the Day".
- **Local Data:** Words and their definitions will be stored in a `words.json` file.
- **JSON Data Structure:** Words will be stored in a `words.json` file with the following structure:
  ```json
  {
    "word": "Your word.",
    "definition": "The definition of the word.",
    "example": "An optional example sentence.",
    "image_url": "An optional URL to an image.",
    "seasonal_tags": ["spring", "new_year"]
  }
  ```
- **Separate Scheduling:** The Word of the Day will have its own cron schedule, configurable via an environment variable.

## Bot & System Improvements

- **Health Check Endpoint:** A `/health` endpoint to monitor the bot's status.
- **Seasonal Content System:** Time-specific content tagging with weighted randomization for seasonal posts.

## Seasonal Content Feature

- **Seasonal Tags:** Add `seasonal_tags` array to quotes and words for time-specific content.
- **Configurable Periods:** Define seasonal periods in `seasonal_periods.json` with start/end dates.
- **Weighted Selection:** Content with active seasonal tags gets boosted probability:
  - 1 active tag: 3x weight
  - 2 active tags: 4x weight  
  - 3+ active tags: 5x weight (capped)
- **Smart Distribution:** Seasonal content appears more frequently during active periods without completely dominating the feed.
- **Cross-Year Support:** Handle periods that span across years (e.g., winter: Dec-Feb).
- **API Management:** Endpoints to manage seasonal periods and view currently active tags.


Looking at your setup, you have a pretty comprehensive urbanism quote bot! Here are some potential features you might be missing:

Content Management:

Bulk import/export - Upload CSV/JSON files with multiple quotes/words at once

Categories/tags - Better organization and filtering by topics (transit, housing, etc.)

Content validation - Check for duplicates, character limits, URL validation

Content statistics - Show total counts, usage rates, most popular content

Posting Features:

Preview posts - See exactly how they'll look on Bluesky before posting

Post templates - Customize the format beyond just hashtags

Multiple accounts - Post to different Bluesky accounts

Cross-posting - Also post to Twitter, Mastodon, etc.

Analytics & Monitoring:

Post performance - Track likes, reposts, replies from Bluesky API

Usage analytics - Which quotes/words perform best

Error logging - Better tracking of failed posts

Health monitoring - Alert if posting stops working

Scheduling & Automation:

Content queues - Pre-schedule specific content for future dates

Smart scheduling - Avoid posting during low-engagement times

Seasonal content - Automatically post holiday/event-specific content

Content rotation - Ensure variety in posting patterns

User Experience:

Dark mode - Toggle interface theme

Mobile responsive - Better mobile interface

Keyboard shortcuts - Quick actions for power users

Undo/restore - Recover accidentally deleted content

Integration:

Webhook notifications - Get notified when posts go live

API endpoints - Let other tools add content

Backup/sync - Automatic backups to cloud storage

Which of these sound most useful for your urbanism content?