/**
 * Tests for Write Todos Tool
 *
 * Property-based tests for todo list management.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WriteTodosTool, Todo } from '../write-todos.js';
import { MockMessageBus, createMockAbortSignal , createToolContext} from './test-helpers.js';

/**
 * Test fixture for todo operations
 */
class TodoTestFixture {
  private tempDir: string = '';
  private todosPath: string = '';

  async setup(): Promise<void> {
    // Create a temporary directory for test files
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todos-test-'));
    this.todosPath = path.join(this.tempDir, 'todos.json');
  }

  async cleanup(): Promise<void> {
    // Clean up the temp directory
        try {
          await fs.rm(this.tempDir, { recursive: true, force: true });
        } catch (_error) {
          // Ignore
        }  }

  getTodosPath(): string {
    return this.todosPath;
  }

  getTempDir(): string {
    return this.tempDir;
  }

  /**
   * Get a unique todos path for isolated tests
   */
  getUniqueTodosPath(): string {
    return path.join(this.tempDir, `todos-${Date.now()}-${Math.random().toString(36).substring(7)}.json`);
  }

  /**
   * Read todos directly from disk for verification
   */
  async readTodosFromDisk(todosPath: string): Promise<Todo[]> {
    try {
      const content = await fs.readFile(todosPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }
}

/**
 * Filter for valid task descriptions
 * Tasks should be non-empty strings without control characters
 */
function isValidTask(s: string): boolean {
  // Filter out empty strings and strings with only whitespace
  if (s.trim().length === 0) return false;
  // Filter out tasks with control characters (except newlines which might be valid)
  if (/[\0\r\t]/.test(s)) return false;
  // Limit task length for practical testing
  if (s.length > 500) return false;
  return true;
}

describe('Write Todos Tool', () => {
  let fixture: TodoTestFixture;
  let messageBus: MockMessageBus;

  beforeEach(async () => {
    fixture = new TodoTestFixture();
    await fixture.setup();
    messageBus = new MockMessageBus();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Property 53: Todo Addition', () => {
    it('should add a todo with a unique ID and append it to the list', async () => {
      // Feature: stage-03-tools-policy, Property 53: Todo Addition
      // **Validates: Requirements 11.5**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter(isValidTask),
          async (task) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add the todo
            const addInvocation = tool.createInvocation(
              { action: 'add', task },
              createToolContext(messageBus)
            );
            const addResult = await addInvocation.execute(createMockAbortSignal());

            // Add should succeed without error
            expect(addResult.error).toBeUndefined();
            expect(addResult.llmContent).toContain('Added todo');

            // Verify the todo was persisted with a unique ID
            const todos = await fixture.readTodosFromDisk(todosPath);
            expect(todos.length).toBe(1);
            expect(todos[0].task).toBe(task);
            expect(todos[0].id).toBeDefined();
            expect(typeof todos[0].id).toBe('string');
            expect(todos[0].id.length).toBeGreaterThan(0);
            expect(todos[0].completed).toBe(false);
            expect(todos[0].createdAt).toBeDefined();

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should generate unique IDs for each added todo', async () => {
      // Feature: stage-03-tools-policy, Property 53: Todo Addition
      // **Validates: Requirements 11.5**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(isValidTask),
            { minLength: 2, maxLength: 10 }
          ),
          async (tasks) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add all todos
            for (const task of tasks) {
              const addInvocation = tool.createInvocation(
                { action: 'add', task },
                createToolContext(messageBus)
              );
              const addResult = await addInvocation.execute(createMockAbortSignal());
              expect(addResult.error).toBeUndefined();
            }

            // Verify all IDs are unique
            const todos = await fixture.readTodosFromDisk(todosPath);
            expect(todos.length).toBe(tasks.length);

            const ids = todos.map((t) => t.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should append todos to the list preserving order', async () => {
      // Feature: stage-03-tools-policy, Property 53: Todo Addition
      // **Validates: Requirements 11.5**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(isValidTask),
            { minLength: 1, maxLength: 10 }
          ),
          async (tasks) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add all todos in order
            for (const task of tasks) {
              const addInvocation = tool.createInvocation(
                { action: 'add', task },
                createToolContext(messageBus)
              );
              const addResult = await addInvocation.execute(createMockAbortSignal());
              expect(addResult.error).toBeUndefined();
            }

            // Verify todos are in the same order as added
            const todos = await fixture.readTodosFromDisk(todosPath);
            expect(todos.length).toBe(tasks.length);

            for (let i = 0; i < tasks.length; i++) {
              expect(todos[i].task).toBe(tasks[i]);
            }

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should persist todos across tool recreation', async () => {
      // Feature: stage-03-tools-policy, Property 53: Todo Addition
      // **Validates: Requirements 11.5**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter(isValidTask),
          async (task) => {
            const todosPath = fixture.getUniqueTodosPath();

            // Create first tool instance and add todo
            const tool1 = new WriteTodosTool(todosPath);
            const addInvocation = tool1.createInvocation(
              { action: 'add', task },
              createToolContext(messageBus)
            );
            const addResult = await addInvocation.execute(createMockAbortSignal());
            expect(addResult.error).toBeUndefined();

            // Create a NEW tool instance pointing to the same file
            const tool2 = new WriteTodosTool(todosPath);
            const listInvocation = tool2.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // Should see the todo from the new instance
            expect(listResult.error).toBeUndefined();
            expect(listResult.llmContent).toContain(task);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should initialize new todos with completed=false', async () => {
      // Feature: stage-03-tools-policy, Property 53: Todo Addition
      // **Validates: Requirements 11.5**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(isValidTask),
            { minLength: 1, maxLength: 10 }
          ),
          async (tasks) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add all todos
            for (const task of tasks) {
              const addInvocation = tool.createInvocation(
                { action: 'add', task },
                createToolContext(messageBus)
              );
              await addInvocation.execute(createMockAbortSignal());
            }

            // Verify all todos are not completed
            const todos = await fixture.readTodosFromDisk(todosPath);
            for (const todo of todos) {
              expect(todo.completed).toBe(false);
            }

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should set createdAt timestamp on new todos', async () => {
      // Feature: stage-03-tools-policy, Property 53: Todo Addition
      // **Validates: Requirements 11.5**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter(isValidTask),
          async (task) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            const beforeAdd = new Date().toISOString();

            // Add the todo
            const addInvocation = tool.createInvocation(
              { action: 'add', task },
              createToolContext(messageBus)
            );
            await addInvocation.execute(createMockAbortSignal());

            const afterAdd = new Date().toISOString();

            // Verify createdAt is a valid ISO timestamp within the expected range
            const todos = await fixture.readTodosFromDisk(todosPath);
            expect(todos.length).toBe(1);
            expect(todos[0].createdAt).toBeDefined();

            // Parse and validate the timestamp
            const createdAt = new Date(todos[0].createdAt);
            expect(createdAt.toISOString()).toBe(todos[0].createdAt);
            expect(todos[0].createdAt >= beforeAdd).toBe(true);
            expect(todos[0].createdAt <= afterAdd).toBe(true);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });
  });


  describe('Property 54: Todo Completion', () => {
    it('should mark a todo as complete when completing it', async () => {
      // Feature: stage-03-tools-policy, Property 54: Todo Completion
      // **Validates: Requirements 11.6**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter(isValidTask),
          async (task) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // First add a todo
            const addInvocation = tool.createInvocation(
              { action: 'add', task },
              createToolContext(messageBus)
            );
            const addResult = await addInvocation.execute(createMockAbortSignal());
            expect(addResult.error).toBeUndefined();

            // Get the ID of the added todo
            const todosAfterAdd = await fixture.readTodosFromDisk(todosPath);
            expect(todosAfterAdd.length).toBe(1);
            const todoId = todosAfterAdd[0].id;
            expect(todosAfterAdd[0].completed).toBe(false);

            // Complete the todo
            const completeInvocation = tool.createInvocation(
              { action: 'complete', id: todoId },
              createToolContext(messageBus)
            );
            const completeResult = await completeInvocation.execute(createMockAbortSignal());

            // Complete should succeed without error
            expect(completeResult.error).toBeUndefined();
            expect(completeResult.llmContent).toContain('Completed todo');

            // Verify the todo is now marked as complete
            const todosAfterComplete = await fixture.readTodosFromDisk(todosPath);
            expect(todosAfterComplete.length).toBe(1);
            expect(todosAfterComplete[0].id).toBe(todoId);
            expect(todosAfterComplete[0].completed).toBe(true);
            // Task should remain unchanged
            expect(todosAfterComplete[0].task).toBe(task);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should preserve other todos when completing one', async () => {
      // Feature: stage-03-tools-policy, Property 54: Todo Completion
      // **Validates: Requirements 11.6**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(isValidTask),
            { minLength: 2, maxLength: 10 }
          ),
          fc.nat(),
          async (tasks, indexSeed) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add all todos
            for (const task of tasks) {
              const addInvocation = tool.createInvocation(
                { action: 'add', task },
                createToolContext(messageBus)
              );
              const addResult = await addInvocation.execute(createMockAbortSignal());
              expect(addResult.error).toBeUndefined();
            }

            // Get todos and select one to complete
            const todosBeforeComplete = await fixture.readTodosFromDisk(todosPath);
            const indexToComplete = indexSeed % todosBeforeComplete.length;
            const todoToComplete = todosBeforeComplete[indexToComplete];

            // Complete the selected todo
            const completeInvocation = tool.createInvocation(
              { action: 'complete', id: todoToComplete.id },
              createToolContext(messageBus)
            );
            const completeResult = await completeInvocation.execute(createMockAbortSignal());
            expect(completeResult.error).toBeUndefined();

            // Verify the completed todo is marked complete
            const todosAfterComplete = await fixture.readTodosFromDisk(todosPath);
            expect(todosAfterComplete.length).toBe(tasks.length);

            for (let i = 0; i < todosAfterComplete.length; i++) {
              const todo = todosAfterComplete[i];
              if (i === indexToComplete) {
                // This one should be completed
                expect(todo.completed).toBe(true);
              } else {
                // Others should remain unchanged (not completed)
                expect(todo.completed).toBe(false);
              }
              // All tasks should be preserved
              expect(todo.task).toBe(tasks[i]);
            }

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should return error when completing non-existent todo', async () => {
      // Feature: stage-03-tools-policy, Property 54: Todo Completion
      // **Validates: Requirements 11.6**
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (fakeId) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Try to complete a non-existent todo
            const completeInvocation = tool.createInvocation(
              { action: 'complete', id: fakeId },
              createToolContext(messageBus)
            );
            const completeResult = await completeInvocation.execute(createMockAbortSignal());

            // Should return an error
            expect(completeResult.error).toBeDefined();
            expect(completeResult.error?.type).toBe('NotFoundError');
            expect(completeResult.error?.message).toContain(fakeId);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should handle completing an already completed todo', async () => {
      // Feature: stage-03-tools-policy, Property 54: Todo Completion
      // **Validates: Requirements 11.6**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter(isValidTask),
          async (task) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add a todo
            const addInvocation = tool.createInvocation(
              { action: 'add', task },
              createToolContext(messageBus)
            );
            await addInvocation.execute(createMockAbortSignal());

            // Get the ID
            const todos = await fixture.readTodosFromDisk(todosPath);
            const todoId = todos[0].id;

            // Complete it once
            const completeInvocation1 = tool.createInvocation(
              { action: 'complete', id: todoId },
              createToolContext(messageBus)
            );
            const result1 = await completeInvocation1.execute(createMockAbortSignal());
            expect(result1.error).toBeUndefined();

            // Complete it again (should handle gracefully)
            const completeInvocation2 = tool.createInvocation(
              { action: 'complete', id: todoId },
              createToolContext(messageBus)
            );
            const result2 = await completeInvocation2.execute(createMockAbortSignal());

            // Should not error, but indicate already completed
            expect(result2.error).toBeUndefined();
            expect(result2.llmContent).toContain('already completed');

            // Todo should still be completed
            const todosAfter = await fixture.readTodosFromDisk(todosPath);
            expect(todosAfter[0].completed).toBe(true);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should persist completion across tool recreation', async () => {
      // Feature: stage-03-tools-policy, Property 54: Todo Completion
      // **Validates: Requirements 11.6**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter(isValidTask),
          async (task) => {
            const todosPath = fixture.getUniqueTodosPath();

            // Create first tool instance and add todo
            const tool1 = new WriteTodosTool(todosPath);
            const addInvocation = tool1.createInvocation(
              { action: 'add', task },
              createToolContext(messageBus)
            );
            await addInvocation.execute(createMockAbortSignal());

            // Get the ID
            const todos = await fixture.readTodosFromDisk(todosPath);
            const todoId = todos[0].id;

            // Complete with first tool instance
            const completeInvocation = tool1.createInvocation(
              { action: 'complete', id: todoId },
              createToolContext(messageBus)
            );
            await completeInvocation.execute(createMockAbortSignal());

            // Create a NEW tool instance and verify completion persisted
            const tool2 = new WriteTodosTool(todosPath);
            const listInvocation = tool2.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // Should show the todo as completed (marked with [x])
            expect(listResult.error).toBeUndefined();
            expect(listResult.llmContent).toContain('[x]');
            expect(listResult.llmContent).toContain(task);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should return error when id is missing for complete action', async () => {
      // Feature: stage-03-tools-policy, Property 54: Todo Completion
      // **Validates: Requirements 11.6**
      const todosPath = fixture.getUniqueTodosPath();
      const tool = new WriteTodosTool(todosPath);

      const completeInvocation = tool.createInvocation(
        { action: 'complete' },
        createToolContext(messageBus)
      );
      const result = await completeInvocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
      expect(result.error?.message).toContain('ID required');
    });
  });

  describe('Property 55: Todo Removal', () => {
    it('should remove a todo from the list when removing it', async () => {
      // Feature: stage-03-tools-policy, Property 55: Todo Removal
      // **Validates: Requirements 11.7**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter(isValidTask),
          async (task) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // First add a todo
            const addInvocation = tool.createInvocation(
              { action: 'add', task },
              createToolContext(messageBus)
            );
            const addResult = await addInvocation.execute(createMockAbortSignal());
            expect(addResult.error).toBeUndefined();

            // Get the ID of the added todo
            const todosAfterAdd = await fixture.readTodosFromDisk(todosPath);
            expect(todosAfterAdd.length).toBe(1);
            const todoId = todosAfterAdd[0].id;

            // Remove the todo
            const removeInvocation = tool.createInvocation(
              { action: 'remove', id: todoId },
              createToolContext(messageBus)
            );
            const removeResult = await removeInvocation.execute(createMockAbortSignal());

            // Remove should succeed without error
            expect(removeResult.error).toBeUndefined();
            expect(removeResult.llmContent).toContain('Removed todo');

            // Verify the todo was removed from the list
            const todosAfterRemove = await fixture.readTodosFromDisk(todosPath);
            expect(todosAfterRemove.length).toBe(0);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should preserve other todos when removing one', async () => {
      // Feature: stage-03-tools-policy, Property 55: Todo Removal
      // **Validates: Requirements 11.7**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(isValidTask),
            { minLength: 2, maxLength: 10 }
          ),
          fc.nat(),
          async (tasks, indexSeed) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add all todos
            for (const task of tasks) {
              const addInvocation = tool.createInvocation(
                { action: 'add', task },
                createToolContext(messageBus)
              );
              const addResult = await addInvocation.execute(createMockAbortSignal());
              expect(addResult.error).toBeUndefined();
            }

            // Get todos and select one to remove
            const todosBeforeRemove = await fixture.readTodosFromDisk(todosPath);
            const indexToRemove = indexSeed % todosBeforeRemove.length;
            const todoToRemove = todosBeforeRemove[indexToRemove];

            // Remove the selected todo
            const removeInvocation = tool.createInvocation(
              { action: 'remove', id: todoToRemove.id },
              createToolContext(messageBus)
            );
            const removeResult = await removeInvocation.execute(createMockAbortSignal());
            expect(removeResult.error).toBeUndefined();

            // Verify the list has one fewer item
            const todosAfterRemove = await fixture.readTodosFromDisk(todosPath);
            expect(todosAfterRemove.length).toBe(tasks.length - 1);

            // Verify the removed todo is no longer in the list
            const removedTodoStillExists = todosAfterRemove.some(
              (t) => t.id === todoToRemove.id
            );
            expect(removedTodoStillExists).toBe(false);

            // Verify all other todos are preserved with correct tasks
            const remainingTasks = tasks.filter((_, i) => i !== indexToRemove);
            const actualTasks = todosAfterRemove.map((t) => t.task);
            expect(actualTasks).toEqual(remainingTasks);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should return error when removing non-existent todo', async () => {
      // Feature: stage-03-tools-policy, Property 55: Todo Removal
      // **Validates: Requirements 11.7**
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (fakeId) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Try to remove a non-existent todo
            const removeInvocation = tool.createInvocation(
              { action: 'remove', id: fakeId },
              createToolContext(messageBus)
            );
            const removeResult = await removeInvocation.execute(createMockAbortSignal());

            // Should return an error
            expect(removeResult.error).toBeDefined();
            expect(removeResult.error?.type).toBe('NotFoundError');
            expect(removeResult.error?.message).toContain(fakeId);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should persist removal across tool recreation', async () => {
      // Feature: stage-03-tools-policy, Property 55: Todo Removal
      // **Validates: Requirements 11.7**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter(isValidTask),
          async (task) => {
            const todosPath = fixture.getUniqueTodosPath();

            // Create first tool instance and add todo
            const tool1 = new WriteTodosTool(todosPath);
            const addInvocation = tool1.createInvocation(
              { action: 'add', task },
              createToolContext(messageBus)
            );
            await addInvocation.execute(createMockAbortSignal());

            // Get the ID
            const todos = await fixture.readTodosFromDisk(todosPath);
            const todoId = todos[0].id;

            // Remove with first tool instance
            const removeInvocation = tool1.createInvocation(
              { action: 'remove', id: todoId },
              createToolContext(messageBus)
            );
            await removeInvocation.execute(createMockAbortSignal());

            // Create a NEW tool instance and verify removal persisted
            const tool2 = new WriteTodosTool(todosPath);
            const listInvocation = tool2.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // Should show no todos
            expect(listResult.error).toBeUndefined();
            expect(listResult.llmContent).toBe('No todos');

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should return error when id is missing for remove action', async () => {
      // Feature: stage-03-tools-policy, Property 55: Todo Removal
      // **Validates: Requirements 11.7**
      const todosPath = fixture.getUniqueTodosPath();
      const tool = new WriteTodosTool(todosPath);

      const removeInvocation = tool.createInvocation(
        { action: 'remove' },
        createToolContext(messageBus)
      );
      const result = await removeInvocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
      expect(result.error?.message).toContain('ID required');
    });

    it('should allow removing completed todos', async () => {
      // Feature: stage-03-tools-policy, Property 55: Todo Removal
      // **Validates: Requirements 11.7**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter(isValidTask),
          async (task) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add a todo
            const addInvocation = tool.createInvocation(
              { action: 'add', task },
              createToolContext(messageBus)
            );
            await addInvocation.execute(createMockAbortSignal());

            // Get the ID
            const todos = await fixture.readTodosFromDisk(todosPath);
            const todoId = todos[0].id;

            // Complete it first
            const completeInvocation = tool.createInvocation(
              { action: 'complete', id: todoId },
              createToolContext(messageBus)
            );
            await completeInvocation.execute(createMockAbortSignal());

            // Now remove it
            const removeInvocation = tool.createInvocation(
              { action: 'remove', id: todoId },
              createToolContext(messageBus)
            );
            const removeResult = await removeInvocation.execute(createMockAbortSignal());

            // Should succeed
            expect(removeResult.error).toBeUndefined();
            expect(removeResult.llmContent).toContain('Removed todo');

            // Verify it's gone
            const todosAfter = await fixture.readTodosFromDisk(todosPath);
            expect(todosAfter.length).toBe(0);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });
  });

  describe('Property 56: Todo Listing', () => {
    it('should return all todos with their status', async () => {
      // Feature: stage-03-tools-policy, Property 56: Todo Listing
      // **Validates: Requirements 11.8**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(isValidTask),
            { minLength: 1, maxLength: 10 }
          ),
          async (tasks) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add all todos
            for (const task of tasks) {
              const addInvocation = tool.createInvocation(
                { action: 'add', task },
                createToolContext(messageBus)
              );
              const addResult = await addInvocation.execute(createMockAbortSignal());
              expect(addResult.error).toBeUndefined();
            }

            // List todos
            const listInvocation = tool.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // List should succeed without error
            expect(listResult.error).toBeUndefined();

            // Verify all tasks appear in the output
            for (const task of tasks) {
              expect(listResult.llmContent).toContain(task);
            }

            // Verify all todos show as not completed ([ ])
            const todos = await fixture.readTodosFromDisk(todosPath);
            for (const todo of todos) {
              expect(listResult.llmContent).toContain(`[ ] ${todo.id}: ${todo.task}`);
            }

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should show completed status correctly', async () => {
      // Feature: stage-03-tools-policy, Property 56: Todo Listing
      // **Validates: Requirements 11.8**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(isValidTask),
            { minLength: 2, maxLength: 10 }
          ),
          fc.nat(),
          async (tasks, indexSeed) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add all todos
            for (const task of tasks) {
              const addInvocation = tool.createInvocation(
                { action: 'add', task },
                createToolContext(messageBus)
              );
              await addInvocation.execute(createMockAbortSignal());
            }

            // Complete one todo
            const todosBeforeComplete = await fixture.readTodosFromDisk(todosPath);
            const indexToComplete = indexSeed % todosBeforeComplete.length;
            const todoToComplete = todosBeforeComplete[indexToComplete];

            const completeInvocation = tool.createInvocation(
              { action: 'complete', id: todoToComplete.id },
              createToolContext(messageBus)
            );
            await completeInvocation.execute(createMockAbortSignal());

            // List todos
            const listInvocation = tool.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // List should succeed without error
            expect(listResult.error).toBeUndefined();

            // Verify completed todo shows [x] and others show [ ]
            const todosAfterComplete = await fixture.readTodosFromDisk(todosPath);
            for (const todo of todosAfterComplete) {
              if (todo.id === todoToComplete.id) {
                expect(listResult.llmContent).toContain(`[x] ${todo.id}: ${todo.task}`);
              } else {
                expect(listResult.llmContent).toContain(`[ ] ${todo.id}: ${todo.task}`);
              }
            }

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should return empty message for empty list', async () => {
      // Feature: stage-03-tools-policy, Property 56: Todo Listing
      // **Validates: Requirements 11.8**
      const todosPath = fixture.getUniqueTodosPath();
      const tool = new WriteTodosTool(todosPath);

      // List todos on empty list
      const listInvocation = tool.createInvocation(
        { action: 'list' },
        createToolContext(messageBus)
      );
      const listResult = await listInvocation.execute(createMockAbortSignal());

      // Should succeed without error
      expect(listResult.error).toBeUndefined();
      expect(listResult.llmContent).toBe('No todos');
      expect(listResult.returnDisplay).toBe('0 todos');
    });

    it('should include todo IDs in listing', async () => {
      // Feature: stage-03-tools-policy, Property 56: Todo Listing
      // **Validates: Requirements 11.8**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(isValidTask),
            { minLength: 1, maxLength: 10 }
          ),
          async (tasks) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add all todos
            for (const task of tasks) {
              const addInvocation = tool.createInvocation(
                { action: 'add', task },
                createToolContext(messageBus)
              );
              await addInvocation.execute(createMockAbortSignal());
            }

            // Get the IDs from disk
            const todos = await fixture.readTodosFromDisk(todosPath);

            // List todos
            const listInvocation = tool.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // Verify all IDs appear in the output
            for (const todo of todos) {
              expect(listResult.llmContent).toContain(todo.id);
            }

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should show correct counts in returnDisplay', async () => {
      // Feature: stage-03-tools-policy, Property 56: Todo Listing
      // **Validates: Requirements 11.8**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(isValidTask),
            { minLength: 1, maxLength: 10 }
          ),
          fc.array(fc.nat(), { minLength: 0, maxLength: 10 }),
          async (tasks, completeIndices) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add all todos
            for (const task of tasks) {
              const addInvocation = tool.createInvocation(
                { action: 'add', task },
                createToolContext(messageBus)
              );
              await addInvocation.execute(createMockAbortSignal());
            }

            // Complete some todos (using unique indices)
            const todos = await fixture.readTodosFromDisk(todosPath);
            const indicesToComplete = new Set(
              completeIndices.map((i) => i % todos.length)
            );

            for (const index of indicesToComplete) {
              const completeInvocation = tool.createInvocation(
                { action: 'complete', id: todos[index].id },
                createToolContext(messageBus)
              );
              await completeInvocation.execute(createMockAbortSignal());
            }

            // List todos
            const listInvocation = tool.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // Verify counts in returnDisplay
            const completedCount = indicesToComplete.size;
            const pendingCount = tasks.length - completedCount;

            expect(listResult.returnDisplay).toContain(`${tasks.length} todo`);
            expect(listResult.returnDisplay).toContain(`${pendingCount} pending`);
            expect(listResult.returnDisplay).toContain(`${completedCount} completed`);

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });

    it('should preserve todo order in listing', async () => {
      // Feature: stage-03-tools-policy, Property 56: Todo Listing
      // **Validates: Requirements 11.8**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(isValidTask),
            { minLength: 2, maxLength: 10 }
          ),
          async (tasks) => {
            const todosPath = fixture.getUniqueTodosPath();
            const tool = new WriteTodosTool(todosPath);

            // Add all todos in order
            for (const task of tasks) {
              const addInvocation = tool.createInvocation(
                { action: 'add', task },
                createToolContext(messageBus)
              );
              await addInvocation.execute(createMockAbortSignal());
            }

            // List todos
            const listInvocation = tool.createInvocation(
              { action: 'list' },
              createToolContext(messageBus)
            );
            const listResult = await listInvocation.execute(createMockAbortSignal());

            // Verify todos appear in the same order as added
            const lines = listResult.llmContent.split('\n');
            expect(lines.length).toBe(tasks.length);

            for (let i = 0; i < tasks.length; i++) {
              expect(lines[i]).toContain(tasks[i]);
            }

            return true;
                  }
                ),
                { numRuns: 30 }
              );    });
  });

  describe('Basic Functionality', () => {
    it('should return error when task is missing for add action', async () => {
      const todosPath = fixture.getTodosPath();
      const tool = new WriteTodosTool(todosPath);

      const invocation = tool.createInvocation(
        { action: 'add' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
      expect(result.error?.message).toContain('Task required');
    });

    it('should handle empty todo list gracefully', async () => {
      const todosPath = fixture.getTodosPath();
      const tool = new WriteTodosTool(todosPath);

      const invocation = tool.createInvocation(
        { action: 'list' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toBe('No todos');
    });
  });

  describe('Tool Interface', () => {
    it('should provide correct description for add action', () => {
      const todosPath = fixture.getTodosPath();
      const tool = new WriteTodosTool(todosPath);

      const invocation = tool.createInvocation(
        { action: 'add', task: 'Test task' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();
      expect(description).toContain('Add todo');
      expect(description).toContain('Test task');
    });

    it('should return correct tool locations', () => {
      const todosPath = fixture.getTodosPath();
      const tool = new WriteTodosTool(todosPath);

      const invocation = tool.createInvocation(
        { action: 'add', task: 'Test' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();
      expect(locations).toEqual([todosPath]);
    });

    it('should not require confirmation', async () => {
      const todosPath = fixture.getTodosPath();
      const tool = new WriteTodosTool(todosPath);

      const invocation = tool.createInvocation(
        { action: 'add', task: 'Test' },
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
      const todosPath = fixture.getTodosPath();
      const tool = new WriteTodosTool(todosPath);

      expect(tool.name).toBe('write_todos');
      expect(tool.displayName).toBe('Manage Todos');
      expect(tool.schema.name).toBe('write_todos');
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.parameters).toBeDefined();
    });

    it('should have required action parameter', () => {
      const todosPath = fixture.getTodosPath();
      const tool = new WriteTodosTool(todosPath);

      const params = tool.schema.parameters as any;
      expect(params.properties.action).toBeDefined();
      expect(params.properties.action.enum).toContain('add');
      expect(params.properties.action.enum).toContain('complete');
      expect(params.properties.action.enum).toContain('remove');
      expect(params.properties.action.enum).toContain('list');
      expect(params.required).toContain('action');
    });
  });
});
