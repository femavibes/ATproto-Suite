# Group Moderation System - Implementation Status

## Overview
The group moderation system allows feed owners to delegate moderation permissions to other users. A feed owner can:
1. Create groups (with globally unique names)
2. Add multiple feeds to a group
3. Grant moderators permission to a group (not individual feeds)
4. When a moderator takes action, it affects ALL feeds in that group

This simplifies permission management - instead of granting access to individual feeds, you grant access to groups of feeds.

## Current Implementation Status

### ✅ BACKEND - FULLY IMPLEMENTED

#### Database Schema (Complete)
- ✅ `feed_groups` table - stores groups with owner
- ✅ `feed_group_members` table - maps feeds to groups
- ✅ `group_moderators` table - stores moderators with permissions
- ✅ All necessary indexes

#### API Routes (Complete)
**Feed Groups (`/api/feed-groups`):**
- ✅ `GET /` - Get user's feed groups and memberships
- ✅ `POST /` - Create new feed group
- ✅ `DELETE /:groupId` - Delete feed group
- ✅ `POST /:groupId/feeds` - Add feed to group
- ✅ `DELETE /:groupId/feeds/:feedId` - Remove feed from group
- ✅ `GET /:groupId/moderators` - Get group moderators
- ✅ `POST /:groupId/moderators` - Add moderator to group
- ✅ `DELETE /:groupId/moderators/:moderatorDid` - Remove moderator
- ✅ `GET /moderated` - Get groups user can moderate

#### Database Service Methods (Complete)
- ✅ `createFeedGroup()` - Create new group
- ✅ `getUserFeedGroups()` - Get user's owned groups
- ✅ `addFeedToGroup()` - Add feed to group
- ✅ `removeFeedFromGroup()` - Remove feed from group
- ✅ `getFeedsInGroup()` - Get all feeds in a group
- ✅ `findFeedGroupByName()` - Find group by name
- ✅ `getFeedsByGroupOrFeedName()` - Get feeds by group name (supports delegation)
- ✅ `addGroupModerator()` - Add moderator with permissions
- ✅ `removeGroupModerator()` - Remove moderator
- ✅ `getGroupModerators()` - Get all moderators for a group
- ✅ `hasGroupPermission()` - Check if user has permission
- ✅ `getModeratedGroups()` - Get groups user can moderate

### ❌ MODERATION ROUTES - NOT INTEGRATED

The moderation routes (`/api/moderation`) do NOT check for group permissions:

#### Missing Integration Points:
- ❌ `/remove-post` - Only checks if user owns the feed directly
- ❌ `/ban-user` - Only checks if user owns the feed directly
- ❌ `/unban-user` - Only checks if user owns the feed directly
- ❌ `/backfill-removal` - Only checks if user owns the feed directly

**Current Logic:**
```typescript
// Verify user owns the feeds
const userFeeds = await db.getUserFeeds(req.user.userId);
const userFeedIds = userFeeds.map(f => f.feed_id);

if (feedId === 'all' || userFeedIds.includes(feedId)) {
  // Allow action
}
```

**Needed Logic:**
```typescript
// When moderator selects a group name instead of feed IDs:
// 1. Resolve group name to list of feed IDs
// 2. Check if user has permission for that group
// 3. Apply action to ALL feeds in the group

const user = await db.getUserProfileById(req.user.userId);
const feedsToModerate = [];

for (const target of targets) { // targets can be feed IDs or group names
  // Check if it's a group name
  const group = await db.findGlobalFeedGroup(target);
  if (group) {
    // It's a group - check permission
    const hasPermission = await db.hasGroupPermission(target, user.did, 'remove');
    if (hasPermission) {
      const groupFeeds = await db.getFeedsInGroup(group.id);
      feedsToModerate.push(...groupFeeds.map(f => f.feed_id));
    }
  } else {
    // It's a feed ID - check ownership
    const userFeeds = await db.getUserFeeds(req.user.userId);
    if (userFeeds.some(f => f.feed_id === target)) {
      feedsToModerate.push(target);
    }
  }
}
```

### ❌ FRONTEND - NOT IMPLEMENTED

No frontend UI exists for:
- ❌ Creating/managing groups
- ❌ Adding/removing feeds from groups
- ❌ Adding/removing moderators
- ❌ Viewing groups you can moderate
- ❌ Moderating feeds via group permissions

## What Needs to Be Done

### 1. Add Group Permission Checking to Moderation Routes

Create a helper function in database service:
```typescript
async hasGroupPermissionForFeed(feedId: string, moderatorDid: string, permission: string): Promise<boolean> {
  const result = await this.pool.query(`
    SELECT 1 FROM group_moderators gm
    JOIN feed_groups fg ON gm.group_id = fg.id
    JOIN feed_group_members fgm ON fg.id = fgm.group_id
    WHERE fgm.feed_id = $1 
      AND gm.moderator_did = $2 
      AND $3 = ANY(gm.permissions)
  `, [feedId, moderatorDid, permission]);
  return result.rows.length > 0;
}
```

Update each moderation route to check both ownership AND group permissions.

### 2. Build Frontend UI

#### Group Management Page
- List user's groups
- Create new group
- Delete group
- Add/remove feeds from group
- Add/remove moderators with permission selection

#### Moderated Groups View
- Show groups user can moderate
- Show feeds in each group
- Allow moderation actions on those feeds

#### Feed Selector Enhancement
- Show feeds user owns
- Show feeds user can moderate (with group indicator)
- Filter by owned vs moderated

### 3. Testing

Test scenarios:
1. User A creates group "test-group"
2. User A adds feed "feed-123" to group
3. User A adds User B as moderator with "remove" permission
4. User B logs in and can see "feed-123" in moderated feeds
5. User B can remove posts from "feed-123"
6. User B cannot ban users (no "ban" permission)

## Current Test Data

From your database:
- Group: "testgroup" (ID: 1)
- Owner: fema.monster (user_id: 7)
- Moderator: debug.fema.monster (DID: did:plc:3wh3o5qteklqxtz4d4iz3taq)
- Permissions: {remove, ban}
- Feed in group: "30867" (MOD TEST FEED 1)

## Summary

**Backend Infrastructure: 100% Complete** ✅
- All database tables exist
- All API routes exist
- All database methods exist

**Backend Integration: 0% Complete** ❌
- Moderation routes don't check group permissions
- Need to add permission checks to 4 routes

**Frontend: 0% Complete** ❌
- No UI for group management
- No UI for viewing moderated groups
- No UI for moderating via groups

## Estimated Work Remaining

1. **Backend Integration** (2-3 hours)
   - Add `hasGroupPermissionForFeed()` method
   - Update 4 moderation routes
   - Test permission checking

2. **Frontend UI** (8-12 hours)
   - Group management page
   - Moderated groups view
   - Feed selector updates
   - Moderator management UI
   - Testing and polish
