# Logging Conventions

**Version**: 1.0.0  
**Status**: ✅ Complete  
**Created**: January 23, 2026

## Overview

This document defines the logging conventions for the OLLM CLI project. All production code should use the structured logger utility instead of direct console methods.

## Logger Infrastructure

### Logger Utility

Location: `packages/core/src/utils/logger.ts`

The logger provides structured logging with configurable log levels:

```typescript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ModuleName');

logger.debug('Debug message', { key: 'value' });
logger.info('Info message', { key: 'value' });
logger.warn('Warning message', { key: 'value' });
logger.error('Error message', { key: 'value' });
```

### Log Levels

| Level   | Priority | Usage                                                      |
|---------|----------|-------------------------------------------------------------|
| `debug` | 0        | Detailed diagnostic information for debugging               |
| `info`  | 1        | General informational messages (default level)              |
| `warn`  | 2        | Warning messages for potentially problematic situations     |
| `error` | 3        | Error messages for failures and exceptions                  |

### Environment Configuration

Log level is controlled by the `OLLM_LOG_LEVEL` environment variable:

```bash
# Set log level
export OLLM_LOG_LEVEL=debug  # Show all logs
export OLLM_LOG_LEVEL=info   # Show info, warn, error (default)
export OLLM_LOG_LEVEL=warn   # Show warn, error only
export OLLM_LOG_LEVEL=error  # Show error only
```

## Logging Guidelines

### 1. Use Structured Logging

**DO:**
```typescript
logger.info('User authenticated', { 
  userId: user.id, 
  method: 'oauth' 
});
```

**DON'T:**
```typescript
console.log(`User ${user.id} authenticated via oauth`);
```

### 2. Choose Appropriate Log Levels

#### Debug Level
Use for detailed diagnostic information:
- Function entry/exit
- Variable values during execution
- Detailed state changes
- Performance metrics

```typescript
logger.debug('Processing request', { 
  requestId, 
  method: 'POST', 
  path: '/api/chat' 
});
```

#### Info Level
Use for general informational messages:
- Application startup/shutdown
- Configuration loaded
- Major state transitions
- Successful operations

```typescript
logger.info('MCP server connected', { 
  serverName: 'filesystem', 
  transport: 'stdio' 
});
```

#### Warn Level
Use for potentially problematic situations:
- Deprecated feature usage
- Fallback to default behavior
- Recoverable errors
- Performance degradation

```typescript
logger.warn('Token count estimation fallback', { 
  model: 'llama2', 
  reason: 'tiktoken failed' 
});
```

#### Error Level
Use for error conditions:
- Exceptions and failures
- Connection errors
- Invalid input
- Unrecoverable errors

```typescript
logger.error('Failed to connect to MCP server', { 
  serverName: 'filesystem', 
  error: error.message 
});
```

### 3. Include Contextual Metadata

Always include relevant context in the metadata object:

```typescript
// Good - includes context
logger.error('File operation failed', {
  operation: 'write',
  path: filePath,
  error: error.message
});

// Bad - missing context
logger.error('File operation failed');
```

### 4. Sanitize Sensitive Data

Never log sensitive information:

```typescript
// Bad - logs sensitive data
logger.info('User login', { 
  username, 
  password // NEVER LOG PASSWORDS
});

// Good - sanitizes sensitive data
logger.info('User login', { 
  username, 
  passwordLength: password.length 
});
```

### 5. Use Consistent Logger Names

Logger names should follow the module structure:

```typescript
// For services
const logger = createLogger('ContextManager');
const logger = createLogger('MCPClient');

// For transports
const logger = createLogger('StdioTransport');
const logger = createLogger('SSETransport');

// For utilities
const logger = createLogger('TokenCounter');
const logger = createLogger('FileDiscovery');
```

### 6. Test Environment Considerations

In test environments, logs are automatically suppressed unless explicitly enabled:

```typescript
// Logger respects OLLM_LOG_LEVEL in tests
// Set OLLM_LOG_LEVEL=debug in tests to see logs
```

For test-specific output, use console methods directly in test files only:

```typescript
// In test files only
describe('MyFeature', () => {
  it('should work', () => {
    console.log('Test-specific output'); // OK in tests
    // ...
  });
});
```

## Migration from Console Methods

### Before (Console Methods)

```typescript
console.log('Server started');
console.error('Connection failed:', error);
console.warn('Deprecated feature used');
console.debug('Variable value:', value);
```

### After (Structured Logger)

```typescript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ServerManager');

logger.info('Server started');
logger.error('Connection failed', { error: error.message });
logger.warn('Deprecated feature used');
logger.debug('Variable value', { value });
```

## Special Cases

### 1. Test Files

Test files can use console methods directly for test output:

```typescript
// In *.test.ts files
describe('Feature', () => {
  it('should work', () => {
    console.log('Test output'); // OK
  });
});
```

### 2. Scripts

Utility scripts in `scripts/` can use console methods:

```typescript
// In scripts/build.js
console.log('Building project...');
```

### 3. CLI Output

User-facing CLI output should NOT use the logger:

```typescript
// For user-facing output, use console directly
console.log('Welcome to OLLM CLI');
console.error('Error: Invalid command');
```

The logger is for internal diagnostics, not user-facing messages.

### 4. Conditional Logging in Production

For logs that should only appear in non-test environments:

```typescript
// Before
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  console.error('Error message');
}

// After - logger handles this automatically
logger.error('Error message');
```

## Logger Format

The logger outputs messages in the following format:

```
[2026-01-23T10:30:45.123Z] [INFO] [ModuleName] Message text {"key":"value"}
```

Components:
- Timestamp (ISO 8601)
- Log level (uppercase)
- Logger name
- Message text
- Metadata (JSON)

## Performance Considerations

### 1. Lazy Evaluation

For expensive operations, use lazy evaluation:

```typescript
// Bad - always computes even if debug is disabled
logger.debug('State', { state: JSON.stringify(largeObject) });

// Good - only computes if debug is enabled
if (getLogLevel() === 'debug') {
  logger.debug('State', { state: JSON.stringify(largeObject) });
}
```

### 2. Avoid Logging in Hot Paths

Minimize logging in performance-critical code:

```typescript
// Bad - logs on every iteration
for (const item of items) {
  logger.debug('Processing item', { item });
  processItem(item);
}

// Good - logs summary
logger.debug('Processing items', { count: items.length });
for (const item of items) {
  processItem(item);
}
```

## Audit Results

### Current State

✅ **Logger utility exists**: `packages/core/src/utils/logger.ts`  
✅ **No console usage in production code**: All production code uses logger  
✅ **Consistent log levels**: Logger provides debug, info, warn, error  
✅ **Environment configuration**: OLLM_LOG_LEVEL controls verbosity  

### Files Using Logger

- `packages/ollm-bridge/src/provider/localProvider.ts` - Uses logger correctly
- `packages/core/src/mcp/mcpClient.ts` - Has 1 console.error (needs migration)
- `packages/core/src/mcp/mcpTransport.ts` - Has multiple console methods (needs migration)
- `packages/test-utils/src/testHelpers.ts` - Has console.log (OK - test utility)

### Migration Needed

1. ✅ `packages/core/src/mcp/mcpClient.ts` - Replace console.error with logger
2. ✅ `packages/core/src/mcp/mcpTransport.ts` - Replace console methods with logger

## Examples

### Example 1: Service Initialization

```typescript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ContextManager');

export class ContextManager {
  constructor(config: ContextConfig) {
    logger.info('Context manager initialized', {
      maxTokens: config.maxTokens,
      compressionEnabled: config.compressionEnabled
    });
  }
}
```

### Example 2: Error Handling

```typescript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('FileService');

export async function readFile(path: string): Promise<string> {
  try {
    logger.debug('Reading file', { path });
    const content = await fs.readFile(path, 'utf-8');
    logger.debug('File read successfully', { path, size: content.length });
    return content;
  } catch (error) {
    logger.error('Failed to read file', {
      path,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
```

### Example 3: Performance Monitoring

```typescript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('CompressionService');

export async function compress(data: string): Promise<string> {
  const startTime = Date.now();
  logger.debug('Starting compression', { size: data.length });
  
  const result = await performCompression(data);
  
  const duration = Date.now() - startTime;
  logger.info('Compression completed', {
    originalSize: data.length,
    compressedSize: result.length,
    ratio: (result.length / data.length).toFixed(2),
    durationMs: duration
  });
  
  return result;
}
```

## Summary

- ✅ Use `createLogger()` for all production code
- ✅ Choose appropriate log levels (debug, info, warn, error)
- ✅ Include contextual metadata in all log calls
- ✅ Sanitize sensitive data before logging
- ✅ Use consistent logger names based on module structure
- ✅ Console methods are OK in tests and scripts only
- ✅ Logger respects OLLM_LOG_LEVEL environment variable

## References

- Logger Implementation: `packages/core/src/utils/logger.ts`
- Environment Variables: See `tech.md` steering file
- Error Handling: See `.dev/audits/error-handling-patterns.md`
