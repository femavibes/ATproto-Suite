import { AtpAgent } from '@atproto/api';

async function verifyList() {
  try {
    const agent = new AtpAgent({ service: 'https://public.api.bsky.app' });
    
    // Check the list from the URL you provided
    const webListId = '3m5wsuarojx2i';
    const listUri = `at://did:plc:lptjvw6ut224kwrj7ub3sqbe/app.bsky.graph.list/${webListId}`;
    
    console.log(`🔍 Verifying list: ${listUri}`);
    console.log(`Web URL: https://bsky.app/profile/fema.monster/lists/${webListId}`);
    
    const list = await agent.api.app.bsky.graph.getList({
      list: listUri,
      limit: 100
    });
    
    console.log(`\nList Details:`);
    console.log(`  Name: "${list.data.name}"`);
    console.log(`  Description: "${list.data.description || 'No description'}"`);
    console.log(`  Purpose: ${list.data.purpose}`);
    console.log(`  Creator: ${list.data.creator.handle}`);
    console.log(`  Items in first page: ${list.data.items.length}`);
    
    if (list.data.items.length > 0) {
      console.log(`\nAll users in list:`);
      list.data.items.forEach((item: any, i: number) => {
        console.log(`  ${i+1}. ${item.subject.handle} (${item.subject.displayName || 'No display name'})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

verifyList();