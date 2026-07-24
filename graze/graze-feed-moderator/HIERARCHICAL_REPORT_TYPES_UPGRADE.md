# Feed-Moderator: Hierarchical Report Types System Upgrade

**Date**: November 20, 2025  
**Status**: Planning Phase  
**Priority**: High - Required for Bluesky compatibility

## Overview

Upgrade feed-moderator from the old flat report type system (6 types) to Bluesky's new hierarchical report type system (30+ types). This is a comprehensive overhaul affecting database schema, parsing logic, frontend UI, and command processing.

## Current State Analysis

### Existing Report Types (6 total)
- `spam` → `com.atproto.moderation.defs#reasonSpam`
- `misleading` → `com.atproto.moderation.defs#reasonMisleading`
- `sexual` → `com.atproto.moderation.defs#reasonSexual`
- `harassment` → `com.atproto.moderation.defs#reasonRude`
- `illegal` → `com.atproto.moderation.defs#reasonViolation`
- `other` → `com.atproto.moderation.defs#reasonOther`

### Current Database Schema
```sql
-- feeds table has 5 opt-in columns
opt_in_spam BOOLEAN DEFAULT true,
opt_in_misleading BOOLEAN DEFAULT true,
opt_in_sexual BOOLEAN DEFAULT false,
opt_in_harassment BOOLEAN DEFAULT true,
opt_in_illegal BOOLEAN DEFAULT true,
-- No threshold columns (hardcoded to 3)
```

### Current Parsing Logic
- Uses old AT Protocol URIs
- Maps to 6 internal report types
- No hierarchical structure

## Target State: New Hierarchical System

### New Report Types (30 available, 4 blocked)

**Available Report Types (30 total)**

**misleading (6 types)**
- `misleading-spam` - "Spam"
- `misleading-scam` - "Scam"
- `misleading-bot` - "Fake account or bot"
- `misleading-impersonation` - "Impersonation"
- `misleading-elections` - "False information about elections"
- `misleading-other` - "Other misleading content" (command-enabled)

**harassment (5 types)**
- `harassment-troll` - "Trolling"
- `harassment-targeted` - "Targeted harassment"
- `harassment-hate-speech` - "Hate speech"
- `harassment-doxxing` - "Doxxing"
- `harassment-other` - "Other harassing or hateful content" (command-enabled)

**violence (6 types)**
- `violence-animal` - "Animal welfare"
- `violence-threats` - "Threats or incitement"
- `violence-graphic-content` - "Graphic violent content"
- `violence-glorification` - "Glorification of violence"
- `violence-trafficking` - "Human trafficking"
- `violence-other` - "Other violent content" (command-enabled)

**sexual (6 types)**
- `sexual-unlabeled` - "Unlabeled adult content"
- `sexual-abuse-content` - "Adult sexual abuse content"
- `sexual-ncii` - "Non-consensual intimate imagery"
- `sexual-deepfake` - "Deepfake adult content"
- `sexual-animal` - "Animal sexual abuse"
- `sexual-other` - "Other sexual violence content" (command-enabled)

**child-safety (2 types)**
- `child-safety-privacy` - "Privacy violation of a minor"
- `child-safety-harassment` - "Minor harassment or bullying"

**self-harm (5 types)**
- `self-harm-content` - "Content promoting or depicting self-harm"
- `self-harm-ed` - "Eating disorders"
- `self-harm-stunts` - "Dangerous challenges or activities"
- `self-harm-substances` - "Dangerous substances or drug abuse"
- `self-harm-other` - "Other dangerous content" (command-enabled)

**rule (4 types)**
- `rule-site-security` - "Hacking or system attacks"
- `rule-prohibited-sales` - "Promoting or selling prohibited items or services"
- `rule-ban-evasion` - "Banned user returning"
- `rule-other` - "Other network rule-breaking" (command-enabled)

**other (1 type)**
- `other` - Catch-all report type (command-enabled)

**Blocked Report Types (4 total - DO NOT IMPLEMENT)**
- `violence-extremist` - Restricted to official Bluesky
- `child-safety-csam` - Restricted to official Bluesky
- `child-safety-grooming` - Restricted to official Bluesky
- `child-safety-other` - Restricted to official Bluesky

### New AT Protocol URI Format
- Old: `com.atproto.moderation.defs#reasonSpam`
- New: `tools.ozone.report.defs#reasonMisleadingSpam`

## Implementation Plan

### Phase 1: Database Schema Migration

**1.1 Add New Opt-in Columns (30 columns)**
```sql
-- Remove old columns
ALTER TABLE feeds DROP COLUMN opt_in_spam;
ALTER TABLE feeds DROP COLUMN opt_in_misleading;
ALTER TABLE feeds DROP COLUMN opt_in_sexual;
ALTER TABLE feeds DROP COLUMN opt_in_harassment;
ALTER TABLE feeds DROP COLUMN opt_in_illegal;

-- Add new subcategory opt-in columns (30 total)
ALTER TABLE feeds ADD COLUMN opt_in_misleading_spam BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_misleading_scam BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_misleading_bot BOOLEAN DEFAULT false;
-- ... (all 30 subcategories)
```

**1.2 Add Hierarchical Threshold System**
```sql
-- Main category thresholds (8 categories)
ALTER TABLE feeds ADD COLUMN threshold_misleading INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_harassment INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_violence INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_sexual INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_child_safety INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_self_harm INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_rule INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_other INTEGER DEFAULT 3;

-- Subcategory threshold overrides (30 columns, NULL = use main category)
ALTER TABLE feeds ADD COLUMN threshold_misleading_spam INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_misleading_scam INTEGER DEFAULT NULL;
-- ... (all 30 subcategories)
```

**1.3 Migration Strategy**
```sql
-- Set all existing feeds to opt into 'other' only
UPDATE feeds SET opt_in_other = true;
-- All other opt-ins default to false
-- All main category thresholds default to 3
-- All subcategory thresholds default to NULL (use main category)
```

### Phase 2: Backend Updates

**2.1 Update Report Type Parsing (`ozone.ts`)**
```typescript
// Replace mapReportType() function with hierarchical parser
private parseReportType(reportTypeReason: string): string | null {
  // Handle new AT Protocol URI format: tools.ozone.report.defs#reasonMisleadingSpam
  if (reportTypeReason.startsWith('tools.ozone.report.defs#reason')) {
    const reasonPart = reportTypeReason.substring('tools.ozone.report.defs#reason'.length);
    // Convert CamelCase to kebab-case: MisleadingSpam -> misleading-spam
    // Special cases: ED -> ed, NCII -> ncii
    const converted = reasonPart.replace(/([A-Z])/g, '-$1').toLowerCase().substring(1);
    return converted.replace('-e-d', '-ed').replace('-n-c-i-i', '-ncii');
  }
  
  // Legacy compatibility during transition
  const legacyMappings: Record<string, string> = {
    'com.atproto.moderation.defs#reasonSpam': 'misleading-spam',
    'com.atproto.moderation.defs#reasonMisleading': 'misleading-other',
    'com.atproto.moderation.defs#reasonSexual': 'sexual-other',
    'com.atproto.moderation.defs#reasonRude': 'harassment-other',
    'com.atproto.moderation.defs#reasonViolation': 'rule-other',
    'com.atproto.moderation.defs#reasonOther': 'other'
  };
  
  return legacyMappings[reportTypeReason] || 'other';
}
```

**2.2 Update Database Methods (`database.ts`)**
```typescript
// Update getFeedsByOptIn to handle subcategories
async getFeedsByOptIn(reportType: string): Promise<Feed[]> {
  const column = `opt_in_${reportType.replace('-', '_')}`;
  const result = await this.pool.query(
    `SELECT * FROM feeds WHERE ${column} = true`
  );
  return result.rows;
}

// Add hierarchical threshold checking
async getThresholdForReportType(feedId: string, reportType: string): Promise<number> {
  const subcategoryColumn = `threshold_${reportType.replace('-', '_')}`;
  const mainCategory = reportType.split('-')[0];
  const mainCategoryColumn = `threshold_${mainCategory}`;
  
  const result = await this.pool.query(
    `SELECT ${subcategoryColumn}, ${mainCategoryColumn} FROM feeds WHERE feed_id = $1`,
    [feedId]
  );
  
  const feed = result.rows[0];
  // Return subcategory threshold if set, otherwise main category threshold
  return feed[subcategoryColumn] || feed[mainCategoryColumn] || 3;
}
```

**2.3 Update Types (`types/index.ts`)**
```typescript
export interface Feed {
  id: number;
  user_id: number;
  feed_id: string;
  feed_name: string;
  
  // New opt-in columns (30 total)
  opt_in_misleading_spam: boolean;
  opt_in_misleading_scam: boolean;
  // ... (all 30 subcategories)
  
  // New threshold columns (8 main + 30 subcategories)
  threshold_misleading: number;
  threshold_harassment: number;
  // ... (all main categories)
  
  threshold_misleading_spam?: number; // NULL = use main category
  threshold_misleading_scam?: number;
  // ... (all subcategories)
  
  created_at: Date;
}
```

### Phase 3: Frontend Updates

**3.1 Hierarchical Report Type Selection UI**
- **Main Category Dropdown**: Select from 8 main categories
- **Subcategory Dropdown**: Dynamically populated based on main category
- **Opt-in Checkboxes**: 30 subcategory checkboxes organized by main category
- **Threshold Inputs**: Per-subcategory with main category fallback display

**3.2 Feed Configuration Interface**
```vue
<!-- Example Vue component structure -->
<template>
  <div class="report-type-config">
    <div v-for="mainCategory in mainCategories" :key="mainCategory">
      <h3>{{ mainCategory.name }}</h3>
      <div class="threshold-input">
        <label>Default threshold for {{ mainCategory.name }}:</label>
        <input v-model="feed[`threshold_${mainCategory.key}`]" type="number" min="1" />
      </div>
      
      <div v-for="subcategory in mainCategory.subcategories" :key="subcategory.key">
        <div class="subcategory-config">
          <input 
            type="checkbox" 
            v-model="feed[`opt_in_${subcategory.key}`]"
            :id="`opt_${subcategory.key}`"
          />
          <label :for="`opt_${subcategory.key}`">{{ subcategory.name }}</label>
          
          <input 
            v-model="feed[`threshold_${subcategory.key}`]"
            type="number" 
            min="1"
            :placeholder="`Default: ${feed[`threshold_${mainCategory.key}`]}`"
          />
        </div>
      </div>
    </div>
  </div>
</template>
```

### Phase 4: Multi-User Command System Foundation

**4.1 Command System Architecture Overview**

**Critical Difference from ozone-report-to-autolabel**:
- **ozone-report-to-autolabel**: Single user, connected to ONE labeler for specific feeds
  - Commands like "add clutter", "add carbrain" apply specific labels
  - Labels are feed-specific and user-specific
- **feed-moderator**: Multi-user platform, serves MANY users with their own feeds
  - Cannot use feed-specific labels ("clutter" meaningless across different users)
  - Must identify WHICH user's feeds to affect
  - Must authorize commands (users can only affect their own feeds)

**4.2 Command-Enabled Report Types (7 types)**
These report types support custom text input and should parse commands:
- `misleading-other` - "Other misleading content"
- `harassment-other` - "Other harassing or hateful content"
- `violence-other` - "Other violent content"
- `sexual-other` - "Other sexual violence content"
- `self-harm-other` - "Other dangerous content"
- `rule-other` - "Other network rule-breaking"
- `other` - General catch-all

**4.3 Multi-User Command Requirements**

**Core Challenge**: Commands must be user-scoped and feed-scoped
```typescript
// Command must answer these questions:
// 1. WHO is issuing the command? (reporter DID)
// 2. WHICH feeds should be affected? (reporter's feeds only)
// 3. WHAT action should be taken? (remove, label, etc.)
// 4. WHY? (custom reason/label)

interface MultiUserCommand {
  reporterDid: string;        // WHO: Extracted from report event
  action: 'remove' | 'label' | 'block-user';
  scope: 'all-my-feeds' | 'specific-feeds';
  feedIds?: string[];         // WHICH: Specific feed IDs (if scope = specific)
  customLabel?: string;       // WHAT: Custom label to apply
  reason?: string;           // WHY: Human-readable reason
}
```

**4.4 Command Format Examples**
```typescript
// Example commands that need to be supported:
// "remove from all my feeds"           -> Remove post from all reporter's feeds
// "remove from urbanism feed"          -> Remove from specific feed (by name)
// "add spam label to all feeds"        -> Apply custom label across reporter's feeds
// "block user from my feeds"           -> Block post author from reporter's feeds
// "label as misinformation"            -> Apply custom label

// Command parsing challenges:
// - Must identify feed names/IDs from natural language
// - Must validate reporter owns the referenced feeds
// - Must handle ambiguous feed references
// - Must provide fallbacks for unrecognized commands
```

**4.5 Authorization & Security**
```typescript
// Critical security requirements:
class CommandAuthorizer {
  // Users can ONLY affect their own feeds
  async validateFeedAccess(reporterDid: string, feedIds: string[]): Promise<string[]> {
    const userFeeds = await this.db.getUserFeedsByDid(reporterDid);
    const userFeedIds = userFeeds.map(f => f.feed_id);
    
    // Return only feeds the user actually owns
    return feedIds.filter(id => userFeedIds.includes(id));
  }
  
  // Commands only execute if reporter is registered user
  async canExecuteCommands(reporterDid: string): Promise<boolean> {
    const user = await this.db.getUserByDid(reporterDid);
    return user !== null;
  }
}
```

**4.6 Command Processing Framework (Foundation Only)**
```typescript
// This upgrade implements FRAMEWORK only, not specific commands
class MultiUserCommandProcessor {
  async processCommands(event: ModEventView, comment: string, user: User) {
    // 1. Parse potential commands from comment text
    const potentialCommands = this.extractCommandCandidates(comment);
    
    // 2. Validate each command
    const validCommands = await this.validateCommands(potentialCommands, user);
    
    // 3. Execute validated commands
    for (const command of validCommands) {
      await this.executeCommand(command, user, event);
    }
  }
  
  private extractCommandCandidates(comment: string): CommandCandidate[] {
    // Framework for parsing - specific parsing logic NOT implemented yet
    // This upgrade creates the structure, not the implementation
    return [];
  }
  
  private async validateCommands(candidates: CommandCandidate[], user: User): Promise<ValidatedCommand[]> {
    // Framework for validation - specific validation NOT implemented yet
    return [];
  }
  
  private async executeCommand(command: ValidatedCommand, user: User, event: ModEventView) {
    // Framework for execution - specific actions NOT implemented yet
    // This is where future commands will be implemented
  }
}
```

**4.7 Database Schema for Commands**
```sql
-- Add command logging table
CREATE TABLE command_executions (
  id SERIAL PRIMARY KEY,
  reporter_did TEXT NOT NULL,
  post_uri TEXT NOT NULL,
  command_type TEXT NOT NULL,
  command_text TEXT NOT NULL,
  affected_feeds TEXT[], -- Array of feed IDs
  execution_status TEXT NOT NULL, -- 'success', 'failed', 'unauthorized'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add user feed name mapping for natural language parsing
ALTER TABLE feeds ADD COLUMN feed_display_name TEXT;
UPDATE feeds SET feed_display_name = feed_name WHERE feed_display_name IS NULL;
```

**4.8 Integration with Existing Report Processing**
```typescript
// Update existing processReport method in ozone.ts
private async processReport(event: ModEventView) {
  const reporterDid = event.createdBy;
  const comment = (event.event as any).comment || '';
  const reportType = this.parseReportType((event.event as any).reportType); // NEW parsing
  
  // Check if reporter is registered user
  const user = await this.db.getUserByDid(reporterDid);
  
  // Track report for communal intelligence (UPDATED for hierarchical types)
  if ((event.subject as any).$type === 'com.atproto.repo.strongRef') {
    await this.db.addPostReport((event.subject as any).uri, reportType, reporterDid);
  }

  // Process hierarchical report types (UPDATED)
  if (reportType !== 'other') {
    await this.processHierarchicalReport(event, reportType, user);
  }

  // Process commands for command-enabled types (NEW)
  if (user && this.isCommandEnabledType(reportType) && comment) {
    await this.commandProcessor.processCommands(event, comment, user);
  }
}

private isCommandEnabledType(reportType: string): boolean {
  const commandEnabledTypes = [
    'misleading-other', 'harassment-other', 'violence-other',
    'sexual-other', 'self-harm-other', 'rule-other', 'other'
  ];
  return commandEnabledTypes.includes(reportType);
}
```
```

### Phase 5: Testing & Validation

**5.1 Data Migration Testing**
- Backup existing database
- Test migration scripts on copy
- Validate all existing feeds migrate correctly
- Test rollback procedures

**5.2 Report Type Parsing Testing**
- Test all 30 confirmed report types
- Test legacy format compatibility
- Test special cases (ED, NCII)
- Test error handling for unknown types

**5.3 Threshold Logic Testing**
- Test subcategory threshold override
- Test main category fallback
- Test system default fallback
- Test edge cases (NULL values, invalid numbers)

**5.4 Frontend Integration Testing**
- Test hierarchical UI selection
- Test opt-in/threshold saving
- Test data loading and display
- Test responsive design

## Implementation Timeline

### Week 1: Database & Backend Core
- [ ] Create migration scripts
- [ ] Update database schema
- [ ] Implement new parsing logic
- [ ] Update database methods
- [ ] Update TypeScript types

### Week 2: Frontend Updates
- [ ] Design hierarchical UI components
- [ ] Implement report type selection
- [ ] Update feed configuration interface
- [ ] Test frontend integration

### Week 3: Command System Foundation
- [ ] Design multi-user command architecture
- [ ] Create command processing framework classes
- [ ] Implement user authorization and feed validation
- [ ] Add command logging database table
- [ ] Create command-enabled type detection
- [ ] Add integration points in report processing
- [ ] **IMPORTANT: DO NOT implement specific command parsing or execution**
- [ ] **FOUNDATION ONLY: Create structure for future command implementation**

### Week 4: Testing & Deployment
- [ ] Comprehensive testing
- [ ] Data migration validation
- [ ] Performance testing
- [ ] Production deployment
- [ ] Monitor for issues

## Risk Mitigation

### Database Migration Risks
- **Risk**: Data loss during migration
- **Mitigation**: Full backup, test on copy, rollback plan

### Parsing Logic Risks
- **Risk**: Unknown report type formats
- **Mitigation**: Comprehensive logging, fallback to 'other'

### Performance Risks
- **Risk**: 30+ database columns impact performance
- **Mitigation**: Proper indexing, query optimization

### User Experience Risks
- **Risk**: Complex UI overwhelming users
- **Mitigation**: Progressive disclosure, sensible defaults

## Success Criteria

### Technical Success
- [ ] All 30 report types parsed correctly
- [ ] Hierarchical thresholds working
- [ ] Database migration completed without data loss
- [ ] Frontend UI functional and intuitive

### Business Success
- [ ] Existing users can continue using their feeds
- [ ] New granular controls provide value
- [ ] System performance maintained
- [ ] Command system foundation ready for future expansion

## Future Enhancements (Post-Upgrade)

### Command System Implementation (Phase 2 - Separate Project)
**This upgrade creates the foundation. Actual command implementation is a separate project.**

**Command Types to Implement Later**:
- **Feed Management Commands**
  - "remove from [feed-name]" - Remove post from specific feed
  - "remove from all my feeds" - Remove from all user's feeds
  - "block user from my feeds" - Block post author across user's feeds

- **Custom Labeling Commands**
  - "label as [custom-label]" - Apply user-defined label
  - "add [label] to all feeds" - Apply label across user's feeds
  - Note: Labels must be user-scoped, not global like ozone-report-to-autolabel

- **Feed-Specific Actions**
  - "flag for review in [feed-name]" - Mark for manual review
  - "escalate to admin" - Forward to feed administrator

**Implementation Requirements for Phase 2**:
- Natural language processing for feed name recognition
- User-scoped label management system
- Feed name → feed ID resolution
- Command history and audit trail
- Error handling and user feedback
- Command suggestion system

**Key Architectural Decisions for Phase 2**:
- Commands affect ONLY the reporter's own feeds (never other users' feeds)
- Custom labels are user-scoped (each user has their own label vocabulary)
- Feed references must be validated against user's actual feeds
- All commands must be logged for audit and debugging
- Failed commands should provide helpful error messages

### Advanced Features
- Cross-feed intelligence sharing
- Machine learning threshold optimization
- Advanced reporting and analytics
- API for third-party integrations

---

**Note**: This upgrade is essential for maintaining compatibility with Bluesky's evolving moderation system. The hierarchical structure provides much more granular control while maintaining the communal moderation benefits that make feed-moderator valuable.