# Threshold Display Fix - Trending Banned Users

## Issue Fixed
The detailed threshold modal in trending banned users was showing incorrect threshold values for subcategories.

### Problem
- **Preview:** Correctly showed `child-safety 1/3` (using database value)
- **Detailed Modal:** Incorrectly showed `child-safety-privacy 0/15` (using hardcoded fallback)

### Root Cause
Subcategories like `child-safety-privacy` and `child-safety-harassment` don't have individual database settings, so they should inherit from their main category (`child-safety: 3`), but the fallback logic was using hardcoded values (15) instead of the main category's database value (3).

### Fix Applied
Updated the fallback logic in `getUserBanGlobalThreshold()` function in `/root/feed-moderator/frontend/src/components/tabs/BanTab.vue`:

**Before:**
```javascript
if (type.includes('-')) {
  const mainCategory = type.split('-')[0]
  return fallbacks[mainCategory as keyof typeof fallbacks] || 15  // Wrong fallback
}
```

**After:**
```javascript
if (type.includes('-')) {
  const mainCategory = type.split('-')[0]
  return fallbacks[mainCategory as keyof typeof fallbacks] || 3   // Correct fallback
}
```

### Threshold Lookup Logic (Correct Order)
1. **First:** Check for specific subcategory threshold in database (`global_user_ban_threshold_child_safety_privacy`)
2. **Second:** If not found, use main category threshold from database (`global_user_ban_threshold_child_safety`)
3. **Last:** Only use hardcoded fallback if neither exists

### Result
Both preview and detailed modal now consistently show:
- **child-safety-privacy:** 0/3 ✓
- **child-safety-harassment:** 0/3 ✓

## Similar Issue - Trending Removed Posts
**TODO:** The same threshold display inconsistency likely exists in trending removed posts (`RemoveTab.vue`). This needs to be investigated and fixed to match the logic used for trending banned users.

The issue would be in the post removal threshold functions, where subcategories might be using hardcoded fallbacks instead of inheriting from their main category's database values.

## Files Modified
- `/root/feed-moderator/frontend/src/components/tabs/BanTab.vue`
  - Fixed `getUserBanGlobalThreshold()` fallback logic
  - Removed debug logging

## Testing
- Verified preview shows correct database values
- Verified detailed modal shows same values as preview
- Confirmed subcategories inherit from main category database values