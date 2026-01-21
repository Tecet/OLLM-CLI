/**
 * Property-based tests for QuickActionsMenu
 * 
 * These tests validate universal properties that should hold for the quick
 * actions menu using fast-check for property-based testing.
 * 
 * Feature: file-explorer-ui
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { render } from 'ink-testing-library';
import { QuickActionsMenu } from '../../QuickActionsMenu.js';
import type { FileNode, GitStatus } from '../../types.js';

/**
 * Arbitrary generator for file nodes
 */
const fileNodeArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  path: fc.string({ minLength: 1, maxLength: 200 }),
  type: fc.constantFrom('file' as const, 'directory' as const),
  expanded: fc.boolean(),
  children: fc.constant(undefined),
  gitStatus: fc.option(
    fc.constantFrom<GitStatus>('untracked', 'modified', 'ignored', 'clean'),
    { nil: undefined }
  ),
  isFocused: fc.boolean(),
}) as fc.Arbitrary<FileNode>;

describe('QuickActionsMenu - Property Tests', () => {
  /**
   * Property 28: Quick Actions Menu Contains Required Options
   * 
   * For any invocation of the Quick Actions menu, it should contain all
   * required options: Open, Focus, Edit, Rename, Delete, Copy Path.
   * 
   * The menu should display these options regardless of the selected node type,
   * though some options may be disabled for directories.
   * 
   * Validates: Requirements 7.4
   */
  test('Property 28: Quick Actions Menu Contains Required Options', () => {
    fc.assert(
      fc.property(
        fileNodeArbitrary,
        (selectedNode) => {
          // Render the menu
          const { lastFrame } = render(
            <QuickActionsMenu
              selectedNode={selectedNode}
              isOpen={true}
              onAction={() => {}}
              onClose={() => {}}
            />
          );

          const output = lastFrame();

          // Verify menu is rendered
          expect(output).toBeDefined();
          expect(output).toContain('Quick Actions');

          // Verify all required options are present in the output
          // Each option should have its label visible
          const optionLabels = {
            open: 'Open (View)',
            focus: 'Focus (Add to Context)',
            edit: 'Edit (External Editor)',
            rename: 'Rename',
            delete: 'Delete',
            copyPath: 'Copy Path',
          };

          // Count how many required options are present
          let presentOptions = 0;
          for (const label of Object.values(optionLabels)) {
            if (output?.includes(label)) {
              presentOptions++;
            }
          }

          // For files, all options should be present
          // For directories, only rename, delete, and copyPath should be present
          if (selectedNode.type === 'file') {
            expect(presentOptions).toBe(6); // All 6 options
            
            // Verify all keyboard shortcuts are shown for files
            expect(output).toContain('[o]'); // Open shortcut
            expect(output).toContain('[f]'); // Focus shortcut
            expect(output).toContain('[e]'); // Edit shortcut
            expect(output).toContain('[r]'); // Rename shortcut
            expect(output).toContain('[d]'); // Delete shortcut
            expect(output).toContain('[c]'); // Copy Path shortcut
          } else {
            expect(presentOptions).toBe(3); // Only rename, delete, copyPath
            
            // Verify only directory-applicable shortcuts are shown
            expect(output).toContain('[r]'); // Rename shortcut
            expect(output).toContain('[d]'); // Delete shortcut
            expect(output).toContain('[c]'); // Copy Path shortcut
          }

          // Verify help text is present
          expect(output).toContain('Esc to close');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 28b: Menu Options Are Correctly Enabled/Disabled Based on Node Type
   * 
   * For any file node, all options should be enabled.
   * For any directory node, only rename, delete, and copyPath should be enabled.
   * 
   * Validates: Requirements 7.4
   */
  test('Property 28b: Menu Options Are Correctly Enabled/Disabled Based on Node Type', () => {
    fc.assert(
      fc.property(
        fileNodeArbitrary,
        (selectedNode) => {
          // Render the menu
          const { lastFrame } = render(
            <QuickActionsMenu
              selectedNode={selectedNode}
              isOpen={true}
              onAction={() => {}}
              onClose={() => {}}
            />
          );

          const output = lastFrame();

          if (selectedNode.type === 'file') {
            // For files, all options should be visible
            expect(output).toContain('Open (View)');
            expect(output).toContain('Focus (Add to Context)');
            expect(output).toContain('Edit (External Editor)');
            expect(output).toContain('Rename');
            expect(output).toContain('Delete');
            expect(output).toContain('Copy Path');
          } else {
            // For directories, only rename, delete, and copyPath should be visible
            expect(output).not.toContain('Open (View)');
            expect(output).not.toContain('Focus (Add to Context)');
            expect(output).not.toContain('Edit (External Editor)');
            expect(output).toContain('Rename');
            expect(output).toContain('Delete');
            expect(output).toContain('Copy Path');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 28c: Menu Displays Selected Node Name
   * 
   * For any selected node, the menu should display the node's name in the header.
   * 
   * Validates: Requirements 7.4
   */
  test('Property 28c: Menu Displays Selected Node Name', () => {
    fc.assert(
      fc.property(
        fileNodeArbitrary,
        (selectedNode) => {
          // Render the menu
          const { lastFrame } = render(
            <QuickActionsMenu
              selectedNode={selectedNode}
              isOpen={true}
              onAction={() => {}}
              onClose={() => {}}
            />
          );

          const output = lastFrame();

          // Verify the node name is displayed in the header
          expect(output).toContain(selectedNode.name);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 28d: Menu Does Not Render When Closed
   * 
   * When isOpen is false, the menu should not render anything.
   * 
   * Validates: Requirements 7.4
   */
  test('Property 28d: Menu Does Not Render When Closed', () => {
    fc.assert(
      fc.property(
        fileNodeArbitrary,
        (selectedNode) => {
          // Render the menu with isOpen=false
          const { lastFrame } = render(
            <QuickActionsMenu
              selectedNode={selectedNode}
              isOpen={false}
              onAction={() => {}}
              onClose={() => {}}
            />
          );

          const output = lastFrame();

          // Menu should not render anything when closed
          expect(output).toBe('');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 28e: Menu Handles Null Selected Node
   * 
   * When selectedNode is null, the menu should display an appropriate message.
   * 
   * Validates: Requirements 7.4
   */
  test('Property 28e: Menu Handles Null Selected Node', () => {
    // Render the menu with null selectedNode
    const { lastFrame } = render(
      <QuickActionsMenu
        selectedNode={null}
        isOpen={true}
        onAction={() => {}}
        onClose={() => {}}
      />
    );

    const output = lastFrame();

    // Should display a message about no selection
    expect(output).toContain('No file or folder selected');
    expect(output).toContain('Esc to close');
  });
});
