#!/usr/bin/env node

/**
 * Test script to re-fetch polygons for Oregon cities only
 * Usage: node test-oregon-parser.js
 */

// Try Docker path first, then local path
const parserPath = require('fs').existsSync('/data-parser/parse-geoapify.js') 
  ? '/data-parser/parse-geoapify.js'
  : require('path').join(__dirname, './services/data-parser/parse-geoapify.js');
const { insertGeoapifyData } = require(parserPath);

async function testOregonParser() {
  console.log('Starting Oregon-only polygon refresh test...');
  console.log('This will re-fetch polygons for all Oregon cities with force refresh enabled.\n');
  
  try {
    const stats = await insertGeoapifyData(
      ['us'], // Country
      50000, // Min population (50k threshold)
      false, // dryRun
      false, // deleteUnmatched
      true, // fetchPolygons
      true, // forceRefreshPolygons
      'OR'  // regionFilter - only process Oregon cities
    );
    
    console.log('\n=== Oregon Parser Test Results ===');
    console.log(`Cities matched: ${stats.matched}`);
    console.log(`Cities updated: ${stats.updated}`);
    console.log(`Cities inserted: ${stats.inserted}`);
    console.log(`Regions created: ${stats.regionsCreated}`);
    console.log(`Errors: ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testOregonParser();
