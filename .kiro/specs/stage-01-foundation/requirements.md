# Requirements Document

## Introduction

This document defines the requirements for Stage 01 of OLLM CLI: Foundation and Repo Scaffolding. The goal is to create a clean monorepo skeleton with TypeScript, build tooling, linting, formatting, and a minimal CLI entry point that validates the entire toolchain works correctly.

## Glossary

- **Workspace**: The npm workspaces monorepo containing all packages
- **Build_Pipeline**: The esbuild-based bundling system that produces the CLI executable
- **CLI**: The command-line interface entry point for OLLM
- **Package**: An individual npm package within the monorepo (cli, core, ollm-bridge, test-utils)

## Requirements

### Requirement 1: Workspace and Package Manifests

**User Story:** As a developer, I want a properly configured npm workspaces monorepo, so that I can manage multiple packages with shared dependencies efficiently.

#### Acceptance Criteria

1. WHEN a developer runs `npm install` in the workspace root, THE Workspace SHALL install all dependencies for all packages without errors
2. THE Workspace SHALL be configured as private with ES modules (`type: module`)
3. THE Workspace SHALL define workspaces pointing to `packages/*`
4. THE Workspace SHALL include scripts for `build`, `dev`, `test`, `lint`, and `format`
5. WHEN the cli package is built, THE Package SHALL expose a `bin` entry for the `ollm` command

### Requirement 2: TypeScript Configuration

**User Story:** As a developer, I want consistent TypeScript settings across all packages, so that I can maintain type safety and code quality throughout the project.

#### Acceptance Criteria

1. THE Workspace SHALL have a base TypeScript configuration (`tsconfig.base.json`) with strict mode enabled
2. THE Workspace SHALL target ES2022 with NodeNext module resolution
3. WHEN a package TypeScript config is created, THE Package SHALL extend the base configuration
4. WHEN TypeScript compilation runs on any package, THE Build_Pipeline SHALL complete without type errors on valid source files

### Requirement 3: Build Pipeline

**User Story:** As a developer, I want an esbuild-based build pipeline, so that I can bundle the CLI into a single executable file quickly.

#### Acceptance Criteria

1. WHEN `npm run build` is executed, THE Build_Pipeline SHALL bundle the CLI entry point using esbuild
2. THE Build_Pipeline SHALL output bundled files to the `dist/` directory
3. THE Build_Pipeline SHALL support TypeScript and React/JSX transformation
4. THE Build_Pipeline SHALL generate a Node.js executable with proper shebang

### Requirement 4: Linting and Formatting

**User Story:** As a developer, I want consistent code style enforcement, so that the codebase remains readable and maintainable.

#### Acceptance Criteria

1. WHEN `npm run lint` is executed, THE Workspace SHALL run ESLint on all TypeScript and React files
2. WHEN `npm run format` is executed, THE Workspace SHALL run Prettier on all source files
3. THE Workspace SHALL configure ESLint for TypeScript strict rules and React hooks
4. THE Workspace SHALL exclude build outputs and node_modules from linting and formatting

### Requirement 5: Base CLI Entry Point

**User Story:** As a developer, I want a minimal CLI entry point, so that I can validate the entire toolchain works correctly end-to-end.

#### Acceptance Criteria

1. WHEN a user runs `ollm --version` or `node dist/cli.js --version`, THE CLI SHALL print the current version and exit with code 0
2. WHEN a user runs `ollm --help`, THE CLI SHALL display usage information
3. THE CLI SHALL be implemented using React and Ink for terminal UI capability
4. IF an unknown flag is provided, THEN THE CLI SHALL display an error message and exit with non-zero code

### Requirement 6: Package Structure

**User Story:** As a developer, I want a well-organized package structure, so that code responsibilities are clearly separated.

#### Acceptance Criteria

1. THE Workspace SHALL contain a `packages/cli` package for CLI entry and UI components
2. THE Workspace SHALL contain a `packages/core` package for core runtime and business logic
3. THE Workspace SHALL contain a `packages/ollm-bridge` package for provider adapters
4. THE Workspace SHALL contain a `packages/test-utils` package for shared test fixtures
5. WHEN any package is imported by another, THE Package SHALL resolve correctly via workspace dependencies

### Requirement 7: Testing Framework

**User Story:** As a developer, I want a testing framework configured, so that I can write and run tests for all packages.

#### Acceptance Criteria

1. WHEN `npm run test` is executed, THE Workspace SHALL run Vitest on all test files
2. THE Workspace SHALL support test files with `.test.ts` and `.test.tsx` extensions
3. THE Workspace SHALL configure Vitest to work with TypeScript and React components
