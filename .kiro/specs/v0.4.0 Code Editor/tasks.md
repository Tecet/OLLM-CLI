# Code Editor - Implementation Tasks

**Version**: 0.4.0  
**Status**: 📋 Ready for Implementation  
**Created**: January 22, 2026

## Overview

This implementation plan breaks down the Code Editor feature into discrete, incremental tasks. Each task builds on previous work and includes testing to validate functionality early. The plan follows a bottom-up approach: foundation → services → UI components → integration → polish.

**Current Status**: No Code Editor exists yet. This is a greenfield implementation that will integrate with existing Window Management, File Explorer, and Focus System.

## Tasks

- [ ] 1. Foundation and Type Definitions
  - Create `packages/cli/src/ui/components/code-editor/` directory structure
  - Define all TypeScript interfaces in `types.ts` (EditorState, CursorPosition, Selection, EditorMode, etc.)
  - Create EditorBuffer class for text content management
  - Set up exports in `index.ts`
  - _Requirements: US-1, TR-1, TR-4_

- [ ] 1.1 Write unit tests for EditorBuffer
  - Test constructor with various content (empty, single line, multi-line)
  - Test getLine, getLineCount, getContent methods
  - Test insertAt with various positions and content
  - Test deleteAt with various positions and counts
  - Test isValidPosition with boundary conditions
  - Test line joining on delete operations
  - _Requirements: TR-1_

- [ ] 2. EditorCursor Service
  - [ ] 2.1 Implement cursor movement service
    - Create `packages/cli/src/ui/components/code-editor/services/EditorCursor.ts`
    - Implement moveUp(), moveDown(), moveLeft(), moveRight()
    - Implement moveToLineStart(), moveToLineEnd()
    - Implement moveToFileStart(), moveToFileEnd()
    - Implement moveTo(position) for direct positioning
    - Clamp cursor to valid positions
    - Remember column when moving up/down
    - _Requirements: US-2, TR-1_

  - [ ] 2.2 Write unit tests for cursor movement
    - Test all movement operations
    - Test boundary conditions (empty file, single line, line ends)
    - Test column memory when moving up/down
    - Test cursor clamping to valid positions
    - _Requirements: US-2_

- [ ] 3. EditorContext and State Management
  - [ ] 3.1 Create EditorContext
    - Create `packages/cli/src/ui/components/code-editor/contexts/EditorContext.tsx`
    - Implement EditorProvider component
    - Implement useEditor hook
    - State includes: buffer, cursor, isDirty, filePath, fileName
    - Methods: openFile, closeFile, saveFile, insertText, deleteText
    - Context throws error if used outside provider
    - _Requirements: TR-4_

  - [ ] 3.2 Write unit tests for EditorContext
    - Test context creation and provider
    - Test useEditor hook throws error outside provider
    - Test state updates on file operations
    - Test isDirty flag management
    - _Requirements: TR-4_

- [ ] 4. File Operations Service
  - [ ] 4.1 Implement file loading
    - Create `packages/cli/src/ui/components/code-editor/services/EditorFileOps.ts`
    - Implement loadFile(filePath) to read from disk
    - Check file size before loading (reject > 1MB, warn > 512KB)
    - Validate paths with PathSanitizer
    - Load content into EditorBuffer
    - Handle missing/unreadable files with clear errors
    - _Requirements: US-1, TR-2, TR-3_

  - [ ] 4.2 Write unit tests for file loading
    - Test successful file loading
    - Test file size limits (1MB reject, 512KB warn)
    - Test path validation
    - Test error handling (missing file, permission denied)
    - Test line ending preservation (CRLF vs LF)
    - _Requirements: US-1, TR-2, TR-3, TR-6_

  - [ ] 4.3 Implement file saving
    - Implement saveFile(filePath, content)
    - Create .bak backup on first save
    - Check file permissions before save
    - Preserve line endings (CRLF vs LF)
    - Handle save errors with clear messages
    - _Requirements: US-4, TR-3, TR-6_

  - [ ] 4.4 Write unit tests for file saving
    - Test successful save
    - Test backup file creation
    - Test permission checks
    - Test line ending preservation
    - Test error handling
    - _Requirements: US-4, TR-3, TR-6_


- [ ] 5. Checkpoint - Core Services Complete
  - Ensure all core service tests pass
  - Verify EditorBuffer, EditorCursor, EditorFileOps work correctly
  - Ask the user if questions arise

- [ ] 6. UI Components - Header and Footer
  - [ ] 6.1 Create EditorHeader component
    - Create `packages/cli/src/ui/components/code-editor/EditorHeader.tsx`
    - Display file name with icon (📄)
    - Display dirty indicator (*) when modified
    - Display current line / total lines
    - Display current column
    - Style with border
    - Update when cursor moves or file modified
    - _Requirements: US-1, TR-5_

  - [ ] 6.2 Create EditorFooter component
    - Create `packages/cli/src/ui/components/code-editor/EditorFooter.tsx`
    - Display keyboard shortcuts (Ctrl+S Save, Ctrl+Q Quit, Esc View)
    - Display status messages when present
    - Auto-clear messages after 3 seconds
    - Style with border
    - _Requirements: TR-5_

- [ ] 7. UI Components - Content Area
  - [ ] 7.1 Create EditorContent component
    - Create `packages/cli/src/ui/components/code-editor/EditorContent.tsx`
    - Display line numbers in left gutter
    - Display file content (plain text initially)
    - Display cursor indicator (█)
    - Implement virtual scrolling (only visible lines)
    - Update cursor position in real-time
    - Adjust scroll offset when cursor moves out of view
    - Memoize component to prevent unnecessary re-renders
    - _Requirements: US-1, US-2, TR-1, TR-5_

  - [ ] 7.2 Write unit tests for EditorContent
    - Test line number rendering
    - Test cursor indicator positioning
    - Test virtual scrolling
    - Test scroll offset adjustment
    - Test memoization
    - _Requirements: US-1, US-2, TR-1_

- [ ] 8. Main CodeEditor Component
  - [ ] 8.1 Create CodeEditor component
    - Create `packages/cli/src/ui/components/code-editor/CodeEditor.tsx`
    - Accept initialFilePath prop
    - Use EditorContext for state
    - Render EditorHeader, EditorContent, EditorFooter
    - Load file on mount if initialFilePath provided
    - Show loading state while file loads
    - Show error state if file fails to load
    - _Requirements: US-1, TR-5_

  - [ ] 8.2 Write integration tests for CodeEditor
    - Test component renders without errors
    - Test file loading on mount
    - Test loading state display
    - Test error state display
    - _Requirements: US-1_

- [ ] 9. Keyboard Input Handling
  - [ ] 9.1 Implement cursor navigation keybindings
    - Create `packages/cli/src/ui/components/code-editor/hooks/useEditorKeybindings.ts`
    - Arrow keys move cursor (↑↓←→)
    - Home key moves to line start
    - End key moves to line end
    - Ctrl+Home moves to file start
    - Ctrl+End moves to file end
    - PgUp/PgDn scroll one page
    - Cursor stays visible (auto-scroll)
    - All movements feel responsive (< 50ms)
    - _Requirements: US-2, TR-1_

  - [ ] 9.2 Implement text insertion keybindings
    - Typing inserts characters at cursor
    - Enter key inserts new line
    - Tab key inserts spaces (configurable width, default 2)
    - Cursor advances after insertion
    - File marked as dirty after edit
    - Performance: typing feels instant (< 50ms)
    - _Requirements: US-3, TR-1_

  - [ ] 9.3 Implement text deletion keybindings
    - Backspace deletes character before cursor
    - Delete key deletes character at cursor
    - Backspace at line start joins with previous line
    - Delete at line end joins with next line
    - File marked as dirty after deletion
    - Edge cases handled (empty file, single char)
    - _Requirements: US-3, TR-1_

  - [ ] 9.4 Implement file operation keybindings
    - Ctrl+S saves file to disk
    - Ctrl+Q closes editor
    - Esc switches to view mode (SyntaxViewer)
    - Prompt to save if file has unsaved changes
    - _Requirements: US-4, US-11_

  - [ ] 9.5 Write integration tests for keybindings
    - Test all cursor navigation keys
    - Test text insertion
    - Test text deletion
    - Test file save
    - Test editor close
    - _Requirements: US-2, US-3, US-4, US-11_

- [ ] 10. Window System Integration
  - [ ] 10.1 Integrate with App.tsx
    - Update `packages/cli/src/ui/App.tsx`
    - Replace "Editor - Coming Soon" with CodeEditor
    - Wrap CodeEditor with EditorProvider
    - Ctrl+3 switches to editor window
    - Editor window shows when active
    - Other windows hidden when editor active
    - _Requirements: TR-4_

  - [ ] 10.2 Write integration tests for window system
    - Test window switching to editor
    - Test editor visibility when active
    - Test other windows hidden when editor active
    - _Requirements: TR-4_

- [ ] 11. File Explorer Integration
  - [ ] 11.1 Add editor open keybinding to File Explorer
    - Update `packages/cli/src/ui/components/file-explorer/FileTreeView.tsx`
    - Press 'e' opens file in built-in editor
    - Editor window becomes active automatically
    - File path passed to CodeEditor
    - Ctrl+E still opens external editor
    - Only files can be opened (not directories)
    - Error shown if file cannot be opened
    - _Requirements: US-1, TR-4_

  - [ ] 11.2 Write integration tests for File Explorer
    - Test 'e' key opens file in editor
    - Test editor becomes active
    - Test Ctrl+E still opens external editor
    - Test directory open prevention
    - _Requirements: US-1, TR-4_

- [ ] 12. Checkpoint - MVP Complete
  - Ensure all MVP tests pass
  - Integration test: Open file → Edit → Save → Close
  - Manual testing on Windows, macOS, Linux
  - No TypeScript errors
  - No ESLint warnings
  - Performance meets requirements (< 100ms operations)
  - All Phase 1 user stories satisfied
  - Ask the user for review


- [ ] 13. EditorHistory Service - Undo/Redo
  - [ ] 13.1 Implement undo/redo stack
    - Create `packages/cli/src/ui/components/code-editor/services/EditorHistory.ts`
    - Implement EditorHistory class with undo/redo stacks
    - push(action) adds to undo stack
    - undo() reverts last action
    - redo() reapplies undone action
    - Stack limited to 100 actions
    - Redo stack cleared on new action
    - _Requirements: US-5, TR-1_

  - [ ] 13.2 Write property tests for undo/redo
    - **Property 1: Undo/Redo Round-Trip** - verify undo all → redo all = original
    - Test with random sequences of insert/delete operations
    - Test stack size limit enforcement
    - Test redo stack clearing on new action
    - **Validates: Requirements US-5_

  - [ ] 13.3 Implement undo/redo keybindings
    - Add Ctrl+Z for undo
    - Add Ctrl+Y for redo
    - Restore cursor position with undo/redo
    - Group rapid typing into single undo (500ms debounce)
    - Disable undo/redo when stack empty
    - Update footer with undo/redo shortcuts
    - _Requirements: US-5_

  - [ ] 13.4 Write integration tests for undo/redo
    - Test undo after insert
    - Test undo after delete
    - Test redo after undo
    - Test cursor position restoration
    - Test rapid typing grouping
    - _Requirements: US-5_

- [ ] 14. EditorSelection Service
  - [ ] 14.1 Implement text selection
    - Create `packages/cli/src/ui/components/code-editor/services/EditorSelection.ts`
    - Implement EditorSelection class
    - startSelection(position) begins selection
    - updateSelection(position) updates end
    - clearSelection() clears selection
    - getSelectedText() returns selected text
    - Normalize selection (start before end)
    - Support multi-line selections
    - _Requirements: US-6, TR-1_

  - [ ] 14.2 Write unit tests for selection
    - Test selection start/update/clear
    - Test selection normalization
    - Test multi-line selections
    - Test getSelectedText
    - _Requirements: US-6_

  - [ ] 14.3 Implement selection UI
    - Update EditorContent to highlight selection
    - Shift+Arrow keys select text
    - Selection highlighted visually (inverse colors)
    - Selection updates as cursor moves with Shift
    - Selection cleared on most edit operations
    - Selection cleared on cursor move without Shift
    - _Requirements: US-6_

  - [ ] 14.4 Write integration tests for selection UI
    - Test Shift+Arrow selection
    - Test selection highlighting
    - Test selection clearing
    - _Requirements: US-6_

- [ ] 15. EditorClipboard Service
  - [ ] 15.1 Implement clipboard operations
    - Create `packages/cli/src/ui/components/code-editor/services/EditorClipboard.ts`
    - Use clipboardy for cross-platform clipboard
    - copy(text) copies to clipboard
    - cut(text) cuts to clipboard
    - paste() returns clipboard content
    - Handle clipboard errors gracefully
    - Support multi-line clipboard
    - _Requirements: US-6, TR-6_

  - [ ] 15.2 Write unit tests for clipboard
    - Test copy operation
    - Test cut operation
    - Test paste operation
    - Test multi-line clipboard
    - Test error handling
    - Use mocked clipboard
    - _Requirements: US-6, TR-6_

  - [ ] 15.3 Implement clipboard keybindings
    - Ctrl+C copies selected text
    - Ctrl+X cuts selected text
    - Ctrl+V pastes at cursor
    - Cut deletes selected text
    - Paste replaces selection if present
    - Clipboard persists across editor sessions
    - Error shown if clipboard operation fails
    - _Requirements: US-6_

  - [ ] 15.4 Write integration tests for clipboard
    - Test copy/cut/paste operations
    - Test paste replacing selection
    - Test clipboard persistence
    - _Requirements: US-6_

- [ ] 16. Find Functionality
  - [ ] 16.1 Create FindDialog component
    - Create `packages/cli/src/ui/components/code-editor/FindDialog.tsx`
    - Input field for search query
    - Shows when Ctrl+F pressed
    - Enter finds next occurrence
    - Shift+Enter finds previous
    - Esc closes dialog
    - Style with border
    - Show keyboard shortcuts
    - _Requirements: US-7, TR-5_

  - [ ] 16.2 Implement search service
    - Create `packages/cli/src/ui/components/code-editor/services/EditorSearch.ts`
    - Case-insensitive search by default
    - Find next/previous occurrence
    - Wrap around at file end/start
    - Return match position
    - _Requirements: US-7_

  - [ ] 16.3 Implement find keybindings
    - Ctrl+F opens find dialog
    - F3 finds next occurrence
    - Shift+F3 finds previous
    - Cursor moves to match
    - Matches highlighted in editor
    - Show "No matches" if not found
    - _Requirements: US-7_

  - [ ] 16.4 Write integration tests for find
    - Test find dialog open/close
    - Test find next/previous
    - Test match highlighting
    - Test wrap around
    - Test no matches message
    - _Requirements: US-7_

- [ ] 17. Go To Line Functionality
  - [ ] 17.1 Create GoToLineDialog component
    - Create `packages/cli/src/ui/components/code-editor/GoToLineDialog.tsx`
    - Number input field
    - Shows when Ctrl+G pressed
    - Enter jumps to line
    - Invalid line shows error
    - Esc closes dialog
    - Style with border
    - _Requirements: US-8, TR-5_

  - [ ] 17.2 Implement go to line keybindings
    - Ctrl+G opens go-to-line dialog
    - Cursor jumps to specified line
    - Line number validated (1 to lineCount)
    - Cursor moves to line start
    - Line scrolled into view
    - Error shown for invalid line
    - _Requirements: US-8_

  - [ ] 17.3 Write integration tests for go to line
    - Test dialog open/close
    - Test valid line jump
    - Test invalid line error
    - Test line scrolling into view
    - _Requirements: US-8_

- [ ] 18. Checkpoint - Enhanced Editing Complete
  - Ensure all enhanced editing tests pass
  - Integration tests for undo/redo, clipboard, find, go to line
  - Manual testing on all platforms
  - No regressions from MVP
  - Performance still meets requirements
  - All Phase 2 user stories satisfied
  - Ask the user for review


- [ ] 19. Syntax Highlighting Service
  - [ ] 19.1 Implement EditorSyntax service
    - Create `packages/cli/src/ui/components/code-editor/services/EditorSyntax.ts`
    - Reuse SyntaxViewer's shiki integration
    - detectLanguage(filePath) from file extension
    - highlight(content, language) returns highlighted content
    - applyColorScheme(tokens) applies terminal colors
    - Convert shiki output to terminal ANSI codes
    - Cache highlighted content
    - Debounce updates (500ms)
    - Fall back to plain text if highlighting fails
    - _Requirements: US-9, TR-1_

  - [ ] 19.2 Implement color scheme
    - Green for strings ("text", 'text', \`template\`)
    - Gray for comments (// comment, /* comment */)
    - Yellow for numbers (123, 3.14) and parameters
    - Purple/Magenta for keywords (var, if, else, const, class)
    - Light-blue/Cyan for operators (+, -, &&) and TypeScript types
    - Dark-blue for function names and method calls
    - Red for class names and this keyword
    - White for default text
    - _Requirements: US-9_

  - [ ] 19.3 Write unit tests for syntax highlighting
    - Test language detection from file extension
    - Test highlighting for various languages
    - Test color scheme application
    - Test caching
    - Test fallback to plain text
    - _Requirements: US-9_

  - [ ] 19.4 Integrate syntax highlighting into EditorContent
    - Update EditorContent to use EditorSyntax
    - Apply highlighting to visible lines only
    - Update highlighting as user types (debounced)
    - Plain text fallback for unsupported languages
    - Performance: highlighting doesn't block typing
    - _Requirements: US-9, TR-1_

  - [ ] 19.5 Write integration tests for syntax highlighting
    - Test highlighting applied to visible lines
    - Test language detection
    - Test highlighting updates on typing
    - Test performance (no blocking)
    - _Requirements: US-9, TR-1_

- [ ] 20. Error and Warning Highlighting
  - [ ] 20.1 Implement EditorDiagnostics service
    - Create `packages/cli/src/ui/components/code-editor/services/EditorDiagnostics.ts`
    - Integrate with TypeScript language server (if available)
    - Integrate with getDiagnostics tool (if available)
    - Parse diagnostic messages
    - Map diagnostics to line/column positions
    - Debounce error checking (1000ms)
    - _Requirements: US-9b_

  - [ ] 20.2 Implement error highlighting UI
    - Red underlines for errors
    - Yellow underlines for warnings
    - Error messages displayed inline or on hover
    - Error count shown in status bar
    - Ctrl+E jumps to next error
    - Shift+Ctrl+E jumps to previous error
    - _Requirements: US-9b_

  - [ ] 20.3 Write integration tests for error highlighting
    - Test error underlines
    - Test warning underlines
    - Test error messages
    - Test error count in status bar
    - Test error navigation (Ctrl+E)
    - _Requirements: US-9b_

- [ ] 21. Prettier Integration
  - [ ] 21.1 Add Prettier dependency
    - Add prettier to package.json dependencies
    - Add @types/prettier to devDependencies
    - Run npm install
    - Verify no version conflicts
    - _Requirements: US-10_

  - [ ] 21.2 Implement EditorFormatter service
    - Create `packages/cli/src/ui/components/code-editor/services/EditorFormatter.ts`
    - format(content, filePath) formats with Prettier
    - canFormat(filePath) checks if file type supported
    - loadConfig(workspaceRoot) loads .prettierrc
    - Fall back to Prettier defaults if no config
    - Handle formatting errors gracefully
    - Lazy load Prettier (optional dependency)
    - _Requirements: US-10, TR-6_

  - [ ] 21.3 Write unit tests for formatter
    - Test format operation
    - Test canFormat for various file types
    - Test config loading
    - Test fallback to defaults
    - Test error handling
    - Use mocked Prettier
    - _Requirements: US-10_

  - [ ] 21.4 Implement format keybindings
    - Ctrl+Shift+F formats current file
    - Format-on-save option (configurable, default off)
    - Success message shown after format
    - Error message if format fails
    - Cursor position preserved after format
    - Undo stack updated with format action
    - _Requirements: US-10_

  - [ ] 21.5 Write integration tests for formatting
    - Test Ctrl+Shift+F formats file
    - Test format-on-save
    - Test cursor position preservation
    - Test undo after format
    - _Requirements: US-10_

- [ ] 22. Focus System Integration
  - [ ] 22.1 Integrate with FileFocusContext
    - Update EditorFileOps to check if file is focused
    - On save, update focused file content if focused
    - Use FileFocusContext from File Explorer
    - Handle case where focus system unavailable
    - _Requirements: US-4, TR-4_

  - [ ] 22.2 Write integration tests for focus system
    - Test focus file → edit → save → verify update
    - Test no errors if focus system unavailable
    - _Requirements: US-4, TR-4_

- [ ] 23. Editor Configuration
  - [ ] 23.1 Add EditorConfig to settings
    - Update `packages/cli/src/config/types.ts`
    - Define EditorConfig interface
    - Include: tabSize, formatOnSave, autoSave, autoSaveDelay, maxFileSize, etc.
    - Load config from user settings
    - Apply defaults if config missing
    - _Requirements: TR-4_

  - [ ] 23.2 Implement config loading in CodeEditor
    - Load EditorConfig on mount
    - Apply config to editor services
    - Support config changes without restart
    - _Requirements: TR-4_

- [ ] 24. Auto-Save Feature
  - [ ] 24.1 Implement auto-save
    - Auto-save enabled via config (default: off)
    - Auto-save delay configurable (default: 30s)
    - Auto-save only if file is dirty
    - Auto-save debounced (no save while typing)
    - Status message shown on auto-save
    - Auto-save disabled when editor closed
    - _Requirements: TR-3_

  - [ ] 24.2 Write integration tests for auto-save
    - Test auto-save after delay
    - Test auto-save only when dirty
    - Test auto-save disabled when closed
    - _Requirements: TR-3_

- [ ] 25. External File Change Detection
  - [ ] 25.1 Implement external change detection
    - Check file mtime before save
    - Prompt user if file changed externally
    - Options: Overwrite, Reload, Cancel
    - Reload updates buffer and clears dirty state
    - Overwrite saves anyway
    - Cancel keeps editor open
    - _Requirements: TR-3_

  - [ ] 25.2 Write integration tests for external changes
    - Test detection of external changes
    - Test overwrite option
    - Test reload option
    - Test cancel option
    - _Requirements: TR-3_

- [ ] 26. Multiple File Support
  - [ ] 26.1 Implement multi-file state management
    - Support up to 10 open files
    - Each file has independent state (buffer, cursor, history, etc.)
    - Track active file
    - Track dirty state per file
    - _Requirements: US-12_

  - [ ] 26.2 Create EditorTabs component
    - Create `packages/cli/src/ui/components/code-editor/EditorTabs.tsx`
    - Tab bar shows open files
    - Display file names
    - Display dirty indicators (*)
    - Highlight active tab
    - _Requirements: US-12, TR-5_

  - [ ] 26.3 Implement multi-file keybindings
    - Ctrl+Tab switches to next file
    - Ctrl+Shift+Tab switches to previous file
    - Ctrl+W closes current file
    - Warning when approaching 10 file limit
    - _Requirements: US-12_

  - [ ] 26.4 Write integration tests for multi-file
    - Test opening multiple files
    - Test switching between files
    - Test closing files
    - Test file limit warning
    - Test independent state per file
    - _Requirements: US-12_

- [ ] 27. UI Polish
  - [ ] 27.1 Polish visual design
    - Consistent styling across all components
    - Smooth animations for dialogs
    - Clear visual feedback for all actions
    - Status messages auto-clear after 3s
    - Error messages styled in red
    - Success messages styled in green
    - Loading states for async operations
    - _Requirements: TR-5_

  - [ ] 27.2 Optimize performance
    - Profile rendering performance
    - Optimize virtual scrolling
    - Optimize syntax highlighting
    - Eliminate unnecessary re-renders
    - Measure and document improvements
    - _Requirements: TR-1_

- [ ] 28. Comprehensive Testing
  - [ ] 28.1 Unit tests
    - All services have 100% coverage
    - All edge cases covered
    - All error paths tested
    - _Requirements: All_

  - [ ] 28.2 Integration tests
    - All user stories have integration tests
    - End-to-end workflows tested
    - Cross-component interactions tested
    - _Requirements: All_

  - [ ] 28.3 Property-based tests
    - Undo/redo round-trip property
    - Buffer operations property
    - Cursor movement property
    - _Requirements: All_

  - [ ] 28.4 Manual testing
    - Test on Windows, macOS, Linux
    - Test with files up to 1MB
    - Test rapid typing and large undo stacks
    - Test all keyboard shortcuts
    - Verify no memory leaks
    - _Requirements: All, TR-6_

  - [ ] 28.5 Performance testing
    - Verify all operations < 100ms
    - Verify typing feels instant (< 50ms)
    - Verify syntax highlighting doesn't block
    - Verify memory usage < 50MB for typical files
    - _Requirements: TR-1_

- [ ] 29. Documentation
  - [ ] 29.1 Create README.md
    - Architecture overview
    - Component structure
    - Service descriptions
    - Integration points
    - _Requirements: All_

  - [ ] 29.2 Create USAGE.md
    - Keyboard shortcuts reference
    - Configuration options
    - Common use cases
    - Troubleshooting guide
    - _Requirements: All_

  - [ ] 29.3 Add code documentation
    - JSDoc for all public APIs
    - Inline comments for complex logic
    - Examples for common patterns
    - _Requirements: All_

- [ ] 30. Final Checkpoint
  - Ensure all tests pass (unit, integration, property-based)
  - Verify test coverage > 80%
  - Verify all user stories satisfied
  - Verify all technical requirements met
  - No TypeScript errors
  - No ESLint warnings
  - Performance meets all requirements
  - Documentation complete
  - Ask the user for final review

## Notes

- Tasks marked with sub-tasks should complete sub-tasks first
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- **Current Status**: No Code Editor exists yet - this is a greenfield implementation
- **Dependencies**: Requires existing Window Management, File Explorer, Focus System, SyntaxViewer
- **Testing Framework**: Use Vitest for unit tests, fast-check for property-based tests, ink-testing-library for component tests
- **Code Style**: Follow existing OLLM CLI patterns (TypeScript strict mode, ES modules, React + Ink)

## Implementation Order Rationale

The task order follows a bottom-up approach:
1. **Foundation** (Tasks 1-5): Type definitions, core services (buffer, cursor, file ops)
2. **UI Components** (Tasks 6-8): Header, footer, content, main component
3. **Input Handling** (Tasks 9-12): Keyboard shortcuts, window/file explorer integration
4. **Enhanced Editing** (Tasks 13-18): Undo/redo, selection, clipboard, find, go to line
5. **Polish** (Tasks 19-27): Syntax highlighting, error highlighting, formatting, multi-file, UI polish
6. **Quality** (Tasks 28-30): Testing, documentation, final review

This order ensures each layer has its dependencies ready before implementation.

