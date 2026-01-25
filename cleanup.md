Repository cleanup checklist (draft)

Status: draft — review before applying any deletions.

1) Already completed (archived)
- Moved large test snapshots, vitest reports and temporary files into `.dev/legacy` (preserve `.dev` ignored).

2) Tracked incremental/build artifacts (action: untrack & ignore)
- Add to `.gitignore`: `*.tsbuildinfo`, `**/*.js.map`, `.test-snapshots/`, `vitest-reports/`, `coverage/`, `**/dist/` (per-package exceptions may apply).
- Untrack any currently tracked `*.tsbuildinfo` files and run a fresh build for affected packages (example: remove `packages/core/tsconfig.tsbuildinfo` then `npm run build`).

3) Dist/build outputs
- Review `packages/*/dist/` tracking. If `dist/` is committed by accident, either:
  - keep `dist/` only for published artifacts and remove from git (recommended), or
  - add explicit rules to keep only needed artifacts (not recommended).

4) Large test artifacts & snapshots
- Confirm `.dev/legacy` contains the archived snapshots and remove orphaned entries from repo index (already done for many files). Verify CI does not rely on checked-in snapshots.

5) Debug/console statements
- Replace persistent `console.log` in production code with `logger` or gated debug-level logs. Files with many `console.log` occurrences: `packages/core/src/extensions/extensionManager.ts`, `packages/core/src/hooks/*`, `packages/core/src/utils/storageMigration.ts`, `packages/cli/src/*`.

6) Implicit `any` and typings
- Prioritize fixing types in `packages/core` tests and core modules that cause build diagnostics (see `packages/core/typescript-errors.txt`). Start with test helpers and `ToolContext` mismatches.
- Reduce occurrences of `any` in public package APIs (CLI and core) to improve type safety.

7) Unsafe / risky patterns (security hygiene)
- Review usage of `child_process.exec`/`spawn` in `packages/core/src/mcp/*`, `packages/core/src/hooks/*`, `scripts/*` and `packages/cli/src/EditorIntegration.ts` to ensure input sanitization and least privilege.
- Files containing explicit dangerous examples in documentation: `packages/core/src/hooks/SECURITY.md` (document-only; do not execute). Remove dangerous snippets or mark them clearly as examples only.

8) Build & CI hygiene
- Ensure `tsc -b` works from repo root for all composite projects. If `tsconfig.tsbuildinfo` causes stale outputs, delete and rebuild.
- Add `*.tsbuildinfo` to `.gitignore`.

9) Documentation and comments
- Add short block comments for non-obvious files and blocks where intent is unclear (e.g., `scripts/` utilities, hook runner logic). Focus on public APIs and security-sensitive code first.

10) Next steps (proposal)
- Confirm these actions with the team. If approved, create a small set of commits:
  1. Add `.gitignore` entries and untrack any `*.tsbuildinfo` files.
  2. Commit the `.vitest.setup.ts` safe-catch change (already edited locally).
  3. Replace selected `console.log` with `logger.debug` in low-risk files.
  4. Open PRs for type fixes grouped by package (core → cli → bridge).

Reference findings used to compile this checklist: repository grep results for TODO/FIXME, implicit `any` occurrences and `child_process` usages.
