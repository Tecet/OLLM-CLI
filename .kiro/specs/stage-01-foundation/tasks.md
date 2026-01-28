# Implementation Plan: Stage 01 - Foundation and Repo Scaffolding

## Overview

This implementation plan creates the foundational monorepo structure for OLLM CLI. Tasks are ordered to build incrementally, with each step validating the previous work. The plan follows the dependency order: workspace setup → TypeScript → build pipeline → lint/format → CLI entry → testing.

## Tasks

- [x] 1. Create root workspace configuration
  - [x] 1.1 Create root `package.json` with workspaces configuration
    - Set `private: true`, `type: module`, `workspaces: ["packages/*"]`
    - Add placeholder scripts for build, dev, test, lint, format
    - Add root devDependencies: typescript, esbuild, vitest, eslint, prettier, @types/node
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 Create package directory structure
    - Create `packages/cli/package.json` with @ollm/cli name, bin entry for ollm
    - Create `packages/core/package.json` with @ollm/core name
    - Create `packages/ollm-bridge/package.json` with @ollm/ollm-bridge name
    - Create `packages/test-utils/package.json` with @ollm/test-utils name
    - All packages: `type: module`, version 0.1.0
    - _Requirements: 1.5, 6.1, 6.2, 6.3, 6.4_

- [x] 2. Configure TypeScript
  - [x] 2.1 Create `tsconfig.base.json` with shared settings
    - Target ES2022, module NodeNext, strict mode enabled
    - Enable declaration, declarationMap, sourceMap
    - Configure jsx: react-jsx
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Create package-level tsconfig.json files
    - Each package extends `../../tsconfig.base.json`
    - Set appropriate outDir and rootDir for each package
    - Include src directory in each
    - _Requirements: 2.3, 2.4_
  - [x] 2.3 Write property test for tsconfig inheritance
    - **Property 1: Package TypeScript Configuration Inheritance**
    - **Validates: Requirements 2.3**

- [x] 3. Set up build pipeline
  - [x] 3.1 Create `esbuild.config.js` for CLI bundling
    - Entry point: packages/cli/src/cli.tsx
    - Output: packages/cli/dist/cli.js
    - Platform: node, target: node20, format: esm
    - Add shebang banner: #!/usr/bin/env node
    - External: node built-ins
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 3.2 Create `scripts/build.js` build script
    - Import and run esbuild with config
    - Handle build errors gracefully
    - _Requirements: 3.1_
  - [x] 3.3 Write property test for build output shebang
    - **Property 2: Build Output Shebang**
    - **Validates: Requirements 3.4**

- [x] 4. Configure linting and formatting
  - [x] 4.1 Create `eslint.config.js` with flat config
    - Configure for TypeScript and React
    - Add typescript-eslint plugin
    - Add react and react-hooks plugins
    - Ignore dist/, node_modules/, coverage/
    - _Requirements: 4.1, 4.3, 4.4_
  - [x] 4.2 Create `.prettierrc.json` and `.prettierignore`
    - Configure semi, singleQuote, tabWidth, trailingComma, printWidth
    - Ignore dist/, node_modules/, coverage/, \*.md in prettierignore
    - _Requirements: 4.2, 4.4_

- [x] 5. Implement base CLI entry point
  - [x] 5.1 Create `packages/cli/src/cli.tsx`
    - Parse --version and --help flags
    - Print version from package.json on --version
    - Print usage information on --help
    - Exit with code 0 on success
    - Exit with code 1 and error message on unknown flags
    - Use React and Ink for rendering capability
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 5.2 Add CLI dependencies to packages/cli
    - Add ink, react as dependencies
    - Add @types/react as devDependency
    - Add yargs for argument parsing
    - _Requirements: 5.3_
  - [x] 5.3 Write property test for unknown flag rejection
    - **Property 3: Unknown CLI Flag Rejection**
    - **Validates: Requirements 5.4**
  - [x] 5.4 Write unit tests for CLI version and help
    - Test --version outputs version string
    - Test --help outputs usage information
    - _Requirements: 5.1, 5.2_

- [x] 6. Configure testing framework
  - [x] 6.1 Create `vitest.config.ts` at workspace root
    - Configure for TypeScript and React
    - Set test file patterns: **/\*.test.ts, **/\*.test.tsx
    - Configure coverage if needed
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 6.2 Create placeholder test in packages/cli
    - Create packages/cli/src/**tests**/cli.test.ts
    - Add a simple passing test to verify setup
    - _Requirements: 7.1_

- [x] 7. Checkpoint - Verify foundation setup
  - Run `npm install` and verify success
  - Run `npm run build` and verify packages/cli/dist/cli.js exists
  - Run `npm run lint` and verify no errors
  - Run `npm run format` and verify completion
  - Run `npm run test` and verify Vitest runs
  - Run `node packages/cli/dist/cli.js --version` and verify output
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create source file placeholders
  - [x] 8.1 Create placeholder index files for core packages
    - Create packages/core/src/index.ts with empty export
    - Create packages/ollm-bridge/src/index.ts with empty export
    - Create packages/test-utils/src/index.ts with empty export
    - _Requirements: 6.5_

- [x] 9. Final checkpoint - Full verification
  - Verify cross-package imports work (test-utils from cli)
  - Run full test suite
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
