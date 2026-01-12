/**
 * Comparison of all three compression strategies
 */

import { describe, it, expect } from 'vitest';
import { ChatCompressionService } from '../chatCompressionService.js';
import type { SessionMessage } from '../types.js';

describe('Compression Strategy Comparison', () => {
  it('should compare truncate, summarize, and hybrid strategies', async () => {
    const service = new ChatCompressionService();

    const messages: SessionMessage[] = [
      {
        role: 'system',
        parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Message 1: Tell me about JavaScript.' }],
        timestamp: '2024-01-01T10:01:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Response 1: JavaScript is a programming language.' }],
        timestamp: '2024-01-01T10:02:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Message 2: What about TypeScript?' }],
        timestamp: '2024-01-01T10:03:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Response 2: TypeScript adds types to JavaScript.' }],
        timestamp: '2024-01-01T10:04:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Message 3: How do I use it?' }],
        timestamp: '2024-01-01T10:05:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Response 3: Install it with npm install typescript.' }],
        timestamp: '2024-01-01T10:06:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Message 4: What are the benefits?' }],
        timestamp: '2024-01-01T10:07:00Z',
      },
    ];

    const countTokens = (text: string) => Math.ceil(text.length / 4);
    const countMessageTokens = (msg: SessionMessage) => {
      let total = 0;
      for (const part of msg.parts) {
        if (part.type === 'text') {
          total += countTokens(part.text);
        }
      }
      return total + 10;
    };
    const countMessagesTokens = (msgs: SessionMessage[]) =>
      msgs.reduce((sum, msg) => sum + countMessageTokens(msg), 0);

    const originalTokens = countMessagesTokens(messages);

    console.log('\n' + '='.repeat(80));
    console.log('COMPRESSION STRATEGY COMPARISON');
    console.log('='.repeat(80));
    console.log(`\nOriginal: ${messages.length} messages, ${originalTokens} tokens`);
    console.log(`Target: 100 tokens\n`);

    // Test truncate strategy
    const truncateResult = await service.compress(messages, {
      strategy: 'truncate',
      preserveRecentTokens: 100,
      targetTokens: 100,
    });

    console.log('1️⃣  TRUNCATE STRATEGY');
    console.log('   Simply removes oldest messages');
    console.log(`   Result: ${truncateResult.compressedMessages.length} messages, ${truncateResult.compressedTokenCount} tokens`);
    console.log(`   Reduction: ${((1 - truncateResult.compressedTokenCount / truncateResult.originalTokenCount) * 100).toFixed(1)}%`);

    // Test summarize strategy
    const summarizeResult = await service.compress(messages, {
      strategy: 'summarize',
      preserveRecentTokens: 100,
      targetTokens: 100,
    });

    console.log('\n2️⃣  SUMMARIZE STRATEGY');
    console.log('   Replaces old messages with summary');
    console.log(`   Result: ${summarizeResult.compressedMessages.length} messages, ${summarizeResult.compressedTokenCount} tokens`);
    console.log(`   Reduction: ${((1 - summarizeResult.compressedTokenCount / summarizeResult.originalTokenCount) * 100).toFixed(1)}%`);
    const hasSummary = summarizeResult.compressedMessages.some(m => m.parts[0].text.includes('summary'));
    console.log(`   Has summary: ${hasSummary ? '✅' : '❌'}`);

    // Test hybrid strategy
    const hybridResult = await service.compress(messages, {
      strategy: 'hybrid',
      preserveRecentTokens: 100,
      targetTokens: 100,
    });

    console.log('\n3️⃣  HYBRID STRATEGY');
    console.log('   Truncates oldest, summarizes middle, keeps recent');
    console.log(`   Result: ${hybridResult.compressedMessages.length} messages, ${hybridResult.compressedTokenCount} tokens`);
    console.log(`   Reduction: ${((1 - hybridResult.compressedTokenCount / hybridResult.originalTokenCount) * 100).toFixed(1)}%`);

    console.log('\n' + '='.repeat(80));
    console.log('COMPARISON SUMMARY');
    console.log('='.repeat(80));
    console.log(`Truncate:   ${truncateResult.compressedMessages.length} msgs, ${truncateResult.compressedTokenCount} tokens`);
    console.log(`Summarize:  ${summarizeResult.compressedMessages.length} msgs, ${summarizeResult.compressedTokenCount} tokens`);
    console.log(`Hybrid:     ${hybridResult.compressedMessages.length} msgs, ${hybridResult.compressedTokenCount} tokens`);
    console.log('='.repeat(80) + '\n');

    // Verify all strategies work (allow small margin for summary overhead)
    expect(truncateResult.compressedTokenCount).toBeLessThanOrEqual(100);
    expect(summarizeResult.compressedTokenCount).toBeLessThanOrEqual(110); // Allow margin for summary text
    expect(hybridResult.compressedTokenCount).toBeLessThanOrEqual(100);

    // All should reduce token count
    expect(truncateResult.compressedTokenCount).toBeLessThan(originalTokens);
    expect(summarizeResult.compressedTokenCount).toBeLessThan(originalTokens);
    expect(hybridResult.compressedTokenCount).toBeLessThan(originalTokens);

    // All should preserve system prompt
    expect(truncateResult.compressedMessages[0].role).toBe('system');
    expect(summarizeResult.compressedMessages[0].role).toBe('system');
    expect(hybridResult.compressedMessages[0].role).toBe('system');

    // All should preserve most recent message
    const lastOriginal = messages[messages.length - 1].parts[0].text;
    expect(truncateResult.compressedMessages[truncateResult.compressedMessages.length - 1].parts[0].text).toBe(lastOriginal);
    expect(summarizeResult.compressedMessages[summarizeResult.compressedMessages.length - 1].parts[0].text).toBe(lastOriginal);
    expect(hybridResult.compressedMessages[hybridResult.compressedMessages.length - 1].parts[0].text).toBe(lastOriginal);
  });
});
