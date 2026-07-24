# Admin Threshold System Plan

## Overview
Create a comprehensive admin-controlled threshold system that serves as defaults for new users and provides optional sync for existing users.

## Current System (CONFIRMED)
- **User Global Thresholds** in `user_profiles` table:
  - `global_threshold_*` columns (post removal thresholds, default: 3)
  - `global_user_ban_threshold_*` columns (user ban thresholds, default: 5)
  - Includes main categories + detailed subcategories (spam, scam, bot, etc.)
- **Per-Feed Thresholds** in `feeds` table:
  - `threshold_*` columns (post removal, default: NULL)
  - `user_ban_threshold_*` columns (user ban, default: NULL)
  - When NULL, falls back to user's global settings
- New users get hardcoded defaults in database schema

## Proposed System

### 1. Admin Default Thresholds (New Table: `admin_defaults`)
```sql
CREATE TABLE admin_defaults (
  id SERIAL PRIMARY KEY,
  threshold_type VARCHAR(50) NOT NULL, -- 'global' or 'feed'
  category VARCHAR(50) NOT NULL,       -- 'spam', 'harassment', etc.
  subcategory VARCHAR(50),             -- 'spam', 'scam', 'bot', etc.
  post_threshold INTEGER NOT NULL,     -- threshold for post removal
  user_ban_threshold INTEGER NOT NULL, -- threshold for user banning
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. User Sync Preferences (Add to existing tables)
```sql
-- For existing users: default OFF (preserve current settings)
-- For new users: default ON (use admin recommendations)
ALTER TABLE user_profiles ADD COLUMN sync_global_post_thresholds BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN sync_global_ban_thresholds BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN sync_feed_post_thresholds BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN sync_feed_ban_thresholds BOOLEAN DEFAULT false;
```

## Features

### Admin Interface (New Tab: "Defaults")
1. **Global Default Thresholds**
   - Set system defaults for all threshold categories
   - These become defaults for new user registrations
   - Show current values vs. proposed changes

2. **Feed Default Thresholds** 
   - Set system defaults for feed-specific thresholds
   - These become defaults when users create new feeds
   - Can be different from global defaults

3. **Bulk Sync Options**
   - "Sync all users to current global defaults" button
   - "Sync all feeds to current feed defaults" button
   - Show count of users/feeds that would be affected

### User Interface Changes

#### Settings > Global Moderation
- Add two toggles: 
  - "🔄 Sync post removal thresholds with admin recommendations"
  - "🔄 Sync user ban thresholds with admin recommendations"
- When enabled: 
  - User's thresholds automatically update when admin changes defaults
  - Show "Synced with admin" indicator
  - User can still manually override (disables sync)
- When disabled:
  - User has full control over their thresholds
  - Show "Custom settings" indicator

#### Feed Settings (Per-Feed)
- Add two toggles: 
  - "🔄 Use recommended post removal settings"
  - "🔄 Use recommended user ban settings"
- When enabled:
  - Feed uses admin's feed default thresholds
  - Overrides user's global settings for this feed
- When disabled:
  - Feed uses user's custom per-feed settings or falls back to user's global

## Hierarchy (Top to Bottom)
1. **Admin Feed Defaults** (if user has feed sync enabled)
2. **User Per-Feed Custom** (if user has feed sync disabled)
3. **Admin Global Defaults** (if user has global sync enabled)
4. **User Global Custom** (if user has global sync disabled)

## Implementation Phases

### Phase 1: Database & Backend ✅ COMPLETE
- [x] Create `admin_defaults` table with all current threshold categories
- [x] Add sync columns to `user_profiles` and `feeds` tables
- [x] Populate admin_defaults with current hardcoded values (3, 5)
- [x] Create admin API endpoints:
  - GET /api/admin/defaults (get current admin defaults)
  - PUT /api/admin/defaults (update admin defaults)
  - POST /api/admin/sync-users (bulk sync users to new defaults)
- [x] Update user registration to use admin defaults and set sync=true
- [x] Create sync logic for updating user thresholds when admin changes defaults
- [x] Created AdminThresholdSync service for centralized threshold management

### Phase 2: Admin Interface ✅ COMPLETE
- [x] Add "Defaults" tab to admin page
- [x] Global defaults management UI
- [x] Feed defaults management UI
- [x] Bulk sync controls with confirmation dialogs
- [x] Threshold type selector (Global/Feed)
- [x] Category and subcategory organization
- [x] Real-time threshold editing with validation
- [x] Auto-sync on save functionality

### Phase 3: User Interface
- [x] Add sync toggles to Settings > Global Moderation
- [x] Visual indicators for synced vs custom settings
- [x] Handle sync conflicts gracefully (immediate sync on enable)
- [x] Backend API endpoint for sync settings
- [ ] Add sync toggles to individual feed settings

### Phase 4: Advanced Features
- [ ] Sync history/audit log
- [ ] Gradual rollout (sync X% of users per day)
- [ ] A/B testing different default values
- [ ] Analytics on sync adoption rates

## Decisions Made

1. **Sync Timing**: Immediate sync when admin changes defaults (easier implementation)

2. **Sync Conflicts**: When user enables sync, immediately overwrite their settings with admin defaults

3. **Granular Sync**: Two separate toggles:
   - "Sync post removal thresholds" 
   - "Sync user ban thresholds"

4. **Feed Creation**: New feeds default to user's global settings (current behavior)

5. **Migration**: 
   - Existing users: sync defaults to OFF (preserve current settings)
   - New users: sync defaults to ON (use admin recommendations)
   - No existing real users to worry about

6. **Threshold Structure & Inheritance**:
   - Main categories: spam, misleading, sexual, harassment, violence, child_safety, self_harm, rule, illegal
   - Subcategories: misleading_spam, misleading_scam, harassment_troll, etc.
   - **Inheritance Logic**: When subcategory is NULL, it inherits main category value
   - Example: misleading=10, misleading_spam=NULL → misleading_spam effectively uses 10
   - Two threshold types: post removal + user ban
   - Current defaults: 3 (post), 5 (user ban)
   - Admin validation: min=1, max=1000

7. **Admin Defaults Coverage**: ALL 60+ threshold columns in admin_defaults table

## Benefits
- **For Admin**: Easy to tune system-wide moderation without affecting users who want control
- **For Users**: Option to "set and forget" with expert-tuned settings
- **For New Users**: Better defaults based on real-world tuning
- **For System**: Ability to respond quickly to new types of abuse

## Technical Notes
- Sync is opt-in for existing users, opt-out for new users
- Need migration scripts for existing data
- Consider performance impact of bulk updates
- Add proper indexing for threshold lookups
- Implement proper validation for threshold ranges
- Admin interface should show current vs. proposed values
- Need to handle all existing threshold columns (60+ columns total)
- Database path: `/root/feed-moderator/` with docker compose
- Backend: TypeScript with Express, Frontend: Vue 3