/**
 * Test DuckDuckGo Search Provider
 * Run with: node scripts/test-duckduckgo.mjs
 */

import { DuckDuckGoSearchProvider } from '../packages/core/dist/tools/providers/duckduckgo-search.js';

async function testSearch() {
  console.log('Testing DuckDuckGo Search Provider...\n');

  const provider = new DuckDuckGoSearchProvider();

  try {
    console.log('Searching for: "NVIDIA stock price today"');
    const results = await provider.search('NVIDIA stock price today', 5);

    console.log(`\nFound ${results.length} results:\n`);

    if (results.length === 0) {
      console.log('❌ No results found - HTML parsing may be failing');
    } else {
      results.forEach((result, i) => {
        console.log(`${i + 1}. ${result.title}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSearch();
