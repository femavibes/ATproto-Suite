# ModMaster Implementation Status

## Overview
ModMaster is a labeler-based moderation system that allows Feed Moderator users to moderate their feeds directly from Bluesky by reporting posts/accounts to the ModMaster labeler.

## Completed Phases

### ✅ Phase 1: Database Schema (COMPLETE)
**Commit:** Phase 1: ModMaster database schema and methods

**Changes:**
- Added custom labeler support fields to `user_profiles`:
  - `custom_labeler_did`
  - `custom_labeler_ozone_url`
  - `custom_labeler_password` (encrypted)
  - `non_user_post_removal_weight`
  - `non_user_ban_weight`

- Created `user_report_type_settings` table:
  - Global report type action settings per user
  - Actions: `remove_all`, `ban_all`, `log_only`, `command_only`

- Created `feed_report_type_overrides` table:
  - Per-feed report type action overrides
  - Per-feed non-user weight overrides

- Enhanced `post_reports` and created `user_reports` tables:
  - Added `labeler_did` tracking
  - Added `report_weight` for weighted communal moderation

- Added database methods:
  - `updateCustomLabeler()` / `getCustomLabeler()`
  - `setUserReportTypeSetting()` / `getUserReportTypeSetting()`
  - `setFeedReportTypeOverride()` / `getFeedReportTypeOverride()`
  - `isAppUser()` - Check if user has paid/premium tier
  - `getOrCreateUserProfile()` - Auto-create profiles for non-app users
  - `getNonUserWeights()` / `updateNonUserWeights()`

**Migration:** `backend/migrations/20250101000001_add_modmaster_support.sql`

---

### ✅ Phase 2: Command Parser (COMPLETE)
**Commit:** Phase 2: ModMaster command parser

**Changes:**
- Created `ModMasterCommandParser` class
- Parses commands from report comments:
  - `remove` / `remove all` / `remove feed1,feed2`
  - `ban` / `ban all` / `ban feed1,feed2`
  - `label label1,label2` (custom labeler only)
  - `unlabel label1,label2` (custom labeler only)

- Command validation:
  - Verify feed ownership
  - Prevent label commands on ModMaster (only custom labelers)
  - Validate targets exist

- Multi-line command support
- Comprehensive test suite (all passing)

**Files:**
- `backend/src/services/modMasterCommandParser.ts`
- `backend/test-modmaster-parser.ts`

---

### ✅ Phase 3: ModMaster Service (COMPLETE)
**Commits:** 
- Phase 3 (partial): ModMaster service core
- Phase 3 & 4 complete: ModMaster integration and API routes

**Completed:**
- Created `ModMasterService` class
- Report processing with user tier detection
- Report weight calculation (app users = 1.0, non-app users = configurable)
- Command execution:
  - `executeRemoveCommand()` - Remove posts from feeds
  - `executeBanCommand()` - Ban users from feeds
  - `executeLabelCommand()` - Apply labels (custom labeler)
  - `executeUnlabelCommand()` - Remove labels (custom labeler)
- Report type action execution:
  - Get user's report type settings
  - Execute default actions (remove_all, ban_all, log_only, command_only)
- Label application/removal via Ozone API

- Integrated with main app initialization
- Added monitoring loop for ModMaster labeler
- Implemented weighted communal threshold checking
- Implemented weighted user ban threshold checking
- Error handling and token refresh
- Background monitoring with error recovery

**Files:**
- `backend/src/services/modMasterService.ts`
- `backend/src/index.ts` (integration)

---

### ✅ Phase 4: API Routes (COMPLETE)
**Commit:** Phase 3 & 4 complete: ModMaster integration and API routes
**Completed Endpoints:**
- `POST /api/modmaster/custom-labeler` - Configure/remove custom labeler
- `GET /api/modmaster/custom-labeler/:userId` - Get custom labeler config
- `POST /api/modmaster/report-type-settings` - Set report type action
- `GET /api/modmaster/report-type-settings/:userId` - Get all report type settings
- `POST /api/modmaster/feed-overrides` - Set per-feed override
- `GET /api/modmaster/feed-overrides/:feedId` - Get feed overrides
- `POST /api/modmaster/non-user-weights` - Update non-user report weights
- `GET /api/modmaster/non-user-weights/:userId` - Get non-user report weights

**Features:**
- Password encryption for custom labelers
- Input validation (weights 0-1, valid actions)
- Error handling and user feedback

**Files:**
- `backend/src/routes/modmaster.ts`

---

### ✅ Phase 5: Frontend UI (COMPLETE)
**Commit:** Phase 5 complete: ModMaster frontend UI

**Completed:**
- Created ModMasterTab component
- Custom labeler configuration UI
  - DID, Ozone URL, password inputs
  - Configure/remove buttons
  - Display configured labeler
- Report type action settings
  - Dropdown per report type
  - Auto-save on change
  - All report types covered
- Non-user report weight sliders
  - Post removal weight (0.0 - 1.0)
  - User ban weight (0.0 - 1.0)
  - Real-time value display
- Success/error messaging
- Integrated into Settings page

**Files:**
- `frontend/src/components/settings/ModMasterTab.vue`
- `frontend/src/views/Settings.vue` (integration)

---

## Pending Phases

### ⏳ Phase 6: Per-Feed Overrides UI
**Components needed:**

**Feeds.vue (per-feed settings):**
- ModMaster section in feed settings
- Report type overrides
  - Override global settings per report type
  - Clear override button
- Per-feed non-user weights
  - Override global weights
  - Clear override button

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                         Bluesky                              │
│  User reports post/account to ModMaster or custom labeler   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    ModMasterService                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Receive report from Ozone                         │   │
│  │ 2. Get/create user profile                           │   │
│  │ 3. Check user tier (app user vs non-app user)        │   │
│  │ 4. Calculate report weight                           │   │
│  │ 5. Track report in database                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│         ┌───────────────┴───────────────┐                    │
│         ▼                               ▼                    │
│  ┌─────────────┐                 ┌─────────────┐            │
│  │  App User   │                 │ Non-App User│            │
│  │ (tier=paid) │                 │ (tier=none) │            │
│  └──────┬──────┘                 └──────┬──────┘            │
│         │                               │                    │
│         ▼                               ▼                    │
│  Execute Actions                  Log Only                   │
│  - Parse commands                 - Track report            │
│  - Check settings                 - Apply weight            │
│  - Remove posts                   - Contribute to           │
│  - Ban users                        communal thresholds     │
│  - Apply labels                                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Communal Moderation (Weighted)                       │   │
│  │ - App user reports = 1.0 weight                      │   │
│  │ - Non-app user reports = configurable weight         │   │
│  │ - Check thresholds with weighted counts              │   │
│  │ - Apply communal labels when threshold reached       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Features

### User Tiers
- **App Users (paid/premium):** Full moderation capabilities, reports count full weight
- **Non-App Users (none):** Reports tracked but no direct actions, configurable weight

### Report Type Actions
- **remove_all:** Remove post from all user's feeds
- **ban_all:** Ban user from all user's feeds
- **log_only:** Just record the report, no action
- **command_only:** Only execute commands from comment field

### Commands
- **remove [feed1,feed2]:** Remove post from specific feeds or all
- **ban [feed1,feed2]:** Ban user from specific feeds or all
- **label label1,label2:** Apply labels (custom labeler only)
- **unlabel label1,label2:** Remove labels (custom labeler only)

### Weighted Communal Moderation
- App user reports contribute full weight (1.0)
- Non-app user reports contribute reduced weight (configurable per user/feed)
- Thresholds checked with weighted counts
- Prevents gaming the system while allowing community participation

---

## Testing

### Command Parser Tests
```bash
cd backend
npx tsx test-modmaster-parser.ts
```

All tests passing ✅

---

## Next Steps

1. **Phase 6: Per-Feed Overrides UI**
   - Add ModMaster section to Feeds.vue
   - Per-feed report type overrides
   - Per-feed weight overrides

2. **Testing & Documentation:**
   - Integration tests
   - User documentation
   - Admin documentation

---

## Configuration

### Environment Variables
```env
# ModMaster labeler (communal)
LABELER_DID=did:plc:your-modmaster-labeler
LABELER_PASSWORD=your-app-password
OZONE_URL=https://your-ozone.example.com
```

### Database Migration
```bash
# Run migration
psql $DATABASE_URL < backend/migrations/20250101000001_add_modmaster_support.sql
```

---

## Notes

- ModMaster is the communal labeler (one for all users)
- Users can optionally add their own custom labeler
- Custom labelers enable label commands
- Non-app users help improve communal intelligence without requiring app registration
- Report weights prevent abuse while encouraging participation
