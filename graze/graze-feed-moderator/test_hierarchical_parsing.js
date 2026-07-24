// Simple test for hierarchical report type parsing
function parseReportType(reportTypeReason) {
  // Handle new AT Protocol URI format: tools.ozone.report.defs#reasonMisleadingSpam
  if (reportTypeReason.startsWith('tools.ozone.report.defs#reason')) {
    const reasonPart = reportTypeReason.substring('tools.ozone.report.defs#reason'.length);
    // Convert CamelCase to kebab-case: MisleadingSpam -> misleading-spam
    // Special cases: ED -> ed, NCII -> ncii
    let converted = reasonPart.replace(/([A-Z])/g, '-$1').toLowerCase().substring(1);
    converted = converted.replace('-e-d', '-ed').replace('-n-c-i-i', '-ncii');
    return converted;
  }
  
  // Legacy compatibility during transition
  const legacyMappings = {
    'com.atproto.moderation.defs#reasonSpam': 'misleading-spam',
    'com.atproto.moderation.defs#reasonMisleading': 'misleading-other',
    'com.atproto.moderation.defs#reasonSexual': 'sexual-other',
    'com.atproto.moderation.defs#reasonRude': 'harassment-other',
    'com.atproto.moderation.defs#reasonViolation': 'rule-other',
    'com.atproto.moderation.defs#reasonOther': 'other'
  };
  
  return legacyMappings[reportTypeReason] || 'other';
}

// Test cases
const testCases = [
  'tools.ozone.report.defs#reasonMisleadingSpam',
  'tools.ozone.report.defs#reasonHarassmentDoxxing',
  'tools.ozone.report.defs#reasonSelfHarmED',
  'tools.ozone.report.defs#reasonSexualNCII',
  'com.atproto.moderation.defs#reasonSpam',
  'com.atproto.moderation.defs#reasonOther'
];

console.log('Testing hierarchical report type parsing:');
testCases.forEach(testCase => {
  const result = parseReportType(testCase);
  console.log(`${testCase} -> ${result}`);
});