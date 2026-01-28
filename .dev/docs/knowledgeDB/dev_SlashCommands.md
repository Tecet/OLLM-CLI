# Slash Commands

**Last Updated:** January 26, 2026  
**Status:** ✅ Implemented  
**Related Documents:**

- `dev_HookSystem.md` - Hook commands
- `dev_MCPIntegration.md` - MCP commands
- `dev_ContextManagement.md` - Context commands
- `dev_ContextCompression.md` - Session/snapshot commands
- `dev_ModelManagement.md` - Model commands

---

## Overview

Slash commands provide quick access to OLLM CLI features. Commands start with `/` and can have subcommands and aliases.

**Command Format:**

```
/command [subcommand] [arguments] [--flags]
```

**Examples:**

```bash
/help                    # Show help
/model list              # List models
/session save my-work    # Save session
/mode assist             # Switch to assist mode
```

---

## Session Management

### `/new`

**Aliases:** None  
**Description:** Create a new session (clears current context)  
**Usage:** `/new`

### `/clear`

**Aliases:** `/cls`  
**Description:** Clear chat history (keeps context)  
**Usage:** `/clear`

### `/compact`

**Aliases:** None  
**Description:** Compress context to reduce token usage  
**Usage:** `/compact`

### `/session`

**Aliases:** None  
**Description:** Manage chat sessions  
**Subcommands:**

- `save <name>` - Save current session
- `list` - List saved sessions
- `resume <name>` - Resume a saved session
- `delete <name>` - Delete a saved session
- `export <name> [format]` - Export session (json, markdown, html)

**Examples:**

```bash
/session save my-work
/session list
/session resume my-work
/session export my-work markdown
```

---

## Context Management

### `/context`

**Aliases:** None  
**Description:** Manage context  
**Subcommands:**

- `size <tokens>` - Set context size
- `auto` - Enable auto-sizing
- `snapshot` - Create context snapshot
- `restore <id>` - Restore from snapshot
- `list` - List snapshots
- `stats` - Show context statistics

**Examples:**

```bash
/context size 16384
/context auto
/context snapshot
/context stats
```

### `/snapshot`

**Aliases:** None  
**Description:** Manage context snapshots  
**Subcommands:**

- `list` - List all snapshots
- `show <id>` - Show snapshot details
- `restore <id>` - Restore from snapshot
- `rollback` - Rollback to previous snapshot
- `create [name]` - Create named snapshot

**Examples:**

```bash
/snapshot list
/snapshot create before-refactor
/snapshot restore snap-123
/snapshot rollback
```

---

## Model Management

### `/model`

**Aliases:** None  
**Description:** Manage models  
**Subcommands:**

- `list` - List available models
- `use <name>` - Switch to a model
- `pull <name>` - Download a model
- `delete <name>` - Delete a model
- `info <name>` - Show model information
- `keep <name>` - Keep model in memory
- `unload <name>` - Unload model from memory
- `help` - Show model help

**Examples:**

```bash
/model list
/model use llama3:8b
/model pull llama3.2:3b
/model info llama3:8b
/model keep llama3:8b
```

---

## Mode Management

### `/mode`

**Aliases:** `/m`  
**Description:** Switch operational modes  
**Subcommands:**

- `assist` - Assistant mode (general help)
- `plan` - Planning mode (task planning)
- `dev` - Developer mode (coding focus)
- `debug` - Debugger mode (error analysis)
- `review` - Review mode (code review)
- `architect` - Architect mode (system design)
- `test` - Test mode (testing focus)
- `docs` - Documentation mode
- `research` - Research mode
- `project` - Project mode

**Examples:**

```bash
/mode assist
/mode dev
/mode plan
```

### Mode Shortcuts

**`/assist`** (alias: `/a`) - Switch to assistant mode  
**`/plan`** (alias: `/p`) - Switch to planning mode  
**`/dev`** (alias: `/d`) - Switch to developer mode  
**`/debug`** - Debugger mode with subcommands:

- `trace` - Analyze stack trace
- `reproduce` - Reproduce error
- `bisect` - Binary search for bug

**Examples:**

```bash
/assist
/plan
/dev
/debug trace
```

---

## Provider Management

### `/provider`

**Aliases:** None  
**Description:** Manage providers  
**Subcommands:**

- `list` - List available providers
- `use <name>` - Switch to a provider

**Examples:**

```bash
/provider list
/provider use ollama
```

---

## Configuration

### `/config`

**Aliases:** None  
**Description:** View and manage configuration  
**Subcommands:**

- `show` - Show current configuration
- `set <key> <value>` - Set configuration value
- `get <key>` - Get configuration value
- `reset` - Reset to defaults

**Examples:**

```bash
/config show
/config set theme dark
/config get theme
```

---

## MCP (Model Context Protocol)

### `/mcp`

**Aliases:** None  
**Description:** Manage MCP servers  
**Subcommands:**

- `list [--tools|--resources|--prompts]` - List MCP servers or their capabilities
- `tools <server>` - List tools from a server
- `resources <server>` - List resources from a server
- `prompts <server>` - List prompts from a server
- `status [server]` - Show server status
- `health` - Check health of all servers
- `health check <server>` - Check specific server health
- `restart <server>` - Restart a server
- `health start` - Start health monitoring
- `health stop` - Stop health monitoring
- `health status` - Show monitoring status

**Examples:**

```bash
/mcp list
/mcp list --tools
/mcp tools github
/mcp status github
/mcp health
/mcp restart github
```

### MCP OAuth

**Subcommands:**

- `oauth login <server>` - Authenticate with OAuth
- `oauth status <server>` - Check token status
- `oauth revoke <server>` - Revoke tokens
- `oauth list` - List all tokens

**Examples:**

```bash
/mcp oauth login github
/mcp oauth status github
/mcp oauth revoke github
```

---

## Extensions

### `/extensions`

**Aliases:** `/ext`  
**Description:** Manage extensions  
**Subcommands:**

- `search <query> [--limit <n>]` - Search marketplace
- `install <name> [version]` - Install extension
- `list [--all]` - List installed extensions
- `enable <name>` - Enable extension
- `disable <name>` - Disable extension
- `info <name>` - Show extension details
- `reload` - Reload all extensions

**Examples:**

```bash
/extensions search github
/extensions install github-integration
/extensions list
/extensions enable github-integration
/extensions info github-integration
```

---

## Hooks

### `/hooks`

**Aliases:** None  
**Description:** Manage hooks  
**Subcommands:**

- `debug on` - Enable hook debugging
- `debug off` - Disable hook debugging

**Examples:**

```bash
/hooks debug on
/hooks debug off
```

---

## Git Integration

### `/git`

**Aliases:** None  
**Description:** Git operations  
**Subcommands:**

- `status` - Show git status
- `diff` - Show git diff
- `commit <message>` - Commit changes
- `log [n]` - Show commit log
- `branch` - List branches
- `checkout <branch>` - Switch branch

**Examples:**

```bash
/git status
/git diff
/git commit "Fix bug"
/git log 5
```

---

## Review & Diff

### `/review`

**Aliases:** None  
**Description:** Manage diff reviews  
**Subcommands:**

- `enable` - Enable diff review mode
- `disable` - Disable diff review mode
- `pending` - Show pending reviews

**Examples:**

```bash
/review enable
/review pending
/review disable
```

---

## Workflows

### `/workflow`

**Aliases:** `/wf`  
**Description:** Manage workflows  
**Subcommands:**

- `start <name>` - Start a workflow
- `status` - Show current workflow progress
- `next` - Move to next step
- `prev` - Go back to previous step
- `skip` - Skip current step (if optional)
- `pause` - Pause workflow
- `resume` - Resume paused workflow
- `exit` - Exit current workflow
- `list` - List available workflows

**Examples:**

```bash
/workflow start refactor
/workflow status
/workflow next
/workflow pause
```

---

## Templates

### `/template`

**Aliases:** None  
**Description:** Manage prompt templates  
**Subcommands:**

- `list` - List available templates
- `use <name>` - Use a template
- `create <name>` - Create new template

**Examples:**

```bash
/template list
/template use code-review
/template create my-template
```

---

## Themes

### `/theme`

**Aliases:** None  
**Description:** Manage UI themes  
**Subcommands:**

- `list` - List available themes
- `use <name>` - Switch to a theme
- `preview <name>` - Preview a theme

**Examples:**

```bash
/theme list
/theme use dark
/theme preview monokai
```

---

## Memory Management

### `/memory`

**Aliases:** None  
**Description:** Manage cross-session memory  
**Subcommands:**

- `list` - List stored memories
- `add <key> <value>` - Add memory
- `get <key>` - Get memory value
- `delete <key>` - Delete memory
- `clear` - Clear all memories

**Examples:**

```bash
/memory list
/memory add project-name "My Project"
/memory get project-name
```

---

## Project Profiles

### `/project`

**Aliases:** None  
**Description:** Manage project profiles  
**Subcommands:**

- `detect` - Auto-detect project type
- `use <profile>` - Use a project profile
- `init` - Initialize project profile

**Examples:**

```bash
/project detect
/project use react
/project init
```

---

## Metrics & Performance

### `/metrics`

**Aliases:** None  
**Description:** Manage performance metrics  
**Subcommands:**

- `toggle` - Toggle metrics display
- `reset` - Reset metrics
- (no args) - Show current metrics

**Examples:**

```bash
/metrics
/metrics toggle
/metrics reset
```

---

## Reasoning Display

### `/reasoning`

**Aliases:** None  
**Description:** Manage reasoning display  
**Subcommands:**

- `toggle` - Toggle reasoning display
- `expand` - Expand reasoning
- `collapse` - Collapse reasoning

**Examples:**

```bash
/reasoning toggle
/reasoning expand
```

---

## Comparison Mode

### `/compare`

**Aliases:** None  
**Description:** Compare outputs from multiple models  
**Usage:** `/compare <model1> <model2> [model3...]`

**Examples:**

```bash
/compare llama3:8b llama3:13b
/compare llama3:8b mistral:7b codellama:7b
```

---

## Utility Commands

### `/help`

**Aliases:** `/?`  
**Description:** Show help information  
**Usage:** `/help [command]`

**Examples:**

```bash
/help
/help model
/help session
```

### `/exit`

**Aliases:** `/quit`, `/q`  
**Description:** Exit OLLM CLI  
**Usage:** `/exit`

### `/home`

**Aliases:** None  
**Description:** Return to the launch screen  
**Usage:** `/home`

### `/test prompt`

**Aliases:** None  
**Description:** Dump current prompt/context details as system message  
**Usage:** `/test prompt`

---

## Command Aliases Quick Reference

| Command       | Aliases       |
| ------------- | ------------- |
| `/help`       | `/?`          |
| `/exit`       | `/quit`, `/q` |
| `/clear`      | `/cls`        |
| `/mode`       | `/m`          |
| `/assist`     | `/a`          |
| `/plan`       | `/p`          |
| `/dev`        | `/d`          |
| `/workflow`   | `/wf`         |
| `/extensions` | `/ext`        |

---

## File Locations

| File                                             | Purpose                        |
| ------------------------------------------------ | ------------------------------ |
| `packages/cli/src/commands/commandRegistry.ts`   | Command registration system    |
| `packages/cli/src/commands/sessionCommands.ts`   | Session management commands    |
| `packages/cli/src/commands/contextCommands.ts`   | Context management commands    |
| `packages/cli/src/commands/modelCommands.ts`     | Model management commands      |
| `packages/cli/src/commands/modeCommands.ts`      | Mode switching commands        |
| `packages/cli/src/commands/modeShortcuts.ts`     | Mode shortcut commands         |
| `packages/cli/src/commands/mcpCommands.ts`       | MCP server commands            |
| `packages/cli/src/commands/mcpHealthCommands.ts` | MCP health monitoring commands |
| `packages/cli/src/commands/mcpOAuthCommands.ts`  | MCP OAuth commands             |
| `packages/cli/src/commands/extensionCommands.ts` | Extension marketplace commands |
| `packages/cli/src/commands/hookCommands.ts`      | Hook management commands       |
| `packages/cli/src/commands/gitCommands.ts`       | Git integration commands       |
| `packages/cli/src/commands/workflowCommands.ts`  | Workflow commands              |
| `packages/cli/src/commands/utilityCommands.ts`   | Utility commands (help, exit)  |
| `packages/cli/src/commands/types.ts`             | Command type definitions       |

---

## Post-Alpha Tasks

### Task: Integrate Commands into Help System

**Priority:** Medium  
**Effort:** 4-6 hours

**Goal:** Make all commands discoverable via `/help` command

**Implementation:**

1. Update `helpCommand` in `utilityCommands.ts`
2. Add command categories
3. Add command search
4. Add detailed help for each command
5. Add examples for each command

**Files to Modify:**

- `packages/cli/src/commands/utilityCommands.ts` - Update help command
- `packages/cli/src/commands/commandRegistry.ts` - Add command metadata

**Success Criteria:**

- `/help` shows all commands organized by category
- `/help <command>` shows detailed help for specific command
- `/help search <query>` finds commands by keyword
- All commands have descriptions and examples

---

## Notes

- Commands are case-insensitive
- Subcommands can be abbreviated if unambiguous
- Use `--help` flag on any command for detailed help
- Commands support tab completion (when implemented)
- Some commands require specific context (e.g., `/workflow` requires active workflow)
