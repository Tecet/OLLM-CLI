# OLLM CLI - Dependencies Tracking

**Last Updated:** January 14, 2026  
**Project Version:** 0.1.0

This document tracks all packages, dependencies, and their versions used in the OLLM CLI project. It includes current versions installed and the latest available versions from npm.

---

## Table of Contents

- [Language & Runtime](#language--runtime)
- [Workspace Packages](#workspace-packages)
- [Build & Development Tools](#build--development-tools)
- [Testing Framework](#testing-framework)
- [Linting & Formatting](#linting--formatting)
- [UI Framework](#ui-framework)
- [Core Dependencies](#core-dependencies)
- [File System & Pattern Matching](#file-system--pattern-matching)
- [Configuration & Validation](#configuration--validation)
- [Image Processing](#image-processing)
- [Type Definitions](#type-definitions)
- [Version Update Strategy](#version-update-strategy)

---

## Language & Runtime

| Package        | Current Version | Latest Version | Status              | Notes                                      |
| :------------- | :-------------- | :------------- | :------------------ | :----------------------------------------- |
| **Node.js**    | 20.x            | 22.x LTS       | ⚠️ Update Available | Node 22 is current LTS, consider upgrading |
| **TypeScript** | 5.9.3           | 5.9.3          | ✅ Up to Date       | Latest stable release (Dec 2025)           |
| **npm**        | 10.x            | 11.6.0         | ⚠️ Update Available | npm 11 released Sept 2025                  |

**Module System:** ES Modules (`type: "module"`)  
**TypeScript Target:** ES2022  
**Module Resolution:** NodeNext

---

## Workspace Packages

Internal packages managed within the monorepo:

| Package               | Version | Location               | Description                              |
| :-------------------- | :------ | :--------------------- | :--------------------------------------- |
| `@ollm/cli`           | 0.1.0   | `packages/cli`         | CLI entry point and UI components        |
| `@ollm/ollm-cli-core` | 0.1.0   | `packages/core`        | Core runtime and business logic          |
| `@ollm/ollm-bridge`   | 0.1.0   | `packages/ollm-bridge` | Provider adapters (Ollama, vLLM, OpenAI) |
| `@ollm/test-utils`    | 0.1.0   | `packages/test-utils`  | Shared test fixtures and helpers         |

---

## Build & Development Tools

| Package     | Current Version | Latest Version | Status           | Notes                                              |
| :---------- | :-------------- | :------------- | :--------------- | :------------------------------------------------- |
| **esbuild** | 0.19.12         | 0.24.2         | ⚠️ Major Update  | v0.24 released Jan 2025, breaking changes possible |
| **tsx**     | -               | 4.19.2         | ❌ Not Installed | Consider adding for TS execution                   |

**Build Configuration:** `scripts/build.js` (custom esbuild wrapper)

---

## Testing Framework

| Package                 | Current Version | Latest Version | Status          | Notes                                           |
| :---------------------- | :-------------- | :------------- | :-------------- | :---------------------------------------------- |
| **vitest**              | 1.6.1           | 3.2.4          | ⚠️ Major Update | v3.2 is latest stable (June 2025), v4.0 in beta |
| **@vitest/coverage-v8** | 1.6.1           | 3.2.4          | ⚠️ Major Update | Should match vitest version                     |
| **fast-check**          | 3.23.2          | 3.23.2         | ✅ Up to Date   | Property-based testing library                  |
| **ink-testing-library** | 4.0.0 (git)     | 4.0.0          | ✅ Up to Date   | Installed from GitHub repo                      |

**Test Configuration:** `vitest.config.ts`  
**Coverage Target:** 80% threshold

---

## Linting & Formatting

| Package                       | Current Version | Latest Version | Status        | Notes                                    |
| :---------------------------- | :-------------- | :------------- | :------------ | :--------------------------------------- |
| **eslint**                    | 9.39.2          | 9.39.2         | ✅ Up to Date | ESLint 9 flat config (released Apr 2024) |
| **@eslint/js**                | 9.39.2          | 9.39.2         | ✅ Up to Date | Core ESLint rules                        |
| **typescript-eslint**         | 8.52.0          | 8.44.0         | ✅ Up to Date | TypeScript ESLint integration            |
| **eslint-plugin-react**       | 7.37.5          | 7.37.5         | ✅ Up to Date | React-specific linting rules             |
| **eslint-plugin-react-hooks** | 7.0.1           | 7.0.1          | ✅ Up to Date | React Hooks linting rules                |
| **prettier**                  | 3.7.4           | 3.7.4          | ✅ Up to Date | Code formatter (latest Dec 2024)         |
| **globals**                   | 17.0.0          | 17.0.0         | ✅ Up to Date | Global identifiers for ESLint            |

**ESLint Config:** `eslint.config.js` (flat config format)  
**Prettier Config:** `.prettierrc.json`

---

## UI Framework

| Package                 | Current Version | Latest Version | Status        | Notes                           |
| :---------------------- | :-------------- | :------------- | :------------ | :------------------------------ |
| **react**               | 19.2.3          | 19.2.3         | ✅ Up to Date | React 19 stable (Dec 2024)      |
| **ink**                 | 6.6.0           | 6.6.0          | ✅ Up to Date | Terminal UI framework for React |
| **react-devtools-core** | 6.1.5           | 6.1.5          | ✅ Up to Date | React DevTools integration      |
| **@types/react**        | 19.2.8          | 19.2.8         | ✅ Up to Date | React type definitions          |

**UI Architecture:** React 19 + Ink 6 for terminal rendering

---

## Core Dependencies

| Package          | Current Version | Latest Version | Status        | Notes                         |
| :--------------- | :-------------- | :------------- | :------------ | :---------------------------- |
| **yargs**        | 17.7.2          | 17.7.2         | ✅ Up to Date | CLI argument parsing          |
| **@types/yargs** | 17.0.35         | 17.0.35        | ✅ Up to Date | Yargs type definitions        |
| **yaml**         | 2.8.2           | 2.8.2          | ✅ Up to Date | YAML parsing for config files |

---

## File System & Pattern Matching

| Package       | Current Version | Latest Version | Status        | Notes                                   |
| :------------ | :-------------- | :------------- | :------------ | :-------------------------------------- |
| **glob**      | 13.0.0          | 13.0.0         | ✅ Up to Date | Glob pattern matching (latest Nov 2024) |
| **fdir**      | 6.5.0           | 6.5.0          | ✅ Up to Date | Fast directory traversal                |
| **ignore**    | 5.3.2           | 5.3.2          | ✅ Up to Date | .gitignore parsing                      |
| **picomatch** | 4.0.3           | 4.0.3          | ✅ Up to Date | Fast glob matcher                       |

---

## Configuration & Validation

| Package         | Current Version | Latest Version | Status        | Notes                     |
| :-------------- | :-------------- | :------------- | :------------ | :------------------------ |
| **ajv**         | 8.17.1          | 8.17.1         | ✅ Up to Date | JSON Schema validator     |
| **ajv-formats** | 2.1.1           | 2.1.1          | ✅ Up to Date | Format validators for AJV |

**Schema Location:** `schemas/settings.schema.json`

---

## Image Processing

| Package            | Current Version | Latest Version | Status        | Notes                         |
| :----------------- | :-------------- | :------------- | :------------ | :---------------------------- |
| **ink-image**      | 2.0.0           | 2.0.0          | ✅ Up to Date | Display images in Ink         |
| **terminal-image** | 4.2.0           | 4.2.0          | ✅ Up to Date | Render images in terminal     |
| **jimp**           | 1.6.0           | 1.6.0          | ✅ Up to Date | JavaScript image manipulation |

---

## Type Definitions

| Package          | Current Version | Latest Version | Status              | Notes                        |
| :--------------- | :-------------- | :------------- | :------------------ | :--------------------------- |
| **@types/node**  | 20.19.27        | 22.x           | ⚠️ Update Available | Should match Node.js version |
| **@types/react** | 19.2.8          | 19.2.8         | ✅ Up to Date       | React 19 types               |
| **@types/yargs** | 17.0.35         | 17.0.35        | ✅ Up to Date       | Yargs types                  |

---

## Planned Dependencies

These dependencies are referenced in documentation but not yet installed:

### AI/ML Integration

- `@modelcontextprotocol/sdk` - MCP integration
- `@xenova/transformers` - Local embeddings for semantic search
- `better-sqlite3` - Vector storage for codebase index

### Text Processing

- `diff` - Text diffing for file edits
- `marked` - Markdown parsing
- `html-to-text` - HTML conversion
- `js-yaml` - YAML parsing (already installed as `yaml`)

### Validation

- `zod` - TypeScript-first schema validation

### Code Execution

- `isolated-vm` - JavaScript sandbox
- `vm2` - Alternative JavaScript sandbox

### Vision & Media

- `sharp` - Image processing and resizing
- `playwright` - Screenshot capture (optional)

### Terminal & Shell

- `@xterm/headless` - Terminal emulation
- `shell-quote` - Shell command parsing

### Git Integration

- `simple-git` - Git operations

### Cross-Platform Support

- `nvidia-smi` - NVIDIA GPU monitoring (Windows/Linux)
- `rocm-smi` - AMD GPU monitoring (Linux)

### CLI Utilities

- `prompts` - Interactive prompts
- `clipboardy` - Clipboard access
- `dotenv` - Environment variables

### UI Components

- `ink-spinner` - Loading spinners
- `highlight.js` - Syntax highlighting
- `lowlight` - Lowlight adapter

### Testing

- `msw` - Mock Service Worker
- `mock-fs` - File system mocking
- `memfs` - In-memory file system

---

## Version Update Strategy

### Priority Levels

**🔴 Critical (Update Immediately)**

- Security vulnerabilities
- Breaking bugs in current version
- End-of-life versions

**🟡 High Priority (Update Soon)**

- Major version updates with new features
- Performance improvements
- Better TypeScript support

**🟢 Low Priority (Update When Convenient)**

- Minor version updates
- Patch releases
- Documentation improvements

### Current Recommendations

1. **Consider Upgrading:**
   - `vitest` 1.6.1 → 3.2.4 (major update, test carefully)
   - `esbuild` 0.19.12 → 0.24.2 (major update, check breaking changes)
   - `@types/node` 20.x → 22.x (match Node.js version)

2. **Monitor:**
   - `vitest` v4.0 (currently in beta)
   - Node.js 22 LTS adoption
   - React 19 ecosystem maturity

3. **Keep Current:**
   - All linting and formatting tools are up to date
   - React 19 and Ink 6 are latest stable
   - TypeScript 5.9 is latest stable

### Update Process

1. **Before Updating:**
   - Review changelog for breaking changes
   - Check compatibility with other dependencies
   - Ensure tests pass on current version

2. **Update Steps:**

   ```bash
   # Check for outdated packages
   npm outdated

   # Update specific package
   npm install <package>@latest --save-dev

   # Update all packages (use with caution)
   npm update

   # Verify installation
   npm list --depth=0

   # Run tests
   npm test
   ```

3. **After Updating:**
   - Run full test suite
   - Check for deprecation warnings
   - Update this document
   - Commit changes with clear message

---

## Version History

| Date       | Updated By | Changes                                      |
| :--------- | :--------- | :------------------------------------------- |
| 2026-01-14 | System     | Initial dependency tracking document created |

---

## References

- npm Documentation (https://docs.npmjs.com/)
- TypeScript Release Notes (https://www.typescriptlang.org/docs/handbook/release-notes/overview.html)
- React 19 Release (https://react.dev/blog/2025/10/01/react-19-2)
- Vitest Documentation (https://vitest.dev/)
- ESLint 9 Migration Guide (https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- Node.js Release Schedule (https://nodejs.org/en/about/previous-releases)

---

**Note:** This document should be updated whenever dependencies are added, removed, or upgraded. Run `npm outdated` regularly to check for available updates.
