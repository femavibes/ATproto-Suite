# Planned Features

## NSFW Content Filter

### Import/Export
- Export term lists as JSON
- Import community-curated lists
- Share configurations between users
- CSV import for bulk term additions

### Bulk Operations
- "Clear All" button per category
- Batch delete selected terms
- Move terms between categories
- Merge duplicate entries

### Future Enhancements
- Community term database
- Auto-update term lists from central repository
- Version control for term lists
- Rollback to previous term configurations

## Starterpack Custom Nodes

### Concept
Create "meta" custom nodes that bundle multiple custom nodes together into a single package. Two types:
- **Moderation Starterpack** (lime color) - Bundles all moderation nodes (NSFW Filter, Spam Blocker, Block Lists, etc.)
- **Feature Starterpack** (grass color) - Bundles all feature nodes (Video Options, Time Master, etc.)

### Implementation
When user pushes a Starterpack node, the system would:
1. Fetch manifests from all included custom nodes
2. Combine all filters into one large `and` array
3. Merge all parameters from each node
4. Push as a single custom node to Graze

### Current Blocker: Nesting Issue
Some custom nodes don't work when nested inside another custom node's filter array.

**Working when nested:**
- NSFW Content Filter
- Video Options
- Time Master
- Master Term Search

**Not working when nested:**
- Spam Blocker
- Ad & Affiliate Links Blocker
- Block Lists

**Suspected cause:** The broken nodes all use whitelist implementation with `each` and `list_member`:
```json
{
  "or": [
    {"each": ["$WHITELIST", {"list_member": ["$WHITELIST_ITEM", "in"]}]},
    {"and": [...filters...]}
  ]
}
```

When nested, Graze may not be able to resolve the `$WHITELIST_ITEM` variable or the `each` operation breaks in nested context.

**Potential fixes:**
1. Remove whitelist wrappers from affected nodes
2. Implement whitelists differently (simple `list_member` without `each`)
3. Test if the issue is specifically with `each` or with the variable scoping
4. Investigate if Graze has limitations on nested custom node complexity

### Future Work
- Debug why whitelist pattern breaks when nested
- Refactor affected nodes to be nesting-compatible
- Build Starterpack bundling system once nesting works
- Add UI to select which nodes to include in a Starterpack

## Verified Accounts & Account Quality Filter

### Verified Accounts Node
Create a custom node to filter by account verification status.

**Features:**
- Toggle for each verification issuer (manageable list of issuer DIDs)
- Simple "Require Verified Accounts" toggle (any trusted verifier)
- "Hide Verified Accounts" toggle (inverse - see grassroots content only)

**Available fields:**
- `hydrated_metadata.user.verification.trusted_verifier_status` - "none" or "valid"
- `hydrated_metadata.user.verification.verifications[*].issuer` - DID of verifier
- `hydrated_metadata.user.verification.verifications[*].is_valid` - Boolean
- `hydrated_metadata.user.verification.verifications[*].created_at` - Verification timestamp

### Account Quality/Popularity Filter
Filter posts based on account metrics (follower count, post count, etc.).

**Possible features:**
- Minimum follower threshold (e.g., 1000+ followers only)
- Maximum follower threshold (hide mega-accounts)
- Follower/following ratio detection (spam account detection)
- Post count filters (hide new accounts < 100 posts)
- Account age filters (using `created_at`)
- Combined filters (verified + 5k followers = trusted sources)

**Available fields:**
- `hydrated_metadata.user.followers_count` - Number of followers
- `hydrated_metadata.user.follows_count` - Number following
- `hydrated_metadata.user.posts_count` - Total posts
- `hydrated_metadata.user.created_at` - Account creation date

**Implementation options:**
1. Separate nodes (Verified Accounts + Account Quality)
2. Combined "Account Trust" node with both verification and metrics
3. Start simple with just verification, add metrics later
