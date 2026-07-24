import { AtpAgent } from '@atproto/api';

async function checkListWeb() {
  try {
    const agent = new AtpAgent({ service: 'https://public.api.bsky.app' });
    const listUri = 'at://did:plc:lptjvw6ut224kwrj7ub3sqbe/app.bsky.graph.list/3m5wsuarojx2i';
    
    console.log('🔍 Checking FULL list via public API (all pages)...');
    
    let allItems: any[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    
    // Get all pages
    do {
      const list = await agent.api.app.bsky.graph.getList({
        list: listUri,
        limit: 100,
        cursor
      });
      
      if (pageCount === 0) {
        console.log(`List: "${list.data.name}"`);
      }
      
      allItems.push(...list.data.items);
      cursor = list.data.cursor;
      pageCount++;
      
      console.log(`Page ${pageCount}: ${list.data.items.length} items`);
    } while (cursor);
    
    console.log(`\nTotal items across all pages: ${allItems.length}`);
    
    const debugItem = allItems.find((item: any) => 
      item.subject.handle === 'debug.fema.monster' || 
      item.subject.did === 'did:plc:3wh3o5qteklqxtz4d4iz3taq'
    );
    
    if (debugItem) {
      console.log('❌ debug.fema.monster FOUND in list:');
      console.log(`   Handle: ${debugItem.subject.handle}`);
      console.log(`   DID: ${debugItem.subject.did}`);
    } else {
      console.log('✅ debug.fema.monster NOT found in full list');
    }
    
    // Show first few items for reference
    console.log('\nFirst 5 items in list:');
    allItems.slice(0, 5).forEach((item: any, i: number) => {
      console.log(`  ${i+1}. ${item.subject.handle} (${item.subject.did})`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkListWeb();