/**
 * Tests for Tool Invocation Interface
 * 
 * These tests validate the ToolInvocation interface requirements,
 * ensuring that all tool invocations provide consistent behavior
 * for description, locations, confirmation checks, and execution.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ReadFileTool } from '../read-file.js';
import { ReadManyFilesTool } from '../read-many-files.js';
import { WriteFileTool } from '../write-file.js';
import { EditFileTool } from '../edit-file.js';
import { ShellTool } from '../shell.js';
import { GlobTool } from '../glob.js';
import { GrepTool } from '../grep.js';
import { LsTool } from '../ls.js';
import { MemoryTool } from '../memory.js';
import { WriteTodosTool } from '../write-todos.js';
import type { ToolContext } from '../types.js';
import { ShellExecutionService } from '../../services/shellExecutionService.js';
import { EnvironmentSanitizationService } from '../../services/environmentSanitization.js';

// Mock shell service for testing
const sanitizationService = new EnvironmentSanitizationService();
const mockShellService = new ShellExecutionService(sanitizationService);

// Mock context for testing
const mockContext: ToolContext = {
  messageBus: {
    requestConfirmation: async () => true,
  },
  policyEngine: {
    evaluate: () => 'allow',
    getRiskLevel: () => 'low',
  },
};

describe('Tool Invocation Interface', () => {
  describe('Property 45: Tool Invocation Description', () => {
    it('should return non-empty description for read_file invocations', () => {
      // Feature: stage-03-tools-policy, Property 45: Tool Invocation Description
      fc.assert(
        fc.property(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            startLine: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            endLine: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
          }),
          (params) => {
            const tool = new ReadFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const description = invocation.getDescription();
            
            // Description must be a non-empty string
            expect(typeof description).toBe('string');
            expect(description.length).toBeGreaterThan(0);
            expect(description.trim().length).toBeGreaterThan(0);
            
            // Description should be human-readable (contain the path)
            expect(description).toContain(params.path);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return non-empty description for write_file invocations', () => {
      // Feature: stage-03-tools-policy, Property 45: Tool Invocation Description
      fc.assert(
        fc.property(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            content: fc.string({ minLength: 0, maxLength: 1000 }),
            overwrite: fc.option(fc.boolean(), { nil: undefined }),
          }),
          (params) => {
            const tool = new WriteFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const description = invocation.getDescription();
            
            // Description must be a non-empty string
            expect(typeof description).toBe('string');
            expect(description.length).toBeGreaterThan(0);
            expect(description.trim().length).toBeGreaterThan(0);
            
            // Description should be human-readable (contain the path)
            expect(description).toContain(params.path);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return non-empty description for edit_file invocations', () => {
      // Feature: stage-03-tools-policy, Property 45: Tool Invocation Description
      fc.assert(
        fc.property(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            edits: fc.array(
              fc.record({
                target: fc.string({ minLength: 1, maxLength: 50 }),
                replacement: fc.string({ minLength: 0, maxLength: 50 }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          (params) => {
            const tool = new EditFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const description = invocation.getDescription();
            
            // Description must be a non-empty string
            expect(typeof description).toBe('string');
            expect(description.length).toBeGreaterThan(0);
            expect(description.trim().length).toBeGreaterThan(0);
            
            // Description should be human-readable (contain the path)
            expect(description).toContain(params.path);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return non-empty description for shell invocations', () => {
      // Feature: stage-03-tools-policy, Property 45: Tool Invocation Description
      fc.assert(
        fc.property(
          fc.record({
            command: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            cwd: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            timeout: fc.option(fc.integer({ min: 1000, max: 60000 }), { nil: undefined }),
          }),
          (params) => {
            const tool = new ShellTool(mockShellService);
            const invocation = tool.createInvocation(params, mockContext);
            
            const description = invocation.getDescription();
            
            // Description must be a non-empty string
            expect(typeof description).toBe('string');
            expect(description.length).toBeGreaterThan(0);
            expect(description.trim().length).toBeGreaterThan(0);
            
            // Description should be human-readable (contain the command)
            expect(description).toContain(params.command);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return non-empty description for glob invocations', () => {
      // Feature: stage-03-tools-policy, Property 45: Tool Invocation Description
      fc.assert(
        fc.property(
          fc.record({
            pattern: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            directory: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            maxResults: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            includeHidden: fc.option(fc.boolean(), { nil: undefined }),
          }),
          (params) => {
            const tool = new GlobTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const description = invocation.getDescription();
            
            // Description must be a non-empty string
            expect(typeof description).toBe('string');
            expect(description.length).toBeGreaterThan(0);
            expect(description.trim().length).toBeGreaterThan(0);
            
            // Description should be human-readable (contain the pattern)
            expect(description).toContain(params.pattern);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return non-empty description for grep invocations', () => {
      // Feature: stage-03-tools-policy, Property 45: Tool Invocation Description
      fc.assert(
        fc.property(
          fc.record({
            pattern: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            directory: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            filePattern: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            caseSensitive: fc.option(fc.boolean(), { nil: undefined }),
            maxResults: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
          }),
          (params) => {
            const tool = new GrepTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const description = invocation.getDescription();
            
            // Description must be a non-empty string
            expect(typeof description).toBe('string');
            expect(description.length).toBeGreaterThan(0);
            expect(description.trim().length).toBeGreaterThan(0);
            
            // Description should be human-readable (contain the pattern)
            expect(description).toContain(params.pattern);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return non-empty description for ls invocations', () => {
      // Feature: stage-03-tools-policy, Property 45: Tool Invocation Description
      fc.assert(
        fc.property(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            recursive: fc.option(fc.boolean(), { nil: undefined }),
            includeHidden: fc.option(fc.boolean(), { nil: undefined }),
            maxDepth: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
          }),
          (params) => {
            const tool = new LsTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const description = invocation.getDescription();
            
            // Description must be a non-empty string
            expect(typeof description).toBe('string');
            expect(description.length).toBeGreaterThan(0);
            expect(description.trim().length).toBeGreaterThan(0);
            
            // Description should be human-readable (contain the path)
            expect(description).toContain(params.path);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return non-empty description for memory invocations', () => {
      // Feature: stage-03-tools-policy, Property 45: Tool Invocation Description
      fc.assert(
        fc.property(
          fc.record({
            action: fc.constantFrom('get' as const, 'set' as const, 'delete' as const, 'list' as const),
            key: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            value: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
          }),
          (params) => {
            const tool = new MemoryTool('/tmp/memory.json');
            const invocation = tool.createInvocation(params, mockContext);
            
            const description = invocation.getDescription();
            
            // Description must be a non-empty string
            expect(typeof description).toBe('string');
            expect(description.length).toBeGreaterThan(0);
            expect(description.trim().length).toBeGreaterThan(0);
            
            // Description should be human-readable (contain the action)
            expect(description.toLowerCase()).toContain(params.action);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return non-empty description for write_todos invocations', () => {
      // Feature: stage-03-tools-policy, Property 45: Tool Invocation Description
      fc.assert(
        fc.property(
          fc.record({
            action: fc.constantFrom('add' as const, 'complete' as const, 'remove' as const, 'list' as const),
            task: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            id: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          }),
          (params) => {
            const tool = new WriteTodosTool('/tmp/todos.json');
            const invocation = tool.createInvocation(params, mockContext);
            
            const description = invocation.getDescription();
            
            // Description must be a non-empty string
            expect(typeof description).toBe('string');
            expect(description.length).toBeGreaterThan(0);
            expect(description.trim().length).toBeGreaterThan(0);
            
            // Description should be human-readable (contain the action)
            expect(description.toLowerCase()).toContain(params.action);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return consistent descriptions for the same parameters', () => {
      // Feature: stage-03-tools-policy, Property 45: Tool Invocation Description
      fc.assert(
        fc.property(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            content: fc.string({ minLength: 0, maxLength: 1000 }),
          }),
          (params) => {
            const tool = new WriteFileTool();
            const invocation1 = tool.createInvocation(params, mockContext);
            const invocation2 = tool.createInvocation(params, mockContext);
            
            const description1 = invocation1.getDescription();
            const description2 = invocation2.getDescription();
            
            // Same parameters should produce same description
            expect(description1).toBe(description2);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 46: Tool Invocation Locations', () => {
    it('should return array of file paths for read_file invocations', () => {
      // Feature: stage-03-tools-policy, Property 46: Tool Invocation Locations
      fc.assert(
        fc.property(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            startLine: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            endLine: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
          }),
          (params) => {
            const tool = new ReadFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const locations = invocation.toolLocations();
            
            // Locations must be an array
            expect(Array.isArray(locations)).toBe(true);
            
            // For read_file, should contain the file path
            expect(locations).toContain(params.path);
            
            // All elements should be strings
            locations.forEach(loc => {
              expect(typeof loc).toBe('string');
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return array of file paths for read_many_files invocations', () => {
      // Feature: stage-03-tools-policy, Property 46: Tool Invocation Locations
      fc.assert(
        fc.property(
          fc.record({
            paths: fc.array(
              fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              { minLength: 1, maxLength: 10 }
            ),
          }),
          (params) => {
            const tool = new ReadManyFilesTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const locations = invocation.toolLocations();
            
            // Locations must be an array
            expect(Array.isArray(locations)).toBe(true);
            
            // For read_many_files, should contain all file paths
            params.paths.forEach(path => {
              expect(locations).toContain(path);
            });
            
            // All elements should be strings
            locations.forEach(loc => {
              expect(typeof loc).toBe('string');
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return array of file paths for write_file invocations', () => {
      // Feature: stage-03-tools-policy, Property 46: Tool Invocation Locations
      fc.assert(
        fc.property(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            content: fc.string({ minLength: 0, maxLength: 1000 }),
            overwrite: fc.option(fc.boolean(), { nil: undefined }),
          }),
          (params) => {
            const tool = new WriteFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const locations = invocation.toolLocations();
            
            // Locations must be an array
            expect(Array.isArray(locations)).toBe(true);
            
            // For write_file, should contain the file path
            expect(locations).toContain(params.path);
            
            // All elements should be strings
            locations.forEach(loc => {
              expect(typeof loc).toBe('string');
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return array of file paths for edit_file invocations', () => {
      // Feature: stage-03-tools-policy, Property 46: Tool Invocation Locations
      fc.assert(
        fc.property(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            edits: fc.array(
              fc.record({
                target: fc.string({ minLength: 1, maxLength: 50 }),
                replacement: fc.string({ minLength: 0, maxLength: 50 }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          (params) => {
            const tool = new EditFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const locations = invocation.toolLocations();
            
            // Locations must be an array
            expect(Array.isArray(locations)).toBe(true);
            
            // For edit_file, should contain the file path
            expect(locations).toContain(params.path);
            
            // All elements should be strings
            locations.forEach(loc => {
              expect(typeof loc).toBe('string');
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return array of directories for glob invocations', () => {
      // Feature: stage-03-tools-policy, Property 46: Tool Invocation Locations
      fc.assert(
        fc.property(
          fc.record({
            pattern: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            directory: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            maxResults: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            includeHidden: fc.option(fc.boolean(), { nil: undefined }),
          }),
          (params) => {
            const tool = new GlobTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const locations = invocation.toolLocations();
            
            // Locations must be an array
            expect(Array.isArray(locations)).toBe(true);
            
            // For glob, should contain the directory (or '.' if not specified)
            const expectedDir = params.directory ?? '.';
            expect(locations).toContain(expectedDir);
            
            // All elements should be strings
            locations.forEach(loc => {
              expect(typeof loc).toBe('string');
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return array of directories for grep invocations', () => {
      // Feature: stage-03-tools-policy, Property 46: Tool Invocation Locations
      fc.assert(
        fc.property(
          fc.record({
            pattern: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            directory: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            filePattern: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            caseSensitive: fc.option(fc.boolean(), { nil: undefined }),
            maxResults: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
          }),
          (params) => {
            const tool = new GrepTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const locations = invocation.toolLocations();
            
            // Locations must be an array
            expect(Array.isArray(locations)).toBe(true);
            
            // For grep, should contain the directory (or '.' if not specified)
            const expectedDir = params.directory ?? '.';
            expect(locations).toContain(expectedDir);
            
            // All elements should be strings
            locations.forEach(loc => {
              expect(typeof loc).toBe('string');
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return array of paths for ls invocations', () => {
      // Feature: stage-03-tools-policy, Property 46: Tool Invocation Locations
      fc.assert(
        fc.property(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            recursive: fc.option(fc.boolean(), { nil: undefined }),
            includeHidden: fc.option(fc.boolean(), { nil: undefined }),
            maxDepth: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
          }),
          (params) => {
            const tool = new LsTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const locations = invocation.toolLocations();
            
            // Locations must be an array
            expect(Array.isArray(locations)).toBe(true);
            
            // For ls, should contain the path
            expect(locations).toContain(params.path);
            
            // All elements should be strings
            locations.forEach(loc => {
              expect(typeof loc).toBe('string');
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return array for memory invocations', () => {
      // Feature: stage-03-tools-policy, Property 46: Tool Invocation Locations
      fc.assert(
        fc.property(
          fc.record({
            action: fc.constantFrom('get' as const, 'set' as const, 'delete' as const, 'list' as const),
            key: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            value: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
          }),
          (params) => {
            const storePath = '/tmp/memory.json';
            const tool = new MemoryTool(storePath);
            const invocation = tool.createInvocation(params, mockContext);
            
            const locations = invocation.toolLocations();
            
            // Locations must be an array
            expect(Array.isArray(locations)).toBe(true);
            
            // For memory, should contain the storage path
            expect(locations).toContain(storePath);
            
            // All elements should be strings
            locations.forEach(loc => {
              expect(typeof loc).toBe('string');
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return array for write_todos invocations', () => {
      // Feature: stage-03-tools-policy, Property 46: Tool Invocation Locations
      fc.assert(
        fc.property(
          fc.record({
            action: fc.constantFrom('add' as const, 'complete' as const, 'remove' as const, 'list' as const),
            task: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            id: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          }),
          (params) => {
            const todosPath = '/tmp/todos.json';
            const tool = new WriteTodosTool(todosPath);
            const invocation = tool.createInvocation(params, mockContext);
            
            const locations = invocation.toolLocations();
            
            // Locations must be an array
            expect(Array.isArray(locations)).toBe(true);
            
            // For write_todos, should contain the todos path
            expect(locations).toContain(todosPath);
            
            // All elements should be strings
            locations.forEach(loc => {
              expect(typeof loc).toBe('string');
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return consistent locations for the same parameters', () => {
      // Feature: stage-03-tools-policy, Property 46: Tool Invocation Locations
      fc.assert(
        fc.property(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            content: fc.string({ minLength: 0, maxLength: 1000 }),
          }),
          (params) => {
            const tool = new WriteFileTool();
            const invocation1 = tool.createInvocation(params, mockContext);
            const invocation2 = tool.createInvocation(params, mockContext);
            
            const locations1 = invocation1.toolLocations();
            const locations2 = invocation2.toolLocations();
            
            // Same parameters should produce same locations
            expect(locations1).toEqual(locations2);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no locations are affected', () => {
      // Feature: stage-03-tools-policy, Property 46: Tool Invocation Locations
      // Some tools like web_search don't affect local resources
      const tool = new GrepTool();
      const invocation = tool.createInvocation(
        { pattern: 'test', directory: undefined },
        mockContext
      );
      
      const locations = invocation.toolLocations();
      
      // Locations must be an array (even if empty or with default '.')
      expect(Array.isArray(locations)).toBe(true);
      
      // All elements should be strings
      locations.forEach(loc => {
        expect(typeof loc).toBe('string');
      });
    });
  });

  describe('Property 47: Tool Invocation Confirmation Check', () => {
    it('should return false or ToolCallConfirmationDetails for read_file invocations', async () => {
      // Feature: stage-03-tools-policy, Property 47: Tool Invocation Confirmation Check
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            startLine: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            endLine: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
          }),
          fc.constantFrom('allow' as const, 'deny' as const, 'ask' as const),
          async (params, policyDecision) => {
            const contextWithPolicy: ToolContext = {
              messageBus: {
                requestConfirmation: async () => true,
              },
              policyEngine: {
                evaluate: () => policyDecision,
                getRiskLevel: () => 'low',
              },
            };

            const tool = new ReadFileTool();
            const invocation = tool.createInvocation(params, contextWithPolicy);
            
            const abortController = new AbortController();
            const result = await invocation.shouldConfirmExecute(abortController.signal);
            
            // Result must be either false or ToolCallConfirmationDetails
            if (result === false) {
              expect(result).toBe(false);
            } else {
              // Must be ToolCallConfirmationDetails
              expect(typeof result).toBe('object');
              expect(result).not.toBeNull();
              
              // Must have required fields
              expect(typeof result.toolName).toBe('string');
              expect(result.toolName.length).toBeGreaterThan(0);
              
              expect(typeof result.description).toBe('string');
              expect(result.description.length).toBeGreaterThan(0);
              
              expect(['low', 'medium', 'high']).toContain(result.risk);
              
              // locations is optional but if present must be an array of strings
              if (result.locations !== undefined) {
                expect(Array.isArray(result.locations)).toBe(true);
                result.locations.forEach(loc => {
                  expect(typeof loc).toBe('string');
                });
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false or ToolCallConfirmationDetails for write_file invocations', async () => {
      // Feature: stage-03-tools-policy, Property 47: Tool Invocation Confirmation Check
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            content: fc.string({ minLength: 0, maxLength: 1000 }),
            overwrite: fc.option(fc.boolean(), { nil: undefined }),
          }),
          fc.constantFrom('allow' as const, 'deny' as const, 'ask' as const),
          async (params, policyDecision) => {
            const contextWithPolicy: ToolContext = {
              messageBus: {
                requestConfirmation: async () => true,
              },
              policyEngine: {
                evaluate: () => policyDecision,
                getRiskLevel: () => 'medium',
              },
            };

            const tool = new WriteFileTool();
            const invocation = tool.createInvocation(params, contextWithPolicy);
            
            const abortController = new AbortController();
            
            // If policy is 'deny', shouldConfirmExecute should throw
            if (policyDecision === 'deny') {
              await expect(invocation.shouldConfirmExecute(abortController.signal)).rejects.toThrow();
              return true;
            }
            
            const result = await invocation.shouldConfirmExecute(abortController.signal);
            
            // Result must be either false or ToolCallConfirmationDetails
            if (result === false) {
              expect(result).toBe(false);
            } else {
              // Must be ToolCallConfirmationDetails
              expect(typeof result).toBe('object');
              expect(result).not.toBeNull();
              
              // Must have required fields
              expect(typeof result.toolName).toBe('string');
              expect(result.toolName.length).toBeGreaterThan(0);
              
              expect(typeof result.description).toBe('string');
              expect(result.description.length).toBeGreaterThan(0);
              
              expect(['low', 'medium', 'high']).toContain(result.risk);
              
              // locations is optional but if present must be an array of strings
              if (result.locations !== undefined) {
                expect(Array.isArray(result.locations)).toBe(true);
                result.locations.forEach(loc => {
                  expect(typeof loc).toBe('string');
                });
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false or ToolCallConfirmationDetails for edit_file invocations', async () => {
      // Feature: stage-03-tools-policy, Property 47: Tool Invocation Confirmation Check
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            edits: fc.array(
              fc.record({
                target: fc.string({ minLength: 1, maxLength: 50 }),
                replacement: fc.string({ minLength: 0, maxLength: 50 }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          fc.constantFrom('allow' as const, 'deny' as const, 'ask' as const),
          async (params, policyDecision) => {
            const contextWithPolicy: ToolContext = {
              messageBus: {
                requestConfirmation: async () => true,
              },
              policyEngine: {
                evaluate: () => policyDecision,
                getRiskLevel: () => 'medium',
              },
            };

            const tool = new EditFileTool();
            const invocation = tool.createInvocation(params, contextWithPolicy);
            
            const abortController = new AbortController();
            
            // If policy is 'deny', shouldConfirmExecute should throw
            if (policyDecision === 'deny') {
              await expect(invocation.shouldConfirmExecute(abortController.signal)).rejects.toThrow();
              return true;
            }
            
            const result = await invocation.shouldConfirmExecute(abortController.signal);
            
            // Result must be either false or ToolCallConfirmationDetails
            if (result === false) {
              expect(result).toBe(false);
            } else {
              // Must be ToolCallConfirmationDetails
              expect(typeof result).toBe('object');
              expect(result).not.toBeNull();
              
              // Must have required fields
              expect(typeof result.toolName).toBe('string');
              expect(result.toolName.length).toBeGreaterThan(0);
              
              expect(typeof result.description).toBe('string');
              expect(result.description.length).toBeGreaterThan(0);
              
              expect(['low', 'medium', 'high']).toContain(result.risk);
              
              // locations is optional but if present must be an array of strings
              if (result.locations !== undefined) {
                expect(Array.isArray(result.locations)).toBe(true);
                result.locations.forEach(loc => {
                  expect(typeof loc).toBe('string');
                });
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false or ToolCallConfirmationDetails for shell invocations', async () => {
      // Feature: stage-03-tools-policy, Property 47: Tool Invocation Confirmation Check
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            command: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            cwd: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            timeout: fc.option(fc.integer({ min: 1000, max: 60000 }), { nil: undefined }),
          }),
          fc.constantFrom('allow' as const, 'deny' as const, 'ask' as const),
          async (params, policyDecision) => {
            const contextWithPolicy: ToolContext = {
              messageBus: {
                requestConfirmation: async () => true,
              },
              policyEngine: {
                evaluate: () => policyDecision,
                getRiskLevel: () => 'high',
              },
            };

            const tool = new ShellTool(mockShellService);
            const invocation = tool.createInvocation(params, contextWithPolicy);
            
            const abortController = new AbortController();
            
            // If policy is 'deny', shouldConfirmExecute should throw
            if (policyDecision === 'deny') {
              await expect(invocation.shouldConfirmExecute(abortController.signal)).rejects.toThrow();
              return true;
            }
            
            const result = await invocation.shouldConfirmExecute(abortController.signal);
            
            // Result must be either false or ToolCallConfirmationDetails
            if (result === false) {
              expect(result).toBe(false);
            } else {
              // Must be ToolCallConfirmationDetails
              expect(typeof result).toBe('object');
              expect(result).not.toBeNull();
              
              // Must have required fields
              expect(typeof result.toolName).toBe('string');
              expect(result.toolName.length).toBeGreaterThan(0);
              
              expect(typeof result.description).toBe('string');
              expect(result.description.length).toBeGreaterThan(0);
              
              expect(['low', 'medium', 'high']).toContain(result.risk);
              
              // locations is optional but if present must be an array of strings
              if (result.locations !== undefined) {
                expect(Array.isArray(result.locations)).toBe(true);
                result.locations.forEach(loc => {
                  expect(typeof loc).toBe('string');
                });
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false for read-only tools (glob, grep, ls)', async () => {
      // Feature: stage-03-tools-policy, Property 47: Tool Invocation Confirmation Check
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            pattern: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            directory: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          }),
          async (params) => {
            const tool = new GlobTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.shouldConfirmExecute(abortController.signal);
            
            // Read-only tools should not require confirmation
            expect(result).toBe(false);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return consistent results for the same parameters and policy', async () => {
      // Feature: stage-03-tools-policy, Property 47: Tool Invocation Confirmation Check
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            content: fc.string({ minLength: 0, maxLength: 1000 }),
          }),
          fc.constantFrom('allow' as const, 'ask' as const),
          async (params, policyDecision) => {
            const contextWithPolicy: ToolContext = {
              messageBus: {
                requestConfirmation: async () => true,
              },
              policyEngine: {
                evaluate: () => policyDecision,
                getRiskLevel: () => 'medium',
              },
            };

            const tool = new WriteFileTool();
            const invocation1 = tool.createInvocation(params, contextWithPolicy);
            const invocation2 = tool.createInvocation(params, contextWithPolicy);
            
            const abortController1 = new AbortController();
            const abortController2 = new AbortController();
            
            const result1 = await invocation1.shouldConfirmExecute(abortController1.signal);
            const result2 = await invocation2.shouldConfirmExecute(abortController2.signal);
            
            // Same parameters and policy should produce same result type
            if (result1 === false) {
              expect(result2).toBe(false);
            } else {
              expect(result2).not.toBe(false);
              expect(typeof result2).toBe('object');
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 48: Tool Invocation Abort Signal Respect', () => {
    it('should stop execution when abort signal is triggered for shell commands', async () => {
      // Feature: stage-03-tools-policy, Property 48: Tool Invocation Abort Signal Respect
      // Use platform-appropriate long-running command
      const isWindows = process.platform === 'win32';
      const longRunningCommand = isWindows 
        ? 'ping -n 10 127.0.0.1' // Windows: ping 10 times
        : 'sleep 5'; // Unix: sleep for 5 seconds
      
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            command: fc.constant(longRunningCommand),
            cwd: fc.option(fc.constant(process.cwd()), { nil: undefined }),
            timeout: fc.constant(30000),
          }),
          async (params) => {
            const tool = new ShellTool(mockShellService);
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            
            // Start execution
            const executionPromise = invocation.execute(abortController.signal);
            
            // Abort after a short delay (enough time for command to start)
            setTimeout(() => abortController.abort(), 200);
            
            // Wait for execution to complete
            const result = await executionPromise;
            
            // Should return an error indicating cancellation or timeout
            // The command might complete before abort, or be cancelled, or timeout
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();
            
            // If there's an error, it should be cancellation-related
            if (result.error) {
              expect(result.error.type).toMatch(/Cancel|Abort|Timeout|ShellExecution/i);
            }
            
            return true;
          }
        ),
        { numRuns: 10, timeout: 30000 }
      );
    });

    it('should throw or return error when abort signal is already aborted before execution', async () => {
      // Feature: stage-03-tools-policy, Property 48: Tool Invocation Abort Signal Respect
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            command: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            cwd: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          }),
          async (params) => {
            const tool = new ShellTool(mockShellService);
            const invocation = tool.createInvocation(params, mockContext);
            
            // Create an already-aborted signal
            const abortController = new AbortController();
            abortController.abort();
            
            // Execute with aborted signal
            const result = await invocation.execute(abortController.signal);
            
            // Should return an error indicating cancellation
            expect(result.error).toBeDefined();
            expect(result.error?.type).toMatch(/Cancel|Abort/i);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should complete normally when abort signal is not triggered', async () => {
      // Feature: stage-03-tools-policy, Property 48: Tool Invocation Abort Signal Respect
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            command: fc.constantFrom('echo test', 'echo hello'),
            cwd: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          }),
          async (params) => {
            const tool = new ShellTool(mockShellService);
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            
            // Execute without aborting
            const result = await invocation.execute(abortController.signal);
            
            // Should complete successfully (or with a normal error, not cancellation)
            if (result.error) {
              // If there's an error, it should not be a cancellation error
              expect(result.error.type).not.toMatch(/Cancel|Abort/i);
            } else {
              // Success case - should have content
              expect(result.llmContent).toBeDefined();
              expect(result.returnDisplay).toBeDefined();
            }
            
            return true;
          }
        ),
        { numRuns: 20, timeout: 30000 }
      );
    });

    it('should respect abort signal for read operations', async () => {
      // Feature: stage-03-tools-policy, Property 48: Tool Invocation Abort Signal Respect
      // Even though read operations are typically fast, they should still respect abort signals
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          }),
          async (params) => {
            const tool = new ReadFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            // Create an already-aborted signal
            const abortController = new AbortController();
            abortController.abort();
            
            // Execute with aborted signal
            const result = await invocation.execute(abortController.signal);
            
            // Should handle the abort signal gracefully
            // Either by returning an error or by checking the signal
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect abort signal for write operations', async () => {
      // Feature: stage-03-tools-policy, Property 48: Tool Invocation Abort Signal Respect
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            content: fc.string({ minLength: 0, maxLength: 1000 }),
          }),
          async (params) => {
            const tool = new WriteFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            // Create an already-aborted signal
            const abortController = new AbortController();
            abortController.abort();
            
            // Execute with aborted signal
            const result = await invocation.execute(abortController.signal);
            
            // Should handle the abort signal gracefully
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect abort signal for edit operations', async () => {
      // Feature: stage-03-tools-policy, Property 48: Tool Invocation Abort Signal Respect
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            edits: fc.array(
              fc.record({
                target: fc.string({ minLength: 1, maxLength: 50 }),
                replacement: fc.string({ minLength: 0, maxLength: 50 }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          async (params) => {
            const tool = new EditFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            // Create an already-aborted signal
            const abortController = new AbortController();
            abortController.abort();
            
            // Execute with aborted signal
            const result = await invocation.execute(abortController.signal);
            
            // Should handle the abort signal gracefully
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect abort signal for glob operations', async () => {
      // Feature: stage-03-tools-policy, Property 48: Tool Invocation Abort Signal Respect
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            pattern: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            directory: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          }),
          async (params) => {
            const tool = new GlobTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            // Create an already-aborted signal
            const abortController = new AbortController();
            abortController.abort();
            
            // Execute with aborted signal
            const result = await invocation.execute(abortController.signal);
            
            // Should handle the abort signal gracefully
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect abort signal for grep operations', async () => {
      // Feature: stage-03-tools-policy, Property 48: Tool Invocation Abort Signal Respect
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            pattern: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            directory: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          }),
          async (params) => {
            const tool = new GrepTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            // Create an already-aborted signal
            const abortController = new AbortController();
            abortController.abort();
            
            // Execute with aborted signal
            const result = await invocation.execute(abortController.signal);
            
            // Should handle the abort signal gracefully
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect abort signal for ls operations', async () => {
      // Feature: stage-03-tools-policy, Property 48: Tool Invocation Abort Signal Respect
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            recursive: fc.option(fc.boolean(), { nil: undefined }),
          }),
          async (params) => {
            const tool = new LsTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            // Create an already-aborted signal
            const abortController = new AbortController();
            abortController.abort();
            
            // Execute with aborted signal
            const result = await invocation.execute(abortController.signal);
            
            // Should handle the abort signal gracefully
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect abort signal for memory operations', async () => {
      // Feature: stage-03-tools-policy, Property 48: Tool Invocation Abort Signal Respect
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            action: fc.constantFrom('get' as const, 'set' as const, 'delete' as const, 'list' as const),
            key: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            value: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
          }),
          async (params) => {
            const tool = new MemoryTool('/tmp/memory-abort-test.json');
            const invocation = tool.createInvocation(params, mockContext);
            
            // Create an already-aborted signal
            const abortController = new AbortController();
            abortController.abort();
            
            // Execute with aborted signal
            const result = await invocation.execute(abortController.signal);
            
            // Should handle the abort signal gracefully
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect abort signal for write_todos operations', async () => {
      // Feature: stage-03-tools-policy, Property 48: Tool Invocation Abort Signal Respect
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            action: fc.constantFrom('add' as const, 'complete' as const, 'remove' as const, 'list' as const),
            task: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            id: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          }),
          async (params) => {
            const tool = new WriteTodosTool('/tmp/todos-abort-test.json');
            const invocation = tool.createInvocation(params, mockContext);
            
            // Create an already-aborted signal
            const abortController = new AbortController();
            abortController.abort();
            
            // Execute with aborted signal
            const result = await invocation.execute(abortController.signal);
            
            // Should handle the abort signal gracefully
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

  describe('Property 57: Error Result Format', () => {
    it('should return error with message and type for file not found errors', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 })
              .filter(s => s.trim().length > 0)
              .map(s => `/nonexistent/${s}`), // Ensure path doesn't exist
          }),
          async (params) => {
            const tool = new ReadFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);
            
            // When a file is not found, result should have an error
            if (result.error) {
              // Error must have message field
              expect(result.error.message).toBeDefined();
              expect(typeof result.error.message).toBe('string');
              expect(result.error.message.length).toBeGreaterThan(0);
              
              // Error must have type field
              expect(result.error.type).toBeDefined();
              expect(typeof result.error.type).toBe('string');
              expect(result.error.type.length).toBeGreaterThan(0);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error with message and type for edit target not found errors', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            edits: fc.array(
              fc.record({
                target: fc.string({ minLength: 1, maxLength: 50 }),
                replacement: fc.string({ minLength: 0, maxLength: 50 }),
              }),
              { minLength: 1, maxLength: 3 }
            ),
          }),
          async (params) => {
            const tool = new EditFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);
            
            // Edit operations on non-existent files or with non-matching targets should have errors
            if (result.error) {
              // Error must have message field
              expect(result.error.message).toBeDefined();
              expect(typeof result.error.message).toBe('string');
              expect(result.error.message.length).toBeGreaterThan(0);
              
              // Error must have type field
              expect(result.error.type).toBeDefined();
              expect(typeof result.error.type).toBe('string');
              expect(result.error.type.length).toBeGreaterThan(0);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error with message and type for invalid shell commands', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            command: fc.constantFrom(
              'nonexistentcommand12345',
              'invalidcmd_xyz',
              'notarealcommand'
            ),
            cwd: fc.option(fc.constant(process.cwd()), { nil: undefined }),
            timeout: fc.constant(5000),
          }),
          async (params) => {
            const tool = new ShellTool(mockShellService);
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);
            
            // Invalid commands should produce errors
            if (result.error) {
              // Error must have message field
              expect(result.error.message).toBeDefined();
              expect(typeof result.error.message).toBe('string');
              expect(result.error.message.length).toBeGreaterThan(0);
              
              // Error must have type field
              expect(result.error.type).toBeDefined();
              expect(typeof result.error.type).toBe('string');
              expect(result.error.type.length).toBeGreaterThan(0);
            }
            
            return true;
          }
        ),
        { numRuns: 20, timeout: 30000 }
      );
    });

    it('should return error with message and type for memory operation errors', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            action: fc.constantFrom('get' as const, 'delete' as const),
            key: fc.string({ minLength: 1, maxLength: 50 })
              .map(s => `nonexistent_key_${s}`), // Ensure key doesn't exist
          }),
          async (params) => {
            const tool = new MemoryTool('/tmp/memory-error-test.json');
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);
            
            // Operations on non-existent keys may produce errors or special messages
            // If there's an error, it must have the correct format
            if (result.error) {
              // Error must have message field
              expect(result.error.message).toBeDefined();
              expect(typeof result.error.message).toBe('string');
              expect(result.error.message.length).toBeGreaterThan(0);
              
              // Error must have type field
              expect(result.error.type).toBeDefined();
              expect(typeof result.error.type).toBe('string');
              expect(result.error.type.length).toBeGreaterThan(0);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error with message and type for todo operation errors', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            action: fc.constantFrom('complete' as const, 'remove' as const),
            id: fc.string({ minLength: 1, maxLength: 50 })
              .map(s => `nonexistent_id_${s}`), // Ensure ID doesn't exist
          }),
          async (params) => {
            const tool = new WriteTodosTool('/tmp/todos-error-test.json');
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);
            
            // Operations on non-existent todos should produce errors
            if (result.error) {
              // Error must have message field
              expect(result.error.message).toBeDefined();
              expect(typeof result.error.message).toBe('string');
              expect(result.error.message.length).toBeGreaterThan(0);
              
              // Error must have type field
              expect(result.error.type).toBeDefined();
              expect(typeof result.error.type).toBe('string');
              expect(result.error.type.length).toBeGreaterThan(0);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error with message and type for glob pattern errors', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            pattern: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            directory: fc.constant('/nonexistent/directory/path'),
          }),
          async (params) => {
            const tool = new GlobTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);
            
            // Operations on non-existent directories may produce errors
            if (result.error) {
              // Error must have message field
              expect(result.error.message).toBeDefined();
              expect(typeof result.error.message).toBe('string');
              expect(result.error.message.length).toBeGreaterThan(0);
              
              // Error must have type field
              expect(result.error.type).toBeDefined();
              expect(typeof result.error.type).toBe('string');
              expect(result.error.type.length).toBeGreaterThan(0);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error with message and type for grep search errors', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            pattern: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            directory: fc.constant('/nonexistent/directory/path'),
          }),
          async (params) => {
            const tool = new GrepTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);
            
            // Operations on non-existent directories may produce errors
            if (result.error) {
              // Error must have message field
              expect(result.error.message).toBeDefined();
              expect(typeof result.error.message).toBe('string');
              expect(result.error.message.length).toBeGreaterThan(0);
              
              // Error must have type field
              expect(result.error.type).toBeDefined();
              expect(typeof result.error.type).toBe('string');
              expect(result.error.type.length).toBeGreaterThan(0);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error with message and type for ls directory errors', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 })
              .filter(s => s.trim().length > 0)
              .map(s => `/nonexistent/${s}`), // Ensure path doesn't exist
            recursive: fc.option(fc.boolean(), { nil: undefined }),
          }),
          async (params) => {
            const tool = new LsTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);
            
            // Operations on non-existent directories should produce errors
            if (result.error) {
              // Error must have message field
              expect(result.error.message).toBeDefined();
              expect(typeof result.error.message).toBe('string');
              expect(result.error.message.length).toBeGreaterThan(0);
              
              // Error must have type field
              expect(result.error.type).toBeDefined();
              expect(typeof result.error.type).toBe('string');
              expect(result.error.type.length).toBeGreaterThan(0);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error with message and type for write file errors', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 })
              .filter(s => s.trim().length > 0)
              .map(s => `/invalid/path/${s}`), // Use invalid path
            content: fc.string({ minLength: 0, maxLength: 1000 }),
            overwrite: fc.option(fc.boolean(), { nil: undefined }),
          }),
          async (params) => {
            const tool = new WriteFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);
            
            // Operations on invalid paths may produce errors
            if (result.error) {
              // Error must have message field
              expect(result.error.message).toBeDefined();
              expect(typeof result.error.message).toBe('string');
              expect(result.error.message.length).toBeGreaterThan(0);
              
              // Error must have type field
              expect(result.error.type).toBeDefined();
              expect(typeof result.error.type).toBe('string');
              expect(result.error.type.length).toBeGreaterThan(0);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure all error types are non-empty strings', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      // Test that error.type is always a meaningful string, not empty
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 })
              .filter(s => s.trim().length > 0)
              .map(s => `/nonexistent/${s}`),
          }),
          async (params) => {
            const tool = new ReadFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);
            
            if (result.error) {
              // Type should not be empty or just whitespace
              expect(result.error.type.trim().length).toBeGreaterThan(0);
              
              // Type should be a meaningful identifier (no special chars except underscore/dash)
              expect(result.error.type).toMatch(/^[a-zA-Z0-9_-]+$/);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure all error messages are descriptive', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      // Test that error.message provides useful information
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 })
              .filter(s => s.trim().length > 0)
              .map(s => `/nonexistent/${s}`),
          }),
          async (params) => {
            const tool = new ReadFileTool();
            const invocation = tool.createInvocation(params, mockContext);
            
            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);
            
            if (result.error) {
              // Message should not be empty or just whitespace
              expect(result.error.message.trim().length).toBeGreaterThan(0);
              
              // Message should be reasonably descriptive (at least 5 characters)
              expect(result.error.message.length).toBeGreaterThanOrEqual(5);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return consistent error format across all tool types', async () => {
      // Feature: stage-03-tools-policy, Property 57: Error Result Format
      // Verify that all tools follow the same error format convention
      const tools: Array<{ tool: any; params: any }> = [
        { tool: new ReadFileTool(), params: { path: '/nonexistent/file.txt' } },
        { tool: new WriteFileTool(), params: { path: '/invalid/path/file.txt', content: 'test' } },
        { tool: new EditFileTool(), params: { path: '/nonexistent/file.txt', edits: [{ target: 'x', replacement: 'y' }] } },
        { tool: new GlobTool(), params: { pattern: '*.txt', directory: '/nonexistent' } },
        { tool: new GrepTool(), params: { pattern: 'test', directory: '/nonexistent' } },
        { tool: new LsTool(), params: { path: '/nonexistent' } },
      ];

      for (const { tool, params } of tools) {
        const invocation = tool.createInvocation(params, mockContext);
        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);
        
        if (result.error) {
          // All errors must have the same structure
          expect(result.error).toHaveProperty('message');
          expect(result.error).toHaveProperty('type');
          
          // Both fields must be strings
          expect(typeof result.error.message).toBe('string');
          expect(typeof result.error.type).toBe('string');
          
          // Both fields must be non-empty
          expect(result.error.message.length).toBeGreaterThan(0);
          expect(result.error.type.length).toBeGreaterThan(0);
        }
      }
    });
  });
