# Hooks Feature Module

This module provides UI-specific types and utilities for the Hooks Panel in the OLLM CLI.

## Overview

The Hooks Panel UI requires a different data structure than the core hook system:

- **Core Hook System**: Uses a `command` field for execution, optimized for the runtime
- **UI Hook System**: Uses a `when/then` structure for better user understanding and editing

This module provides an adapter layer to bridge these two representations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Core Hook System                         │
│  (packages/core/src/hooks/types.ts)                         │
│                                                              │
│  interface Hook {                                            │
│    id: string;                                               │
│    name: string;                                             │
│    command: string;  // Execution-focused                    │
│    args?: string[];                                          │
│    source: HookSource;                                       │
│  }                                                           │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ Adapter Layer
                           │ (adapter.ts)
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                     UI Hook System                           │
│  (packages/cli/src/features/hooks/types.ts)                 │
│                                                              │
│  interface UIHook {                                          │
│    id: string;                                               │
│    name: string;                                             │
│    when: {                    // User-friendly structure     │
│      type: UIHookEventType;                                  │
│      patterns?: string[];                                    │
│    };                                                        │
│    then: {                                                   │
│      type: UIHookActionType;                                 │
│      prompt?: string;                                        │
│      command?: string;                                       │
│    };                                                        │
│    enabled: boolean;                                         │
│    trusted: boolean;                                         │
│    source: HookSource;                                       │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
```

## Types

### UIHook

The main UI-friendly hook interface with a `when/then` structure:

```typescript
interface UIHook {
  id: string;
  name: string;
  version: string;
  description?: string;

  when: {
    type: UIHookEventType; // fileEdited, promptSubmit, etc.
    patterns?: string[]; // For file events
  };

  then: {
    type: UIHookActionType; // askAgent or runCommand
    prompt?: string; // For askAgent
    command?: string; // For runCommand
  };

  enabled: boolean;
  trusted: boolean;
  source: HookSource;
}
```

### UIHookEventType

Event types that trigger hooks:

- `fileEdited` - When a file is edited
- `fileCreated` - When a file is created
- `fileDeleted` - When a file is deleted
- `userTriggered` - Manually triggered by user
- `promptSubmit` - When user submits a prompt
- `agentStop` - When agent stops execution

### UIHookActionType

Actions that hooks can perform:

- `askAgent` - Ask the agent to perform a task (requires `prompt`)
- `runCommand` - Run a shell command (requires `command`)

## Adapter Functions

### coreHookToUIHook

Convert a core Hook to a UI Hook:

```typescript
const coreHook: CoreHook = {
  id: 'lint-hook',
  name: 'Lint on Save',
  command: 'fileEdited:*.ts:runCommand:npm run lint',
  source: 'user',
};

const uiHook = coreHookToUIHook(coreHook, true);
// Result:
// {
//   id: 'lint-hook',
//   name: 'Lint on Save',
//   when: { type: 'fileEdited', patterns: ['*.ts'] },
//   then: { type: 'runCommand', command: 'npm run lint' },
//   enabled: true,
//   ...
// }
```

### uiHookToCoreHook

Convert a UI Hook to a core Hook:

```typescript
const uiHook: UIHook = {
  id: 'review-hook',
  name: 'Review Changes',
  when: { type: 'fileEdited', patterns: ['*.ts', '*.tsx'] },
  then: { type: 'askAgent', prompt: 'Review the changes' },
  enabled: true,
  trusted: true,
  source: 'user',
};

const coreHook = uiHookToCoreHook(uiHook);
// Result:
// {
//   id: 'review-hook',
//   name: 'Review Changes',
//   command: 'fileEdited:*.ts,*.tsx:askAgent:Review the changes',
//   source: 'user',
// }
```

### validateUIHook

Validate a UI Hook:

```typescript
const hook: Partial<UIHook> = {
  name: 'Test Hook',
  when: { type: 'fileEdited', patterns: [] }, // Missing patterns!
  then: { type: 'askAgent', prompt: '' }, // Missing prompt!
};

const errors = validateUIHook(hook);
// Result: [
//   'File events require at least one file pattern',
//   'askAgent action requires a prompt'
// ]
```

### formDataToUIHook / uiHookToFormData

Convert between form data and UI Hooks:

```typescript
// Form data from user input
const formData = {
  name: 'Lint Hook',
  description: 'Run linter on save',
  eventType: 'fileEdited',
  patterns: ['*.ts', '*.tsx'],
  actionType: 'runCommand',
  promptOrCommand: 'npm run lint',
};

// Convert to UIHook (partial, needs id/enabled/trusted/source)
const hookData = formDataToUIHook(formData);

// Convert back to form data for editing
const editFormData = uiHookToFormData(uiHook);
```

### createDefaultUIHook

Create a new hook with default values:

```typescript
const newHook = createDefaultUIHook({
  name: 'My Hook',
  when: { type: 'promptSubmit' },
});
```

## Command Format

The adapter uses a structured command format to encode the `when/then` structure:

### Format

```
eventType[:patterns]:actionType:actionValue
```

### Examples

```
fileEdited:*.ts:askAgent:Review changes
fileEdited:*.ts,*.tsx:runCommand:npm run lint
promptSubmit:askAgent:Analyze the prompt
userTriggered:runCommand:echo "Hello"
```

### Parsing Rules

1. Split command by `:` delimiter
2. First part is event type
3. If event is file event and next part contains patterns, parse them
4. Next part is action type
5. Remaining parts joined with `:` are the action value

## Usage in UI Components

### Loading Hooks

```typescript
import { coreHookToUIHook } from '@/features/hooks';
import { HookRegistry } from '@ollm/ollm-cli-core/hooks';

// Load hooks from registry
const coreHooks = hookRegistry.getAllHooks();
const enabledHooks = settingsService.getHookSettings().enabled;

// Convert to UI hooks
const uiHooks = coreHooks.map((hook) => coreHookToUIHook(hook, enabledHooks[hook.id] || false));
```

### Saving Hooks

```typescript
import { uiHookToCoreHook, validateUIHook } from '@/features/hooks';

// Validate before saving
const errors = validateUIHook(uiHook);
if (errors.length > 0) {
  showErrors(errors);
  return;
}

// Convert to core hook
const coreHook = uiHookToCoreHook(uiHook);

// Save to file system
await hookFileService.saveHook(coreHook);

// Register with hook system
hookRegistry.register(coreHook);
```

### Form Handling

```typescript
import { formDataToUIHook, uiHookToFormData } from '@/features/hooks';

// Creating a new hook
const handleSubmit = (formData: HookFormData) => {
  const hookData = formDataToUIHook(formData);
  const newHook: UIHook = {
    ...hookData,
    id: generateHookId(),
    enabled: true,
    trusted: false,
    source: 'user',
  };

  await saveHook(newHook);
};

// Editing an existing hook
const handleEdit = (hook: UIHook) => {
  const formData = uiHookToFormData(hook);
  showEditDialog(formData);
};
```

## Testing

The adapter includes comprehensive unit tests covering:

- Core to UI conversion
- UI to Core conversion
- Validation logic
- Form data conversion
- Round-trip conversion (UI → Core → UI)
- Edge cases and legacy formats

Run tests:

```bash
npm test -- packages/cli/src/features/hooks/__tests__/adapter.test.ts
```

## Design Decisions

### Why Two Type Systems?

1. **Core System (command-based)**:
   - Optimized for execution
   - Simple string-based format
   - Easy to serialize and store
   - Minimal runtime overhead

2. **UI System (when/then structure)**:
   - Optimized for user understanding
   - Structured data for form editing
   - Clear separation of trigger and action
   - Better validation and error messages

### Command Format Choice

The structured command format (`eventType:patterns:actionType:value`) was chosen because:

- It's human-readable
- It's easy to parse and generate
- It preserves all necessary information
- It's backward compatible with simple commands
- It doesn't require JSON parsing in the core system

### Validation Strategy

Validation is performed at the UI layer because:

- Better error messages for users
- Prevents invalid hooks from being saved
- Reduces core system complexity
- Allows UI-specific validation rules

## Future Enhancements

Potential improvements to consider:

1. **Hook Templates**: Pre-built hooks for common use cases
2. **Hook Chaining**: Support for multiple actions per trigger
3. **Conditional Execution**: Add conditions to when clause
4. **Hook Scheduling**: Time-based triggers
5. **Hook Debugging**: Execution history and logging
6. **Import/Export**: Share hooks between workspaces

## File Service

The `HookFileService` (located in `packages/cli/src/services/hookFileService.ts`) handles reading and writing hook files:

### Loading Hooks

```typescript
import { hookFileService } from '@/services/hookFileService';

// Load hooks from user directory (~/.ollm/hooks/)
const userHooks = await hookFileService.loadUserHooks();

// Load hooks from workspace directory (.ollm/hooks/)
const workspaceHooks = await hookFileService.loadWorkspaceHooks();
```

### Saving Hooks

```typescript
// Save a new hook
await hookFileService.saveHook(uiHook);

// Update an existing hook
await hookFileService.updateHook(hookId, { name: 'New Name' });

// Delete a hook
await hookFileService.deleteHook(hookId);
```

### Validation

```typescript
// Validate hook structure before saving
const validation = hookFileService.validateHook(hookData);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

### Features

- **Graceful Error Handling**: Invalid hooks are skipped with warnings
- **JSON Parsing**: Handles malformed JSON files without crashing
- **Directory Management**: Creates directories as needed
- **Validation**: Comprehensive validation of hook structure
- **Source Tracking**: Distinguishes between user and workspace hooks

## Related Documentation

- [Hook System Overview](../../../../../docs/MCP/hooks/)
- [Hooks Panel UI Design](.kiro/specs/stage-06c-hooks-panel-ui/design.md)
- [Core Hook Types](../../../../../packages/core/src/hooks/types.ts)
- [HookFileService](../../services/hookFileService.ts)
