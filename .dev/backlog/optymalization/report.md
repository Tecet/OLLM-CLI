# Project Audit Report

## Execution Details

- **Date**: 2026-01-25
- **Scope**: Full project scan (packages/cli, packages/core, packages/ollm-bridge)
- **Objective**: Deep audit of errors, logic, architecture, and maintainability.

## Findings Summary

### 1. Architectural Issues (Critical)

- **God Components**: Several components have excessive responsibilities, exceeding 1000 lines of code (`ChatContext.tsx`, `MCPTab.tsx`, `App.tsx`). This violates the Single Responsibility Principle and makes testing difficult.
- **Context Provider Hell**: `App.tsx` contains a deeply nested tree of Context Providers (approx. 15-20 levels deep). This impacts performance (re-renders) and readability.
- **Mixed Concerns**:
  - UI components (like `MCPTab.tsx`) directly handle data fetching, parsing, and business logic.
  - `localProvider.ts` mixes HTTP communication with complex JSON schema validation and event mapping.

### 2. Logic & Implementation Gaps

- **Incomplete Features**: `sessionCommands.ts` contains placeholder logic for critical features like saving, listing, and resuming sessions.
- **Synchronous I/O**: `SettingsService.ts` relies on synchronous file system operations (`readFileSync`, `writeFileSync`). While acceptable for CLI startup, this blocks the event loop and may cause stuttering during runtime operations.
- **Complexity**: `ChatContext.tsx` manages too much state (menu, scrolling, messages, networking) in a single huge provider.

### 3. Maintainability & Legacy

- **Large Files**: Multiple files exceed 1000 lines (see `files_split.md` for details).
- **TODOs**: Spread across the codebase, indicating unfinished work in specific areas (`MCPTab`, `App.tsx`, `projectCommands.ts`).
- **Dependencies**: The project structure relies heavily on implicit context availability, leading to complex connection/connection-check logic in commands.

### 4. Security Observations

- **Input Validation**: No obvious `eval()` or `dangerouslySetInnerHTML` usage found, which is good.
- **Config Handling**: `SettingsService.ts` stores configurations in plaintext JSON in the user's home directory. If API keys or sensitive data are added in the future, encryption will be required.

## Detailed Recommendations

### Architecture Refactoring

- **Split Contexts**: Break down `ChatContext` into smaller, focused contexts (e.g., `MessageContext`, `MenuContext`, `ScrollContext`).
- **Compose Providers**: Use a `ComposeProviders` utility or group related providers into wrapper components to flatten `App.tsx`.
- **Custom Hooks**: Extract logic from UI components into custom hooks (`useMCPData`, `useChatLogic`, etc.).

### Code Quality

- **Async I/O**: Convert `SettingsService` to use `fs.promises` for non-blocking operations.
- **Complete Placeholders**: Prioritize implementing the missing logic in `sessionCommands.ts`.

### Testing

- **Unit Tests**: The large size of `ChatContext.tsx` suggests a lack of granular unit tests for its internal logic. Refactoring will enable better testing coverage.
