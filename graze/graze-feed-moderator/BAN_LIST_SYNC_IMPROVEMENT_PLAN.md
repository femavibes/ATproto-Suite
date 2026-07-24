# Ban List Sync Improvement Plan

## Issues Identified

1. **One-way sync problem**: Users removed from Bluesky lists aren't removed from app database
2. **Duplicate users**: Same user appears multiple times in app ban lists (e.g., yksb.bsky.social)
3. **Missing periodic sync**: No automatic background synchronization
4. **Lost sync UI functionality**: Sync options exist but comprehensive sync was lost during refactoring

## Current Sync Implementation Analysis

### Existing Components
- Manual sync endpoint: `/api/moderation/sync-ban-lists` (24h cooldown)
- `SyncScheduler` class for periodic syncing
- `BlueskyService.syncBanLists()` method

### Current Sync Logic Issues
The `syncBanLists()` method in BlueskyService has the right structure but needs fixes:

1. **Incomplete removal logic**: Code exists to remove users not in Bluesky list but may have bugs
2. **Duplicate handling**: No deduplication of existing database entries
3. **Error handling**: Insufficient error handling for partial sync failures

## Proposed Solutions

### 1. Fix Bidirectional Sync
**Problem**: Users removed from Bluesky lists stay in app database
**Solution**: Enhance the existing removal logic in `BlueskyService.syncBanLists()`

```typescript
// Enhanced removal logic
for (const dbUser of dbMembers) {
  if (dbUser.banned_did && !blueskyDids.has(dbUser.banned_did)) {
    console.log(`Removing ${dbUser.banned_handle} from database (not in Bluesky list)`);
    await db.unbanUser(user.id, dbUser.banned_handle, list.type, null);
    
    // Log the removal
    await db.logModerationAction({
      account_did: dbUser.banned_did,
      action: 'sync_unban',
      feed_id: list.type === 'global' ? null : list.type,
      moderator_did: user.did,
      reason: 'Removed during Bluesky sync - not found in Bluesky list',
      target_handle: dbUser.banned_handle
    });
    
    removed++;
  }
}
```

### 2. Add Duplicate Detection and Cleanup
**Problem**: Same user appears multiple times in ban lists
**Solution**: Add deduplication logic before and after sync

```typescript
// Pre-sync deduplication
async deduplicate(userId: number, listType: string): Promise<number> {
  const result = await this.pool.query(`
    DELETE FROM banned_users 
    WHERE id NOT IN (
      SELECT MIN(id) 
      FROM banned_users 
      WHERE user_id = $1 AND list_type = $2
      GROUP BY banned_handle, banned_did
    ) 
    AND user_id = $1 AND list_type = $2
  `, [userId, listType]);
  
  return result.rowCount || 0;
}
```

### 3. Implement Periodic Background Sync
**Problem**: No automatic synchronization
**Solution**: Enable and configure the existing SyncScheduler

```typescript
// In main application startup
const syncScheduler = new SyncScheduler();
// Run sync every 6 hours instead of daily
syncScheduler.start(360); // 6 hours in minutes
```

### 4. Improve Sync UI and User Experience
**Problem**: Lost comprehensive sync functionality
**Solution**: Enhance the existing sync buttons with better feedback

```vue
<!-- Enhanced sync UI with progress and results -->
<div class="sync-actions">
  <button 
    v-if="selectedListFilter === 'all'" 
    @click="syncAllLists" 
    :disabled="syncing"
    class="sync-btn"
  >
    {{ syncing ? 'Syncing...' : 'Sync All Lists' }}
  </button>
  
  <div v-if="lastSyncResult" class="sync-result">
    <span class="sync-success">✓ {{ lastSyncResult.added }} added, {{ lastSyncResult.removed }} removed</span>
    <small>{{ formatTime(lastSyncResult.timestamp) }}</small>
  </div>
</div>
```

### 5. Add Sync Status Tracking
**Problem**: No visibility into sync status and history
**Solution**: Create sync_tracking table and UI

```sql
CREATE TABLE IF NOT EXISTS sync_tracking (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
  list_type VARCHAR(50) NOT NULL,
  sync_type VARCHAR(20) NOT NULL, -- 'manual', 'automatic', 'startup'
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed'
  added_count INTEGER DEFAULT 0,
  removed_count INTEGER DEFAULT 0,
  error_message TEXT,
  UNIQUE(user_id, list_type)
);
```

## Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. Fix bidirectional sync in `BlueskyService.syncBanLists()`
2. Add duplicate detection and cleanup
3. Improve error handling and logging

### Phase 2: User Experience (Next)
1. Enhance sync UI with progress indicators
2. Add sync result display
3. Improve sync button states and feedback

### Phase 3: Automation (Future)
1. Enable periodic background sync
2. Add sync status tracking table
3. Add sync history and monitoring

## Testing Plan

1. **Manual Testing**:
   - Ban user via app → verify in Bluesky list
   - Remove user from Bluesky list → run sync → verify removed from app
   - Create duplicate entries → run sync → verify deduplication

2. **Edge Cases**:
   - Handle users with no DID
   - Handle Bluesky API failures during sync
   - Handle partial sync failures

3. **Performance Testing**:
   - Test sync with large ban lists (100+ users)
   - Test concurrent sync operations

## Risk Mitigation

1. **Backup before sync**: Always backup ban list state before major sync operations
2. **Gradual rollout**: Test with small user groups first
3. **Rollback plan**: Ability to restore from backup if sync goes wrong
4. **Rate limiting**: Respect Bluesky API rate limits during sync

## Success Metrics

1. **Sync accuracy**: 100% consistency between app and Bluesky lists
2. **Duplicate elimination**: Zero duplicate users in ban lists
3. **User satisfaction**: Reduced complaints about sync issues
4. **Automation**: Successful periodic syncs without manual intervention