// Test command parsing logic
function extractCommandCandidates(comment) {
  const candidates = [];
  const lowerComment = comment.toLowerCase().trim();
  
  // Parse "remove" commands
  if (lowerComment.startsWith('remove ')) {
    const target = lowerComment.substring(7).trim(); // Remove "remove "
    
    if (target === 'all') {
      candidates.push({
        text: comment,
        confidence: 1.0,
        parsedAction: 'remove',
        parsedScope: 'all-feeds',
        parsedFeeds: ['all']
      });
    } else {
      // Specific feed name
      candidates.push({
        text: comment,
        confidence: 0.9,
        parsedAction: 'remove',
        parsedScope: 'specific-feed',
        parsedFeeds: [target]
      });
    }
  }
  
  // Parse "ban" commands
  else if (lowerComment.startsWith('ban')) {
    const parts = lowerComment.split(' ');
    
    if (parts.length === 1) {
      // Just "ban" - global ban
      candidates.push({
        text: comment,
        confidence: 1.0,
        parsedAction: 'ban',
        parsedScope: 'global',
        parsedFeeds: ['all']
      });
    } else {
      // "ban <feedname>" - feed-specific ban
      const feedName = parts.slice(1).join(' ').trim();
      candidates.push({
        text: comment,
        confidence: 0.9,
        parsedAction: 'ban',
        parsedScope: 'specific-feed',
        parsedFeeds: [feedName]
      });
    }
  }
  
  return candidates;
}

// Test cases
const testCommands = [
  'remove all',
  'remove urbanism',
  'remove my climate feed',
  'ban',
  'ban urbanism',
  'ban climate feed',
  'Remove All',  // Test case sensitivity
  'BAN',
  'this is not a command',
  'remove',  // Edge case
  'ban some feed with spaces'
];

console.log('Testing command parsing:');
console.log('='.repeat(50));

testCommands.forEach(command => {
  const candidates = extractCommandCandidates(command);
  console.log(`\nInput: "${command}"`);
  if (candidates.length === 0) {
    console.log('  No commands detected');
  } else {
    candidates.forEach((candidate, i) => {
      console.log(`  Command ${i + 1}:`);
      console.log(`    Action: ${candidate.parsedAction}`);
      console.log(`    Scope: ${candidate.parsedScope}`);
      console.log(`    Feeds: ${JSON.stringify(candidate.parsedFeeds)}`);
      console.log(`    Confidence: ${candidate.confidence}`);
    });
  }
});