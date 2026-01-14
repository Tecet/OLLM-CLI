/**
 * Property-based tests for Memory Service System Prompt Injection
 * Feature: stage-07-model-management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { MemoryService } from '../memoryService.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Memory Service System Prompt Properties', () => {
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
   * Property 21: System prompt injection with budget
   * For any set of memories, getSystemPromptAddition should inject memories
   * within the token budget
   * Validates: Requirements 11.3
   */
  it('Property 21: System prompt injection with budget', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          memories: fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 30 }),
              value: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          tokenBudget: fc.integer({ min: 50, max: 1000 }),
        }),
        async ({ memories, tokenBudget }) => {
          const service = new MemoryService({ memoryPath, tokenBudget });
          await service.load();

          // Store all memories
          for (const mem of memories) {
            service.remember(mem.key, mem.value);
          }

          // Get system prompt addition
          const prompt = service.getSystemPromptAddition();

          if (prompt) {
            // Should not be empty if we have memories
            expect(prompt.length).toBeGreaterThan(0);

            // Should start with header
            expect(prompt).toContain('## Remembered Context');

            // Rough token estimate: 1 token ≈ 4 characters
            const estimatedTokens = prompt.length / 4;
            expect(estimatedTokens).toBeLessThanOrEqual(tokenBudget * 1.1); // Allow 10% margin
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Memory prioritization by recency
   * For any set of memories exceeding the token budget, getSystemPromptAddition
   * should prioritize recently accessed memories
   * Validates: Requirements 11.4
   */
  it('Property 22: Memory prioritization by recency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          oldMemories: fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 30 }),
              value: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 5, maxLength: 10 }
          ),
          recentMemories: fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 30 }),
              value: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          tokenBudget: fc.integer({ min: 100, max: 300 }),
        }),
        async ({ oldMemories, recentMemories, tokenBudget }) => {
          const service = new MemoryService({ memoryPath, tokenBudget });
          await service.load();

          // Store old memories
          for (const mem of oldMemories) {
            service.remember(mem.key, mem.value);
          }

          // Wait a bit to ensure timestamp difference
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Store recent memories
          for (const mem of recentMemories) {
            service.remember(mem.key, mem.value);
          }

          // Access recent memories to increase their access count
          for (const mem of recentMemories) {
            service.recall(mem.key);
            service.recall(mem.key); // Access twice
          }

          // Get system prompt addition
          const prompt = service.getSystemPromptAddition();

          if (prompt) {
            // Recent memories should be more likely to appear
            // Count how many recent vs old memories are in the prompt
            let recentCount = 0;
            let oldCount = 0;

            for (const mem of recentMemories) {
              if (prompt.includes(mem.key)) {
                recentCount++;
              }
            }

            for (const mem of oldMemories) {
              if (prompt.includes(mem.key)) {
                oldCount++;
              }
            }

            // If we have any memories in the prompt, recent ones should be prioritized
            if (recentCount + oldCount > 0) {
              // Recent memories should have higher or equal representation
              // (they have higher access count)
              expect(recentCount).toBeGreaterThanOrEqual(
                Math.min(recentMemories.length, oldCount)
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
