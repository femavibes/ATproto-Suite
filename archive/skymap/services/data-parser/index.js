const { parseCensusData } = require('./parse-census');
const { parseCanadaCensusData } = require('./parse-canada-census');

console.log('SkyMap Data Parser starting...');
console.log('To parse US census data, run: docker-compose exec data-parser npm run parse');
console.log('To parse Canadian census data, run: docker-compose exec data-parser npm run parse-canada');

// Keep container running
process.stdin.resume();