# Services Module

This module contains the core services for the OLLM CLI, providing session persistence, context management, safety mechanisms, and security features.

## Overview

The services layer is organized into six independent, composable services:

1. **ChatRecordingService** - Session persistence and management
2. **ChatCompressionService** - Message history compression
3. **LoopDetectionService** - Runaway execution detection
4. **ContextManager** - Dynamic context injection
5. **FileDiscoveryService** - Project file scanning
6. **EnvironmentSanitizationService** - Environment variable filtering

## Architecture

Services are designed to be:
- **Independent**: Each service has a single, well-defined responsibility
- **Composable**: Services can be used together or independently
- **Configurable**: Behavior can be customized through configuration
- **Testable**: Clear interfaces enable comprehensive testing

## Shared Types

All services use shared types defined in `types.ts`:

### Session Types
- `SessionMessage` - User/assistant/system messages
- `SessionToolCall` - Tool invocations and results
- `Session` - Complete session with metadata
- `SessionSummary` - Session listing information

### Service Configuration Types
- `CompressionOptions` - Compression strategy configuration
- `LoopDetectionConfig` - Loop detection thresholds
- `ContextEntry` - Dynamic context entries
- `FileEntry` - File discovery results
- `SanitizationConfig` - Environment variable filtering rules

## Testing Infrastructure

### Test Helpers

The `__tests__/test-helpers.ts` file provides:

- **Property-based test generators** using fast-check
- **Validation utilities** for ISO 8601 timestamps and UUIDs
- **Mock data generators** for all service types
- **Token counting utilities** for testing compression

### Test Configuration

All property-based tests:
- Run a minimum of 100 iterations
- Use fast-check library
- Are tagged with: `Feature: services-sessions, Property N: [property text]`

### Running Tests

```bash
# Run all service tests
npm test -- packages/core/src/services

# Run specific test file
npm test -- packages/core/src/services/__tests__/types.test.ts

# Run with coverage
npm test -- --coverage packages/core/src/services
```

## Implementation Status

- [x] Shared types and interfaces
- [x] Test infrastructure with fast-check
- [x] Test helpers and generators
- [ ] ChatRecordingService
- [ ] ChatCompressionService
- [ ] LoopDetectionService
- [ ] ContextManager
- [ ] FileDiscoveryService
- [ ] EnvironmentSanitizationService

## Usage

Services will be exported from the main core package:

```typescript
import {
  // Types
  Session,
  SessionMessage,
  SessionToolCall,
  CompressionOptions,
  LoopDetectionConfig,
  ContextEntry,
  // Services (to be added)
  // ChatRecordingService,
  // ChatCompressionService,
  // etc.
} from '@ollm/ollm-cli-core';
```

## Configuration

Services are configured through the main configuration file:

```yaml
services:
  session:
    dataDir: ~/.ollm/session-data
    maxSessions: 100
    autoSave: true
    
  compression:
    enabled: true
    threshold: 0.8
    strategy: hybrid
    preserveRecent: 4096
    
  loopDetection:
    enabled: true
    maxTurns: 50
    repeatThreshold: 3
    
  fileDiscovery:
    maxDepth: 10
    followSymlinks: false
    
  environment:
    allowList:
      - PATH
      - HOME
      - USER
    denyPatterns:
      - "*_KEY"
      - "*_SECRET"
```

## Design Principles

1. **Type Safety** - All services use TypeScript with strict mode
2. **Error Handling** - Graceful degradation with clear error messages
3. **Performance** - Efficient algorithms and caching where appropriate
4. **Security** - Sensitive data filtering and secure defaults
5. **Testability** - Property-based testing for correctness guarantees

## References

- [Requirements Document](../../../../.kiro/specs/stage-04-services-sessions/requirements.md)
- [Design Document](../../../../.kiro/specs/stage-04-services-sessions/design.md)
- [Implementation Tasks](../../../../.kiro/specs/stage-04-services-sessions/tasks.md)
