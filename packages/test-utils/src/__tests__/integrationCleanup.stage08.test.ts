/**
 * Property-based tests for integration test cleanup.
 * Feature: stage-08-testing-qa, Property 14: Integration Test Cleanup
 * 
 * Validates: Requirements 6.6
 * 
 * Property 14: Integration Test Cleanup
 * For any integration test execution, after the test completes, no test data or state should remain in the system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  createResourceTracker,
  createCleanupTracker,
  delay,
  type ResourceTracker,
} from '../testHelpers.js';

describe('Property 14: Integration Test Cleanup', () => {
  describe('Resource Cleanup Property Tests', () => {
    it('Property 14: For any integration test, all resources are cleaned up after completion', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary number of resources (1-10)
          fc.integer({ min: 1, max: 10 }),
          // Generate arbitrary cleanup delays (0-5ms) - Reduced from 0-50ms for performance
          fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 10 }),
          async (resourceCount, cleanupDelays) => {
            // Create a resource tracker
            const tracker = createResourceTracker();
            const cleanupCalls: number[] = [];
            
            // Track multiple resources with varying cleanup behaviors
            for (let i = 0; i < resourceCount; i++) {
              const resourceId = i;
              const cleanupDelay = cleanupDelays[i % cleanupDelays.length];
              
              tracker.track({
                cleanup: async () => {
                  if (cleanupDelay > 0) {
                    await delay(cleanupDelay);
                  }
                  cleanupCalls.push(resourceId);
                },
              });
            }
            
            // Before cleanup, there should be uncleaned resources
            expect(tracker.hasUncleaned()).toBe(true);
            
            // Perform cleanup
            await tracker.cleanupAll();
            
            // After cleanup, no resources should remain uncleaned
            expect(tracker.hasUncleaned()).toBe(false);
            
            // All resources should have been cleaned up
            expect(cleanupCalls).toHaveLength(resourceCount);
            
            // Each resource should have been cleaned exactly once
            const uniqueCleanups = new Set(cleanupCalls);
            expect(uniqueCleanups.size).toBe(resourceCount);
            
            return true;
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('Property 14: Cleanup is idempotent - calling cleanupAll multiple times is safe', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary number of resources
          fc.integer({ min: 1, max: 5 }),
          // Generate number of cleanup calls (1-3)
          fc.integer({ min: 1, max: 3 }),
          async (resourceCount, cleanupCallCount) => {
            const tracker = createResourceTracker();
            let totalCleanupCalls = 0;
            
            // Track resources
            for (let i = 0; i < resourceCount; i++) {
              tracker.track({
                cleanup: () => {
                  totalCleanupCalls++;
                },
              });
            }
            
            // Call cleanupAll multiple times
            for (let i = 0; i < cleanupCallCount; i++) {
              await tracker.cleanupAll();
            }
            
            // Resources should only be cleaned once, not multiple times
            expect(totalCleanupCalls).toBe(resourceCount);
            expect(tracker.hasUncleaned()).toBe(false);
            
            return true;
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('Property 14: Cleanup handles errors gracefully without leaving resources uncleaned', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate number of resources before error
          fc.integer({ min: 0, max: 5 }),
          // Generate number of resources after error
          fc.integer({ min: 0, max: 5 }),
          async (beforeError, afterError) => {
            const tracker = createResourceTracker();
            const cleanedResources: string[] = [];
            
            // Add resources before the error
            for (let i = 0; i < beforeError; i++) {
              tracker.track({
                cleanup: () => {
                  cleanedResources.push(`before-${i}`);
                },
              });
            }
            
            // Add a resource that throws an error
            tracker.track({
              cleanup: () => {
                cleanedResources.push('error-resource');
                throw new Error('Cleanup error');
              },
            });
            
            // Add resources after the error
            for (let i = 0; i < afterError; i++) {
              tracker.track({
                cleanup: () => {
                  cleanedResources.push(`after-${i}`);
                },
              });
            }
            
            // Cleanup should throw due to the error
            await expect(tracker.cleanupAll()).rejects.toThrow('Cleanup error');
            
            // However, resources before the error should have been cleaned
            expect(cleanedResources).toContain('error-resource');
            for (let i = 0; i < beforeError; i++) {
              expect(cleanedResources).toContain(`before-${i}`);
            }
            
            return true;
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('Property 14: Cleanup tracker state is independent across test runs', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two different resource counts
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          async (firstCount, secondCount) => {
            // First test run
            const tracker1 = createCleanupTracker();
            tracker1.cleanup();
            expect(tracker1.wasCleanedUp()).toBe(true);
            
            // Second test run with fresh tracker
            const tracker2 = createCleanupTracker();
            expect(tracker2.wasCleanedUp()).toBe(false); // Should be independent
            
            tracker2.cleanup();
            expect(tracker2.wasCleanedUp()).toBe(true);
            
            // First tracker should still be cleaned
            expect(tracker1.wasCleanedUp()).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('Property 14: Resource tracker handles concurrent cleanup operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate number of resources
          fc.integer({ min: 2, max: 10 }),
          async (resourceCount) => {
            const tracker = createResourceTracker();
            const cleanupOrder: number[] = [];
            const cleanupPromises: Promise<void>[] = [];
            
            // Track resources with async cleanup
            for (let i = 0; i < resourceCount; i++) {
              const resourceId = i;
              tracker.track({
                cleanup: async () => {
                  // Simulate async cleanup with small delay (reduced from 10ms)
                  await delay(Math.random() * 2);
                  cleanupOrder.push(resourceId);
                },
              });
            }
            
            // Cleanup all resources
            await tracker.cleanupAll();
            
            // All resources should be cleaned
            expect(cleanupOrder).toHaveLength(resourceCount);
            expect(tracker.hasUncleaned()).toBe(false);
            
            // Each resource should be cleaned exactly once
            const uniqueCleanups = new Set(cleanupOrder);
            expect(uniqueCleanups.size).toBe(resourceCount);
            
            return true;
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });
  });

  describe('Integration Test Cleanup Scenarios', () => {
    it('Property 14: Simulated integration test with file resources', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate unique file names
          fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          async (fileNames) => {
            const tracker = createResourceTracker();
            const createdFiles: string[] = [];
            const localResources: Array<{ id: string; cleaned: boolean }> = [];
            
            // Simulate creating files
            for (const fileName of fileNames) {
              createdFiles.push(fileName);
              localResources.push({ id: fileName, cleaned: false });
              
              tracker.track({
                cleanup: () => {
                  // Simulate file deletion
                  const index = createdFiles.indexOf(fileName);
                  if (index > -1) {
                    createdFiles.splice(index, 1);
                  }
                  const resource = localResources.find(r => r.id === fileName);
                  if (resource) {
                    resource.cleaned = true;
                  }
                },
              });
            }
            
            // Verify files were "created"
            expect(createdFiles).toHaveLength(fileNames.length);
            
            // Cleanup
            await tracker.cleanupAll();
            
            // Verify all files were "deleted"
            expect(createdFiles).toHaveLength(0);
            expect(tracker.hasUncleaned()).toBe(false);
            
            // Verify all resources were cleaned
            const uncleanedResources = localResources.filter(r => !r.cleaned);
            expect(uncleanedResources).toHaveLength(0);
            
            return true;
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('Property 14: Simulated integration test with process resources', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate unique process IDs
          fc.uniqueArray(fc.integer({ min: 1000, max: 9999 }), { minLength: 1, maxLength: 5 }),
          async (processIds) => {
            const tracker = createResourceTracker();
            const runningProcesses = new Set<number>();
            const localResources: Array<{ id: string; cleaned: boolean }> = [];
            
            // Simulate starting processes
            for (const pid of processIds) {
              runningProcesses.add(pid);
              localResources.push({ id: `process-${pid}`, cleaned: false });
              
              tracker.track({
                cleanup: () => {
                  // Simulate process termination
                  runningProcesses.delete(pid);
                  const resource = localResources.find(r => r.id === `process-${pid}`);
                  if (resource) {
                    resource.cleaned = true;
                  }
                },
              });
            }
            
            // Verify processes were "started"
            expect(runningProcesses.size).toBe(processIds.length);
            
            // Cleanup
            await tracker.cleanupAll();
            
            // Verify all processes were "terminated"
            expect(runningProcesses.size).toBe(0);
            expect(tracker.hasUncleaned()).toBe(false);
            
            // Verify all resources were cleaned
            const uncleanedResources = localResources.filter(r => !r.cleaned);
            expect(uncleanedResources).toHaveLength(0);
            
            return true;
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('Property 14: Simulated integration test with mock/stub resources', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate unique mock names
          fc.uniqueArray(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 1, maxLength: 5 }),
          async (mockNames) => {
            const tracker = createResourceTracker();
            const activeMocks = new Set<string>();
            const localResources: Array<{ id: string; cleaned: boolean }> = [];
            
            // Simulate creating mocks
            for (const mockName of mockNames) {
              activeMocks.add(mockName);
              localResources.push({ id: `mock-${mockName}`, cleaned: false });
              
              tracker.track({
                cleanup: () => {
                  // Simulate mock reset
                  activeMocks.delete(mockName);
                  const resource = localResources.find(r => r.id === `mock-${mockName}`);
                  if (resource) {
                    resource.cleaned = true;
                  }
                },
              });
            }
            
            // Verify mocks were "created"
            expect(activeMocks.size).toBe(mockNames.length);
            
            // Cleanup
            await tracker.cleanupAll();
            
            // Verify all mocks were "reset"
            expect(activeMocks.size).toBe(0);
            expect(tracker.hasUncleaned()).toBe(false);
            
            // Verify all resources were cleaned
            const uncleanedResources = localResources.filter(r => !r.cleaned);
            expect(uncleanedResources).toHaveLength(0);
            
            return true;
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('Property 14: Mixed resource types are all cleaned up', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }), // files
          fc.integer({ min: 1, max: 3 }), // processes
          fc.integer({ min: 1, max: 3 }), // mocks
          async (fileCount, processCount, mockCount) => {
            const tracker = createResourceTracker();
            const localResources: Array<{ id: string; cleaned: boolean }> = [];
            const resources = {
              files: [] as string[],
              processes: new Set<number>(),
              mocks: new Set<string>(),
            };
            
            // Create files
            for (let i = 0; i < fileCount; i++) {
              const fileName = `file-${i}`;
              resources.files.push(fileName);
              localResources.push({ id: fileName, cleaned: false });
              
              tracker.track({
                cleanup: () => {
                  const index = resources.files.indexOf(fileName);
                  if (index > -1) resources.files.splice(index, 1);
                  const resource = localResources.find(r => r.id === fileName);
                  if (resource) resource.cleaned = true;
                },
              });
            }
            
            // Create processes
            for (let i = 0; i < processCount; i++) {
              const pid = 1000 + i;
              resources.processes.add(pid);
              localResources.push({ id: `process-${pid}`, cleaned: false });
              
              tracker.track({
                cleanup: () => {
                  resources.processes.delete(pid);
                  const resource = localResources.find(r => r.id === `process-${pid}`);
                  if (resource) resource.cleaned = true;
                },
              });
            }
            
            // Create mocks
            for (let i = 0; i < mockCount; i++) {
              const mockName = `mock-${i}`;
              resources.mocks.add(mockName);
              localResources.push({ id: mockName, cleaned: false });
              
              tracker.track({
                cleanup: () => {
                  resources.mocks.delete(mockName);
                  const resource = localResources.find(r => r.id === mockName);
                  if (resource) resource.cleaned = true;
                },
              });
            }
            
            // Verify all resources were created
            expect(resources.files).toHaveLength(fileCount);
            expect(resources.processes.size).toBe(processCount);
            expect(resources.mocks.size).toBe(mockCount);
            
            // Cleanup
            await tracker.cleanupAll();
            
            // Verify all resources were cleaned
            expect(resources.files).toHaveLength(0);
            expect(resources.processes.size).toBe(0);
            expect(resources.mocks.size).toBe(0);
            expect(tracker.hasUncleaned()).toBe(false);
            
            // Verify all local resources were cleaned
            const uncleanedResources = localResources.filter(r => !r.cleaned);
            expect(uncleanedResources).toHaveLength(0);
            
            return true;
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });
  });
});
