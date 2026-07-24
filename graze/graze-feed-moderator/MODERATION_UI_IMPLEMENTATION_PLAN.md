# Moderation UI Implementation Plan

## Overview
Implement UI for moderating feeds you own vs groups you moderate for others, with clear separation and no confusion.

## Design Decisions

### Feed Selection
✅ **Decided:**
- "All Feeds" checkbox = only YOUR owned feeds (not moderated groups)
- Must explicitly select moderated groups
- Groups appear below owned feeds
- Clear visual hierarchy

### Activity Views
✅ **Decided:**
- Use collapsible sections to separate "My Feeds" vs "Groups I Moderate"
- Visual indicators (badges/colors) to distinguish ownership
- No separate pages - keep everything in one view
- No notifications for moderated group activity
- No separate stats/counts for moderated activity

### Trending Views
⏸️ **Tabled for Later:**
- Trending posts/users handling is complex
- Need to decide: show only from owned feeds? moderated groups? both?
- Will revisit after basic moderation UI is working

## Implementation Tasks

### Phase 1: Feed Selector Enhancement 🔄 IN PROGRESS

**Files to Update:**
- `frontend/src/components/tabs/RemoveTab.vue`
- `frontend/src/components/tabs/BanTab.vue`

**Changes:**
1. Fetch moderated groups on component mount
2. Update feed selector to show:
   ```
   ☐ All My Feeds
   ─────────────────
   My Feeds:
   ☐ Feed 1
   ☐ Feed 2
   ─────────────────
   My Groups:
   ☐ 📁 group-name (3 feeds)
   ─────────────────
   Groups I Moderate:
   ☐ 👤 testgroup (1 feed)
     Owner: fema.monster
   ```

3. Handle "All Feeds" to only include owned feeds
4. Send group names to backend when selected

**API Calls Needed:**
- `GET /api/feed-groups` - Get user's owned groups
- `GET /api/feed-groups/moderated` - Get groups user can moderate

### Phase 2: Activity View Updates

**Files to Update:**
- `frontend/src/views/Dashboard.vue`
- Create new component: `frontend/src/components/ActivityList.vue`

**Changes:**
1. Fetch user activity (already exists)
2. Group activities by source:
   - My Feeds (owned)
   - Groups I Moderate
3. Add collapsible sections
4. Add visual badges:
   - 🟢 Green badge = Your feed
   - 🔵 Blue badge = Moderated group
   - Show owner name for moderated items

**Example Structure:**
```vue
<div class="activity-sections">
  <div class="activity-section">
    <div class="section-header" @click="toggleMyFeeds">
      <h3>▼ My Feeds (5 actions)</h3>
    </div>
    <div v-if="showMyFeeds" class="section-content">
      <ActivityItem v-for="item in myFeedActivity" :key="item.id" :item="item" badge="owned" />
    </div>
  </div>
  
  <div class="activity-section" v-if="moderatedActivity.length > 0">
    <div class="section-header" @click="toggleModerated">
      <h3>▼ Groups I Moderate (2 actions)</h3>
    </div>
    <div v-if="showModerated" class="section-content">
      <ActivityItem v-for="item in moderatedActivity" :key="item.id" :item="item" badge="moderated" />
    </div>
  </div>
</div>
```

### Phase 3: Banned Users View Updates

**Files to Update:**
- `frontend/src/views/Dashboard.vue` (banned users section)

**Changes:**
1. Similar collapsible sections as activity view
2. Group banned users by:
   - Banned from my feeds
   - Banned from moderated groups
3. Show which group/feed they're banned from
4. Add visual indicators

### Phase 4: Testing & Polish

**Test Scenarios:**
1. User with only owned feeds (no moderated groups)
2. User with only moderated groups (no owned feeds)
3. User with both owned feeds and moderated groups
4. "All Feeds" only affects owned feeds
5. Selecting a group affects all feeds in that group
6. Activity view shows correct separation

## Data Structures

### Moderated Groups Response
```typescript
interface ModeratedGroup {
  id: number
  group_name: string
  owner_user_id: number
  owner_handle: string
  permissions: string[]  // ['remove', 'ban']
  feed_count: number
  feeds: {
    feed_id: string
    feed_name: string
    feed_display_name: string
  }[]
}
```

### Activity Item Enhancement
```typescript
interface ActivityItem {
  id: number
  action: string
  post_uri?: string
  feed_id?: string
  feed_name?: string
  created_at: string
  // New fields:
  is_moderated: boolean  // true if from a group you moderate
  group_name?: string    // if is_moderated
  group_owner?: string   // if is_moderated
}
```

## UI Components Needed

### New Components
1. `FeedSelector.vue` - Reusable feed/group selector
2. `ActivitySection.vue` - Collapsible activity section
3. `ActivityBadge.vue` - Visual indicator for owned vs moderated

### Styling
- Green badge/border for owned feeds
- Blue badge/border for moderated groups
- Clear section headers with counts
- Smooth collapse/expand animations

## Backend Support

### Already Implemented ✅
- `POST /api/moderation/remove-post` - Accepts group names
- `POST /api/moderation/ban-user` - Accepts group names
- `GET /api/feed-groups/moderated` - Returns groups with feed details
- Permission checking in `resolveTargetsToFeeds()`

### May Need Later
- Filter activity by source (owned vs moderated)
- Separate trending endpoints for owned vs moderated
- Group-specific statistics

## Open Questions / Future Decisions

### Trending Views (Deferred)
- **Question:** Should trending posts/users show:
  - Only from owned feeds?
  - Only from moderated groups?
  - Both with indicators?
  - Separate tabs?
- **Decision:** TBD - will revisit after basic UI is working
- **Notes:** This is the hardest part, need to think through UX carefully

### Notifications (Decided: No)
- No notifications for activity in groups you moderate
- Keep it simple

### Statistics (Decided: No)
- No separate counts for "your removals" vs "moderated removals"
- Keep dashboard simple

## Implementation Order

1. ✅ Backend integration (DONE)
2. ✅ Mobile Groups button (DONE)
3. ✅ Feed selector enhancement (DONE)
   - ✅ RemoveTab updated with hierarchical feed/group selector
   - ✅ BanTab updated with hierarchical feed/group selector
4. ⏭️ Activity view updates
5. ⏭️ Banned users view updates
6. ⏭️ Testing & polish
7. ⏸️ Trending views (deferred)

## Changes Made

### RemoveTab.vue & BanTab.vue (2025-01-XX)
- Added `ownedGroups` and `moderatedGroups` reactive data
- Added `loadGroups()` function to fetch groups on mount
- Updated feed selection UI to show:
  - "All My Feeds" checkbox (only affects owned feeds)
  - My Feeds section (individual owned feeds)
  - My Groups section (owned groups with 📁 icon)
  - Groups I Moderate section (moderated groups with 👤 icon and owner name)
- Added CSS for section labels and different chip colors:
  - Green for owned groups
  - Indigo for moderated groups
  - Gray for owned feeds
- Applied to both single post removal and bulk removal sections

### BanTab.vue (2025-01-XX)
- Added same group data structures and loading
- Updated ban list selection UI with hierarchy:
  - Global Ban List (all my feeds)
  - My Feeds section
  - My Groups section (green)
  - Groups I Moderate section (indigo with owner)
- Same CSS styling as RemoveTab for consistency

## Notes

- Keep it simple - don't over-engineer
- Clear visual separation is key
- Must be obvious what you own vs what you moderate
- "All Feeds" must never include moderated groups
- Group names must be explicitly selected
