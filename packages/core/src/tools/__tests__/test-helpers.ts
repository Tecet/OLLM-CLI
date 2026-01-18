/**
 * Test helpers and utilities for tool testing
 */

import type { MessageBus, ToolCallConfirmationDetails, ToolContext } from '../types.js';

/**
 * Mock message bus for testing
 */
export class MockMessageBus implements MessageBus {
  private confirmationResponses: Map<string, boolean> = new Map();
  public requestHistory: ToolCallConfirmationDetails[] = [];

  /**
   * Set the response for the next confirmation request
   */
  setNextResponse(approved: boolean): void {
    this.confirmationResponses.set('next', approved);
  }

  /**
   * Set a response for a specific tool name
   */
  setResponseForTool(toolName: string, approved: boolean): void {
    this.confirmationResponses.set(toolName, approved);
  }

  /**
   * Clear all configured responses
   */
  clearResponses(): void {
    this.confirmationResponses.clear();
    this.requestHistory = [];
  }

  async requestConfirmation(
    details: ToolCallConfirmationDetails,
    abortSignal?: AbortSignal,
    _timeout: number = 60000
  ): Promise<boolean> {
    // Record the request
    this.requestHistory.push(details);

    // Check if aborted
    if (abortSignal?.aborted) {
      throw new Error('Confirmation request cancelled');
    }

    // Get response
    const toolResponse = this.confirmationResponses.get(details.toolName);
    if (toolResponse !== undefined) {
      return toolResponse;
    }

    const nextResponse = this.confirmationResponses.get('next');
    if (nextResponse !== undefined) {
      this.confirmationResponses.delete('next');
      return nextResponse;
    }

    // Default to approved for testing
    return true;
  }

  /**
   * Get the number of confirmation requests made
   */
  getRequestCount(): number {
    return this.requestHistory.length;
  }

  /**
   * Get the last confirmation request
   */
  getLastRequest(): ToolCallConfirmationDetails | undefined {
    return this.requestHistory[this.requestHistory.length - 1];
  }
}

/**
 * Create a mock abort signal for testing
 */
export function createMockAbortSignal(aborted: boolean = false): AbortSignal {
  const controller = new AbortController();
  if (aborted) {
    controller.abort();
  }
  return controller.signal;
}

/**
 * Create an abort signal that aborts after a delay
 */
export function createDelayedAbortSignal(delayMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), delayMs);
  return controller.signal;
}

/**
 * Wait for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate random file content for testing
 */
export function generateRandomContent(lines: number): string {
  const contentLines: string[] = [];
  for (let i = 0; i < lines; i++) {
    contentLines.push(`Line ${i + 1}: ${Math.random().toString(36).substring(7)}`);
  }
  return contentLines.join('\n');
}

/**
 * Generate random file path for testing
 */
export function generateRandomPath(): string {
  const segments = Math.floor(Math.random() * 3) + 1;
  const parts: string[] = [];
  for (let i = 0; i < segments; i++) {
    parts.push(Math.random().toString(36).substring(7));
  }
  return parts.join('/') + '.txt';
}

/**
 * Assert that a value is defined (TypeScript type guard)
 */
export function assertDefined<T>(
  value: T | undefined | null,
  message?: string
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message || 'Value is undefined or null');
  }
}

/**
 * Assert that a promise rejects with a specific error message
 */
export async function assertRejects(
  promise: Promise<unknown>,
  expectedMessage?: string
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject, but it resolved');
  } catch (error) {
    if (expectedMessage) {
      const message = (error as Error).message;
      if (!message.includes(expectedMessage)) {
        throw new Error(
          `Expected error message to include "${expectedMessage}", but got "${message}"`
        );
      }
    }
  }
}

/**
 * Create a ToolContext from a MessageBus for testing
 * This helper wraps a MessageBus in the ToolContext object structure
 */
export function createToolContext(messageBus: MessageBus): ToolContext {
  return { messageBus };
}
