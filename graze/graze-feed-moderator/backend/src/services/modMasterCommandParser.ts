// ModMaster Command Parser
// Parses commands from Ozone report comments

export interface ParsedCommand {
  type: 'remove' | 'ban' | 'label' | 'unlabel' | 'restore' | 'unban' | 'bulk_remove' | 'bulk_restore';
  targets: string[]; // feed names, group names (with group: prefix), or label names
  scope: 'all' | 'specific';
  count?: number; // for bulk operations
}

export class ModMasterCommandParser {
  /**
   * Parse commands from report comment
   * Examples:
   * - "remove" -> { type: 'remove', targets: [], scope: 'specific' } (configured feeds)
   * - "remove all" -> { type: 'remove', targets: ['all'], scope: 'all' } (all feeds)
   * - "remove feed1,feed3" -> { type: 'remove', targets: ['feed1', 'feed3'], scope: 'specific' }
   * - "remove group:mygroup" -> { type: 'remove', targets: ['group:mygroup'], scope: 'specific' }
   * - "remove g mygroup" -> { type: 'remove', targets: ['group:mygroup'], scope: 'specific' }
   * - "ban" -> { type: 'ban', targets: ['global'], scope: 'specific' } (global only)
   * - "ban all" -> { type: 'ban', targets: [], scope: 'all' } (all ban lists)
   * - "ban feed1" -> { type: 'ban', targets: ['feed1'], scope: 'specific' }
   * - "label spam,clutter" -> { type: 'label', targets: ['spam', 'clutter'], scope: 'specific' }
   * - "unlabel spam" -> { type: 'unlabel', targets: ['spam'], scope: 'specific' }
   * - "restore" -> { type: 'restore', targets: [], scope: 'specific' } (configured feeds)
   * - "restore all" -> { type: 'restore', targets: ['all'], scope: 'all' } (all feeds)
   * - "restore feed1" -> { type: 'restore', targets: ['feed1'], scope: 'specific' }
   * - "unban" -> { type: 'unban', targets: ['global'], scope: 'specific' } (global only)
   * - "unban all" -> { type: 'unban', targets: [], scope: 'all' } (all ban lists)
   * - "unban feed1" -> { type: 'unban', targets: ['feed1'], scope: 'specific' }
   * - "bulk remove feedname 50" -> { type: 'bulk_remove', targets: ['feedname'], scope: 'specific', count: 50 }
   * - "bulk remove g mygroup 50" -> { type: 'bulk_remove', targets: ['group:mygroup'], scope: 'specific', count: 50 }
   * - "remove group:testgroup" -> { type: 'remove', targets: ['group:testgroup'], scope: 'specific' }
   * - "ban g testgroup" -> { type: 'ban', targets: ['group:testgroup'], scope: 'specific' }
   * - "bulk remove 50" -> { type: 'bulk_remove', targets: [], scope: 'all', count: 50 }
   * - "bulk remove all 50" -> { type: 'bulk_remove', targets: [], scope: 'all', count: 50 }
   * - "bulk restore feedname 25" -> { type: 'bulk_restore', targets: ['feedname'], scope: 'specific', count: 25 }
   */
  parseCommands(comment: string): ParsedCommand[] {
    if (!comment || !comment.trim()) {
      return [];
    }

    const commands: ParsedCommand[] = [];
    const lines = comment.split('\n').map(l => l.trim()).filter(l => l);

    for (const line of lines) {
      const parsed = this.parseLine(line);
      if (parsed) {
        commands.push(parsed);
      }
    }

    return commands;
  }

  private parseLine(line: string): ParsedCommand | null {
    const trimmed = line.trim().toLowerCase();
    
    // Remove command
    if (trimmed.startsWith('remove')) {
      return this.parseRemoveCommand(trimmed);
    }
    
    // Ban command
    if (trimmed.startsWith('ban')) {
      return this.parseBanCommand(trimmed);
    }
    
    // Label command (custom labeler only)
    if (trimmed.startsWith('label ')) {
      return this.parseLabelCommand(trimmed);
    }
    
    // Unlabel command (custom labeler only)
    if (trimmed.startsWith('unlabel ')) {
      return this.parseUnlabelCommand(trimmed);
    }
    
    // Restore command
    if (trimmed.startsWith('restore')) {
      return this.parseRestoreCommand(trimmed);
    }
    
    // Unban command
    if (trimmed.startsWith('unban')) {
      return this.parseUnbanCommand(trimmed);
    }
    
    // Bulk remove command
    if (trimmed.startsWith('bulk remove')) {
      return this.parseBulkRemoveCommand(trimmed);
    }
    
    // Bulk restore command
    if (trimmed.startsWith('bulk restore')) {
      return this.parseBulkRestoreCommand(trimmed);
    }

    return null;
  }

  private parseRemoveCommand(line: string): ParsedCommand {
    // "remove" -> configured feeds only
    if (line === 'remove') {
      return { type: 'remove', targets: [], scope: 'specific' };
    }
    
    // "remove all" -> ALL user's feeds (single API call)
    if (line === 'remove all') {
      return { type: 'remove', targets: ['all'], scope: 'all' };
    }

    // "remove feed1,feed2,feed3" -> specific feeds
    const match = line.match(/^remove\s+(.+)$/);
    if (match) {
      const targets = this.normalizeTargets(match[1]);
      if (targets.includes('all')) {
        return { type: 'remove', targets: ['all'], scope: 'all' };
      }
      return { type: 'remove', targets, scope: 'specific' };
    }

    // Default to configured feeds
    return { type: 'remove', targets: [], scope: 'specific' };
  }

  private parseBanCommand(line: string): ParsedCommand {
    // "ban" -> global ban list only
    if (line === 'ban') {
      return { type: 'ban', targets: ['global'], scope: 'specific' };
    }
    
    // "ban all" -> global + all feed ban lists
    if (line === 'ban all') {
      return { type: 'ban', targets: [], scope: 'all' };
    }

    // "ban global,feed1,feed2" or "ban feed1,feed2" -> specific targets
    const match = line.match(/^ban\s+(.+)$/);
    if (match) {
      const targets = this.normalizeTargets(match[1]);
      return { type: 'ban', targets, scope: 'specific' };
    }

    // Default to global only
    return { type: 'ban', targets: ['global'], scope: 'specific' };
  }

  private parseLabelCommand(line: string): ParsedCommand {
    // "label label1,label2,label3"
    const match = line.match(/^label\s+(.+)$/);
    if (match) {
      const targets = match[1].split(',').map(t => t.trim()).filter(t => t);
      return { type: 'label', targets, scope: 'specific' };
    }

    return { type: 'label', targets: [], scope: 'specific' };
  }

  private parseUnlabelCommand(line: string): ParsedCommand {
    // "unlabel label1,label2,label3"
    const match = line.match(/^unlabel\s+(.+)$/);
    if (match) {
      const targets = match[1].split(',').map(t => t.trim()).filter(t => t);
      return { type: 'unlabel', targets, scope: 'specific' };
    }

    return { type: 'unlabel', targets: [], scope: 'specific' };
  }

  private parseRestoreCommand(line: string): ParsedCommand {
    // "restore" -> configured feeds only
    if (line === 'restore') {
      return { type: 'restore', targets: [], scope: 'specific' };
    }
    
    // "restore all" -> ALL user's feeds (single API call)
    if (line === 'restore all') {
      return { type: 'restore', targets: ['all'], scope: 'all' };
    }

    // "restore feed1,feed2,feed3" -> specific feeds
    const match = line.match(/^restore\s+(.+)$/);
    if (match) {
      const targets = this.normalizeTargets(match[1]);
      if (targets.includes('all')) {
        return { type: 'restore', targets: ['all'], scope: 'all' };
      }
      return { type: 'restore', targets, scope: 'specific' };
    }

    // Default to configured feeds
    return { type: 'restore', targets: [], scope: 'specific' };
  }

  private parseUnbanCommand(line: string): ParsedCommand {
    // "unban" -> global ban list only
    if (line === 'unban') {
      return { type: 'unban', targets: ['global'], scope: 'specific' };
    }
    
    // "unban all" -> global + all feed ban lists
    if (line === 'unban all') {
      return { type: 'unban', targets: [], scope: 'all' };
    }

    // "unban global,feed1,feed2" or "unban feed1,feed2" -> specific targets
    const match = line.match(/^unban\s+(.+)$/);
    if (match) {
      const targets = this.normalizeTargets(match[1]);
      return { type: 'unban', targets, scope: 'specific' };
    }

    // Default to global only
    return { type: 'unban', targets: ['global'], scope: 'specific' };
  }

  private parseBulkRemoveCommand(line: string): ParsedCommand {
    // "bulk remove" -> configured feeds, default count 10
    if (line === 'bulk remove') {
      return { type: 'bulk_remove', targets: [], scope: 'specific', count: 10 };
    }
    
    // "bulk remove 50" -> configured feeds, count 50
    const countMatch = line.match(/^bulk remove\s+(\d+)$/);
    if (countMatch) {
      const count = Math.min(parseInt(countMatch[1]), 100);
      return { type: 'bulk_remove', targets: [], scope: 'specific', count };
    }
    
    // "bulk remove all 50" -> ALL account feeds, count 50
    const allCountMatch = line.match(/^bulk remove\s+all\s+(\d+)$/);
    if (allCountMatch) {
      const count = Math.min(parseInt(allCountMatch[1]), 100);
      return { type: 'bulk_remove', targets: ['all'], scope: 'all', count };
    }
    
    // "bulk remove all" -> ALL account feeds, default count 10
    if (line === 'bulk remove all') {
      return { type: 'bulk_remove', targets: ['all'], scope: 'all', count: 10 };
    }

    // "bulk remove feed1,feed2 50" or "bulk remove g mygroup 30" -> specific targets with count
    const specificMatch = line.match(/^bulk remove\s+([^\d]+)\s+(\d+)$/);
    if (specificMatch) {
      const targets = this.normalizeTargets(specificMatch[1]).filter(t => t !== 'all');
      const count = Math.min(parseInt(specificMatch[2]), 100);
      return { type: 'bulk_remove', targets, scope: 'specific', count };
    }
    
    // "bulk remove feed1,feed2" or "bulk remove g mygroup" -> specific targets, default count 10
    const targetsMatch = line.match(/^bulk remove\s+([^\d]+)$/);
    if (targetsMatch) {
      const targets = this.normalizeTargets(targetsMatch[1]).filter(t => t !== 'all');
      return { type: 'bulk_remove', targets, scope: 'specific', count: 10 };
    }

    return { type: 'bulk_remove', targets: [], scope: 'specific', count: 10 };
  }

  private parseBulkRestoreCommand(line: string): ParsedCommand {
    // "bulk restore" -> configured feeds, default count 10
    if (line === 'bulk restore') {
      return { type: 'bulk_restore', targets: [], scope: 'specific', count: 10 };
    }
    
    // "bulk restore 50" -> configured feeds, count 50
    const countMatch = line.match(/^bulk restore\s+(\d+)$/);
    if (countMatch) {
      const count = Math.min(parseInt(countMatch[1]), 100);
      return { type: 'bulk_restore', targets: [], scope: 'specific', count };
    }
    
    // "bulk restore all 50" -> ALL account feeds, count 50
    const allCountMatch = line.match(/^bulk restore\s+all\s+(\d+)$/);
    if (allCountMatch) {
      const count = Math.min(parseInt(allCountMatch[1]), 100);
      return { type: 'bulk_restore', targets: ['all'], scope: 'all', count };
    }
    
    // "bulk restore all" -> ALL account feeds, default count 10
    if (line === 'bulk restore all') {
      return { type: 'bulk_restore', targets: ['all'], scope: 'all', count: 10 };
    }

    // "bulk restore feed1,feed2 50" or "bulk restore g mygroup 30" -> specific targets with count
    const specificMatch = line.match(/^bulk restore\s+([^\d]+)\s+(\d+)$/);
    if (specificMatch) {
      const targets = this.normalizeTargets(specificMatch[1]).filter(t => t !== 'all');
      const count = Math.min(parseInt(specificMatch[2]), 100);
      return { type: 'bulk_restore', targets, scope: 'specific', count };
    }
    
    // "bulk restore feed1,feed2" or "bulk restore g mygroup" -> specific targets, default count 10
    const targetsMatch = line.match(/^bulk restore\s+([^\d]+)$/);
    if (targetsMatch) {
      const targets = this.normalizeTargets(targetsMatch[1]).filter(t => t !== 'all');
      return { type: 'bulk_restore', targets, scope: 'specific', count: 10 };
    }

    return { type: 'bulk_restore', targets: [], scope: 'specific', count: 10 };
  }

  /**
   * Normalize targets to handle 'g groupname' -> 'group:groupname' conversion
   */
  private normalizeTargets(targetString: string): string[] {
    return targetString.split(',').map(t => {
      const trimmed = t.trim();
      // Convert 'g groupname' to 'group:groupname'
      if (trimmed.startsWith('g ')) {
        return 'group:' + trimmed.substring(2);
      }
      // Convert 'group groupname' to 'group:groupname'
      if (trimmed.startsWith('group ')) {
        return 'group:' + trimmed.substring(6);
      }
      return trimmed;
    }).filter(t => t);
  }

  /**
   * Validate command against user's feeds and permissions
   * Note: Group permissions are validated separately in multiUserCommandProcessor
   */
  validateCommand(command: ParsedCommand, userFeeds: string[], isCustomLabeler: boolean, isAdmin: boolean = false): {
    valid: boolean;
    error?: string;
  } {
    // Label/unlabel only allowed on custom labeler or admin users on ModMaster
    if ((command.type === 'label' || command.type === 'unlabel') && !isCustomLabeler && !isAdmin) {
      return {
        valid: false,
        error: 'Label commands only work with custom labelers or admin users on ModMaster'
      };
    }

    // If specific targets, validate they exist (except for remove/restore which can have empty targets = configured feeds)
    if (command.scope === 'specific' && command.targets.length === 0) {
      // Allow empty targets for remove/restore (means all configured feeds)
      if (command.type !== 'remove' && command.type !== 'restore' && command.type !== 'bulk_remove' && command.type !== 'bulk_restore') {
        return {
          valid: false,
          error: `No ${command.type === 'label' || command.type === 'unlabel' ? 'labels' : 'feeds'} specified`
        };
      }
    }

    // For feed-specific commands, check user owns them (except 'global' and 'group:' prefixes)
    // Group permissions are validated separately in the command processor
    if ((command.type === 'remove' || command.type === 'ban' || command.type === 'restore' || command.type === 'unban') && command.scope === 'specific') {
      const invalidFeeds = command.targets.filter(t => {
        // Skip validation for global and group: prefixes (handled elsewhere)
        if (t === 'global' || t.startsWith('group:')) {
          return false;
        }
        // Check if user owns this feed (case-insensitive)
        return !userFeeds.some(feed => feed.toLowerCase() === t.toLowerCase());
      });
      if (invalidFeeds.length > 0) {
        return {
          valid: false,
          error: `You don't own these feeds: ${invalidFeeds.join(', ')}`
        };
      }
    }

    // For bulk commands with specific feeds, validate ownership (except 'group:' prefixes)
    // Group permissions are validated separately in the command processor
    if ((command.type === 'bulk_remove' || command.type === 'bulk_restore') && command.scope === 'specific') {
      const invalidFeeds = command.targets.filter(t => {
        // Skip validation for global and group: prefixes (handled elsewhere)
        if (t === 'global' || t.startsWith('group:')) {
          return false;
        }
        // Check if user owns this feed (case-insensitive)
        return !userFeeds.some(feed => feed.toLowerCase() === t.toLowerCase());
      });
      if (invalidFeeds.length > 0) {
        return {
          valid: false,
          error: `You don't own these feeds: ${invalidFeeds.join(', ')}`
        };
      }
    }

    return { valid: true };
  }
}
