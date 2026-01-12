/**
 * Manual test for summarize strategy
 */

import { ChatCompressionService } from './packages/core/src/services/chatCompressionService.js';
import type { SessionMessage } from './packages/core/src/services/types.js';

async function testSummarize() {
  const service = new ChatCompressionService();

  const messages: SessionMessage[] = [
    {
      role: 'system',
      parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
      timestamp: '2024-01-01T00:00:00Z',
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'What is TypeScript?' }],
      timestamp: '2024-01-01T00:01:00Z',
    },
    {
      role: 'assistant',
      parts: [{ type: 'text', text: 'TypeScript is a typed superset of JavaScript.' }],
      timestamp: '2024-01-01T00:02:00Z',
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'What are its benefits?' }],
      timestamp: '2024-01-01T00:03:00Z',
    },
    {
      role: 'assistant',
      parts: [{ type: 'text', text: 'TypeScript provides type safety, better IDE support, and catches errors at compile time.' }],
      timestamp: '2024-01-01T00:04:00Z',
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'How do I install it?' }],
      timestamp: '2024-01-01T00:05:00Z',
    },
  ];

  console.log('Testing summarize strategy without provider (should use placeholder)...');
  const result = await service.summarize(messages, 50); // Small target to force summarization
  
  console.log('\nOriginal messages:', messages.length);
  console.log('Compressed messages:', result.length);
  console.log('\nCompressed structure:');
  result.forEach((msg, i) => {
    console.log(`${i}. ${msg.role}: ${msg.parts[0].text.substring(0, 100)}...`);
  });

  // Verify structure
  console.log('\n✓ System prompt preserved:', result[0].role === 'system' && result[0].parts[0].text === 'You are a helpful assistant.');
  console.log('✓ Summary message added:', result.length > 2 && result[1].role === 'system' && result[1].parts[0].text.includes('summary'));
  console.log('✓ Recent messages preserved:', result[result.length - 1].parts[0].text.includes('How do I install it?'));
  console.log('✓ Older messages removed:', result.length < messages.length);
}

testSummarize().catch(console.error);
