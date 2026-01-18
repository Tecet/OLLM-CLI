/**
 * Message Bus for Tool Confirmations
 *
 * Implements an async communication channel for requesting and receiving
 * user confirmations for tool operations. Uses a request/response pattern
 * with correlation IDs to match responses to their requests.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import type { MessageBus, ToolCallConfirmationDetails } from '../tools/types.js';

/**
 * Confirmation request with correlation ID
 */
export interface ConfirmationRequest {
  /**
   * Unique identifier for this request
   */
  correlationId: string;

  /**
   * Details about the operation requiring confirmation
   */
  details: ToolCallConfirmationDetails;

  /**
   * Timestamp when the request was created
   */
  timestamp: number;
}

/**
 * Confirmation response matching a request
 */
export interface ConfirmationResponse {
  /**
   * Correlation ID matching the original request
   */
  correlationId: string;

  /**
   * Whether the operation was approved
   */
  approved: boolean;

  /**
   * Timestamp when the response was received
   */
  timestamp: number;
}

/**
 * Pending request with its resolver
 */
interface PendingRequest {
  request: ConfirmationRequest;
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
  abortHandler?: () => void;
}

/**
 * Handler function for confirmation requests
 */
export type ConfirmationHandler = (
  request: ConfirmationRequest
) => Promise<boolean> | boolean;

/**
 * Default timeout for confirmation requests (60 seconds)
 */
export const DEFAULT_CONFIRMATION_TIMEOUT = 60000;

/**
 * Message Bus implementation for tool confirmations
 *
 * Provides an async request/response pattern for requesting user confirmations.
 * Each request gets a unique correlation ID, and responses are matched back
 * to their original requests.
 */
export class ConfirmationBus implements MessageBus {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private correlationCounter = 0;
  private handler: ConfirmationHandler | null = null;

  /**
   * Generate a unique correlation ID
   * Requirement 8.1
   */
  generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const counter = (this.correlationCounter++).toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${counter}-${random}`;
  }

  /**
   * Set the handler for confirmation requests
   *
   * The handler is called when a confirmation is requested and should
   * return true if approved, false if denied.
   */
  setHandler(handler: ConfirmationHandler): void {
    this.handler = handler;
  }

  /**
   * Remove the confirmation handler
   */
  clearHandler(): void {
    this.handler = null;
  }

  /**
   * Request user confirmation for a tool operation
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.6
   *
   * @param details Details about the operation requiring confirmation
   * @param abortSignal Optional signal to cancel the request
   * @param timeout Timeout in milliseconds (default: 60000)
   * @returns Promise that resolves to true if approved, false if denied
   */
  async requestConfirmation(
    details: ToolCallConfirmationDetails,
    abortSignal?: AbortSignal,
    timeout: number = DEFAULT_CONFIRMATION_TIMEOUT
  ): Promise<boolean> {
    // Check if already aborted
    if (abortSignal?.aborted) {
      throw new Error('Confirmation request cancelled');
    }

    // Generate unique correlation ID (Requirement 8.1)
    const correlationId = this.generateCorrelationId();

    // Create the request
    const request: ConfirmationRequest = {
      correlationId,
      details,
      timestamp: Date.now(),
    };

    // If we have a handler, use it directly
    if (this.handler) {
      return this.executeWithHandler(request, abortSignal, timeout);
    }

    // Otherwise, create a pending request and wait for response
    return this.createPendingRequest(request, abortSignal, timeout);
  }

  /**
   * Execute confirmation with the registered handler
   */
  private async executeWithHandler(
    request: ConfirmationRequest,
    abortSignal?: AbortSignal,
    timeout: number = DEFAULT_CONFIRMATION_TIMEOUT
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
        settle(new Error(`Confirmation request timed out after ${timeout}ms`));
      }, timeout);
      let abortHandler: (() => void) | undefined;
      let settled = false;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (abortHandler && abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler);
        }
      };

      const settle = (result: boolean | Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      };

      // Set up abort handler (Requirement 8.6)
      if (abortSignal) {
        abortHandler = () => {
          settle(new Error('Confirmation request cancelled'));
        };
        abortSignal.addEventListener('abort', abortHandler);
      }

      // Execute the handler
      try {
        const result = this.handler!(request);
        if (result instanceof Promise) {
          result
            .then((approved) => settle(approved))
            .catch((error) => settle(error instanceof Error ? error : new Error(String(error))));
        } else {
          settle(result);
        }
      } catch (error) {
        settle(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Create a pending request and wait for response
   * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6
   */
  private createPendingRequest(
    request: ConfirmationRequest,
    abortSignal?: AbortSignal,
    timeout: number = DEFAULT_CONFIRMATION_TIMEOUT
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const pending: PendingRequest = {
        request,
        resolve,
        reject,
      };

      // Set up timeout (Requirement 8.4)
      pending.timeoutId = setTimeout(() => {
        this.pendingRequests.delete(request.correlationId);
        reject(new Error(`Confirmation request timed out after ${timeout}ms`));
      }, timeout);

      // Set up abort handler (Requirement 8.6)
      if (abortSignal) {
        pending.abortHandler = () => {
          if (pending.timeoutId) {
            clearTimeout(pending.timeoutId);
          }
          this.pendingRequests.delete(request.correlationId);
          reject(new Error('Confirmation request cancelled'));
        };
        abortSignal.addEventListener('abort', pending.abortHandler);
      }

      // Store the pending request (Requirement 8.5 - independent handling)
      this.pendingRequests.set(request.correlationId, pending);
    });
  }

  /**
   * Respond to a confirmation request
   *
   * Requirements: 8.2, 8.3
   *
   * @param correlationId The correlation ID of the request to respond to
   * @param approved Whether the operation is approved
   * @returns true if the response was delivered, false if no matching request
   */
  respond(correlationId: string, approved: boolean): boolean {
    const pending = this.pendingRequests.get(correlationId);
    if (!pending) {
      return false;
    }

    // Clean up
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }
    if (pending.abortHandler) {
      // Note: We can't remove the listener without the signal reference
      // but the handler will be a no-op after we delete from pendingRequests
    }
    this.pendingRequests.delete(correlationId);

    // Deliver the response (Requirement 8.3)
    pending.resolve(approved);
    return true;
  }

  /**
   * Get all pending requests
   *
   * Useful for UI to display pending confirmations
   */
  getPendingRequests(): ConfirmationRequest[] {
    return Array.from(this.pendingRequests.values()).map((p) => p.request);
  }

  /**
   * Get a specific pending request by correlation ID
   */
  getPendingRequest(correlationId: string): ConfirmationRequest | undefined {
    return this.pendingRequests.get(correlationId)?.request;
  }

  /**
   * Check if there are any pending requests
   */
  hasPendingRequests(): boolean {
    return this.pendingRequests.size > 0;
  }

  /**
   * Get the number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Cancel all pending requests
   *
   * Useful for cleanup when shutting down
   */
  cancelAll(): void {
    this.pendingRequests.forEach((pending) => {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.reject(new Error('All confirmation requests cancelled'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Cancel a specific pending request
   */
  cancel(correlationId: string): boolean {
    const pending = this.pendingRequests.get(correlationId);
    if (!pending) {
      return false;
    }

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }
    this.pendingRequests.delete(correlationId);
    pending.reject(new Error('Confirmation request cancelled'));
    return true;
  }
}

/**
 * Create a new ConfirmationBus instance
 */
export function createConfirmationBus(): ConfirmationBus {
  return new ConfirmationBus();
}
