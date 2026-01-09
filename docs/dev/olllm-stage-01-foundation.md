# Stage 01 - Foundation and Repo Scaffolding

## Baseline Context (standalone)
- Node 20+, TypeScript, ES modules.
- Monorepo with npm workspaces.
- Packages: cli, core, ollm-bridge, test-utils (optional: a2a-server).
- Build: esbuild; test: Vitest; lint: ESLint; format: Prettier.
- UI: React + Ink.

## Goals
- Create a clean repo skeleton that can be built and tested.
- Provide consistent TypeScript, lint, and build settings.

## Tasks

### S01-T01: Workspace and package manifests
Context: This is the root of the new workspace.
Steps:
- Create root `package.json` with `private: true`, `type: module`, and `workspaces: ["packages/*"]`.
- Add scripts: `build`, `dev`, `test`, `lint`, `format`.
- Create `packages/cli`, `packages/core`, `packages/ollm-bridge`, `packages/test-utils` with `package.json` and `src/` directories.
Deliverables:
- `package.json`
- `packages/*/package.json`
Acceptance criteria:
- `npm install` succeeds.
- `npm run build` executes a placeholder without errors.

### S01-T02: TypeScript base config
Context: Shared TS settings for all packages.
Steps:
- Create `tsconfig.base.json` with strict mode, ES2022 target, NodeNext or Node16 module resolution.
- Each package `tsconfig.json` extends base and sets `outDir` and `rootDir`.
Deliverables:
- `tsconfig.base.json`
- `packages/*/tsconfig.json`
Acceptance criteria:
- `tsc -p packages/core` runs with no errors (empty sources allowed).

### S01-T03: Build pipeline
Context: CLI will be bundled into a single executable entry.
Steps:
- Add `esbuild.config.js` for bundling `packages/cli/src/cli.tsx`.
- Add `scripts/build.js` that runs esbuild and outputs to `dist/`.
Deliverables:
- `esbuild.config.js`, `scripts/build.js`
Acceptance criteria:
- `npm run build` creates a `dist/` file.

### S01-T04: Lint and format
Context: Consistent code style for all packages.
Steps:
- Add `eslint.config.js` for TS and React.
- Add `.prettierrc.json` and `.prettierignore`.
Deliverables:
- `eslint.config.js`, `.prettierrc.json`
Acceptance criteria:
- `npm run lint` and `npm run format` run without error.

### S01-T05: Base CLI entry
Context: Provide a minimal runnable CLI to validate the toolchain.
Steps:
- Add `packages/cli/src/cli.tsx` with a basic CLI entry that prints version and exits.
- Wire package bin name to the built output in `packages/cli/package.json`.
Deliverables:
- `packages/cli/src/cli.tsx`
- `packages/cli/package.json` with `bin` field
Acceptance criteria:
- `node dist/cli.js --version` prints a version.
