/**
 * Demonstration of compression reducing context size
 * This shows how the summarize strategy compresses a conversation
 */

import { ChatCompressionService } from './packages/core/dist/services/chatCompressionService.js';

// Helper to count tokens (same as the service uses)
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

function countMessageTokens(message) {
  let total = 0;
  for (const part of message.parts) {
    if (part.type === 'text') {
      total += countTokens(part.text);
    }
  }
  total += 10; // overhead
  return total;
}

function countMessagesTokens(messages) {
  return messages.reduce((sum, msg) => sum + countMessageTokens(msg), 0);
}

async function demonstrateCompression() {
  console.log('='.repeat(80));
  console.log('COMPRESSION DEMONSTRATION');
  console.log('='.repeat(80));
  console.log();

  const service = new ChatCompressionService();

  // Create a realistic conversation with multiple exchanges
  const messages = [
    {
      role: 'system',
      parts: [
        {
          type: 'text',
          text: 'You are a helpful coding assistant specialized in TypeScript and Node.js development.',
        },
      ],
      timestamp: '2024-01-01T10:00:00Z',
    },
    {
      role: 'user',
      parts: [
        { type: 'text', text: 'Can you explain what TypeScript is and why I should use it?' },
      ],
      timestamp: '2024-01-01T10:01:00Z',
    },
    {
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'TypeScript is a strongly typed programming language that builds on JavaScript. It adds optional static typing, which helps catch errors during development rather than at runtime. You should use TypeScript because it provides better IDE support with autocomplete and refactoring tools, makes your code more maintainable, and helps prevent common bugs.',
        },
      ],
      timestamp: '2024-01-01T10:02:00Z',
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'What are interfaces in TypeScript?' }],
      timestamp: '2024-01-01T10:03:00Z',
    },
    {
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: "Interfaces in TypeScript are a way to define the structure of an object. They specify what properties an object should have and what types those properties should be. Interfaces are purely a compile-time construct and don't exist in the generated JavaScript code. They help ensure type safety and make your code more self-documenting.",
        },
      ],
      timestamp: '2024-01-01T10:04:00Z',
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'How do I define a generic function in TypeScript?' }],
      timestamp: '2024-01-01T10:05:00Z',
    },
    {
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'Generic functions in TypeScript allow you to write flexible, reusable code that works with multiple types. You define them using angle brackets with a type parameter. For example: function identity<T>(arg: T): T { return arg; }. The T is a type variable that will be replaced with the actual type when the function is called.',
        },
      ],
      timestamp: '2024-01-01T10:06:00Z',
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: "What's the difference between type and interface?" }],
      timestamp: '2024-01-01T10:07:00Z',
    },
    {
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'Both type and interface can be used to define object shapes, but they have some differences. Interfaces can be extended and merged, while types are more flexible and can represent unions, intersections, and primitives. In practice, use interfaces for object shapes that might be extended, and types for unions, intersections, or when you need more complex type operations.',
        },
      ],
      timestamp: '2024-01-01T10:08:00Z',
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'Can you show me how to use async/await in TypeScript?' }],
      timestamp: '2024-01-01T10:09:00Z',
    },
    {
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'Async/await in TypeScript works the same as in JavaScript. You mark a function as async, and then you can use await inside it to wait for promises. The return type of an async function is automatically wrapped in a Promise. For example: async function fetchData(): Promise<string> { const response = await fetch(url); return await response.text(); }',
        },
      ],
      timestamp: '2024-01-01T10:10:00Z',
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'How do I handle errors with try-catch in async functions?' }],
      timestamp: '2024-01-01T10:11:00Z',
    },
  ];

  const originalTokenCount = countMessagesTokens(messages);

  console.log('📊 ORIGINAL CONVERSATION');
  console.log('-'.repeat(80));
  console.log(`Total messages: ${messages.length}`);
  console.log(`Total tokens: ${originalTokenCount}`);
  console.log();

  messages.forEach((msg, i) => {
    const tokens = countMessageTokens(msg);
    const preview = msg.parts[0].text.substring(0, 60);
    console.log(
      `${i}. [${msg.role.padEnd(9)}] ${tokens.toString().padStart(4)} tokens | ${preview}...`
    );
  });

  console.log();
  console.log('='.repeat(80));
  console.log('APPLYING COMPRESSION (target: 150 tokens)');
  console.log('='.repeat(80));
  console.log();

  // Apply compression with a target that forces summarization
  const targetTokens = 150;
  const result = await service.summarize(messages, targetTokens);
  const compressedTokenCount = countMessagesTokens(result);

  console.log('📊 COMPRESSED CONVERSATION');
  console.log('-'.repeat(80));
  console.log(`Total messages: ${result.length} (reduced from ${messages.length})`);
  console.log(`Total tokens: ${compressedTokenCount} (reduced from ${originalTokenCount})`);
  console.log(
    `Compression ratio: ${((1 - compressedTokenCount / originalTokenCount) * 100).toFixed(1)}%`
  );
  console.log(
    `Target met: ${compressedTokenCount <= targetTokens ? '✅ YES' : '❌ NO'} (target: ${targetTokens})`
  );
  console.log();

  result.forEach((msg, i) => {
    const tokens = countMessageTokens(msg);
    const preview = msg.parts[0].text.substring(0, 60);
    const isSummary = msg.parts[0].text.includes('summary');
    const marker = isSummary ? '📝 [SUMMARY]' : '';
    console.log(
      `${i}. [${msg.role.padEnd(9)}] ${tokens.toString().padStart(4)} tokens | ${preview}... ${marker}`
    );
  });

  console.log();
  console.log('='.repeat(80));
  console.log('VERIFICATION');
  console.log('='.repeat(80));
  console.log();

  // Verify compression properties
  const checks = [
    {
      name: 'System prompt preserved',
      pass: result[0].role === 'system' && result[0].parts[0].text === messages[0].parts[0].text,
    },
    {
      name: 'Message count reduced',
      pass: result.length < messages.length,
    },
    {
      name: 'Token count reduced',
      pass: compressedTokenCount < originalTokenCount,
    },
    {
      name: 'Summary message created',
      pass: result.some((m) => m.parts[0].text.includes('summary')),
    },
    {
      name: 'Recent message preserved',
      pass: result[result.length - 1].parts[0].text === messages[messages.length - 1].parts[0].text,
    },
    {
      name: 'Under target token count',
      pass: compressedTokenCount <= targetTokens,
    },
  ];

  checks.forEach((check) => {
    const status = check.pass ? '✅' : '❌';
    console.log(`${status} ${check.name}`);
  });

  console.log();
  console.log('='.repeat(80));

  const allPassed = checks.every((c) => c.pass);
  if (allPassed) {
    console.log('✅ ALL CHECKS PASSED - Compression is working correctly!');
  } else {
    console.log('❌ SOME CHECKS FAILED - Review the results above');
  }
  console.log('='.repeat(80));
}

demonstrateCompression().catch(console.error);
