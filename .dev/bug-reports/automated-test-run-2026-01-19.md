# Automated Test Run — 2026-01-19

Command: `npm test` (full suite)

Result: 44 test files failed, 230 passed; 406 individual tests failed, 4,452 passed; 1 unhandled error (worker exit).

---

## Bug Log: Missing Provider wrappers causing hook throws
- Issue: Multiple hooks throw when invoked outside their provider: `useServices`, `useTools`, `useUI`.
- Symptoms: Tests show errors like `useServices must be used within a ServiceProvider`, `useTools must be used within a ToolsProvider`, `useUI must be used within a UIProvider` and many UI tests fail with those messages.
- Scope / Files:
  - packages/cli/src/features/context/ServiceContext.tsx (useServices) [line ~156]
  - packages/cli/src/ui/contexts/ToolsContext.tsx (useTools) [line ~93]
  - packages/cli/src/features/context/UIContext.tsx (useUI) [line ~110]
  - Affects many tests under packages/cli/src/ui/components/**/__tests__/*.test.tsx
- First failing tests observed:
  - packages/cli/src/ui/components/tabs/__tests__/MCPTab.integration.test.tsx
  - packages/cli/src/ui/components/tools/__tests__/ToolsPanel.test.tsx
- Severity: CRITICAL — blocks UI test validation and indicates tests lack required providers.
- Repro: Run `npm test` and inspect output for the `must be used within` errors.
- Suggested next steps: Add a `TestProviders` wrapper supplying `ServiceProvider`, `UIProvider`, `ToolsProvider` for unit tests; update affected tests to use it.

---

## Bug Log: Health monitor / subscription failures in MCP integration tests
- Issue: Health monitor UI not rendered and subscription mocks not called (`subscribeToHealthUpdates` not invoked).
- Symptoms: Tests expecting frame content with `Health Monitor` fail; mocks not observed called.
- Scope / Files:
  - packages/cli/src/ui/components/tabs/__tests__/MCPTab.integration.test.tsx
  - Related to MCPContext and HealthMonitor mocks
- Severity: HIGH
- Repro: Run `npm test` and look for `expect(frame).toContain('Health Monitor')` and `toHaveBeenCalled()` failures.
- Suggested next steps: Verify MCPProvider test setup, ensure HealthMonitor mock instance is injected and subscribed in test environment.

---

## Bug Log: Property tests — server state consistency / zombie processes
- Issue: Fast-check property tests produce counterexamples where server status is `error` instead of expected `disconnected` after stop sequences.
- Symptoms: Property-based tests fail with counterexamples (seeds shown) and assertions expecting `disconnected`.
- Scope / Files:
  - packages/cli/src/ui/components/tabs/__tests__/MCPTab.property.test.tsx
- Severity: HIGH
- Repro: Run the property test file (or full suite) — fast-check outputs seeds and counterexamples.
- Suggested next steps: Investigate server lifecycle/state transitions in the MCP client mock or state machine; add more robust handling for concurrent start/stop sequences and stabilize timing in tests.

---

## Bug Log: OAuth token display property test failing (token visibility)
- Issue: Property tests for OAuth token display sometimes fail to match expected output regex (risk of tokens appearing or incorrect statuses shown).
- Symptoms: Tests expect connection status text (e.g., `Connected|Token Expired|Not Connected`) but receive raw token-like strings in output.
- Scope / Files:
  - packages/cli/src/ui/components/tabs/__tests__/MCPTab.property.test.tsx
- Severity: HIGH — potential information leak if tokens are shown in UI
- Repro: Run the property tests; fast-check counterexamples include `accessToken` values with varying whitespace leading to test failures.
- Suggested next steps: Mask tokens in UI rendering during tests (and production), or ensure tests inject sanitized token objects; add explicit assertions that no token plaintext is rendered.

---

## Bug Log: Worker crash — tinypool "Worker exited unexpectedly"
- Issue: Vitest reported an unhandled error: `Worker exited unexpectedly` (tinypool/child-process crash).
- Symptoms: Test run reports 1 unhandled error; may cause false positives/negatives.
- Scope / Files:
  - Error originates from `node_modules/tinypool/dist/esm/index.js` while running tests (child process exit).
- Severity: CRITICAL
- Repro: Run `npm test` — look for `Worker exited unexpectedly` in top-level test output.
- Suggested next steps: Re-run with verbose worker logs; check environment (memory/handles), Node version compatibility with `tinypool`; consider limiting worker pool size or running failing subsets to isolate which test triggers the crash.

---

## Actions taken
- Ran full test suite on 2026-01-19 and captured output (see this file)
- Logged grouped bug entries for triage and assignment

## Next recommended actions
- Add `TestProviders` wrapper and update UI tests to use it
- Triage `tinypool` worker crash separately (re-run with `VERBOSE` / single test files)
- Investigate and harden MCP server state transitions and token masking in UI
