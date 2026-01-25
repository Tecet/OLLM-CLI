Production readiness report (draft)

Date: 2026-01-25

Executive summary
- Repo is functional; recent cleanup moved many test artifacts to `.dev/legacy` and fixed a stale `tsconfig.tsbuildinfo` that blocked `packages/ollm-bridge` builds.
- Key issues remaining: many TODO/FIXME markers, widespread `any` usage (tests and some runtime code), and multiple `child_process` usages that deserve security review.

Quick metrics (scan highlights)
- TODO/FIXME/XXX/HACK occurrences: ~200 matches (grep capped at 200 results).
- Implicit `any` occurrences: ~169 matches (grep results across `packages/**`).
- `child_process` uses found: 37 matches across `scripts/`, `packages/core`, and `packages/cli`.

Top risk findings
- Tracked build cache / declaration stale state: previously `packages/core/tsconfig.tsbuildinfo` caused `TS6305` errors in downstream packages; fix: delete stale `.tsbuildinfo` and rebuild.
- Dangerous examples in docs: `packages/core/src/hooks/SECURITY.md` contains explicit child_process eval examples — ensure these are not executable and are only documented with clear disclaimers.
- Uncontrolled `console.log` in many runtime files (should be replaced with a configurable logger to avoid noisy output and leaking sensitive info).
- Many tests and some core helpers use `any` liberally — this reduces type safety and can mask API contract changes.

TypeScript diagnostics
- See `packages/core/typescript-errors.txt` for a large list of test-related errors (MockMessageBus vs ToolContext mismatches, etc.).

Prioritized remediation plan
1. Critical (1-2 days)
  - Add `*.tsbuildinfo` to `.gitignore`, remove tracked `tsbuildinfo` files, and rebuild all packages to ensure clean declaration artifacts. (Low risk; already proven effective.)
  - Review and sanitize any code that runs `child_process` with external input. Replace `exec` with safer spawn patterns or validate inputs. (Security-critical.)

2. High (3-7 days)
  - Address `any` usage in `packages/core` tests and public APIs; create PRs per package. Start with the top mismatch areas shown in `packages/core/typescript-errors.txt`.
  - Replace persistent `console.log` calls in production code with a structured `logger` approach; keep `console.log` only in scripts or guarded debug levels.

3. Medium (1-2 weeks)
  - Evaluate tracked `dist/` files and remove from git if not required for publishing. Ensure CI builds artifacts where needed.
  - Sweep for large binary or snapshot files and finalize archival policy (move to `.dev/legacy` or external artifact storage).

4. Long term (weeks)
  - Add repository-wide linting rules to prevent `any` leaks in public APIs and disallow tracked build artifacts.
  - Add CI checks: `tsc -b` for all projects, `eslint` with consistent config, and snapshot size checks.

Suggested immediate commits (safe, small)
- Commit the `.vitest.setup.ts` safe-catch change to avoid TS2339/unsafe `err` usage.
- Add `*.tsbuildinfo` to `.gitignore` and untrack any tracked `.tsbuildinfo` files.
- Create a small PR replacing a few `console.log` occurrences with `logger.debug` to demonstrate pattern.

Notes & caveats
- The counts above are from quick grep scans and may include duplicates (generated `dist/` files). A focused per-package audit will refine LOC and per-file effort estimates.
- I can: generate per-package TODO lists, open targeted PRs for the safe fixes above, and run a second pass to produce LOC counts if you want.

Next actions (ask)
- Confirm you want these drafts committed as-is, or reviewed/edited first. If approved, I will create the safe commits (ignore changes management) and open a PR per item.
