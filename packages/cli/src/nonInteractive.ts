/**
 * Non-Interactive Runner
 * Handles single-prompt execution without the TUI.
 */

import type { Config } from './config/types.js';
import { ProviderRegistry, ChatClient } from '@ollm/core';
import { ToolRegistry } from '@ollm/core';
import { LocalProvider } from '@ollm/ollm-bridge';
import { readFileSync } from 'fs';

/**
 * Error codes for non-interactive mode.
 */
export enum NonInteractiveErrorCode {
  PROVIDER_CONNECTION_FAILURE = 1,
  MODEL_NOT_FOUND = 2,
  TIMEOUT = 3,
  INVALID_OUTPUT_FORMAT = 4,
  GENERAL_ERROR = 5,
}

/**
 * Non-interactive error with exit code.
 */
export class NonInteractiveError extends Error {
  constructor(
    message: string,
    public exitCode: NonInteractiveErrorCode = NonInteractiveErrorCode.GENERAL_ERROR
  ) {
    super(message);
    this.name = 'NonInteractiveError';
  }
}

/**
 * Options for non-interactive execution.
 */
export interface NonInteractiveOptions {
  prompt: string;
  model?: string;
  provider?: string;
  output: 'text' | 'json' | 'stream-json';
  config: Config;
  abortSignal?: AbortSignal;
}

/**
 * Result from non-interactive execution.
 */
export interface NonInteractiveResult {
  response: string;
  metadata?: {
    model: string;
    provider: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    duration: number;
    cost?: number;
  };
}

/**
 * Stream event for stream-json output format.
 */
export interface StreamEvent {
  type: 'text' | 'tool_call_start' | 'tool_call_result' | 'turn_complete' | 'finish' | 'error';
  data?: unknown;
}

/**
 * Non-interactive runner for single-prompt execution.
 */
export class NonInteractiveRunner {
  /**
   * Run a single prompt and return the result.
   * @param options Execution options
   * @returns Promise resolving to the result
   * @throws NonInteractiveError with specific exit codes
   */
  async run(options: NonInteractiveOptions): Promise<NonInteractiveResult> {
    // Validate output format
    const validFormats = ['text', 'json', 'stream-json'];
    if (!validFormats.includes(options.output)) {
      throw new NonInteractiveError(
        `Invalid output format: ${options.output}. Must be one of: ${validFormats.join(', ')}`,
        NonInteractiveErrorCode.INVALID_OUTPUT_FORMAT
      );
    }
    
    const startTime = Date.now();
    
    // Initialize provider registry
    const providerRegistry = new ProviderRegistry();
    
    // Register providers based on config
    const providerName = options.provider || options.config.provider.default;
    
    try {
      if (providerName === 'ollama' || providerName === 'local') {
        const ollamaConfig = options.config.provider.ollama || {
          host: 'http://localhost:11434',
          timeout: 30000,
        };
        
        const localProvider = new LocalProvider({
          baseUrl: ollamaConfig.host,
          timeout: ollamaConfig.timeout,
        });
        
        providerRegistry.register(localProvider);
        providerRegistry.setDefault('local');
      }
      // TODO: Add vLLM and OpenAI-compatible providers when implemented
      else {
        throw new NonInteractiveError(
          `Provider "${providerName}" not supported. Available providers: ollama`,
          NonInteractiveErrorCode.PROVIDER_CONNECTION_FAILURE
        );
      }
    } catch (error) {
      if (error instanceof NonInteractiveError) {
        throw error;
      }
      
      // Enhance error message with connection details
      let enhancedMessage = `Failed to initialize provider: ${error instanceof Error ? error.message : String(error)}`;
      
      if (providerName === 'ollama' || providerName === 'local') {
        const host = options.config.provider.ollama?.host || 'http://localhost:11434';
        enhancedMessage += `\n  Provider: ${providerName}\n  Host: ${host}`;
      }
      
      throw new NonInteractiveError(
        enhancedMessage,
        NonInteractiveErrorCode.PROVIDER_CONNECTION_FAILURE
      );
    }
    
    // Initialize tool registry (empty for now)
    const toolRegistry = new ToolRegistry();
    
    // Initialize chat client
    const chatClient = new ChatClient(providerRegistry, toolRegistry);
    
    // Determine model
    const model = options.model || options.config.model.default;
    
    // Set up timeout if configured
    const timeout = options.config.provider.ollama?.timeout || 30000;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);
    
    // Execute chat
    let response = '';
    let hasError = false;
    let errorMessage = '';
    let errorCode = NonInteractiveErrorCode.GENERAL_ERROR;
    
    try {
      for await (const event of chatClient.chat(options.prompt, {
        model,
        provider: providerName === 'ollama' ? 'local' : providerName,
        abortSignal: options.abortSignal || abortController.signal,
      })) {
        if (event.type === 'text') {
          response += event.value;
          
          // For stream-json output, emit each text chunk
          if (options.output === 'stream-json') {
            this.emitStreamEvent({ type: 'text', data: event.value });
          }
        } else if (event.type === 'tool_call_start') {
          if (options.output === 'stream-json') {
            this.emitStreamEvent({ type: 'tool_call_start', data: event.toolCall });
          }
        } else if (event.type === 'tool_call_result') {
          if (options.output === 'stream-json') {
            this.emitStreamEvent({
              type: 'tool_call_result',
              data: { toolCall: event.toolCall, result: event.result },
            });
          }
        } else if (event.type === 'turn_complete') {
          if (options.output === 'stream-json') {
            this.emitStreamEvent({ type: 'turn_complete', data: { turnNumber: event.turnNumber } });
          }
        } else if (event.type === 'finish') {
          if (options.output === 'stream-json') {
            this.emitStreamEvent({ type: 'finish', data: { reason: event.reason } });
          }
        } else if (event.type === 'error') {
          hasError = true;
          errorMessage = event.error.message;
          
          // Determine error code based on message
          if (errorMessage.includes('Provider') || errorMessage.includes('connection')) {
            errorCode = NonInteractiveErrorCode.PROVIDER_CONNECTION_FAILURE;
          } else if (errorMessage.includes('model') || errorMessage.includes('not found')) {
            errorCode = NonInteractiveErrorCode.MODEL_NOT_FOUND;
          } else if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
            errorCode = NonInteractiveErrorCode.TIMEOUT;
          }
          
          if (options.output === 'stream-json') {
            this.emitStreamEvent({ type: 'error', data: { message: event.error.message } });
          }
        }
      }
    } catch (error) {
      hasError = true;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for timeout/abort
        if (error.name === 'AbortError' || errorMessage.includes('aborted')) {
          errorCode = NonInteractiveErrorCode.TIMEOUT;
          errorMessage = `Request timed out after ${timeout}ms`;
        } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
          errorCode = NonInteractiveErrorCode.PROVIDER_CONNECTION_FAILURE;
          const host = options.config.provider.ollama?.host || 'http://localhost:11434';
          errorMessage = `Cannot connect to provider at ${host}: ${errorMessage}`;
        } else if (errorMessage.includes('Provider') || errorMessage.includes('connection')) {
          errorCode = NonInteractiveErrorCode.PROVIDER_CONNECTION_FAILURE;
        } else if (errorMessage.includes('model') || errorMessage.includes('not found') || errorMessage.includes('404')) {
          errorCode = NonInteractiveErrorCode.MODEL_NOT_FOUND;
          errorMessage = `Model "${model}" not found. ${errorMessage}`;
        }
      } else {
        errorMessage = String(error);
      }
    } finally {
      clearTimeout(timeoutId);
    }
    
    const duration = Date.now() - startTime;
    
    // If there was an error, throw it with the appropriate exit code
    if (hasError) {
      throw new NonInteractiveError(errorMessage, errorCode);
    }
    
    // Build result
    const result: NonInteractiveResult = {
      response,
      metadata: {
        model,
        provider: providerName,
        duration,
      },
    };
    
    return result;
  }
  
  /**
   * Format output according to the specified format.
   * @param result The execution result
   * @param format The output format
   * @returns Formatted output string
   */
  formatOutput(result: NonInteractiveResult, format: 'text' | 'json' | 'stream-json'): string {
    switch (format) {
      case 'text':
        return result.response;
      
      case 'json':
        return JSON.stringify(result, null, 2);
      
      case 'stream-json':
        // For stream-json, events are emitted during execution
        // This is just for the final result
        return '';
      
      default:
        return result.response;
    }
  }
  
  /**
   * Emit a stream event for stream-json output.
   * @param event The event to emit
   */
  private emitStreamEvent(event: StreamEvent): void {
    console.log(JSON.stringify(event));
  }
  
  /**
   * Handle errors and write to stderr with detailed information.
   * @param error The error to handle
   */
  handleError(error: Error | NonInteractiveError): never {
    // Write error to stderr
    console.error(`\nError: ${error.message}`);
    
    // Determine exit code
    let exitCode = NonInteractiveErrorCode.GENERAL_ERROR;
    
    if (error instanceof NonInteractiveError) {
      exitCode = error.exitCode;
      
      // Provide helpful suggestions based on error type
      switch (exitCode) {
        case NonInteractiveErrorCode.PROVIDER_CONNECTION_FAILURE:
          console.error('\n❌ Connection Status: Failed');
          console.error('\nRetry Options:');
          console.error('  1. Check that the provider service is running');
          console.error('  2. Verify the host URL in your configuration');
          console.error('  3. Try using --host to specify a different endpoint');
          console.error('  4. Check firewall settings');
          console.error('\nFor Ollama:');
          console.error('  - Start Ollama: ollama serve');
          console.error('  - Default host: http://localhost:11434');
          break;
        
        case NonInteractiveErrorCode.MODEL_NOT_FOUND:
          console.error('\n❌ Model Status: Not Found');
          console.error('\nRetry Options:');
          console.error('  1. Use --list-models to see available models');
          console.error('  2. Pull the model with --pull-model <name>');
          console.error('  3. Check the model name spelling');
          console.error('\nExample:');
          console.error('  ollm --pull-model llama3.2:3b');
          console.error('  ollm --list-models');
          break;
        
        case NonInteractiveErrorCode.TIMEOUT:
          console.error('\n⏱️  Connection Status: Timeout');
          console.error('\nRetry Options:');
          console.error('  1. Increase the timeout in your configuration');
          console.error('  2. Check provider connectivity and performance');
          console.error('  3. Try a smaller model or simpler prompt');
          console.error('  4. Retry the request');
          console.error('\nConfiguration:');
          console.error('  Add to ~/.ollm/config.yaml:');
          console.error('  provider:');
          console.error('    ollama:');
          console.error('      timeout: 60000  # 60 seconds');
          break;
        
        case NonInteractiveErrorCode.INVALID_OUTPUT_FORMAT:
          console.error('\n❌ Invalid Output Format');
          console.error('\nValid output formats:');
          console.error('  - text        Plain text response only');
          console.error('  - json        JSON object with response and metadata');
          console.error('  - stream-json NDJSON stream of events');
          console.error('\nExample:');
          console.error('  ollm --prompt "Hello" --output json');
          break;
        
        default:
          console.error('\nFor more help, run: ollm --help');
          break;
      }
    } else {
      console.error('\nFor more help, run: ollm --help');
    }
    
    console.error(''); // Empty line before exit
    process.exit(exitCode);
  }
}

/**
 * Read prompt from stdin if available.
 * @returns Promise resolving to stdin content or null
 */
export async function readStdin(): Promise<string | null> {
  // Check if stdin is a TTY (interactive terminal)
  if (process.stdin.isTTY) {
    return null;
  }
  
  return new Promise((resolve, reject) => {
    let data = '';
    
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
    
    process.stdin.on('error', (error) => {
      reject(error);
    });
  });
}
