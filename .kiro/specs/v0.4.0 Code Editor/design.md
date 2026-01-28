# Code Editor - Design Document

**Version**: 0.4.0  
**Status**: 📋 Planning  
**Created**: January 22, 2026

## Architecture Overview

The Code Editor is built as a React + Ink component that integrates with the existing Window Management system. It consists of several core services and UI components working together to provide a lightweight editing experience.

```
┌─────────────────────────────────────────────────────────────┐
│                      Code Editor Window                      │
├─────────────────────────────────────────────────────────────┤
│ Header: filename.ts [Modified] | Line 42/150 | Col 12       │
├─────────────────────────────────────────────────────────────┤
│  1 │ import { useState } from 'react';                       │
│  2 │                                                          │
│  3 │ export function MyComponent() {                         │
│  4 │   const [count, setCount] = useState(0);                │
│  5 │   █                                                      │ ← Cursor
│  6 │   return <div>{count}</div>;                            │
│  7 │ }                                                        │
│    │                                                          │
├─────────────────────────────────────────────────────────────┤
│ Footer: Ctrl+S Save | Ctrl+Q Quit | Ctrl+Z Undo | Esc View  │
└─────────────────────────────────────────────────────────────┘
```

## Component Structure

```
packages/cli/src/ui/components/code-editor/
├── CodeEditor.tsx              # Main editor component
├── EditorHeader.tsx            # Header with file info
├── EditorContent.tsx           # Content area with line numbers
├── EditorFooter.tsx            # Footer with keybinds
├── EditorStatusBar.tsx         # Status bar with position info
├── FindDialog.tsx              # Find text dialog
├── GoToLineDialog.tsx          # Go to line dialog
├── services/
│   ├── EditorBuffer.ts         # Text buffer management
│   ├── EditorCursor.ts         # Cursor position and movement
│   ├── EditorHistory.ts        # Undo/redo stack
│   ├── EditorClipboard.ts      # Clipboard operations
│   ├── EditorSelection.ts      # Text selection
│   ├── EditorSyntax.ts         # Syntax highlighting
│   ├── EditorFormatter.ts      # Prettier integration
│   └── EditorFileOps.ts        # File operations (save, backup)
├── contexts/
│   └── EditorContext.tsx       # Editor state management
├── hooks/
│   ├── useEditorKeybindings.ts # Keyboard shortcuts
│   └── useEditorState.ts       # Editor state hook
├── types.ts                    # TypeScript types
└── __tests__/
    ├── EditorBuffer.test.ts
    ├── EditorCursor.test.ts
    ├── EditorHistory.test.ts
    └── CodeEditor.test.tsx
```

## Data Structures

### EditorState

```typescript
interface EditorState {
  // File information
  filePath: string;
  fileName: string;
  isDirty: boolean;
  isReadOnly: boolean;

  // Content
  buffer: EditorBuffer;

  // Cursor and selection
  cursor: CursorPosition;
  selection: Selection | null;

  // View state
  scrollOffset: number;
  viewportHeight: number;
  viewportWidth: number;

  // History
  history: EditorHistory;

  // UI state
  mode: EditorMode;
  statusMessage: string | null;
  findDialogOpen: boolean;
  goToLineDialogOpen: boolean;
}

type EditorMode = 'edit' | 'view' | 'find' | 'goto';
```

### CursorPosition

```typescript
interface CursorPosition {
  line: number; // 0-based line index
  column: number; // 0-based column index (character position)
}
```

### Selection

```typescript
interface Selection {
  start: CursorPosition;
  end: CursorPosition;
  text: string;
}
```

### EditorBuffer

```typescript
class EditorBuffer {
  private lines: string[];

  constructor(content: string) {
    this.lines = content.split('\n');
  }

  // Read operations
  getLine(index: number): string;
  getLineCount(): number;
  getContent(): string;
  getRange(start: CursorPosition, end: CursorPosition): string;

  // Write operations
  insertAt(position: CursorPosition, text: string): void;
  deleteAt(position: CursorPosition, count: number): void;
  deleteLine(index: number): void;
  replaceRange(start: CursorPosition, end: CursorPosition, text: string): void;

  // Utility
  isValidPosition(position: CursorPosition): boolean;
  getLineLength(index: number): number;
}
```

### EditorHistory

```typescript
interface EditorAction {
  type: 'insert' | 'delete' | 'replace';
  position: CursorPosition;
  content: string;
  previousContent?: string;
  timestamp: number;
}

class EditorHistory {
  private undoStack: EditorAction[];
  private redoStack: EditorAction[];
  private maxStackSize: number = 100;

  push(action: EditorAction): void;
  undo(): EditorAction | null;
  redo(): EditorAction | null;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
}
```

## Core Services

### 1. EditorBuffer Service

**Responsibility**: Manage text content as an array of lines

**Key Methods**:

- `insertAt(position, text)` - Insert text at position
- `deleteAt(position, count)` - Delete characters
- `replaceRange(start, end, text)` - Replace text range
- `getLine(index)` - Get line content
- `getContent()` - Get full file content

**Implementation Notes**:

- Store content as array of strings (one per line)
- Handle line breaks correctly (preserve CRLF vs LF)
- Validate positions before operations
- Optimize for common operations (insert at end, delete single char)

### 2. EditorCursor Service

**Responsibility**: Track and move cursor position

**Key Methods**:

- `moveUp()`, `moveDown()`, `moveLeft()`, `moveRight()`
- `moveToLineStart()`, `moveToLineEnd()`
- `moveToFileStart()`, `moveToFileEnd()`
- `movePageUp()`, `movePageDown()`
- `moveTo(position)` - Jump to specific position

**Implementation Notes**:

- Clamp cursor to valid positions
- Handle empty lines correctly
- Remember column when moving up/down
- Update scroll offset when cursor moves out of viewport

### 3. EditorHistory Service

**Responsibility**: Manage undo/redo stack

**Key Methods**:

- `push(action)` - Add action to undo stack
- `undo()` - Undo last action
- `redo()` - Redo last undone action
- `clear()` - Clear history

**Implementation Notes**:

- Limit stack size to 100 actions
- Clear redo stack when new action is pushed
- Group rapid typing into single undo action (debounce 500ms)
- Store minimal information (position + content)

### 4. EditorSelection Service

**Responsibility**: Handle text selection

**Key Methods**:

- `startSelection(position)` - Begin selection
- `updateSelection(position)` - Update selection end
- `clearSelection()` - Clear selection
- `getSelectedText()` - Get selected text
- `hasSelection()` - Check if text is selected

**Implementation Notes**:

- Normalize selection (start always before end)
- Handle multi-line selections
- Update selection on cursor movement with Shift key
- Clear selection on most edit operations

### 5. EditorClipboard Service

**Responsibility**: Handle copy/cut/paste operations

**Key Methods**:

- `copy(text)` - Copy text to clipboard
- `cut(text)` - Cut text to clipboard
- `paste()` - Get clipboard content

**Implementation Notes**:

- Use `clipboardy` package for cross-platform clipboard
- Handle clipboard errors gracefully
- Support multi-line clipboard content
- Preserve formatting when pasting

### 6. EditorSyntax Service

**Responsibility**: Provide syntax highlighting with semantic colors and error indicators

**Key Methods**:

- `highlight(content, language)` - Highlight code with color scheme
- `detectLanguage(filePath)` - Detect language from extension
- `getSupportedLanguages()` - List supported languages
- `applyColorScheme(tokens)` - Apply terminal color scheme
- `highlightErrors(diagnostics)` - Highlight TypeScript/lint errors

**Implementation Notes**:

- Reuse SyntaxViewer's shiki integration
- Apply custom color scheme for terminal rendering
- Debounce highlighting updates (500ms)
- Cache highlighted content
- Fall back to plain text if highlighting fails
- Only highlight visible lines for performance
- Integrate with TypeScript language server for error detection
- Show error squiggles and messages inline

**Color Scheme**:

```typescript
interface SyntaxColorScheme {
  strings: 'green'; // "text", 'text', `template`
  comments: 'gray'; // // comment, /* comment */
  numbers: 'yellow'; // 123, 3.14, 0xFF
  parameters: 'yellow'; // function params, object properties
  keywords: 'magenta'; // var, if, else, return, class, const
  operators: 'cyan'; // +, -, &&, ||, ===, =>
  functions: 'blue'; // function names, method calls
  classes: 'red'; // class names, this keyword
  types: 'cyan'; // TypeScript types, interfaces
  errors: 'redBright'; // Error underlines
  warnings: 'yellowBright'; // Warning underlines
  default: 'white'; // default text
}
```

**Syntax Highlighting Examples**:

```typescript
// TypeScript example with colors
const message: string = 'Hello';
// const=magenta, message=white, string=cyan, "Hello"=green

function greet(name: string) {
  // function=magenta, greet=blue, name=yellow, string=cyan
  return `Hi ${name}`;
  // return=magenta, `Hi ${name}`=green
}

class User {
  // class=magenta, User=red
  constructor(public name: string) {}
  // constructor=blue, public=magenta, name=yellow
}

// Error highlighting
const x: number = 'text'; // Error: Type 'string' not assignable to 'number'
//                ^^^^^^ (red underline)
```

**Terminal Color Mapping**:

```typescript
const TERMINAL_COLORS = {
  green: '\x1b[32m', // Strings
  gray: '\x1b[90m', // Comments
  yellow: '\x1b[33m', // Numbers, parameters
  magenta: '\x1b[35m', // Keywords (purple)
  cyan: '\x1b[36m', // Operators, types (light-blue)
  blue: '\x1b[34m', // Functions (dark-blue)
  red: '\x1b[31m', // Classes, this
  redBright: '\x1b[91m', // Errors
  yellowBright: '\x1b[93m', // Warnings
  white: '\x1b[37m', // Default
  reset: '\x1b[0m', // Reset
};
```

**Error Highlighting**:

```typescript
interface EditorDiagnostic {
  line: number;
  column: number;
  length: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: 'typescript' | 'eslint';
}

// Display errors inline
//  42 │ const x: number = "text";
//     │                   ^^^^^^ Type 'string' not assignable to 'number'
```

### 7. EditorFormatter Service

**Responsibility**: Format code with Prettier

**Key Methods**:

- `format(content, filePath)` - Format content
- `canFormat(filePath)` - Check if file type is supported
- `loadConfig(workspaceRoot)` - Load .prettierrc

**Implementation Notes**:

- Lazy load Prettier (optional dependency)
- Detect .prettierrc in workspace
- Use Prettier defaults if no config
- Handle formatting errors gracefully
- Show diff before applying format (optional)

### 8. EditorFileOps Service

**Responsibility**: Handle file operations

**Key Methods**:

- `save(filePath, content)` - Save file to disk
- `createBackup(filePath)` - Create .bak file
- `detectExternalChanges(filePath)` - Check if file changed externally
- `reload(filePath)` - Reload file from disk

**Implementation Notes**:

- Use PathSanitizer for path validation
- Create .bak backup on first save
- Check file modification time before save
- Prompt user if external changes detected
- Handle save errors with clear messages

## UI Components

### CodeEditor (Main Component)

**Props**:

```typescript
interface CodeEditorProps {
  initialFilePath?: string;
  onClose?: () => void;
}
```

**State**:

- Manages EditorState
- Handles keyboard input
- Coordinates all services
- Renders sub-components

**Keyboard Handling**:

```typescript
useInput((input, key) => {
  // Navigation
  if (key.upArrow) moveCursorUp();
  if (key.downArrow) moveCursorDown();
  if (key.leftArrow) moveCursorLeft();
  if (key.rightArrow) moveCursorRight();

  // Editing
  if (key.backspace) deleteCharBefore();
  if (key.delete) deleteCharAt();
  if (key.return) insertNewLine();
  if (key.tab) insertTab();

  // Commands
  if (input === 's' && key.ctrl) saveFile();
  if (input === 'q' && key.ctrl) closeEditor();
  if (input === 'z' && key.ctrl) undo();
  if (input === 'y' && key.ctrl) redo();
  if (input === 'c' && key.ctrl) copy();
  if (input === 'x' && key.ctrl) cut();
  if (input === 'v' && key.ctrl) paste();
  if (input === 'f' && key.ctrl) openFind();
  if (input === 'g' && key.ctrl) openGoToLine();

  // Regular text input
  if (!key.ctrl && !key.meta && input.length === 1) {
    insertChar(input);
  }
});
```

### EditorHeader

**Props**:

```typescript
interface EditorHeaderProps {
  fileName: string;
  isDirty: boolean;
  lineCount: number;
  cursorLine: number;
  cursorColumn: number;
}
```

**Renders**:

```
┌─────────────────────────────────────────────────────────────┐
│ 📄 filename.ts [Modified] | Line 42/150 | Col 12            │
└─────────────────────────────────────────────────────────────┘
```

### EditorContent

**Props**:

```typescript
interface EditorContentProps {
  buffer: EditorBuffer;
  cursor: CursorPosition;
  selection: Selection | null;
  scrollOffset: number;
  viewportHeight: number;
  showLineNumbers: boolean;
  syntaxHighlight: boolean;
}
```

**Renders**:

- Line numbers (left gutter)
- File content (with syntax highlighting)
- Cursor indicator (█)
- Selection highlight (inverse colors)
- Virtual scrolling (only render visible lines)

### EditorFooter

**Props**:

```typescript
interface EditorFooterProps {
  mode: EditorMode;
  statusMessage: string | null;
}
```

**Renders**:

```
┌─────────────────────────────────────────────────────────────┐
│ Ctrl+S Save | Ctrl+Q Quit | Ctrl+Z Undo | Esc View         │
└─────────────────────────────────────────────────────────────┘
```

### FindDialog

**Props**:

```typescript
interface FindDialogProps {
  isOpen: boolean;
  onFind: (query: string, direction: 'next' | 'prev') => void;
  onClose: () => void;
}
```

**Renders**:

```
┌─────────────────────────────────────────────────────────────┐
│ Find: [search term here]                                    │
│ F3: Next | Shift+F3: Previous | Esc: Close                  │
└─────────────────────────────────────────────────────────────┘
```

### GoToLineDialog

**Props**:

```typescript
interface GoToLineDialogProps {
  isOpen: boolean;
  maxLine: number;
  onGoTo: (line: number) => void;
  onClose: () => void;
}
```

**Renders**:

```
┌─────────────────────────────────────────────────────────────┐
│ Go to line: [42]                                            │
│ Enter: Jump | Esc: Cancel                                   │
└─────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. File Explorer Integration

**Location**: `packages/cli/src/ui/components/file-explorer/FileTreeView.tsx`

**Changes**:

```typescript
// Add keybinding to open in built-in editor
if (input === 'e' && !key.ctrl) {
  const selectedNode = getSelectedNode();
  if (selectedNode && selectedNode.type === 'file') {
    // Open in built-in editor
    editorContext.openFile(selectedNode.path);
    windowContext.setActiveWindow('editor');
  }
}

// Keep Ctrl+E for external editor
if (input === 'e' && key.ctrl) {
  // Open in external editor (existing behavior)
  await editorIntegration.openInEditor(selectedNode.path);
}
```

### 2. Window Management Integration

**Location**: `packages/cli/src/ui/App.tsx`

**Changes**:

```typescript
// Replace "Editor - Coming Soon" placeholder with CodeEditor component
{windowContext.isEditorActive && (
  <EditorProvider>
    <CodeEditor onClose={() => windowContext.setActiveWindow('chat')} />
  </EditorProvider>
)}

// Add keybinding to switch to editor
if (input === '3' && key.ctrl) {
  windowContext.setActiveWindow('editor');
}
```

### 3. Focus System Integration

**Location**: `packages/cli/src/ui/components/code-editor/services/EditorFileOps.ts`

**Changes**:

```typescript
async function saveFile(filePath: string, content: string) {
  // Save to disk
  await fs.writeFile(filePath, content, 'utf-8');

  // Update focused file if it's focused
  const fileFocusContext = useFileFocus();
  if (fileFocusContext.isFocused(filePath)) {
    await fileFocusContext.updateFocusedFile(filePath, content);
  }

  // Mark as clean
  setIsDirty(false);
}
```

### 4. Syntax Highlighting Integration

**Location**: `packages/cli/src/ui/components/code-editor/services/EditorSyntax.ts`

**Reuse**:

```typescript
import { codeToHtml, bundledLanguages } from 'shiki';
import { detectLanguage, isLanguageSupported } from '../../file-explorer/SyntaxViewer.js';

// Reuse existing language detection and highlighting logic
```

## State Management

### EditorContext

```typescript
interface EditorContextValue {
  // Current editor state
  state: EditorState | null;

  // File operations
  openFile: (filePath: string) => Promise<void>;
  closeFile: () => void;
  saveFile: () => Promise<void>;
  reloadFile: () => Promise<void>;

  // Editing operations
  insertText: (text: string) => void;
  deleteText: (count: number) => void;
  undo: () => void;
  redo: () => void;

  // Cursor operations
  moveCursor: (direction: CursorDirection) => void;
  setCursor: (position: CursorPosition) => void;

  // Selection operations
  startSelection: () => void;
  updateSelection: () => void;
  clearSelection: () => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;

  // Search operations
  find: (query: string) => void;
  findNext: () => void;
  findPrevious: () => void;
  goToLine: (line: number) => void;

  // Formatting
  format: () => Promise<void>;
}
```

## Performance Optimizations

### 1. Virtual Scrolling

- Only render visible lines (viewport height + buffer)
- Update rendered lines on scroll
- Reuse line components with React.memo

### 2. Debounced Operations

- Syntax highlighting: 500ms debounce
- Auto-save: 30s debounce
- History grouping: 500ms debounce for rapid typing

### 3. Lazy Loading

- Load Prettier only when needed
- Load syntax highlighting only for visible lines
- Defer clipboard operations until needed

### 4. Memory Management

- Limit undo stack to 100 actions
- Clear syntax highlighting cache for closed files
- Release file handles after save

## Error Handling

### File Operations

```typescript
try {
  await saveFile(filePath, content);
  showStatus('File saved successfully', 'success');
} catch (error) {
  showStatus(`Failed to save: ${error.message}`, 'error');
  // Keep file dirty, allow retry
}
```

### External Changes

```typescript
// Before save, check if file was modified externally
const currentMtime = await getFileMtime(filePath);
if (currentMtime > lastKnownMtime) {
  const shouldOverwrite = await confirmDialog('File was modified externally. Overwrite?');
  if (!shouldOverwrite) {
    return; // Cancel save
  }
}
```

### Large Files

```typescript
const fileSize = await getFileSize(filePath);
if (fileSize > 1024 * 1024) {
  // 1MB
  showError('File too large for built-in editor. Use external editor.');
  return;
}
if (fileSize > 512 * 1024) {
  // 512KB
  showWarning('Large file detected. Performance may be affected.');
}
```

## Testing Strategy

### Unit Tests

- EditorBuffer: Insert, delete, replace operations
- EditorCursor: Movement, boundary conditions
- EditorHistory: Undo/redo, stack limits
- EditorSelection: Selection normalization, multi-line

### Integration Tests

- File operations: Open, save, reload
- Keyboard shortcuts: All keybindings work
- Focus integration: Focused files update on save
- Window switching: Editor integrates with window system

### Property-Based Tests

```typescript
// Undo/redo round-trip
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        type: fc.constantFrom('insert', 'delete'),
        position: fc.record({ line: fc.nat(100), column: fc.nat(80) }),
        content: fc.string(),
      })
    ),
    (actions) => {
      const buffer = new EditorBuffer('');
      const history = new EditorHistory();

      // Apply all actions
      actions.forEach((action) => {
        applyAction(buffer, action);
        history.push(action);
      });

      const afterActions = buffer.getContent();

      // Undo all
      for (let i = 0; i < actions.length; i++) {
        const action = history.undo();
        if (action) revertAction(buffer, action);
      }

      const afterUndo = buffer.getContent();

      // Redo all
      for (let i = 0; i < actions.length; i++) {
        const action = history.redo();
        if (action) applyAction(buffer, action);
      }

      const afterRedo = buffer.getContent();

      // Should be back to state after actions
      expect(afterRedo).toBe(afterActions);
    }
  )
);
```

## Security Considerations

### Path Validation

```typescript
// Always validate paths with PathSanitizer
if (!pathSanitizer.isPathSafe(filePath)) {
  throw new Error('Unsafe file path');
}
```

### Backup Files

```typescript
// Create backup before first save
if (!backupExists(filePath)) {
  await createBackup(filePath);
}
```

### File Permissions

```typescript
// Check write permissions before editing
const canWrite = await checkWritePermission(filePath);
if (!canWrite) {
  showError('File is read-only');
  setReadOnly(true);
}
```

## Configuration

### Editor Settings

```typescript
interface EditorConfig {
  tabSize: number; // Default: 2
  insertSpaces: boolean; // Default: true
  formatOnSave: boolean; // Default: false
  autoSave: boolean; // Default: false
  autoSaveDelay: number; // Default: 30000 (30s)
  maxFileSize: number; // Default: 1048576 (1MB)
  warnFileSize: number; // Default: 524288 (512KB)
  undoStackSize: number; // Default: 100
  syntaxHighlight: boolean; // Default: true
  showLineNumbers: boolean; // Default: true
}
```

### Load from Config

```typescript
// In packages/cli/src/config/types.ts
interface Config {
  // ... existing config
  editor?: EditorConfig;
}
```

## Future Enhancements

### Phase 4: Advanced Features (Future)

- Multi-cursor editing
- Regex find and replace
- Code folding
- Minimap
- Split view
- Git integration (show changes in gutter)
- LSP integration (autocomplete, diagnostics)
- Snippets
- Macro recording

## References

- Proposal: `.dev/CODE-EDITOR-PROPOSAL.md`
- Requirements: `.kiro/specs/v0.4.0 Code Editor/requirements.md`
- SyntaxViewer: `packages/cli/src/ui/components/file-explorer/SyntaxViewer.tsx`
- WindowContext: `packages/cli/src/ui/contexts/WindowContext.tsx`
- Shiki Documentation: https://shiki.matsu.io/
- Prettier API: https://prettier.io/docs/en/api.html
