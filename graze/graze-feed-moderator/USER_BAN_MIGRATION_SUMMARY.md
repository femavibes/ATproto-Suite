# User Ban System Migration to Hierarchical Structure

## Overview
This migration updates the user ban system to use the same detailed hierarchical report type structure as communal post removals, replacing the legacy simple categories.

## Changes Made

### 1. Settings.vue Updates
- **Added Global User Ban Thresholds section** with hierarchical structure
- **Main categories**: misleading, harassment, violence, sexual, child-safety, self-harm, rule
- **Subcategories**: Each main category has specific subtypes (e.g., misleading-spam, misleading-bot, harassment-targeted, etc.)
- **Inheritance system**: Subcategories inherit from main category thresholds if not specifically set
- **Cross-type percentages**: Same-category and global cross-type contribution settings
- **Excluded types**: "*-other" subcategories and standalone "other" are disabled for communal moderation

### 2. FeedsTab.vue Updates
- **Replaced legacy user ban settings** (spam, harassment, illegal, sexual) with hierarchical structure
- **Per-feed thresholds**: Each feed can override global settings for specific report types
- **Opt-in system**: Feeds can enable/disable specific subcategories
- **Inheritance display**: Shows inherited thresholds from main categories

### 3. BanTab.vue Updates
- **Updated threshold calculation functions** to use hierarchical structure
- **Improved threshold display** for trending banned users
- **Cross-type calculation** now works with detailed subcategories

### 4. Database Migration
- **New hierarchical columns** added to feeds table for all report types
- **Global user ban settings table** created for user-specific global thresholds
- **Legacy data migration**: Existing data mapped to new structure
  - spam → misleading-spam
  - harassment → harassment-targeted  
  - illegal → violence-threat
  - sexual → sexual-nudity
- **user_reports table updated** with hierarchical report types
- **Backward compatibility**: Legacy columns preserved during transition

## Report Type Structure

### Main Categories (with default thresholds):
- **misleading** (15): spam, bot, impersonation, other*
- **harassment** (8): targeted, doxxing, other*
- **violence** (5): threat, graphic, other*
- **sexual** (8): nudity, pornography, other*
- **child-safety** (3): csam, grooming, other*
- **self-harm** (5): suicide, cutting, other*
- **rule** (8): copyright, trademark, other*

*Note: "*-other" subcategories are disabled for communal moderation

### Special Cases:
- **"other"** (standalone): Not part of any category, disabled for communal moderation
- **Inheritance**: Subcategories without specific thresholds inherit from main category
- **Cross-type contributions**: Same-category (50%) and global cross-type (20%) by default

## Migration Steps

1. **Run the database migration**:
   ```bash
   cd /root/feed-moderator
   export DATABASE_URL='your_postgresql_connection_string'
   ./run_migration.sh
   ```

2. **Update backend API** to handle new hierarchical structure in:
   - User ban threshold queries
   - Report type validation
   - Threshold calculation logic
   - Global settings endpoints

3. **Test the frontend** to ensure:
   - Global settings save/load correctly
   - Per-feed settings work with inheritance
   - Ban threshold calculations use new structure
   - Legacy data displays properly

## Backward Compatibility

- Legacy columns are preserved during transition
- Existing user ban data is automatically migrated
- Old report types are mapped to new hierarchical equivalents
- Systems can gradually transition to new structure

## Benefits

1. **Consistency**: User bans now use same structure as post removals
2. **Granularity**: Can set different thresholds for specific subtypes
3. **Flexibility**: Per-feed overrides with global fallbacks
4. **Cross-type support**: Sophisticated threshold contribution system
5. **Scalability**: Easy to add new report types and subcategories

## Files Modified

- `/frontend/src/views/Settings.vue` - Added global user ban thresholds
- `/frontend/src/components/tabs/FeedsTab.vue` - Updated per-feed user ban settings
- `/frontend/src/components/tabs/BanTab.vue` - Updated threshold calculations
- `migrate_user_ban_thresholds.sql` - Database migration script
- `run_migration.sh` - Migration runner script

## Next Steps

1. Update backend API endpoints to support new structure
2. Test all user ban functionality thoroughly
3. Monitor for any issues with legacy data
4. Plan removal of legacy columns in future migration
5. Update documentation and user guides