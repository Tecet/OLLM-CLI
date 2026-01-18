/**
 * Visual demonstration of compression showing before/after
 */

import { describe, it, expect } from 'vitest';
import { ChatCompressionService } from '../chatCompressionService.js';
import type { SessionMessage } from '../types.js';

describe('Visual Compression Demonstration', () => {
  it('should show detailed before/after comparison', async () => {
    const service = new ChatCompressionService();

    const messages: SessionMessage[] = [
      {
        role: 'system',
        parts: [{ type: 'text', text: 'You are a helpful coding assistant.' }],
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'What is TypeScript?' }],
        timestamp: '2024-01-01T10:01:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.' }],
        timestamp: '2024-01-01T10:02:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'What are its benefits?' }],
        timestamp: '2024-01-01T10:03:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'TypeScript provides type safety, better IDE support, and catches errors at compile time.' }],
        timestamp: '2024-01-01T10:04:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'How do I install it?' }],
        timestamp: '2024-01-01T10:05:00Z',
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

    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;
    const log = (...args: any[]) => {
      if (!isTestEnv) {
        console.log(...args);
      }
    };

    log('\n' + '='.repeat(80));
    log('BEFORE COMPRESSION');
    log('='.repeat(80));
    
    messages.forEach((msg, i) => {
      const tokens = countMessageTokens(msg);
      const text = msg.parts[0].text;
      log(`\n${i + 1}. [${msg.role.toUpperCase()}] (${tokens} tokens)`);
      log(`   "${text}"`);
    });

    const originalTotal = messages.reduce((sum, msg) => sum + countMessageTokens(msg), 0);
    log(`\n📊 Total: ${messages.length} messages, ${originalTotal} tokens`);

    // Compress
    const result = await service.summarize(messages, 80);

    log('\n' + '='.repeat(80));
    log('AFTER COMPRESSION (target: 80 tokens)');
    log('='.repeat(80));
    
    result.forEach((msg, i) => {
      const tokens = countMessageTokens(msg);
      const text = msg.parts[0].text;
      const isSummary = text.includes('summary');
      const label = isSummary ? '📝 SUMMARY' : msg.role.toUpperCase();
      log(`\n${i + 1}. [${label}] (${tokens} tokens)`);
      log(`   "${text}"`);
    });

    const compressedTotal = result.reduce((sum, msg) => sum + countMessageTokens(msg), 0);
    log(`\n📊 Total: ${result.length} messages, ${compressedTotal} tokens`);
    
    log('\n' + '='.repeat(80));
    log('COMPRESSION RESULTS');
    log('='.repeat(80));
    log(`Messages: ${messages.length} → ${result.length} (${messages.length - result.length} removed)`);
    log(`Tokens: ${originalTotal} → ${compressedTotal} (${originalTotal - compressedTotal} saved)`);
    log(`Compression: ${((1 - compressedTotal / originalTotal) * 100).toFixed(1)}%`);
    log(`Target met: ${compressedTotal <= 80 ? '✅' : '❌'} (${compressedTotal}/${80} tokens)`);
    log('='.repeat(80) + '\n');

    // Assertions
    expect(result.length).toBeLessThan(messages.length);
    expect(compressedTotal).toBeLessThan(originalTotal);
    expect(compressedTotal).toBeLessThanOrEqual(80);
    expect(result[0].parts[0].text).toBe('You are a helpful coding assistant.');
    expect(result[result.length - 1].parts[0].text).toBe('How do I install it?');
  });
});
