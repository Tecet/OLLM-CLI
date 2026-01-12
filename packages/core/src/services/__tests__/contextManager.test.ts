/**
 * Tests for ContextManager
 * Feature: services-sessions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ContextManager } from '../contextManager.js';
import { contextEntry } from './test-helpers.js';

describe('ContextManager', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  describe('Property 18: Context add-remove round-trip', () => {
    /**
     * Feature: services-sessions, Property 18: Context add-remove round-trip
     * 
     * For any context entry added with a unique key, removing it by that key 
     * should result in the context no longer being present in the active context list.
     * 
     * Validates: Requirements 5.2
     */
    it('should remove context entries completely after adding them', async () => {
      await fc.assert(
        fc.asyncProperty(contextEntry(), async (entry) => {
          // Add the context entry
          contextManager.addContext(entry.key, entry.content, {
            priority: entry.priority,
            source: entry.source,
          });

          // Verify the context was added
          expect(contextManager.hasContext(entry.key)).toBe(true);

          // Verify the context appears in the active context list
          const contextsBefore = contextManager.getContext();
          const addedContext = contextsBefore.find((c) => c.key === entry.key);
          expect(addedContext).toBeDefined();
          expect(addedContext!.content).toBe(entry.content);
          expect(addedContext!.priority).toBe(entry.priority);
          expect(addedContext!.source).toBe(entry.source);

          // Remove the context entry
          contextManager.removeContext(entry.key);

          // Verify the context was removed
          expect(contextManager.hasContext(entry.key)).toBe(false);

          // Verify the context no longer appears in the active context list
          const contextsAfter = contextManager.getContext();
          const removedContext = contextsAfter.find((c) => c.key === entry.key);
          expect(removedContext).toBeUndefined();

          // Verify the context is not in system prompt additions
          const systemPromptAdditions = contextManager.getSystemPromptAdditions();
          expect(systemPromptAdditions).not.toContain(entry.key);
          expect(systemPromptAdditions).not.toContain(entry.content);
        }),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    });
  });

  describe('Property 19: Context retrieval completeness', () => {
    /**
     * Feature: services-sessions, Property 19: Context retrieval completeness
     * 
     * For any set of added context entries, retrieving all active contexts 
     * should return all entries with their original content and metadata.
     * 
     * Validates: Requirements 5.3
     */
    it('should retrieve all added context entries with complete data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(contextEntry(), { minLength: 1, maxLength: 20 }),
          async (entries) => {
            // Create a fresh context manager for this iteration
            const manager = new ContextManager();

            // Ensure unique keys by appending index
            const uniqueEntries = entries.map((entry, index) => ({
              ...entry,
              key: `${entry.key}_${index}`,
            }));

            // Add all context entries
            for (const entry of uniqueEntries) {
              manager.addContext(entry.key, entry.content, {
                priority: entry.priority,
                source: entry.source,
              });
            }

            // Retrieve all active contexts
            const retrievedContexts = manager.getContext();

            // Verify the count matches
            expect(retrievedContexts.length).toBe(uniqueEntries.length);

            // Verify each entry is present with complete data
            for (const originalEntry of uniqueEntries) {
              const retrieved = retrievedContexts.find((c) => c.key === originalEntry.key);

              // Verify the entry exists
              expect(retrieved).toBeDefined();

              // Verify all fields match
              expect(retrieved!.key).toBe(originalEntry.key);
              expect(retrieved!.content).toBe(originalEntry.content);
              expect(retrieved!.priority).toBe(originalEntry.priority);
              expect(retrieved!.source).toBe(originalEntry.source);

              // Verify timestamp is present and valid ISO 8601
              expect(retrieved!.timestamp).toBeDefined();
              expect(typeof retrieved!.timestamp).toBe('string');
              const date = new Date(retrieved!.timestamp);
              expect(date.toISOString()).toBe(retrieved!.timestamp);
            }

            // Verify no extra entries are present
            for (const retrieved of retrievedContexts) {
              const original = uniqueEntries.find((e) => e.key === retrieved.key);
              expect(original).toBeDefined();
            }
          }
        ),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    });
  });

  describe('Property 20: Context inclusion in system prompt', () => {
    /**
     * Feature: services-sessions, Property 20: Context inclusion in system prompt
     * 
     * For any set of active context entries, the generated system prompt additions 
     * should contain the content from all entries.
     * 
     * Validates: Requirements 5.4
     */
    it('should include all active context entries in system prompt additions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(contextEntry(), { minLength: 1, maxLength: 20 }),
          async (entries) => {
            // Create a fresh context manager for this iteration
            const manager = new ContextManager();

            // Ensure unique keys by appending index
            const uniqueEntries = entries.map((entry, index) => ({
              ...entry,
              key: `${entry.key}_${index}`,
            }));

            // Add all context entries
            for (const entry of uniqueEntries) {
              manager.addContext(entry.key, entry.content, {
                priority: entry.priority,
                source: entry.source,
              });
            }

            // Get system prompt additions
            const systemPromptAdditions = manager.getSystemPromptAdditions();

            // Verify the system prompt additions is not empty
            expect(systemPromptAdditions.length).toBeGreaterThan(0);

            // Verify each entry's key and content is included in the system prompt
            for (const entry of uniqueEntries) {
              // Check that the key appears in the system prompt
              expect(systemPromptAdditions).toContain(entry.key);

              // Check that the content appears in the system prompt
              expect(systemPromptAdditions).toContain(entry.content);

              // Verify the markdown section format is present
              const expectedSection = `## Context: ${entry.key}`;
              expect(systemPromptAdditions).toContain(expectedSection);
            }

            // Verify the system prompt starts with newlines (formatting)
            expect(systemPromptAdditions.startsWith('\n\n')).toBe(true);
          }
        ),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    });

    it('should return empty string when no context entries exist', () => {
      const manager = new ContextManager();
      const systemPromptAdditions = manager.getSystemPromptAdditions();
      expect(systemPromptAdditions).toBe('');
    });
  });

  describe('Unit tests for multiple sources', () => {
    /**
     * Unit tests for context from different sources
     * 
     * Validates: Requirements 5.6
     */
    it('should add context from different sources', () => {
      const manager = new ContextManager();

      // Add context from different sources
      manager.addContext('hook-context', 'Context from hook', { source: 'hook' });
      manager.addContext('extension-context', 'Context from extension', { source: 'extension' });
      manager.addContext('user-context', 'Context from user', { source: 'user' });
      manager.addContext('system-context', 'Context from system', { source: 'system' });

      // Verify all contexts are added
      const allContexts = manager.getContext();
      expect(allContexts.length).toBe(4);

      // Verify each source is present
      const sources = allContexts.map(c => c.source);
      expect(sources).toContain('hook');
      expect(sources).toContain('extension');
      expect(sources).toContain('user');
      expect(sources).toContain('system');

      // Verify each context has the correct source
      const hookContext = allContexts.find(c => c.key === 'hook-context');
      expect(hookContext?.source).toBe('hook');

      const extensionContext = allContexts.find(c => c.key === 'extension-context');
      expect(extensionContext?.source).toBe('extension');

      const userContext = allContexts.find(c => c.key === 'user-context');
      expect(userContext?.source).toBe('user');

      const systemContext = allContexts.find(c => c.key === 'system-context');
      expect(systemContext?.source).toBe('system');
    });

    it('should filter context by source', () => {
      const manager = new ContextManager();

      // Add multiple contexts from different sources
      manager.addContext('hook-1', 'Hook context 1', { source: 'hook' });
      manager.addContext('hook-2', 'Hook context 2', { source: 'hook' });
      manager.addContext('extension-1', 'Extension context 1', { source: 'extension' });
      manager.addContext('user-1', 'User context 1', { source: 'user' });
      manager.addContext('system-1', 'System context 1', { source: 'system' });

      // Filter by hook source
      const hookContexts = manager.getContextBySource('hook');
      expect(hookContexts.length).toBe(2);
      expect(hookContexts.every(c => c.source === 'hook')).toBe(true);
      expect(hookContexts.map(c => c.key)).toContain('hook-1');
      expect(hookContexts.map(c => c.key)).toContain('hook-2');

      // Filter by extension source
      const extensionContexts = manager.getContextBySource('extension');
      expect(extensionContexts.length).toBe(1);
      expect(extensionContexts[0].source).toBe('extension');
      expect(extensionContexts[0].key).toBe('extension-1');

      // Filter by user source
      const userContexts = manager.getContextBySource('user');
      expect(userContexts.length).toBe(1);
      expect(userContexts[0].source).toBe('user');
      expect(userContexts[0].key).toBe('user-1');

      // Filter by system source
      const systemContexts = manager.getContextBySource('system');
      expect(systemContexts.length).toBe(1);
      expect(systemContexts[0].source).toBe('system');
      expect(systemContexts[0].key).toBe('system-1');

      // Filter by non-existent source
      const nonExistentContexts = manager.getContextBySource('non-existent');
      expect(nonExistentContexts.length).toBe(0);
    });

    it('should use default source when not specified', () => {
      const manager = new ContextManager();

      // Add context without specifying source
      manager.addContext('default-context', 'Context with default source');

      // Verify the default source is 'user'
      const contexts = manager.getContext();
      expect(contexts.length).toBe(1);
      expect(contexts[0].source).toBe('user');
    });

    it('should handle mixed sources in system prompt additions', () => {
      const manager = new ContextManager();

      // Add contexts from different sources
      manager.addContext('hook-ctx', 'Hook content', { source: 'hook', priority: 100 });
      manager.addContext('ext-ctx', 'Extension content', { source: 'extension', priority: 80 });
      manager.addContext('user-ctx', 'User content', { source: 'user', priority: 60 });

      // Get system prompt additions
      const systemPrompt = manager.getSystemPromptAdditions();

      // Verify all sources are included
      expect(systemPrompt).toContain('hook-ctx');
      expect(systemPrompt).toContain('Hook content');
      expect(systemPrompt).toContain('ext-ctx');
      expect(systemPrompt).toContain('Extension content');
      expect(systemPrompt).toContain('user-ctx');
      expect(systemPrompt).toContain('User content');

      // Verify priority ordering (hook should appear first due to highest priority)
      const hookIndex = systemPrompt.indexOf('hook-ctx');
      const extIndex = systemPrompt.indexOf('ext-ctx');
      const userIndex = systemPrompt.indexOf('user-ctx');

      expect(hookIndex).toBeLessThan(extIndex);
      expect(extIndex).toBeLessThan(userIndex);
    });

    it('should remove context from specific source', () => {
      const manager = new ContextManager();

      // Add contexts from different sources
      manager.addContext('hook-1', 'Hook 1', { source: 'hook' });
      manager.addContext('hook-2', 'Hook 2', { source: 'hook' });
      manager.addContext('user-1', 'User 1', { source: 'user' });

      // Verify initial state
      expect(manager.getContextBySource('hook').length).toBe(2);
      expect(manager.getContextBySource('user').length).toBe(1);

      // Remove one hook context
      manager.removeContext('hook-1');

      // Verify hook contexts are reduced
      const hookContexts = manager.getContextBySource('hook');
      expect(hookContexts.length).toBe(1);
      expect(hookContexts[0].key).toBe('hook-2');

      // Verify user context is unaffected
      expect(manager.getContextBySource('user').length).toBe(1);
    });

    it('should clear all contexts regardless of source', () => {
      const manager = new ContextManager();

      // Add contexts from different sources
      manager.addContext('hook-1', 'Hook 1', { source: 'hook' });
      manager.addContext('extension-1', 'Extension 1', { source: 'extension' });
      manager.addContext('user-1', 'User 1', { source: 'user' });
      manager.addContext('system-1', 'System 1', { source: 'system' });

      // Verify contexts are added
      expect(manager.getContext().length).toBe(4);

      // Clear all contexts
      manager.clearContext();

      // Verify all contexts are removed
      expect(manager.getContext().length).toBe(0);
      expect(manager.getContextBySource('hook').length).toBe(0);
      expect(manager.getContextBySource('extension').length).toBe(0);
      expect(manager.getContextBySource('user').length).toBe(0);
      expect(manager.getContextBySource('system').length).toBe(0);
    });
  });
});
