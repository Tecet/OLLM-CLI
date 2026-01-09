# Stage 07 - Model Management and Routing

## Baseline Context (standalone)
- Provider interface supports model list/pull/delete/info.
- CLI and UI can call model management APIs.

## Goals
- Implement model management services and routing rules.
- Define per-model context limits and defaults.

## Tasks

### S07-T01: Model management service
Steps:
- Implement `ModelManagementService` in core.
- Wrap provider adapter calls with errors and progress events.
Deliverables:
- `packages/core/src/services/modelManagementService.ts`
Acceptance criteria:
- List, pull, delete, and show model info work.

### S07-T02: Model routing
Steps:
- Implement rules for task profile selection (fast, general, code).
- Allow config-based overrides and fallbacks.
Deliverables:
- `packages/core/src/routing/modelRouter.ts`
Acceptance criteria:
- Router selects a model based on profile and availability.

### S07-T03: Model limit map
Steps:
- Add a map of known model context limits.
- Fallback to safe defaults when unknown.
Deliverables:
- `packages/core/src/core/modelLimits.ts`
Acceptance criteria:
- Token limit logic uses per-model caps.

### S07-T04: Model options schema
Steps:
- Extend settings schema for provider and model options.
- Add env vars and CLI flags that map to settings.
Deliverables:
- `schemas/settings.schema.json`
Acceptance criteria:
- Options are validated and applied to provider requests.
