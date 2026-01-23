# Import Conventions

**Last Updated**: January 23, 2026  
**Status**: ✅ Active

## Overview

This document defines the standardized import patterns for the OLLM CLI codebase. Following these conventions ensures consistency, readability, and maintainability across all TypeScript and JavaScript files.

## Import Order

All imports must follow this strict order with blank lines between each group:

```typescript
// 1. Node built-ins
import * as fs from 'fs';
import * as path from 'path';

// 2. External dependencies (npm packages)
import { useState, useCallback } from 'react';
import { Box, Text } from 'ink';

// 3. Internal dependencies (@ollm/* packages and relative imports)
import { createContextManager } from '@ollm/core';

import { useUI } from '../features/context/UIContext.js';
import { WindowIndicator } from './WindowIndicator.js';

// 4. Type imports (always separate, always use `import type`)
import type { Theme, WindowConfig } from '../config/types.js';
import type { ProviderAdapter } from '@ollm/core';
```

## Detailed Rules

### 1. Node Built-ins (Group 1)

**Rule**: Import Node.js built-in modules first, before any external dependencies.

**Format**:
- Use namespace imports: `import * as fs from 'fs'`
- Exception: When only using one export, use named import: `import { promises as fs } from 'fs'`
- Sort alphabetically within the group

**Examples**:
```typescript
// ✅ Good
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ✅ Also good (when only using one export)
import { promises as fs } from 'fs';
import * as path from 'path';

// ❌ Bad (mixed with external dependencies)
import * as fs from 'fs';
import { Box } from 'ink';
import * as path from 'path';
```

### 2. External Dependencies (Group 2)

**Rule**: Import npm packages after Node built-ins, with React/Ink prioritized.

**Format**:
- React imports come first
- Ink imports come second
- Other npm packages sorted alphabetically
- Use destructured imports for specific exports

**Examples**:
```typescript
// ✅ Good
import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { glob } from 'glob';
import ignoreFactory from 'ignore';

// ❌ Bad (not sorted, React not first)
import { glob } from 'glob';
import { Box } from 'ink';
import React from 'react';
```

### 3. Internal Dependencies (Group 3)

**Rule**: Import workspace packages (@ollm/*) and relative imports after external dependencies.

**Format**:
- @ollm/* packages first, sorted alphabetically
- Relative imports second, sorted by path depth then alphabetically
- Always include `.js` extension for relative imports

**Examples**:
```typescript
// ✅ Good
import { createContextManager, MemoryLevel } from '@ollm/core';
import { MockProvider } from '@ollm/test-utils';

import { commandRegistry } from '../../commands/index.js';
import { SettingsService } from '../../config/settingsService.js';
import { useContextManager } from './ContextManagerContext.js';
import { WindowIndicator } from './WindowIndicator.js';

// ❌ Bad (missing .js, not sorted)
import { WindowIndicator } from './WindowIndicator';
import { createContextManager } from '@ollm/core';
import { useContextManager } from './ContextManagerContext.js';
```

### 4. Type Imports (Group 4)

**Rule**: Always use `import type` syntax and group all type imports together at the end.

**Format**:
- Use `import type` for type-only imports
- Never mix type and value imports in the same statement
- Sort alphabetically by module name

**Examples**:
```typescript
// ✅ Good
import type { Theme, WindowConfig } from '../config/types.js';
import type { ProviderAdapter, Message } from '@ollm/core';

// ❌ Bad (mixed with value imports)
import { createContextManager, type MemoryLevel } from '@ollm/core';

// ❌ Bad (not using import type)
import { Theme, WindowConfig } from '../config/types.js';
```

## File Extensions

**Rule**: Always include `.js` extension for relative imports in TypeScript files.

**Rationale**: TypeScript will resolve to `.ts` files during compilation, but ES modules require explicit extensions.

**Examples**:
```typescript
// ✅ Good
import { WindowIndicator } from './WindowIndicator.js';
import { useUI } from '../features/context/UIContext.js';

// ❌ Bad (missing extension)
import { WindowIndicator } from './WindowIndicator';
import { useUI } from '../features/context/UIContext';
```

## Alphabetical Sorting

**Rule**: Within each group, sort imports alphabetically by module name (case-insensitive).

**Examples**:
```typescript
// ✅ Good
import { Box, Text } from 'ink';
import { glob } from 'glob';
import ignoreFactory from 'ignore';
import picomatch from 'picomatch';

// ❌ Bad (not sorted)
import { glob } from 'glob';
import picomatch from 'picomatch';
import { Box, Text } from 'ink';
import ignoreFactory from 'ignore';
```

## Blank Lines

**Rule**: Always include a blank line between import groups. No blank lines within groups.

**Examples**:
```typescript
// ✅ Good
import * as fs from 'fs';
import * as path from 'path';

import { Box, Text } from 'ink';

import { useUI } from './UIContext.js';

import type { Theme } from '../types.js';

// ❌ Bad (no blank lines between groups)
import * as fs from 'fs';
import { Box, Text } from 'ink';
import { useUI } from './UIContext.js';
import type { Theme } from '../types.js';

// ❌ Bad (blank lines within groups)
import * as fs from 'fs';

import * as path from 'path';
```

## Special Cases

### Conditional Imports

For dynamic imports or conditional requires, place them at the end of the file or within the function where they're used:

```typescript
// ✅ Good (at end of file)
async function loadProvider() {
  const { LocalProvider } = await import('@ollm/bridge');
  return new LocalProvider();
}

// ✅ Good (within function)
function requireModule() {
  const module = require('./legacy-module');
  return module;
}
```

### Side-Effect Imports

For imports that have side effects (e.g., polyfills), place them at the very top before all other imports:

```typescript
// ✅ Good
import 'reflect-metadata'; // Side-effect import

import * as fs from 'fs';
import { Box } from 'ink';
```

### Re-exports

For barrel files (index.ts) that re-export modules, follow the same ordering rules:

```typescript
// ✅ Good (index.ts)
export { WindowContainer } from './WindowContainer.js';
export { WindowIndicator } from './WindowIndicator.js';
export { WindowSwitcher } from './WindowSwitcher.js';

export type { WindowConfig, WindowType } from './types.js';
```

## ESLint Configuration

The import ordering rules are enforced by ESLint using `eslint-plugin-import`:

```javascript
// eslint.config.js
{
  rules: {
    'import/order': ['error', {
      'groups': [
        'builtin',      // Node built-ins
        'external',     // npm packages
        'internal',     // @ollm/* packages
        ['parent', 'sibling'],  // ../ and ./
        'type',         // import type
      ],
      'pathGroups': [
        {
          'pattern': 'react',
          'group': 'external',
          'position': 'before',
        },
        {
          'pattern': 'ink',
          'group': 'external',
          'position': 'before',
        },
        {
          'pattern': '@ollm/**',
          'group': 'internal',
        },
      ],
      'newlines-between': 'always',
      'alphabetize': {
        'order': 'asc',
        'caseInsensitive': true,
      },
    }],
    'import/no-duplicates': 'error',
    'import/first': 'error',
    'import/newline-after-import': 'error',
  },
}
```

## Automated Fixing

To automatically fix import ordering issues:

```bash
# Fix all files
npm run lint -- --fix

# Fix specific file
npx eslint path/to/file.ts --fix
```

## Migration Guide

When updating existing files to follow these conventions:

1. **Run ESLint with --fix**: This will automatically fix most issues
   ```bash
   npm run lint -- --fix
   ```

2. **Review remaining issues**: Some issues require manual intervention
   - Duplicate imports from the same module
   - Mixed type and value imports
   - Missing `.js` extensions

3. **Test after changes**: Ensure the code still compiles and runs
   ```bash
   npm run build
   npm test
   ```

## Common Mistakes

### Mistake 1: Missing .js Extension

```typescript
// ❌ Bad
import { useUI } from './UIContext';

// ✅ Good
import { useUI } from './UIContext.js';
```

### Mistake 2: Mixed Type and Value Imports

```typescript
// ❌ Bad
import { createContextManager, type MemoryLevel } from '@ollm/core';

// ✅ Good
import { createContextManager } from '@ollm/core';

import type { MemoryLevel } from '@ollm/core';
```

### Mistake 3: Duplicate Imports

```typescript
// ❌ Bad
import { createContextManager } from '@ollm/core';
import { MemoryLevel } from '@ollm/core';

// ✅ Good
import { createContextManager, MemoryLevel } from '@ollm/core';
```

### Mistake 4: Wrong Group Order

```typescript
// ❌ Bad
import { Box } from 'ink';
import * as fs from 'fs';
import { useUI } from './UIContext.js';

// ✅ Good
import * as fs from 'fs';

import { Box } from 'ink';

import { useUI } from './UIContext.js';
```

## Benefits

Following these conventions provides:

1. **Consistency**: All files follow the same pattern
2. **Readability**: Easy to scan and understand dependencies
3. **Maintainability**: Clear separation of concerns
4. **Tooling**: Automated fixing and validation
5. **Merge Conflicts**: Reduced conflicts in import sections

## References

- [ESLint Import Plugin](https://github.com/import-js/eslint-plugin-import)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [ES Modules Specification](https://tc39.es/ecma262/#sec-modules)
- Design Document: `.kiro/specs/v0.1.0 Debugging and Polishing/design.md`

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-23 | Initial import conventions document | System |
