const { AtpAgent } = require('@atproto/api');

async function testAtUri() {
  const agent = new AtpAgent({ service: 'https://lists.fema.monster' });
  
  const listUri = 'at://did:web:lists.fema.monster/app.bsky.graph.list/US-NY-NewYorkCity';
  
  try {
    console.log('Testing AT URI:', listUri);
    console.log('');
    
    // Try to get the list
    const response = await agent.app.bsky.graph.getList({
      list: listUri,
      limit: 5
    });
    
    console.log('✅ Success!');
    console.log('List:', response.data.list.name);
    console.log('Members:', response.data.items.length);
    console.log('');
    console.log('First few members:');
    response.data.items.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.subject}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('This is expected - AT URIs need to be resolved through');
    console.error('the AT Protocol network, not directly via HTTP.');
    console.error('');
    console.error('For now, use the HTTPS format:');
    console.error('https://lists.fema.monster/xrpc/app.bsky.graph.getList?list=at://...');
  }
}

testAtUri();
