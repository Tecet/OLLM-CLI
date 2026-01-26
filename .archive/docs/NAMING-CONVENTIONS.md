# OLLM CLI - Naming Conventions

**Version**: 1.0.0  
**Last Updated**: January 23, 2026  
**Status**: Official Standard

## Overview

This document defines the official naming conventions for the OLLM CLI project. All code must follow these conventions to ensure consistency and maintainability.

## Table of Contents

1. [File Naming](#file-naming)
2. [Function Naming](#function-naming)
3. [Variable Naming](#variable-naming)
4. [Type and Interface Naming](#type-and-interface-naming)
5. [Class Naming](#class-naming)
6. [Module and Package Naming](#module-and-package-naming)
7. [Test File Naming](#test-file-naming)
8. [Examples](#examples)
9. [ESLint Rules](#eslint-rules)

---

## File Naming

### Components (React/Ink)

**Convention**: PascalCase with `.tsx` extension

```
✅ Good:
- ChatTab.tsx
- FileExplorerComponent.tsx
- WindowContainer.tsx
- LoadingSpinner.tsx

❌ Bad:
- chatTab.tsx
- file-explorer-component.tsx
- window_container.tsx
```

**Rule**: Component files must match the component name exactly.

### Services

**Convention**: camelCase with `.ts` extension

```
✅ Good:
- contextManager.ts
- hookRegistry.ts
- fileTreeService.ts
- compressionService.ts

❌ Bad:
- ContextManager.ts
- hook-registry.ts
- file_tree_service.ts
```

**Rule**: Service files contain business logic and should use camelCase.

### Utilities

**Convention**: camelCase with `.ts` extension

```
✅ Good:
- keyUtils.ts
- errorLogger.ts
- gitignoreUtils.ts
- outputHelpers.ts

❌ Bad:
- KeyUtils.ts
- error-logger.ts
- gitignore_utils.ts
```

**Rule**: Utility files contain helper functions and should use camelCase.

### Configuration Files

**Convention**: camelCase with `.ts` extension

```
✅ Good:
- defaults.ts
- schema.ts
- themes.ts
- keybinds.ts

❌ Bad:
- Defaults.ts
- Schema.ts
- themes.config.ts
```

**Rule**: Configuration files should use camelCase.

### Type Definition Files

**Convention**: camelCase with `.ts` or `.d.ts` extension

```
✅ Good:
- types.ts
- types.d.ts
- contextManager.d.ts

❌ Bad:
- Types.ts
- TYPES.ts
- types.definition.ts
```

**Rule**: Type definition files should match their source file name.

---

## Function Naming

### Exported Functions

**Convention**: camelCase

```typescript
✅ Good:
export function createTestMessage(message: string): string { }
export function getServerUrl(): string { }
export function isServerAvailable(): Promise<boolean> { }

❌ Bad:
export function CreateTestMessage(message: string): string { }
export function get_server_url(): string { }
export function IsServerAvailable(): Promise<boolean> { }
```

**Rule**: All exported functions use camelCase.

### React Components

**Convention**: PascalCase

```typescript
✅ Good:
export function ChatTab(props: ChatTabProps) { }
export function FileExplorer() { }
export const WindowContainer: React.FC<Props> = () => { }

❌ Bad:
export function chatTab(props: ChatTabProps) { }
export function file_explorer() { }
export const windowContainer: React.FC<Props> = () => { }
```

**Rule**: React components always use PascalCase.

### Class Methods

**Convention**: camelCase

```typescript
✅ Good:
class MockProvider {
  chatStream(request: ProviderRequest) { }
  countTokens(text: string) { }
  listModels() { }
}

❌ Bad:
class MockProvider {
  ChatStream(request: ProviderRequest) { }
  count_tokens(text: string) { }
  ListModels() { }
}
```

**Rule**: All class methods use camelCase.

### Event Handlers

**Convention**: handleCamelCase prefix

```typescript
✅ Good:
const handleWindowChange = () => { };
const handleKeyPress = (key: string) => { };
const handleSubmit = () => { };

❌ Bad:
const windowChange = () => { };
const onKeyPress = (key: string) => { };
const submit = () => { };
```

**Rule**: Event handlers should be prefixed with `handle`.

### Private Functions

**Convention**: camelCase (no underscore prefix)

```typescript
✅ Good:
class Service {
  private processData() { }
  private validateInput() { }
}

❌ Bad:
class Service {
  private _processData() { }
  private _validateInput() { }
}
```

**Rule**: Modern TypeScript uses `private` keyword, not underscore prefix.

---

## Variable Naming

### Constants (Primitive Values)

**Convention**: UPPER_SNAKE_CASE

```typescript
✅ Good:
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;
const API_VERSION = '1.0.0';

❌ Bad:
const maxRetries = 3;
const defaultTimeout = 5000;
const apiVersion = '1.0.0';
```

**Rule**: True constants (primitive values that never change) use UPPER_SNAKE_CASE.

### Constants (Complex Objects)

**Convention**: camelCase

```typescript
✅ Good:
const mockTheme = { name: 'test', colors: { ... } };
const defaultConfig = { timeout: 5000, retries: 3 };
const fixtureMessages = [{ role: 'user', content: '...' }];

❌ Bad:
const MOCK_THEME = { name: 'test', colors: { ... } };
const DEFAULT_CONFIG = { timeout: 5000, retries: 3 };
const FIXTURE_MESSAGES = [{ role: 'user', content: '...' }];
```

**Rule**: Complex objects/arrays that are readonly use camelCase.

### Regular Variables

**Convention**: camelCase

```typescript
✅ Good:
const activeWindow = 'chat';
const focusManager = useFocusManager();
let messageCount = 0;

❌ Bad:
const ActiveWindow = 'chat';
const focus_manager = useFocusManager();
let MessageCount = 0;
```

**Rule**: All regular variables use camelCase.

### Boolean Variables

**Convention**: is/has/should/can prefix + camelCase

```typescript
✅ Good:
const isActive = true;
const hasError = false;
const shouldRender = true;
const canSubmit = false;

❌ Bad:
const active = true;
const error = false;
const render = true;
const submit = false;
```

**Rule**: Boolean variables should have a descriptive prefix.

### Private Variables

**Convention**: camelCase (no underscore prefix)

```typescript
✅ Good:
class Service {
  private config: Config;
  private state: State;
}

❌ Bad:
class Service {
  private _config: Config;
  private _state: State;
}
```

**Rule**: Use TypeScript's `private` keyword, not underscore prefix.

---

## Type and Interface Naming

### Interfaces

**Convention**: PascalCase

```typescript
✅ Good:
interface ServerDetection { }
interface TestExecutionResult { }
interface MockProviderConfig { }

❌ Bad:
interface serverDetection { }
interface testExecutionResult { }
interface mockProviderConfig { }
```

**Rule**: All interfaces use PascalCase.

### Types

**Convention**: PascalCase

```typescript
✅ Good:
type WindowType = 'chat' | 'terminal' | 'editor';
type MessageRole = 'user' | 'assistant' | 'system';
type ProviderEvent = TextEvent | ToolCallEvent;

❌ Bad:
type windowType = 'chat' | 'terminal' | 'editor';
type messageRole = 'user' | 'assistant' | 'system';
type providerEvent = TextEvent | ToolCallEvent;
```

**Rule**: All type aliases use PascalCase.

### Enums

**Convention**: PascalCase for enum name, PascalCase for members

```typescript
✅ Good:
enum FocusLevel {
  TopLevel = 1,
  TabContent = 2,
  Modal = 3,
}

❌ Bad:
enum focusLevel {
  topLevel = 1,
  tabContent = 2,
  modal = 3,
}
```

**Rule**: Enums and their members use PascalCase.

### Generic Type Parameters

**Convention**: Single uppercase letter or PascalCase

```typescript
✅ Good:
function identity<T>(value: T): T { }
function map<TInput, TOutput>(fn: (input: TInput) => TOutput) { }

❌ Bad:
function identity<t>(value: t): t { }
function map<input, output>(fn: (input: input) => output) { }
```

**Rule**: Generic type parameters use single uppercase letters or descriptive PascalCase.

---

## Class Naming

### Classes

**Convention**: PascalCase

```typescript
✅ Good:
class MockProvider { }
class CompressionService { }
class FileTreeService { }

❌ Bad:
class mockProvider { }
class compressionService { }
class fileTreeService { }
```

**Rule**: All classes use PascalCase.

### Abstract Classes

**Convention**: PascalCase (optionally prefix with `Abstract`)

```typescript
✅ Good:
abstract class BaseProvider { }
abstract class AbstractService { }

❌ Bad:
abstract class baseProvider { }
abstract class abstractService { }
```

**Rule**: Abstract classes use PascalCase, optionally with `Abstract` prefix.

---

## Module and Package Naming

### Package Names

**Convention**: kebab-case with `@ollm/` scope

```
✅ Good:
@ollm/cli
@ollm/ollm-cli-core
@ollm/ollm-bridge
@ollm/test-utils

❌ Bad:
@ollm/CLI
@ollm/ollm_cli_core
@ollm/OllmBridge
```

**Rule**: Package names use kebab-case with lowercase letters.

### Directory Names

**Convention**: kebab-case

```
✅ Good:
packages/cli/
packages/ollm-bridge/
packages/test-utils/

❌ Bad:
packages/CLI/
packages/ollm_bridge/
packages/TestUtils/
```

**Rule**: Directory names use kebab-case.

---

## Test File Naming

### Unit Test Files

**Convention**: Match source file name + `.test.ts` or `.test.tsx`

```
✅ Good:
contextManager.ts → contextManager.test.ts
ChatTab.tsx → ChatTab.test.tsx
mockProvider.ts → mockProvider.test.ts

❌ Bad:
contextManager.ts → context-manager.test.ts
ChatTab.tsx → chat-tab.test.tsx
mockProvider.ts → MockProvider.test.ts
```

**Rule**: Test files match their source file naming convention.

### Integration Test Files

**Convention**: descriptive name + `.integration.test.ts`

```
✅ Good:
streaming.integration.test.ts
modelManagement.integration.test.ts
mcpMarketplace.integration.test.ts

❌ Bad:
streaming-integration.test.ts
model-management.integration.test.ts
MCPMarketplace.integration.test.ts
```

**Rule**: Integration tests use camelCase with `.integration.test.ts` suffix.

### Performance Test Files

**Convention**: source file name + `.performance.test.ts`

```
✅ Good:
compressionService.performance.test.ts
contextManager.performance.test.ts
FileTreeService.performance.test.ts

❌ Bad:
compression-service.performance.test.ts
context-manager.performance.test.ts
file-tree-service.performance.test.ts
```

**Rule**: Performance tests match source file naming.

---

## Examples

### Complete File Example

```typescript
// File: packages/core/src/services/contextManager.ts

// Constants (primitive)
const MAX_CONTEXT_SIZE = 128000;
const DEFAULT_COMPRESSION_RATIO = 0.5;

// Constants (complex)
const defaultConfig = {
  maxSize: MAX_CONTEXT_SIZE,
  compressionRatio: DEFAULT_COMPRESSION_RATIO,
};

// Interface
interface ContextManagerConfig {
  maxSize: number;
  compressionRatio: number;
}

// Type
type CompressionStrategy = 'sliding-window' | 'semantic' | 'hybrid';

// Class
export class ContextManager {
  private config: ContextManagerConfig;
  private currentSize: number;
  
  constructor(config: ContextManagerConfig) {
    this.config = config;
    this.currentSize = 0;
  }
  
  // Public method
  public addMessage(message: string): void {
    this.currentSize += message.length;
    this.checkCompression();
  }
  
  // Private method
  private checkCompression(): void {
    if (this.shouldCompress()) {
      this.compress();
    }
  }
  
  // Boolean method
  private shouldCompress(): boolean {
    return this.currentSize > this.config.maxSize;
  }
  
  // Private method
  private compress(): void {
    // Implementation
  }
}

// Exported function
export function createContextManager(
  config?: Partial<ContextManagerConfig>
): ContextManager {
  return new ContextManager({ ...defaultConfig, ...config });
}

// Exported utility function
export function calculateCompressionRatio(
  original: number,
  compressed: number
): number {
  return compressed / original;
}
```

### React Component Example

```typescript
// File: packages/cli/src/ui/components/tabs/ChatTab.tsx

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';

// Interface
interface ChatTabProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
}

// Component
export function ChatTab({ messages, onSendMessage }: ChatTabProps) {
  // State variables
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Event handler
  const handleSubmit = useCallback(() => {
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  }, [inputValue, onSendMessage]);
  
  // Event handler
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);
  
  return (
    <Box flexDirection="column">
      {/* Component JSX */}
    </Box>
  );
}
```

---

## ESLint Rules

### Recommended ESLint Configuration

```javascript
// eslint.config.js
export default [
  {
    rules: {
      // Enforce camelCase for variables and functions
      'camelcase': ['error', {
        properties: 'never',
        ignoreDestructuring: false,
      }],
      
      // Enforce PascalCase for classes and interfaces
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'], // PascalCase for React components
        },
      ],
      
      // Enforce consistent file naming
      'unicorn/filename-case': ['error', {
        cases: {
          camelCase: true,
          pascalCase: true,
        },
      }],
    },
  },
];
```

---

## Enforcement

### Code Review Checklist

- [ ] File names follow conventions
- [ ] Function names follow conventions
- [ ] Variable names follow conventions
- [ ] Type/Interface names follow conventions
- [ ] Class names follow conventions
- [ ] Test file names match source files
- [ ] No inconsistent naming patterns

### Automated Checks

1. **ESLint**: Run `npm run lint` to check naming conventions
2. **TypeScript**: Compiler will catch some naming issues
3. **Pre-commit Hooks**: Enforce naming conventions before commit

### Migration Strategy

For existing code that doesn't follow conventions:

1. Create a tracking issue for each file that needs renaming
2. Rename files in batches to minimize merge conflicts
3. Update all imports after each batch
4. Run tests to verify no breakage
5. Update documentation

---

## References

- [TypeScript Coding Guidelines](https://github.com/Microsoft/TypeScript/wiki/Coding-guidelines)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [React Naming Conventions](https://react.dev/learn/naming-conventions)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-23 | 1.0.0 | Initial naming conventions document |

---

**Note**: This document is the official standard for the OLLM CLI project. All new code must follow these conventions, and existing code should be migrated over time.
