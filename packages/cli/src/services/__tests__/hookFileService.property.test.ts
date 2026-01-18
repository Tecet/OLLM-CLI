/**
 * Property-based tests for HookFileService validation
 * Feature: stage-06c-hooks-panel-ui
 * Task: 5.4.2 Property: Hook validation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { HookFileService } from '../hookFileService.js';
import type { UIHookEventType, UIHookActionType } from '../../features/hooks/types.js';

describe('HookFileService Property Tests', () => {
  const service = new HookFileService();

  /**
   * Property 1: Valid hooks always pass validation
   * For any hook with all required fields and valid values,
   * validation should succeed.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 1: Valid hooks pass validation
   * Validates: Requirements 3.2, 6.1
   */
  it('Property 1: Valid hooks always pass validation', () => {
    // Generator for valid event types
    const validEventTypeArb = fc.constantFrom<UIHookEventType>(
      'fileEdited',
      'fileCreated',
      'fileDeleted',
      'userTriggered',
      'promptSubmit',
      'agentStop'
    );

    // Generator for valid action types
    const validActionTypeArb = fc.constantFrom<UIHookActionType>(
      'askAgent',
      'runCommand'
    );

    // Generator for file patterns (non-empty, non-whitespace)
    const filePatternsArb = fc.array(
      fc.oneof(
        fc.constant('*.ts'),
        fc.constant('*.tsx'),
        fc.constant('*.js'),
        fc.constant('*.json'),
        fc.constant('**/*.test.ts'),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0).map(s => `*.${s}`)
      ),
      { minLength: 1, maxLength: 5 }
    );

    // Generator for valid hooks
    const validHookArb = fc
      .record({
        name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        version: fc.oneof(
          fc.constant('1.0.0'),
          fc.constant('2.0.0'),
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0)
        ),
        description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
        eventType: validEventTypeArb,
        actionType: validActionTypeArb,
        prompt: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
        command: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
      })
      .chain((base) => {
        // File events need patterns
        const fileEventTypes: UIHookEventType[] = ['fileEdited', 'fileCreated', 'fileDeleted'];
        const needsPatterns = fileEventTypes.includes(base.eventType);

        return fc.record({
          name: fc.constant(base.name),
          version: fc.constant(base.version),
          description: fc.constant(base.description),
          when: fc.record({
            type: fc.constant(base.eventType),
            patterns: needsPatterns ? filePatternsArb : fc.constant(undefined),
          }),
          then: fc.record({
            type: fc.constant(base.actionType),
            prompt: base.actionType === 'askAgent' ? fc.constant(base.prompt) : fc.constant(undefined),
            command: base.actionType === 'runCommand' ? fc.constant(base.command) : fc.constant(undefined),
          }),
        });
      });

    fc.assert(
      fc.property(validHookArb, (hookData) => {
        const validation = service.validateHook(hookData);

        // Should be valid
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2: Invalid hooks always fail validation with descriptive errors
   * For any hook with missing required fields or invalid values,
   * validation should fail and provide clear error messages.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 2: Invalid hooks fail validation
   * Validates: Requirements 3.2, 6.1
   */
  it('Property 2: Invalid hooks always fail validation with descriptive errors', () => {
    // Generator for invalid hooks
    const invalidHookArb = fc.oneof(
      // Missing name
      fc.record({
        name: fc.constantFrom('', '   ', undefined as any, null as any),
        when: fc.record({
          type: fc.constant('fileEdited' as UIHookEventType),
          patterns: fc.constant(['*.ts']),
        }),
        then: fc.record({
          type: fc.constant('askAgent' as UIHookActionType),
          prompt: fc.constant('test prompt'),
        }),
      }),

      // Missing when object
      fc.record({
        name: fc.constant('test-hook'),
        when: fc.constantFrom(undefined as any, null as any, 'invalid' as any),
        then: fc.record({
          type: fc.constant('askAgent' as UIHookActionType),
          prompt: fc.constant('test prompt'),
        }),
      }),

      // Missing when.type
      fc.record({
        name: fc.constant('test-hook'),
        when: fc.record({
          type: fc.constantFrom(undefined as any, null as any, '' as any),
          patterns: fc.constant(['*.ts']),
        }),
        then: fc.record({
          type: fc.constant('askAgent' as UIHookActionType),
          prompt: fc.constant('test prompt'),
        }),
      }),

      // Invalid event type
      fc.record({
        name: fc.constant('test-hook'),
        when: fc.record({
          type: fc.constantFrom('invalidEvent', 'wrongType', 'badEvent') as any,
          patterns: fc.constant(['*.ts']),
        }),
        then: fc.record({
          type: fc.constant('askAgent' as UIHookActionType),
          prompt: fc.constant('test prompt'),
        }),
      }),

      // File event without patterns
      fc.record({
        name: fc.constant('test-hook'),
        when: fc.record({
          type: fc.constantFrom('fileEdited', 'fileCreated', 'fileDeleted') as any,
          patterns: fc.constantFrom(undefined as any, null as any, [] as any),
        }),
        then: fc.record({
          type: fc.constant('askAgent' as UIHookActionType),
          prompt: fc.constant('test prompt'),
        }),
      }),

      // Missing then object
      fc.record({
        name: fc.constant('test-hook'),
        when: fc.record({
          type: fc.constant('userTriggered' as UIHookEventType),
        }),
        then: fc.constantFrom(undefined as any, null as any, 'invalid' as any),
      }),

      // Invalid action type
      fc.record({
        name: fc.constant('test-hook'),
        when: fc.record({
          type: fc.constant('userTriggered' as UIHookEventType),
        }),
        then: fc.record({
          type: fc.constantFrom('invalidAction', 'wrongAction', 'badAction') as any,
          prompt: fc.constant('test prompt'),
        }),
      }),

      // askAgent without prompt
      fc.record({
        name: fc.constant('test-hook'),
        when: fc.record({
          type: fc.constant('userTriggered' as UIHookEventType),
        }),
        then: fc.record({
          type: fc.constant('askAgent' as UIHookActionType),
          prompt: fc.constantFrom(undefined as any, null as any, '' as any, '   ' as any),
        }),
      }),

      // runCommand without command
      fc.record({
        name: fc.constant('test-hook'),
        when: fc.record({
          type: fc.constant('userTriggered' as UIHookEventType),
        }),
        then: fc.record({
          type: fc.constant('runCommand' as UIHookActionType),
          command: fc.constantFrom(undefined as any, null as any, '' as any, '   ' as any),
        }),
      })
    );

    fc.assert(
      fc.property(invalidHookArb, (hookData) => {
        const validation = service.validateHook(hookData);

        // Should be invalid
        expect(validation.valid).toBe(false);

        // Should have at least one error
        expect(validation.errors.length).toBeGreaterThan(0);

        // Each error should be a non-empty string
        for (const error of validation.errors) {
          expect(typeof error).toBe('string');
          expect(error.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property 3: Validation is deterministic
   * For any hook data, running validation multiple times
   * should always produce the same result.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 3: Validation is deterministic
   * Validates: Requirements 3.2, 6.1
   */
  it('Property 3: Validation is deterministic', () => {
    // Generator for any hook data (valid or invalid)
    const anyHookArb = fc.record({
      name: fc.option(fc.string(), { nil: undefined }),
      version: fc.option(fc.string(), { nil: undefined }),
      description: fc.option(fc.string(), { nil: undefined }),
      when: fc.option(
        fc.record({
          type: fc.option(fc.string(), { nil: undefined }),
          patterns: fc.option(fc.array(fc.string()), { nil: undefined }),
        }),
        { nil: undefined }
      ),
      then: fc.option(
        fc.record({
          type: fc.option(fc.string(), { nil: undefined }),
          prompt: fc.option(fc.string(), { nil: undefined }),
          command: fc.option(fc.string(), { nil: undefined }),
        }),
        { nil: undefined }
      ),
    });

    fc.assert(
      fc.property(anyHookArb, (hookData) => {
        // Run validation multiple times
        const result1 = service.validateHook(hookData);
        const result2 = service.validateHook(hookData);
        const result3 = service.validateHook(hookData);

        // All results should be identical
        expect(result1.valid).toBe(result2.valid);
        expect(result2.valid).toBe(result3.valid);

        expect(result1.errors).toEqual(result2.errors);
        expect(result2.errors).toEqual(result3.errors);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: File event validation consistency
   * For any file event type (fileEdited, fileCreated, fileDeleted),
   * validation should require patterns and reject empty pattern arrays.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 4: File event validation
   * Validates: Requirements 3.2, 6.1
   */
  it('Property 4: File event types always require patterns', () => {
    const fileEventTypeArb = fc.constantFrom<UIHookEventType>(
      'fileEdited',
      'fileCreated',
      'fileDeleted'
    );

    const actionArb = fc.oneof(
      fc.record({
        type: fc.constant('askAgent' as UIHookActionType),
        prompt: fc.constant('test prompt'),
      }),
      fc.record({
        type: fc.constant('runCommand' as UIHookActionType),
        command: fc.constant('test command'),
      })
    );

    fc.assert(
      fc.property(fileEventTypeArb, actionArb, (eventType, action) => {
        // Hook without patterns
        const hookWithoutPatterns = {
          name: 'test-hook',
          when: {
            type: eventType,
            // No patterns
          },
          then: action,
        };

        const validation1 = service.validateHook(hookWithoutPatterns);
        expect(validation1.valid).toBe(false);
        expect(validation1.errors.some(e => e.includes('pattern'))).toBe(true);

        // Hook with empty patterns array
        const hookWithEmptyPatterns = {
          name: 'test-hook',
          when: {
            type: eventType,
            patterns: [],
          },
          then: action,
        };

        const validation2 = service.validateHook(hookWithEmptyPatterns);
        expect(validation2.valid).toBe(false);
        expect(validation2.errors.some(e => e.includes('pattern'))).toBe(true);

        // Hook with valid patterns
        const hookWithPatterns = {
          name: 'test-hook',
          when: {
            type: eventType,
            patterns: ['*.ts'],
          },
          then: action,
        };

        const validation3 = service.validateHook(hookWithPatterns);
        expect(validation3.valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Action type validation consistency
   * askAgent actions must have a prompt, runCommand actions must have a command.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 5: Action type validation
   * Validates: Requirements 3.2, 6.1
   */
  it('Property 5: Action types require appropriate fields', () => {
    const eventArb = fc.oneof(
      fc.record({
        type: fc.constant('userTriggered' as UIHookEventType),
      }),
      fc.record({
        type: fc.constant('promptSubmit' as UIHookEventType),
      }),
      fc.record({
        type: fc.constant('agentStop' as UIHookEventType),
      })
    );

    fc.assert(
      fc.property(eventArb, (when) => {
        // askAgent without prompt should fail
        const askAgentWithoutPrompt = {
          name: 'test-hook',
          when,
          then: {
            type: 'askAgent' as UIHookActionType,
            // No prompt
          },
        };

        const validation1 = service.validateHook(askAgentWithoutPrompt);
        expect(validation1.valid).toBe(false);
        expect(validation1.errors.some(e => e.includes('prompt'))).toBe(true);

        // askAgent with empty prompt should fail
        const askAgentWithEmptyPrompt = {
          name: 'test-hook',
          when,
          then: {
            type: 'askAgent' as UIHookActionType,
            prompt: '   ',
          },
        };

        const validation2 = service.validateHook(askAgentWithEmptyPrompt);
        expect(validation2.valid).toBe(false);
        expect(validation2.errors.some(e => e.includes('prompt'))).toBe(true);

        // askAgent with valid prompt should pass
        const askAgentWithPrompt = {
          name: 'test-hook',
          when,
          then: {
            type: 'askAgent' as UIHookActionType,
            prompt: 'Do something',
          },
        };

        const validation3 = service.validateHook(askAgentWithPrompt);
        expect(validation3.valid).toBe(true);

        // runCommand without command should fail
        const runCommandWithoutCommand = {
          name: 'test-hook',
          when,
          then: {
            type: 'runCommand' as UIHookActionType,
            // No command
          },
        };

        const validation4 = service.validateHook(runCommandWithoutCommand);
        expect(validation4.valid).toBe(false);
        expect(validation4.errors.some(e => e.includes('command'))).toBe(true);

        // runCommand with empty command should fail
        const runCommandWithEmptyCommand = {
          name: 'test-hook',
          when,
          then: {
            type: 'runCommand' as UIHookActionType,
            command: '   ',
          },
        };

        const validation5 = service.validateHook(runCommandWithEmptyCommand);
        expect(validation5.valid).toBe(false);
        expect(validation5.errors.some(e => e.includes('command'))).toBe(true);

        // runCommand with valid command should pass
        const runCommandWithCommand = {
          name: 'test-hook',
          when,
          then: {
            type: 'runCommand' as UIHookActionType,
            command: 'npm test',
          },
        };

        const validation6 = service.validateHook(runCommandWithCommand);
        expect(validation6.valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property-based tests for HookFileService file persistence
 * Feature: stage-06c-hooks-panel-ui
 * Task: 5.4.3 Property: File persistence
 * 
 * **Validates: Requirements 3.1, 4.2**
 */
describe('HookFileService File Persistence Property Tests', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  let service: HookFileService;
  let testDir: string;
  
  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `ollm-test-hooks-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.promises.mkdir(testDir, { recursive: true });
    
    // Create service with test directory
    service = new HookFileService();
    // Override the user hooks directory for testing
    (service as any).userHooksDir = testDir;
  });
  
  afterEach(async () => {
    // Clean up test directory
    try {
      if (fs.existsSync(testDir)) {
        await fs.promises.rm(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
  });

  /**
   * Property 6: Save-Load Round Trip Preserves Data
   * For any valid hook, saving it to disk and loading it back
   * should preserve all the hook data (excluding runtime fields).
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 6: File persistence round trip
   * **Validates: Requirements 3.1, 4.2**
   */
  it('Property 6: Save-Load round trip preserves hook data', async () => {
    // Generator for valid event types
    const validEventTypeArb = fc.constantFrom<UIHookEventType>(
      'fileEdited',
      'fileCreated',
      'fileDeleted',
      'userTriggered',
      'promptSubmit',
      'agentStop'
    );

    // Generator for valid action types
    const validActionTypeArb = fc.constantFrom<UIHookActionType>(
      'askAgent',
      'runCommand'
    );

    // Generator for file patterns
    const filePatternsArb = fc.array(
      fc.oneof(
        fc.constant('*.ts'),
        fc.constant('*.tsx'),
        fc.constant('*.js'),
        fc.constant('*.json'),
        fc.constant('**/*.test.ts'),
        fc.string({ minLength: 1, maxLength: 20 }).map(s => `*.${s}`)
      ),
      { minLength: 1, maxLength: 5 }
    );

    // Generator for hook IDs (alphanumeric with dashes)
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);

    // Generator for valid UIHook objects
    const validUIHookArb = fc
      .record({
        id: hookIdArb,
        name: fc.string({ minLength: 1, maxLength: 50 }),
        version: fc.oneof(
          fc.constant('1.0.0'),
          fc.constant('2.0.0'),
          fc.string({ minLength: 1, maxLength: 10 })
        ),
        description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
        eventType: validEventTypeArb,
        actionType: validActionTypeArb,
        prompt: fc.string({ minLength: 1, maxLength: 500 }),
        command: fc.string({ minLength: 1, maxLength: 200 }),
      })
      .chain((base) => {
        // File events need patterns
        const fileEventTypes: UIHookEventType[] = ['fileEdited', 'fileCreated', 'fileDeleted'];
        const needsPatterns = fileEventTypes.includes(base.eventType);

        return fc.record({
          id: fc.constant(base.id),
          name: fc.constant(base.name),
          version: fc.constant(base.version),
          description: fc.constant(base.description),
          when: fc.record({
            type: fc.constant(base.eventType),
            patterns: needsPatterns ? filePatternsArb : fc.constant(undefined),
          }),
          then: fc.record({
            type: fc.constant(base.actionType),
            prompt: base.actionType === 'askAgent' ? fc.constant(base.prompt) : fc.constant(undefined),
            command: base.actionType === 'runCommand' ? fc.constant(base.command) : fc.constant(undefined),
          }),
          enabled: fc.constant(true),
          trusted: fc.constant(false),
          source: fc.constant('user' as const),
        });
      });

    await fc.assert(
      fc.asyncProperty(validUIHookArb, async (hook) => {
        // Save the hook
        await service.saveHook(hook);

        // Verify file was created
        const filePath = path.join(testDir, `${hook.id}.json`);
        expect(fs.existsSync(filePath)).toBe(true);

        // Load hooks back
        const loadedHooks = await service.loadUserHooks();

        // Should have exactly one hook
        expect(loadedHooks).toHaveLength(1);

        const loadedHook = loadedHooks[0];

        // Verify all persisted fields match
        expect(loadedHook.id).toBe(hook.id);
        expect(loadedHook.name).toBe(hook.name);
        expect(loadedHook.version).toBe(hook.version);
        expect(loadedHook.description).toBe(hook.description);
        expect(loadedHook.when.type).toBe(hook.when.type);
        expect(loadedHook.when.patterns).toEqual(hook.when.patterns);
        expect(loadedHook.then.type).toBe(hook.then.type);
        expect(loadedHook.then.prompt).toBe(hook.then.prompt);
        expect(loadedHook.then.command).toBe(hook.then.command);
        expect(loadedHook.source).toBe('user');

        // Clean up for next iteration
        await fs.promises.unlink(filePath);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Special Characters in Hook Data
   * Hooks with special characters in names, descriptions, prompts, and commands
   * should be saved and loaded correctly without corruption.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 7: Special character handling
   * **Validates: Requirements 3.1, 4.2**
   */
  it('Property 7: Special characters are preserved in save-load cycle', async () => {
    // Generator for strings with special characters
    const specialStringArb = fc.oneof(
      fc.constant('Test with "quotes"'),
      fc.constant("Test with 'single quotes'"),
      fc.constant('Test with\nnewlines\nhere'),
      fc.constant('Test with\ttabs\there'),
      fc.constant('Test with unicode: 你好 🎉 ñ'),
      fc.constant('Test with backslash: C:\\path\\to\\file'),
      fc.constant('Test with forward slash: /path/to/file'),
      fc.constant('Test with special chars: @#$%^&*()'),
      fc.constant('Test with brackets: []{}<>'),
      fc.constant('Test with JSON-like: {"key": "value"}'),
      fc.string({ minLength: 1, maxLength: 100 })
    );

    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);

    const specialCharHookArb = fc.record({
      id: hookIdArb,
      name: specialStringArb,
      version: fc.constant('1.0.0'),
      description: specialStringArb,
      when: fc.record({
        type: fc.constant('userTriggered' as UIHookEventType),
      }),
      then: fc.record({
        type: fc.constant('askAgent' as UIHookActionType),
        prompt: specialStringArb,
      }),
      enabled: fc.constant(true),
      trusted: fc.constant(false),
      source: fc.constant('user' as const),
    });

    await fc.assert(
      fc.asyncProperty(specialCharHookArb, async (hook) => {
        // Save the hook
        await service.saveHook(hook);

        // Load it back
        const loadedHooks = await service.loadUserHooks();
        expect(loadedHooks).toHaveLength(1);

        const loadedHook = loadedHooks[0];

        // All special characters should be preserved exactly
        expect(loadedHook.name).toBe(hook.name);
        expect(loadedHook.description).toBe(hook.description);
        expect(loadedHook.then.prompt).toBe(hook.then.prompt);

        // Clean up
        const filePath = path.join(testDir, `${hook.id}.json`);
        await fs.promises.unlink(filePath);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 8: Multiple Hooks Persistence
   * Saving multiple hooks should create separate files,
   * and loading should retrieve all of them correctly.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 8: Multiple hooks persistence
   * **Validates: Requirements 3.1, 4.2**
   */
  it('Property 8: Multiple hooks can be saved and loaded independently', async () => {
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);

    const simpleHookArb = fc.record({
      id: hookIdArb,
      name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      version: fc.constant('1.0.0'),
      description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
      when: fc.record({
        type: fc.constant('userTriggered' as UIHookEventType),
      }),
      then: fc.record({
        type: fc.constant('askAgent' as UIHookActionType),
        prompt: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      }),
      enabled: fc.constant(true),
      trusted: fc.constant(false),
      source: fc.constant('user' as const),
    });

    // Generate array of hooks with unique IDs
    const uniqueHooksArb = fc
      .array(simpleHookArb, { minLength: 2, maxLength: 10 })
      .map((hooks) => {
        // Ensure unique IDs
        const uniqueIds = new Set<string>();
        return hooks.filter((hook) => {
          if (uniqueIds.has(hook.id)) {
            return false;
          }
          uniqueIds.add(hook.id);
          return true;
        });
      })
      .filter((hooks) => hooks.length >= 2);

    await fc.assert(
      fc.asyncProperty(uniqueHooksArb, async (hooks) => {
        // Save all hooks
        for (const hook of hooks) {
          await service.saveHook(hook);
        }

        // Verify all files were created
        for (const hook of hooks) {
          const filePath = path.join(testDir, `${hook.id}.json`);
          expect(fs.existsSync(filePath)).toBe(true);
        }

        // Load all hooks
        const loadedHooks = await service.loadUserHooks();

        // Should have same number of hooks
        expect(loadedHooks).toHaveLength(hooks.length);

        // Each original hook should have a matching loaded hook
        for (const originalHook of hooks) {
          const loadedHook = loadedHooks.find((h) => h.id === originalHook.id);
          expect(loadedHook).toBeDefined();
          expect(loadedHook!.name).toBe(originalHook.name);
          expect(loadedHook!.description).toBe(originalHook.description);
          expect(loadedHook!.then.prompt).toBe(originalHook.then.prompt);
        }

        // Clean up
        for (const hook of hooks) {
          const filePath = path.join(testDir, `${hook.id}.json`);
          await fs.promises.unlink(filePath);
        }
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 9: Update Preserves Unchanged Fields
   * When updating a hook, fields that are not in the update
   * should remain unchanged.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 9: Partial update preservation
   * **Validates: Requirements 3.1, 4.2**
   */
  it('Property 9: Updating a hook preserves unchanged fields', async () => {
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);

    const initialHookArb = fc.record({
      id: hookIdArb,
      name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      version: fc.constant('1.0.0'),
      description: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      when: fc.record({
        type: fc.constant('userTriggered' as UIHookEventType),
      }),
      then: fc.record({
        type: fc.constant('askAgent' as UIHookActionType),
        prompt: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      }),
      enabled: fc.constant(true),
      trusted: fc.constant(false),
      source: fc.constant('user' as const),
    });

    const updateArb = fc.record({
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { nil: undefined }),
      description: fc.option(fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), { nil: undefined }),
    });

    await fc.assert(
      fc.asyncProperty(initialHookArb, updateArb, async (initialHook, update) => {
        // Save initial hook
        await service.saveHook(initialHook);

        // Update the hook
        await service.updateHook(initialHook.id, update);

        // Load it back
        const loadedHooks = await service.loadUserHooks();
        expect(loadedHooks).toHaveLength(1);

        const loadedHook = loadedHooks[0];

        // Updated fields should have new values
        if (update.name !== undefined) {
          expect(loadedHook.name).toBe(update.name);
        } else {
          expect(loadedHook.name).toBe(initialHook.name);
        }

        if (update.description !== undefined) {
          expect(loadedHook.description).toBe(update.description);
        } else {
          expect(loadedHook.description).toBe(initialHook.description);
        }

        // Unchanged fields should remain the same
        expect(loadedHook.version).toBe(initialHook.version);
        expect(loadedHook.when.type).toBe(initialHook.when.type);
        expect(loadedHook.then.type).toBe(initialHook.then.type);
        expect(loadedHook.then.prompt).toBe(initialHook.then.prompt);

        // Clean up
        const filePath = path.join(testDir, `${initialHook.id}.json`);
        await fs.promises.unlink(filePath);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10: Delete Removes File Completely
   * Deleting a hook should remove its file from disk,
   * and subsequent loads should not include it.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 10: Delete completeness
   * **Validates: Requirements 3.1, 4.2**
   */
  it('Property 10: Deleting a hook removes it completely', async () => {
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);

    const simpleHookArb = fc.record({
      id: hookIdArb,
      name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      version: fc.constant('1.0.0'),
      description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
      when: fc.record({
        type: fc.constant('userTriggered' as UIHookEventType),
      }),
      then: fc.record({
        type: fc.constant('askAgent' as UIHookActionType),
        prompt: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      }),
      enabled: fc.constant(true),
      trusted: fc.constant(false),
      source: fc.constant('user' as const),
    });

    await fc.assert(
      fc.asyncProperty(simpleHookArb, async (hook) => {
        // Save the hook
        await service.saveHook(hook);

        // Verify file exists
        const filePath = path.join(testDir, `${hook.id}.json`);
        expect(fs.existsSync(filePath)).toBe(true);

        // Delete the hook
        await service.deleteHook(hook.id);

        // Verify file is gone
        expect(fs.existsSync(filePath)).toBe(false);

        // Load hooks should return empty array
        const loadedHooks = await service.loadUserHooks();
        expect(loadedHooks).toHaveLength(0);
      }),
      { numRuns: 50 }
    );
  });
});
