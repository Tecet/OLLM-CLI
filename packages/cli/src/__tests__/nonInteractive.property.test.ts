/**
 * Property-based tests for non-interactive runner
 * Feature: stage-06-cli-ui
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { NonInteractiveRunner, NonInteractiveError, NonInteractiveErrorCode } from '../nonInteractive.js';
import type { Config } from '../config/types.js';

// Mock the core modules
vi.mock('@ollm/core', () => ({
  ProviderRegistry: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    setDefault: vi.fn(),
  })),
  ChatClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockImplementation(async function* () {
      yield { type: 'text', value: 'Test response' };
      yield { type: 'finish', reason: 'complete' };
    }),
  })),
  ToolRegistry: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@ollm/ollm-bridge', () => ({
  LocalProvider: vi.fn().mockImplementation(() => ({
    name: 'local',
  })),
}));

describe('Non-Interactive Runner - Property Tests', () => {
  let runner: NonInteractiveRunner;
  let mockConfig: Config;

  beforeEach(() => {
    runner = new NonInteractiveRunner();
    mockConfig = {
      provider: {
        default: 'ollama',
        ollama: {
          host: 'http://localhost:11434',
          timeout: 30000,
        },
      },
      model: {
        default: 'llama3.2:3b',
        temperature: 0.7,
        maxTokens: 4096,
      },
      ui: {
        layout: 'hybrid',
        sidePanel: true,
        showGpuStats: true,
        showCost: true,
        metrics: {
          enabled: true,
          compactMode: false,
          showPromptTokens: true,
          showTTFT: true,
          showInStatusBar: true,
        },
        reasoning: {
          enabled: true,
          maxVisibleLines: 8,
          autoCollapseOnComplete: true,
        },
      },
      status: {
        pollInterval: 5000,
        highTempThreshold: 80,
        lowVramThreshold: 512,
      },
      review: {
        enabled: true,
        inlineThreshold: 5,
      },
      session: {
        autoSave: true,
        saveInterval: 60000,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 6: Non-Interactive Mode Selection
   * For any CLI invocation with a prompt, the CLI should execute in non-interactive mode
   * and exit after completion.
   * 
   * Feature: stage-06-cli-ui, Property 6: Non-Interactive Mode Selection
   * Validates: Requirements 3.1, 3.2
   */
  it('Property 6: should execute in non-interactive mode for any prompt', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }), // Random prompts
        async (prompt) => {
          const result = await runner.run({
            prompt,
            output: 'text',
            config: mockConfig,
          });

          // Verify result structure
          expect(result).toHaveProperty('response');
          expect(result).toHaveProperty('metadata');
          expect(result.metadata).toHaveProperty('model');
          expect(result.metadata).toHaveProperty('provider');
          expect(result.metadata).toHaveProperty('duration');
          
          // Verify response is a string
          expect(typeof result.response).toBe('string');
          
          // Verify duration is a positive number
          expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Output Format Compliance
   * For any non-interactive execution with --output json, the output should be valid JSON
   * with required fields (response and metadata).
   * 
   * Feature: stage-06-cli-ui, Property 7: Output Format Compliance
   * Validates: Requirements 3.4
   */
  it('Property 7: should produce valid JSON output with required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }), // Random prompts
        async (prompt) => {
          const result = await runner.run({
            prompt,
            output: 'json',
            config: mockConfig,
          });

          // Format as JSON
          const jsonOutput = runner.formatOutput(result, 'json');
          
          // Verify it's valid JSON
          expect(() => JSON.parse(jsonOutput)).not.toThrow();
          
          const parsed = JSON.parse(jsonOutput);
          
          // Verify required fields
          expect(parsed).toHaveProperty('response');
          expect(parsed).toHaveProperty('metadata');
          expect(parsed.metadata).toHaveProperty('model');
          expect(parsed.metadata).toHaveProperty('provider');
          expect(parsed.metadata).toHaveProperty('duration');
          
          // Verify types
          expect(typeof parsed.response).toBe('string');
          expect(typeof parsed.metadata.model).toBe('string');
          expect(typeof parsed.metadata.provider).toBe('string');
          expect(typeof parsed.metadata.duration).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: NDJSON Stream Format
   * For any non-interactive execution with --output stream-json, each line of output
   * should be valid JSON.
   * 
   * Feature: stage-06-cli-ui, Property 8: NDJSON Stream Format
   * Validates: Requirements 3.5
   */
  it('Property 8: should produce valid NDJSON stream format', async () => {
    // Mock console.log to capture stream events
    const originalLog = console.log;
    const streamEvents: string[] = [];
    
    console.log = vi.fn((message: string) => {
      streamEvents.push(message);
    });

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }), // Random prompts
        async (prompt) => {
          streamEvents.length = 0; // Clear previous events
          
          try {
            await runner.run({
              prompt,
              output: 'stream-json',
              config: mockConfig,
            });
          } catch (error) {
            // Ignore errors for this test
          }

          // Verify each line is valid JSON
          for (const line of streamEvents) {
            expect(() => JSON.parse(line)).not.toThrow();
            
            const parsed = JSON.parse(line);
            
            // Verify event structure
            expect(parsed).toHaveProperty('type');
            expect(typeof parsed.type).toBe('string');
            
            // Valid event types
            const validTypes = ['text', 'tool_call_start', 'tool_call_result', 'turn_complete', 'finish', 'error'];
            expect(validTypes).toContain(parsed.type);
          }
        }
      ),
      { numRuns: 100 }
    );

    // Restore console.log
    console.log = originalLog;
  });

  /**
   * Property 9: Error Exit Codes
   * For any error in non-interactive mode, the CLI should write to stderr and exit
   * with a non-zero exit code.
   * 
   * Feature: stage-06-cli-ui, Property 9: Error Exit Codes
   * Validates: Requirements 3.6
   */
  it('Property 9: should handle errors with appropriate exit codes', async () => {
    // Mock console.error to capture stderr output
    const originalError = console.error;
    const stderrOutput: string[] = [];
    
    console.error = vi.fn((...args: any[]) => {
      stderrOutput.push(args.join(' '));
    });

    // Mock process.exit to capture exit codes
    const originalExit = process.exit;
    let exitCode: number | undefined;
    
    process.exit = vi.fn((code?: number) => {
      exitCode = code;
      throw new Error('Process exit called'); // Prevent actual exit
    }) as any;

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          NonInteractiveErrorCode.PROVIDER_CONNECTION_FAILURE,
          NonInteractiveErrorCode.MODEL_NOT_FOUND,
          NonInteractiveErrorCode.TIMEOUT,
          NonInteractiveErrorCode.INVALID_OUTPUT_FORMAT,
          NonInteractiveErrorCode.GENERAL_ERROR
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (errorCode, errorMessage) => {
          stderrOutput.length = 0; // Clear previous output
          exitCode = undefined;
          
          const error = new NonInteractiveError(errorMessage, errorCode);
          
          try {
            runner.handleError(error);
          } catch (e) {
            // Expected - process.exit throws
          }

          // Verify stderr output
          expect(stderrOutput.length).toBeGreaterThan(0);
          expect(stderrOutput.some(line => line.includes(errorMessage))).toBe(true);
          
          // Verify exit code is non-zero
          expect(exitCode).toBeDefined();
          expect(exitCode).toBeGreaterThan(0);
          expect(exitCode).toBe(errorCode);
        }
      ),
      { numRuns: 100 }
    );

    // Restore mocks
    console.error = originalError;
    process.exit = originalExit;
  });

  /**
   * Property 35: Connection Error Display
   * For any provider connection failure, the CLI should display the connection status
   * and available retry options.
   * 
   * Feature: stage-06-cli-ui, Property 35: Connection Error Display
   * Validates: Requirements 22.4
   */
  it('Property 35: should display connection status and retry options for connection failures', async () => {
    // Mock console.error to capture stderr output
    const originalError = console.error;
    const stderrOutput: string[] = [];
    
    console.error = vi.fn((...args: any[]) => {
      stderrOutput.push(args.join(' '));
    });

    // Mock process.exit to prevent actual exit
    const originalExit = process.exit;
    let exitCode: number | undefined;
    
    process.exit = vi.fn((code?: number) => {
      exitCode = code;
      throw new Error('Process exit called');
    }) as any;

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }), // Random error messages
        fc.constantFrom(
          'http://localhost:11434',
          'http://localhost:8000',
          'http://example.com:11434',
          'https://api.example.com'
        ), // Random host URLs
        async (errorMessage, host) => {
          stderrOutput.length = 0;
          exitCode = undefined;
          
          // Create a connection failure error
          const error = new NonInteractiveError(
            `Cannot connect to provider at ${host}: ${errorMessage}`,
            NonInteractiveErrorCode.PROVIDER_CONNECTION_FAILURE
          );
          
          try {
            runner.handleError(error);
          } catch (e) {
            // Expected - process.exit throws
          }

          // Verify connection status is displayed
          const output = stderrOutput.join('\n');
          expect(output).toContain('Connection Status');
          expect(output).toContain('Failed');
          
          // Verify retry options are provided
          expect(output).toContain('Retry Options');
          expect(output.toLowerCase()).toContain('check');
          expect(output.toLowerCase()).toContain('verify');
          
          // Verify helpful suggestions are included
          expect(
            output.toLowerCase().includes('provider') ||
            output.toLowerCase().includes('service') ||
            output.toLowerCase().includes('running')
          ).toBe(true);
          
          // Verify exit code is PROVIDER_CONNECTION_FAILURE
          expect(exitCode).toBe(NonInteractiveErrorCode.PROVIDER_CONNECTION_FAILURE);
        }
      ),
      { numRuns: 100 }
    );

    // Restore mocks
    console.error = originalError;
    process.exit = originalExit;
  });
});
