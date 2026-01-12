/**
 * Demonstration test showing compression actually reduces context size
 */

import { describe, it, expect } from 'vitest';
import { ChatCompressionService } from '../chatCompressionService.js';
import type { SessionMessage } from '../types.js';

describe('Compression Demonstration', () => {
  it('should demonstrate that compression reduces context size', async () => {
    const service = new ChatCompressionService();

    // Create a realistic conversation with multiple exchanges
    const messages: SessionMessage[] = [
      {
        role: 'system',
        parts: [{ type: 'text', text: 'You are a helpful coding assistant specialized in TypeScript and Node.js development.' }],
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Can you explain what TypeScript is and why I should use it?' }],
        timestamp: '2024-01-01T10:01:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'TypeScript is a strongly typed programming language that builds on JavaScript. It adds optional static typing, which helps catch errors during development rather than at runtime. You should use TypeScript because it provides better IDE support with autocomplete and refactoring tools, makes your code more maintainable, and helps prevent common bugs.' }],
        timestamp: '2024-01-01T10:02:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'What are interfaces in TypeScript?' }],
        timestamp: '2024-01-01T10:03:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Interfaces in TypeScript are a way to define the structure of an object. They specify what properties an object should have and what types those properties should be. Interfaces are purely a compile-time construct and don\'t exist in the generated JavaScript code. They help ensure type safety and make your code more self-documenting.' }],
        timestamp: '2024-01-01T10:04:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'How do I define a generic function in TypeScript?' }],
        timestamp: '2024-01-01T10:05:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Generic functions in TypeScript allow you to write flexible, reusable code that works with multiple types. You define them using angle brackets with a type parameter. For example: function identity<T>(arg: T): T { return arg; }. The T is a type variable that will be replaced with the actual type when the function is called.' }],
        timestamp: '2024-01-01T10:06:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'What\'s the difference between type and interface?' }],
        timestamp: '2024-01-01T10:07:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Both type and interface can be used to define object shapes, but they have some differences. Interfaces can be extended and merged, while types are more flexible and can represent unions, intersections, and primitives. In practice, use interfaces for object shapes that might be extended, and types for unions, intersections, or when you need more complex type operations.' }],
        timestamp: '2024-01-01T10:08:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Can you show me how to use async/await in TypeScript?' }],
        timestamp: '2024-01-01T10:09:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Async/await in TypeScript works the same as in JavaScript. You mark a function as async, and then you can use await inside it to wait for promises. The return type of an async function is automatically wrapped in a Promise. For example: async function fetchData(): Promise<string> { const response = await fetch(url); return await response.text(); }' }],
        timestamp: '2024-01-01T10:10:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'How do I handle errors with try-catch in async functions?' }],
        timestamp: '2024-01-01T10:11:00Z',
      },
    ];

    // Helper to count tokens
    const countTokens = (text: string) => Math.ceil(text.length / 4);
    const countMessageTokens = (msg: SessionMessage) => {
      let total = 0;
      for (const part of msg.parts) {
        if (part.type === 'text') {
          total += countTokens(part.text);
        }
      }
      return total + 10; // overhead
    };
    const countMessagesTokens = (msgs: SessionMessage[]) =>
      msgs.reduce((sum, msg) => sum + countMessageTokens(msg), 0);

    const originalTokenCount = countMessagesTokens(messages);
    
    console.log('\n📊 ORIGINAL CONVERSATION');
    console.log(`Total messages: ${messages.length}`);
    console.log(`Total tokens: ${originalTokenCount}`);

    // Apply compression with a target that forces summarization
    const targetTokens = 150;
    const result = await service.summarize(messages, targetTokens);
    const compressedTokenCount = countMessagesTokens(result);
    
    console.log('\n📊 COMPRESSED CONVERSATION');
    console.log(`Total messages: ${result.length} (reduced from ${messages.length})`);
    console.log(`Total tokens: ${compressedTokenCount} (reduced from ${originalTokenCount})`);
    console.log(`Compression ratio: ${((1 - compressedTokenCount / originalTokenCount) * 100).toFixed(1)}%`);
    console.log(`Target met: ${compressedTokenCount <= targetTokens ? '✅ YES' : '❌ NO'} (target: ${targetTokens})\n`);

    // Verify compression properties
    expect(result.length).toBeLessThan(messages.length);
    expect(compressedTokenCount).toBeLessThan(originalTokenCount);
    expect(compressedTokenCount).toBeLessThanOrEqual(targetTokens);
    
    // System prompt preserved
    expect(result[0].role).toBe('system');
    expect(result[0].parts[0].text).toBe(messages[0].parts[0].text);
    
    // Summary message created
    const hasSummary = result.some(m => m.parts[0].text.includes('summary'));
    expect(hasSummary).toBe(true);
    
    // Recent message preserved
    expect(result[result.length - 1].parts[0].text).toBe(messages[messages.length - 1].parts[0].text);
    
    console.log('✅ All compression checks passed!');
  });

  it('should demonstrate compression with the compress() method', async () => {
    const service = new ChatCompressionService();

    const messages: SessionMessage[] = [
      {
        role: 'system',
        parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Tell me about JavaScript.' }],
        timestamp: '2024-01-01T10:01:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'JavaScript is a high-level, interpreted programming language that is one of the core technologies of the World Wide Web. It enables interactive web pages and is an essential part of web applications.' }],
        timestamp: '2024-01-01T10:02:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'What about Node.js?' }],
        timestamp: '2024-01-01T10:03:00Z',
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Node.js is a JavaScript runtime built on Chrome\'s V8 JavaScript engine. It allows you to run JavaScript on the server side, enabling full-stack JavaScript development.' }],
        timestamp: '2024-01-01T10:04:00Z',
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'How do I install it?' }],
        timestamp: '2024-01-01T10:05:00Z',
      },
    ];

    console.log('\n📊 Testing compress() method with summarize strategy');
    
    const result = await service.compress(messages, {
      strategy: 'summarize',
      preserveRecentTokens: 100,
      targetTokens: 100,
    });

    console.log(`Original: ${result.originalTokenCount} tokens, ${messages.length} messages`);
    console.log(`Compressed: ${result.compressedTokenCount} tokens, ${result.compressedMessages.length} messages`);
    console.log(`Strategy: ${result.strategy}`);
    console.log(`Reduction: ${((1 - result.compressedTokenCount / result.originalTokenCount) * 100).toFixed(1)}%\n`);

    // Verify the result
    expect(result.compressedTokenCount).toBeLessThan(result.originalTokenCount);
    expect(result.compressedMessages.length).toBeLessThan(messages.length);
    expect(result.strategy).toBe('summarize');
    
    console.log('✅ compress() method works correctly!');
  });
});
