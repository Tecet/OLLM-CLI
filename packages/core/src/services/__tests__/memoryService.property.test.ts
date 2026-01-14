/**
 * Property-based tests for Memory Service
 * Feature: stage-07-model-management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { MemoryService, type MemoryCategory, type MemorySource } from '../memoryService.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Memory Service Properties', () => {
  let tempDir: string;
  let memoryPath: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `ollm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    memoryPath = join(tempDir, 'memory.json');
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Property 20: Memory persistence round-trip
   * For any memory entry stored via remember, it should be persisted to disk
   * and retrievable via recall after service restart
   * Validates: Requirements 11.1, 11.2, 12.1, 12.2
   */
  it('Property 20: Memory persistence round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            value: fc.string({ minLength: 1, maxLength: 200 }),
            category: fc.constantFrom<MemoryCategory>('fact', 'preference', 'context'),
            source: fc.constantFrom<MemorySource>('user', 'llm', 'system'),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (memoriesRaw) => {
          // Ensure unique keys by deduplicating
          const uniqueMemories = Array.from(
            new Map(memoriesRaw.map(m => [m.key, m])).values()
          );

          // Create service and store memories
          const service1 = new MemoryService({ memoryPath });
          await service1.load();

          for (const mem of uniqueMemories) {
            service1.remember(mem.key, mem.value, {
              category: mem.category,
              source: mem.source,
            });
          }

          await service1.save();

          // Create new service instance and load
          const service2 = new MemoryService({ memoryPath });
          await service2.load();

          // All memories should be retrievable
          for (const mem of uniqueMemories) {
            const recalled = service2.recall(mem.key);
            expect(recalled).not.toBeNull();
            if (recalled) {
              expect(recalled.key).toBe(mem.key);
              expect(recalled.value).toBe(mem.value);
              expect(recalled.category).toBe(mem.category);
              expect(recalled.source).toBe(mem.source);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23: Memory metadata tracking
   * For any memory entry accessed via recall, the access count should increment
   * and the timestamp should update
   * Validates: Requirements 11.5
   */
  it('Property 23: Memory metadata tracking', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          key: fc.string({ minLength: 1, maxLength: 50 }),
          value: fc.string({ minLength: 1, maxLength: 200 }),
          accessCount: fc.integer({ min: 1, max: 10 }),
        }),
        async ({ key, value, accessCount }) => {
          const service = new MemoryService({ memoryPath });
          await service.load();

          // Store memory
          service.remember(key, value);

          // Access it multiple times
          let lastUpdatedAt: Date | undefined;
          for (let i = 0; i < accessCount; i++) {
            const recalled = service.recall(key);
            expect(recalled).not.toBeNull();
            if (recalled) {
              expect(recalled.accessCount).toBe(i + 1);
              if (lastUpdatedAt) {
                expect(recalled.updatedAt.getTime()).toBeGreaterThanOrEqual(
                  lastUpdatedAt.getTime()
                );
              }
              lastUpdatedAt = recalled.updatedAt;
            }
          }

          // Final access count should match
          const final = service.recall(key);
          expect(final?.accessCount).toBe(accessCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24: Memory search
   * For any search query, the search method should return all memory entries
   * where the key or value contains the query string
   * Validates: Requirements 12.3
   */
  it('Property 24: Memory search', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          memories: fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 50 }),
              value: fc.string({ minLength: 1, maxLength: 200 }),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          searchQuery: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async ({ memories, searchQuery }) => {
          const service = new MemoryService({ memoryPath });
          await service.load();

          // Store all memories
          for (const mem of memories) {
            service.remember(mem.key, mem.value);
          }

          // Search
          const results = service.search(searchQuery);

          // All results should contain the query in key or value
          for (const result of results) {
            const matchesKey = result.key
              .toLowerCase()
              .includes(searchQuery.toLowerCase());
            const matchesValue = result.value
              .toLowerCase()
              .includes(searchQuery.toLowerCase());
            expect(matchesKey || matchesValue).toBe(true);
          }

          // All matching memories should be in results
          const expectedMatches = memories.filter(
            (mem) =>
              mem.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
              mem.value.toLowerCase().includes(searchQuery.toLowerCase())
          );

          expect(results.length).toBe(expectedMatches.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 25: Memory deletion
   * For any memory entry, calling forget should remove it such that recall returns null
   * Validates: Requirements 12.4
   */
  it('Property 25: Memory deletion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            value: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (memoriesRaw) => {
          // Ensure unique keys by deduplicating
          const memories = Array.from(
            new Map(memoriesRaw.map(m => [m.key, m])).values()
          );

          // Skip if we don't have at least 2 unique memories
          if (memories.length < 2) {
            return true;
          }

          const service = new MemoryService({ memoryPath });
          await service.load();

          // Store all memories
          for (const mem of memories) {
            service.remember(mem.key, mem.value);
          }

          // Delete first memory
          const toDelete = memories[0];
          service.forget(toDelete.key);

          // Should not be recallable
          const recalled = service.recall(toDelete.key);
          expect(recalled).toBeNull();

          // Other memories should still exist
          for (let i = 1; i < memories.length; i++) {
            const other = service.recall(memories[i].key);
            expect(other).not.toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 26: Memory listing
   * For any set of stored memories, listAll should return all Memory_Entry objects
   * Validates: Requirements 12.5
   */
  it('Property 26: Memory listing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        async (memories) => {
          const service = new MemoryService({ memoryPath });
          await service.load();

          // Store all memories
          for (const mem of memories) {
            service.remember(mem.key, mem.value);
          }

          // List all
          const listed = service.listAll();

          // Should have same count
          expect(listed.length).toBe(memories.length);

          // All stored memories should be in the list
          for (const mem of memories) {
            const found = listed.find((l) => l.key === mem.key);
            expect(found).toBeDefined();
            if (found) {
              expect(found.value).toBe(mem.value);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 28: Memory categorization
   * For any memory stored with a category (fact, preference, context), the category
   * should be preserved in the Memory_Entry
   * Validates: Requirements 13.4
   */
  it('Property 28: Memory categorization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.string({ minLength: 1, maxLength: 200 }),
            category: fc.constantFrom<MemoryCategory>('fact', 'preference', 'context'),
          }),
          {
            minLength: 1,
            maxLength: 20,
            selector: (item) => item.key, // Ensure unique keys
          }
        ),
        async (memories) => {
          const service = new MemoryService({ memoryPath });
          await service.load();

          // Store all memories with categories
          for (const mem of memories) {
            service.remember(mem.key, mem.value, { category: mem.category });
          }

          // Verify categories are preserved
          for (const mem of memories) {
            const recalled = service.recall(mem.key);
            expect(recalled).not.toBeNull();
            if (recalled) {
              expect(recalled.category).toBe(mem.category);
            }
          }

          // Save and reload to verify persistence
          await service.save();
          const service2 = new MemoryService({ memoryPath });
          await service2.load();

          for (const mem of memories) {
            const recalled = service2.recall(mem.key);
            expect(recalled).not.toBeNull();
            if (recalled) {
              expect(recalled.category).toBe(mem.category);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
