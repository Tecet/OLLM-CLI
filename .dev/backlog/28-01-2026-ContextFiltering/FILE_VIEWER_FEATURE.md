# File Viewer Feature - Complete Implementation

## Overview
Complete implementation of a file viewer with scrolling support, displayed in the main left panel for optimal readability.

---

## Problems Solved

### 1. No Scrolling Support
When viewing a file in the Syntax Viewer, there was no way to scroll through the content. Long files would overflow and couldn't be navigated.

### 2. Lines Being Skipped
Lines were being skipped (6, 20, 34, 62... instead of 1, 2, 3, 4...) due to improper HTML-to-text conversion from shiki's output.

### 3. Small Viewing Area
File viewer was opening in the right panel (Workspace section), providing only ~30% of screen width, making it difficult to read long lines.

---

## Solutions Implemented

### 1. Virtual Scrolling with Keyboard Navigation
Added full scrolling support to the SyntaxViewer component with vim-like keyboard shortcuts.

### 2. Plain Text Display
Removed syntax highlighting (shiki) and display plain text with line numbers instead, as shiki's HTML output is designed for browsers, not terminals. This ensures all lines are displayed correctly.

### 3. Main Panel Display
Moved the file viewer to the main left panel (where chat and other tabs are displayed) to provide ~70% of screen width for optimal readability.

---

## Features Implemented

### Virtual Scrolling
- Only renders visible lines (configurable window size)
- Calculates visible window based on scroll offset
- Shows indicators when more content is above/below
- Efficient rendering for large files

### Keyboard Navigation
- **↑/↓ or k/j**: Scroll up/down one line
- **PgUp/PgDn or u/d**: Scroll half page up/down
- **g**: Jump to top of file
- **G**: Jump to bottom of file
- **Esc**: Close viewer and return to Chat tab

### Visual Feedback
- Header shows filename and current line range: "Lines 1-25 of 150"
- Indicators show when more content exists:
  - "▲ More lines above (scroll up) ▲"
  - "▼ More lines below (scroll down) ▼"
- Footer shows keyboard shortcuts
- Line numbers (5-digit width, supports up to 99,999 lines)

### Consistent Navigation
- Esc key closes viewer, returns to Chat tab, and focuses navbar
- Behavior matches other tabs (Settings, Docs, etc.)
- Follows hierarchical navigation pattern

---

## Implementation Details

### 1. SyntaxViewer Component
**File:** `packages/cli/src/ui/components/file-explorer/SyntaxViewer.tsx`

**Changes:**
- Removed shiki dependency (HTML output not suitable for terminals)
- Added scroll state: `const [scrollOffset, setScrollOffset] = useState(0)`
- Added input handling for keyboard navigation
- Simplified content display (direct plain text, no HTML conversion)
- Calculate visible window: `lines.slice(scrollOffset, scrollOffset + windowHeight)`
- Added visual indicators for more content above/below

**Props:**
```typescript
interface SyntaxViewerProps {
  filePath: string;
  content: string;
  language?: string;
  theme?: string;
  showLineNumbers?: boolean;
  windowHeight?: number;  // Default: 20 lines
  hasFocus?: boolean;     // For input handling
}
```

### 2. FileViewerTab Component
**File:** `packages/cli/src/ui/components/tabs/FileViewerTab.tsx` (NEW)

New dedicated component for displaying files in the left panel:
- Renders the SyntaxViewer with full height
- Handles Esc key to close viewer and return to Chat
- Shows "File Viewer" header with close instructions
- Calculates appropriate window height based on container
- Manages focus and navigation

**Esc Key Handler:**
```typescript
const handleClose = useCallback(() => {
  closeFileViewer();
  setActiveTab('chat');
  focusManager.setFocus('nav-bar');
  focusManager.setMode('browse');
}, [closeFileViewer, setActiveTab, focusManager]);
```

### 3. UI Context
**File:** `packages/cli/src/features/context/UIContext.tsx`

Added file viewer state to the global UI context:
```typescript
export interface UIState {
  // ... existing state
  fileViewer: {
    isOpen: boolean;
    filePath: string | null;
    content: string | null;
  };
}

export interface UIContextValue {
  // ... existing methods
  openFileViewer: (filePath: string, content: string) => void;
  closeFileViewer: () => void;
}
```

This allows any component to open files in the main viewer.

### 4. FileTreeView Updates
**File:** `packages/cli/src/ui/components/file-explorer/FileTreeView.tsx`

**Changes:**
- Removed local `viewerState` state
- Added `useUI()` hook to access global file viewer functions
- Updated `openViewer()` to call `openFileViewer()` instead of local state
- Updated `closeViewer()` to call `closeFileViewer()`
- Removed SyntaxViewer rendering (now in FileViewerTab)
- Removed SyntaxViewer import

### 5. App.tsx Updates
**File:** `packages/cli/src/ui/App.tsx`

**Changes:**
- Added FileViewerTab import
- Modified Row 2 (Main Content) to show FileViewerTab when a file is open
- Falls back to showing the active tab when no file is open

```typescript
{uiState.fileViewer.isOpen ? (
  <FileViewerTab width={leftWidth} height={row2Height} />
) : (
  <>
    {uiState.activeTab === 'chat' && <ChatTab ... />}
    {uiState.activeTab === 'tools' && <ToolsTab ... />}
    // ... other tabs
  </>
)}
```

---

## User Experience

### Before
- Files displayed all at once (no scrolling)
- Lines were being skipped
- File viewer opened in right panel (~30% width)
- Difficult to read long lines
- Limited vertical space
- Inconsistent Esc key behavior

### After
- Clean windowed view with smooth scrolling
- All lines displayed correctly in sequence
- File viewer opens in left panel (~70% width)
- Much easier to read and navigate
- Full vertical space available
- Consistent Esc key behavior (returns to Chat tab)
- Helpful keyboard shortcuts
- Clear position indicators

---

## Workflow

1. User navigates file tree in right panel
2. User presses Enter on a file
3. File viewer opens in left panel (overlaying current tab)
4. User can scroll through file with arrow keys (↑/↓, PgUp/PgDn, g/G)
5. User presses Esc to close viewer
6. Viewer closes, returns to Chat tab, and focuses navbar

---

## Technical Notes

### Why No Syntax Highlighting?
Shiki generates HTML output with `<span>` tags for syntax highlighting, which is designed for web browsers. Converting this HTML to plain text for terminal display was causing lines to be merged or skipped. 

For a terminal-based viewer, we need either:
1. **Plain text display** (current implementation) ✓
2. A terminal-specific syntax highlighter that outputs ANSI color codes
3. A custom HTML parser that properly handles shiki's output structure

The current implementation prioritizes **correctness and reliability** over syntax highlighting.

### Architecture Benefits

1. **Global State Management**: File viewer state in UI context allows any component to open files
2. **Separation of Concerns**: FileViewerTab component keeps App.tsx clean
3. **Reusability**: SyntaxViewer can be used in other contexts
4. **Consistent Navigation**: Follows app-wide Esc key pattern
5. **Performance**: Virtual scrolling handles large files efficiently

---

## Files Modified

1. `packages/cli/src/ui/components/file-explorer/SyntaxViewer.tsx` - Added scrolling
2. `packages/cli/src/ui/components/tabs/FileViewerTab.tsx` - New component
3. `packages/cli/src/features/context/UIContext.tsx` - Added file viewer state
4. `packages/cli/src/ui/components/file-explorer/FileTreeView.tsx` - Use global viewer
5. `packages/cli/src/ui/App.tsx` - Render FileViewerTab when file is open

---

## Testing Checklist

### Scrolling
- [x] Arrow keys (↑/↓) scroll up/down
- [x] Page up/down work correctly
- [x] g jumps to top
- [x] G jumps to bottom
- [x] Line numbers display correctly
- [x] All lines are displayed (no skipping)
- [x] Indicators show when more content exists

### Display
- [x] File opens in left panel (large area)
- [x] Works with files of various sizes (small, medium, large)
- [x] Long lines are readable
- [x] File tree remains accessible in right panel

### Navigation
- [x] Esc closes viewer, returns to Chat tab, and focuses navbar
- [x] Can open different files sequentially
- [x] Behavior consistent with other tabs (Settings, Docs, etc.)

### Technical
- [x] No TypeScript errors
- [x] No console errors
- [x] No memory leaks with large files

---

## Future Enhancements

### High Priority
- [ ] Terminal-based syntax highlighting using ANSI color codes
- [ ] Search within file (/)
- [ ] Jump to specific line number (:123)

### Medium Priority
- [ ] Horizontal scrolling for long lines
- [ ] Word wrap toggle
- [ ] Show file path in tab bar when viewer is open
- [ ] Add "Open in Editor" button in viewer

### Low Priority
- [ ] Copy selected lines to clipboard
- [ ] Support multiple files open (tabs within viewer)
- [ ] Remember last viewed file on app restart
- [ ] Add file comparison view (diff viewer)
- [ ] Syntax highlighting themes selection

---

## Summary

The file viewer feature provides a complete solution for viewing and navigating files within the terminal UI. It combines:
- **Virtual scrolling** for efficient handling of large files
- **Large viewing area** in the main left panel
- **Consistent navigation** following app-wide patterns
- **Clean architecture** with global state management

The implementation prioritizes correctness, usability, and consistency over advanced features like syntax highlighting, which can be added in future iterations.
