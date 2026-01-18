import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { render, cleanup } from '../../../../test/ink-testing.js';
import { ToolsTab } from '../ToolsTab.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import { FocusProvider } from '../../../../features/context/FocusContext.js';
import { ModelProvider } from '../../../../features/context/ModelContext.js';
import { keyboardHandler } from '../../../services/keyboardHandler.js';
import { ProviderAdapter } from '@ollm/ollm-cli-core/provider/types.js';

/**
 * Property-based tests for ToolsTab component
 * 
 * Feature: stage-06b-tool-support-detection
 */

// Mock provider for testing
const createMockProvider = (): ProviderAdapter => ({
  name: 'mock',
  chatStream: vi.fn(),
  listModels: vi.fn(),
  pullModel: vi.fn(),
  deleteModel: vi.fn(),
  showModel: vi.fn(),
});

describe('ToolsTab - Property Tests', () => {
  beforeEach(() => {
    cleanup();
    keyboardHandler.clear();
  });

  /**
   * Property 25: Tools Panel Display
   * 
   * The ToolsTab should display the ToolsPanel with tool configuration
   * when the model supports tools.
   * 
   * Validates: Requirements 25.1, 25.2, 25.3
   * 
   * Feature: stage-06b-tool-support-detection, Property 25: Tools Panel Display
   */
  it('should display tools configuration panel when model supports tools', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // modelSupportsTools
        (supportsTools) => {
          cleanup();
          keyboardHandler.clear();

          // Create a mock provider
          const mockProvider = createMockProvider();

          // Render the component
          const { lastFrame } = render(
            <UIProvider>
              <FocusProvider>
                <ModelProvider 
                  provider={mockProvider}
                  initialModel={supportsTools ? 'llama3.2:latest' : 'gemma3:1b'}
                >
                  <ToolsTab />
                </ModelProvider>
              </FocusProvider>
            </UIProvider>
          );

          const output = lastFrame();

          if (supportsTools) {
            // Should display tools configuration with compact header
            expect(output).toContain('Tools Configuration');
            expect(output).toContain('↑↓:Nav');
            expect(output).toContain('Enter:Toggle');
          } else {
            // Should display "Model doesn't support tools" message
            expect(output).toContain("Model doesn't support tools");
            expect(output).toContain('does not support function calling');
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 26: Category Display
   * 
   * The ToolsTab should display tool categories (at least some visible in the window).
   * 
   * Validates: Requirements 25.3
   * 
   * Feature: stage-06b-tool-support-detection, Property 26: Category Display
   */
  it('should display tool categories', () => {
    cleanup();
    keyboardHandler.clear();

    // Create a mock provider
    const mockProvider = createMockProvider();

    // Render the component
    const { lastFrame } = render(
      <UIProvider>
        <FocusProvider>
          <ModelProvider 
            provider={mockProvider}
            initialModel="llama3.2:latest"
          >
            <ToolsTab />
          </ModelProvider>
        </FocusProvider>
      </UIProvider>
    );

    const output = lastFrame();

    // Verify at least some categories are displayed (windowed rendering)
    // The first few categories should be visible
    const visibleCategories = [
      'File Operations',
      'File Discovery',
      'Shell',
      'Web',
    ];

    for (const category of visibleCategories) {
      expect(output).toContain(category);
    }
    
    // Verify scroll indicator is present (indicating more content below)
    expect(output).toContain('Scroll down for more');
  });
});
