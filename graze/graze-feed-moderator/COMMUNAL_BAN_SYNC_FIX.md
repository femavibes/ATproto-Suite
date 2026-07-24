# Communal Ban Sync Fix

## Problem
When communal moderation bans a user but authentication fails (e.g., basic password without zero trust), the user was still added to the local database even though they couldn't be added to the Bluesky ban list. This caused the lists to be out of sync.

## Solution
Modified communal moderation to gracefully handle auth failures:

1. **Database Changes**: Added `sync_failed` column to `banned_users` table to track bans that failed to sync to Bluesky
2. **Backend Changes**: Modified communal moderation service to mark bans as `sync_failed=true` when Bluesky sync fails
3. **Frontend Changes**: Added retry button in the banned users list to manually retry failed syncs
4. **API Endpoint**: Added `/api/moderation/retry-ban-sync` endpoint to retry failed syncs

## Files Modified

### Backend
- `/root/feed-moderator/backend/src/services/communalModeration.ts` - Added sync_failed tracking
- `/root/feed-moderator/backend/src/routes/moderation.ts` - Added retry endpoint and updated banned users query

### Frontend
- `/root/feed-moderator/frontend/src/components/tabs/BanTab.vue` - Added retry button UI and function

### Database
- `/root/feed-moderator/add_sync_failed_column.sql` - Migration to add sync_failed column

## How It Works

### For Communal Bans
1. When communal moderation triggers a ban, it tries to add the user to the Bluesky list
2. If the Bluesky sync fails (auth error, network error, etc.), the ban is still added to the local database BUT marked with `sync_failed=true`
3. The user appears in the banned users list with a warning icon and "Retry Sync" button
4. Clicking "Retry Sync" attempts to add them to the Bluesky list again
5. Once successful, the `sync_failed` flag is cleared

### For Manual Bans
Manual bans still fail immediately if auth doesn't work (no changes to that behavior).

## Database Migration

Run this SQL to add the column:

```sql
ALTER TABLE banned_users ADD COLUMN IF NOT EXISTS sync_failed BOOLEAN DEFAULT false;
```

Or run the migration file:
```bash
psql -U your_user -d feed_moderator -f add_sync_failed_column.sql
```

## Benefits
- Communal moderation continues to work even when auth is temporarily broken
- Users are still banned locally (posts removed, etc.)
- Clear visibility of which bans need to be synced
- Easy one-click retry mechanism
- No data loss or out-of-sync issues
