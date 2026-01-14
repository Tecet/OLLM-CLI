/**
 * Test fixtures for common test scenarios.
 */

import type { ModelInfo, Message, MessagePart, ToolSchema, ToolCall } from '@ollm/core';

/**
 * Test message fixture (legacy format for backward compatibility).
 */
export interface TestMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: TestToolCall[];
}

/**
 * Test tool call fixture (legacy format for backward compatibility).
 */
export interface TestToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Create a test message (legacy format).
 */
export function createTestMessage(
  role: 'user' | 'assistant' | 'system',
  content: string
): TestMessage {
  return {
    role,
    content,
    timestamp: new Date(),
  };
}

/**
 * Create a core Message (new format matching provider types).
 */
export function createCoreMessage(
  role: 'user' | 'assistant' | 'system' | 'tool',
  content: string,
  options?: { name?: string; toolCalls?: ToolCall[] }
): Message {
  const parts: MessagePart[] = [{ type: 'text', text: content }];
  
  return {
    role,
    parts,
    ...(options?.name && { name: options.name }),
  };
}

/**
 * Create a message with image content.
 */
export function createImageMessage(
  role: 'user' | 'assistant',
  text: string,
  imageData: string,
  mimeType: string = 'image/png'
): Message {
  return {
    role,
    parts: [
      { type: 'text', text },
      { type: 'image', data: imageData, mimeType },
    ],
  };
}

/**
 * Create a tool result message.
 */
export function createToolResultMessage(
  toolName: string,
  result: string
): Message {
  return {
    role: 'tool',
    parts: [{ type: 'text', text: result }],
    name: toolName,
  };
}

/**
 * Create a test tool call (legacy format).
 */
export function createTestToolCall(
  name: string,
  args: Record<string, unknown>
): TestToolCall {
  return {
    id: `call_${Math.random().toString(36).substr(2, 9)}`,
    name,
    arguments: args,
  };
}

/**
 * Create a core ToolCall (new format matching provider types).
 */
export function createCoreToolCall(
  name: string,
  args: Record<string, unknown>,
  id?: string
): ToolCall {
  return {
    id: id ?? `call_${Math.random().toString(36).substr(2, 9)}`,
    name,
    args,
  };
}

/**
 * Create a test model info.
 */
export function createTestModel(overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    name: 'test-model:latest',
    sizeBytes: 1e9,
    modifiedAt: new Date().toISOString(),
    details: {
      family: 'test',
      parameterSize: '7B',
      quantizationLevel: 'q4_0',
    },
    ...overrides,
  };
}

/**
 * Fixture messages for common scenarios.
 */
export const fixtureMessages = {
  simpleUser: createTestMessage('user', 'Hello, how are you?'),
  simpleAssistant: createTestMessage('assistant', 'I am doing well, thank you!'),
  systemPrompt: createTestMessage('system', 'You are a helpful assistant.'),
  longMessage: createTestMessage(
    'user',
    'This is a very long message that contains a lot of text. '.repeat(50)
  ),
  emptyMessage: createTestMessage('user', ''),
  codeRequest: createTestMessage('user', 'Write a function to calculate fibonacci numbers'),
  toolCallMessage: {
    ...createTestMessage('assistant', ''),
    toolCalls: [createTestToolCall('get_weather', { location: 'Seattle' })],
  },
};

/**
 * Fixture tool definitions.
 */
export const fixtureTools = {
  weatherTool: {
    name: 'get_weather',
    description: 'Get weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
        units: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'Temperature units',
        },
      },
      required: ['location'],
    },
  },
  calculatorTool: {
    name: 'calculate',
    description: 'Perform a calculation',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression to evaluate' },
      },
      required: ['expression'],
    },
  },
  fileReadTool: {
    name: 'read_file',
    description: 'Read a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
  },
};

/**
 * Fixture model information.
 */
export const fixtureModels = {
  generalModel: createTestModel({
    name: 'llama3.1:8b',
    sizeBytes: 8e9,
    details: {
      family: 'llama',
      parameterSize: '8B',
      quantizationLevel: 'q4_0',
    },
  }),
  codeModel: createTestModel({
    name: 'codellama:7b',
    sizeBytes: 7e9,
    details: {
      family: 'codellama',
      parameterSize: '7B',
      quantizationLevel: 'q4_0',
    },
  }),
  smallModel: createTestModel({
    name: 'phi3:mini',
    sizeBytes: 2e9,
    details: {
      family: 'phi',
      parameterSize: '3B',
      quantizationLevel: 'q4_0',
    },
  }),
  largeModel: createTestModel({
    name: 'llama3.1:70b',
    sizeBytes: 70e9,
    details: {
      family: 'llama',
      parameterSize: '70B',
      quantizationLevel: 'q4_0',
    },
  }),
};

/**
 * Fixture stream events.
 */
export const fixtureStreamEvents = {
  textChunk: { type: 'text' as const, value: 'Hello' },
  toolCall: {
    type: 'tool_call' as const,
    value: createTestToolCall('get_weather', { location: 'Seattle' }),
  },
  finish: { type: 'finish' as const, reason: 'stop' as const },
  error: {
    type: 'error' as const,
    error: { message: 'Test error', code: 'TEST_ERROR' },
  },
};

/**
 * Helper to create a sequence of text chunks.
 */
export function createTextChunkSequence(text: string, chunkSize: number = 5) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push({
      type: 'text' as const,
      value: text.slice(i, i + chunkSize),
    });
  }
  chunks.push({ type: 'finish' as const, reason: 'stop' as const });
  return chunks;
}

/**
 * Helper to create a tool call sequence.
 */
export function createToolCallSequence(
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>
) {
  return [
    { type: 'text' as const, value: 'Calling tools...' },
    ...toolCalls.map((tc) => ({
      type: 'tool_call' as const,
      value: createCoreToolCall(tc.name, tc.args),
    })),
    { type: 'finish' as const, reason: 'tool' as const },
  ];
}

/**
 * Additional fixture messages for comprehensive testing.
 */
export const extendedFixtureMessages = {
  // Multi-part messages
  multiPartUser: {
    role: 'user' as const,
    parts: [
      { type: 'text' as const, text: 'What is in this image?' },
      { type: 'image' as const, data: 'base64data', mimeType: 'image/png' },
    ],
  },
  
  // Tool result message
  toolResult: createToolResultMessage('get_weather', 'Temperature: 72°F, Sunny'),
  
  // Empty content messages
  emptyUser: createCoreMessage('user', ''),
  emptyAssistant: createCoreMessage('assistant', ''),
  
  // Messages with special characters
  specialCharsUser: createCoreMessage('user', 'Test with "quotes" and \'apostrophes\' and <tags>'),
  unicodeUser: createCoreMessage('user', 'Unicode: 你好 🌍 émojis'),
  
  // Very long message
  veryLongUser: createCoreMessage('user', 'x'.repeat(10000)),
  
  // Code-related messages
  codeSnippet: createCoreMessage('user', 'Here is code:\n```python\ndef hello():\n    print("world")\n```'),
  
  // Multi-line messages
  multiLine: createCoreMessage('user', 'Line 1\nLine 2\nLine 3\nLine 4'),
};

/**
 * Additional fixture tool definitions for comprehensive testing.
 */
export const extendedFixtureTools: Record<string, ToolSchema> = {
  // Tool with no parameters
  noParamsTool: {
    name: 'get_time',
    description: 'Get current time',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  
  // Tool with optional parameters
  optionalParamsTool: {
    name: 'search',
    description: 'Search for information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results' },
      },
      required: ['query'],
    },
  },
  
  // Tool with complex nested parameters
  complexTool: {
    name: 'create_task',
    description: 'Create a task',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        tags: { type: 'array', items: { type: 'string' } },
        metadata: {
          type: 'object',
          properties: {
            assignee: { type: 'string' },
            dueDate: { type: 'string' },
          },
        },
      },
      required: ['title'],
    },
  },
  
  // Tool with array parameters
  arrayTool: {
    name: 'batch_process',
    description: 'Process multiple items',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['items'],
    },
  },
  
  // Tool with boolean parameters
  booleanTool: {
    name: 'toggle_feature',
    description: 'Toggle a feature',
    parameters: {
      type: 'object',
      properties: {
        feature: { type: 'string' },
        enabled: { type: 'boolean' },
      },
      required: ['feature', 'enabled'],
    },
  },
};

/**
 * Additional fixture models for comprehensive testing.
 */
export const extendedFixtureModels = {
  // Vision-capable model
  visionModel: createTestModel({
    name: 'llava:7b',
    sizeBytes: 7e9,
    details: {
      family: 'llava',
      parameterSize: '7B',
      quantizationLevel: 'q4_0',
      capabilities: {
        vision: true,
        toolCalling: false,
      },
    },
  }),
  
  // Tool-calling capable model
  toolModel: createTestModel({
    name: 'llama3.1:8b',
    sizeBytes: 8e9,
    details: {
      family: 'llama',
      parameterSize: '8B',
      quantizationLevel: 'q4_0',
      capabilities: {
        vision: false,
        toolCalling: true,
      },
    },
  }),
  
  // Model with large context window
  largeContextModel: createTestModel({
    name: 'llama3.1:70b',
    sizeBytes: 70e9,
    details: {
      family: 'llama',
      parameterSize: '70B',
      quantizationLevel: 'q4_0',
      contextWindow: 128000,
    },
  }),
  
  // Model with small context window
  smallContextModel: createTestModel({
    name: 'phi3:mini',
    sizeBytes: 2e9,
    details: {
      family: 'phi',
      parameterSize: '3B',
      quantizationLevel: 'q4_0',
      contextWindow: 4096,
    },
  }),
  
  // Quantized models
  q8Model: createTestModel({
    name: 'llama3.1:8b-q8',
    sizeBytes: 8.5e9,
    details: {
      family: 'llama',
      parameterSize: '8B',
      quantizationLevel: 'q8_0',
    },
  }),
  
  f16Model: createTestModel({
    name: 'llama3.1:8b-f16',
    sizeBytes: 16e9,
    details: {
      family: 'llama',
      parameterSize: '8B',
      quantizationLevel: 'f16',
    },
  }),
};

/**
 * Helper functions for test data generation.
 */

/**
 * Generate a random string of specified length.
 */
export function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a random message with specified role and content length.
 */
export function generateRandomMessage(
  role: 'user' | 'assistant' | 'system' = 'user',
  contentLength: number = 100
): Message {
  return createCoreMessage(role, generateRandomString(contentLength));
}

/**
 * Generate a sequence of random messages.
 */
export function generateMessageSequence(count: number): Message[] {
  const messages: Message[] = [];
  for (let i = 0; i < count; i++) {
    const role = i % 2 === 0 ? 'user' : 'assistant';
    messages.push(generateRandomMessage(role as 'user' | 'assistant', 50 + Math.random() * 200));
  }
  return messages;
}

/**
 * Generate a random tool call.
 */
export function generateRandomToolCall(): ToolCall {
  const tools = ['get_weather', 'calculate', 'read_file', 'search', 'get_time'];
  const tool = tools[Math.floor(Math.random() * tools.length)];
  
  return createCoreToolCall(tool, {
    param1: generateRandomString(10),
    param2: Math.floor(Math.random() * 100),
  });
}

/**
 * Generate a random model info.
 */
export function generateRandomModel(): ModelInfo {
  const families = ['llama', 'mistral', 'codellama', 'phi', 'gemma'];
  const sizes = ['3B', '7B', '13B', '34B', '70B'];
  const quantizations = ['q4_0', 'q8_0', 'f16'];
  
  const family = families[Math.floor(Math.random() * families.length)];
  const size = sizes[Math.floor(Math.random() * sizes.length)];
  const quant = quantizations[Math.floor(Math.random() * quantizations.length)];
  
  return createTestModel({
    name: `${family}:${size.toLowerCase()}-${quant}`,
    sizeBytes: Math.floor(Math.random() * 50e9) + 1e9,
    details: {
      family,
      parameterSize: size,
      quantizationLevel: quant,
    },
  });
}

/**
 * Helper functions for assertions.
 */

/**
 * Assert that a message has all required fields.
 */
export function assertValidMessage(message: Message): void {
  if (!message.role) {
    throw new Error('Message missing role');
  }
  if (!message.parts || message.parts.length === 0) {
    throw new Error('Message missing parts');
  }
  if (message.role === 'tool' && !message.name) {
    throw new Error('Tool message missing name');
  }
}

/**
 * Assert that a tool call has all required fields.
 */
export function assertValidToolCall(toolCall: ToolCall): void {
  if (!toolCall.id) {
    throw new Error('ToolCall missing id');
  }
  if (!toolCall.name) {
    throw new Error('ToolCall missing name');
  }
  if (!toolCall.args || typeof toolCall.args !== 'object') {
    throw new Error('ToolCall missing or invalid args');
  }
}

/**
 * Assert that a model info has all required fields.
 */
export function assertValidModelInfo(model: ModelInfo): void {
  if (!model.name) {
    throw new Error('ModelInfo missing name');
  }
  // sizeBytes, modifiedAt, and details are optional
}

/**
 * Assert that a tool schema is valid.
 */
export function assertValidToolSchema(schema: ToolSchema): void {
  if (!schema.name) {
    throw new Error('ToolSchema missing name');
  }
  // description and parameters are optional
  if (schema.parameters && typeof schema.parameters !== 'object') {
    throw new Error('ToolSchema parameters must be an object');
  }
}

/**
 * Compare two messages for equality (ignoring timestamps).
 */
export function messagesEqual(a: Message, b: Message): boolean {
  if (a.role !== b.role) return false;
  if (a.name !== b.name) return false;
  if (a.parts.length !== b.parts.length) return false;
  
  for (let i = 0; i < a.parts.length; i++) {
    const partA = a.parts[i];
    const partB = b.parts[i];
    
    if (partA.type !== partB.type) return false;
    
    if (partA.type === 'text' && partB.type === 'text') {
      if (partA.text !== partB.text) return false;
    } else if (partA.type === 'image' && partB.type === 'image') {
      if (partA.data !== partB.data || partA.mimeType !== partB.mimeType) return false;
    }
  }
  
  return true;
}

/**
 * Compare two tool calls for equality.
 */
export function toolCallsEqual(a: ToolCall, b: ToolCall): boolean {
  if (a.id !== b.id) return false;
  if (a.name !== b.name) return false;
  return JSON.stringify(a.args) === JSON.stringify(b.args);
}
