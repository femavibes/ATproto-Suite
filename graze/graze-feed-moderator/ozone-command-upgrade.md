# Ozone Command System Upgrade Plan

## Overview
Expand the Ozone command system to support reversible actions and additional moderation capabilities.

## Current Commands (Implemented)
- `remove` / `remove all` / `remove feed1,feed2` - Remove posts from feeds
- `ban` / `ban all` / `ban feed1,feed2` - Ban users from feeds
- `label labelname` / `label label1,label2` - Apply labels (custom labelers + admins only)
- `unlabel labelname` / `unlabel label1,label2` - Remove labels (custom labelers + admins only)

## New Commands (Implemented)
- `restore` / `restore all` / `restore feed1,feed2` - Restore previously removed posts
- `unban` / `unban all` / `unban feed1,feed2` - Unban previously banned users
- `bulk remove` / `bulk remove feed1,feed2 50` / `bulk remove all 100` - Bulk remove user's recent posts
- `bulk restore` / `bulk restore feed1,feed2 50` / `bulk restore all 100` - Bulk restore user's recent posts

## Backend Implementation (Completed)

### 1. Command Parser Updates ✅
- Updated `ModMasterCommandParser` to support all 6 commands
- Added validation for admin-only label commands
- Support for comma-separated targets and bulk operations

### 2. Service Layer Updates ✅
- Updated `MultiUserCommandProcessor` to use new parser
- Implemented all command handlers:
  - `handleRemoveCommand` - Remove posts from feeds
  - `handleRestoreCommand` - Restore previously removed posts
  - `handleBanCommand` - Ban users from feeds/global
  - `handleUnbanCommand` - Unban users from feeds/global
  - `handleBulkRemoveFromAccount` - Bulk remove user's recent posts
  - `handleBulkRestoreFromAccount` - Bulk restore user's recent posts

### 3. Database Schema Updates ✅
- Added `post_removals` table for tracking removals
- Added `post_restorations` table for audit trail
- Added indexes for performance
- Updated `Database` class with new methods:
  - `logPostRemoval` - Track post removals for restoration
  - `logPostRestoration` - Log restoration actions
  - `getRecentlyRemovedPosts` - Find posts to restore
  - `unbanUser` - Updated unban logic

### 4. Graze Service Updates ✅
- Added `restorePost` method (alias to `unhidePost`)
- Existing methods support 'all' feeds parameter

### 5. Migration Files ✅
- Created `add_command_tracking_tables.sql` migration
- Includes all necessary tables and indexes

## Additional Command Ideas

### Moderation Commands
- `mute` / `unmute` - Temporary silence without full ban
- `warn` - Issue warning to user (logged action)
- `escalate` - Forward to higher-level moderators
- `review` - Mark for manual review
- `approve` - Explicitly approve content
- `reject` - Explicitly reject without removal

### Bulk Commands
- `purge username` - Remove all content from specific user
- `cleanup` - Remove all content matching certain criteria
- `audit feedname` - Generate report of all actions on feed

### Time-based Commands
- `tempban 24h` / `tempban 7d` - Temporary bans with auto-expiry
- `schedule remove 1h` - Delayed action execution

### Label Management (Admin/Custom Labeler)
- `relabel old_label new_label` - Change existing labels
- `expire label 30d` - Set label expiration
- `priority label high` - Set label priority/severity

### Feed Management
- `pause feedname` - Temporarily disable feed processing
- `resume feedname` - Re-enable feed processing
- `sync feedname` - Force feed synchronization

## Permission Matrix

| Command | Regular User | Admin | Custom Labeler Owner |
|---------|-------------|-------|---------------------|
| remove/restore | Own feeds only | All feeds | Own feeds only |
| ban/unban | Own feeds only | All feeds | Own feeds only |
| label/unlabel | ❌ | ✅ | Own labeler only |
| mute/unmute | Own feeds only | All feeds | Own feeds only |
| tempban | Own feeds only | All feeds | Own feeds only |
| purge | ❌ | ✅ | Own feeds only |
| pause/resume | Own feeds only | All feeds | Own feeds only |

## Implementation Status

### Phase 1 (Completed) ✅
1. `restore` command - Implemented with full feed targeting
2. `unban` command - Implemented with global/feed targeting
3. `bulk_remove` command - Implemented with count limits
4. `bulk_restore` command - Implemented with restoration tracking
5. Database schema updates - Migration created
6. Comprehensive logging - All actions logged

### Phase 2 (Future)
1. `label` / `unlabel` commands for custom labelers
2. `mute` / `unmute` commands
3. `tempban` with time limits
4. `warn` command for user notifications

### Phase 3 (Future)
1. Advanced bulk operations (`purge`, `cleanup`)
2. Feed management commands
3. Scheduled/delayed actions

## Testing Requirements
- ✅ Command parser unit tests (via existing test file)
- 🔄 Integration tests for database operations
- 🔄 End-to-end tests for Ozone integration
- ✅ Permission validation (built into parser)
- 🔄 Rollback/restoration accuracy tests
- 🔄 Bulk operation limits testing (max 100 posts)
- 🔄 Feed ownership validation testing

## Deployment Steps
1. ✅ Deploy parser changes
2. ✅ Run database migration: `add_command_tracking_tables.sql`
3. ✅ Deploy backend command handlers
4. ✅ Update frontend documentation
5. ✅ Add comprehensive logging
6. ✅ Fix TypeScript build errors
7. ✅ Deploy to production
8. 🔄 Test with limited user group
9. 🔄 Full rollout with monitoring

## Testing Commands
Users can now test these commands in Ozone report comments:
- `remove feed1,feed2` - Remove from specific feeds
- `restore all` - Restore to all feeds
- `ban global,feed1` - Ban from global + specific feed
- `unban feed1` - Unban from specific feed
- `bulk remove feed1 25` - Remove last 25 posts from feed
- `bulk restore all 50` - Restore last 50 posts to all feeds