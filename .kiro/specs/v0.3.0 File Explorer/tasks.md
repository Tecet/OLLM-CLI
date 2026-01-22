# Implementation Plan: File Explorer UI

## Overview

This implementation plan breaks down the File Explorer UI feature into discrete, incremental coding tasks. The plan follows a phased approach starting with foundational components, then building up core interactions, focus system, editor integration, file operations, and finally polish with vision support.

Each task builds on previous work and includes property-based tests to validate correctness properties from the design document. The implementation uses TypeScript, React, and Ink for the terminal UI.

## Current Status (January 22, 2026)

### Implementation Progress
- **Phase 1-6**: ✅ **COMPLETE** (Foundation, Core, Focus, Viewer/Editor, File Ops, Polish)
- **Phase 7**: ⚠️ **PARTIALLY COMPLETE** (Vision service implemented, tests pending)
- **Phase 8**: ✅ **COMPLETE** (Integration complete)

### Test Coverage Status
- **Unit Tests**: ✅ Most services have unit tests
- **Property-Based Tests**: ⚠️ **INCOMPLETE** - Many correctness properties not yet tested
- **Integration Tests**: ⚠️ **INCOMPLETE** - Some workflows tested, others pending

### Recent Additions (Today)
1. ✅ **Workspace Panel** - 3-panel layout with focused files, file tree, and keybinds
2. ✅ **File Search Dialog** - Content search using grep tool (Ctrl+F)
3. ✅ **Comprehensive Bug Fixes** - Fixed height, navigation, scrolling, file visibility

### Known Gaps
1. ⏳ Property-based tests for most correctness properties (Properties 1-42)
2. ⏳ Batch operations (multi-select, batch delete/rename)
3. ⏳ FileTreeService integration with ls tool
4. ⏳ File watching for auto-reload
5. ⏳ Diff viewer
6. ⏳ Vision service tests (Task 29.2-29.6)
7. ⏳ Screenshot service (Task 30)
8. ⏳ Integration tests (Task 34)
9. ⏳ Comprehensive error handling review (Task 35)

## Tasks

### Phase 1: Foundation & Workspace (5-7 days)

- [x] 1. Set up File Explorer component structure and core types
  - Create `packages/cli/src/ui/components/file-explorer/` directory
  - Define TypeScript interfaces: `WorkspaceConfig`, `ProjectConfig`, `FileNode`, `GitStatus`, `FocusedFile`, `ImageMetadata`
  - Create barrel exports in `index.ts`
  - Set up test directory structure with `__tests__/unit/`, `__tests__/property/`, `__tests__/integration/`
  - _Requirements: 1.1, 1.3_

- [x] 2. Implement WorkspaceManager service
  - [x] 2.1 Create `WorkspaceManager.ts` with workspace file parsing
    - Implement `loadWorkspace()` to parse `.ollm-workspace` JSON files
    - Implement `getActiveProject()` and `setActiveProject()` methods
    - Implement `isPathInWorkspace()` for path validation
    - Implement `getProjectExcludePatterns()` for exclude pattern retrieval
    - _Requirements: 1.1, 1.3, 1.4_
  
  - [x] 2.2 Write property test for workspace configuration parsing
    - **Property 1: Workspace Configuration Parsing Preserves All Valid Projects**
    - **Validates: Requirements 1.1, 1.3**
  
  - [x] 2.3 Write property test for invalid project path handling
    - **Property 2: Invalid Project Paths Are Gracefully Skipped**
    - **Validates: Requirements 1.2**
  
  - [x] 2.4 Write property test for active project selection
    - **Property 3: Active Project Selection Updates Context**
    - **Validates: Requirements 1.4**

- [x] 3. Implement PathSanitizer service
  - [x] 3.1 Create `PathSanitizer.ts` with path validation
    - Implement `sanitize()` to normalize paths
    - Implement `isPathSafe()` to check for traversal sequences
    - Implement `isWithinWorkspace()` for workspace boundary checks
    - Implement `rejectTraversal()` to throw on `../` sequences
    - _Requirements: 4.5, 10.1, 10.2_
  
  - [ ] 3.2 Write property test for path traversal rejection
    - **Property 16: Path Traversal Is Rejected**
    - **Validates: Requirements 4.5, 10.1**
  
  - [ ] 3.3 Write property test for workspace boundary enforcement
    - **Property 35: Workspace Mode Rejects External Paths**
    - **Validates: Requirements 10.2**

- [x] 4. Create React contexts for state management
  - Create `WorkspaceContext.tsx` with workspace state and active project
  - Create `FileFocusContext.tsx` with focused files list
  - Create `FileTreeContext.tsx` with tree state, cursor position, and scroll offset
  - Implement context providers with initial state
  - _Requirements: 1.4, 3.1, 2.1_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 2: Core Interactions (3-4 days)

- [x] 6. Implement FileTreeService
  - [x] 6.1 Create `FileTreeService.ts` with tree building logic
    - Implement `buildTree()` to recursively build file tree from filesystem
    - Implement `expandDirectory()` to load directory contents
    - Implement `collapseDirectory()` to collapse tree nodes
    - Implement `getVisibleNodes()` for virtual scrolling window
    - Implement `findNodeByPath()` for tree navigation
    - Apply exclude patterns during tree building
    - _Requirements: 2.1, 9.1, 9.4_
  
  - [ ] 6.2 Write property test for virtual scrolling
    - **Property 4: Virtual Scrolling Renders Only Visible Window**
    - **Validates: Requirements 2.1, 9.1**
  
  - [ ] 6.3 Write property test for lazy loading
    - **Property 34: Collapsed Directories Are Not Loaded**
    - **Validates: Requirements 9.4**

- [x] 7. Implement FileTreeView component
  - [x] 7.1 Create `FileTreeView.tsx` with tree rendering
    - Render tree nodes with Nerd Font icons
    - Implement virtual scrolling with 15-item window
    - Display cursor position and selection
    - Apply git status colors (green, yellow, grey)
    - Show focus indicators (📌) for focused files
    - _Requirements: 2.1, 2.6, 2.7, 3.1_
  
  - [ ] 7.2 Write property test for file icon display
    - **Property 7: File Icons Are Displayed for All Nodes**
    - **Validates: Requirements 2.6**

- [x] 8. Implement keyboard navigation
  - [ ] 8.1 Add keyboard event handlers to FileTreeView
    - Handle 'j' and Down arrow for next item
    - Handle 'k' and Up arrow for previous item
    - Handle 'h' and Left arrow for collapse directory
    - Handle 'l' and Right arrow for expand directory
    - Update cursor position and scroll offset
    - Debounce keyboard input (50ms)
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 9.3_
  
  - [ ] 8.2 Write property test for keyboard navigation
    - **Property 5: Keyboard Navigation Moves Cursor Correctly**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
  
  - [ ] 8.3 Write property test for input debouncing
    - **Property 33: Keyboard Input Is Debounced**
    - **Validates: Requirements 9.3**

- [x] 9. Implement GitStatusService
  - [x] 9.1 Create `GitStatusService.ts` with git integration
    - Implement `getStatus()` using simple-git to query status
    - Implement `getFileStatus()` to get status for individual files
    - Implement caching with 5-second TTL
    - Implement `isGitRepository()` to detect git repos
    - Handle non-git directories gracefully
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ] 9.2 Write property test for git status color mapping
    - **Property 6: Git Status Maps to Correct Colors**
    - **Validates: Requirements 2.7, 8.2, 8.3, 8.4**
  
  - [ ] 9.3 Write property test for git status caching
    - **Property 31: Git Status Results Are Cached**
    - **Validates: Requirements 8.5**
  
  - [ ] 9.4 Write property test for git repository detection
    - **Property 30: Git Status Is Queried for Repositories**
    - **Validates: Requirements 8.1**

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: Focus System (2-3 days)

- [x] 11. Implement FocusSystem service
  - [x] 11.1 Create `FocusSystem.ts` with focus management
    - Implement `focusFile()` to read and add file to focus list
    - Implement `unfocusFile()` to remove file from focus list
    - Implement `getFocusedFiles()` to retrieve all focused files
    - Implement `injectIntoPrompt()` to inject content into LLM prompts
    - Implement `isFocused()` to check if file is focused
    - Truncate files exceeding 8KB with warning
    - Sanitize content before injection
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 10.5_
  
  - [ ] 11.2 Write property test for file focusing
    - **Property 8: Focusing a File Adds It to Focus List**
    - **Validates: Requirements 3.1**
  
  - [ ] 11.3 Write property test for file truncation
    - **Property 9: Large Files Are Truncated at 8KB**
    - **Validates: Requirements 3.2**
  
  - [ ] 11.4 Write property test for content injection
    - **Property 10: Focused File Content Is Injected Into Prompts**
    - **Validates: Requirements 3.3**
  
  - [ ] 11.5 Write property test for focus/unfocus round-trip
    - **Property 11: Focus Then Unfocus Removes File**
    - **Validates: Requirements 3.4**
  
  - [ ] 11.6 Write property test for content sanitization
    - **Property 37: File Content Is Sanitized Before LLM Injection**
    - **Validates: Requirements 10.5**

- [x] 12. Create FocusedFilesPanel component
  - [x] 12.1 Create `FocusedFilesPanel.tsx` to display focused files
    - Render list of focused files with paths
    - Show focus indicators (📌)
    - Display file sizes and truncation warnings
    - Show total focused content size
    - _Requirements: 3.5_
  
  - [ ] 12.2 Write property test for focused files display
    - **Property 12: All Focused Files Appear in Context Panel**
    - **Validates: Requirements 3.5**

 - [x] 13. Integrate focus system with FileTreeView
   Add focus/unfocus actions to keyboard shortcuts (e.g., 'f' to toggle focus)
   Update FileTreeView to show focus indicators
   Wire up FileFocusContext to FocusSystem
   _Requirements: 3.1, 3.4_

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 4: Viewer & Editor (3-4 days)

- [x] 15. Implement SyntaxViewer component
  - [x] 15.1 Create `SyntaxViewer.tsx` with syntax highlighting
    - Integrate shiki for syntax highlighting
    - Support common programming languages (TypeScript, JavaScript, Python, Java, Go, Rust, etc.)
    - Support configuration formats (JSON, YAML, TOML, etc.)
    - Render highlighted code in Ink
    - Handle files without recognized language
    - _Requirements: 5.4, 5.5_
  
  - [ ] 15.2 Write property test for syntax highlighting
    - **Property 20: Syntax Highlighting Is Applied to Files**
    - **Validates: Requirements 5.4, 5.5**

- [x] 16. Implement EditorIntegration service
  - [x] 16.1 Create `EditorIntegration.ts` for external editor spawning
    - Implement `openInEditor()` to spawn editor process
    - Implement `getEditorCommand()` to read $EDITOR environment variable
    - Implement fallback to nano (Unix) or notepad (Windows)
    - Implement `waitForEditorExit()` to wait for editor to close
    - Implement `reloadFile()` to reload file content after editing
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ] 16.2 Write property test for editor spawning
    - **Property 18: Editor Integration Spawns Correct Editor**
    - **Validates: Requirements 5.1**
  
  - [ ] 16.3 Write unit test for editor fallback
    - Test that nano/notepad is used when $EDITOR is not set
    - _Requirements: 5.2_
  
  - [ ] 16.4 Write property test for file reload
    - **Property 19: File Content Is Reloaded After Editing**
    - **Validates: Requirements 5.3**

- [x] 17. Add viewer and editor actions to FileTreeView
  - Add 'v' keyboard shortcut to open SyntaxViewer
  - Add 'e' keyboard shortcut to open in external editor
  - Display viewer in modal or split pane
  - Handle editor errors gracefully
  - _Requirements: 5.1, 5.4_

- [ ] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 5: File Operations (2-3 days)

- [~] 19. Implement file operation handlers
  - [x] 19.1 Create `FileOperations.ts` with CRUD operations
    - Implement `createFile()` with path validation
    - Implement `createFolder()` with path validation
    - Implement `renameFile()` with validation
    - Implement `deleteFile()` with confirmation
    - Implement `deleteFolder()` with confirmation
    - Implement `copyPath()` to write to clipboard
    - Validate permissions before operations
    - Display error messages on failure
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 10.4_
  
  - [ ] 19.2 Write property test for valid file operations
    - **Property 13: Valid File Operations Succeed**
    - **Validates: Requirements 4.1, 4.2**
  
  - [ ] 19.3 Write property test for destructive operation confirmation
    - **Property 14: Destructive Operations Require Confirmation**
    - **Validates: Requirements 4.3, 10.3**
  
  - [ ] 19.4 Write property test for copy path
    - **Property 15: Copy Path Writes Absolute Path to Clipboard**
    - **Validates: Requirements 4.4**
  
  - [ ] 19.5 Write property test for failed operations
    - **Property 17: Failed Operations Display Error Messages**
    - **Validates: Requirements 4.6**
  
  - [ ] 19.6 Write property test for permission validation
    - **Property 36: File Permissions Are Validated Before Operations**
    - **Validates: Requirements 10.4**

- [x] 20. Create QuickActionsMenu component
  - [x] 20.1 Create `QuickActionsMenu.tsx` with action menu
    - Display menu with options: Open, Focus, Edit, Rename, Delete, Copy Path
    - Handle action selection
    - Wire up to file operation handlers
    - Show menu on keyboard shortcut (e.g., 'a' for actions)
    - _Requirements: 7.4_
  
  - [ ] 20.2 Write property test for menu options
    - **Property 28: Quick Actions Menu Contains Required Options**
    - **Validates: Requirements 7.4**

- [x] 21. Add confirmation dialogs
  - Create `ConfirmationDialog.tsx` component
  - Use for delete operations
  - Use for destructive operations
  - _Requirements: 4.3, 10.3_

- [ ] 22. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 6: Polish & Intelligence (3-4 days)

- [x] 23. Implement QuickOpen dialog
  - [x] 23.1 Create `QuickOpenDialog.tsx` with fuzzy search
    - Implement fuzzy matching algorithm or use library (e.g., fuse.js)
    - Display search input and filtered results
    - Handle Ctrl+O keyboard shortcut
    - Navigate to selected file
    - Track Quick Open history
    - _Requirements: 7.1, 7.2, 7.3, 12.4_
  
  - [ ] 23.2 Write property test for fuzzy filtering
    - **Property 26: Quick Open Filters Files by Fuzzy Match**
    - **Validates: Requirements 7.2**
  
  - [ ] 23.3 Write property test for file navigation
    - **Property 27: Quick Open Selection Navigates to File**
    - **Validates: Requirements 7.3**
  
  - [ ] 23.4 Write property test for history tracking
    - **Property 41: Quick Open History Tracks Opened Files**
    - **Validates: Requirements 12.4**

- [x] 24. Implement Follow Mode
  - [x] 24.1 Add Follow Mode toggle and auto-expansion
    - Detect LLM-referenced file paths in chat
    - Automatically expand tree to show referenced files
    - Add toggle for Follow Mode (e.g., 'F' key)
    - _Requirements: 7.5_
  
  - [ ] 24.2 Write property test for Follow Mode expansion
    - **Property 29: Follow Mode Expands to Referenced Files**
    - **Validates: Requirements 7.5**

- [x] 25. Implement state persistence
  - [x] 25.1 Create `ExplorerPersistence.ts` for state saving/loading
    - Implement `saveState()` to write `.ollm/explorer-state.json`
    - Implement `loadState()` to read state file
    - Save expanded directories, focused files, Quick Open history
    - Handle corrupted state files gracefully
    - _Requirements: 12.1, 12.2, 12.3, 12.5_
  
  - [ ] 25.2 Write property test for state persistence round-trip
    - **Property 40: Explorer State Persistence Round-Trip**
    - **Validates: Requirements 12.1, 12.2, 12.3**
  
  - [ ] 25.3 Write property test for corrupted config handling
    - **Property 42: Corrupted Configuration Resets to Default**
    - **Validates: Requirements 12.5**

- [x] 26. Add UI polish and accessibility
  - [x] 26.1 Implement header, help panel, and loading indicators
    - Display current mode (Browse/Workspace) in header
    - Create help panel with keyboard shortcuts (accessible via '?')
    - Add loading indicators for operations >500ms
    - Add visual feedback for user actions
    - _Requirements: 11.1, 11.2, 11.4_
  
  - [ ] 26.2 Write property test for mode display
    - **Property 38: Current Mode Is Displayed in Header**
    - **Validates: Requirements 11.1**
  
  - [x] 26.3 Write unit test for help panel
    - Test that '?' key shows help panel
    - _Requirements: 11.2_
  
  - [ ] 26.4 Write property test for loading indicators
    - **Property 39: Long Operations Display Loading Indicators**
    - **Validates: Requirements 11.4**

- [~] 27. Implement performance optimizations
  - [~] 27.1 Add performance monitoring and warnings
    - Warn when directory contains >1000 items
    - Implement memory monitoring for tree state
    - Add pagination for large directories
    - _Requirements: 9.2_
  
  - [ ] 27.2 Write property test for large directory warnings
    - **Property 32: Large Directories Trigger Warnings**
    - **Validates: Requirements 9.2**

- [x] 28. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 8: Recent Additions (January 22, 2026)

- [x] 37. Implement Workspace Panel
  - [x] 37.1 Create WorkspacePanel component with 3-panel layout
    - Top panel: Focused files display (15% height)
    - Middle panel: File tree with virtual scrolling (grows to fill)
    - Bottom panel: Keybinds legend (3 lines fixed)
    - Dynamic height measurement using measureElement
    - Proper panel height calculations with useMemo
    - _Requirements: 3.5, 2.1, 11.2_
  
  - [x] 37.2 Fix file tree navigation and scrolling
    - Fixed Enter key to expand directories
    - Fixed file visibility (both files and directories show)
    - Implemented auto-scroll on navigation
    - Fixed cursor movement (↑↓ separate from ←→/Enter)
    - Added focus indicators (📌) for focused files
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.1_
  
  - [x] 37.3 Integrate WorkspacePanel into SidePanel
    - Added to SidePanel as "Workspace" tab
    - Accessible by switching from Tools to Workspace
    - Syncs with File Explorer focus system
    - _Requirements: 11.1_

- [x] 38. Implement File Search Dialog
  - [x] 38.1 Create FileSearchDialog component
    - Search file contents using grep tool
    - Regex pattern support
    - Case sensitivity toggle (Ctrl+C)
    - File pattern filtering (*.ts, *.js, etc.)
    - Results list with file:line:content preview
    - Keyboard navigation (↑↓ to navigate, Enter to select)
    - _Requirements: 7.1, 7.2_
  
  - [x] 38.2 Integrate search dialog into FileTreeView
    - Added Ctrl+F keyboard shortcut to open search
    - Implemented result selection handler
    - Opens files at specific line numbers
    - Passes ToolRegistry from FileExplorerComponent
    - _Requirements: 7.1, 7.3_
  
  - [ ] 38.3 Write property test for file search
    - **Property 43: File Search Returns Matching Lines**
    - **Validates: Requirements 7.1, 7.2**

- [X] 28. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 7: Vision and Image Support (2-3 days)

- [ ] 29. Implement VisionService

  - [x] 29.1 Create `VisionService.ts` with image processing
    - Implement `processImage()` to detect dimensions and format
    - Implement `resizeImage()` using sharp to resize images >2048px
    - Implement `encodeBase64()` to encode images for vision models
    - Implement `getSupportedFormats()` to list supported formats (JPEG, PNG, GIF, WebP)
    - Handle unsupported formats with error messages
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
    - **Status**: ✅ Service implemented, ⏳ tests pending
  
  - [ ] 29.2 Write property test for image dimension detection
    - **Property 21: Image Dimensions Are Detected**
    - **Validates: Requirements 6.1**
    - **Status**: ⏳ Not implemented
  
  - [ ] 29.3 Write property test for image resizing
    - **Property 22: Large Images Are Resized Proportionally**
    - **Validates: Requirements 6.2**
    - **Status**: ⏳ Not implemented
  
  - [ ] 29.4 Write property test for base64 encoding
    - **Property 23: Image Encoding Produces Valid Base64**
    - **Validates: Requirements 6.3**
    - **Status**: ⏳ Not implemented
  
  - [ ] 29.5 Write property test for supported formats
    - **Property 24: Supported Image Formats Are Processed**
    - **Validates: Requirements 6.4**
    - **Status**: ⏳ Not implemented
  
  - [ ] 29.6 Write property test for unsupported format errors
    - **Property 25: Unsupported Image Formats Return Errors**
    - **Validates: Requirements 6.5**
    - **Status**: ⏳ Not implemented

- [ ] 30. Implement optional ScreenshotService
  - [ ] 30.1 Create `ScreenshotService.ts` with browser automation
    - Implement `captureScreenshot()` using puppeteer
    - Handle URL validation
    - Resize screenshots to max 2048px
    - Make service optional (only if puppeteer is installed)
    - _Requirements: 6.6_
    - **Status**: ⏳ Not implemented
  
  - [ ] 30.2 Write property test for screenshot capture
    - **Property 26: Screenshot Service Captures Web Pages** (if enabled)
    - **Validates: Requirements 6.6**
    - **Status**: ⏳ Not implemented

- [ ] 31. Integrate VisionService with FileTreeView
  - Add image preview for image files
  - Show image dimensions in file info
  - Add action to analyze image with vision model
  - Display base64-encoded images in focus panel
  - _Requirements: 6.1, 6.3_
  - **Status**: ⏳ Not implemented

- [ ] 32. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 8: Integration and Final Polish

- [x] 33. Create main FileExplorerComponent
  - [x] 33.1 Create `FileExplorerComponent.tsx` as main container
    - Compose all sub-components (FileTreeView, FocusedFilesPanel, QuickOpen, etc.)
    - Wire up all contexts (WorkspaceContext, FileFocusContext, FileTreeContext)
    - Handle component lifecycle and initialization
    - Load workspace on mount
    - Restore persisted state on mount
    - _Requirements: 1.1, 12.2_
    - **Status**: ✅ Complete

- [ ] 34. Write integration tests
  - [ ] 34.1 Write integration test for complete file focus workflow
    - Test: navigate tree → focus file → verify in focus panel → unfocus
    - _Requirements: 3.1, 3.4, 3.5_
    - **Status**: ⏳ Not implemented
  
  - [ ] 34.2 Write integration test for file editing workflow
    - Test: navigate tree → open in editor → edit → reload → verify changes
    - _Requirements: 5.1, 5.3_
    - **Status**: ⏳ Not implemented
  
  - [ ] 34.3 Write integration test for file operations workflow
    - Test: create file → rename → delete with confirmation
    - _Requirements: 4.1, 4.2, 4.3_
    - **Status**: ⏳ Not implemented

- [ ] 35. Add comprehensive error handling
  - Review all error paths
  - Ensure all errors display user-friendly messages
  - Add error recovery where possible
  - Log errors for debugging
  - _Requirements: 4.6_
  - **Status**: ⏳ Not implemented

- [ ] 36. Final checkpoint - Ensure all tests pass
  - Run full test suite (unit, property, integration)
  - Verify all 42+ correctness properties are tested
  - Check test coverage meets 80% threshold
  - Ask the user if questions arise.
  - **Status**: ⏳ Pending

### Phase 9: Future Enhancements (Backlog)

- [ ] 39. Implement batch operations
  - [ ] 39.1 Add multi-select mode
    - Space to toggle file selection
    - 'v' to enter multi-select mode
    - 'a' to select all
    - Selection counter in status bar
    - _Requirements: Future enhancement_
  
  - [ ] 39.2 Implement batch delete
    - Ctrl+D to delete selected files
    - Confirmation dialog with count
    - _Requirements: Future enhancement_
  
  - [ ] 39.3 Implement batch rename
    - Pattern-based renaming
    - Preview changes before applying
    - _Requirements: Future enhancement_

- [ ] 40. Integrate FileTreeService with ls tool
  - [ ] 40.1 Refactor FileTreeService to use ls tool
    - Use ls tool for directory traversal
    - Unify .gitignore handling
    - Single source of truth
    - _Requirements: Future enhancement_

- [ ] 41. Implement file watching
  - [ ] 41.1 Add file watcher service
    - Watch focused files for changes
    - Show notification on external change
    - Option to reload automatically
    - Option to show diff
    - _Requirements: Future enhancement_
  
  - [ ] 41.2 Install chokidar dependency
    - Add chokidar to package.json
    - _Requirements: Future enhancement_

- [ ] 42. Implement diff viewer
  - [ ] 42.1 Create DiffViewer component
    - Show unified diff
    - Syntax highlighting
    - Side-by-side view option
    - Accept/reject changes
    - _Requirements: Future enhancement_
  
  - [ ] 42.2 Install diff dependency
    - Add diff package to package.json
    - _Requirements: Future enhancement_

## Notes

- All tasks are required for comprehensive implementation with full test coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript, React, and Ink
- Dependencies: shiki, simple-git, sharp, file-type, puppeteer (optional)

## Summary of Current State (January 22, 2026)

### What's Working ✅
- **Core Functionality**: File tree navigation, focus system, file operations
- **UI Components**: FileTreeView, FocusedFilesPanel, QuickOpen, QuickActions, SyntaxViewer
- **Services**: WorkspaceManager, FileTreeService, FocusSystem, GitStatusService, EditorIntegration, VisionService
- **Recent Additions**: Workspace Panel (3-panel layout), File Search Dialog (Ctrl+F)
- **Integration**: All components integrated and working together
- **Build**: TypeScript compiles, all 345 tests passing

### What's Missing ⏳
- **Property-Based Tests**: Most of the 42+ correctness properties not yet tested
- **Integration Tests**: File focus workflow, editing workflow, operations workflow
- **Vision Service Tests**: Service works but tests not written
- **Batch Operations**: Multi-select, batch delete/rename
- **File Watching**: Auto-reload on external changes
- **Diff Viewer**: View changes before committing
- **FileTreeService Integration**: Unify with ls tool
- **Error Handling Review**: Comprehensive error path review

### Test Coverage Gap
- **Current**: ~345 unit tests passing
- **Missing**: ~40+ property-based tests for correctness properties
- **Missing**: ~3 integration tests for key workflows
- **Missing**: ~6 vision service property tests
- **Target**: 80% line coverage + all correctness properties tested

### Priority for Next Session
1. **High Priority**: Property-based tests for core functionality (Properties 1-20)
2. **Medium Priority**: Integration tests for key workflows (Tasks 34.1-34.3)
3. **Medium Priority**: Vision service tests (Tasks 29.2-29.6)
4. **Low Priority**: Batch operations, file watching, diff viewer (Future enhancements)

### Estimated Effort to Complete
- **Property-Based Tests**: 8-10 hours (40+ properties)
- **Integration Tests**: 2-3 hours (3 workflows)
- **Vision Service Tests**: 2-3 hours (6 properties)
- **Error Handling Review**: 1-2 hours
- **Total**: ~13-18 hours to reach full test coverage

### Documentation Status
- ✅ Design document: Complete and up-to-date
- ✅ Tasks document: Updated with current status
- ✅ Implementation guides: INTEGRATION_GUIDE.md, USAGE.md
- ✅ Bug fix documentation: WORKSPACE-PANEL-FIXES.md
- ✅ Feature documentation: FILE-SEARCH-INTEGRATION-COMPLETE.md
