# Stage 08 - Testing and QA

## Baseline Context (standalone)
- Unit tests use Vitest.
- UI tests use ink-testing-library.

## Goals
- Ensure core behavior is reliable across models.
- Validate tool calling and streaming correctness.

## Tasks

### S08-T01: Unit tests
Steps:
- Add tests for provider adapters, tool schema mapping, and ReAct parser.
- Add tests for token estimation and routing.
Deliverables:
- `packages/core/src/**/__tests__/*`
Acceptance criteria:
- Unit tests pass in CI.

### S08-T02: Integration tests
Steps:
- Add integration tests that run against a local LLM server.
- Validate streaming, tool calls, and model list/pull/delete.
Deliverables:
- `integration-tests/`
Acceptance criteria:
- Tests pass when server is available and skip gracefully otherwise.

### S08-T03: UI tests
Steps:
- Use ink-testing-library to verify rendering and key workflows.
Deliverables:
- `packages/cli/src/ui/__tests__/*`
Acceptance criteria:
- UI tests cover streaming and tool confirmations.

### S08-T04: Compatibility matrix
Steps:
- Define at least three representative models: general, code, small.
- Verify tool calling behavior and context handling for each.
Deliverables:
- `docs/compatibility.md`
Acceptance criteria:
- Documented pass/fail results for each model.

