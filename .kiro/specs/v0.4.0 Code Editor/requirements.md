# Code Editor - Requirements

**Version**: 0.4.0  
**Status**: 📋 Planning  
**Created**: January 22, 2026  
**Dependencies**: v0.3.0 File Explorer

## Overview

Add a built-in terminal-based code editor as the third window in OLLM CLI (Chat/Terminal/Editor). The editor provides quick editing capabilities without leaving the application, integrating seamlessly with the File Explorer and Focus System.

## Goals

1. **Quick Editing**: Enable fast edits without context switching to external editors
2. **Seamless Integration**: Work naturally with File Explorer, Focus System, and Window Management
3. **Familiar UX**: Provide intuitive keyboard shortcuts similar to common editors
4. **Lightweight**: Keep the editor fast and responsive for files up to 1MB
5. **Safe Editing**: Prevent data loss with dirty state tracking and backup files

## Non-Goals

- Full-featured IDE capabilities (multi-cursor, regex search, etc.)
- Support for binary files or very large files (>1MB)
- Plugin system or extensibility
- Advanced features like LSP integration or debugging

## User Stories

### US-1: Open File in Editor
**As a** developer  
**I want to** open a file from File Explorer in the built-in editor  
**So that** I can quickly edit it without leaving OLLM CLI

**Acceptance Criteria**:
- Press `e` in File Explorer to open file in built-in editor
- Editor window becomes active automatically
- File content loads and displays with line numbers
- Cursor starts at line 1, column 1
- File path shown in editor header

### US-2: Navigate with Cursor
**As a** developer  
**I want to** move the cursor using arrow keys and shortcuts  
**So that** I can navigate to the location I want to edit

**Acceptance Criteria**:
- Arrow keys (↑↓←→) move cursor one position
- Home key moves to start of line
- End key moves to end of line
- Ctrl+Home moves to start of file
- Ctrl+End moves to end of file
- PgUp/PgDn scroll one page
- Cursor position shown in status bar (line:column)

### US-3: Insert and Delete Text
**As a** developer  
**I want to** type characters and delete text  
**So that** I can make changes to the file

**Acceptance Criteria**:
- Typing inserts characters at cursor position
- Backspace deletes character before cursor
- Delete key deletes character at cursor
- Enter key inserts new line and moves cursor down
- Tab key inserts spaces (configurable width, default 2)
- File marked as dirty (*) when modified

### US-4: Save File
**As a** developer  
**I want to** save my changes to disk  
**So that** my edits are persisted

**Acceptance Criteria**:
- Ctrl+S saves file to disk
- Backup file (.bak) created on first save
- Dirty indicator (*) removed after save
- Success message shown briefly
- Focused file content updated if file is focused
- Error message shown if save fails

### US-5: Undo and Redo
**As a** developer  
**I want to** undo and redo my changes  
**So that** I can recover from mistakes

**Acceptance Criteria**:
- Ctrl+Z undoes last change
- Ctrl+Y (or Ctrl+Shift+Z) redoes last undone change
- Undo stack limited to 100 actions
- Undo/redo works for insert, delete, and replace operations
- Cursor position restored with undo/redo

### US-6: Copy, Cut, and Paste
**As a** developer  
**I want to** copy, cut, and paste text  
**So that** I can move or duplicate content

**Acceptance Criteria**:
- Shift+Arrow keys select text
- Ctrl+C copies selected text to clipboard
- Ctrl+X cuts selected text to clipboard
- Ctrl+V pastes clipboard content at cursor
- Selection highlighted visually
- Clipboard works across editor sessions

### US-7: Find Text
**As a** developer  
**I want to** search for text in the file  
**So that** I can quickly locate specific content

**Acceptance Criteria**:
- Ctrl+F opens find dialog
- Type search term and press Enter to find next
- F3 or Ctrl+G finds next occurrence
- Shift+F3 finds previous occurrence
- Matches highlighted in editor
- Case-insensitive search by default
- Esc closes find dialog

### US-8: Go to Line
**As a** developer  
**I want to** jump to a specific line number  
**So that** I can quickly navigate to known locations

**Acceptance Criteria**:
- Ctrl+G opens go-to-line dialog
- Enter line number and press Enter to jump
- Cursor moves to start of specified line
- Invalid line numbers show error message
- Esc closes dialog

### US-9: Syntax Highlighting
**As a** developer  
**I want to** see syntax-highlighted code with semantic colors  
**So that** I can read and understand the code more easily

**Acceptance Criteria**:
- Syntax highlighting applied based on file extension
- Reuses existing SyntaxViewer's shiki integration
- Supports 50+ programming languages
- Highlighting updates as user types (debounced 500ms)
- Falls back to plain text if language not supported
- **Color scheme**:
  - Green: Strings ("text", 'text', \`template\`)
  - Gray: Comments (// comment, /* comment */)
  - Yellow: Numbers (123, 3.14), parameters, properties
  - Purple/Magenta: Keywords (var, if, else, const, class)
  - Light-blue/Cyan: Operators (+, -, &&), TypeScript types
  - Dark-blue: Function names, method calls
  - Red: Class names, this keyword
  - White: Default text

### US-9b: Error and Warning Highlighting
**As a** developer  
**I want to** see TypeScript and lint errors highlighted in the editor  
**So that** I can fix issues as I type

**Acceptance Criteria**:
- TypeScript errors shown with red underlines
- ESLint warnings shown with yellow underlines
- Error messages displayed inline or on hover
- Errors update as user types (debounced 1000ms)
- Error count shown in status bar
- Ctrl+E jumps to next error
- Shift+Ctrl+E jumps to previous error
- Works for TypeScript, JavaScript, and other supported languages
- Integrates with existing getDiagnostics tool if available

### US-10: Format with Prettier
**As a** developer  
**I want to** auto-format my code  
**So that** it follows consistent style guidelines

**Acceptance Criteria**:
- Ctrl+Shift+F formats current file with Prettier
- Format-on-save option (configurable, default off)
- Detects .prettierrc config if present
- Falls back to Prettier defaults if no config
- Shows error if Prettier fails
- Only formats supported file types (JS, TS, JSON, CSS, etc.)

### US-11: Close Editor
**As a** developer  
**I want to** close the editor and return to previous window  
**So that** I can continue my workflow

**Acceptance Criteria**:
- Ctrl+Q closes editor
- Esc switches to view mode (SyntaxViewer)
- Prompt to save if file has unsaved changes
- Returns to previous window (Chat or Terminal)
- Editor state cleared after close

### US-12: Multiple File Support
**As a** developer  
**I want to** switch between multiple open files  
**So that** I can edit several files without reopening

**Acceptance Criteria**:
- Ctrl+Tab switches to next open file
- Ctrl+Shift+Tab switches to previous file
- Tab bar shows open files with dirty indicators
- Ctrl+W closes current file
- Maximum 10 files open simultaneously
- Warning when approaching limit

## Technical Requirements

### TR-1: Performance
- Editor must load files < 100KB instantly (< 100ms)
- Cursor movement must feel responsive (< 50ms)
- Syntax highlighting must not block typing (debounced)
- Memory usage must stay under 50MB for typical files

### TR-2: File Size Limits
- Support files up to 1MB
- Warn at 500KB
- Refuse to open files > 1MB
- Suggest external editor for large files

### TR-3: Safety
- Create .bak backup before first save
- Detect external file changes and prompt to reload
- Prevent data loss on crash (auto-save every 30s)
- Validate file paths with PathSanitizer

### TR-4: Integration
- Integrate with File Explorer (open with 'e' key)
- Integrate with Focus System (update focused files on save)
- Integrate with Window Management (Ctrl+1/2/3 to switch)
- Integrate with existing SyntaxViewer for syntax highlighting

### TR-5: Accessibility
- All features accessible via keyboard
- Clear visual feedback for all actions
- Status bar shows current mode and position
- Error messages are clear and actionable

### TR-6: Cross-Platform
- Works on Windows, macOS, and Linux
- Handles different line endings (CRLF, LF)
- Respects platform clipboard conventions
- Uses platform-appropriate file paths

## Success Metrics

1. **Adoption**: 50%+ of users use built-in editor for quick edits
2. **Performance**: 95%+ of operations complete in < 100ms
3. **Reliability**: < 1% data loss incidents
4. **Usability**: Users can edit files without reading documentation

## Out of Scope (Future Enhancements)

- Multi-cursor editing
- Regex find and replace
- Code folding
- Minimap
- Split view editing
- Git integration in editor
- LSP integration
- Snippets and templates
- Macro recording
- Vim/Emacs keybindings

## Dependencies

- **v0.3.0 File Explorer**: Required for file selection and navigation
- **SyntaxViewer**: Reuse for syntax highlighting
- **WindowContext**: Already supports 'editor' window type
- **PathSanitizer**: Required for safe file operations
- **Focus System**: Required for updating focused files

## References

- Proposal: `.dev/CODE-EDITOR-PROPOSAL.md`
- File Explorer Spec: `.kiro/specs/v0.3.0 File Explorer/`
- SyntaxViewer: `packages/cli/src/ui/components/file-explorer/SyntaxViewer.tsx`
- WindowContext: `packages/cli/src/ui/contexts/WindowContext.tsx`
