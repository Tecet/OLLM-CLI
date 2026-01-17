# Design Document: Stage 01 - Foundation and Repo Scaffolding

## Overview

This design establishes the foundational structure for OLLM CLI, a local-first command-line interface for open-source LLMs. The foundation consists of an npm workspaces monorepo with four packages, TypeScript configuration, esbuild bundling, ESLint/Prettier tooling, and a minimal CLI entry point.

The architecture follows a modular design where:
- `packages/cli` handles user interaction and terminal UI
- `packages/core` contains provider-agnostic business logic
- `packages/ollm-bridge` provides LLM provider adapters
- `packages/test-utils` offers shared testing utilities

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Workspace Root                            │
│  package.json, tsconfig.base.json, eslint.config.js         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ packages/cli │  │packages/core │  │packages/ollm-    │   │
│  │              │  │              │  │bridge            │   │
│  │ - cli.tsx    │  │ - (empty)    │  │ - (empty)        │   │
│  │ - React/Ink  │  │              │  │                  │   │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘   │
│         │                                                    │
│         │          ┌──────────────────┐                     │
│         │          │packages/test-    │                     │
│         │          │utils             │                     │
│         │          │ - (empty)        │                     │
│         │          └──────────────────┘                     │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │   packages/cli/dist/      │                                           │
│  │   cli.js     │  ◄── esbuild bundle                       │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Root Workspace Configuration

The root `package.json` configures npm workspaces and defines shared scripts:

```typescript
interface RootPackageJson {
  name: string;           // "ollm-cli"
  version: string;        // "0.1.0"
  private: true;
  type: "module";
  workspaces: string[];   // ["packages/*"]
  scripts: {
    build: string;
    dev: string;
    test: string;
    lint: string;
    format: string;
  };
  devDependencies: Record<string, string>;
}
```

### Package Configuration

Each package follows a consistent structure:

```typescript
interface PackageJson {
  name: string;           // "@ollm/cli", "@ollm/core", etc.
  version: string;
  type: "module";
  main?: string;          // Entry point for libraries
  bin?: Record<string, string>;  // CLI executables
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
```

### CLI Entry Point Interface

The CLI entry point handles argument parsing and version display:

```typescript
interface CLIOptions {
  version: boolean;
  help: boolean;
}

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
```

### Build Configuration

esbuild configuration for bundling:

```typescript
interface BuildConfig {
  entryPoints: string[];      // ["packages/cli/src/cli.tsx"]
  outfile: string;            // "packages/cli/dist/cli.js"
  bundle: true;
  platform: "node";
  target: "node20";
  format: "esm";
  banner: {
    js: string;               // "#!/usr/bin/env node"
  };
  external: string[];         // Node built-ins
}
```

## Data Models

### TypeScript Base Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx"
  }
}
```

### ESLint Configuration

Flat config format for ESLint 9.x:

```typescript
interface ESLintConfig {
  files: string[];
  languageOptions: {
    parser: typeof tsParser;
    parserOptions: {
      ecmaVersion: "latest";
      sourceType: "module";
      ecmaFeatures: { jsx: true };
    };
  };
  plugins: Record<string, unknown>;
  rules: Record<string, unknown>;
}
```

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Package TypeScript Configuration Inheritance

*For any* package in the `packages/` directory, its `tsconfig.json` SHALL extend `../../tsconfig.base.json`, ensuring consistent TypeScript settings across the entire monorepo.

**Validates: Requirements 2.3**

### Property 2: Build Output Shebang

*For any* build of the CLI, the output file in `packages/cli/dist/cli.js` SHALL begin with the shebang `#!/usr/bin/env node`, making it directly executable as a Node.js script.

**Validates: Requirements 3.4**

### Property 3: Unknown CLI Flag Rejection

*For any* command-line flag that is not recognized by the CLI (not `--version`, `--help`, or other defined flags), the CLI SHALL exit with a non-zero exit code and display an error message indicating the unknown flag.

**Validates: Requirements 5.4**

## Error Handling

### Build Errors

| Error Condition | Handling Strategy |
|-----------------|-------------------|
| TypeScript compilation errors | Exit with non-zero code, display error messages |
| Missing dependencies | Exit with error, suggest running `npm install` |
| Invalid esbuild config | Exit with descriptive error message |

### CLI Runtime Errors

| Error Condition | Handling Strategy |
|-----------------|-------------------|
| Unknown flag provided | Display error message, show help, exit code 1 |
| Missing required argument | Display error message, show usage, exit code 1 |

### Lint/Format Errors

| Error Condition | Handling Strategy |
|-----------------|-------------------|
| ESLint violations | Report violations, exit non-zero if errors |
| Prettier formatting issues | Report files that need formatting |

## Testing Strategy

### Dual Testing Approach

This foundation stage uses both unit tests and property-based tests:

- **Unit tests**: Verify specific configuration values, CLI behavior examples, and integration points
- **Property tests**: Verify universal properties that must hold across all packages and builds

### Property-Based Testing Configuration

- **Framework**: Vitest with fast-check for property-based testing
- **Minimum iterations**: 100 per property test
- **Tag format**: `Feature: stage-01-foundation, Property {number}: {property_text}`

### Test Categories

#### Configuration Validation Tests (Unit)
- Verify root package.json structure
- Verify tsconfig.base.json settings
- Verify ESLint and Prettier configurations
- Verify package structure exists

#### CLI Behavior Tests (Unit)
- `--version` flag outputs version and exits 0
- `--help` flag outputs help text
- Unknown flags exit with error

#### Build Integration Tests (Unit)
- `npm run build` produces output in `packages/cli/dist/`
- Output file has correct shebang
- TypeScript and JSX are transformed correctly

#### Property Tests
- All package tsconfigs extend base (Property 1)
- Build output always has shebang (Property 2)
- Unknown flags always rejected (Property 3)

### Test File Locations

```
packages/
├── cli/
│   └── src/
│       └── __tests__/
│           └── cli.test.ts
├── core/
│   └── src/
│       └── __tests__/
│           └── (future tests)
└── test-utils/
    └── src/
        └── index.ts
```

