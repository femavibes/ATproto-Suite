# Known Issues

## Bulk Restore Duplicate Posts (POSSIBLE ISSUE)

**Status**: Unconfirmed - needs investigation

**Description**: 
Bulk restore commands may attempt to restore posts that have already been restored, potentially causing duplicate posts to appear in feeds.

**Scenario**:
1. Remove a post from feeds (logged in `post_removals` table)
2. Restore the post (should delete entry from `post_removals` table)  
3. Run `bulk restore` command

**Expected Behavior**: 
`bulk restore` should only find posts that are currently removed (exist in `post_removals` table)

**Observed Behavior**: 
`bulk restore` may attempt to restore already-restored posts, causing Graze API to create duplicates

**Possible Root Causes**:
1. `logPostRestoration` DELETE query not working correctly
2. Race condition between restore and bulk restore operations
3. Scope mismatch - post removed from specific feeds but restored to "all", causing DELETE query to miss original removal records due to different `feed_id` values

**Impact**: 
Low - duplicate posts in feeds, but functionality still works

**Workaround**: 
Users should be aware that bulk restore may create duplicates if run on already-restored posts

**Investigation Needed**:
- Check if `logPostRestoration` properly deletes from `post_removals` table
- Verify scope handling between specific feeds vs "all" feeds in removal/restoration tracking
- Test sequence: remove specific → restore all → bulk restore