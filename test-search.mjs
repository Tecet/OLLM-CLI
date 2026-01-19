#!/usr/bin/env node

async function testSearch() {
  console.log('Testing MCP Registry Search...\n');
  
  // Test 1: Search for context7
  console.log('1. Searching for "context7"...');
  try {
    const response = await fetch('https://registry.modelcontextprotocol.io/v0/servers?q=context7&limit=10', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OLLM-CLI/0.1.0',
      },
    });
    
    const data = await response.json();
    console.log(`   Found ${data.servers?.length || 0} results`);
    
    if (data.servers && data.servers.length > 0) {
      data.servers.forEach((wrapper, i) => {
        const server = wrapper.server;
        console.log(`   ${i + 1}. ${server.name} - ${server.description.substring(0, 60)}...`);
      });
    }
  } catch (error) {
    console.error('   Error:', error.message);
  }
  
  // Test 2: Search for brave
  console.log('\n2. Searching for "brave"...');
  try {
    const response = await fetch('https://registry.modelcontextprotocol.io/v0/servers?q=brave&limit=10', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OLLM-CLI/0.1.0',
      },
    });
    
    const data = await response.json();
    console.log(`   Found ${data.servers?.length || 0} results`);
    
    if (data.servers && data.servers.length > 0) {
      data.servers.forEach((wrapper, i) => {
        const server = wrapper.server;
        console.log(`   ${i + 1}. ${server.name} - ${server.description.substring(0, 60)}...`);
      });
    }
  } catch (error) {
    console.error('   Error:', error.message);
  }
  
  // Test 3: Get specific server details
  console.log('\n3. Getting details for "io.github.upstash/context7"...');
  try {
    const response = await fetch('https://registry.modelcontextprotocol.io/v0/servers/io.github.upstash%2Fcontext7', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OLLM-CLI/0.1.0',
      },
    });
    
    if (response.ok) {
      const wrapper = await response.json();
      const server = wrapper.server;
      console.log(`   ✓ Found: ${server.name}`);
      console.log(`   Description: ${server.description}`);
      console.log(`   Version: ${server.version}`);
      console.log(`   Package: ${server.packages?.[0]?.identifier}`);
      console.log(`   Env vars: ${server.packages?.[0]?.environmentVariables?.map(v => v.name).join(', ')}`);
    } else {
      console.log(`   ✗ Not found (${response.status})`);
    }
  } catch (error) {
    console.error('   Error:', error.message);
  }
  
  console.log('\n✓ Search test complete!');
}

testSearch();
