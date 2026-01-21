# File Explorer Component - Usage Guide

## Overview

The `FileExplorerComponent` is the main entry point for the File Explorer UI. It provides a complete terminal-based file management system with workspace support, file focusing, and LLM context integration.

## Basic Usage

```tsx
import { FileExplorerComponent } from './ui/components/file-explorer';

// Minimal usage - browse current directory
<FileExplorerComponent />

// Browse a specific directory
<FileExplorerComponent rootPath="/path/to/project" />

// Load a workspace
<FileExplorerComponent
  rootPath="/path/to/workspace"
  workspacePath="/path/to/.ollm-workspace"
  autoLoadWorkspace={true}
/>

// With state persistence
<FileExplorerComponent
  rootPath="/path/to/project"
  restoreState={true}
/>
```

## Props

### Required Props
None - all props are optional with sensible defaults.

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `rootPath` | `string` | `process.cwd()` | Root directory to browse |
| `workspacePath` | `string` | `undefined` | Path to `.ollm-workspace` file |
| `autoLoadWorkspace` | `boolean` | `true` | Whether to automatically load workspace |
| `restoreState` | `boolean` | `true` | Whether to restore persisted state on mount |
| `excludePatterns` | `string[]` | `[]` | Glob patterns to exclude from tree |
| `hasFocus` | `boolean` | `true` | Whether component has keyboard focus |
| `onWorkspaceLoaded` | `(config: WorkspaceConfig) => void` | `undefined` | Callback when workspace loads |
| `onStateRestored` | `() => void` | `undefined` | Callback when state is restored |
| `onError` | `(error: Error) => void` | `undefined` | Callback when error occurs |

## Features

### 1. Workspace Management
Load multi-project workspaces with `.ollm-workspace` files:

```json
{
  "version": "1.0",
  "projects": [
    {
      "name": "frontend",
      "path": "./packages/frontend",
      "llmAccess": true,
      "excludePatterns": ["node_modules", "dist"]
    },
    {
      "name": "backend",
      "path": "./packages/backend",
      "llmAccess": true,
      "excludePatterns": ["node_modules", "build"]
    }
  ]
}
```

### 2. File Tree Navigation
- **j/Down**: Move cursor down
- **k/Up**: Move cursor up
- **h/Left**: Collapse directory
- **l/Right**: Expand directory
- **Ctrl+O**: Quick Open (fuzzy search)

### 3. File Operations
- **f**: Toggle focus on file (pin to LLM context)
- **v**: View file with syntax highlighting
- **e**: Edit file in external editor
- **a**: Open quick actions menu
- **?**: Show help panel

### 4. Focus System
Files can be "focused" to pin them to the LLM context. Focused files:
- Are marked with 📌 indicator
- Have their content injected into LLM prompts
- Are truncated at 8KB with warning
- Persist across sessions

### 5. State Persistence
The component automatically saves and restores:
- Expanded directories
- Focused files
- Quick Open history
- Active project selection

State is saved to `.ollm/explorer-state.json` in the workspace root.

### 6. Follow Mode
When enabled (press **F**), the file tree automatically expands to show files referenced by the LLM in chat responses.

## Component Architecture

The FileExplorerComponent composes several sub-components:

```
FileExplorerComponent
├── WorkspaceProvider (context)
│   ├── FileFocusProvider (context)
│   │   └── FileTreeProvider (context)
│   │       ├── FileTreeView
│   │       │   ├── Header
│   │       │   ├── HelpPanel
│   │       │   ├── QuickOpenDialog
│   │       │   ├── QuickActionsMenu
│   │       │   ├── ConfirmationDialog
│   │       │   ├── SyntaxViewer
│   │       │   └── LoadingIndicator
│   │       └── FocusedFilesPanel
```

## Services

The component instantiates and manages these services:

- **WorkspaceManager**: Loads and manages workspace configuration
- **FileTreeService**: Builds and manages file tree structure
- **FocusSystem**: Manages focused files for LLM context
- **GitStatusService**: Queries git status for files
- **EditorIntegration**: Spawns external editors
- **FileOperations**: Handles file CRUD operations
- **FollowModeService**: Detects LLM-referenced files
- **ExplorerPersistence**: Saves/loads state
- **PathSanitizer**: Validates paths for security

## Lifecycle

1. **Mount**: Component initializes services
2. **Initialization**: 
   - Load workspace (if provided)
   - Restore persisted state (if enabled)
   - Build initial file tree
3. **Runtime**: User interacts with file tree
4. **Unmount**: Save current state to disk

## Error Handling

The component handles errors gracefully:
- Invalid workspace files → Continue in browse mode
- Corrupted state files → Use default state
- Missing directories → Display empty state
- Permission errors → Show error messages

## Example: Full Integration

```tsx
import React from 'react';
import { render } from 'ink';
import { FileExplorerComponent } from './ui/components/file-explorer';

function App() {
  return (
    <FileExplorerComponent
      rootPath="/path/to/workspace"
      workspacePath="/path/to/.ollm-workspace"
      autoLoadWorkspace={true}
      restoreState={true}
      excludePatterns={['node_modules', 'dist', '*.log']}
      onWorkspaceLoaded={(config) => {
        console.log(`Loaded workspace with ${config.projects.length} projects`);
      }}
      onStateRestored={() => {
        console.log('Previous state restored');
      }}
      onError={(error) => {
        console.error('File Explorer error:', error);
      }}
    />
  );
}

render(<App />);
```

## Testing

The component includes comprehensive unit tests covering:
- Initialization and lifecycle
- Workspace loading
- State restoration
- Component composition
- Error handling

Run tests with:
```bash
npm test -- FileExplorerComponent.test.tsx
```

## Requirements Satisfied

This component satisfies the following requirements:
- **1.1**: Workspace loading and project management
- **12.2**: State restoration on startup
- All sub-components are properly composed and wired together
- All contexts provide shared state to child components
- Services are instantiated and passed to appropriate components
