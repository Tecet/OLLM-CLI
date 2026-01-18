/**
 * Tests for Memory Tool
 *
 * Property-based tests for persistent key-value storage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MemoryTool, MemoryInvocation } from '../memory.js';
import { MockMessageBus, createMockAbortSignal , createToolContext} from './test-helpers.js';

/**
 * Test fixture for memory operations
 */
class MemoryTestFixture {
  private tempDir: string = '';
  private storePath: string = '';

  async setup(): Promise<void> {
    // Create a temporary directory for test files
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'memory-test-'));
    this.storePath = path.join(this.tempDir, 'memory.json');
  }

  async cleanup(): Promise<void> {
    // Clean up the temp directory
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore
    }
  }

  getStorePath(): string {
    return this.storePath;
  }

  getTempDir(): string {
    return this.tempDir;
  }

  /**
   * Get a unique store path for isolated tests
   */
  getUniqueStorePath(): string {
    return path.join(this.tempDir, `memory-${Date.now()}-${Math.random().toString(36).substring(7)}.json`);
  }
}

/**
 * Filter for valid memory keys
 * Keys should be non-empty strings without special characters that could cause issues
 */
function isValidKey(s: string): boolean {
  // Filter out empty strings and strings with only whitespace
  if (s.trim().length === 0) return false;
  // Filter out keys with newlines or control characters
  if (/[\n\r\t\0]/.test(s)) return false;
  // Limit key length for practical testing
  if (s.length > 100) return false;
  return true;
}

/**
 * Filter for valid memory values
 * Values can be any string but we filter out extremely long ones for testing
 */
function isValidValue(s: string): boolean {
  // Limit value length for practical testing
  if (s.length > 1000) return false;
  return true;
}

describe('Memory Tool', () => {
  let fixture: MemoryTestFixture;
  let messageBus: MockMessageBus;

  beforeEach(async () => {
    fixture = new MemoryTestFixture();
    await fixture.setup();
    messageBus = new MockMessageBus();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Property 50: Memory Storage Round Trip', () => {
    it('should store and retrieve any key-value pair correctly', async () => {
      // Feature: stage-03-tools-policy, Property 50: Memory Storage Round Trip
      // **Validates: Requirements 11.1, 11.2**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(isValidKey),
          fc.string({ minLength: 0, maxLength: 500 }).filter(isValidValue),
          async (key, value) => {
            // Use a unique store path for each test iteration to avoid interference
            const storePath = fixture.getUniqueStorePath();
            const tool = new MemoryTool(storePath);

            // Step 1: Store the value
            const setInvocation = tool.createInvocation(
              { action: 'set', key, value },
              createToolContext(messageBus)
            );
            const setResult = await setInvocation.execute(createMockAbortSignal());

            // Set should succeed without error
            expect(setResult.error).toBeUndefined();
            expect(setResult.llmContent).toContain('Stored');
            expect(setResult.llmContent).toContain(key);

            // Step 2: Retrieve the value
            const getInvocation = tool.createInvocation(
              { action: 'get', key },
              createToolContext(messageBus)
            );
            const getResult = await getInvocation.execute(createMockAbortSignal());

            // Get should succeed without error
            expect(getResult.error).toBeUndefined();

            // The retrieved value should match exactly what was stored
            expect(getResult.llmContent).toBe(value);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist data to disk and survive tool recreation', async () => {
      // Feature: stage-03-tools-policy, Property 50: Memory Storage Round Trip
      // **Validates: Requirements 11.1, 11.2**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(isValidKey),
          fc.string({ minLength: 0, maxLength: 500 }).filter(isValidValue),
          async (key, value) => {
            const storePath = fixture.getUniqueStorePath();

            // Create first tool instance and store value
            const tool1 = new MemoryTool(storePath);
            const setInvocation = tool1.createInvocation(
              { action: 'set', key, value },
              createToolContext(messageBus)
            );
            const setResult = await setInvocation.execute(createMockAbortSignal());
            expect(setResult.error).toBeUndefined();

            // Create a NEW tool instance pointing to the same store
            const tool2 = new MemoryTool(storePath);
            const getInvocation = tool2.createInvocation(
              { action: 'get', key },
              createToolContext(messageBus)
            );
            const getResult = await getInvocation.execute(createMockAbortSignal());

            // Should retrieve the same value from the new instance
            expect(getResult.error).toBeUndefined();
            expect(getResult.llmContent).toBe(value);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple key-value pairs independently', async () => {
      // Feature: stage-03-tools-policy, Property 50: Memory Storage Round Trip
      // **Validates: Requirements 11.1, 11.2**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 30 }).filter(isValidKey),
              fc.string({ minLength: 0, maxLength: 200 }).filter(isValidValue)
            ),
            { minLength: 1, maxLength: 10 }
          ),
          async (pairs) => {
            const storePath = fixture.getUniqueStorePath();
            const tool = new MemoryTool(storePath);

            // Deduplicate keys (keep last value for each key)
            const uniquePairs = new Map(pairs);

            // Store all key-value pairs
            for (const [key, value] of uniquePairs) {
              const setInvocation = tool.createInvocation(
                { action: 'set', key, value },
                createToolContext(messageBus)
              );
              const setResult = await setInvocation.execute(createMockAbortSignal());
              expect(setResult.error).toBeUndefined();
            }

            // Retrieve all values and verify they match
            for (const [key, expectedValue] of uniquePairs) {
              const getInvocation = tool.createInvocation(
                { action: 'get', key },
                createToolContext(messageBus)
              );
              const getResult = await getInvocation.execute(createMockAbortSignal());
              expect(getResult.error).toBeUndefined();
              expect(getResult.llmContent).toBe(expectedValue);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return "Key not found" for non-existent keys', async () => {
      // Feature: stage-03-tools-policy, Property 50: Memory Storage Round Trip
      // **Validates: Requirements 11.2**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(isValidKey),
          async (key) => {
            const storePath = fixture.getUniqueStorePath();
            const tool = new MemoryTool(storePath);

            // Try to get a key that was never set
            const getInvocation = tool.createInvocation(
              { action: 'get', key },
              createToolContext(messageBus)
            );
            const getResult = await getInvocation.execute(createMockAbortSignal());

            // Should not have an error, but should indicate key not found
            expect(getResult.error).toBeUndefined();
            expect(getResult.llmContent).toContain('Key not found');
            expect(getResult.llmContent).toContain(key);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should overwrite existing values with the same key', async () => {
      // Feature: stage-03-tools-policy, Property 50: Memory Storage Round Trip
      // **Validates: Requirements 11.1, 11.2**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(isValidKey),
          fc.string({ minLength: 0, maxLength: 200 }).filter(isValidValue),
          fc.string({ minLength: 0, maxLength: 200 }).filter(isValidValue),
          async (key, value1, value2) => {
            const storePath = fixture.getUniqueStorePath();
            const tool = new MemoryTool(storePath);

            // Store first value
            const set1 = tool.createInvocation(
              { action: 'set', key, value: value1 },
              createToolContext(messageBus)
            );
            await set1.execute(createMockAbortSignal());

            // Store second value with same key
            const set2 = tool.createInvocation(
              { action: 'set', key, value: value2 },
              createToolContext(messageBus)
            );
            await set2.execute(createMockAbortSignal());

            // Retrieve should return the second value
            const getInvocation = tool.createInvocation(
              { action: 'get', key },
              createToolContext(messageBus)
            );
            const getResult = await getInvocation.execute(createMockAbortSignal());

            expect(getResult.error).toBeUndefined();
            expect(getResult.llmContent).toBe(value2);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 51: Memory Deletion', () => {
    it('should delete a stored key and make it not found on subsequent retrieval', async () => {
      // Feature: stage-03-tools-policy, Property 51: Memory Deletion
      // **Validates: Requirements 11.3**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(isValidKey),
          fc.string({ minLength: 0, maxLength: 500 }).filter(isValidValue),
          async (key, value) => {
            const storePath = fixture.getUniqueStorePath();
            const tool = new MemoryTool(storePath);

            // Step 1: Store a value
            const setInvocation = tool.createInvocation(
              { action: 'set', key, value },
              createToolContext(messageBus)
            );
            const setResult = await setInvocation.execute(createMockAbortSignal());
            expect(setResult.error).toBeUndefined();

            // Step 2: Verify the value is stored
            const getBeforeDelete = tool.createInvocation(
              { action: 'get', key },
              createToolContext(messageBus)
            );
            const getBeforeResult = await getBeforeDelete.execute(createMockAbortSignal());
            expect(getBeforeResult.error).toBeUndefined();
            expect(getBeforeResult.llmContent).toBe(value);

            // Step 3: Delete the key
            const deleteInvocation = tool.createInvocation(
              { action: 'delete', key },
              createToolContext(messageBus)
            );
            const deleteResult = await deleteInvocation.execute(createMockAbortSignal());
            expect(deleteResult.error).toBeUndefined();
            expect(deleteResult.llmContent).toContain('Deleted');
            expect(deleteResult.llmContent).toContain(key);

            // Step 4: Verify the key is no longer found
            const getAfterDelete = tool.createInvocation(
              { action: 'get', key },
              createToolContext(messageBus)
            );
            const getAfterResult = await getAfterDelete.execute(createMockAbortSignal());
            expect(getAfterResult.error).toBeUndefined();
            expect(getAfterResult.llmContent).toContain('Key not found');
            expect(getAfterResult.llmContent).toContain(key);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist deletion across tool recreation', async () => {
      // Feature: stage-03-tools-policy, Property 51: Memory Deletion
      // **Validates: Requirements 11.3**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(isValidKey),
          fc.string({ minLength: 0, maxLength: 500 }).filter(isValidValue),
          async (key, value) => {
            const storePath = fixture.getUniqueStorePath();

            // Create first tool instance and store value
            const tool1 = new MemoryTool(storePath);
            const setInvocation = tool1.createInvocation(
              { action: 'set', key, value },
              createToolContext(messageBus)
            );
            await setInvocation.execute(createMockAbortSignal());

            // Delete the key
            const deleteInvocation = tool1.createInvocation(
              { action: 'delete', key },
              createToolContext(messageBus)
            );
            await deleteInvocation.execute(createMockAbortSignal());

            // Create a NEW tool instance pointing to the same store
            const tool2 = new MemoryTool(storePath);
            const getInvocation = tool2.createInvocation(
              { action: 'get', key },
              createToolContext(messageBus)
            );
            const getResult = await getInvocation.execute(createMockAbortSignal());

            // Should indicate key not found from the new instance
            expect(getResult.error).toBeUndefined();
            expect(getResult.llmContent).toContain('Key not found');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only delete the specified key and leave others intact', async () => {
      // Feature: stage-03-tools-policy, Property 51: Memory Deletion
      // **Validates: Requirements 11.3**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 30 }).filter(isValidKey),
              fc.string({ minLength: 0, maxLength: 200 }).filter(isValidValue)
            ),
            { minLength: 2, maxLength: 10 }
          ),
          async (pairs) => {
            const storePath = fixture.getUniqueStorePath();
            const tool = new MemoryTool(storePath);

            // Deduplicate keys (keep last value for each key)
            const uniquePairs = new Map(pairs);
            
            // Need at least 2 unique keys for this test
            if (uniquePairs.size < 2) {
              return true; // Skip this iteration
            }

            // Store all key-value pairs
            for (const [key, value] of uniquePairs) {
              const setInvocation = tool.createInvocation(
                { action: 'set', key, value },
                createToolContext(messageBus)
              );
              await setInvocation.execute(createMockAbortSignal());
            }

            // Pick the first key to delete
            const keysArray = Array.from(uniquePairs.keys());
            const keyToDelete = keysArray[0];
            const remainingKeys = keysArray.slice(1);

            // Delete the first key
            const deleteInvocation = tool.createInvocation(
              { action: 'delete', key: keyToDelete },
              createToolContext(messageBus)
            );
            const deleteResult = await deleteInvocation.execute(createMockAbortSignal());
            expect(deleteResult.error).toBeUndefined();

            // Verify deleted key is not found
            const getDeleted = tool.createInvocation(
              { action: 'get', key: keyToDelete },
              createToolContext(messageBus)
            );
            const getDeletedResult = await getDeleted.execute(createMockAbortSignal());
            expect(getDeletedResult.llmContent).toContain('Key not found');

            // Verify remaining keys are still intact
            for (const key of remainingKeys) {
              const getInvocation = tool.createInvocation(
                { action: 'get', key },
                createToolContext(messageBus)
              );
              const getResult = await getInvocation.execute(createMockAbortSignal());
              expect(getResult.error).toBeUndefined();
              expect(getResult.llmContent).toBe(uniquePairs.get(key));
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return "Key not found" when deleting a non-existent key', async () => {
      // Feature: stage-03-tools-policy, Property 51: Memory Deletion
      // **Validates: Requirements 11.3**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(isValidKey),
          async (key) => {
            const storePath = fixture.getUniqueStorePath();
            const tool = new MemoryTool(storePath);

            // Try to delete a key that was never set
            const deleteInvocation = tool.createInvocation(
              { action: 'delete', key },
              createToolContext(messageBus)
            );
            const deleteResult = await deleteInvocation.execute(createMockAbortSignal());

            // Should not have an error, but should indicate key not found
            expect(deleteResult.error).toBeUndefined();
            expect(deleteResult.llmContent).toContain('Key not found');
            expect(deleteResult.llmContent).toContain(key);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 52: Memory Key Listing', () => {
    it('should list all stored keys correctly', async () => {
      // Feature: stage-03-tools-policy, Property 52: Memory Key Listing
      // **Validates: Requirements 11.4**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 30 }).filter(isValidKey),
              fc.string({ minLength: 0, maxLength: 200 }).filter(isValidValue)
            ),
            { minLength: 0, maxLength: 10 }
          ),
          async (pairs) => {
            const storePath = fixture.getUniqueStorePath();
            const tool = new MemoryTool(storePath);

            // Deduplicate keys (keep last value for each key)
            const uniquePairs = new Map(pairs);
            const expectedKeys = Array.from(uniquePairs.keys()).sort();

            // Store all key-value pairs
            for (const [key, value] of uniquePairs) {
              const setInvocation = tool.createInvocation(
                { action: 'set', key, value },
                createToolContext(messageBus)
              );
              const setResult = await setInvocation.execute(createMockAbortSignal());
              expect(setResult.error).toBeUndefined();
            }

            // List all keys
            const listInvocation = tool.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // Should succeed without error
            expect(listResult.error).toBeUndefined();

            // Verify the listed keys match exactly
            if (expectedKeys.length === 0) {
              expect(listResult.llmContent).toBe('No keys stored');
            } else {
              const listedKeys = listResult.llmContent.split('\n').sort();
              expect(listedKeys).toEqual(expectedKeys);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return keys in sorted order', async () => {
      // Feature: stage-03-tools-policy, Property 52: Memory Key Listing
      // **Validates: Requirements 11.4**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 30 }).filter(isValidKey),
              fc.string({ minLength: 0, maxLength: 200 }).filter(isValidValue)
            ),
            { minLength: 2, maxLength: 10 }
          ),
          async (pairs) => {
            const storePath = fixture.getUniqueStorePath();
            const tool = new MemoryTool(storePath);

            // Deduplicate keys (keep last value for each key)
            const uniquePairs = new Map(pairs);
            
            // Need at least 2 unique keys for this test
            if (uniquePairs.size < 2) {
              return true; // Skip this iteration
            }

            // Store all key-value pairs
            for (const [key, value] of uniquePairs) {
              const setInvocation = tool.createInvocation(
                { action: 'set', key, value },
                createToolContext(messageBus)
              );
              await setInvocation.execute(createMockAbortSignal());
            }

            // List all keys
            const listInvocation = tool.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // Verify keys are sorted
            const listedKeys = listResult.llmContent.split('\n');
            const sortedKeys = [...listedKeys].sort();
            expect(listedKeys).toEqual(sortedKeys);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reflect deletions in the key list', async () => {
      // Feature: stage-03-tools-policy, Property 52: Memory Key Listing
      // **Validates: Requirements 11.4**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 30 }).filter(isValidKey),
              fc.string({ minLength: 0, maxLength: 200 }).filter(isValidValue)
            ),
            { minLength: 2, maxLength: 10 }
          ),
          async (pairs) => {
            const storePath = fixture.getUniqueStorePath();
            const tool = new MemoryTool(storePath);

            // Deduplicate keys (keep last value for each key)
            const uniquePairs = new Map(pairs);
            
            // Need at least 2 unique keys for this test
            if (uniquePairs.size < 2) {
              return true; // Skip this iteration
            }

            // Store all key-value pairs
            for (const [key, value] of uniquePairs) {
              const setInvocation = tool.createInvocation(
                { action: 'set', key, value },
                createToolContext(messageBus)
              );
              await setInvocation.execute(createMockAbortSignal());
            }

            // Pick the first key to delete
            const keysArray = Array.from(uniquePairs.keys());
            const keyToDelete = keysArray[0];
            const remainingKeys = keysArray.slice(1).sort();

            // Delete the first key
            const deleteInvocation = tool.createInvocation(
              { action: 'delete', key: keyToDelete },
              createToolContext(messageBus)
            );
            await deleteInvocation.execute(createMockAbortSignal());

            // List all keys
            const listInvocation = tool.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // Verify the deleted key is not in the list
            const listedKeys = listResult.llmContent.split('\n').sort();
            expect(listedKeys).toEqual(remainingKeys);
            expect(listedKeys).not.toContain(keyToDelete);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty message for empty store', async () => {
      // Feature: stage-03-tools-policy, Property 52: Memory Key Listing
      // **Validates: Requirements 11.4**
      const storePath = fixture.getUniqueStorePath();
      const tool = new MemoryTool(storePath);

      // List keys from empty store
      const listInvocation = tool.createInvocation(
        { action: 'list' },
        createToolContext(messageBus)
      );
      const listResult = await listInvocation.execute(createMockAbortSignal());

      expect(listResult.error).toBeUndefined();
      expect(listResult.llmContent).toBe('No keys stored');
      expect(listResult.returnDisplay).toBe('0 keys');
    });

    it('should show correct count in returnDisplay', async () => {
      // Feature: stage-03-tools-policy, Property 52: Memory Key Listing
      // **Validates: Requirements 11.4**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 30 }).filter(isValidKey),
              fc.string({ minLength: 0, maxLength: 200 }).filter(isValidValue)
            ),
            { minLength: 1, maxLength: 10 }
          ),
          async (pairs) => {
            const storePath = fixture.getUniqueStorePath();
            const tool = new MemoryTool(storePath);

            // Deduplicate keys (keep last value for each key)
            const uniquePairs = new Map(pairs);
            const expectedCount = uniquePairs.size;

            // Store all key-value pairs
            for (const [key, value] of uniquePairs) {
              const setInvocation = tool.createInvocation(
                { action: 'set', key, value },
                createToolContext(messageBus)
              );
              await setInvocation.execute(createMockAbortSignal());
            }

            // List all keys
            const listInvocation = tool.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // Verify the count in returnDisplay
            expect(listResult.returnDisplay).toContain(`${expectedCount}`);
            if (expectedCount === 1) {
              expect(listResult.returnDisplay).toBe('1 key');
            } else {
              expect(listResult.returnDisplay).toBe(`${expectedCount} keys`);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist key listing across tool recreation', async () => {
      // Feature: stage-03-tools-policy, Property 52: Memory Key Listing
      // **Validates: Requirements 11.4**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 30 }).filter(isValidKey),
              fc.string({ minLength: 0, maxLength: 200 }).filter(isValidValue)
            ),
            { minLength: 1, maxLength: 10 }
          ),
          async (pairs) => {
            const storePath = fixture.getUniqueStorePath();

            // Deduplicate keys (keep last value for each key)
            const uniquePairs = new Map(pairs);
            const expectedKeys = Array.from(uniquePairs.keys()).sort();

            // Create first tool instance and store values
            const tool1 = new MemoryTool(storePath);
            for (const [key, value] of uniquePairs) {
              const setInvocation = tool1.createInvocation(
                { action: 'set', key, value },
                createToolContext(messageBus)
              );
              await setInvocation.execute(createMockAbortSignal());
            }

            // Create a NEW tool instance pointing to the same store
            const tool2 = new MemoryTool(storePath);
            const listInvocation = tool2.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // Should list the same keys from the new instance
            expect(listResult.error).toBeUndefined();
            const listedKeys = listResult.llmContent.split('\n').sort();
            expect(listedKeys).toEqual(expectedKeys);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Basic Functionality', () => {
    it('should handle empty store gracefully', async () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const invocation = tool.createInvocation(
        { action: 'get', key: 'nonexistent' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toContain('Key not found');
    });

    it('should handle special characters in values', async () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);
      const specialValue = 'Line 1\nLine 2\n\tTabbed\n"Quoted"\n{json: true}';

      const setInvocation = tool.createInvocation(
        { action: 'set', key: 'special', value: specialValue },
        createToolContext(messageBus)
      );
      await setInvocation.execute(createMockAbortSignal());

      const getInvocation = tool.createInvocation(
        { action: 'get', key: 'special' },
        createToolContext(messageBus)
      );
      const result = await getInvocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toBe(specialValue);
    });

    it('should handle empty string values', async () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const setInvocation = tool.createInvocation(
        { action: 'set', key: 'empty', value: '' },
        createToolContext(messageBus)
      );
      await setInvocation.execute(createMockAbortSignal());

      const getInvocation = tool.createInvocation(
        { action: 'get', key: 'empty' },
        createToolContext(messageBus)
      );
      const result = await getInvocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toBe('');
    });
  });

  describe('Error Handling', () => {
    it('should return error when key is missing for get action', async () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const invocation = tool.createInvocation(
        { action: 'get' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
      expect(result.error?.message).toContain('Key required');
    });

    it('should return error when key is missing for set action', async () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const invocation = tool.createInvocation(
        { action: 'set', value: 'test' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
      expect(result.error?.message).toContain('Key required');
    });

    it('should return error when value is missing for set action', async () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const invocation = tool.createInvocation(
        { action: 'set', key: 'test' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
      expect(result.error?.message).toContain('Value required');
    });

    it('should handle abort signal', async () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const controller = new AbortController();
      controller.abort();

      const invocation = tool.createInvocation(
        { action: 'set', key: 'test', value: 'value' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(controller.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('cancelled');
    });
  });

  describe('Tool Interface', () => {
    it('should provide correct description for get action', () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const invocation = tool.createInvocation(
        { action: 'get', key: 'mykey' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();
      expect(description).toContain('Memory');
      expect(description).toContain('get');
      expect(description).toContain('mykey');
    });

    it('should provide correct description for set action', () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const invocation = tool.createInvocation(
        { action: 'set', key: 'mykey', value: 'myvalue' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();
      expect(description).toContain('Memory');
      expect(description).toContain('set');
      expect(description).toContain('mykey');
    });

    it('should return correct tool locations', () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const invocation = tool.createInvocation(
        { action: 'get', key: 'test' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();
      expect(locations).toEqual([storePath]);
    });

    it('should not require confirmation', async () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const invocation = tool.createInvocation(
        { action: 'set', key: 'test', value: 'value' },
        createToolContext(messageBus)
      );

      const confirmation = await invocation.shouldConfirmExecute(
        createMockAbortSignal()
      );
      expect(confirmation).toBe(false);
    });
  });

  describe('Tool Schema', () => {
    it('should have correct schema structure', () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      expect(tool.name).toBe('memory');
      expect(tool.displayName).toBe('Persistent Memory');
      expect(tool.schema.name).toBe('memory');
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.parameters).toBeDefined();
    });

    it('should have required action parameter', () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const params = tool.schema.parameters as any;
      expect(params.properties.action).toBeDefined();
      expect(params.properties.action.enum).toContain('get');
      expect(params.properties.action.enum).toContain('set');
      expect(params.properties.action.enum).toContain('delete');
      expect(params.properties.action.enum).toContain('list');
      expect(params.required).toContain('action');
    });

    it('should have optional key and value parameters', () => {
      const storePath = fixture.getStorePath();
      const tool = new MemoryTool(storePath);

      const params = tool.schema.parameters as any;
      expect(params.properties.key).toBeDefined();
      expect(params.properties.value).toBeDefined();
      expect(params.required).not.toContain('key');
      expect(params.required).not.toContain('value');
    });
  });
});
