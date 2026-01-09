# Stage 06 - CLI and UI

## Baseline Context (standalone)
- Core runtime, tools, services, hooks, and extensions exist.
- React + Ink for the terminal UI.

## Goals
- Provide a full interactive TUI and a non-interactive runner.
- Expose model management and settings via CLI flags and slash commands.

## CLI Flags
- --prompt, -p: one-shot prompt
- --model, -m: select model
- --provider: select provider
- --host: provider endpoint
- --list-models
- --pull-model <name>
- --remove-model <name>
- --model-info <name>
- --output text|json|stream-json
- --debug
- --no-color

## Slash Commands (interactive)
- /model list
- /model use <name>
- /model pull <name>
- /model rm <name>
- /provider list
- /provider use <name>
- /session list
- /session resume <id>
- /session delete <id>
- /extensions list

## Tasks

### S06-T01: CLI config loader
Steps:
- Implement layered settings: system, user, workspace, env, flags.
- Add schema validation and error reporting.
Deliverables:
- `packages/cli/src/config/` and `schemas/settings.schema.json`
Acceptance criteria:
- Settings merge deterministically and validate on load.

### S06-T02: Non-interactive runner
Steps:
- Implement `packages/cli/src/nonInteractive.ts`.
- Support text and JSON output formats.
Deliverables:
- Non-interactive command path in CLI.
Acceptance criteria:
- `ollm -p "hello"` prints output and exits cleanly.

### S06-T03: Interactive UI
Steps:
- Implement `AppContainer` and UI contexts.
- Render chat history, tool confirmations, debug console.
Deliverables:
- `packages/cli/src/ui/*`
Acceptance criteria:
- Chat streams in the TUI with tool output and confirmations.

### S06-T04: Model UI and status
Steps:
- Add model picker and status bar.
- Show provider connection status and model load hints.
Deliverables:
- `packages/cli/src/ui/components/model/*`
Acceptance criteria:
- Users can switch models in UI.
