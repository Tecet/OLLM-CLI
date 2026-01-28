# Design Document: Testing and Quality Assurance

## Overview

The Testing and Quality Assurance system ensures OLLM CLI's reliability, correctness, and compatibility across different models and environments through comprehensive automated testing. It provides three layers of testing: unit tests for isolated component validation, integration tests for multi-component interactions and real server communication, and UI tests for terminal interface behavior. Additionally, it maintains a compatibility matrix documenting tested models and their capabilities.

The system consists of four core components: Unit Test Suite validates individual functions and components in isolation with high coverage targets, Integration Test Infrastructure enables testing with real LLM servers while gracefully handling server unavailability, UI Test Suite validates terminal rendering and user interactions using ink-testing-library, and Compatibility Matrix documents model behavior across different capabilities. Together, these components provide confidence in system correctness and help identify regressions early.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Testing Infrastructure                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │   Unit Test      │  │    Integration Test              │ │
│  │     Suite        │  │    Infrastructure                │ │
│  │  (Vitest)        │  │  (Server Detection + Fixtures)   │ │
│  └────────┬─────────┘  └────────────┬─────────────────────┘ │
│           │                         │                       │
│           v                         v                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Test Fixtures & Mocks                      ││
│  │     (Mock Providers, Test Data, Helpers)                ││
│  └─────────────────────────────────────────────────────────┘│
│           │                         │                       │
│           v                         v                       │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │    UI Test       │  │    Compatibility Matrix          │ │
│  │     Suite        │  │    (Model Testing Results)       │ │
│  │ (ink-testing)    │  └──────────────────────────────────┘ │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           v
                  ┌────────────────────┐
                  │   Coverage         │
                  │   Reporting        │
                  │   (v8)             │
                  └────────────────────┘
```

### Component Responsibilities

**Unit Test Suite**: Tests individual functions and components in isolation, validates message format conversion and tool schema mapping, tests ReAct parser output extraction, validates token estimation accuracy, tests model routing logic, achieves 80%+ code coverage, and executes quickly (<100ms per test).

**Integration Test Infrastructure**: Detects real LLM server availability, provides test fixtures for common scenarios, skips tests gracefully when server unavailable, tests streaming responses with real servers, validates tool calling end-to-end, tests model management operations, and cleans up test data after execution.

**UI Test Suite**: Tests terminal UI component rendering, validates user interaction handling, tests keyboard navigation and commands, validates tool confirmation flows, tests streaming display updates, and uses ink-testing-library for React component testing.

**Compatibility Matrix**: Documents tested models and their capabilities, tracks pass/fail status for each feature, lists known issues and workarounds, provides model selection recommendations, and is maintained as living documentation.

**Test Fixtures & Mocks**: Provides reusable mock provider adapters, supplies fixture messages for common scenarios, offers fixture tool definitions, provides helper functions for assertions, and enables efficient test writing without duplication.

## Components and Interfaces

### Unit Test Suite

```typescript
// Test organization structure
interface TestSuite {
  describe(name: string, tests: () => void): void;
  it(name: string, test: () => void | Promise<void>): void;
  beforeEach(setup: () => void | Promise<void>): void;
  afterEach(cleanup: () => void | Promise<void>): void;
}

// Provider adapter tests
describe('Provider Adapter', () => {
  describe('Message Format Conversion', () => {
    it('converts user messages to provider format');
    it('converts assistant messages to provider format');
    it('converts tool call messages to provider format');
    it('converts tool result messages to provider format');
  });

  describe('Stream Event Parsing', () => {
    it('parses text delta events correctly');
    it('parses tool call events correctly');
    it('parses completion events correctly');
  });

  describe('Error Handling', () => {
    it('handles network errors gracefully');
    it('handles malformed responses gracefully');
    it('handles timeout errors gracefully');
  });
});

// Tool schema mapping tests
describe('Tool Schema Mapping', () => {
  describe('Schema Validation', () => {
    it('accepts valid tool schemas');
    it('rejects invalid schemas with descriptive errors');
  });

  describe('Parameter Conversion', () => {
    it('converts string parameters correctly');
    it('converts number parameters correctly');
    it('converts boolean parameters correctly');
    it('converts object parameters correctly');
    it('converts array parameters correctly');
  });

  describe('Result Formatting', () => {
    it('formats tool results for the model');
    it('formats tool errors for the model');
  });
});

// ReAct parser tests
describe('ReAct Parser', () => {
  describe('Output Parsing', () => {
    it('parses valid ReAct format correctly');
    it('extracts thought sections correctly');
    it('extracts action sections correctly');
    it('extracts observation sections correctly');
  });

  describe('JSON Extraction', () => {
    it('extracts valid JSON tool calls');
    it('handles malformed JSON gracefully');
  });

  describe('Error Cases', () => {
    it('handles incomplete ReAct format gracefully');
    it('handles missing action sections gracefully');
    it('handles invalid tool names gracefully');
  });
});

// Token estimation tests
describe('Token Estimator', () => {
  describe('Estimation Accuracy', () => {
    it('estimates within 10% of actual counts');
    it('counts different message types correctly');
    it('counts tool calls correctly');
  });

  describe('Limit Enforcement', () => {
    it('rejects messages exceeding context limits');
    it('accepts messages within context limits');
    it('applies correct context window per model');
  });
});

// Model routing tests
describe('Model Router', () => {
  describe('Profile Matching', () => {
    it('selects small fast models for fast profile');
    it('selects balanced models for general profile');
    it('selects code models for code profile');
    it('selects appropriate models for creative profile');
  });

  describe('Fallback Logic', () => {
    it('uses fallback profile when primary has no matches');
    it('returns error when no suitable models exist');
  });

  describe('Capability Matching', () => {
    it('excludes models without required capabilities');
  });
});
```

**Implementation Notes**:

- Use Vitest as test runner with globals enabled
- Co-locate tests with source files using `.test.ts` suffix
- Each test should be independent and isolated
- Use descriptive test names that explain what is being tested
- Mock external dependencies (file system, network, etc.)
- Target <100ms execution time per unit test
- Achieve 80%+ code coverage across all packages
- Use `beforeEach` for test setup, `afterEach` for cleanup

### Integration Test Infrastructure

```typescript
// Server detection
interface ServerDetection {
  isServerAvailable(): Promise<boolean>;
  getServerUrl(): string;
  skipIfNoServer(): () => Promise<boolean>;
}

const SERVER_URL = process.env.OLLM_TEST_SERVER || 'http://localhost:11434';

async function isServerAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

function skipIfNoServer() {
  return async () => {
    if (!(await isServerAvailable())) {
      console.log('⚠️  Skipping: Local LLM server not available');
      return true;
    }
    return false;
  };
}

// Test fixtures
interface TestFixtures {
  createTestMessage(role: 'user' | 'assistant', content: string): Message;
  createTestToolCall(name: string, args: Record<string, any>): ToolCall;
  createTestModel(overrides?: Partial<ModelInfo>): ModelInfo;
  createTestProvider(): ProviderAdapter;
}

const fixtures: TestFixtures = {
  createTestMessage(role, content) {
    return {
      role,
      content,
      timestamp: new Date(),
    };
  },

  createTestToolCall(name, args) {
    return {
      id: `call_${Math.random().toString(36).substr(2, 9)}`,
      name,
      arguments: args,
    };
  },

  createTestModel(overrides = {}) {
    return {
      name: 'test-model:latest',
      family: 'test',
      size: 1e9,
      parameters: 7,
      quantization: 'q4_0',
      contextWindow: 4096,
      maxOutputTokens: 2048,
      modifiedAt: new Date(),
      capabilities: {
        toolCalling: true,
        vision: false,
        streaming: true,
      },
      ...overrides,
    };
  },

  createTestProvider() {
    return new MockProviderAdapter();
  },
};

// Integration test structure
describe('Integration Tests', () => {
  beforeAll(async () => {
    const available = await isServerAvailable();
    if (!available) {
      console.log('⚠️  Integration tests require a running LLM server');
      console.log(`   Set OLLM_TEST_SERVER or start server at ${SERVER_URL}`);
    }
  });

  afterEach(async () => {
    // Clean up test data
  });
});
```

**Implementation Notes**:

- Check server availability before running integration tests
- Skip gracefully with clear message when server unavailable
- Use environment variable `OLLM_TEST_SERVER` for custom server URL
- Clean up any test data or state after each test
- Provide reusable fixtures for common test scenarios
- Integration tests may be slower (up to 30 seconds total)
- Use real server when available, skip when not
- Display clear skip messages explaining why tests were skipped

### Streaming Integration Tests

```typescript
describe('Streaming Tests', () => {
  it('delivers text chunks incrementally', async () => {
    if (await skipIfNoServer()()) return;

    const chunks: string[] = [];
    const stream = await provider.streamChat({
      model: 'llama3.1:8b',
      messages: [{ role: 'user', content: 'Count to 5' }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'text') {
        chunks.push(chunk.content);
      }
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toContain('1');
  });

  it('delivers tool calls as they are generated', async () => {
    if (await skipIfNoServer()()) return;

    const toolCalls: ToolCall[] = [];
    const stream = await provider.streamChat({
      model: 'llama3.1:8b',
      messages: [{ role: 'user', content: 'What is the weather?' }],
      tools: [weatherTool],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'tool_call') {
        toolCalls.push(chunk.toolCall);
      }
    }

    expect(toolCalls.length).toBeGreaterThan(0);
  });

  it('handles errors during streaming gracefully', async () => {
    if (await skipIfNoServer()()) return;

    const stream = await provider.streamChat({
      model: 'nonexistent-model',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    await expect(async () => {
      for await (const chunk of stream) {
        // Should throw error
      }
    }).rejects.toThrow();
  });
});
```

**Implementation Notes**:

- Test incremental delivery of text chunks
- Verify complete response matches concatenated chunks
- Test tool call streaming with real tools
- Validate error handling during streaming
- Ensure partial responses are preserved on errors
- Use real models when server is available

### Tool Call Integration Tests

```typescript
describe('Tool Call Tests', () => {
  it('invokes tool with correct parameters', async () => {
    if (await skipIfNoServer()()) return;

    const toolCalled = vi.fn();
    const tool = {
      name: 'get_weather',
      description: 'Get weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
        required: ['location'],
      },
      execute: toolCalled,
    };

    await chatClient.sendMessage('What is the weather in Seattle?', {
      tools: [tool],
    });

    expect(toolCalled).toHaveBeenCalledWith(expect.objectContaining({ location: 'Seattle' }));
  });

  it('handles multiple tool calls in sequence', async () => {
    if (await skipIfNoServer()()) return;

    const tools = [weatherTool, timeTool];
    const response = await chatClient.sendMessage('What is the weather and time in Seattle?', {
      tools,
    });

    expect(response.toolCalls).toHaveLength(2);
  });

  it('handles tool execution errors gracefully', async () => {
    if (await skipIfNoServer()()) return;

    const failingTool = {
      name: 'failing_tool',
      description: 'A tool that fails',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        throw new Error('Tool execution failed');
      },
    };

    const response = await chatClient.sendMessage('Use the failing tool', {
      tools: [failingTool],
    });

    expect(response.error).toBeDefined();
    expect(response.error).toContain('Tool execution failed');
  });
});
```

**Implementation Notes**:

- Test single tool invocation with parameter validation
- Test multiple tool calls in sequence
- Verify tool results are correctly returned to model
- Test error handling for tool execution failures
- Ensure conversation can continue after tool errors
- Validate tool result formatting for the model

### Model Management Integration Tests

```typescript
describe('Model Management Tests', () => {
  it('lists available models', async () => {
    if (await skipIfNoServer()()) return;

    const models = await modelService.listModels();

    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty('name');
    expect(models[0]).toHaveProperty('size');
  });

  it('emits progress events during download', async () => {
    if (await skipIfNoServer()()) return;

    const progressEvents: ProgressEvent[] = [];

    await modelService.pullModel('phi3:mini', (event) => {
      progressEvents.push(event);
    });

    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[0].percentage).toBe(0);
    expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);
  });

  it('removes models successfully', async () => {
    if (await skipIfNoServer()()) return;

    // First ensure model exists
    await modelService.pullModel('test-model:latest');

    // Then delete it
    await modelService.deleteModel('test-model:latest');

    // Verify it's gone
    const models = await modelService.listModels();
    expect(models.find((m) => m.name === 'test-model:latest')).toBeUndefined();
  });
});
```

**Implementation Notes**:

- Test model listing with real server
- Verify model metadata is correctly parsed
- Test model download with progress tracking
- Test model deletion and list update
- Skip tests gracefully when server unavailable
- Clean up any downloaded test models after tests

### UI Test Suite

```typescript
import { render } from 'ink-testing-library';

describe('UI Component Tests', () => {
  describe('ChatHistory', () => {
    it('renders user messages correctly', () => {
      const messages = [
        { role: 'user', content: 'Hello', timestamp: new Date() }
      ];

      const { lastFrame } = render(<ChatHistory messages={messages} />);

      expect(lastFrame()).toContain('Hello');
      expect(lastFrame()).toContain('user');
    });

    it('renders assistant messages correctly', () => {
      const messages = [
        { role: 'assistant', content: 'Hi there', timestamp: new Date() }
      ];

      const { lastFrame } = render(<ChatHistory messages={messages} />);

      expect(lastFrame()).toContain('Hi there');
      expect(lastFrame()).toContain('assistant');
    });

    it('renders tool calls correctly', () => {
      const messages = [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ name: 'get_weather', arguments: { location: 'Seattle' } }],
          timestamp: new Date()
        }
      ];

      const { lastFrame } = render(<ChatHistory messages={messages} />);

      expect(lastFrame()).toContain('get_weather');
      expect(lastFrame()).toContain('Seattle');
    });
  });

  describe('InputBox', () => {
    it('accepts text input', () => {
      const onSubmit = vi.fn();
      const { stdin, lastFrame } = render(<InputBox onSubmit={onSubmit} />);

      stdin.write('Hello world');

      expect(lastFrame()).toContain('Hello world');
    });

    it('submits on Enter key', () => {
      const onSubmit = vi.fn();
      const { stdin } = render(<InputBox onSubmit={onSubmit} />);

      stdin.write('Hello');
      stdin.write('\r'); // Enter key

      expect(onSubmit).toHaveBeenCalledWith('Hello');
    });
  });

  describe('StatusBar', () => {
    it('displays model information', () => {
      const { lastFrame } = render(
        <StatusBar model="llama3.1:8b" status="ready" />
      );

      expect(lastFrame()).toContain('llama3.1:8b');
      expect(lastFrame()).toContain('ready');
    });
  });

  describe('Tool Confirmation', () => {
    it('displays tool confirmation prompt', () => {
      const toolCall = {
        name: 'read_file',
        arguments: { path: 'test.txt' }
      };

      const { lastFrame } = render(<ToolConfirmation toolCall={toolCall} />);

      expect(lastFrame()).toContain('read_file');
      expect(lastFrame()).toContain('test.txt');
    });

    it('executes tool on approval', () => {
      const onApprove = vi.fn();
      const toolCall = { name: 'read_file', arguments: { path: 'test.txt' } };

      const { stdin } = render(
        <ToolConfirmation toolCall={toolCall} onApprove={onApprove} />
      );

      stdin.write('y'); // Approve

      expect(onApprove).toHaveBeenCalled();
    });

    it('skips tool on rejection', () => {
      const onReject = vi.fn();
      const toolCall = { name: 'read_file', arguments: { path: 'test.txt' } };

      const { stdin } = render(
        <ToolConfirmation toolCall={toolCall} onReject={onReject} />
      );

      stdin.write('n'); // Reject

      expect(onReject).toHaveBeenCalled();
    });
  });

  describe('Streaming Display', () => {
    it('updates progressively as text streams', async () => {
      const { lastFrame, rerender } = render(<StreamingMessage content="" />);

      rerender(<StreamingMessage content="Hello" />);
      expect(lastFrame()).toContain('Hello');

      rerender(<StreamingMessage content="Hello world" />);
      expect(lastFrame()).toContain('Hello world');
    });

    it('displays spinner during operations', () => {
      const { lastFrame } = render(<LoadingSpinner />);

      expect(lastFrame()).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/); // Spinner characters
    });
  });
});
```

**Implementation Notes**:

- Use ink-testing-library for React component testing
- Test component rendering with various props
- Test user interactions (keyboard input, commands)
- Test streaming display updates
- Verify tool confirmation flows
- Test keyboard navigation (arrow keys, Enter, Ctrl+C)
- Ensure UI updates without flickering

### Compatibility Matrix

```typescript
interface CompatibilityTest {
  model: string;
  features: {
    basicChat: TestResult;
    streaming: TestResult;
    nativeToolCalling: TestResult;
    reactFallback: TestResult;
    context4k: TestResult;
    context8k: TestResult;
    context16k: TestResult;
    context32k: TestResult;
    context64k: TestResult;
    context128k: TestResult;
  };
  knownIssues: string[];
  recommendations: string;
}

enum TestResult {
  PASS = '✅ Pass',
  FAIL = '❌ Fail',
  PARTIAL = '⚠️  Partial',
  NOT_TESTED = '⊘ Not Tested',
}

// Test runner for compatibility matrix
async function testModelCompatibility(modelName: string): Promise<CompatibilityTest> {
  const results: CompatibilityTest = {
    model: modelName,
    features: {
      basicChat: await testBasicChat(modelName),
      streaming: await testStreaming(modelName),
      nativeToolCalling: await testNativeToolCalling(modelName),
      reactFallback: await testReActFallback(modelName),
      context4k: await testContextSize(modelName, 4096),
      context8k: await testContextSize(modelName, 8192),
      context16k: await testContextSize(modelName, 16384),
      context32k: await testContextSize(modelName, 32768),
      context64k: await testContextSize(modelName, 65536),
      context128k: await testContextSize(modelName, 131072),
    },
    knownIssues: [],
    recommendations: '',
  };

  return results;
}

// Generate markdown documentation
function generateCompatibilityMatrix(tests: CompatibilityTest[]): string {
  let markdown = '# Model Compatibility Matrix\n\n';
  markdown += `## Test Environment\n`;
  markdown += `- OLLM CLI Version: ${getVersion()}\n`;
  markdown += `- Test Date: ${new Date().toISOString().split('T')[0]}\n`;
  markdown += `- Server: Ollama ${getOllamaVersion()}\n\n`;

  for (const test of tests) {
    markdown += `### ${test.model}\n`;
    markdown += `| Feature | Status | Notes |\n`;
    markdown += `|---------|--------|-------|\n`;

    for (const [feature, result] of Object.entries(test.features)) {
      markdown += `| ${formatFeatureName(feature)} | ${result} | |\n`;
    }

    markdown += `\n`;

    if (test.knownIssues.length > 0) {
      markdown += `**Known Issues:**\n`;
      for (const issue of test.knownIssues) {
        markdown += `- ${issue}\n`;
      }
      markdown += `\n`;
    }

    if (test.recommendations) {
      markdown += `**Recommendations:** ${test.recommendations}\n\n`;
    }
  }

  return markdown;
}
```

**Implementation Notes**:

- Test at least 3 representative models (general, code, small/fast)
- Document pass/fail status for each capability
- List known issues and workarounds
- Provide model selection recommendations
- Update matrix as new models are tested
- Include test environment details (CLI version, server version, date)
- Generate markdown documentation automatically

## Data Models

### Test Configuration

```typescript
interface TestConfig {
  testTimeout: number; // Default: 30000ms
  hookTimeout: number; // Default: 10000ms
  coverage: {
    provider: 'v8';
    reporter: string[]; // ['text', 'json', 'html']
    exclude: string[]; // Paths to exclude
    threshold: number; // Minimum coverage percentage
  };
  integrationTests: {
    serverUrl: string;
    skipWhenUnavailable: boolean;
  };
}

const defaultTestConfig: TestConfig = {
  testTimeout: 30000,
  hookTimeout: 10000,
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/__tests__/**'],
    threshold: 80,
  },
  integrationTests: {
    serverUrl: process.env.OLLM_TEST_SERVER || 'http://localhost:11434',
    skipWhenUnavailable: true,
  },
};
```

### Test Fixtures

```typescript
interface TestMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

interface TestToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

interface TestModelInfo {
  name: string;
  family: string;
  size: number;
  parameters: number;
  quantization: string;
  contextWindow: number;
  maxOutputTokens?: number;
  modifiedAt: Date;
  capabilities: {
    toolCalling: boolean;
    vision: boolean;
    streaming: boolean;
  };
}

interface MockProviderAdapter {
  streamChat(request: ChatRequest): AsyncIterable<StreamChunk>;
  listModels(): Promise<ModelInfo[]>;
  pullModel(name: string, onProgress: (event: ProgressEvent) => void): Promise<void>;
  deleteModel(name: string): Promise<void>;
}
```

### Compatibility Matrix Data

```typescript
interface CompatibilityTest {
  model: string;
  features: Record<string, TestResult>;
  knownIssues: string[];
  recommendations: string;
  testDate: Date;
  cliVersion: string;
  serverVersion: string;
}

enum TestResult {
  PASS = '✅ Pass',
  FAIL = '❌ Fail',
  PARTIAL = '⚠️  Partial',
  NOT_TESTED = '⊘ Not Tested',
}

interface CompatibilityMatrix {
  tests: CompatibilityTest[];
  summary: {
    totalModels: number;
    passRate: number;
    knownIssuesCount: number;
  };
}
```

### Test Execution Results

```typescript
interface TestExecutionResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number; // milliseconds
  coverage: {
    lines: number; // percentage
    functions: number; // percentage
    branches: number; // percentage
    statements: number; // percentage
  };
}

interface TestFailure {
  testName: string;
  testFile: string;
  errorMessage: string;
  stackTrace: string;
  expected: any;
  actual: any;
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Message Format Conversion Completeness

_For any_ message (user, assistant, tool call, or tool result), converting it to provider format should produce a valid provider message with all required fields present and correctly populated.
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Stream Event Parsing Correctness

_For any_ stream event (text delta, tool call, or completion), parsing it should correctly extract all event data without loss of information.
**Validates: Requirements 1.5, 1.6, 1.7**

### Property 3: Valid Tool Schema Acceptance

_For any_ tool schema that conforms to the JSON Schema specification, the schema validator should accept it without errors.
**Validates: Requirements 2.1**

### Property 4: Invalid Tool Schema Rejection

_For any_ tool schema that violates the JSON Schema specification, the schema validator should reject it and return a descriptive error message.
**Validates: Requirements 2.2**

### Property 5: Parameter Type Conversion Preservation

_For any_ parameter value (string, number, object, or array), converting it to the target format should preserve the value and type information.
**Validates: Requirements 2.3, 2.4, 2.6, 2.7**

### Property 6: Tool Result Formatting Consistency

_For any_ tool result or error, formatting it for the model should produce a consistent structure that the model can parse.
**Validates: Requirements 2.8, 2.9**

### Property 7: ReAct Format Parsing Completeness

_For any_ valid ReAct format output, parsing it should correctly extract all sections (thought, action, observation) without loss.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 8: JSON Tool Call Extraction

_For any_ valid JSON tool call embedded in text, the extractor should correctly parse and extract the tool name and arguments.
**Validates: Requirements 3.5**

### Property 9: Token Estimation Accuracy

_For any_ message or message sequence, the estimated token count should be within 10% of the actual token count.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 10: Context Limit Enforcement

_For any_ message that exceeds the model's context window, the system should reject it; for any message within the limit, the system should accept it.
**Validates: Requirements 4.4, 4.5, 4.6**

### Property 11: Profile-Based Model Selection

_For any_ routing profile and list of available models, the router should select a model that matches the profile's requirements (minimum context, required capabilities, preferred families).
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 12: Fallback Profile Usage

_For any_ routing profile with no matching models, if a fallback profile is specified, the router should attempt to use the fallback; if no fallback exists or no models match the fallback, the router should return an error.
**Validates: Requirements 5.5, 5.6**

### Property 13: Capability-Based Filtering

_For any_ routing profile with required capabilities, the router should exclude all models that lack any of the required capabilities.
**Validates: Requirements 5.7**

### Property 14: Integration Test Cleanup

_For any_ integration test execution, after the test completes, no test data or state should remain in the system.
**Validates: Requirements 6.6**

### Property 15: Streaming Chunk Concatenation

_For any_ streamed response, concatenating all text chunks in order should produce the complete response text.
**Validates: Requirements 7.1, 7.2**

### Property 16: Tool Call Streaming Delivery

_For any_ tool call generated during streaming, the tool call should be delivered in the stream before the stream completes.
**Validates: Requirements 7.3, 7.4**

### Property 17: Tool Invocation Parameter Correctness

_For any_ tool call, the tool should be invoked with parameters that match the tool call's arguments.
**Validates: Requirements 8.1**

### Property 18: Tool Result Return

_For any_ tool execution, the result should be correctly returned to the model in the expected format.
**Validates: Requirements 8.2**

### Property 19: Sequential Tool Call Execution

_For any_ sequence of multiple tool calls, each tool should be executed in order and all results should be correctly associated with their respective calls.
**Validates: Requirements 8.3, 8.4**

### Property 20: Tool Error Message Formatting

_For any_ tool execution error, the error message should be formatted correctly for the model and the conversation should be able to continue.
**Validates: Requirements 8.6, 8.7**

### Property 21: Model Metadata Completeness

_For any_ model returned by the list operation, the model info should contain all required fields (name, size, family, modifiedAt, contextWindow, capabilities).
**Validates: Requirements 9.2**

### Property 22: Model Download Progress Events

_For any_ model download operation, progress events should be emitted with increasing percentage values from 0 to 100.
**Validates: Requirements 9.4**

### Property 23: Model List Update After Deletion

_For any_ model deletion operation that completes successfully, the deleted model should no longer appear in subsequent model list queries.
**Validates: Requirements 9.6**

### Property 24: Message Display Completeness

_For any_ message (user, assistant, or tool call), rendering it in ChatHistory should display all essential information (role, content, tool details).
**Validates: Requirements 10.1, 10.2, 10.3**

### Property 25: Input Field Value Display

_For any_ text input to the InputBox, the displayed value should match the current input value.
**Validates: Requirements 10.4, 10.5**

### Property 26: Status Information Display

_For any_ model and status state, the StatusBar should display both the model information and status indicators.
**Validates: Requirements 10.6, 10.7**

### Property 27: Tool Confirmation Behavior

_For any_ tool call requiring confirmation, displaying the confirmation should allow approval (which executes the tool) or rejection (which skips the tool).
**Validates: Requirements 11.7, 11.8, 11.9**

### Property 28: Incremental Text Rendering

_For any_ streaming text, the UI should display text progressively as chunks arrive, with each update adding to the previous content.
**Validates: Requirements 12.1**

### Property 29: Progress Indicator Lifecycle

_For any_ long-running operation, progress indicators (spinners, progress bars) should appear when the operation starts, update during execution, and disappear when the operation completes.
**Validates: Requirements 12.3, 12.4, 12.5**

### Property 30: Unit Test Execution Speed

_For any_ unit test, the execution time should be less than 100 milliseconds.
**Validates: Requirements 15.1**

### Property 31: Test State Isolation

_For any_ test, the test should have independent state that is not affected by other tests running before or after it.
**Validates: Requirements 16.1**

### Property 32: Test Resource Cleanup

_For any_ test that creates resources (files, processes, mocks), all resources should be cleaned up after the test completes.
**Validates: Requirements 16.2, 16.3, 16.4**

### Property 33: Parallel Test Conflict Prevention

_For any_ set of tests running in parallel, no test should interfere with or conflict with any other test.
**Validates: Requirements 16.5**

### Property 34: Test Failure Information Completeness

_For any_ test failure, the error report should include the test name, location, expected value, actual value, stack trace, and relevant context.
**Validates: Requirements 17.1, 17.2, 17.3, 17.4**

### Property 35: Multiple Failure Reporting

_For any_ test run with multiple failures, all failures should be reported, not just the first one.
**Validates: Requirements 17.5**

## Error Handling

### Unit Test Errors

| Error              | Cause                               | Recovery                                                  |
| ------------------ | ----------------------------------- | --------------------------------------------------------- |
| Test Timeout       | Test exceeds time limit             | Increase timeout, optimize test, check for infinite loops |
| Assertion Failure  | Expected value doesn't match actual | Review test logic, check implementation                   |
| Mock Setup Error   | Mock configuration invalid          | Verify mock setup, check mock library usage               |
| Fixture Load Error | Test fixture missing or invalid     | Verify fixture files exist, check fixture format          |
| Dependency Error   | Required dependency not available   | Install dependencies, check imports                       |

### Integration Test Errors

| Error                | Cause                        | Recovery                                        |
| -------------------- | ---------------------------- | ----------------------------------------------- |
| Server Unavailable   | LLM server not running       | Start server, skip tests gracefully             |
| Network Timeout      | Server not responding        | Increase timeout, check network connectivity    |
| Model Not Found      | Required model not installed | Pull model, skip test, use alternative model    |
| Authentication Error | Invalid credentials          | Check API keys, verify server configuration     |
| Rate Limit           | Too many requests            | Add delays between tests, reduce test frequency |

### UI Test Errors

| Error                  | Cause                            | Recovery                                             |
| ---------------------- | -------------------------------- | ---------------------------------------------------- |
| Render Error           | Component fails to render        | Check component props, verify React setup            |
| Input Simulation Error | Keyboard input not recognized    | Verify ink-testing-library setup, check input format |
| Assertion Error        | UI output doesn't match expected | Review component logic, check rendering              |
| Timeout                | Component doesn't update in time | Increase timeout, check async operations             |

### Coverage Errors

| Error                             | Cause                      | Recovery                                             |
| --------------------------------- | -------------------------- | ---------------------------------------------------- |
| Coverage Below Threshold          | Insufficient test coverage | Add tests for uncovered code, review coverage report |
| Coverage Report Generation Failed | v8 coverage tool error     | Check v8 installation, verify configuration          |
| Exclusion Pattern Error           | Invalid glob pattern       | Fix pattern syntax, verify paths                     |

### CI/CD Errors

| Error             | Cause                          | Recovery                                    |
| ----------------- | ------------------------------ | ------------------------------------------- |
| Build Failure     | Tests fail in CI               | Run tests locally, check CI environment     |
| Coverage Failure  | Coverage below threshold in CI | Add tests, verify coverage locally first    |
| Timeout           | Test suite exceeds time limit  | Optimize slow tests, increase CI timeout    |
| Environment Error | CI environment misconfigured   | Check CI configuration, verify dependencies |

## Testing Strategy

### Unit Tests

Unit tests verify specific examples, edge cases, and error conditions for individual components. They should be fast (<100ms each), isolated, and focused on a single unit of functionality.

**Provider Adapter Tests**:

- Test message format conversion for all message types
- Test stream event parsing for all event types
- Test error handling for network errors, malformed responses, timeouts
- Use mock HTTP responses to avoid network dependencies
- Verify all required fields are present in converted messages

**Tool Schema Mapping Tests**:

- Test schema validation accepts valid schemas
- Test schema validation rejects invalid schemas with descriptive errors
- Test parameter conversion for all supported types (string, number, boolean, object, array)
- Test result formatting for successful results and errors
- Use fixture schemas for common tool patterns

**ReAct Parser Tests**:

- Test parsing of valid ReAct format outputs
- Test extraction of thought, action, and observation sections
- Test JSON extraction from action sections
- Test error handling for malformed ReAct format, incomplete sections, invalid JSON
- Use fixture ReAct outputs for common patterns

**Token Estimator Tests**:

- Test estimation accuracy within 10% for various message types
- Test counting of tool calls and tool results
- Test limit enforcement for messages exceeding context window
- Test per-model context window application
- Use fixture messages with known token counts

**Model Router Tests**:

- Test profile matching for fast, general, code, and creative profiles
- Test fallback profile logic when primary profile has no matches
- Test capability-based filtering excludes incompatible models
- Test configuration overrides take precedence
- Use fixture model lists with various capabilities

### Property-Based Tests

Property tests verify universal properties across all inputs using randomized test data. Each test should run a minimum of 100 iterations to ensure comprehensive coverage.

**Test Configuration**:

- Use `fast-check` library for TypeScript property-based testing
- Minimum 100 iterations per property test
- Each test references its design document property number
- Tag format: `Feature: stage-08-testing-qa, Property N: <property text>`

**Key Properties to Test**:

- Property 1: Message conversion (generate random messages, verify conversion completeness)
- Property 2: Event parsing (generate random events, verify parsing correctness)
- Property 5: Parameter conversion (generate random parameters, verify preservation)
- Property 9: Token estimation (generate random messages, verify accuracy within 10%)
- Property 10: Context limits (generate random-sized messages, verify enforcement)
- Property 11: Profile selection (generate random model lists, verify selection matches profile)
- Property 13: Capability filtering (generate random models, verify exclusion logic)
- Property 15: Chunk concatenation (generate random chunks, verify concatenation equals full response)
- Property 30: Test speed (measure all unit tests, verify <100ms)
- Property 31: Test isolation (run tests in random order, verify independence)

**Generators**:

```typescript
// Example generators for property tests
const arbMessage = fc.record({
  role: fc.constantFrom('user', 'assistant', 'system'),
  content: fc.string({ minLength: 1, maxLength: 1000 }),
  timestamp: fc.date(),
});

const arbToolCall = fc.record({
  id: fc.string({ minLength: 5, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  arguments: fc.dictionary(fc.string(), fc.anything()),
});

const arbStreamEvent = fc.oneof(
  fc.record({
    type: fc.constant('text'),
    content: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  fc.record({
    type: fc.constant('tool_call'),
    toolCall: arbToolCall,
  }),
  fc.record({
    type: fc.constant('completion'),
    reason: fc.constantFrom('stop', 'length', 'tool_calls'),
  })
);

const arbModelInfo = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  family: fc.constantFrom('llama', 'mistral', 'codellama', 'phi', 'gemma'),
  size: fc.integer({ min: 1e9, max: 100e9 }),
  parameters: fc.integer({ min: 1, max: 70 }),
  quantization: fc.constantFrom('q4_0', 'q8_0', 'f16'),
  contextWindow: fc.integer({ min: 2048, max: 128000 }),
  modifiedAt: fc.date(),
  capabilities: fc.record({
    toolCalling: fc.boolean(),
    vision: fc.boolean(),
    streaming: fc.boolean(),
  }),
});

const arbRoutingProfile = fc.record({
  name: fc.constantFrom('fast', 'general', 'code', 'creative'),
  preferredFamilies: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
  minContextWindow: fc.integer({ min: 2048, max: 32768 }),
  requiredCapabilities: fc.array(fc.constantFrom('toolCalling', 'vision', 'streaming'), {
    maxLength: 3,
  }),
});
```

### Integration Tests

Integration tests verify interactions between components and with real LLM servers. They should handle server unavailability gracefully and clean up test data.

**Streaming Tests**:

- Test text chunk delivery is incremental
- Test complete response equals concatenated chunks
- Test tool calls are delivered during streaming
- Test tool results are incorporated into stream
- Test error handling during streaming preserves partial responses
- Require real server, skip gracefully when unavailable

**Tool Call Tests**:

- Test single tool invocation with correct parameters
- Test tool results are returned to model
- Test multiple tool calls execute in sequence
- Test tool results are associated with correct calls
- Test tool execution errors are handled gracefully
- Test conversation continues after tool errors
- Require real server, skip gracefully when unavailable

**Model Management Tests**:

- Test list models returns available models with metadata
- Test pull model emits progress events from 0% to 100%
- Test delete model removes model from list
- Test operations work offline with cached data
- Require real server for pull/delete, use cache for list when offline

### UI Tests

UI tests verify terminal interface rendering and user interactions using ink-testing-library.

**Component Rendering Tests**:

- Test ChatHistory displays user, assistant, and tool call messages
- Test InputBox accepts text input and displays current value
- Test StatusBar displays model information and status indicators
- Test ToolConfirmation displays tool details and handles approval/rejection
- Test LoadingSpinner displays during operations

**Interaction Tests**:

- Test arrow keys navigate through history
- Test Enter key submits input
- Test Ctrl+C cancels operations
- Test slash commands (/help, /clear, /model) are recognized
- Test tool confirmation approval executes tools
- Test tool confirmation rejection skips tools

**Streaming Tests**:

- Test text appears progressively as it streams
- Test progress indicators (spinners, progress bars) update during operations
- Test indicators are removed when operations complete

### Compatibility Matrix Testing

Compatibility matrix testing documents model behavior across different capabilities.

**Test Models**:

- General-purpose: llama3.1:8b or llama3.2:3b
- Code-specialized: codellama:7b or deepseek-coder:6.7b
- Small/fast: phi3:mini or gemma:2b

**Test Capabilities**:

- Basic chat: Send simple prompt, verify response
- Streaming: Verify incremental delivery
- Native tool calling: Test with tool-capable models
- ReAct fallback: Test with non-tool-capable models
- Context sizes: Test 4K, 8K, 16K, 32K, 64K, 128K token contexts

**Documentation**:

- Pass/fail status for each capability
- Known issues and workarounds
- Model selection recommendations
- Test environment details (CLI version, server version, date)

### Performance Tests

Performance tests verify system efficiency and responsiveness.

**Test Execution Speed**:

- Unit tests: <100ms per test
- Integration tests: <30 seconds total (when server available)
- UI tests: <10 seconds total
- Full test suite: <2 minutes total

**Coverage Measurement**:

- Measure coverage for all packages
- Fail build if coverage <80%
- Exclude node_modules, dist, test files from coverage
- Generate text, JSON, and HTML reports

### Manual Testing

Manual testing scenarios for user-facing features:

1. Run unit tests locally and verify all pass
2. Run integration tests with server and verify all pass
3. Run integration tests without server and verify graceful skipping
4. Run UI tests and verify rendering is correct
5. Check coverage report and verify >80% coverage
6. Review compatibility matrix and verify documentation is complete
7. Test in CI environment and verify all tests pass
8. Verify test failure messages are clear and helpful
9. Test parallel test execution and verify no conflicts
10. Verify test cleanup leaves no artifacts
