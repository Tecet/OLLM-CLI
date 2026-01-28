# File Explorer UI Component

A terminal-based file management system built with React and Ink, providing VS Code-style workspace experience with multi-project support, file tree navigation, focus management for LLM context injection, external editor integration, and vision support for images.

## Directory Structure

```
file-explorer/
├── __tests__/
│   ├── unit/           # Unit tests for individual components
│   ├── property/       # Property-based tests for correctness
│   └── integration/    # Integration tests for workflows
├── types.ts            # Core TypeScript interfaces
├── index.ts            # Barrel exports
└── README.md           # This file
```

## Core Types

### WorkspaceConfig

Workspace configuration loaded from `.ollm-workspace` file.

```typescript
interface WorkspaceConfig {
  version: string;
  projects: ProjectConfig[];
}
```

### ProjectConfig

Individual project configuration within a workspace.

```typescript
interface ProjectConfig {
  name: string;
  path: string;
  llmAccess: boolean;
  excludePatterns: string[];
}
```

### FileNode

File tree node representing a file or directory.

```typescript
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
  gitStatus?: GitStatus;
  isFocused?: boolean;
}
```

### GitStatus

Git status indicator for files.

```typescript
type GitStatus = 'untracked' | 'modified' | 'ignored' | 'clean';
```

### FocusedFile

Focused file with content for LLM context injection.

```typescript
interface FocusedFile {
  path: string;
  content: string;
  truncated: boolean;
  size: number;
}
```

### ImageMetadata

Image metadata for vision support.

```typescript
interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  base64: string;
  resized: boolean;
}
```

## Usage

```typescript
import type {
  WorkspaceConfig,
  ProjectConfig,
  FileNode,
  GitStatus,
  FocusedFile,
  ImageMetadata,
} from './ui/components/file-explorer';
```

## Testing

Run all file explorer tests:

```bash
npm test -- packages/cli/src/ui/components/file-explorer --run
```

Run specific test suites:

```bash
# Unit tests
npm test -- packages/cli/src/ui/components/file-explorer/__tests__/unit --run

# Property-based tests
npm test -- packages/cli/src/ui/components/file-explorer/__tests__/property --run

# Integration tests
npm test -- packages/cli/src/ui/components/file-explorer/__tests__/integration --run
```

## Requirements

This component implements requirements from the File Explorer specification:

- **Requirement 1.1**: Workspace file parsing
- **Requirement 1.3**: Project metadata support

## Next Steps

The following components will be implemented in subsequent tasks:

- WorkspaceManager service (Task 2)
- PathSanitizer service (Task 3)
- React contexts for state management (Task 4)
- FileTreeService and navigation (Tasks 6-8)
- Focus system (Tasks 11-13)
- Editor integration (Tasks 15-17)
- File operations (Tasks 19-21)
- Vision support (Tasks 29-31)
