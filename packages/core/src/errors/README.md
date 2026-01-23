# Error Handling System

This directory contains the centralized error handling system for OLLM CLI.

## Overview

The error handling system provides:

1. **Custom Error Classes**: Specific error types for different error categories
2. **Type-Safe Handling**: TypeScript type guards and utilities
3. **Structured Context**: All errors include relevant context for debugging
4. **Helper Utilities**: Common error handling patterns

## Error Classes

### Base Error

```typescript
import { OllmError } from '@ollm/ollm-cli-core/errors/index.js';

throw new OllmError(
  'Something went wrong',
  'CUSTOM_ERROR_CODE',
  { additionalContext: 'value' }
);
```

### File System Errors

```typescript
import { FileSystemError } from '@ollm/ollm-cli-core/errors/index.js';

throw new FileSystemError(
  'Failed to read file',
  'read',
  '/path/to/file',
  originalError
);
```

### Configuration Errors

```typescript
import { ConfigError } from '@ollm/ollm-cli-core/errors/index.js';

throw new ConfigError(
  'Invalid configuration',
  '/path/to/config.yaml',
  10, // line number
  5   // column number
);
```

### Provider Errors

```typescript
import { ProviderError } from '@ollm/ollm-cli-core/errors/index.js';

throw new ProviderError(
  'Cannot connect to provider',
  'ollama',
  'http://localhost:11434',
  originalError
);
```

### Model Errors

```typescript
import { ModelError } from '@ollm/ollm-cli-core/errors/index.js';

throw new ModelError(
  'Model not found',
  'llama3.2',
  'load',
  originalError
);
```

### Workspace Boundary Errors

```typescript
import { WorkspaceBoundaryError } from '@ollm/ollm-cli-core/errors/index.js';

throw new WorkspaceBoundaryError(
  'Access denied',
  '/attempted/path',
  '/workspace/path',
  ['/workspace/path', '~/.ollm']
);
```

### Tool Execution Errors

```typescript
import { ToolExecutionError } from '@ollm/ollm-cli-core/errors/index.js';

throw new ToolExecutionError(
  'Tool execution failed',
  'write_file',
  { path: '/file.txt', content: 'data' },
  originalError
);
```

### Validation Errors

```typescript
import { ValidationError } from '@ollm/ollm-cli-core/errors/index.js';

throw new ValidationError(
  'Invalid value',
  'timeout',
  '30s',
  'positive number'
);
```

### Timeout Errors

```typescript
import { TimeoutError } from '@ollm/ollm-cli-core/errors/index.js';

throw new TimeoutError(
  'Operation timed out',
  'fetch',
  30000
);
```

### Abort Errors

```typescript
import { AbortError } from '@ollm/ollm-cli-core/errors/index.js';

throw new AbortError(
  'Operation cancelled',
  'processFile'
);
```

## Helper Utilities

### Handle File System Errors

```typescript
import { handleFileSystemError } from '@ollm/ollm-cli-core/errors/errorHandlers.js';

const content = await handleFileSystemError(
  'read',
  '/path/to/file',
  async () => await fs.readFile('/path/to/file', 'utf-8')
);
```

### Handle JSON Parsing

```typescript
import { handleJSONParseError } from '@ollm/ollm-cli-core/errors/errorHandlers.js';

const config = handleJSONParseError<Config>(
  content,
  '/path/to/config.json'
);
```

### Handle Provider Errors

```typescript
import { handleProviderError } from '@ollm/ollm-cli-core/errors/errorHandlers.js';

const response = await handleProviderError(
  'ollama',
  'http://localhost:11434',
  async () => await fetch('http://localhost:11434/api/generate')
);
```

### With Timeout

```typescript
import { withTimeout } from '@ollm/ollm-cli-core/errors/errorHandlers.js';

const result = await withTimeout(
  'fetchData',
  30000,
  async () => await fetchData()
);
```

### Check Aborted

```typescript
import { checkAborted } from '@ollm/ollm-cli-core/errors/errorHandlers.js';

async function processFile(path: string, signal?: AbortSignal) {
  checkAborted(signal, 'processFile');
  
  // ... do work
  
  checkAborted(signal, 'processFile');
}
```

### With Retry

```typescript
import { withRetry } from '@ollm/ollm-cli-core/errors/errorHandlers.js';

const result = await withRetry(
  'fetchData',
  async () => await fetchData(),
  {
    maxRetries: 3,
    initialDelayMs: 1000,
    shouldRetry: (error) => {
      // Only retry on network errors
      return error instanceof ProviderError;
    }
  }
);
```

### With Fallback

```typescript
import { withFallback } from '@ollm/ollm-cli-core/errors/errorHandlers.js';

const config = await withFallback(
  async () => await loadConfig('/path/to/config.yaml'),
  defaultConfig,
  (error) => logger.warn('Failed to load config, using default', { error })
);
```

### Collect Errors

```typescript
import { collectErrors } from '@ollm/ollm-cli-core/errors/errorHandlers.js';

const { results, errors } = await collectErrors([
  async () => await validateFile('file1.txt'),
  async () => await validateFile('file2.txt'),
  async () => await validateFile('file3.txt'),
], true); // continue on error

if (errors.length > 0) {
  console.error(`${errors.length} validation errors occurred`);
}
```

## Type Guards

### Check if OllmError

```typescript
import { isOllmError } from '@ollm/ollm-cli-core/errors/index.js';

try {
  // ... operation
} catch (error) {
  if (isOllmError(error)) {
    console.error(`Error code: ${error.code}`);
    console.error(`Context:`, error.context);
  }
}
```

### Check if Node Error

```typescript
import { isNodeError } from '@ollm/ollm-cli-core/errors/index.js';

try {
  // ... file operation
} catch (error) {
  if (isNodeError(error)) {
    if (error.code === 'ENOENT') {
      console.error('File not found');
    }
  }
}
```

## Error Context

All errors include structured context that can be used for logging and debugging:

```typescript
try {
  // ... operation
} catch (error) {
  if (isOllmError(error)) {
    logger.error('Operation failed', {
      code: error.code,
      context: error.context,
      message: error.message,
      stack: error.stack,
    });
  }
}
```

## Best Practices

1. **Always use custom error classes** instead of generic `Error`
2. **Include relevant context** in error messages
3. **Handle specific error codes** (e.g., ENOENT, EACCES)
4. **Use type guards** for type-safe error handling
5. **Log errors with context** for debugging
6. **Provide actionable error messages** to users
7. **Use helper utilities** for common patterns
8. **Test error handling** in unit tests

## Migration Guide

### Before

```typescript
try {
  await fs.writeFile(path, content);
} catch (err) {
  console.error(err);
  throw new Error('Failed to write file');
}
```

### After

```typescript
import { handleFileSystemError } from '@ollm/ollm-cli-core/errors/errorHandlers.js';

await handleFileSystemError(
  'write',
  path,
  async () => await fs.writeFile(path, content)
);
```

## Examples

See `.dev/audits/error-handling-patterns.md` for comprehensive examples and patterns.
