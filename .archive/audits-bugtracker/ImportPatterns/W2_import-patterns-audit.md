# Import Patterns Audit

**Date**: January 23, 2026  
**Task**: 29. Standardize Import Patterns  
**Status**: ✅ Complete

## Overview

This audit reviews import patterns across the codebase to identify inconsistencies and establish standardized conventions.

## Current State Analysis

### Import Order Patterns Found

#### Pattern 1: Mixed External and Internal (Most Common)
```typescript
// Example from App.tsx
import { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { UIProvider, useUI } from '../features/context/UIContext.js';
import type { ProviderAdapter } from '@ollm/core';
```

#### Pattern 2: Type Imports Mixed with Regular
```typescript
// Example from mockProvider.test.ts
import { describe, it, expect } from 'vitest';
import { MockProvider } from '../mockProvider.js';
import type { ProviderEvent, ProviderRequest } from '@ollm/core';
```

#### Pattern 3: Namespace Imports
```typescript
// Example from workspaceBoundary.ts
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
```

#### Pattern 4: Destructured Node Modules
```typescript
// Example from read-file.ts
import { promises as fs } from 'fs';
import * as path from 'path';
```

### Issues Identified

1. **Inconsistent Import Order**
   - Some files group by type (external, internal, types)
   - Others mix all imports together
   - No consistent separation between categories

2. **Type Import Placement**
   - Type imports sometimes at the end
   - Type imports sometimes mixed with regular imports
   - Inconsistent use of `import type` syntax

3. **Namespace vs Named Imports**
   - Node built-ins use both `import * as` and destructured imports
   - No clear convention for when to use each

4. **Missing .js Extensions**
   - Some relative imports missing `.js` extension
   - Inconsistent across files

5. **Unused Imports**
   - Need to run linter to identify
   - Manual review shows some potential unused imports

## Standardized Import Order (from design.md)

```typescript
// 1. External dependencies (Node built-ins, npm packages)
import { useState, useCallback } from 'react';
import { Box, Text } from 'ink';

// 2. Internal dependencies (workspace packages, relative imports)
import { useUI } from '../features/context/UIContext.js';
import { useWindow } from './contexts/WindowContext.js';

// 3. Types (always use `import type` syntax)
import type { Theme, WindowConfig } from '../config/types.js';

// 4. Relative imports (same directory or subdirectories)
import { WindowIndicator } from './WindowIndicator.js';
```

## Conventions to Enforce

### 1. Import Order
- **Group 1**: External dependencies (Node built-ins first, then npm packages)
- **Group 2**: Internal dependencies (workspace packages, parent/sibling directories)
- **Group 3**: Type imports (always separate, always use `import type`)
- **Group 4**: Relative imports (same directory)
- **Blank line** between each group

### 2. Type Imports
- Always use `import type` for type-only imports
- Group all type imports together (Group 3)
- Never mix type and value imports in the same statement

### 3. Node Built-ins
- Use namespace imports for Node built-ins: `import * as fs from 'fs'`
- Exception: When only using one export, use named import: `import { promises as fs } from 'fs'`
- Always import Node built-ins before npm packages

### 4. File Extensions
- Always include `.js` extension for relative imports
- TypeScript will resolve to `.ts` files during compilation
- Required for ES modules

### 5. Sorting Within Groups
- Alphabetical by module name within each group
- React imports first in external dependencies
- Workspace packages (`@ollm/*`) before relative imports

## Files Requiring Updates

### High Priority (Core Files)
- `packages/cli/src/ui/App.tsx` - Main app component
- `packages/cli/src/ui/contexts/*.tsx` - All context files
- `packages/core/src/context/contextManager.ts` - Context manager
- `packages/core/src/provider/types.ts` - Provider types

### Medium Priority (Feature Files)
- `packages/cli/src/ui/components/**/*.tsx` - All UI components
- `packages/core/src/services/**/*.ts` - All services
- `packages/core/src/tools/**/*.ts` - All tools

### Low Priority (Test Files)
- `packages/*/src/__tests__/**/*.test.ts` - All test files
- Test files can be updated in bulk with automated tools

## Implementation Strategy

### Phase 1: Create ESLint Rule
1. Configure `eslint-plugin-import` for import ordering
2. Add rule to `eslint.config.js`
3. Test on sample files

### Phase 2: Automated Fix
1. Run `eslint --fix` on all TypeScript files
2. Review changes for correctness
3. Fix any issues ESLint can't handle automatically

### Phase 3: Manual Review
1. Review files with complex import patterns
2. Fix edge cases ESLint missed
3. Ensure all imports have `.js` extensions

### Phase 4: Documentation
1. Update CONTRIBUTING.md with import conventions
2. Add examples to docs/NAMING-CONVENTIONS.md
3. Create import template for new files

## ESLint Configuration

```javascript
// eslint.config.js additions
{
  plugins: {
    import: importPlugin,
  },
  rules: {
    'import/order': ['error', {
      'groups': [
        'builtin',      // Node built-ins
        'external',     // npm packages
        'internal',     // @ollm/* packages
        'parent',       // ../
        'sibling',      // ./
        'type',         // import type
      ],
      'pathGroups': [
        {
          'pattern': 'react',
          'group': 'external',
          'position': 'before',
        },
        {
          'pattern': '@ollm/**',
          'group': 'internal',
        },
      ],
      'pathGroupsExcludedImportTypes': ['builtin'],
      'newlines-between': 'always',
      'alphabetize': {
        'order': 'asc',
        'caseInsensitive': true,
      },
    }],
    'import/no-unused-modules': ['warn'],
    'import/extensions': ['error', 'always', {
      'ts': 'never',
      'tsx': 'never',
      'js': 'always',
    }],
  },
}
```

## Success Criteria

- [ ] All files follow standardized import order
- [ ] All type imports use `import type` syntax
- [ ] All relative imports have `.js` extensions
- [ ] No unused imports remain
- [ ] ESLint import rules configured and passing
- [ ] Documentation updated with conventions

## Notes

- This is a large-scale refactoring that touches many files
- Automated tools (ESLint) will handle most of the work
- Manual review required for edge cases
- Should be done in a dedicated commit for easy review
- May cause merge conflicts with other branches

## References

- Design Document: `.kiro/specs/v0.1.0 Debugging and Polishing/design.md`
- ESLint Import Plugin: https://github.com/import-js/eslint-plugin-import
- TypeScript Module Resolution: https://www.typescriptlang.org/docs/handbook/module-resolution.html
