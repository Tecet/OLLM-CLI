# File Explorer Component - Usage Guide

## Overview

The `FileExplorerComponent` is the main entry point for the File Explorer UI. It provides a complete terminal-based file management system with workspace support, file focusing, and LLM context integration.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Props Reference](#props-reference)
- [Features](#features)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Component Architecture](#component-architecture)
- [Services](#services)
- [Lifecycle](#lifecycle)
- [Error Handling](#error-handling)
- [Examples](#examples)
- [Testing](#testing)
- [Requirements](#requirements)

## Basic Usage

### Minimal Example

```tsx
import { FileExplorerComponent } from './ui/components/file-explorer';

// Browse current directory with default settings
<FileExplorerComponent />;
```

### Browse Specific Directory

```tsx
// Browse a specific project directory
<FileExplorerComponent rootPath="/path/to/project" />
```

### With Workspace

```tsx
// Load a workspace with multiple projects
<FileExplorerComponent
  rootPath="/path/to/workspace"
  workspacePath="/path/to/.ollm-workspace"
  autoLoadWorkspace={true}
/>
```

### With State Persistence

```tsx
// Restore previous state on mount
<FileExplorerComponent rootPath="/path/to/project" restoreState={true} />
```

### With Exclude Patterns

```tsx
// Exclude node_modules, dist, and log files
<FileExplorerComponent
  rootPath="/path/to/project"
  excludePatterns={['node_modules', 'dist', '*.log', '.git']}
/>
```

### Full Integration Example

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
      hasFocus={true}
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

## Props Reference

### Required Props

None - all props are optional with sensible defaults.

### Optional Props

| Prop                | Type                                | Default         | Description                                 |
| ------------------- | ----------------------------------- | --------------- | ------------------------------------------- |
| `rootPath`          | `string`                            | `process.cwd()` | Root directory to browse                    |
| `workspacePath`     | `string`                            | `undefined`     | Path to `.ollm-workspace` file              |
| `autoLoadWorkspace` | `boolean`                           | `true`          | Whether to automatically load workspace     |
| `restoreState`      | `boolean`                           | `true`          | Whether to restore persisted state on mount |
| `excludePatterns`   | `string[]`                          | `[]`            | Glob patterns to exclude from tree          |
| `hasFocus`          | `boolean`                           | `true`          | Whether component has keyboard focus        |
| `toolRegistry`      | `ToolRegistry`                      | `undefined`     | Tool system integration (optional)          |
| `policyEngine`      | `PolicyEngine`                      | `undefined`     | Policy engine for confirmations (optional)  |
| `messageBus`        | `MessageBus`                        | `undefined`     | Message bus for hook events (optional)      |
| `onWorkspaceLoaded` | `(config: WorkspaceConfig) => void` | `undefined`     | Callback when workspace loads               |
| `onStateRestored`   | `() => void`                        | `undefined`     | Callback when state is restored             |
| `onError`           | `(error: Error) => void`            | `undefined`     | Callback when error occurs                  |

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

**Example: Creating a Workspace**

```tsx
import { WorkspaceManager } from './ui/components/file-explorer';

const workspaceManager = new WorkspaceManager();

// Create a new workspace
const config = {
  version: '1.0',
  projects: [
    {
      name: 'frontend',
      path: './packages/frontend',
      llmAccess: true,
      excludePatterns: ['node_modules', 'dist'],
    },
    {
      name: 'backend',
      path: './packages/backend',
      llmAccess: true,
      excludePatterns: ['node_modules', 'build'],
    },
  ],
};

workspaceManager.saveWorkspace('/path/to/.ollm-workspace', config);
```

### 2. File Tree Navigation

Navigate the file tree using keyboard shortcuts:

- **j / Down Arrow**: Move cursor down
- **k / Up Arrow**: Move cursor up
- **h / Left Arrow**: Collapse directory
- **l / Right Arrow**: Expand directory
- **g**: Jump to top of tree
- **G**: Jump to bottom of tree
- **Ctrl+O**: Quick Open (fuzzy search)
- **Ctrl+F**: Search in files

**Example: Programmatic Navigation**

```tsx
import { FileTreeService } from './ui/components/file-explorer';

const fileTreeService = new FileTreeService();

// Build tree
const tree = await fileTreeService.buildTree({
  rootPath: '/path/to/project',
  excludePatterns: ['node_modules'],
});

// Expand a directory
const node = fileTreeService.findNodeByPath(tree, '/path/to/project/src');
if (node) {
  await fileTreeService.expandDirectory(node, ['node_modules']);
}

// Get visible nodes for rendering
const visibleNodes = fileTreeService.getVisibleNodes(tree, {
  scrollOffset: 0,
  windowSize: 15,
});
```

### 3. File Operations

Perform file operations with validation and confirmation:

- **f**: Toggle focus on file (pin to LLM context)
- **v**: View file with syntax highlighting
- **e**: Edit file in external editor
- **a**: Open quick actions menu
- **n**: Create new file
- **N**: Create new folder
- **r**: Rename file/folder
- **d**: Delete file/folder
- **y**: Copy file path to clipboard

**Example: File Operations**

```tsx
import { FileOperations } from './ui/components/file-explorer';

const fileOps = new FileOperations('/path/to/workspace');

// Create a new file
const result = await fileOps.createFile(
  '/path/to/workspace/src/newFile.ts',
  '// New file content',
  async (message) => {
    // Confirmation callback
    console.log(message);
    return true; // Confirm
  }
);

if (result.success) {
  console.log('File created:', result.path);
} else {
  console.error('Error:', result.error);
}

// Rename a file
const renameResult = await fileOps.renameFile(
  '/path/to/workspace/src/oldName.ts',
  '/path/to/workspace/src/newName.ts'
);

// Delete a file
const deleteResult = await fileOps.deleteFile(
  '/path/to/workspace/src/unwanted.ts',
  async (message) => {
    console.log(message);
    return true; // Confirm deletion
  }
);
```

### 4. Focus System

Files can be "focused" to pin them to the LLM context. Focused files:

- Are marked with 📌 indicator
- Have their content injected into LLM prompts
- Are truncated at 8KB with warning
- Persist across sessions

**Example: Focus System**

````tsx
import { FocusSystem } from './ui/components/file-explorer';

const focusSystem = new FocusSystem();

// Focus a file
const focusedFile = await focusSystem.focusFile('/path/to/file.ts');
console.log('Focused:', focusedFile.path);
console.log('Size:', focusedFile.size);
console.log('Truncated:', focusedFile.truncated);

// Get all focused files
const allFocused = focusSystem.getFocusedFiles();
console.log(`${allFocused.length} files focused`);

// Inject into LLM prompt
const prompt = 'Explain this code';
const injectedPrompt = focusSystem.injectIntoPrompt(prompt);
console.log(injectedPrompt);
// Output:
// ## Focused Files
//
// ### File: /path/to/file.ts
// ```
// [file content]
// ```
//
// ## User Prompt
// Explain this code

// Unfocus a file
focusSystem.unfocusFile('/path/to/file.ts');

// Clear all focused files
focusSystem.clearAll();
````

### 5. State Persistence

The component automatically saves and restores:

- Expanded directories
- Focused files
- Quick Open history
- Active project selection

State is saved to `.ollm/explorer-state.json` in the workspace root.

**Example: Manual State Management**

```tsx
import { ExplorerPersistence } from './ui/components/file-explorer';

const persistence = new ExplorerPersistence('/path/to/workspace');

// Save state
persistence.saveState({
  expandedDirectories: ['/path/to/workspace/src', '/path/to/workspace/tests'],
  focusedFiles: ['/path/to/workspace/src/index.ts'],
  quickOpenHistory: ['index.ts', 'App.tsx'],
  lastActiveProject: 'frontend',
});

// Load state
const state = persistence.loadState();
console.log('Expanded:', state.expandedDirectories);
console.log('Focused:', state.focusedFiles);
```

### 6. Follow Mode

When enabled (press **F**), the file tree automatically expands to show files referenced by the LLM in chat responses.

**Example: Follow Mode**

```tsx
import { FollowModeService } from './ui/components/file-explorer';

const followMode = new FollowModeService();

// Enable follow mode
followMode.enable();

// Detect file references in LLM response
const response = 'I updated the file at src/components/App.tsx';
const detectedFiles = followMode.detectFileReferences(response, '/path/to/workspace');
console.log('Detected files:', detectedFiles);
// Output: ['/path/to/workspace/src/components/App.tsx']

// Disable follow mode
followMode.disable();
```

## Keyboard Shortcuts

### Navigation

- **j / Down**: Move cursor down
- **k / Up**: Move cursor up
- **h / Left**: Collapse directory
- **l / Right**: Expand directory
- **g**: Jump to top
- **G**: Jump to bottom
- **Ctrl+D**: Scroll down half page
- **Ctrl+U**: Scroll up half page

### File Operations

- **f**: Toggle focus on file
- **v**: View file
- **e**: Edit file
- **a**: Quick actions menu
- **n**: New file
- **N**: New folder
- **r**: Rename
- **d**: Delete
- **y**: Copy path

### Search & Navigation

- **Ctrl+O**: Quick Open (fuzzy search)
- **Ctrl+F**: Search in files
- **/**: Search in tree
- **?**: Show help panel

### Workspace

- **Ctrl+P**: Switch project
- **Ctrl+R**: Refresh tree
- **F**: Toggle follow mode

### General

- **Esc**: Close modal / Go back
- **Enter**: Confirm / Activate
- **Tab**: Next element
- **Shift+Tab**: Previous element

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

### Context Providers

**WorkspaceProvider**: Manages workspace configuration and active project
**FileFocusProvider**: Manages focused files for LLM context
**FileTreeProvider**: Manages file tree state and expanded directories

## Services

The component instantiates and manages these services:

### WorkspaceManager

Loads and manages workspace configuration from `.ollm-workspace` files.

```tsx
const workspaceManager = new WorkspaceManager();
const config = workspaceManager.loadWorkspace('/path/to/.ollm-workspace');
```

### FileTreeService

Builds and manages file tree structure with lazy loading.

```tsx
const fileTreeService = new FileTreeService();
const tree = await fileTreeService.buildTree({
  rootPath: '/path/to/project',
  excludePatterns: ['node_modules'],
});
```

### FocusSystem

Manages focused files for LLM context injection.

```tsx
const focusSystem = new FocusSystem();
const focusedFile = await focusSystem.focusFile('/path/to/file.ts');
```

### GitStatusService

Queries git status for files (modified, untracked, etc.).

```tsx
const gitStatusService = new GitStatusService();
const status = await gitStatusService.getFileStatus('/path/to/file.ts');
```

### EditorIntegration

Spawns external editors for file editing.

```tsx
const editorIntegration = new EditorIntegration();
await editorIntegration.openInEditor('/path/to/file.ts');
```

### FileOperations

Handles file CRUD operations with validation.

```tsx
const fileOps = new FileOperations('/path/to/workspace');
const result = await fileOps.createFile('/path/to/newFile.ts', 'content');
```

### FollowModeService

Detects LLM-referenced files and auto-expands tree.

```tsx
const followMode = new FollowModeService();
const files = followMode.detectFileReferences(llmResponse, workspaceRoot);
```

### ExplorerPersistence

Saves/loads state to `.ollm/explorer-state.json`.

```tsx
const persistence = new ExplorerPersistence('/path/to/workspace');
persistence.saveState({ expandedDirectories: [...], focusedFiles: [...] });
```

### PathSanitizer

Validates paths for security (prevents traversal attacks).

```tsx
const pathSanitizer = new PathSanitizer();
const safePath = pathSanitizer.sanitize(userInput);
```

## Lifecycle

1. **Mount**: Component initializes services
2. **Initialization**:
   - Load workspace (if provided)
   - Restore persisted state (if enabled)
   - Build initial file tree
3. **Runtime**: User interacts with file tree
4. **Unmount**: Save current state to disk

### Initialization Flow

```
1. Create service instances
   ↓
2. Load workspace configuration (if workspacePath provided)
   ↓
3. Restore persisted state (if restoreState enabled)
   ├── Restore expanded directories
   ├── Restore focused files
   └── Restore active project
   ↓
4. Build initial file tree
   ↓
5. Render UI
```

## Error Handling

The component handles errors gracefully:

### Error Categories

- **NOT_FOUND**: File or directory not found
- **PERMISSION_DENIED**: Permission denied for operation
- **PATH_VALIDATION**: Path contains invalid characters or traversal
- **ALREADY_EXISTS**: File or directory already exists
- **NOT_EMPTY**: Directory not empty (for deletion)
- **INVALID_OPERATION**: Operation not supported for file type
- **IO_ERROR**: System I/O error
- **UNKNOWN**: Unexpected error

### Error Recovery

```tsx
import { handleError, getRecoverySuggestion } from './ui/components/file-explorer';

try {
  await fileOps.createFile('/path/to/file.ts', 'content');
} catch (error) {
  const errorInfo = handleError(error, {
    operation: 'createFile',
    filePath: '/path/to/file.ts',
  });

  console.error(errorInfo.message);
  console.log('Recoverable:', errorInfo.recoverable);
  console.log('Suggestion:', getRecoverySuggestion(errorInfo.category));
}
```

### Common Error Scenarios

**Invalid workspace file**

```
Error: Failed to load workspace
Recovery: Continue in browse mode
```

**Corrupted state file**

```
Error: Failed to restore state
Recovery: Use default state
```

**Missing directory**

```
Error: Directory not found
Recovery: Display empty state
```

**Permission denied**

```
Error: Permission denied for operation
Recovery: Show error message, suggest fix
```

## Examples

### Example 1: Simple File Browser

```tsx
import React from 'react';
import { render } from 'ink';
import { FileExplorerComponent } from './ui/components/file-explorer';

function SimpleBrowser() {
  return (
    <FileExplorerComponent rootPath={process.cwd()} excludePatterns={['node_modules', '.git']} />
  );
}

render(<SimpleBrowser />);
```

### Example 2: Workspace with Callbacks

```tsx
import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import { FileExplorerComponent } from './ui/components/file-explorer';

function WorkspaceBrowser() {
  const [status, setStatus] = useState('Initializing...');

  return (
    <Box flexDirection="column">
      <Text>{status}</Text>
      <FileExplorerComponent
        rootPath="/path/to/workspace"
        workspacePath="/path/to/.ollm-workspace"
        onWorkspaceLoaded={(config) => {
          setStatus(`Loaded ${config.projects.length} projects`);
        }}
        onStateRestored={() => {
          setStatus('State restored');
        }}
        onError={(error) => {
          setStatus(`Error: ${error.message}`);
        }}
      />
    </Box>
  );
}

render(<WorkspaceBrowser />);
```

### Example 3: Custom Exclude Patterns

```tsx
import React from 'react';
import { render } from 'ink';
import { FileExplorerComponent } from './ui/components/file-explorer';

function CustomExcludeBrowser() {
  const excludePatterns = [
    'node_modules',
    'dist',
    'build',
    '*.log',
    '.git',
    '.DS_Store',
    'coverage',
    '.next',
    '.cache',
  ];

  return <FileExplorerComponent rootPath="/path/to/project" excludePatterns={excludePatterns} />;
}

render(<CustomExcludeBrowser />);
```

### Example 4: Integration with Tool System

```tsx
import React from 'react';
import { render } from 'ink';
import { FileExplorerComponent } from './ui/components/file-explorer';
import { ToolRegistry } from '@ollm/ollm-cli-core/tools/tool-registry';
import { PolicyEngine } from '@ollm/ollm-cli-core/policy/policyEngine';
import { MessageBus } from '@ollm/ollm-cli-core/hooks/messageBus';

function IntegratedBrowser() {
  const toolRegistry = new ToolRegistry();
  const policyEngine = new PolicyEngine();
  const messageBus = new MessageBus();

  return (
    <FileExplorerComponent
      rootPath="/path/to/project"
      toolRegistry={toolRegistry}
      policyEngine={policyEngine}
      messageBus={messageBus}
    />
  );
}

render(<IntegratedBrowser />);
```

## Testing

The component includes comprehensive unit tests covering:

- Initialization and lifecycle
- Workspace loading
- State restoration
- Component composition
- Error handling

### Running Tests

```bash
# Run all file explorer tests
npm test -- file-explorer

# Run specific test file
npm test -- FileExplorerComponent.test.tsx

# Run with coverage
npm test -- --coverage file-explorer
```

### Example Test

```tsx
import { render, waitFor } from 'ink-testing-library';
import { FileExplorerComponent } from './FileExplorerComponent';

describe('FileExplorerComponent', () => {
  it('should initialize successfully', async () => {
    const { lastFrame } = render(<FileExplorerComponent />);

    await waitFor(() => {
      expect(lastFrame()).toContain('File Explorer');
    });
  });

  it('should load workspace', async () => {
    const onWorkspaceLoaded = jest.fn();

    render(
      <FileExplorerComponent
        workspacePath="/path/to/.ollm-workspace"
        onWorkspaceLoaded={onWorkspaceLoaded}
      />
    );

    await waitFor(() => {
      expect(onWorkspaceLoaded).toHaveBeenCalled();
    });
  });
});
```

## Requirements

This component satisfies the following requirements:

- **1.1**: Workspace loading and project management
- **12.2**: State restoration on startup
- All sub-components are properly composed and wired together
- All contexts provide shared state to child components
- Services are instantiated and passed to appropriate components

## See Also

- [Integration Guide](./INTEGRATION_GUIDE.md) - How to integrate with other systems
- [README](./README.md) - Architecture and design overview
- [API Documentation](./API.md) - Detailed API reference
