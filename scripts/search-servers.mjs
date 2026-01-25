#!/usr/bin/env node

async function searchServers() {
  try {
    console.log('Searching for servers in MCP Registry...\n');
    
    let allServers = [];
    let cursor = null;
    let page = 1;
    
    // Fetch multiple pages
    while (page <= 5) {
      const url = cursor 
        ? `https://registry.modelcontextprotocol.io/v0/servers?limit=100&cursor=${cursor}`
        : 'https://registry.modelcontextprotocol.io/v0/servers?limit=100';
      
      console.log(`Fetching page ${page}...`);
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'OLLM-CLI/0.1.0',
        },
      });
      
      const data = await response.json();
      allServers = allServers.concat(data.servers || []);
      
      cursor = data.metadata?.nextCursor;
      if (!cursor) break;
      page++;
    }
    
    console.log(`\nTotal servers fetched: ${allServers.length}\n`);
    
    // Search for specific servers
    const serverNames = allServers.map(s => s.server.name);
    
    console.log('Searching for Upstash/Context7...');
    const upstash = serverNames.filter(n => 
      n.toLowerCase().includes('upstash') || 
      n.toLowerCase().includes('context7') ||
      n.toLowerCase().includes('context')
    );
    console.log('Found:', upstash.slice(0, 10));
    
    console.log('\nSearching for Brave/Smithery...');
    const brave = serverNames.filter(n => 
      n.toLowerCase().includes('brave') || 
      n.toLowerCase().includes('smithery')
    );
    console.log('Found:', brave.slice(0, 10));
    
    // Show all server names for reference
    console.log('\n\nAll available servers (first 50):');
    serverNames.slice(0, 50).forEach((name, i) => {
      console.log(`${i + 1}. ${name}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

searchServers();
