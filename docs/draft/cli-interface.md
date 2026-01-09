# CLI Interface Plan (OLLM CLI)

## Interaction Modes
- Interactive TUI (React + Ink): chat, tool confirmations, debug console.
- Non-interactive: single prompt or piped input with text or JSON output.

## Commands and Flags
- `ollm` default interactive session.
- `ollm -p '...'` or `ollm --prompt` for one-shot.
- `ollm --model <name>` select model.
- `ollm --provider <name>` select provider.
- `ollm --host <url>` set provider endpoint.
- `ollm --list-models` list local models.
- `ollm --pull-model <name>` download model.
- `ollm --remove-model <name>` delete model.
- `ollm --model-info <name>` show model metadata.
- `ollm --output text|json|stream-json` for automation.
- `ollm --no-color` for plain output.

## Slash Commands (Interactive)
- `/model list`, `/model use <name>`, `/model pull <name>`, `/model rm <name>`.
- `/provider list`, `/provider use <name>`.
- `/session list`, `/session resume <id>`, `/session delete <id>`.
- `/extensions list`, `/extensions enable <name>`.
- `/hooks list`, `/hooks run <event>` (optional).

## UI Components to Add or Update
- ModelPicker: list available models and switch.
- ModelStatusBar: show active provider/model and load state.
- ModelPullProgress: show download progress stream.
- ProviderStatus: connection status and endpoint.
- ToolCallDisplay: keep existing diff and confirmation UI.

## Streaming and Tool UX
- Stream tokens as they arrive; show 'model loading' when initial latency is high.
- Render tool calls with clear context and approval prompts.
- Keep debug console for stream events and tool calls.

## Accessibility and Output
- Preserve screen reader mode with plain text output.
- Non-interactive output supports stable JSON schema for automation.
- Provide `--no-ansi` for pipelines.

## Error Handling
- Friendly errors for server not reachable or model missing.
- Offer 'pull model now?' prompt when model is not present.
