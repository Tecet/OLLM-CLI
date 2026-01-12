# OLLM CLI Commands Reference

Complete reference for all slash commands available in OLLM CLI interactive mode.

---

## Quick Reference Summary

| Category | Commands |
|----------|----------|
| Session | `/new` `/clear` `/compact` |
| Metrics | `/metrics` `/metrics toggle` `/metrics reset` |
| Reasoning | `/reasoning toggle/expand/collapse` |
| Model | `/model list/use/pull/rm/info` |
| Provider | `/provider list/use` |
| Sessions | `/session list/resume/delete/save/export` |
| Context | `/context` `/context size/auto/snapshot/restore/list/stats` |
| Git | `/git status/commit/undo` |
| Review | `/review enable/disable/pending` |
| Extensions | `/extensions list/enable/disable` |
| Theme | `/theme list/use/preview` |
| Memory | `/memory list/add/forget/clear/search` |
| Upload | `/upload` `/uploads list/show/delete/clear` |
| Navigation | `/home` `/help` `/exit` |

**Total: ~55 commands** across all categories.

---

## All Commands by Category

### 🆕 Session Management

| Command | Description |
|---------|-------------|
| `/new` | Start new session (save current, clear all) |
| `/clear` | Clear context, keep system prompt |
| `/compact` | Manual context compression |

### ⚡ Performance Metrics

| Command | Description |
|---------|-------------|
| `/metrics` | Show session performance statistics |
| `/metrics toggle` | Toggle metrics display under responses |
| `/metrics reset` | Reset session statistics |

### 🧠 Reasoning Display

| Command | Description |
|---------|-------------|
| `/reasoning toggle` | Toggle reasoning display globally |
| `/reasoning expand` | Expand all reasoning blocks |
| `/reasoning collapse` | Collapse all reasoning blocks |

### 🤖 Model Management

| Command | Description |
|---------|-------------|
| `/model list` | List available models |
| `/model use <name>` | Switch to model |
| `/model pull <name>` | Download model |
| `/model rm <name>` | Remove model |
| `/model info <name>` | Show model details |

### 🔌 Provider Management

| Command | Description |
|---------|-------------|
| `/provider list` | List providers |
| `/provider use <name>` | Switch provider |

### 💾 Session Persistence

| Command | Description |
|---------|-------------|
| `/session list` | List saved sessions |
| `/session resume <id>` | Resume session |
| `/session delete <id>` | Delete session |
| `/session save` | Save current session |
| `/session export` | Export as markdown |

### 🧠 Context Management

| Command | Description |
|---------|-------------|
| `/context` | Show context status (tokens, VRAM, snapshots) |
| `/context size <tokens>` | Set target context size |
| `/context auto` | Enable auto-sizing based on VRAM |
| `/context snapshot` | Create manual snapshot |
| `/context restore <id>` | Restore from snapshot |
| `/context list` | List all snapshots |
| `/context stats` | Detailed memory statistics |

### 📂 Git Integration

| Command | Description |
|---------|-------------|
| `/git status` | Show git status |
| `/git commit [message]` | Commit changes |
| `/git undo` | Undo last change |

### 👀 Diff Review

| Command | Description |
|---------|-------------|
| `/review enable` | Enable diff review mode |
| `/review disable` | Disable diff review mode |
| `/review pending` | Show pending reviews |

### 🔧 Extensions

| Command | Description |
|---------|-------------|
| `/extensions list` | List extensions |
| `/extensions enable <name>` | Enable extension |
| `/extensions disable <name>` | Disable extension |

### 🎨 Theme Customization

| Command | Description |
|---------|-------------|
| `/theme list` | List available themes |
| `/theme use <name>` | Switch to theme |
| `/theme preview <name>` | Preview theme without saving |

### 🧠 Memory (Cross-Session)

| Command | Description |
|---------|-------------|
| `/memory list` | Show all stored memories |
| `/memory add <key> <value>` | Add or update a memory |
| `/memory forget <key>` | Remove a specific memory |
| `/memory clear` | Clear all memories |
| `/memory search <query>` | Search memories |

### 📎 File Upload

| Command | Description |
|---------|-------------|
| `/upload <path>` | Upload file to session |
| `/upload --paste` | Upload from clipboard |
| `/uploads list` | List session uploads |
| `/uploads show <id>` | Preview upload info |
| `/uploads delete <id>` | Delete specific upload |
| `/uploads clear` | Clear all session uploads |

### 📚 Navigation & Help

| Command | Description |
|---------|-------------|
| `/home` | Return to launch screen |
| `/help` | Show available commands |
| `/exit` | Exit CLI |

---

## Detailed Command Reference

Below is the in-depth documentation for each command.

---

## Session Commands

Quick commands for managing your current chat session.

### `/new`

Start a fresh session, clearing everything.

```
/new
```

**Behavior**:
- Prompts for confirmation before clearing
- Saves current session as a snapshot (auto-backup)
- Clears all conversation history
- Resets context to empty
- Resets session statistics (token counts, t/s metrics)

**Example output**:
```
Start new session? Current session will be saved. [y/N] y
Started new session. Previous session saved as snapshot.
```

---

### `/clear`

Clear the conversation context while keeping the system prompt.

```
/clear
```

**Behavior**:
- Clears all messages except the system prompt
- Preserves model settings and configuration
- Keeps session metadata (costs, etc.)
- No confirmation needed (can restore via `/context restore`)

**Use case**: Reset context when it gets too long, without losing your system prompt configuration.

**Example output**:
```
Context cleared. System prompt preserved.
```

---

### `/compact`

Manually trigger context compression to reduce token usage.

```
/compact
```

**Behavior**:
- Uses configured compression strategy (summarize/truncate/hybrid)
- Preserves recent messages intact
- Shows before/after token counts
- Reports compression percentage

**Example output**:
```
Compacted: 8,234 → 2,156 tokens (74% reduction)
```

**Use case**: When approaching context limits, compact older messages to free up space for new conversation.

---

## Performance Metrics Commands

Commands for viewing and controlling inference performance metrics.

### `/metrics`

Display current session performance statistics.

```
/metrics
```

**Example output**:
```
┌─ Session Performance ──────────────────────────────────────────────────────┐
│  Total Generations:     15                                                 │
│  Total Tokens:          2,847 (1,234 prompt + 1,613 completion)           │
│  Total Time:            42.3s                                              │
│                                                                            │
│  Average Speed:         38.1 t/s                                           │
│  Fastest:               52.3 t/s                                           │
│  Slowest:               12.8 t/s                                           │
│  Average TTFT:          0.15s                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### `/metrics toggle`

Toggle the display of per-response metrics under each LLM response.

```
/metrics toggle
```

**Behavior**:
- Toggles visibility of the metrics line under assistant messages
- Shortcut: `Ctrl+M`

**Metrics shown per response**:
- ⚡ Tokens per second (generation speed)
- 📥 Input tokens (prompt/context)
- 📤 Output tokens (generated)
- ⏱️ Total generation time
- TTFT (Time to First Token)

---

### `/metrics reset`

Reset all session performance statistics.

```
/metrics reset
```

**Behavior**:
- Clears all accumulated metrics
- Resets generation count, token totals, and averages
- Does NOT clear conversation history

---

## Reasoning Commands

Commands for controlling the display of reasoning model thinking process.

### `/reasoning toggle`

Toggle the display of reasoning blocks globally.

```
/reasoning toggle
```

**Behavior**:
- Shows/hides all `<think>` blocks from reasoning models
- Shortcut: `Ctrl+R`

---

### `/reasoning expand`

Expand all reasoning blocks in the current session.

```
/reasoning expand
```

**Behavior**:
- Expands all collapsed reasoning boxes
- Shows full reasoning content

---

### `/reasoning collapse`

Collapse all reasoning blocks in the current session.

```
/reasoning collapse
```

**Behavior**:
- Collapses all expanded reasoning boxes
- Shows only summary with token count and duration

---

## Model Commands

Commands for managing LLM models.

### `/model list`

List all available models from the current provider.

```
/model list
```

**Example output**:
```
Available Models:
  ● llama3.2:3b (active)     3.2 GB   
    llama3.1:8b              4.7 GB   
    codellama:7b             3.8 GB   
    mistral:7b               4.1 GB   
```

---

### `/model use <name>`

Switch to a different model.

```
/model use llama3.1:8b
```

**Behavior**:
- Loads the specified model
- May trigger model download if not available locally
- Preserves conversation context (if compatible)

**Example output**:
```
Switching to llama3.1:8b...
Model loaded. Context preserved.
```

---

### `/model pull <name>`

Download a model from the registry.

```
/model pull llama3.2:3b
```

**Behavior**:
- Downloads the model from the provider's registry
- Shows download progress
- Model becomes available after download completes

**Example output**:
```
Pulling llama3.2:3b...
[████████████████████████] 100% 3.2 GB
Model llama3.2:3b ready.
```

---

### `/model rm <name>`

Remove a model from local storage.

```
/model rm codellama:7b
```

**Behavior**:
- Deletes the model files from disk
- Cannot remove the currently active model
- Prompts for confirmation

---

### `/model info <name>`

Show detailed information about a model.

```
/model info llama3.2:3b
```

**Example output**:
```
Model: llama3.2:3b
Size: 3.2 GB
Parameters: 3B
Context Length: 131072 tokens
Quantization: Q4_K_M
Family: llama3
License: Llama 3.2 Community License
```

---

## Provider Commands

Commands for managing LLM providers.

### `/provider list`

List all configured providers.

```
/provider list
```

**Example output**:
```
Providers:
  ● ollama (active)     http://localhost:11434
    lm-studio           http://localhost:1234
    vllm                http://localhost:8000
```

---

### `/provider use <name>`

Switch to a different provider.

```
/provider use lm-studio
```

**Behavior**:
- Connects to the specified provider
- Lists available models from the new provider
- May prompt to select a model

---

## Session Commands (Persistence)

Commands for saving and restoring chat sessions.

### `/session list`

List all saved sessions.

```
/session list
```

**Example output**:
```
Saved Sessions:
  1. "Fixing auth bug" - 2 hours ago (1,234 tokens)
  2. "Refactoring utils" - yesterday (3,456 tokens)
  3. "New feature planning" - 3 days ago (2,100 tokens)
```

---

### `/session resume <id>`

Resume a previously saved session.

```
/session resume 1
```

**Behavior**:
- Loads the session's conversation history
- Restores context and settings
- Current session is auto-saved before switching

---

### `/session delete <id>`

Delete a saved session.

```
/session delete 3
```

**Behavior**:
- Permanently removes the session
- Prompts for confirmation

---

### `/session save`

Manually save the current session.

```
/session save
```

**Behavior**:
- Creates a named checkpoint of current conversation
- Prompts for session name/description

---

### `/session export`

Export the current session as a markdown file.

```
/session export
```

**Behavior**:
- Creates a `.md` file with formatted conversation
- Includes metadata (model, tokens, timestamps)
- Opens file location or prompts for save path

---

## Context Commands

Advanced commands for managing context and memory.

### `/context`

Display current context status.

```
/context
```

**Example output**:
```
Context Status:
  Model: llama3.2:3b
  Tokens: 8,234 / 32,768 (25.1%)
  VRAM: 6.2 / 8.0 GB (77.5%)
  KV Cache: q8_0 (1.2 GB)
  Snapshots: 3 available
  Auto-compress: enabled at 80%
```

---

### `/context size <tokens>`

Set a specific target context size.

```
/context size 16384
```

**Behavior**:
- Sets the maximum context size in tokens
- May trigger model reload if context exceeds new limit
- Overrides auto-sizing

---

### `/context auto`

Enable automatic context sizing based on available VRAM.

```
/context auto
```

**Behavior**:
- Calculates optimal context based on GPU memory
- Adjusts dynamically as VRAM usage changes
- Accounts for model size and KV cache quantization

---

### `/context snapshot`

Create a manual snapshot of the current context.

```
/context snapshot
```

**Behavior**:
- Saves current conversation state
- Creates a restore point
- Useful before risky operations

**Example output**:
```
Snapshot created: snap_20240115_143022
Tokens: 8,234 | Messages: 24
```

---

### `/context restore <id>`

Restore context from a snapshot.

```
/context restore snap_20240115_143022
```

**Behavior**:
- Replaces current context with snapshot
- Restores all messages and metadata

---

### `/context list`

List all available snapshots.

```
/context list
```

**Example output**:
```
Snapshots:
  1. snap_20240115_143022 - 10 min ago (8,234 tokens)
  2. snap_20240115_140000 - 45 min ago (6,100 tokens)
  3. snap_20240114_220000 - yesterday (12,500 tokens)
```

---

### `/context stats`

Display detailed memory and performance statistics.

```
/context stats
```

**Example output**:
```
Detailed Context Statistics:
  
  Memory:
    Model Weights: 3.2 GB
    KV Cache: 1.2 GB (q8_0)
    Total VRAM: 4.4 / 8.0 GB
    Safety Buffer: 512 MB reserved
  
  Context:
    Current: 8,234 tokens
    Maximum: 32,768 tokens
    Usage: 25.1%
  
  Compression History:
    Last compressed: 30 min ago
    Ratio: 8,500 → 2,100 (75% reduction)
    
  Session:
    Duration: 1h 23m
    Messages: 24
    Snapshots: 3
```

---

## Git Commands

Commands for Git integration.

### `/git status`

Show current Git status.

```
/git status
```

**Example output**:
```
Branch: main
Changes:
  M  src/auth/login.ts
  M  src/utils/token.ts
  A  src/utils/validate.ts
Staged: 1 file
```

---

### `/git commit [message]`

Commit staged changes.

```
/git commit "Fix token validation"
```

**Behavior**:
- Commits all staged changes
- If no message provided, prompts for one
- Shows commit hash on success

---

### `/git undo`

Undo the last change made by the assistant.

```
/git undo
```

**Behavior**:
- Reverts the most recent file modification
- Only affects changes made in current session
- Shows which files were reverted

---

## Review Commands

Commands for diff review mode.

### `/review enable`

Enable diff review mode.

```
/review enable
```

**Behavior**:
- All file modifications require approval before applying
- Shows diffs inline or in Tools tab
- Prevents accidental changes

---

### `/review disable`

Disable diff review mode.

```
/review disable
```

**Behavior**:
- File modifications apply immediately
- No approval required
- Faster workflow, less control

---

### `/review pending`

Show all pending changes awaiting review.

```
/review pending
```

**Behavior**:
- Lists all unapproved diffs
- Shows file names and change summaries
- Option to approve/reject individually or batch

---

## Extensions Commands

Commands for managing extensions.

### `/extensions list`

List all available extensions.

```
/extensions list
```

**Example output**:
```
Extensions:
  ● codebase-search (enabled)
  ● web-browser (enabled)
    image-generation (disabled)
    voice-input (disabled)
```

---

### `/extensions enable <name>`

Enable an extension.

```
/extensions enable image-generation
```

---

### `/extensions disable <name>`

Disable an extension.

```
/extensions disable web-browser
```

---

## Theme Commands

Commands for customizing the UI appearance.

### `/theme list`

Show all available themes.

```
/theme list
```

**Example output**:
```
Available Themes:
  ● default-dark (active)
    dracula
    nord
    monokai
    solarized-dark
    custom (ui.yaml)
```

---

### `/theme use <name>`

Switch to a different theme.

```
/theme use dracula
```

**Behavior**:
- Changes apply immediately
- Persists across sessions
- Updates all UI colors

---

### `/theme preview <name>`

Preview a theme without saving.

```
/theme preview nord
```

**Behavior**:
- Temporarily applies theme
- Does not save preference
- Press Escape to revert

---

## Memory Commands

Commands for managing cross-session memory.

### `/memory list`

Show all stored memories.

```
/memory list
```

**Example output**:
```
Memories (5):
  [preference] preferred-language: User prefers TypeScript
  [fact] project-db: Uses PostgreSQL with Prisma
  [fact] auth-method: JWT-based authentication
  [preference] code-style: Async/await over .then()
  [context] current-task: Refactoring auth module
```

---

### `/memory add <key> <value>`

Add or update a memory.

```
/memory add db-type We use PostgreSQL with Prisma ORM
```

**Behavior**:
- Creates new memory if key doesn't exist
- Updates value if key exists
- Default category: `fact`

**Options**:
```
/memory add --preference code-style Use arrow functions
/memory add --context current-task Working on auth
```

---

### `/memory forget <key>`

Remove a specific memory.

```
/memory forget db-type
```

---

### `/memory clear`

Clear all stored memories.

```
/memory clear
```

**Behavior**:
- Prompts for confirmation
- Removes all memories permanently

---

### `/memory search <query>`

Search memories by content.

```
/memory search database
```

---

## Upload Commands

Commands for managing file uploads in the current session.

### `/upload <path>`

Upload a file to the current session.

```
/upload ./screenshot.png
/upload ~/Desktop/error.log
/upload ./src/*.ts
```

**Behavior**:
- Supports glob patterns
- Images sent to vision models as base64
- Text files extracted and included in context
- Max file size: 10MB (configurable)

---

### `/upload --paste`

Upload image from clipboard.

```
/upload --paste
```

**Behavior**:
- Detects image in clipboard
- Prompts for confirmation
- Uploads to session

---

### `/uploads list`

List all files uploaded in current session.

```
/uploads list
```

**Example output**:
```
Session Uploads (3):
  🖼️ screenshot.png     1.2 MB   2 min ago
  📄 error.log          24 KB    5 min ago
  💻 snippet.ts         856 B    10 min ago
```

---

### `/uploads show <id>`

Preview upload information.

```
/uploads show screenshot.png
```

---

### `/uploads delete <id>`

Delete a specific upload.

```
/uploads delete error.log
```

---

### `/uploads clear`

Clear all session uploads.

```
/uploads clear
```

**Behavior**:
- Removes all uploaded files from session
- Frees storage space
- Cannot be undone

---

## Navigation Commands

General navigation and help commands.

### `/home`

Return to the launch screen.

```
/home
```

**Behavior**:
- Shows ASCII art logo
- Displays quick actions and recent sessions
- Press any key to return to chat

---

### `/help`

Display available commands.

```
/help
```

**Behavior**:
- Shows command categories and descriptions
- Use `/help <command>` for detailed help on specific command

---

### `/exit`

Exit OLLM CLI.

```
/exit
```

**Behavior**:
- Prompts to save session if unsaved changes exist
- Closes the application

---

## Keyboard Shortcuts

In addition to slash commands, these shortcuts are available:

| Shortcut | Action |
|----------|--------|
| `Ctrl+1-6` | Switch tabs (Chat, Tools, Files, Search, Docs, Settings) |
| `Ctrl+P` | Toggle side panel |
| `Ctrl+M` | Toggle metrics display |
| `Ctrl+R` | Toggle reasoning display |
| `Ctrl+L` | Clear chat (`/clear`) |
| `Ctrl+S` | Save session |
| `Ctrl+K` | Command palette |
| `Ctrl+/` | Toggle debug mode |
| `Esc` | Cancel / Return to input |
| `↑` | Edit previous message |
| `Enter` | Send message |
| `Shift+Enter` | Newline in input |
| `y` / `n` | Approve / Reject (in review mode) |

---

## See Also

- [UI Design Specification](ui-design-spec.md) - Full UI layout and component details
- [Context Management](context-management-plan.md) - Deep dive into context features
- [Provider Systems](provider-systems.md) - Provider configuration and setup
