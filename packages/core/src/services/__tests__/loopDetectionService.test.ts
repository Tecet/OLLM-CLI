/**
 * Tests for LoopDetectionService
 * Feature: services-sessions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { LoopDetectionService, LoopPattern } from '../loopDetectionService.js';

describe('LoopDetectionService', () => {
  let service: LoopDetectionService;

  beforeEach(() => {
    service = new LoopDetectionService();
  });

  describe('Property 14: Repeated tool call detection', () => {
    /**
     * Feature: services-sessions, Property 14: Repeated tool call detection
     *
     * For any sequence of N consecutive identical tool calls (same name and arguments),
     * where N equals the repeatThreshold, the loop detection service should detect a loop.
     *
     * Validates: Requirements 4.1, 4.4
     */
    it('should detect loop when same tool is called N times with identical arguments', () => {
      fc.assert(
        fc.property(
          // Generate tool name
          fc.constantFrom('read_file', 'write_file', 'shell', 'grep', 'glob', 'ls'),
          // Generate tool arguments
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.oneof(
              fc.string({ maxLength: 100 }),
              fc.integer(),
              fc.boolean(),
              fc.constant(null),
              fc.array(fc.string({ maxLength: 50 }), { maxLength: 5 })
            ),
            { minKeys: 1, maxKeys: 5 }
          ),
          // Generate repeat threshold (3-10)
          fc.integer({ min: 3, max: 10 }),
          (toolName, args, repeatThreshold) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service with the generated threshold
            service.configure({ repeatThreshold });

            // Record the same tool call N times
            for (let i = 0; i < repeatThreshold; i++) {
              service.recordToolCall(toolName, args);
            }

            // Check for loop - should detect repeated tool calls
            const loop = service.checkForLoop();

            // Verify loop was detected
            expect(loop).not.toBeNull();
            expect(loop!.type).toBe('repeated-tool');
            expect(loop!.count).toBe(repeatThreshold);
            expect(loop!.details).toContain(toolName);
            expect(loop!.details).toContain('consecutively');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT detect loop when tool calls are different', () => {
      fc.assert(
        fc.property(
          // Generate array of different tool names
          fc.array(
            fc.constantFrom('read_file', 'write_file', 'shell', 'grep', 'glob', 'ls'),
            { minLength: 3, maxLength: 10 }
          ),
          // Generate different arguments for each call
          fc.array(
            fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.oneof(fc.string({ maxLength: 100 }), fc.integer(), fc.boolean()),
              { minKeys: 1, maxKeys: 3 }
            ),
            { minLength: 3, maxLength: 10 }
          ),
          (toolNames, argsList) => {
            // Reset service for each test run
            service.reset();
            
            // Ensure we have matching lengths
            const length = Math.min(toolNames.length, argsList.length);
            
            // Configure with default threshold
            service.configure({ repeatThreshold: 3 });

            // Record different tool calls
            for (let i = 0; i < length; i++) {
              service.recordToolCall(toolNames[i], argsList[i]);
            }

            // Check for loop - should NOT detect if calls are different
            const loop = service.checkForLoop();

            // If a loop is detected, it should only be if we accidentally generated
            // N consecutive identical calls (very unlikely with our generators)
            if (loop !== null) {
              // Verify it's actually a repeated pattern
              const lastThree = [];
              for (let i = Math.max(0, length - 3); i < length; i++) {
                lastThree.push({ name: toolNames[i], args: argsList[i] });
              }
              
              // Check if last 3 are actually identical
              const allSame = lastThree.every(
                (call, idx, arr) =>
                  idx === 0 ||
                  (call.name === arr[0].name &&
                    JSON.stringify(call.args) === JSON.stringify(arr[0].args))
              );
              
              expect(allSame).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT detect loop when threshold is not reached', () => {
      fc.assert(
        fc.property(
          // Generate tool name
          fc.constantFrom('read_file', 'write_file', 'shell', 'grep', 'glob'),
          // Generate tool arguments
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.oneof(fc.string({ maxLength: 100 }), fc.integer(), fc.boolean()),
            { minKeys: 1, maxKeys: 5 }
          ),
          // Generate repeat threshold
          fc.integer({ min: 3, max: 10 }),
          (toolName, args, repeatThreshold) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service with the generated threshold
            service.configure({ repeatThreshold });

            // Record the same tool call N-1 times (one less than threshold)
            for (let i = 0; i < repeatThreshold - 1; i++) {
              service.recordToolCall(toolName, args);
            }

            // Check for loop - should NOT detect
            const loop = service.checkForLoop();

            // Verify no loop was detected (or only turn-limit if we're at that threshold)
            if (loop !== null) {
              expect(loop.type).not.toBe('repeated-tool');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect loop when same tool with same args appears after different calls', () => {
      fc.assert(
        fc.property(
          // Generate tool name for repeated calls
          fc.constantFrom('read_file', 'write_file', 'shell'),
          // Generate args for repeated calls
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ maxLength: 100 }),
            { minKeys: 1, maxKeys: 3 }
          ),
          // Generate different tool calls to insert before
          fc.array(
            fc.record({
              name: fc.constantFrom('grep', 'glob', 'ls'),
              args: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.integer(),
                { minKeys: 1, maxKeys: 2 }
              ),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (repeatedTool, repeatedArgs, differentCalls) => {
            // Reset service for each test run
            service.reset();
            
            // Configure with threshold of 3
            service.configure({ repeatThreshold: 3 });

            // Record some different calls first
            for (const call of differentCalls) {
              service.recordToolCall(call.name, call.args);
            }

            // Now record the same tool 3 times
            for (let i = 0; i < 3; i++) {
              service.recordToolCall(repeatedTool, repeatedArgs);
            }

            // Check for loop - should detect
            const loop = service.checkForLoop();

            expect(loop).not.toBeNull();
            expect(loop!.type).toBe('repeated-tool');
            expect(loop!.details).toContain(repeatedTool);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 16: Turn limit detection', () => {
    /**
     * Feature: services-sessions, Property 16: Turn limit detection
     *
     * For any turn count that exceeds maxTurns, the loop detection service should detect a loop.
     *
     * Validates: Requirements 4.3
     */
    it('should detect loop when turn count exceeds maxTurns', () => {
      fc.assert(
        fc.property(
          // Generate maxTurns value (10-100)
          fc.integer({ min: 10, max: 100 }),
          (maxTurns) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service with the generated maxTurns
            service.configure({ maxTurns });

            // Record turns up to maxTurns
            for (let i = 0; i < maxTurns; i++) {
              service.recordTurn();
            }

            // Check for loop - should detect turn limit
            const loop = service.checkForLoop();

            // Verify loop was detected
            expect(loop).not.toBeNull();
            expect(loop!.type).toBe('turn-limit');
            expect(loop!.count).toBe(maxTurns);
            expect(loop!.details).toContain('maximum turn limit');
            expect(loop!.details).toContain(maxTurns.toString());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT detect loop when turn count is below maxTurns', () => {
      fc.assert(
        fc.property(
          // Generate maxTurns value (10-100)
          fc.integer({ min: 10, max: 100 }),
          (maxTurns) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service with the generated maxTurns
            service.configure({ maxTurns });

            // Record turns up to maxTurns - 1
            for (let i = 0; i < maxTurns - 1; i++) {
              service.recordTurn();
            }

            // Check for loop - should NOT detect turn limit
            const loop = service.checkForLoop();

            // Verify no turn-limit loop was detected
            if (loop !== null) {
              expect(loop.type).not.toBe('turn-limit');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect loop immediately when turn count equals maxTurns', () => {
      fc.assert(
        fc.property(
          // Generate maxTurns value (5-50)
          fc.integer({ min: 5, max: 50 }),
          (maxTurns) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service with the generated maxTurns
            service.configure({ maxTurns });

            // Record exactly maxTurns turns
            for (let i = 0; i < maxTurns; i++) {
              service.recordTurn();
            }

            // Check for loop - should detect immediately
            const loop = service.checkForLoop();

            // Verify loop was detected with correct count
            expect(loop).not.toBeNull();
            expect(loop!.type).toBe('turn-limit');
            expect(loop!.count).toBe(maxTurns);
            
            // Verify turn count matches
            expect(service.getTurnCount()).toBe(maxTurns);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist loop detection after first detection', () => {
      fc.assert(
        fc.property(
          // Generate maxTurns value (5-30)
          fc.integer({ min: 5, max: 30 }),
          // Generate additional turns to record after limit
          fc.integer({ min: 1, max: 10 }),
          (maxTurns, additionalTurns) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service with the generated maxTurns
            service.configure({ maxTurns });

            // Record turns exceeding maxTurns
            for (let i = 0; i < maxTurns + additionalTurns; i++) {
              service.recordTurn();
            }

            // Check for loop multiple times
            const loop1 = service.checkForLoop();
            const loop2 = service.checkForLoop();

            // Both checks should return the same loop
            expect(loop1).not.toBeNull();
            expect(loop2).not.toBeNull();
            expect(loop1!.type).toBe('turn-limit');
            expect(loop2!.type).toBe('turn-limit');
            expect(loop1).toEqual(loop2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reset turn count when reset is called', () => {
      fc.assert(
        fc.property(
          // Generate maxTurns value (10-50)
          fc.integer({ min: 10, max: 50 }),
          // Generate initial turn count (at or above maxTurns)
          fc.integer({ min: 10, max: 50 }),
          (maxTurns, initialTurns) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service with the generated maxTurns
            service.configure({ maxTurns });

            // Record initial turns (may exceed maxTurns)
            for (let i = 0; i < initialTurns; i++) {
              service.recordTurn();
            }

            // Reset the service
            service.reset();

            // Verify turn count is reset
            expect(service.getTurnCount()).toBe(0);
            
            // Verify no loop is detected after reset
            const loop = service.checkForLoop();
            expect(loop).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle maxTurns of 1', () => {
      // Reset service
      service.reset();
      
      // Configure with maxTurns of 1
      service.configure({ maxTurns: 1 });

      // Record 1 turn
      service.recordTurn();

      // Check for loop - should detect
      const loop = service.checkForLoop();

      expect(loop).not.toBeNull();
      expect(loop!.type).toBe('turn-limit');
      expect(loop!.count).toBe(1);
    });

    it('should prioritize turn-limit over other loop types when both conditions are met', () => {
      fc.assert(
        fc.property(
          // Generate small maxTurns (3-10)
          fc.integer({ min: 3, max: 10 }),
          // Generate tool name
          fc.constantFrom('read_file', 'write_file', 'shell'),
          // Generate tool arguments
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ maxLength: 100 }),
            { minKeys: 1, maxKeys: 3 }
          ),
          (maxTurns, toolName, args) => {
            // Reset service for each test run
            service.reset();
            
            // Configure with small maxTurns and repeatThreshold
            service.configure({ maxTurns, repeatThreshold: 3 });

            // Record turns and repeated tool calls to trigger both conditions
            for (let i = 0; i < maxTurns; i++) {
              service.recordTurn();
              service.recordToolCall(toolName, args);
            }

            // Check for loop - turn-limit should be detected first
            const loop = service.checkForLoop();

            expect(loop).not.toBeNull();
            expect(loop!.type).toBe('turn-limit');
            expect(loop!.count).toBe(maxTurns);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 15: Repeated output detection', () => {
    /**
     * Feature: services-sessions, Property 15: Repeated output detection
     *
     * For any sequence of N consecutive identical outputs, where N equals the repeatThreshold,
     * the loop detection service should detect a loop.
     *
     * Validates: Requirements 4.2, 4.5
     */
    it('should detect loop when same output is repeated N times consecutively', () => {
      fc.assert(
        fc.property(
          // Generate output string
          fc.string({ minLength: 10, maxLength: 500 }),
          // Generate repeat threshold (3-10)
          fc.integer({ min: 3, max: 10 }),
          (output, repeatThreshold) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service with the generated threshold
            service.configure({ repeatThreshold });

            // Record the same output N times
            for (let i = 0; i < repeatThreshold; i++) {
              service.recordOutput(output);
            }

            // Check for loop - should detect repeated outputs
            const loop = service.checkForLoop();

            // Verify loop was detected
            expect(loop).not.toBeNull();
            expect(loop!.type).toBe('repeated-output');
            expect(loop!.count).toBe(repeatThreshold);
            expect(loop!.details).toContain('repeated');
            expect(loop!.details).toContain('consecutively');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT detect loop when outputs are different', () => {
      fc.assert(
        fc.property(
          // Generate array of different outputs
          fc.array(
            fc.string({ minLength: 5, maxLength: 200 }),
            { minLength: 3, maxLength: 10 }
          ),
          (outputs) => {
            // Reset service for each test run
            service.reset();
            
            // Configure with default threshold
            service.configure({ repeatThreshold: 3 });

            // Record different outputs
            for (const output of outputs) {
              service.recordOutput(output);
            }

            // Check for loop - should NOT detect if outputs are different
            const loop = service.checkForLoop();

            // If a loop is detected, it should only be if we accidentally generated
            // N consecutive identical outputs (very unlikely with our generator)
            if (loop !== null && loop.type === 'repeated-output') {
              // Verify it's actually a repeated pattern
              const lastThree = outputs.slice(-3);
              const allSame = lastThree.every((output) => output === lastThree[0]);
              expect(allSame).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT detect loop when threshold is not reached', () => {
      fc.assert(
        fc.property(
          // Generate output string
          fc.string({ minLength: 10, maxLength: 500 }),
          // Generate repeat threshold
          fc.integer({ min: 3, max: 10 }),
          (output, repeatThreshold) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service with the generated threshold
            service.configure({ repeatThreshold });

            // Record the same output N-1 times (one less than threshold)
            for (let i = 0; i < repeatThreshold - 1; i++) {
              service.recordOutput(output);
            }

            // Check for loop - should NOT detect
            const loop = service.checkForLoop();

            // Verify no loop was detected (or only turn-limit if we're at that threshold)
            if (loop !== null) {
              expect(loop.type).not.toBe('repeated-output');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect loop when same output appears after different outputs', () => {
      fc.assert(
        fc.property(
          // Generate repeated output
          fc.string({ minLength: 20, maxLength: 200 }),
          // Generate different outputs to insert before
          fc.array(
            fc.string({ minLength: 10, maxLength: 150 }),
            { minLength: 1, maxLength: 5 }
          ),
          (repeatedOutput, differentOutputs) => {
            // Reset service for each test run
            service.reset();
            
            // Configure with threshold of 3
            service.configure({ repeatThreshold: 3 });

            // Record some different outputs first
            for (const output of differentOutputs) {
              service.recordOutput(output);
            }

            // Now record the same output 3 times
            for (let i = 0; i < 3; i++) {
              service.recordOutput(repeatedOutput);
            }

            // Check for loop - should detect
            const loop = service.checkForLoop();

            expect(loop).not.toBeNull();
            expect(loop!.type).toBe('repeated-output');
            expect(loop!.count).toBe(3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty string outputs', () => {
      fc.assert(
        fc.property(
          // Generate repeat threshold
          fc.integer({ min: 3, max: 10 }),
          (repeatThreshold) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service with the generated threshold
            service.configure({ repeatThreshold });

            // Record empty string N times
            for (let i = 0; i < repeatThreshold; i++) {
              service.recordOutput('');
            }

            // Check for loop - should detect repeated empty outputs
            const loop = service.checkForLoop();

            // Verify loop was detected
            expect(loop).not.toBeNull();
            expect(loop!.type).toBe('repeated-output');
            expect(loop!.count).toBe(repeatThreshold);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 17: Loop detection stops execution', () => {
    /**
     * Feature: services-sessions, Property 17: Loop detection stops execution
     *
     * For any detected loop, the loop detection service should emit a loop event
     * with pattern details and prevent further execution.
     *
     * Validates: Requirements 4.7, 4.8
     */
    it('should stop execution and emit event for any detected loop pattern', () => {
      fc.assert(
        fc.property(
          // Generate loop type
          fc.constantFrom('repeated-tool', 'repeated-output', 'turn-limit'),
          // Generate repeat threshold (3-10)
          fc.integer({ min: 3, max: 10 }),
          // Generate maxTurns (5-50)
          fc.integer({ min: 5, max: 50 }),
          (loopType, repeatThreshold, maxTurns) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service
            service.configure({ repeatThreshold, maxTurns });

            // Track event emission
            let eventEmitted = false;
            let emittedPattern: LoopPattern | null = null;

            service.onLoopDetected((pattern) => {
              eventEmitted = true;
              emittedPattern = pattern;
            });

            // Initially execution should not be stopped
            expect(service.isExecutionStopped()).toBe(false);

            // Trigger the specific loop type
            if (loopType === 'repeated-tool') {
              // Generate random tool name and args
              const toolName = 'test_tool_' + Math.random().toString(36).substring(7);
              const args = { key: 'value_' + Math.random() };
              
              for (let i = 0; i < repeatThreshold; i++) {
                service.recordToolCall(toolName, args);
              }
            } else if (loopType === 'repeated-output') {
              // Generate random output
              const output = 'output_' + Math.random().toString(36).substring(7);
              
              for (let i = 0; i < repeatThreshold; i++) {
                service.recordOutput(output);
              }
            } else if (loopType === 'turn-limit') {
              for (let i = 0; i < maxTurns; i++) {
                service.recordTurn();
              }
            }

            // Check for loop
            const loop = service.checkForLoop();

            // Verify loop was detected
            expect(loop).not.toBeNull();
            expect(loop!.type).toBe(loopType);

            // Verify event was emitted
            expect(eventEmitted).toBe(true);
            expect(emittedPattern).not.toBeNull();
            expect(emittedPattern!.type).toBe(loopType);
            expect(emittedPattern).toEqual(loop);

            // Verify execution is stopped
            expect(service.isExecutionStopped()).toBe(true);

            // Verify pattern details are present
            expect(loop!.details).toBeTruthy();
            expect(loop!.details.length).toBeGreaterThan(0);
            expect(loop!.count).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should emit event only once even when checked multiple times', () => {
      fc.assert(
        fc.property(
          // Generate repeat threshold (3-10)
          fc.integer({ min: 3, max: 10 }),
          // Generate tool name
          fc.string({ minLength: 5, maxLength: 20 }),
          // Generate tool arguments
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.oneof(fc.string(), fc.integer(), fc.boolean()),
            { minKeys: 1, maxKeys: 5 }
          ),
          (repeatThreshold, toolName, args) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service
            service.configure({ repeatThreshold });

            // Track event count
            let eventCount = 0;

            service.onLoopDetected(() => {
              eventCount++;
            });

            // Trigger loop
            for (let i = 0; i < repeatThreshold; i++) {
              service.recordToolCall(toolName, args);
            }

            // Check for loop multiple times
            const loop1 = service.checkForLoop();
            const loop2 = service.checkForLoop();
            const loop3 = service.checkForLoop();

            // All checks should return the same loop
            expect(loop1).not.toBeNull();
            expect(loop2).not.toBeNull();
            expect(loop3).not.toBeNull();
            expect(loop1).toEqual(loop2);
            expect(loop2).toEqual(loop3);

            // Event should only be emitted once
            expect(eventCount).toBe(1);

            // Execution should remain stopped
            expect(service.isExecutionStopped()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reset execution stopped flag when reset is called', () => {
      fc.assert(
        fc.property(
          // Generate loop type
          fc.constantFrom('repeated-tool', 'repeated-output', 'turn-limit'),
          // Generate repeat threshold (3-10)
          fc.integer({ min: 3, max: 10 }),
          // Generate maxTurns (5-30)
          fc.integer({ min: 5, max: 30 }),
          (loopType, repeatThreshold, maxTurns) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service
            service.configure({ repeatThreshold, maxTurns });

            // Trigger the specific loop type
            if (loopType === 'repeated-tool') {
              const toolName = 'test_tool';
              const args = { key: 'value' };
              for (let i = 0; i < repeatThreshold; i++) {
                service.recordToolCall(toolName, args);
              }
            } else if (loopType === 'repeated-output') {
              const output = 'same output';
              for (let i = 0; i < repeatThreshold; i++) {
                service.recordOutput(output);
              }
            } else if (loopType === 'turn-limit') {
              for (let i = 0; i < maxTurns; i++) {
                service.recordTurn();
              }
            }

            // Check for loop
            service.checkForLoop();

            // Verify execution is stopped
            expect(service.isExecutionStopped()).toBe(true);

            // Reset service
            service.reset();

            // Verify execution is no longer stopped
            expect(service.isExecutionStopped()).toBe(false);
            
            // Verify no loop is detected after reset
            const loop = service.checkForLoop();
            expect(loop).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not stop execution when disabled', () => {
      fc.assert(
        fc.property(
          // Generate repeat threshold (3-10)
          fc.integer({ min: 3, max: 10 }),
          // Generate tool name
          fc.string({ minLength: 5, maxLength: 20 }),
          // Generate tool arguments
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.string({ maxLength: 50 }),
            { minKeys: 1, maxKeys: 3 }
          ),
          (repeatThreshold, toolName, args) => {
            // Reset service for each test run
            service.reset();
            
            // Configure service with disabled flag
            service.configure({ enabled: false, repeatThreshold });

            // Track event emission
            let eventEmitted = false;

            service.onLoopDetected(() => {
              eventEmitted = true;
            });

            // Try to trigger loop
            for (let i = 0; i < repeatThreshold; i++) {
              service.recordToolCall(toolName, args);
            }

            // Check for loop
            const loop = service.checkForLoop();

            // Verify no loop was detected
            expect(loop).toBeNull();

            // Verify event was not emitted
            expect(eventEmitted).toBe(false);

            // Verify execution is not stopped
            expect(service.isExecutionStopped()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Loop event emission and execution stopping', () => {
    it('should emit loop event when loop is detected', () => {
      service.reset();
      service.configure({ repeatThreshold: 3 });

      let eventEmitted = false;
      let emittedPattern: LoopPattern | null = null;

      // Register callback
      service.onLoopDetected((pattern) => {
        eventEmitted = true;
        emittedPattern = pattern;
      });

      // Trigger loop by repeating tool calls
      for (let i = 0; i < 3; i++) {
        service.recordToolCall('test_tool', { arg: 'value' });
      }

      // Check for loop
      const loop = service.checkForLoop();

      // Verify event was emitted
      expect(eventEmitted).toBe(true);
      expect(emittedPattern).not.toBeNull();
      expect(emittedPattern!.type).toBe('repeated-tool');
      expect(emittedPattern).toEqual(loop);
    });

    it('should emit loop event to multiple callbacks', () => {
      service.reset();
      service.configure({ maxTurns: 5 });

      let callback1Called = false;
      let callback2Called = false;
      let callback3Called = false;

      // Register multiple callbacks
      service.onLoopDetected(() => {
        callback1Called = true;
      });
      service.onLoopDetected(() => {
        callback2Called = true;
      });
      service.onLoopDetected(() => {
        callback3Called = true;
      });

      // Trigger loop by exceeding turn limit
      for (let i = 0; i < 5; i++) {
        service.recordTurn();
      }

      // Check for loop
      service.checkForLoop();

      // Verify all callbacks were called
      expect(callback1Called).toBe(true);
      expect(callback2Called).toBe(true);
      expect(callback3Called).toBe(true);
    });

    it('should allow removing callbacks', () => {
      service.reset();
      service.configure({ repeatThreshold: 3 });

      let callback1Called = false;
      let callback2Called = false;

      const callback1 = () => {
        callback1Called = true;
      };
      const callback2 = () => {
        callback2Called = true;
      };

      // Register both callbacks
      service.onLoopDetected(callback1);
      service.onLoopDetected(callback2);

      // Remove callback1
      service.offLoopDetected(callback1);

      // Trigger loop
      for (let i = 0; i < 3; i++) {
        service.recordOutput('same output');
      }

      service.checkForLoop();

      // Verify only callback2 was called
      expect(callback1Called).toBe(false);
      expect(callback2Called).toBe(true);
    });

    it('should handle callback errors gracefully', () => {
      service.reset();
      service.configure({ repeatThreshold: 3 });

      let goodCallbackCalled = false;

      // Register a callback that throws
      service.onLoopDetected(() => {
        throw new Error('Callback error');
      });

      // Register a good callback
      service.onLoopDetected(() => {
        goodCallbackCalled = true;
      });

      // Trigger loop
      for (let i = 0; i < 3; i++) {
        service.recordToolCall('test', {});
      }

      // Should not throw, and good callback should still be called
      expect(() => service.checkForLoop()).not.toThrow();
      expect(goodCallbackCalled).toBe(true);
    });

    it('should stop execution when loop is detected', () => {
      service.reset();
      service.configure({ repeatThreshold: 3 });

      // Initially execution should not be stopped
      expect(service.isExecutionStopped()).toBe(false);

      // Trigger loop
      for (let i = 0; i < 3; i++) {
        service.recordToolCall('test_tool', { arg: 'value' });
      }

      service.checkForLoop();

      // Execution should now be stopped
      expect(service.isExecutionStopped()).toBe(true);
    });

    it('should reset execution stopped flag when reset is called', () => {
      service.reset();
      service.configure({ repeatThreshold: 3 });

      // Trigger loop
      for (let i = 0; i < 3; i++) {
        service.recordToolCall('test_tool', { arg: 'value' });
      }

      service.checkForLoop();

      // Verify execution is stopped
      expect(service.isExecutionStopped()).toBe(true);

      // Reset service
      service.reset();

      // Execution should no longer be stopped
      expect(service.isExecutionStopped()).toBe(false);
    });

    it('should emit event for turn limit loop', () => {
      service.reset();
      service.configure({ maxTurns: 10 });

      let eventEmitted = false;
      let emittedPattern: LoopPattern | null = null;

      service.onLoopDetected((pattern) => {
        eventEmitted = true;
        emittedPattern = pattern;
      });

      // Trigger turn limit
      for (let i = 0; i < 10; i++) {
        service.recordTurn();
      }

      service.checkForLoop();

      expect(eventEmitted).toBe(true);
      expect(emittedPattern).not.toBeNull();
      expect(emittedPattern!.type).toBe('turn-limit');
    });

    it('should emit event for repeated output loop', () => {
      service.reset();
      service.configure({ repeatThreshold: 3 });

      let eventEmitted = false;
      let emittedPattern: LoopPattern | null = null;

      service.onLoopDetected((pattern) => {
        eventEmitted = true;
        emittedPattern = pattern;
      });

      // Trigger repeated output
      for (let i = 0; i < 3; i++) {
        service.recordOutput('same output');
      }

      service.checkForLoop();

      expect(eventEmitted).toBe(true);
      expect(emittedPattern).not.toBeNull();
      expect(emittedPattern!.type).toBe('repeated-output');
    });

    it('should only emit event once per loop detection', () => {
      service.reset();
      service.configure({ repeatThreshold: 3 });

      let eventCount = 0;

      service.onLoopDetected(() => {
        eventCount++;
      });

      // Trigger loop
      for (let i = 0; i < 3; i++) {
        service.recordToolCall('test', {});
      }

      // Check multiple times
      service.checkForLoop();
      service.checkForLoop();
      service.checkForLoop();

      // Event should only be emitted once
      expect(eventCount).toBe(1);
    });

    it('should not emit event when disabled', () => {
      service.reset();
      service.configure({ enabled: false, repeatThreshold: 3 });

      let eventEmitted = false;

      service.onLoopDetected(() => {
        eventEmitted = true;
      });

      // Try to trigger loop
      for (let i = 0; i < 3; i++) {
        service.recordToolCall('test', {});
      }

      service.checkForLoop();

      // Event should not be emitted when disabled
      expect(eventEmitted).toBe(false);
      expect(service.isExecutionStopped()).toBe(false);
    });
  });

  describe('Configuration', () => {
    /**
     * Unit tests for configuration
     * Requirements: 4.6
     */
    describe('Default values', () => {
      it('should use default maxTurns of 50', () => {
        const defaultService = new LoopDetectionService();

        // Record 49 turns - should not trigger
        for (let i = 0; i < 49; i++) {
          defaultService.recordTurn();
        }
        expect(defaultService.checkForLoop()).toBeNull();

        // Record 50th turn - should trigger
        defaultService.recordTurn();
        const loop = defaultService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('turn-limit');
        expect(loop!.count).toBe(50);
      });

      it('should use default repeatThreshold of 3', () => {
        const defaultService = new LoopDetectionService();

        // Record same tool call 2 times - should not trigger
        for (let i = 0; i < 2; i++) {
          defaultService.recordToolCall('test_tool', { arg: 'value' });
        }
        expect(defaultService.checkForLoop()).toBeNull();

        // Record 3rd time - should trigger
        defaultService.recordToolCall('test_tool', { arg: 'value' });
        const loop = defaultService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('repeated-tool');
        expect(loop!.count).toBe(3);
      });

      it('should use default enabled of true', () => {
        const defaultService = new LoopDetectionService();

        // Record turns to trigger loop
        for (let i = 0; i < 50; i++) {
          defaultService.recordTurn();
        }

        // Should detect loop since enabled by default
        const loop = defaultService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('turn-limit');
      });

      it('should apply all default values when no config provided', () => {
        const defaultService = new LoopDetectionService();

        // Test maxTurns default (50)
        for (let i = 0; i < 50; i++) {
          defaultService.recordTurn();
        }
        let loop = defaultService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('turn-limit');

        // Reset and test repeatThreshold default (3)
        defaultService.reset();
        for (let i = 0; i < 3; i++) {
          defaultService.recordOutput('same output');
        }
        loop = defaultService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('repeated-output');
      });
    });

    describe('Custom configuration', () => {
      it('should accept custom maxTurns in constructor', () => {
        const customService = new LoopDetectionService({ maxTurns: 10 });

        // Record 10 turns
        for (let i = 0; i < 10; i++) {
          customService.recordTurn();
        }

        // Should trigger with custom maxTurns
        const loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('turn-limit');
        expect(loop!.count).toBe(10);
      });

      it('should accept custom repeatThreshold in constructor', () => {
        const customService = new LoopDetectionService({ repeatThreshold: 5 });

        // Record same tool call 5 times
        for (let i = 0; i < 5; i++) {
          customService.recordToolCall('test_tool', { arg: 'value' });
        }

        // Should trigger with custom repeatThreshold
        const loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('repeated-tool');
        expect(loop!.count).toBe(5);
      });

      it('should accept custom enabled in constructor', () => {
        const disabledService = new LoopDetectionService({ enabled: false });

        // Try to trigger loop
        for (let i = 0; i < 50; i++) {
          disabledService.recordTurn();
        }

        // Should not detect loop when disabled
        const loop = disabledService.checkForLoop();
        expect(loop).toBeNull();
      });

      it('should accept multiple custom config values in constructor', () => {
        const customService = new LoopDetectionService({
          maxTurns: 20,
          repeatThreshold: 4,
          enabled: true,
        });

        // Test custom maxTurns
        for (let i = 0; i < 20; i++) {
          customService.recordTurn();
        }
        let loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('turn-limit');
        expect(loop!.count).toBe(20);

        // Reset and test custom repeatThreshold
        customService.reset();
        for (let i = 0; i < 4; i++) {
          customService.recordOutput('same output');
        }
        loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('repeated-output');
        expect(loop!.count).toBe(4);
      });

      it('should update configuration via configure method', () => {
        const customService = new LoopDetectionService({ maxTurns: 50 });

        // Update to custom maxTurns
        customService.configure({ maxTurns: 15 });

        // Record 15 turns
        for (let i = 0; i < 15; i++) {
          customService.recordTurn();
        }

        // Should trigger with updated maxTurns
        const loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('turn-limit');
        expect(loop!.count).toBe(15);
      });

      it('should update repeatThreshold via configure method', () => {
        const customService = new LoopDetectionService({ repeatThreshold: 3 });

        // Update to custom repeatThreshold
        customService.configure({ repeatThreshold: 7 });

        // Record same tool call 7 times
        for (let i = 0; i < 7; i++) {
          customService.recordToolCall('test_tool', { arg: 'value' });
        }

        // Should trigger with updated repeatThreshold
        const loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('repeated-tool');
        expect(loop!.count).toBe(7);
      });

      it('should enable/disable via configure method', () => {
        const customService = new LoopDetectionService({ enabled: true });

        // Disable via configure
        customService.configure({ enabled: false });

        // Try to trigger loop
        for (let i = 0; i < 50; i++) {
          customService.recordTurn();
        }

        // Should not detect loop when disabled
        let loop = customService.checkForLoop();
        expect(loop).toBeNull();

        // Re-enable via configure
        customService.reset();
        customService.configure({ enabled: true });

        // Now should detect loop
        for (let i = 0; i < 50; i++) {
          customService.recordTurn();
        }
        loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
      });

      it('should merge partial config updates', () => {
        const customService = new LoopDetectionService({
          maxTurns: 100,
          repeatThreshold: 5,
          enabled: true,
        });

        // Update only maxTurns, should preserve other settings
        customService.configure({ maxTurns: 25 });

        // Test that maxTurns was updated
        for (let i = 0; i < 25; i++) {
          customService.recordTurn();
        }
        let loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('turn-limit');

        // Test that repeatThreshold was preserved (still 5)
        customService.reset();
        for (let i = 0; i < 5; i++) {
          customService.recordOutput('same output');
        }
        loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('repeated-output');
        expect(loop!.count).toBe(5);
      });

      it('should handle edge case of maxTurns = 1', () => {
        const customService = new LoopDetectionService({ maxTurns: 1 });

        // Record 1 turn
        customService.recordTurn();

        // Should trigger immediately
        const loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('turn-limit');
        expect(loop!.count).toBe(1);
      });

      it('should handle edge case of repeatThreshold = 1', () => {
        const customService = new LoopDetectionService({ repeatThreshold: 1 });

        // Record 1 tool call
        customService.recordToolCall('test_tool', { arg: 'value' });

        // Should trigger immediately
        const loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('repeated-tool');
        expect(loop!.count).toBe(1);
      });

      it('should handle very large maxTurns values', () => {
        const customService = new LoopDetectionService({ maxTurns: 10000 });

        // Record 9999 turns - should not trigger
        for (let i = 0; i < 9999; i++) {
          customService.recordTurn();
        }
        expect(customService.checkForLoop()).toBeNull();

        // Record 10000th turn - should trigger
        customService.recordTurn();
        const loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('turn-limit');
        expect(loop!.count).toBe(10000);
      });

      it('should preserve configuration after reset', () => {
        const customService = new LoopDetectionService({
          maxTurns: 15,
          repeatThreshold: 4,
        });

        // Trigger a loop
        for (let i = 0; i < 15; i++) {
          customService.recordTurn();
        }
        customService.checkForLoop();

        // Reset service
        customService.reset();

        // Configuration should still be preserved
        for (let i = 0; i < 15; i++) {
          customService.recordTurn();
        }
        const loop = customService.checkForLoop();
        expect(loop).not.toBeNull();
        expect(loop!.type).toBe('turn-limit');
        expect(loop!.count).toBe(15);
      });
    });
  });
});
