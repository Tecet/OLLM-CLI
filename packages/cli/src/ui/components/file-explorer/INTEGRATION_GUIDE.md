# File Explorer Integration Guide

This document explains how to integrate the File Explorer with the core OLLM CLI systems.

## Overview

The File Explorer needs to be integrated with three core systems:

1. **Tool Registry** - For file operations
2. **Policy Engine** - For confirmations
3. **Message Bus** - For hook events
4. **LLM Context** - For focused files

## 1. Tool Registry Integration

### Current Status

✅ **IMPLEMENTED** - FileOperations now supports tool registry integration

### Usage

```typescript
import { ToolRegistry } from '@ollm/ollm-cli-core/tools/tool-registry.js';
import { PolicyEngine } from '@ollm/ollm-cli-core/policy/policyEngine.js';
import { MessageBus } from '@ollm/ollm-cli-core/hooks/messageBus.js';
import { FileOperations } from './FileOperations.js';

// Create FileOperations with tool system integration
const fileOps = new FileOperations(
  workspaceRoot,
  toolRegistry, // Optional: enables tool-based operations
  policyEngine, // Optional: enables policy enforcement
  messageBus // Optional: enables hook events
);

// File operations will now:
// 1. Use write_file tool if available
// 2. Apply policy engine for confirmations
// 3. Emit hook events (file:created, file:edited, file:deleted)
await fileOps.createFile('/path/to/file.ts', 'content');
```

### Benefits

- **Policy Enforcement**: All file operations go through policy engine
- **Hook Integration**: File operations trigger hooks automatically
- **Audit Trail**: Operations are logged via tool system
- **Security**: Path validation and permission checks

## 2. Focus System Integration

### Current Status

✅ **IMPLEMENTED** - FocusSystem now emits hook events

### Usage

```typescript
import { MessageBus } from '@ollm/ollm-cli-core/hooks/messageBus.js';
import { FocusSystem } from './FocusSystem.js';

// Create FocusSystem with message bus
const focusSystem = new FocusSystem(messageBus);

// Focus operations will emit events:
// - file:focused when a file is focused
// - file:unfocused when a file is unfocused
await focusSystem.focusFile('/path/to/file.ts');
```

### Hook Events

```typescript
// Listen for focus events
messageBus.on('file:focused', async (event, data) => {
  const { path, size } = data as { path: string; size: number };
  console.log(`File focused: ${path} (${size} bytes)`);
});

messageBus.on('file:unfocused', async (event, data) => {
  const { path } = data as { path: string };
  console.log(`File unfocused: ${path}`);
});
```

## 3. LLM Context Integration

### Current Status

⚠️ **NEEDS IMPLEMENTATION** - FocusSystem not connected to ChatContext

### Required Changes

The FocusSystem has an `injectIntoPrompt()` method that needs to be called when building the system prompt for the LLM.

#### Option A: Integrate in ChatContext (Recommended)

```typescript
// In packages/cli/src/features/context/ChatContext.tsx

import { useFocusSystem } from '../ui/components/file-explorer/FileFocusContext.js';

// Inside ChatProvider component, before sending to LLM:
const focusSystem = useFocusSystem();
const focusedContent = focusSystem?.injectIntoPrompt('') || '';

// Append focused content to system prompt
let systemPrompt = contextActions.getSystemPrompt();
if (focusedContent) {
  systemPrompt += '\n\n' + focusedContent;
}

// Then send to LLM with enhanced system prompt
await sendToLLM(history, onText, onError, systemPrompt, toolSchemas, temperature);
```

#### Option B: Integrate in SystemPromptBuilder

```typescript
// In packages/core/src/context/SystemPromptBuilder.ts

export class SystemPromptBuilder {
  private focusSystem?: FocusSystem;

  setFocusSystem(focusSystem: FocusSystem): void {
    this.focusSystem = focusSystem;
  }

  build(): string {
    let prompt = this.basePrompt;

    // Add focused files section
    if (this.focusSystem) {
      const focusedContent = this.focusSystem.injectIntoPrompt('');
      if (focusedContent) {
        prompt += '\n\n' + focusedContent;
      }
    }

    return prompt;
  }
}
```

### Testing Integration

````typescript
// Test that focused files appear in LLM prompts
const focusSystem = new FocusSystem();
await focusSystem.focusFile('/path/to/test.ts');

const prompt = focusSystem.injectIntoPrompt('What does this code do?');

// Prompt should contain:
// ## Focused Files
//
// ### File: /path/to/test.ts
// ```
// [file content]
// ```
//
// ## User Prompt
// What does this code do?
````

## 4. FileExplorerComponent Integration

### Current Status

⚠️ **NEEDS IMPLEMENTATION** - Component doesn't receive tool system dependencies

### Required Changes

```typescript
// In packages/cli/src/ui/components/file-explorer/FileExplorerComponent.tsx

export interface FileExplorerComponentProps {
  rootPath?: string;
  workspacePath?: string;
  autoLoadWorkspace?: boolean;
  restoreState?: boolean;
  excludePatterns?: string[];
  hasFocus?: boolean;

  // NEW: Tool system integration
  toolRegistry?: ToolRegistry;
  policyEngine?: PolicyEngine;
  messageBus?: MessageBus;

  // Callbacks
  onWorkspaceLoaded?: (config: WorkspaceConfig) => void;
  onStateRestored?: () => void;
  onError?: (error: Error) => void;
}

export function FileExplorerComponent({
  rootPath = process.cwd(),
  toolRegistry,
  policyEngine,
  messageBus,
  // ... other props
}: FileExplorerComponentProps) {
  // Create services with tool system integration
  const [services] = useState(() => {
    const pathSanitizer = new PathSanitizer();
    const gitStatusService = new GitStatusService();
    const fileTreeService = new FileTreeService();
    const focusSystem = new FocusSystem(messageBus); // Pass messageBus
    const editorIntegration = new EditorIntegration();
    const fileOperations = new FileOperations(
      rootPath,
      toolRegistry, // Pass toolRegistry
      policyEngine, // Pass policyEngine
      messageBus // Pass messageBus
    );
    const followModeService = new FollowModeService();
    const workspaceManager = new WorkspaceManager();
    const explorerPersistence = new ExplorerPersistence(rootPath);

    return {
      pathSanitizer,
      gitStatusService,
      fileTreeService,
      focusSystem,
      editorIntegration,
      fileOperations,
      followModeService,
      workspaceManager,
      explorerPersistence,
    };
  });

  // ... rest of component
}
```

## 5. App.tsx Integration

### Current Status

⚠️ **NEEDS IMPLEMENTATION** - App doesn't pass tool system to FileExplorer

### Required Changes

```typescript
// In packages/cli/src/ui/App.tsx

import { FileExplorerComponent } from './components/file-explorer/FileExplorerComponent.js';
import { useServices } from '../features/context/ServiceContext.js';

export function App() {
  const { container } = useServices();

  // Get tool system instances from service container
  const toolRegistry = container?.getToolRegistry();
  const policyEngine = container?.getPolicyEngine();
  const messageBus = container?.getMessageBus();

  return (
    <Box flexDirection="column">
      {/* ... other components */}

      <FileExplorerComponent
        rootPath={process.cwd()}
        toolRegistry={toolRegistry}
        policyEngine={policyEngine}
        messageBus={messageBus}
        autoLoadWorkspace={true}
        restoreState={true}
      />
    </Box>
  );
}
```

## 6. Vision Service Implementation

### Current Status

⚠️ **PLACEHOLDER** - VisionService doesn't actually resize images

### Required Changes

```bash
# Install sharp package
npm install sharp
```

```typescript
// In packages/cli/src/ui/components/file-explorer/VisionService.ts

import sharp from 'sharp';

async resizeImage(imagePath: string, maxDimension: number): Promise<Buffer> {
  const imageBuffer = await fs.readFile(imagePath);

  // Use sharp to resize
  return await sharp(imageBuffer)
    .resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .toBuffer();
}
```

## 7. Testing the Integration

### Test File Operations

```typescript
// Test that file operations use tool system
const result = await fileOps.createFile('/test.ts', 'console.log("test")');
// Should trigger:
// 1. write_file tool invocation
// 2. Policy engine check
// 3. file:created hook event
```

### Test Focus System

```typescript
// Test that focused files emit events
let eventEmitted = false;
messageBus.on('file:focused', () => {
  eventEmitted = true;
});

await focusSystem.focusFile('/test.ts');
assert(eventEmitted, 'file:focused event should be emitted');
```

### Test LLM Integration

```typescript
// Test that focused files appear in prompts
await focusSystem.focusFile('/test.ts');
const prompt = focusSystem.injectIntoPrompt('Explain this code');

assert(prompt.includes('## Focused Files'), 'Prompt should include focused files section');
assert(prompt.includes('/test.ts'), 'Prompt should include file path');
```

## Summary

### Completed ✅

- FileOperations tool system integration
- FocusSystem hook event emissions
- Integration documentation

### Remaining ⚠️

- Connect FocusSystem to ChatContext/SystemPromptBuilder
- Pass tool system dependencies to FileExplorerComponent
- Update App.tsx to provide tool system instances
- Implement real image resizing in VisionService
- Add integration tests

### Priority Order

1. **High**: Connect FocusSystem to LLM context (core feature)
2. **High**: Pass tool system to FileExplorerComponent
3. **Medium**: Implement VisionService with sharp
4. **Low**: Add comprehensive integration tests
