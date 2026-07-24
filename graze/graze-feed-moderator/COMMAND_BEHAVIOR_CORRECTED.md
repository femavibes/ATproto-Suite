# Corrected Command Behavior Specification

## Command Behavior by Report Type

### Post Reports (Reporting a specific post)
**Available Commands:**
- ✅ `remove` / `restore` - Remove/restore the specific reported post
- ✅ `ban` / `unban` - Ban/unban the post author + remove the post
- ✅ `bulk remove` / `bulk restore` - Bulk operations on the post author's recent posts

### Account Reports (Reporting a user account)
**Available Commands:**
- ❌ `remove` / `restore` - **Ignored** (no specific post to target)
- ✅ `ban` / `unban` - Ban/unban the reported user + bulk remove their recent posts
- ✅ `bulk remove` / `bulk restore` - Bulk operations on the reported user's recent posts

## Implementation Logic

### Remove/Restore Commands
```typescript
case 'remove':
  // Only works on post reports - ignore account reports
  if (isPostReport && postUri) {
    await this.handleRemoveCommand(command, postUri, user);
  }
  // Account reports: command is ignored (no action taken)
```

### Ban/Unban Commands  
```typescript
case 'ban':
  const targetUserDid = isPostReport ? extractAuthorFromPostUri(postUri) : accountDid;
  if (targetUserDid) {
    await this.handleBanCommand(command, targetUserDid, user);
    // Also remove content when banning
    if (isPostReport) {
      await this.handleRemoveCommand(command, postUri, user); // Remove specific post
    } else {
      await this.handleBulkRemoveFromAccount(targetUserDid, command.targets, user, 10); // Bulk remove
    }
  }
```

### Bulk Commands
```typescript
case 'bulk_remove':
  // Works on both post and account reports - extract user DID
  const targetUserDid = isPostReport ? extractAuthorFromPostUri(postUri) : accountDid;
  if (targetUserDid) {
    await this.handleBulkRemoveFromAccount(targetUserDid, command.targets, user, command.count);
  }
```

## User Experience

### Post Report Commands
- `remove feed1` → Removes the specific reported post from feed1
- `ban global` → Bans the post author globally + removes the specific post
- `bulk remove feed1 25` → Removes last 25 posts from the post author

### Account Report Commands  
- `remove feed1` → **No action** (command ignored)
- `ban global` → Bans the reported user globally + bulk removes their recent posts
- `bulk remove feed1 25` → Removes last 25 posts from the reported user

## Benefits of This Approach

1. **Clear Semantics** - `remove` only works when there's a specific post to remove
2. **Consistent Behavior** - Bulk commands work the same regardless of report type
3. **No Confusion** - Users won't accidentally trigger bulk behavior with `remove` on accounts
4. **Predictable** - Each command does exactly what its name suggests

## Command Summary

| Command | Post Report | Account Report |
|---------|-------------|----------------|
| `remove` | Remove specific post | **Ignored** |
| `restore` | Restore specific post | **Ignored** |
| `ban` | Ban author + remove post | Ban user + bulk remove |
| `unban` | Unban author | Unban user |
| `bulk remove` | Bulk remove from author | Bulk remove from user |
| `bulk restore` | Bulk restore from author | Bulk restore from user |