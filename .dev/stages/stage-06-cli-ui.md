# Stage 06: CLI and UI

## Overview
Provide a full interactive TUI (React + Ink) and a non-interactive runner. Expose model management and settings via CLI flags and slash commands.

## Prerequisites
- Stage 05 complete (Hooks, Extensions, MCP)

## Estimated Effort
4-5 days

## Tech Stack
- React + Ink for terminal UI
- Commander or yargs for CLI parsing

---

## CLI Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--prompt` | `-p` | One-shot prompt (non-interactive) |
| `--model` | `-m` | Select model |
| `--provider` | | Select provider |
| `--host` | | Provider endpoint URL |
| `--list-models` | | List available models |
| `--pull-model <name>` | | Pull/download a model |
| `--remove-model <name>` | | Remove a model |
| `--model-info <name>` | | Show model details |
| `--output` | `-o` | Output format: text, json, stream-json |
| `--debug` | | Enable debug output |
| `--no-color` | | Disable colored output |
| `--config` | `-c` | Config file path |
| `--session` | `-s` | Resume session by ID |
| `--version` | `-v` | Show version |
| `--help` | `-h` | Show help |

---

## Slash Commands (Interactive Mode)

| Command | Description |
|---------|-------------|
| `/model list` | List available models |
| `/model use <name>` | Switch to model |
| `/model pull <name>` | Download model |
| `/model rm <name>` | Remove model |
| `/model info <name>` | Show model details |
| `/provider list` | List providers |
| `/provider use <name>` | Switch provider |
| `/session list` | List saved sessions |
| `/session resume <id>` | Resume session |
| `/session delete <id>` | Delete session |
| `/session save` | Save current session |
| `/extensions list` | List extensions |
| `/extensions enable <name>` | Enable extension |
| `/extensions disable <name>` | Disable extension |
| `/context` | Show context status |
| `/clear` | Clear conversation |
| `/help` | Show commands |
| `/exit` | Exit CLI |

---

## Tasks

### S06-T01: CLI Config Loader

**Steps**:
1. Implement layered settings resolution:
   - System defaults
   - User config (`~/.ollm/config.yaml`)
   - Workspace config (`.ollm/config.yaml`)
   - Environment variables
   - CLI flags (highest priority)
2. Create JSON schema for validation:
   - `schemas/settings.schema.json`
3. Implement config loader:
   - Parse YAML/JSON configs
   - Merge layers
   - Validate against schema
4. Error reporting for invalid configs

**Deliverables**:
- `packages/cli/src/config/configLoader.ts`
- `packages/cli/src/config/configSchema.ts`
- `schemas/settings.schema.json`

**Acceptance Criteria**:
- Settings merge deterministically
- Invalid configs show clear errors
- All layers are respected

---

### S06-T02: Non-Interactive Runner

**Steps**:
1. Implement `packages/cli/src/nonInteractive.ts`:
   - Parse `--prompt` flag
   - Run single turn
   - Output result and exit
2. Support output formats:
   - `text`: Plain text output
   - `json`: JSON object with response
   - `stream-json`: NDJSON stream of events
3. Handle errors gracefully:
   - Exit codes for different errors
   - Error messages to stderr
4. Support piped input

**Deliverables**:
- `packages/cli/src/nonInteractive.ts`

**Acceptance Criteria**:
- `ollm -p "hello"` prints output and exits cleanly
- JSON output is valid
- Errors go to stderr with proper exit codes

---

### S06-T03: Interactive UI

**Steps**:
1. Implement `AppContainer`:
   - Main app wrapper
   - Context providers
   - Keyboard handling
2. Implement UI contexts:
   - `ChatContext`: Conversation state
   - `UIContext`: UI state (focus, mode)
   - `ConfigContext`: Runtime config
3. Implement core components:
   - `ChatHistory`: Message display
   - `InputBox`: User input
   - `ToolConfirmation`: Confirmation dialog
   - `DebugConsole`: Debug output
   - `StatusBar`: Status information
4. Handle streaming:
   - Incremental text rendering
   - Tool call display
   - Progress indicators

**Deliverables**:
- `packages/cli/src/ui/AppContainer.tsx`
- `packages/cli/src/ui/contexts/`
- `packages/cli/src/ui/components/ChatHistory.tsx`
- `packages/cli/src/ui/components/InputBox.tsx`
- `packages/cli/src/ui/components/ToolConfirmation.tsx`
- `packages/cli/src/ui/components/DebugConsole.tsx`
- `packages/cli/src/ui/components/StatusBar.tsx`

**Acceptance Criteria**:
- Chat streams in TUI
- Tool output displays correctly
- Confirmations work
- Keyboard navigation works

---

### S06-T04: Model UI and Status

**Steps**:
1. Implement model picker:
   - List available models
   - Show model details
   - Selection interface
2. Implement status bar:
   - Current model
   - Provider connection status
   - Token count
   - Session info
3. Show model load hints:
   - Loading indicator
   - Error states
   - Retry options

**Deliverables**:
- `packages/cli/src/ui/components/model/ModelPicker.tsx`
- `packages/cli/src/ui/components/model/ModelStatus.tsx`

**Acceptance Criteria**:
- Users can switch models in UI
- Status bar shows current state
- Model loading is indicated

---

## File Structure After Stage 06

```
packages/cli/src/
├── cli.tsx                    # Main entry
├── nonInteractive.ts          # Non-interactive runner
├── config/
│   ├── configLoader.ts
│   └── configSchema.ts
├── commands/
│   ├── slashCommands.ts
│   └── modelCommands.ts
└── ui/
    ├── AppContainer.tsx
    ├── contexts/
    │   ├── ChatContext.tsx
    │   ├── UIContext.tsx
    │   └── ConfigContext.tsx
    └── components/
        ├── ChatHistory.tsx
        ├── InputBox.tsx
        ├── ToolConfirmation.tsx
        ├── DebugConsole.tsx
        ├── StatusBar.tsx
        └── model/
            ├── ModelPicker.tsx
            └── ModelStatus.tsx

schemas/
└── settings.schema.json
```

---

## Settings Schema Structure

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "model": {
      "type": "string",
      "description": "Default model name"
    },
    "provider": {
      "type": "string",
      "description": "Default provider"
    },
    "host": {
      "type": "string",
      "format": "uri",
      "description": "Provider endpoint"
    },
    "options": {
      "type": "object",
      "properties": {
        "temperature": { "type": "number", "minimum": 0, "maximum": 2 },
        "maxTokens": { "type": "integer", "minimum": 1 },
        "topP": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "ui": {
      "type": "object",
      "properties": {
        "theme": { "type": "string", "enum": ["dark", "light"] },
        "showDebug": { "type": "boolean" }
      }
    }
  }
}
```

---

## Output Formats

### Text (default)
```
Hello! How can I help you today?
```

### JSON
```json
{
  "response": "Hello! How can I help you today?",
  "model": "llama3.1:8b",
  "tokens": { "prompt": 10, "completion": 8 },
  "toolCalls": []
}
```

### Stream JSON (NDJSON)
```json
{"type":"text","value":"Hello"}
{"type":"text","value":"! How"}
{"type":"text","value":" can I help"}
{"type":"finish","reason":"stop"}
```

---

## Verification Checklist

- [ ] Config loads from all layers
- [ ] Config validation shows clear errors
- [ ] Non-interactive mode works with `-p`
- [ ] All output formats work correctly
- [ ] Interactive UI renders correctly
- [ ] Chat history displays messages
- [ ] Input box accepts text
- [ ] Tool confirmations work
- [ ] Slash commands execute
- [ ] Model picker works
- [ ] Status bar updates
- [ ] Keyboard shortcuts work
