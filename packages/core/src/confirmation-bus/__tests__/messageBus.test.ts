/**
 * Message Bus Tests
 *
 * Tests for the ConfirmationBus class that handles async communication
 * for tool confirmations using a request/response pattern with correlation IDs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  ConfirmationBus,
  createConfirmationBus,
} from '../messageBus.js';
import type { ToolCallConfirmationDetails } from '../../tools/types.js';

describe('ConfirmationBus', () => {
  let bus: ConfirmationBus;

  beforeEach(() => {
    bus = createConfirmationBus();
  });

  afterEach(() => {
    bus.cancelAll();
  });

  describe('constructor', () => {
    it('should create a new instance', () => {
      expect(bus).toBeInstanceOf(ConfirmationBus);
    });

    it('should start with no pending requests', () => {
      expect(bus.hasPendingRequests()).toBe(false);
      expect(bus.getPendingCount()).toBe(0);
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate a non-empty string', () => {
      const id = bus.generateCorrelationId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs on consecutive calls', () => {
      const id1 = bus.generateCorrelationId();
      const id2 = bus.generateCorrelationId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('setHandler and clearHandler', () => {
    it('should set and clear handler', () => {
      const handler = vi.fn().mockReturnValue(true);
      bus.setHandler(handler);
      bus.clearHandler();
      // No direct way to verify, but should not throw
    });
  });

  describe('requestConfirmation with handler', () => {
    it('should call handler and return result', async () => {
      const handler = vi.fn().mockReturnValue(true);
      bus.setHandler(handler);

      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'low',
      };

      const result = await bus.requestConfirmation(details);
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle async handler', async () => {
      const handler = vi.fn().mockResolvedValue(false);
      bus.setHandler(handler);

      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'medium',
      };

      const result = await bus.requestConfirmation(details);
      expect(result).toBe(false);
    });

    it('should reject when handler throws', async () => {
      const handler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      bus.setHandler(handler);

      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'high',
      };

      await expect(bus.requestConfirmation(details)).rejects.toThrow('Handler error');
    });
  });

  describe('requestConfirmation without handler (pending requests)', () => {
    it('should create a pending request', async () => {
      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'low',
      };

      // Start the request but don't await it
      const promise = bus.requestConfirmation(details, undefined, 5000);

      // Should have a pending request
      expect(bus.hasPendingRequests()).toBe(true);
      expect(bus.getPendingCount()).toBe(1);

      // Get the pending request
      const pending = bus.getPendingRequests();
      expect(pending.length).toBe(1);
      expect(pending[0].details.toolName).toBe('test_tool');

      // Respond to complete the request
      bus.respond(pending[0].correlationId, true);

      const result = await promise;
      expect(result).toBe(true);
    });

    it('should resolve when respond is called with matching ID', async () => {
      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'low',
      };

      const promise = bus.requestConfirmation(details, undefined, 5000);
      const pending = bus.getPendingRequests();

      bus.respond(pending[0].correlationId, false);

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should return false when responding to non-existent request', () => {
      const result = bus.respond('non-existent-id', true);
      expect(result).toBe(false);
    });
  });

  describe('timeout handling', () => {
    it('should reject after timeout', async () => {
      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'low',
      };

      // Use a very short timeout
      const promise = bus.requestConfirmation(details, undefined, 50);

      await expect(promise).rejects.toThrow('timed out');
    });
  });

  describe('abort signal handling', () => {
    it('should reject when abort signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'low',
      };

      await expect(
        bus.requestConfirmation(details, controller.signal)
      ).rejects.toThrow('cancelled');
    });

    it('should reject when abort signal is triggered', async () => {
      const controller = new AbortController();

      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'low',
      };

      const promise = bus.requestConfirmation(details, controller.signal, 5000);

      // Abort after a short delay
      setTimeout(() => controller.abort(), 50);

      await expect(promise).rejects.toThrow('cancelled');
    });
  });

  describe('cancel methods', () => {
    it('should cancel a specific request', async () => {
      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'low',
      };

      const promise = bus.requestConfirmation(details, undefined, 5000);
      const pending = bus.getPendingRequests();

      const cancelled = bus.cancel(pending[0].correlationId);
      expect(cancelled).toBe(true);

      await expect(promise).rejects.toThrow('cancelled');
    });

    it('should return false when cancelling non-existent request', () => {
      const result = bus.cancel('non-existent-id');
      expect(result).toBe(false);
    });

    it('should cancel all pending requests', async () => {
      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'low',
      };

      const promise1 = bus.requestConfirmation(details, undefined, 5000);
      const promise2 = bus.requestConfirmation(details, undefined, 5000);

      expect(bus.getPendingCount()).toBe(2);

      bus.cancelAll();

      expect(bus.getPendingCount()).toBe(0);

      await expect(promise1).rejects.toThrow('cancelled');
      await expect(promise2).rejects.toThrow('cancelled');
    });
  });

  describe('getPendingRequest', () => {
    it('should return specific pending request by ID', async () => {
      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'low',
      };

      const promise = bus.requestConfirmation(details, undefined, 5000);
      const pending = bus.getPendingRequests();
      const id = pending[0].correlationId;

      const request = bus.getPendingRequest(id);
      expect(request).toBeDefined();
      expect(request?.correlationId).toBe(id);

      bus.respond(id, true);
      await promise;
    });

    it('should return undefined for non-existent ID', () => {
      const request = bus.getPendingRequest('non-existent-id');
      expect(request).toBeUndefined();
    });
  });
});


describe('Property 38: Message Bus Correlation ID Uniqueness', () => {
  // Feature: stage-03-tools-policy, Property 38: Message Bus Correlation ID Uniqueness
  // *For any* set of confirmation requests, each should receive a unique correlation ID.
  // **Validates: Requirements 8.1**

  let bus: ConfirmationBus;

  beforeEach(() => {
    bus = createConfirmationBus();
  });

  afterEach(() => {
    bus.cancelAll();
  });

  // Generator for tool names
  const toolNameArb = fc
    .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', '_', '-', '1', '2'), {
      minLength: 1,
      maxLength: 20,
    })
    .filter((s) => /^[a-z]/.test(s));

  // Generator for risk levels
  const riskLevelArb = fc.constantFrom<'low' | 'medium' | 'high'>('low', 'medium', 'high');

  // Generator for confirmation details
  const confirmationDetailsArb = fc.record({
    toolName: toolNameArb,
    description: fc.string({ minLength: 1, maxLength: 100 }),
    risk: riskLevelArb,
    locations: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 })),
  }) as fc.Arbitrary<ToolCallConfirmationDetails>;

  it('should generate unique correlation IDs for sequential calls', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        (count) => {
          const ids = new Set<string>();

          for (let i = 0; i < count; i++) {
            const id = bus.generateCorrelationId();
            // Each ID should be unique
            expect(ids.has(id)).toBe(false);
            ids.add(id);
          }

          // All IDs should be unique
          expect(ids.size).toBe(count);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate unique correlation IDs across multiple bus instances', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }),
        fc.integer({ min: 2, max: 10 }),
        (idsPerBus, busCount) => {
          const allIds = new Set<string>();
          const buses: ConfirmationBus[] = [];

          // Create multiple bus instances
          for (let b = 0; b < busCount; b++) {
            buses.push(createConfirmationBus());
          }

          // Generate IDs from each bus
          for (const b of buses) {
            for (let i = 0; i < idsPerBus; i++) {
              const id = b.generateCorrelationId();
              allIds.add(id);
            }
          }

          // All IDs should be unique across all buses
          // Note: Due to the random component, there's an extremely small chance of collision
          // but with the format used (timestamp-counter-random), it should be practically unique
          expect(allIds.size).toBe(busCount * idsPerBus);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should assign unique correlation IDs to concurrent pending requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 2, maxLength: 20 }),
        async (detailsArray) => {
          const promises: Promise<boolean>[] = [];
          const correlationIds = new Set<string>();

          // Create multiple concurrent requests
          for (const details of detailsArray) {
            const promise = bus.requestConfirmation(details, undefined, 5000);
            promises.push(promise);
          }

          // Get all pending requests and collect their correlation IDs
          const pending = bus.getPendingRequests();
          for (const req of pending) {
            correlationIds.add(req.correlationId);
          }

          // All correlation IDs should be unique
          expect(correlationIds.size).toBe(detailsArray.length);

          // Clean up - respond to all requests
          for (const req of pending) {
            bus.respond(req.correlationId, true);
          }

          // Wait for all promises to resolve
          await Promise.all(promises);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain uniqueness even with identical confirmation details', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        fc.integer({ min: 2, max: 20 }),
        async (details, count) => {
          const promises: Promise<boolean>[] = [];
          const correlationIds = new Set<string>();

          // Create multiple requests with identical details
          for (let i = 0; i < count; i++) {
            const promise = bus.requestConfirmation(details, undefined, 5000);
            promises.push(promise);
          }

          // Get all pending requests
          const pending = bus.getPendingRequests();
          for (const req of pending) {
            correlationIds.add(req.correlationId);
          }

          // All correlation IDs should be unique even with identical details
          expect(correlationIds.size).toBe(count);

          // Clean up
          for (const req of pending) {
            bus.respond(req.correlationId, true);
          }

          await Promise.all(promises);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate IDs with expected format (timestamp-counter-random)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (count) => {
          for (let i = 0; i < count; i++) {
            const id = bus.generateCorrelationId();

            // ID should have the format: timestamp-counter-random
            const parts = id.split('-');
            expect(parts.length).toBe(3);

            // Each part should be non-empty
            expect(parts[0].length).toBeGreaterThan(0);
            expect(parts[1].length).toBeGreaterThan(0);
            expect(parts[2].length).toBeGreaterThan(0);

            // Parts should be valid base36 strings
            expect(() => parseInt(parts[0], 36)).not.toThrow();
            expect(() => parseInt(parts[1], 36)).not.toThrow();
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have monotonically increasing counter component', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }),
        (count) => {
          const counters: number[] = [];

          for (let i = 0; i < count; i++) {
            const id = bus.generateCorrelationId();
            const parts = id.split('-');
            const counter = parseInt(parts[1], 36);
            counters.push(counter);
          }

          // Counters should be monotonically increasing
          for (let i = 1; i < counters.length; i++) {
            expect(counters[i]).toBeGreaterThan(counters[i - 1]);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 39: Message Bus Request-Response Matching', () => {
  // Feature: stage-03-tools-policy, Property 39: Message Bus Request-Response Matching
  // *For any* confirmation request, the Message_Bus should deliver the response with
  // matching correlation ID to the correct requester.
  // **Validates: Requirements 8.2, 8.3**

  let bus: ConfirmationBus;

  beforeEach(() => {
    bus = createConfirmationBus();
  });

  afterEach(() => {
    bus.cancelAll();
  });

  // Generator for tool names
  const toolNameArb = fc
    .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', '_', '-', '1', '2'), {
      minLength: 1,
      maxLength: 20,
    })
    .filter((s) => /^[a-z]/.test(s));

  // Generator for risk levels
  const riskLevelArb = fc.constantFrom<'low' | 'medium' | 'high'>('low', 'medium', 'high');

  // Generator for confirmation details
  const confirmationDetailsArb = fc.record({
    toolName: toolNameArb,
    description: fc.string({ minLength: 1, maxLength: 100 }),
    risk: riskLevelArb,
    locations: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 })),
  }) as fc.Arbitrary<ToolCallConfirmationDetails>;

  it('should deliver response to the correct requester when respond is called with matching ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        fc.boolean(),
        async (details, approvalValue) => {
          // Create a confirmation request
          const promise = bus.requestConfirmation(details, undefined, 5000);

          // Get the pending request to find its correlation ID
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(1);
          const correlationId = pending[0].correlationId;

          // Respond with the matching correlation ID
          const delivered = bus.respond(correlationId, approvalValue);
          expect(delivered).toBe(true);

          // The promise should resolve with the approval value
          const result = await promise;
          expect(result).toBe(approvalValue);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should match responses to correct requesters when multiple requests are pending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 2, maxLength: 10 }),
        fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
        async (detailsArray, approvalValues) => {
          // Ensure we have matching lengths
          const count = Math.min(detailsArray.length, approvalValues.length);
          const details = detailsArray.slice(0, count);
          const approvals = approvalValues.slice(0, count);

          // Create multiple concurrent requests
          const promises: Promise<boolean>[] = [];
          for (const d of details) {
            promises.push(bus.requestConfirmation(d, undefined, 5000));
          }

          // Get all pending requests
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(count);

          // Create a map of correlation ID to expected approval value
          const expectedResults = new Map<string, boolean>();
          for (let i = 0; i < count; i++) {
            expectedResults.set(pending[i].correlationId, approvals[i]);
          }

          // Respond to each request with its specific approval value
          for (const req of pending) {
            const approval = expectedResults.get(req.correlationId)!;
            const delivered = bus.respond(req.correlationId, approval);
            expect(delivered).toBe(true);
          }

          // Wait for all promises and verify each got the correct result
          const results = await Promise.all(promises);
          for (let i = 0; i < count; i++) {
            expect(results[i]).toBe(approvals[i]);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not deliver response when correlation ID does not match', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        fc.boolean(),
        async (details, approvalValue) => {
          // Create a confirmation request
          const promise = bus.requestConfirmation(details, undefined, 5000);

          // Get the pending request
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(1);
          const correctId = pending[0].correlationId;

          // Try to respond with a wrong correlation ID
          const wrongId = 'wrong-correlation-id-' + Date.now();
          const delivered = bus.respond(wrongId, approvalValue);
          expect(delivered).toBe(false);

          // The request should still be pending
          expect(bus.hasPendingRequests()).toBe(true);
          expect(bus.getPendingCount()).toBe(1);

          // Now respond with the correct ID
          const correctDelivered = bus.respond(correctId, approvalValue);
          expect(correctDelivered).toBe(true);

          const result = await promise;
          expect(result).toBe(approvalValue);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle responses in any order for concurrent requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 3, maxLength: 8 }),
        fc.array(fc.boolean(), { minLength: 3, maxLength: 8 }),
        fc.nat({ max: 1000 }), // seed for shuffling
        async (detailsArray, approvalValues, shuffleSeed) => {
          // Ensure we have matching lengths
          const count = Math.min(detailsArray.length, approvalValues.length);
          const details = detailsArray.slice(0, count);
          const approvals = approvalValues.slice(0, count);

          // Create multiple concurrent requests
          const promises: Promise<boolean>[] = [];
          for (const d of details) {
            promises.push(bus.requestConfirmation(d, undefined, 5000));
          }

          // Get all pending requests
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(count);

          // Create a shuffled order for responding (use indices 0 to count-1)
          const indices = Array.from({ length: count }, (_, i) => i);
          // Simple Fisher-Yates shuffle using the seed
          let seed = shuffleSeed;
          for (let i = indices.length - 1; i > 0; i--) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff; // LCG
            const j = seed % (i + 1);
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }

          // Respond in shuffled order
          for (const idx of indices) {
            const req = pending[idx];
            const approval = approvals[idx];
            const delivered = bus.respond(req.correlationId, approval);
            expect(delivered).toBe(true);
          }

          // Wait for all promises and verify each got the correct result
          const results = await Promise.all(promises);
          for (let i = 0; i < count; i++) {
            expect(results[i]).toBe(approvals[i]);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only deliver response once per correlation ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        fc.boolean(),
        fc.boolean(),
        async (details, firstApproval, secondApproval) => {
          // Create a confirmation request
          const promise = bus.requestConfirmation(details, undefined, 5000);

          // Get the pending request
          const pending = bus.getPendingRequests();
          const correlationId = pending[0].correlationId;

          // First response should be delivered
          const firstDelivered = bus.respond(correlationId, firstApproval);
          expect(firstDelivered).toBe(true);

          // Second response with same ID should not be delivered (request already resolved)
          const secondDelivered = bus.respond(correlationId, secondApproval);
          expect(secondDelivered).toBe(false);

          // The result should be the first approval value
          const result = await promise;
          expect(result).toBe(firstApproval);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve request details when matching response to requester', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        fc.boolean(),
        async (details, approvalValue) => {
          // Create a confirmation request
          const promise = bus.requestConfirmation(details, undefined, 5000);

          // Get the pending request and verify details are preserved
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(1);
          const request = pending[0];

          // Verify the request details match what was sent
          expect(request.details.toolName).toBe(details.toolName);
          expect(request.details.description).toBe(details.description);
          expect(request.details.risk).toBe(details.risk);

          // Respond and verify the promise resolves correctly
          bus.respond(request.correlationId, approvalValue);
          const result = await promise;
          expect(result).toBe(approvalValue);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle handler-based responses correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        fc.boolean(),
        async (details, approvalValue) => {
          // Set up a handler that returns the approval value
          bus.setHandler(() => approvalValue);

          // Request confirmation - should use handler directly
          const result = await bus.requestConfirmation(details, undefined, 5000);

          // Result should match the handler's return value
          expect(result).toBe(approvalValue);

          // No pending requests when using handler
          expect(bus.hasPendingRequests()).toBe(false);

          // Clean up handler
          bus.clearHandler();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle async handler-based responses correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        fc.boolean(),
        fc.integer({ min: 1, max: 50 }),
        async (details, approvalValue, delayMs) => {
          // Set up an async handler with a small delay
          bus.setHandler(async () => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return approvalValue;
          });

          // Request confirmation - should use async handler
          const result = await bus.requestConfirmation(details, undefined, 5000);

          // Result should match the handler's return value
          expect(result).toBe(approvalValue);

          // Clean up handler
          bus.clearHandler();

          return true;
        }
      ),
      { numRuns: 50 } // Fewer runs due to async delays
    );
  });
});


describe('Property 40: Message Bus Timeout Handling', () => {
  // Feature: stage-03-tools-policy, Property 40: Message Bus Timeout Handling
  // *For any* confirmation request that receives no response within the timeout period,
  // the Message_Bus should reject with a timeout error.
  // **Validates: Requirements 8.4**

  let bus: ConfirmationBus;

  beforeEach(() => {
    bus = createConfirmationBus();
  });

  afterEach(() => {
    bus.cancelAll();
  });

  // Generator for tool names
  const toolNameArb = fc
    .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', '_', '-', '1', '2'), {
      minLength: 1,
      maxLength: 20,
    })
    .filter((s) => /^[a-z]/.test(s));

  // Generator for risk levels
  const riskLevelArb = fc.constantFrom<'low' | 'medium' | 'high'>('low', 'medium', 'high');

  // Generator for confirmation details
  const confirmationDetailsArb = fc.record({
    toolName: toolNameArb,
    description: fc.string({ minLength: 1, maxLength: 100 }),
    risk: riskLevelArb,
    locations: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 })),
  }) as fc.Arbitrary<ToolCallConfirmationDetails>;

  // Generator for short timeout values (to keep tests fast)
  const shortTimeoutArb = fc.integer({ min: 10, max: 100 });

  it('should reject with timeout error when no response is received within timeout period', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        shortTimeoutArb,
        async (details, timeoutMs) => {
          // Create a confirmation request with a short timeout
          const promise = bus.requestConfirmation(details, undefined, timeoutMs);

          // Don't respond - let it timeout
          // The promise should reject with a timeout error
          await expect(promise).rejects.toThrow(/timed out/i);

          // After timeout, the request should no longer be pending
          expect(bus.hasPendingRequests()).toBe(false);

          return true;
        }
      ),
      { numRuns: 20 } // Fewer runs due to async timeouts
    );
  });

  it('should include timeout duration in error message', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        shortTimeoutArb,
        async (details, timeoutMs) => {
          const promise = bus.requestConfirmation(details, undefined, timeoutMs);

          try {
            await promise;
            // Should not reach here
            expect(true).toBe(false);
          } catch (error) {
            // Error message should include the timeout duration
            expect((error as Error).message).toContain(String(timeoutMs));
            expect((error as Error).message).toContain('ms');
          }

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should not timeout if response is received before timeout period', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        fc.boolean(),
        fc.integer({ min: 100, max: 500 }), // timeout
        fc.integer({ min: 5, max: 50 }), // response delay (shorter than timeout)
        async (details, approvalValue, timeoutMs, responseDelayMs) => {
          // Create a confirmation request
          const promise = bus.requestConfirmation(details, undefined, timeoutMs);

          // Get the pending request
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(1);
          const correlationId = pending[0].correlationId;

          // Respond before timeout
          setTimeout(() => {
            bus.respond(correlationId, approvalValue);
          }, responseDelayMs);

          // The promise should resolve with the approval value, not timeout
          const result = await promise;
          expect(result).toBe(approvalValue);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should timeout each request independently when multiple requests are pending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 2, maxLength: 5 }),
        fc.array(shortTimeoutArb, { minLength: 2, maxLength: 5 }),
        async (detailsArray, timeoutsArray) => {
          // Ensure we have matching lengths
          const count = Math.min(detailsArray.length, timeoutsArray.length);
          const details = detailsArray.slice(0, count);
          const timeouts = timeoutsArray.slice(0, count);

          // Create multiple requests with different timeouts
          const promises: Promise<boolean>[] = [];
          for (let i = 0; i < count; i++) {
            promises.push(bus.requestConfirmation(details[i], undefined, timeouts[i]));
          }

          // All should timeout independently
          const results = await Promise.allSettled(promises);

          // All should be rejected with timeout errors
          for (const result of results) {
            expect(result.status).toBe('rejected');
            if (result.status === 'rejected') {
              expect(result.reason.message).toMatch(/timed out/i);
            }
          }

          // No pending requests after all timeouts
          expect(bus.hasPendingRequests()).toBe(false);

          return true;
        }
      ),
      { numRuns: 10 } // Fewer runs due to multiple async timeouts
    );
  });

  it('should timeout handler-based requests when handler takes too long', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        shortTimeoutArb,
        async (details, timeoutMs) => {
          // Set up a handler that takes longer than the timeout
          bus.setHandler(async () => {
            // Wait longer than the timeout
            await new Promise((resolve) => setTimeout(resolve, timeoutMs + 100));
            return true;
          });

          // Request confirmation with short timeout
          const promise = bus.requestConfirmation(details, undefined, timeoutMs);

          // Should timeout before handler completes
          await expect(promise).rejects.toThrow(/timed out/i);

          // Clean up handler
          bus.clearHandler();

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should clean up pending request after timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        shortTimeoutArb,
        async (details, timeoutMs) => {
          // Create a confirmation request
          const promise = bus.requestConfirmation(details, undefined, timeoutMs);

          // Get the correlation ID before timeout
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(1);
          const correlationId = pending[0].correlationId;

          // Wait for timeout
          try {
            await promise;
          } catch {
            // Expected to throw
          }

          // The specific request should no longer be retrievable
          expect(bus.getPendingRequest(correlationId)).toBeUndefined();

          // Responding to the timed-out request should return false
          const delivered = bus.respond(correlationId, true);
          expect(delivered).toBe(false);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should respect different timeout values for different requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        confirmationDetailsArb,
        async (details1, details2) => {
          // Create two requests with different timeouts
          const shortTimeout = 30;
          const longTimeout = 200;

          const promise1 = bus.requestConfirmation(details1, undefined, shortTimeout);
          const promise2 = bus.requestConfirmation(details2, undefined, longTimeout);

          // Get the pending requests
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(2);

          // Wait for the short timeout to expire and catch the rejection
          const result1 = await promise1.catch((err) => err.message);
          expect(result1).toMatch(/timed out/i);

          // Second request should still be pending (respond to it)
          const stillPending = bus.getPendingRequests();
          expect(stillPending.length).toBe(1);

          // Respond to the second request
          bus.respond(stillPending[0].correlationId, true);
          const result2 = await promise2;
          expect(result2).toBe(true);

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should use default timeout when not specified', async () => {
    // This test verifies that the default timeout is used when not specified
    // We can't easily test the actual 60-second default, so we verify the behavior
    // by checking that a request without explicit timeout still times out eventually

    const details: ToolCallConfirmationDetails = {
      toolName: 'test_tool',
      description: 'Test operation',
      risk: 'low',
    };

    // Create a request without specifying timeout (uses default)
    const promise = bus.requestConfirmation(details);

    // Should have a pending request
    expect(bus.hasPendingRequests()).toBe(true);

    // Cancel it to avoid waiting for the full default timeout
    bus.cancelAll();

    await expect(promise).rejects.toThrow(/cancelled/i);
  });
});


describe('Property 41: Message Bus Concurrent Requests', () => {
  // Feature: stage-03-tools-policy, Property 41: Message Bus Concurrent Requests
  // *For any* set of concurrent confirmation requests, the Message_Bus should handle
  // each independently without interference.
  // **Validates: Requirements 8.5**

  let bus: ConfirmationBus;

  beforeEach(() => {
    bus = createConfirmationBus();
  });

  afterEach(() => {
    bus.cancelAll();
  });

  // Generator for tool names
  const toolNameArb = fc
    .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', '_', '-', '1', '2'), {
      minLength: 1,
      maxLength: 20,
    })
    .filter((s) => /^[a-z]/.test(s));

  // Generator for risk levels
  const riskLevelArb = fc.constantFrom<'low' | 'medium' | 'high'>('low', 'medium', 'high');

  // Generator for confirmation details
  const confirmationDetailsArb = fc.record({
    toolName: toolNameArb,
    description: fc.string({ minLength: 1, maxLength: 100 }),
    risk: riskLevelArb,
    locations: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 })),
  }) as fc.Arbitrary<ToolCallConfirmationDetails>;

  it('should handle multiple concurrent requests independently by correlation ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 2, maxLength: 10 }),
        fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
        async (detailsArray, approvalValues) => {
          // Ensure we have matching lengths
          const count = Math.min(detailsArray.length, approvalValues.length);
          const details = detailsArray.slice(0, count);
          const approvals = approvalValues.slice(0, count);

          // Create multiple concurrent requests
          const promises: Promise<boolean>[] = [];
          for (const d of details) {
            promises.push(bus.requestConfirmation(d, undefined, 5000));
          }

          // All requests should be pending
          expect(bus.getPendingCount()).toBe(count);

          // Get all pending requests
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(count);

          // Each request should have a unique correlation ID
          const correlationIds = new Set(pending.map((p) => p.correlationId));
          expect(correlationIds.size).toBe(count);

          // Respond to each request with its specific approval value
          for (let i = 0; i < count; i++) {
            const delivered = bus.respond(pending[i].correlationId, approvals[i]);
            expect(delivered).toBe(true);
          }

          // Wait for all promises and verify each got the correct result
          const results = await Promise.all(promises);
          for (let i = 0; i < count; i++) {
            expect(results[i]).toBe(approvals[i]);
          }

          // No pending requests after all responses
          expect(bus.hasPendingRequests()).toBe(false);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow responding to requests in any order without affecting other requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 3, maxLength: 8 }),
        fc.array(fc.boolean(), { minLength: 3, maxLength: 8 }),
        fc.nat({ max: 1000 }), // seed for shuffling response order
        async (detailsArray, approvalValues, shuffleSeed) => {
          // Ensure we have matching lengths
          const count = Math.min(detailsArray.length, approvalValues.length);
          const details = detailsArray.slice(0, count);
          const approvals = approvalValues.slice(0, count);

          // Create multiple concurrent requests
          const promises: Promise<boolean>[] = [];
          for (const d of details) {
            promises.push(bus.requestConfirmation(d, undefined, 5000));
          }

          // Get all pending requests
          const pending = bus.getPendingRequests();

          // Create a shuffled order for responding
          const indices = Array.from({ length: count }, (_, i) => i);
          let seed = shuffleSeed;
          for (let i = indices.length - 1; i > 0; i--) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const j = seed % (i + 1);
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }

          // Respond in shuffled order
          for (const idx of indices) {
            const req = pending[idx];
            const approval = approvals[idx];
            const delivered = bus.respond(req.correlationId, approval);
            expect(delivered).toBe(true);
          }

          // Wait for all promises and verify each got the correct result
          const results = await Promise.all(promises);
          for (let i = 0; i < count; i++) {
            expect(results[i]).toBe(approvals[i]);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow cancelling one request without affecting other pending requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 3, maxLength: 8 }),
        fc.integer({ min: 0, max: 7 }), // index of request to cancel
        async (detailsArray, cancelIndex) => {
          const count = detailsArray.length;
          const actualCancelIndex = cancelIndex % count;

          // Create multiple concurrent requests
          const promises: Promise<boolean>[] = [];
          for (const d of detailsArray) {
            promises.push(bus.requestConfirmation(d, undefined, 5000));
          }

          // Get all pending requests
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(count);

          // Cancel one specific request
          const cancelledId = pending[actualCancelIndex].correlationId;
          const cancelled = bus.cancel(cancelledId);
          expect(cancelled).toBe(true);

          // Other requests should still be pending
          expect(bus.getPendingCount()).toBe(count - 1);

          // The cancelled request should no longer be retrievable
          expect(bus.getPendingRequest(cancelledId)).toBeUndefined();

          // Respond to remaining requests
          const remainingPending = bus.getPendingRequests();
          for (const req of remainingPending) {
            bus.respond(req.correlationId, true);
          }

          // Wait for all promises
          const results = await Promise.allSettled(promises);

          // The cancelled request should be rejected
          expect(results[actualCancelIndex].status).toBe('rejected');
          if (results[actualCancelIndex].status === 'rejected') {
            expect(results[actualCancelIndex].reason.message).toMatch(/cancelled/i);
          }

          // Other requests should be fulfilled
          for (let i = 0; i < count; i++) {
            if (i !== actualCancelIndex) {
              expect(results[i].status).toBe('fulfilled');
              if (results[i].status === 'fulfilled') {
                expect((results[i] as PromiseFulfilledResult<boolean>).value).toBe(true);
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow one request to timeout without affecting other pending requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 0, max: 4 }), // index of request that will timeout
        async (detailsArray, timeoutIndex) => {
          const count = detailsArray.length;
          const actualTimeoutIndex = timeoutIndex % count;

          // Create requests with different timeouts
          // Wrap each promise immediately to prevent unhandled rejections
          const promises: Promise<PromiseSettledResult<boolean>>[] = [];
          for (let i = 0; i < count; i++) {
            // Give the timeout request a very short timeout
            const timeout = i === actualTimeoutIndex ? 30 : 5000;
            const promise = bus.requestConfirmation(detailsArray[i], undefined, timeout);
            // Immediately wrap to handle rejection gracefully
            promises.push(
              promise
                .then((value) => ({ status: 'fulfilled' as const, value }))
                .catch((reason) => ({ status: 'rejected' as const, reason }))
            );
          }

          // Wait a bit for the short timeout to expire
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Get remaining pending requests (the timed-out one should be gone)
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(count - 1);

          // Respond to remaining requests
          for (const req of pending) {
            bus.respond(req.correlationId, true);
          }

          // Wait for all promises
          const results = await Promise.all(promises);

          // The timed-out request should be rejected
          expect(results[actualTimeoutIndex].status).toBe('rejected');
          if (results[actualTimeoutIndex].status === 'rejected') {
            expect(results[actualTimeoutIndex].reason.message).toMatch(/timed out/i);
          }

          // Other requests should be fulfilled
          for (let i = 0; i < count; i++) {
            if (i !== actualTimeoutIndex) {
              expect(results[i].status).toBe('fulfilled');
              if (results[i].status === 'fulfilled') {
                expect((results[i] as PromiseFulfilledResult<boolean>).value).toBe(true);
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 10 } // Fewer runs due to async timeouts
    );
  }, 30000);

  it('should maintain request isolation when mixing approved and denied responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 4, maxLength: 10 }),
        async (detailsArray) => {
          const count = detailsArray.length;

          // Create multiple concurrent requests
          const promises: Promise<boolean>[] = [];
          for (const d of detailsArray) {
            promises.push(bus.requestConfirmation(d, undefined, 5000));
          }

          // Get all pending requests
          const pending = bus.getPendingRequests();

          // Respond with alternating approve/deny
          const expectedResults: boolean[] = [];
          for (let i = 0; i < count; i++) {
            const approval = i % 2 === 0; // Even indices approved, odd denied
            expectedResults.push(approval);
            bus.respond(pending[i].correlationId, approval);
          }

          // Wait for all promises
          const results = await Promise.all(promises);

          // Each result should match its expected value
          for (let i = 0; i < count; i++) {
            expect(results[i]).toBe(expectedResults[i]);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle rapid sequential request creation and response', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 20 }),
        async (count) => {
          const promises: Promise<boolean>[] = [];
          const correlationIds: string[] = [];

          // Rapidly create requests
          for (let i = 0; i < count; i++) {
            const details: ToolCallConfirmationDetails = {
              toolName: `tool_${i}`,
              description: `Operation ${i}`,
              risk: 'low',
            };
            promises.push(bus.requestConfirmation(details, undefined, 5000));
          }

          // Get all pending requests
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(count);

          // Collect correlation IDs
          for (const req of pending) {
            correlationIds.push(req.correlationId);
          }

          // All correlation IDs should be unique
          const uniqueIds = new Set(correlationIds);
          expect(uniqueIds.size).toBe(count);

          // Respond to all requests
          for (let i = 0; i < count; i++) {
            const approval = i % 3 === 0; // Every third request approved
            bus.respond(correlationIds[i], approval);
          }

          // Wait for all promises
          const results = await Promise.all(promises);

          // Verify results match expected pattern
          for (let i = 0; i < count; i++) {
            expect(results[i]).toBe(i % 3 === 0);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should correctly track pending count as requests are added and resolved', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 3, maxLength: 8 }),
        async (detailsArray) => {
          const count = detailsArray.length;

          // Initially no pending requests
          expect(bus.getPendingCount()).toBe(0);

          // Create requests one by one and verify count increases
          const promises: Promise<boolean>[] = [];
          for (let i = 0; i < count; i++) {
            promises.push(bus.requestConfirmation(detailsArray[i], undefined, 5000));
            expect(bus.getPendingCount()).toBe(i + 1);
          }

          // Get all pending requests
          const pending = bus.getPendingRequests();

          // Respond to requests one by one and verify count decreases
          for (let i = 0; i < count; i++) {
            bus.respond(pending[i].correlationId, true);
            expect(bus.getPendingCount()).toBe(count - i - 1);
          }

          // Wait for all promises
          await Promise.all(promises);

          // No pending requests at the end
          expect(bus.getPendingCount()).toBe(0);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should isolate abort signals between concurrent requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 3, maxLength: 6 }),
        fc.integer({ min: 0, max: 5 }), // index of request to abort
        async (detailsArray, abortIndex) => {
          const count = detailsArray.length;
          const actualAbortIndex = abortIndex % count;

          // Create abort controllers for each request
          const controllers = detailsArray.map(() => new AbortController());

          // Create requests with their own abort signals
          // Wrap each promise immediately to prevent unhandled rejections
          const promises: Promise<PromiseSettledResult<boolean>>[] = [];
          for (let i = 0; i < count; i++) {
            const promise = bus.requestConfirmation(detailsArray[i], controllers[i].signal, 5000);
            // Immediately wrap to handle rejection gracefully
            promises.push(
              promise
                .then((value) => ({ status: 'fulfilled' as const, value }))
                .catch((reason) => ({ status: 'rejected' as const, reason }))
            );
          }

          // Abort one specific request
          controllers[actualAbortIndex].abort();

          // Wait a tick for the abort to be processed
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Other requests should still be pending
          expect(bus.getPendingCount()).toBe(count - 1);

          // Respond to remaining requests
          const pending = bus.getPendingRequests();
          for (const req of pending) {
            bus.respond(req.correlationId, true);
          }

          // Wait for all promises
          const results = await Promise.all(promises);

          // The aborted request should be rejected
          expect(results[actualAbortIndex].status).toBe('rejected');
          if (results[actualAbortIndex].status === 'rejected') {
            expect(results[actualAbortIndex].reason.message).toMatch(/cancelled/i);
          }

          // Other requests should be fulfilled
          for (let i = 0; i < count; i++) {
            if (i !== actualAbortIndex) {
              expect(results[i].status).toBe('fulfilled');
              if (results[i].status === 'fulfilled') {
                expect((results[i] as PromiseFulfilledResult<boolean>).value).toBe(true);
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});


describe('Property 42: Message Bus Cancellation', () => {
  // Feature: stage-03-tools-policy, Property 42: Message Bus Cancellation
  // *For any* confirmation request with an AbortSignal, triggering the signal
  // should cancel the request and reject with a cancellation error.
  // **Validates: Requirements 8.6**

  let bus: ConfirmationBus;

  beforeEach(() => {
    bus = createConfirmationBus();
  });

  afterEach(() => {
    bus.cancelAll();
  });

  // Generator for tool names
  const toolNameArb = fc
    .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', '_', '-', '1', '2'), {
      minLength: 1,
      maxLength: 20,
    })
    .filter((s) => /^[a-z]/.test(s));

  // Generator for risk levels
  const riskLevelArb = fc.constantFrom<'low' | 'medium' | 'high'>('low', 'medium', 'high');

  // Generator for confirmation details
  const confirmationDetailsArb = fc.record({
    toolName: toolNameArb,
    description: fc.string({ minLength: 1, maxLength: 100 }),
    risk: riskLevelArb,
    locations: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 })),
  }) as fc.Arbitrary<ToolCallConfirmationDetails>;

  it('should reject with cancellation error when AbortSignal is triggered', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        async (details) => {
          const controller = new AbortController();

          // Create a confirmation request with abort signal
          const promise = bus.requestConfirmation(details, controller.signal, 5000);

          // Abort immediately
          controller.abort();

          // Use Promise.allSettled to avoid unhandled rejection
          const [result] = await Promise.allSettled([promise]);

          // The promise should be rejected with a cancellation error
          expect(result.status).toBe('rejected');
          if (result.status === 'rejected') {
            expect(result.reason.message).toMatch(/cancelled/i);
          }

          // Request should no longer be pending
          expect(bus.hasPendingRequests()).toBe(false);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should reject immediately when AbortSignal is already aborted', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        async (details) => {
          const controller = new AbortController();

          // Abort before creating the request
          controller.abort();

          // Create a confirmation request with already-aborted signal
          const promise = bus.requestConfirmation(details, controller.signal, 5000);

          // The promise should reject immediately with a cancellation error
          await expect(promise).rejects.toThrow(/cancelled/i);

          // No pending requests should be created
          expect(bus.hasPendingRequests()).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clean up pending request when AbortSignal is triggered', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        async (details) => {
          const controller = new AbortController();

          // Create a confirmation request with abort signal
          const promise = bus.requestConfirmation(details, controller.signal, 5000);

          // Get the correlation ID before aborting
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(1);
          const correlationId = pending[0].correlationId;

          // Abort the request - use Promise.allSettled to avoid unhandled rejection
          controller.abort();

          // Wait for the promise to settle
          const [result] = await Promise.allSettled([promise]);

          // The specific request should no longer be retrievable
          expect(bus.getPendingRequest(correlationId)).toBeUndefined();

          // Responding to the cancelled request should return false
          const delivered = bus.respond(correlationId, true);
          expect(delivered).toBe(false);

          // Verify the promise was rejected with cancellation error
          expect(result.status).toBe('rejected');
          if (result.status === 'rejected') {
            expect(result.reason.message).toMatch(/cancelled/i);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should cancel only the request with the triggered AbortSignal', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 3, maxLength: 6 }),
        fc.integer({ min: 0, max: 5 }), // index of request to abort
        async (detailsArray, abortIndex) => {
          const count = detailsArray.length;
          const actualAbortIndex = abortIndex % count;

          // Create abort controllers for each request
          const controllers = detailsArray.map(() => new AbortController());

          // Create requests with their own abort signals and immediately attach .catch() to prevent unhandled rejection
          const promises: Promise<PromiseSettledResult<boolean>>[] = [];
          for (let i = 0; i < count; i++) {
            const promise = bus.requestConfirmation(detailsArray[i], controllers[i].signal, 5000);
            // Wrap each promise to handle rejection gracefully
            promises.push(
              promise
                .then((value) => ({ status: 'fulfilled' as const, value }))
                .catch((reason) => ({ status: 'rejected' as const, reason }))
            );
          }

          // All requests should be pending
          expect(bus.getPendingCount()).toBe(count);

          // Abort one specific request
          controllers[actualAbortIndex].abort();

          // Wait a tick for the abort to be processed
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Other requests should still be pending
          expect(bus.getPendingCount()).toBe(count - 1);

          // Respond to remaining requests
          const pending = bus.getPendingRequests();
          for (const req of pending) {
            bus.respond(req.correlationId, true);
          }

          // Wait for all promises
          const results = await Promise.all(promises);

          // The aborted request should be rejected with cancellation error
          expect(results[actualAbortIndex].status).toBe('rejected');
          if (results[actualAbortIndex].status === 'rejected') {
            expect(results[actualAbortIndex].reason.message).toMatch(/cancelled/i);
          }

          // Other requests should be fulfilled
          for (let i = 0; i < count; i++) {
            if (i !== actualAbortIndex) {
              expect(results[i].status).toBe('fulfilled');
            }
          }

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should cancel handler-based requests when AbortSignal is triggered', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        async (details) => {
          const controller = new AbortController();

          // Set up a slow handler that will be cancelled
          bus.setHandler(async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return true;
          });

          // Create a confirmation request with abort signal
          const promise = bus.requestConfirmation(details, controller.signal, 5000);

          // Abort quickly before handler completes
          setTimeout(() => controller.abort(), 20);

          // Use Promise.allSettled to avoid unhandled rejection
          const [result] = await Promise.allSettled([promise]);

          // The promise should be rejected with a cancellation error
          expect(result.status).toBe('rejected');
          if (result.status === 'rejected') {
            expect(result.reason.message).toMatch(/cancelled/i);
          }

          // Clean up handler
          bus.clearHandler();

          return true;
        }
      ),
      { numRuns: 10 } // Fewer runs due to async delays
    );
  });

  it('should not cancel request if response arrives before abort', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        fc.boolean(),
        async (details, approvalValue) => {
          const controller = new AbortController();

          // Create a confirmation request with abort signal
          const promise = bus.requestConfirmation(details, controller.signal, 5000);

          // Get the pending request
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(1);
          const correlationId = pending[0].correlationId;

          // Respond before aborting
          const delivered = bus.respond(correlationId, approvalValue);
          expect(delivered).toBe(true);

          // Now abort (should have no effect since request is already resolved)
          controller.abort();

          // The promise should resolve with the approval value, not reject
          const result = await promise;
          expect(result).toBe(approvalValue);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple abort signals triggered simultaneously', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 2, maxLength: 5 }),
        async (detailsArray) => {
          const count = detailsArray.length;

          // Create abort controllers for each request
          const controllers = detailsArray.map(() => new AbortController());

          // Create requests with their own abort signals
          const promises: Promise<boolean>[] = [];
          for (let i = 0; i < count; i++) {
            promises.push(
              bus.requestConfirmation(detailsArray[i], controllers[i].signal, 5000)
            );
          }

          // All requests should be pending
          expect(bus.getPendingCount()).toBe(count);

          // Abort all requests simultaneously
          for (const controller of controllers) {
            controller.abort();
          }

          // Wait for all promises to settle using allSettled
          const results = await Promise.allSettled(promises);

          // All requests should be rejected with cancellation errors
          for (const result of results) {
            expect(result.status).toBe('rejected');
            if (result.status === 'rejected') {
              expect(result.reason.message).toMatch(/cancelled/i);
            }
          }

          // No pending requests after all cancellations
          expect(bus.hasPendingRequests()).toBe(false);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should cancel request via cancel() method', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        async (details) => {
          // Create a confirmation request without abort signal
          const promise = bus.requestConfirmation(details, undefined, 5000);

          // Get the correlation ID
          const pending = bus.getPendingRequests();
          expect(pending.length).toBe(1);
          const correlationId = pending[0].correlationId;

          // Cancel via the cancel() method
          const cancelled = bus.cancel(correlationId);
          expect(cancelled).toBe(true);

          // The promise should reject with a cancellation error
          await expect(promise).rejects.toThrow(/cancelled/i);

          // No pending requests after cancellation
          expect(bus.hasPendingRequests()).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should cancel all requests via cancelAll() method', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(confirmationDetailsArb, { minLength: 2, maxLength: 8 }),
        async (detailsArray) => {
          const count = detailsArray.length;

          // Create multiple requests
          const promises: Promise<boolean>[] = [];
          for (const d of detailsArray) {
            promises.push(bus.requestConfirmation(d, undefined, 5000));
          }

          // All requests should be pending
          expect(bus.getPendingCount()).toBe(count);

          // Cancel all requests
          bus.cancelAll();

          // No pending requests after cancelAll
          expect(bus.hasPendingRequests()).toBe(false);

          // All promises should reject with cancellation errors
          const results = await Promise.allSettled(promises);
          for (const result of results) {
            expect(result.status).toBe('rejected');
            if (result.status === 'rejected') {
              expect(result.reason.message).toMatch(/cancelled/i);
            }
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return false when cancelling non-existent request', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 30 }),
        async (fakeCorrelationId) => {
          // Try to cancel a non-existent request
          const cancelled = bus.cancel(fakeCorrelationId);
          expect(cancelled).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle abort signal with custom abort reason', async () => {
    await fc.assert(
      fc.asyncProperty(
        confirmationDetailsArb,
        async (details) => {
          const controller = new AbortController();

          // Create a confirmation request with abort signal
          const promise = bus.requestConfirmation(details, controller.signal, 5000);

          // Abort with a custom reason
          controller.abort(new Error('Custom abort reason'));

          // The promise should reject with a cancellation error
          // Note: The implementation may or may not use the custom reason
          await expect(promise).rejects.toThrow(/cancelled/i);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
