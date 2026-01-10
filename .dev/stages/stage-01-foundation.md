# Stage 01: Foundation and Repo Scaffolding

## Overview
Create a clean repo skeleton that can be built and tested with consistent TypeScript, lint, and build settings.

## Prerequisites
None - this is the starting point.

## Estimated Effort
1-2 days

## Package Structure
```
repo/
├── package.json              # Root workspace config
├── tsconfig.base.json        # Shared TypeScript settings
├── esbuild.config.js         # Build configuration
├── eslint.config.js          # Linting rules
├── .prettierrc.json          # Formatting rules
├── packages/
│   ├── cli/                  # CLI entry, UI components
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── cli.tsx
│   ├── core/                 # Core runtime and business logic
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   ├── ollm-bridge/          # Provider adapters
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   └── test-utils/           # Shared test fixtures
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
├── schemas/                  # JSON schemas
├── scripts/
│   └── build.js
└── docs/
```

---

## Tasks

### S01-T01: Workspace and Package Manifests

**Context**: This is the root of the new workspace.

**Steps**:
1. Create root `package.json`:
   - `private: true`
   - `type: module`
   - `workspaces: ["packages/*"]`
2. Add scripts: `build`, `dev`, `test`, `lint`, `format`
3. Create package directories with `package.json` and `src/`:
   - `packages/cli`
   - `packages/core`
   - `packages/ollm-bridge`
   - `packages/test-utils`

**Deliverables**:
- `package.json`
- `packages/*/package.json`

**Acceptance Criteria**:
- `npm install` succeeds
- `npm run build` executes a placeholder without errors

---

### S01-T02: TypeScript Base Config

**Context**: Shared TS settings for all packages.

**Steps**:
1. Create `tsconfig.base.json`:
   - Strict mode enabled
   - Target: ES2022
   - Module resolution: NodeNext or Node16
2. Each package `tsconfig.json` extends base:
   - Set `outDir` and `rootDir`
   - Include appropriate source files

**Deliverables**:
- `tsconfig.base.json`
- `packages/*/tsconfig.json`

**Acceptance Criteria**:
- `tsc -p packages/core` runs with no errors (empty sources allowed)

---

### S01-T03: Build Pipeline

**Context**: CLI will be bundled into a single executable entry.

**Steps**:
1. Add `esbuild.config.js` for bundling `packages/cli/src/cli.tsx`
2. Add `scripts/build.js` that runs esbuild
3. Configure output to `dist/`

**Deliverables**:
- `esbuild.config.js`
- `scripts/build.js`

**Acceptance Criteria**:
- `npm run build` creates a `dist/` file

---

### S01-T04: Lint and Format

**Context**: Consistent code style for all packages.

**Steps**:
1. Add `eslint.config.js` for TypeScript and React
2. Add `.prettierrc.json` with formatting rules
3. Add `.prettierignore` for build outputs

**Deliverables**:
- `eslint.config.js`
- `.prettierrc.json`
- `.prettierignore`

**Acceptance Criteria**:
- `npm run lint` runs without error
- `npm run format` runs without error

---

### S01-T05: Base CLI Entry

**Context**: Provide a minimal runnable CLI to validate the toolchain.

**Steps**:
1. Add `packages/cli/src/cli.tsx`:
   - Basic CLI entry that prints version and exits
   - Parse `--version` flag
2. Wire package bin name in `packages/cli/package.json`

**Deliverables**:
- `packages/cli/src/cli.tsx`
- `packages/cli/package.json` with `bin` field

**Acceptance Criteria**:
- `node dist/cli.js --version` prints a version

---

## Key Dependencies to Install

### Root
```json
{
  "devDependencies": {
    "typescript": "^5.x",
    "esbuild": "^0.20.x",
    "vitest": "^1.x",
    "eslint": "^9.x",
    "prettier": "^3.x",
    "@types/node": "^20.x"
  }
}
```

### packages/cli
```json
{
  "dependencies": {
    "ink": "^4.x",
    "react": "^18.x"
  },
  "devDependencies": {
    "@types/react": "^18.x"
  }
}
```

---

## Verification Checklist

- [ ] `npm install` completes without errors
- [ ] `npm run build` produces output in `dist/`
- [ ] `npm run lint` passes
- [ ] `npm run format` passes
- [ ] `npm run test` runs (even if no tests yet)
- [ ] `node dist/cli.js --version` outputs version string
