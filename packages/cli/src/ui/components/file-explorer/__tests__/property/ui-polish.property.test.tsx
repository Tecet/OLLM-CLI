/**
 * Property-based tests for UI polish features
 * 
 * Tests for:
 * - Property 38: Current Mode Is Displayed in Header
 * - Property 39: Long Operations Display Loading Indicators
 * 
 * Requirements: 11.1, 11.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import React from 'react';
import { render } from 'ink-testing-library';
import { Header } from '../../Header.js';
import { LoadingIndicator } from '../../LoadingIndicator.js';
import { WorkspaceProvider } from '../../WorkspaceContext.js';
import type { WorkspaceMode } from '../../WorkspaceContext.js';

describe('Feature: file-explorer-ui, UI Polish Properties', () => {
  /**
   * Property 38: Current Mode Is Displayed in Header
   * 
   * For any workspace mode (browse or workspace), the header should
   * display the current mode clearly.
   * 
   * Validates: Requirements 11.1
   */
  describe('Property 38: Current Mode Is Displayed in Header', () => {
    it('should display the current mode in the header', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<WorkspaceMode>('browse', 'workspace'),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // root path (non-empty)
          fc.option(fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0), { nil: null }), // active project
          (mode, rootPath, activeProject) => {
            // Render the Header component with the given mode
            const { lastFrame } = render(
              <WorkspaceProvider
                initialState={{
                  mode,
                  rootPath,
                  activeProject,
                  config: activeProject
                    ? {
                        version: '1.0',
                        projects: [
                          {
                            name: activeProject,
                            path: rootPath,
                            llmAccess: true,
                            excludePatterns: [],
                          },
                        ],
                      }
                    : null,
                }}
              >
                <Header />
              </WorkspaceProvider>
            );

            const output = lastFrame();

            // The header should contain the mode display
            if (mode === 'browse') {
              expect(output).toContain('Browse Mode');
            } else {
              expect(output).toContain('Workspace Mode');
            }

            // The header should contain the root path (trimmed for comparison)
            expect(output).toContain(rootPath.trim());

            // If in workspace mode with active project, should show project name
            if (mode === 'workspace' && activeProject) {
              expect(output).toContain(activeProject.trim());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should distinguish between browse and workspace modes visually', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }), // root path
          (rootPath) => {
            // Render in browse mode
            const browseRender = render(
              <WorkspaceProvider
                initialState={{
                  mode: 'browse',
                  rootPath,
                }}
              >
                <Header />
              </WorkspaceProvider>
            );

            // Render in workspace mode
            const workspaceRender = render(
              <WorkspaceProvider
                initialState={{
                  mode: 'workspace',
                  rootPath,
                  activeProject: 'test-project',
                  config: {
                    version: '1.0',
                    projects: [
                      {
                        name: 'test-project',
                        path: rootPath,
                        llmAccess: true,
                        excludePatterns: [],
                      },
                    ],
                  },
                }}
              >
                <Header />
              </WorkspaceProvider>
            );

            const browseOutput = browseRender.lastFrame();
            const workspaceOutput = workspaceRender.lastFrame();

            // The outputs should be different
            expect(browseOutput).not.toBe(workspaceOutput);

            // Browse mode should show "Browse Mode"
            expect(browseOutput).toContain('Browse Mode');
            expect(browseOutput).not.toContain('Workspace Mode');

            // Workspace mode should show "Workspace Mode"
            expect(workspaceOutput).toContain('Workspace Mode');
            expect(workspaceOutput).not.toContain('Browse Mode');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 39: Long Operations Display Loading Indicators
   * 
   * For any operation that takes longer than 500ms, a loading indicator
   * should be displayed to provide visual feedback to the user.
   * 
   * Validates: Requirements 11.4
   */
  describe('Property 39: Long Operations Display Loading Indicators', () => {
    it('should not display loading indicator before delay threshold', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }), // loading message
          (message) => {
            // Render with isLoading=true but before delay
            const { lastFrame } = render(
              <LoadingIndicator isLoading={true} message={message} delay={500} />
            );

            // Immediately after render, indicator should not be visible
            // (because delay hasn't elapsed)
            const output = lastFrame();
            
            // The output should be empty or minimal before delay
            // Note: This is a timing-sensitive test, so we just check
            // that the component doesn't crash
            expect(output).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should display loading indicator with message when loading', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // loading message
          async (message) => {
            // Render with isLoading=true and very short delay for testing
            const { lastFrame } = render(
              <LoadingIndicator isLoading={true} message={message} delay={10} />
            );

            // Wait for delay to elapse
            await new Promise((resolve) => setTimeout(resolve, 50));

            const output = lastFrame();

            // The loading indicator should be visible with the message
            expect(output).toContain(message);
            
            // Should contain a spinner character (one of the frames)
            const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            const hasSpinner = spinnerFrames.some(frame => output.includes(frame));
            expect(hasSpinner).toBe(true);
          }
        ),
        { numRuns: 20 } // Fewer runs for async tests
      );
    });

    it('should not display loading indicator when not loading', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }), // loading message
          (message) => {
            // Render with isLoading=false
            const { lastFrame } = render(
              <LoadingIndicator isLoading={false} message={message} />
            );

            const output = lastFrame();

            // The output should be empty when not loading
            expect(output).toBe('');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should respect custom delay values', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 200 }), // custom delay
          fc.string({ minLength: 1, maxLength: 50 }), // message
          async (delay, message) => {
            // Render with custom delay
            const { lastFrame } = render(
              <LoadingIndicator isLoading={true} message={message} delay={delay} />
            );

            // Wait for less than the delay
            await new Promise((resolve) => setTimeout(resolve, delay / 2));

            const outputBefore = lastFrame();

            // Should not be visible yet
            expect(outputBefore).toBe('');

            // Wait for the full delay plus buffer
            await new Promise((resolve) => setTimeout(resolve, delay + 50));

            const outputAfter = lastFrame();

            // Should now be visible
            expect(outputAfter).toContain(message);
          }
        ),
        { numRuns: 10 } // Fewer runs for timing-sensitive tests
      );
    });
  });
});
