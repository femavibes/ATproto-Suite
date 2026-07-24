import { ModMasterCommandParser } from './src/services/modMasterCommandParser.js';

const parser = new ModMasterCommandParser();

console.log('Testing ModMaster Command Parser\n');

// Test remove commands
console.log('=== REMOVE COMMANDS ===');
console.log('remove:', JSON.stringify(parser.parseCommands('remove'), null, 2));
console.log('remove all:', JSON.stringify(parser.parseCommands('remove all'), null, 2));
console.log('remove feed1:', JSON.stringify(parser.parseCommands('remove feed1'), null, 2));
console.log('remove feed1,feed2,feed3:', JSON.stringify(parser.parseCommands('remove feed1,feed2,feed3'), null, 2));

// Test ban commands
console.log('\n=== BAN COMMANDS ===');
console.log('ban:', JSON.stringify(parser.parseCommands('ban'), null, 2));
console.log('ban all:', JSON.stringify(parser.parseCommands('ban all'), null, 2));
console.log('ban feed1:', JSON.stringify(parser.parseCommands('ban feed1'), null, 2));
console.log('ban feed1,feed3:', JSON.stringify(parser.parseCommands('ban feed1,feed3'), null, 2));

// Test label commands
console.log('\n=== LABEL COMMANDS ===');
console.log('label spam:', JSON.stringify(parser.parseCommands('label spam'), null, 2));
console.log('label spam,clutter,promotional:', JSON.stringify(parser.parseCommands('label spam,clutter,promotional'), null, 2));

// Test unlabel commands
console.log('\n=== UNLABEL COMMANDS ===');
console.log('unlabel spam:', JSON.stringify(parser.parseCommands('unlabel spam'), null, 2));
console.log('unlabel spam,clutter:', JSON.stringify(parser.parseCommands('unlabel spam,clutter'), null, 2));

// Test multiple commands
console.log('\n=== MULTIPLE COMMANDS ===');
console.log('remove feed1\\nban feed2:', JSON.stringify(parser.parseCommands('remove feed1\nban feed2'), null, 2));
console.log('label spam\\nunlabel clutter:', JSON.stringify(parser.parseCommands('label spam\nunlabel clutter'), null, 2));

// Test validation
console.log('\n=== VALIDATION ===');
const userFeeds = ['feed1', 'feed2', 'myfeed'];

const cmd1 = parser.parseCommands('remove feed1')[0];
console.log('Valid remove feed1:', parser.validateCommand(cmd1, userFeeds, false));

const cmd2 = parser.parseCommands('remove feed99')[0];
console.log('Invalid remove feed99:', parser.validateCommand(cmd2, userFeeds, false));

const cmd3 = parser.parseCommands('label spam')[0];
console.log('Label on ModMaster (invalid):', parser.validateCommand(cmd3, userFeeds, false));

const cmd4 = parser.parseCommands('label spam')[0];
console.log('Label on custom labeler (valid):', parser.validateCommand(cmd4, userFeeds, true));

console.log('\n✅ All tests complete!');
