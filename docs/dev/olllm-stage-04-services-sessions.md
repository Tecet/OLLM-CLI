# Stage 04 - Services and Sessions

## Baseline Context (standalone)
- Core runtime and tools are available.
- Use `~/.ollm/` and `.ollm/` for user and workspace data.

## Goals
- Persist sessions and enable resume.
- Manage context size and prevent runaway loops.
- Provide safe environment sanitization for shell tools.

## Tasks

### S04-T01: Session recording
Context: Store session history for resume and export.
Steps:
- Implement `ChatRecordingService` with `recordMessage` and `recordToolCall`.
- Save sessions under `~/.ollm/session-data/`.
- Define JSON format with `sessionId`, `startTime`, `model`, `messages`, `toolCalls`.
Deliverables:
- `packages/core/src/services/chatRecordingService.ts`
Acceptance criteria:
- Sessions can be resumed and listed.

### S04-T02: Chat compression
Context: Maintain context size within model limits.
Steps:
- Implement `ChatCompressionService` that summarizes older messages.
- Trigger when token usage exceeds a configurable threshold.
Deliverables:
- `packages/core/src/services/chatCompressionService.ts`
Acceptance criteria:
- Compression replaces older history with a summary.

### S04-T03: Loop detection
Context: Prevent infinite loops in tool calling.
Steps:
- Implement loop detection based on repeated output and turn limits.
- Expose configuration for max turns and repeat thresholds.
Deliverables:
- `packages/core/src/services/loopDetectionService.ts`
Acceptance criteria:
- Runtime stops and emits a loop event when conditions are met.

### S04-T04: Context manager
Context: Provide just-in-time context injection.
Steps:
- Implement `ContextManager` with `addContext`, `removeContext`, `getContext`.
- Allow hooks and extensions to add context.
Deliverables:
- `packages/core/src/services/contextManager.ts`
Acceptance criteria:
- Context is included in system prompt for every turn.

### S04-T05: File discovery
Context: Fast project scanning for tools and context.
Steps:
- Implement `FileDiscoveryService` using fast directory traversal.
- Respect `.ollmignore` and `.gitignore`.
Deliverables:
- `packages/core/src/services/fileDiscoveryService.ts`
Acceptance criteria:
- File discovery returns consistent, filtered results.

### S04-T06: Environment sanitization
Context: Prevent secrets from leaking to tools.
Steps:
- Implement allow/deny lists and pattern-based redaction.
- Always allow core variables (PATH, HOME, etc.).
Deliverables:
- `packages/core/src/services/environmentSanitization.ts`
Acceptance criteria:
- Sensitive variables are removed from tool environments.
