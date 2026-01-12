/**
 * ContextManager - Manages dynamic context injection into system prompts
 * 
 * Responsibilities:
 * - Add and remove context entries with unique keys
 * - Maintain priority-based ordering of context
 * - Support multiple context sources (hook, extension, user, system)
 * - Generate system prompt additions from active context
 */

import type { ContextEntry } from './types.js';

/**
 * Options for adding context
 */
export interface AddContextOptions {
  priority?: number;
  source?: 'hook' | 'extension' | 'user' | 'system';
}

/**
 * Default priority for context entries
 */
const DEFAULT_PRIORITY = 50;

/**
 * Default source for context entries
 */
const DEFAULT_SOURCE = 'user';

/**
 * ContextManager implementation
 */
export class ContextManager {
  private contexts: Map<string, ContextEntry>;

  constructor() {
    this.contexts = new Map();
  }

  /**
   * Add a context entry
   * 
   * @param key - Unique identifier for the context entry
   * @param content - The context content to inject
   * @param options - Optional priority and source
   */
  addContext(
    key: string,
    content: string,
    options: AddContextOptions = {}
  ): void {
    const priority = options.priority ?? DEFAULT_PRIORITY;
    const source = options.source ?? DEFAULT_SOURCE;
    const timestamp = new Date().toISOString();

    const entry: ContextEntry = {
      key,
      content,
      priority,
      source,
      timestamp,
    };

    this.contexts.set(key, entry);
  }

  /**
   * Remove a context entry by key
   * 
   * @param key - The unique identifier of the context entry to remove
   */
  removeContext(key: string): void {
    this.contexts.delete(key);
  }

  /**
   * Clear all context entries
   */
  clearContext(): void {
    this.contexts.clear();
  }

  /**
   * Get all active context entries
   * 
   * @returns Array of context entries sorted by priority (highest first)
   */
  getContext(): ContextEntry[] {
    const entries = Array.from(this.contexts.values());
    
    // Sort by priority (descending), then by timestamp (ascending) as tiebreaker
    entries.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      // Use timestamp as tiebreaker (earlier entries first)
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    return entries;
  }

  /**
   * Generate system prompt additions from all active context
   * 
   * @returns Formatted string to append to system prompt
   */
  getSystemPromptAdditions(): string {
    const entries = this.getContext();

    if (entries.length === 0) {
      return '';
    }

    // Format each context entry as a markdown section
    const sections = entries.map(entry => {
      return `## Context: ${entry.key}\n\n${entry.content}`;
    });

    return '\n\n' + sections.join('\n\n');
  }

  /**
   * Check if a context entry exists
   * 
   * @param key - The unique identifier to check
   * @returns True if the context entry exists
   */
  hasContext(key: string): boolean {
    return this.contexts.has(key);
  }

  /**
   * Get context entries by source
   * 
   * @param source - The source to filter by
   * @returns Array of context entries from the specified source
   */
  getContextBySource(source: string): ContextEntry[] {
    const entries = Array.from(this.contexts.values());
    return entries.filter(entry => entry.source === source);
  }
}
