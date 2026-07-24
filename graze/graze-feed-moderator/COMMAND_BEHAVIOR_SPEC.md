# Command Behavior Specification

## Ban/Unban Commands

### Ban Command Behavior
- `ban` → Adds user to **global ban list only**
- `ban global` → Adds user to **global ban list only** 
- `ban feed1,feed2` → Adds user to **specific feed ban lists**
- `ban global,feed1,feed2` → Adds user to **global + specific feed ban lists**
- `ban all` → Adds user to **global + ALL user's feed ban lists**

### Unban Command Behavior
- `unban` → Removes user from **global ban list only**
- `unban global` → Removes user from **global ban list only**
- `unban feed1,feed2` → Removes user from **specific feed ban lists**
- `unban global,feed1,feed2` → Removes user from **global + specific feed ban lists**
- `unban all` → Removes user from **global + ALL user's feed ban lists**

## Remove/Restore Commands

### Remove Command Behavior
- `remove` → Removes post from **all configured feeds** (separate API calls)
- `remove feed1,feed2` → Removes post from **specific feeds** (separate API calls)
- `remove all` → Removes post from **ALL user's feeds** (single Graze API call)

### Restore Command Behavior
- `restore` → Restores post to **all configured feeds** (separate API calls)
- `restore feed1,feed2` → Restores post to **specific feeds** (separate API calls)
- `restore all` → Restores post to **ALL user's feeds** (single Graze API call)

## Bulk Remove/Restore Commands

### Bulk Remove Command Behavior
- `bulk remove 50` → Removes last 50 posts from **all configured feeds**
- `bulk remove feed1,feed2 50` → Removes last 50 posts from **specific feeds**
- `bulk remove all 50` → Removes last 50 posts from **ALL user's feeds** (single Graze API call)

### Bulk Restore Command Behavior
- `bulk restore 50` → Restores last 50 posts to **all configured feeds**
- `bulk restore feed1,feed2 50` → Restores last 50 posts to **specific feeds**
- `bulk restore all 50` → Restores last 50 posts to **ALL user's feeds** (single Graze API call)

## API Implementation Notes

### Graze API Endpoints
- **Configured feeds**: Multiple API calls, one per feed (only feeds configured in this app)
- **All feeds**: Single API call to Graze endpoint (includes feeds not configured in this app)

### Global Ban List
- Shared across all users and feeds
- Managed separately from individual feed ban lists
- Users can be on global list + individual feed lists simultaneously

### Post Count Limits
- Bulk operations limited to maximum 100 posts
- Default count is 10 if not specified

### Feed Validation
- Users can only target feeds they own (except 'global')
- 'global' is always valid for ban/unban commands
- Invalid feed names return validation errors

## Command Examples

```
# Ban user from global list only
ban

# Ban user from global + specific feeds
ban global,urbanism,transit

# Ban user from global + all feeds
ban all

# Remove post from configured feeds
remove

# Remove post from specific feeds  
remove urbanism,transit

# Remove post from ALL user's feeds (including unconfigured)
remove all

# Bulk remove last 25 posts from configured feeds
bulk remove 25

# Bulk remove last 50 posts from specific feeds
bulk remove urbanism,transit 50

# Bulk remove last 100 posts from ALL feeds
bulk remove all 100
```