import { PromptDefinition, RegisteredPrompt } from './types.js';

/**
 * Registry for managing system prompts from various sources (Static, MCP, Config).
 */
export class PromptRegistry {
  private prompts: Map<string, RegisteredPrompt> = new Map();

  constructor() {}

  /**
   * Register a new prompt or update an existing one.
   */
  register(definition: PromptDefinition): void {
    const registeredPrompt: RegisteredPrompt = {
      ...definition,
      registeredAt: Date.now(),
    };
    this.prompts.set(definition.id, registeredPrompt);
  }

  /**
   * Get a prompt by its ID.
   */
  get(id: string): RegisteredPrompt | undefined {
    return this.prompts.get(id);
  }

  /**
   * List all registered prompts.
   */
  list(): RegisteredPrompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Get all prompts that match a specific tag.
   */
  getByTag(tag: string): RegisteredPrompt[] {
    return this.list().filter((p) => p.tags?.includes(tag));
  }

  /**
   * Get all prompts from a specific source.
   */
  getBySource(source: PromptDefinition['source']): RegisteredPrompt[] {
    return this.list().filter((p) => p.source === source);
  }

  /**
   * Remove a prompt definition.
   */
  unregister(id: string): boolean {
    return this.prompts.delete(id);
  }

  /**
   * Clear all prompts from a specific MCP server.
   * Useful when an MCP server disconnects.
   */
  clearMcpPrompts(serverName: string): void {
    for (const [id, prompt] of this.prompts.entries()) {
      if (prompt.source === 'mcp' && prompt.serverName === serverName) {
        this.prompts.delete(id);
      }
    }
  }

  /**
   * Check if a prompt exists.
   */
  has(id: string): boolean {
    return this.prompts.has(id);
  }
}
