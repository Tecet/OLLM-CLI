/**
 * Todo list management tool implementation
 *
 * Provides a tool for managing a persistent todo list with add, complete,
 * remove, and list operations. Data is stored in a JSON file with concurrent
 * access safety through atomic writes.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolContext,
  ToolSchema,
} from './types.js';

/**
 * Parameters for todo operations
 */
export interface WriteTodosParams {
  /**
   * Action to perform
   */
  action: 'add' | 'complete' | 'remove' | 'list';

  /**
   * Task description (required for add)
   */
  task?: string;

  /**
   * Task ID (required for complete, remove)
   */
  id?: string;
}

/**
 * Todo item structure
 */
export interface Todo {
  /**
   * Unique identifier for the todo
   */
  id: string;

  /**
   * Task description
   */
  task: string;

  /**
   * Whether the task is completed
   */
  completed: boolean;

  /**
   * ISO timestamp when the todo was created
   */
  createdAt: string;
}

/**
 * Tool for managing a todo list
 */
export class WriteTodosTool implements DeclarativeTool<WriteTodosParams, ToolResult> {
  name = 'write_todos';
  displayName = 'Manage Todos';
  schema: ToolSchema = {
    name: 'write_todos',
    description: 'Manage a todo list',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'complete', 'remove', 'list'],
          description: 'Action to perform',
        },
        task: {
          type: 'string',
          description: 'Task description (required for add)',
        },
        id: {
          type: 'string',
          description: 'Task ID (required for complete, remove)',
        },
      },
      required: ['action'],
    },
  };

  constructor(private todosPath: string) {}

  createInvocation(
    params: WriteTodosParams,
    _context: ToolContext
  ): ToolInvocation<WriteTodosParams, ToolResult> {
    return new WriteTodosInvocation(params, this.todosPath);
  }
}


/**
 * Invocation instance for todo operations
 */
export class WriteTodosInvocation implements ToolInvocation<WriteTodosParams, ToolResult> {
  constructor(
    public params: WriteTodosParams,
    private todosPath: string
  ) {}

  getDescription(): string {
    switch (this.params.action) {
      case 'add':
        return `Add todo: ${this.params.task ?? '(no task)'}`;
      case 'complete':
        return `Complete todo: ${this.params.id ?? '(no id)'}`;
      case 'remove':
        return `Remove todo: ${this.params.id ?? '(no id)'}`;
      case 'list':
        return 'List todos';
      default:
        return `Todo ${this.params.action}`;
    }
  }

  toolLocations(): string[] {
    return [this.todosPath];
  }

  async shouldConfirmExecute(
    _abortSignal: AbortSignal
  ): Promise<false> {
    // Todo operations don't require confirmation
    return false;
  }

  async execute(
    signal: AbortSignal,
    _updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    try {
      // Check if aborted
      if (signal.aborted) {
        throw new Error('Operation cancelled');
      }

      const todos = await this.loadTodos();

      switch (this.params.action) {
        case 'add':
          return await this.handleAdd(todos, signal);

        case 'complete':
          return await this.handleComplete(todos, signal);

        case 'remove':
          return await this.handleRemove(todos, signal);

        case 'list':
          return this.handleList(todos);

        default:
          return {
            llmContent: '',
            returnDisplay: '',
            error: {
              message: `Unknown action: ${this.params.action}`,
              type: 'InvalidActionError',
            },
          };
      }
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'TodoError',
        },
      };
    }
  }

  private async handleAdd(todos: Todo[], signal: AbortSignal): Promise<ToolResult> {
    if (!this.params.task) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: 'Task required for add action',
          type: 'ValidationError',
        },
      };
    }

    // Check if aborted before writing
    if (signal.aborted) {
      throw new Error('Operation cancelled');
    }

    const newTodo: Todo = {
      id: randomUUID(),
      task: this.params.task,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    todos.push(newTodo);
    await this.saveTodos(todos);

    return {
      llmContent: `Added todo: ${newTodo.id}`,
      returnDisplay: `Added: ${this.params.task}`,
    };
  }

  private async handleComplete(todos: Todo[], signal: AbortSignal): Promise<ToolResult> {
    if (!this.params.id) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: 'ID required for complete action',
          type: 'ValidationError',
        },
      };
    }

    const todo = todos.find((t) => t.id === this.params.id);
    if (!todo) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: `Todo not found: ${this.params.id}`,
          type: 'NotFoundError',
        },
      };
    }

    // Check if already completed
    if (todo.completed) {
      return {
        llmContent: `Todo already completed: ${this.params.id}`,
        returnDisplay: `Already completed: ${todo.task}`,
      };
    }

    // Check if aborted before writing
    if (signal.aborted) {
      throw new Error('Operation cancelled');
    }

    todo.completed = true;
    await this.saveTodos(todos);

    return {
      llmContent: `Completed todo: ${this.params.id}`,
      returnDisplay: `Completed: ${todo.task}`,
    };
  }

  private async handleRemove(todos: Todo[], signal: AbortSignal): Promise<ToolResult> {
    if (!this.params.id) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: 'ID required for remove action',
          type: 'ValidationError',
        },
      };
    }

    const index = todos.findIndex((t) => t.id === this.params.id);
    if (index === -1) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: `Todo not found: ${this.params.id}`,
          type: 'NotFoundError',
        },
      };
    }

    // Check if aborted before writing
    if (signal.aborted) {
      throw new Error('Operation cancelled');
    }

    const removed = todos.splice(index, 1)[0];
    await this.saveTodos(todos);

    return {
      llmContent: `Removed todo: ${this.params.id}`,
      returnDisplay: `Removed: ${removed.task}`,
    };
  }

  private handleList(todos: Todo[]): ToolResult {
    if (todos.length === 0) {
      return {
        llmContent: 'No todos',
        returnDisplay: '0 todos',
      };
    }

    const formatted = todos
      .map((t) => `[${t.completed ? 'x' : ' '}] ${t.id}: ${t.task}`)
      .join('\n');

    const completedCount = todos.filter((t) => t.completed).length;
    const pendingCount = todos.length - completedCount;

    return {
      llmContent: formatted,
      returnDisplay: `${todos.length} todo${todos.length === 1 ? '' : 's'} (${pendingCount} pending, ${completedCount} completed)`,
    };
  }

  /**
   * Load todos from disk with concurrent access safety
   */
  private async loadTodos(): Promise<Todo[]> {
    try {
      const content = await fs.readFile(this.todosPath, 'utf-8');
      const parsed = JSON.parse(content);
      // Validate that it's an array
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed;
    } catch (error) {
      // If file doesn't exist or is invalid, return empty array
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      // For JSON parse errors, return empty array
      if (error instanceof SyntaxError) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Save todos to disk with atomic write for concurrent access safety
   */
  private async saveTodos(todos: Todo[]): Promise<void> {
    // Ensure parent directory exists
    const dir = path.dirname(this.todosPath);
    await fs.mkdir(dir, { recursive: true });

    // Write to a temp file first, then rename for atomic operation
    const tempPath = `${this.todosPath}.tmp.${Date.now()}`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(todos, null, 2), 'utf-8');
      await fs.rename(tempPath, this.todosPath);
    } catch (error) {
      // Clean up temp file if rename failed
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}
