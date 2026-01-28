#!/usr/bin/env node
/**
 * Test script to verify MCP Marketplace connection
 */

console.log('Testing MCP Marketplace Connection...\n');

async function testMarketplace() {
  try {
    // Test 1: Fetch servers from registry
    console.log('1. Fetching servers from registry...');
    const response = await fetch('https://registry.modelcontextprotocol.io/v0/servers?limit=10', {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OLLM-CLI/0.1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Registry returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✓ Successfully fetched ${data.servers?.length || 0} servers`);

    // Test 2: Check for specific servers
    console.log('\n2. Looking for test servers...');
    const serverNames = data.servers.map((s) => s.server.name);

    const upstashContext7 = serverNames.find((n) => n.includes('upstash') && n.includes('context'));
    const smitheryBrave = serverNames.find((n) => n.includes('smithery') || n.includes('brave'));

    if (upstashContext7) {
      console.log(`✓ Found Upstash Context7: ${upstashContext7}`);
    } else {
      console.log('✗ Upstash Context7 not found in first 10 results');
    }

    if (smitheryBrave) {
      console.log(`✓ Found Smithery Brave: ${smitheryBrave}`);
    } else {
      console.log('✗ Smithery Brave not found in first 10 results');
    }

    // Test 3: Display sample servers
    console.log('\n3. Sample servers from registry:');
    data.servers.slice(0, 5).forEach((wrapper, i) => {
      const server = wrapper.server;
      console.log(`   ${i + 1}. ${server.name}`);
      console.log(`      ${server.description}`);
      console.log(`      Version: ${server.version || 'N/A'}`);
    });

    console.log('\n✓ Marketplace connection test PASSED!');
    console.log('\nThe marketplace is working and ready to use.');
  } catch (error) {
    console.error('\n✗ Marketplace connection test FAILED!');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testMarketplace();
