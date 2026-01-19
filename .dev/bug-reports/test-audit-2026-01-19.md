# Test Suite Audit — 2026-01-19

Scope: initial audit to identify long-running, flaky, or freezing tests and to skip documentation-related tests.

Changes made:
- Updated `vitest.config.ts` to exclude tests under `docs`/`documentation` folders and test files with `doc`/`docs` in their names.

Next steps for full audit:
1. Run a targeted test subset (UI tests) with verbose logging and extended timeouts to identify hangs.
2. For each freezing test:
   - Capture test file, test name, stack trace, and seed (for property tests).
   - Check for missing provider wrappers (common cause) and long-running async operations.
   - Add timeouts, mock dependencies, or convert to isolated unit tests.
3. Triage property-based failures (fast-check): record seeds/counterexamples and create focused reproducer tests.
4. Run tests in CI-like environment (same Node version) to reproduce `tinypool` worker crash.

Immediate commands to run locally (copy/paste):

```powershell
# Run UI tests only with verbose output (example)
npx vitest run packages/cli/src/ui --reporter verbose --run

# Run a single suspicious test file to reproduce hang
npx vitest run packages/cli/src/ui/components/tabs/__tests__/MCPTab.integration.test.tsx --run --reporter verbose

# Re-run whole suite with verbose worker logging (helps tinypool crash triage)
VITEST_WORKER_LOG=1 npx vitest run --reporter verbose
```

Suggested quick fixes:
- Add a `TestProviders` wrapper exporting `renderWithProviders()` for UI tests that need `UIProvider`, `ServiceProvider`, `ToolsProvider`.
- For property tests that fail intermittently, restrict fast-check runs (`numRuns`) until behavior is stabilized, and record failing seeds.
- For `tinypool` crashes, try running fewer forks or switch `pool: 'threads'` temporarily to see if behavior changes.

I'll run the targeted UI test subset next and collect any freezing tests (if you want me to proceed now).