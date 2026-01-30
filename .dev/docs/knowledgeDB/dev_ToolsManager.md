# Tools Management System

**Last Updated:** 2026-01-30  
**Status:** Production  
**Purpose:** Technical reference for tool registration, configuration, and management

## Overview

The Tools Management System handles:
- **Tool Registration** - Built-in and MCP tools
- **Tool Configuration** - Per-mode enable/disable
- **Tool Filtering** - Dynamic based on mode and settings
- **Tool UI** - User interface for managing tools
- **Tool Execution** - Safe execution with permissions

## Architecture

### Component Flow

```
Tool Definition
  ↓
ToolRegistry (registration)
  ↓
SettingsService (user configuration)
  ↓
SystemPromptBuilder (filtering)
  ↓
LLM (receives filtered tools)
  ↓
Tool Execution (with permissions)
```

---

## Tool Registry

**Location:** `packages/core/src/tools/tool-registry.ts`

**Purpose:** Central registry for all available tools

### Registration

```typescript
interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  inputSchema: JSONSchema;
  handler: (args: any) => Promise<any>;
  requiresConfirmation?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
}

// Register a tool
toolRegistry.registerTool(definition);

// Get all tools
const tools = toolRegistry.getAllTools();

// Get tool by ID
const tool = toolRegistry.getTool('read_file');
```

### Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| **File Discovery** | `glob`, `ls`, `grep`, `file_search` | Find and search files |
| **File Reading** | `read_file`, `read_multiple_files` | Read file contents |
| **File Writing** | `write_file`, `edit_file`, `str_replace` | Modify files |
| **Web** | `web_search`, `web_fetch` | Internet access |
| **Shell** | `shell` | Execute commands |
| **Memory** | `write_memory_dump`, `read_reasoning` | Context management |
| **Git** | `git_*` | Version control |
| **MCP** | `mcp:*` | External MCP tools |
| **Diagnostics** | `get_diagnostics` | Code analysis |

---

## Settings Service

**Location:** `packages/cli/src/config/settingsService.ts`

**Purpose:** Manage user tool configuration

### Settings Structure

**File:** `~/.ollm/settings.json`

```json
{
  "tools": {
    "read_file": true,
    "write_file": true,
    "shell": true,
    ...
  },
  "toolsByMode": {
    "developer": {
      "read_file": true,
      "write_file": true,
      "shell": true,
      ...
    },
    "assistant": {
      "read_file": true,
      "web_search": true,
      "web_fetch": true,
      "write_file": false,
      "shell": false,
      ...
    },
    ...
  }
}
```

### Key Methods

```typescript
// Get tools enabled for a mode
getToolsForMode(mode: string): string[]

// Set tool state for a mode
setToolForMode(mode: string, toolId: string, enabled: boolean): void

// Get mode settings for a tool
getModeSettingsForTool(toolId: string): Record<string, boolean>

// Reset tool to defaults
resetToolToDefaults(toolId: string): void

// Initialize all tools with defaults
initializeToolSettings(toolIds: string[]): void
```

### Default Tool Configuration

```typescript
const DEFAULT_TOOLS_BY_MODE = {
  developer: ['*'],  // All tools enabled
  
  debugger: ['*'],   // All tools enabled
  
  assistant: [
    'read_file',
    'web_search',
    'web_fetch'
  ],
  
  planning: [
    'read_file',
    'read_multiple_files',
    'grep_search',
    'file_search',
    'list_directory',
    'web_search',
    'web_fetch',
    'get_diagnostics',
    'write_memory_dump',
    'mcp:*'
  ],
  
  user: ['*']  // All tools, user can customize
};
```

---

## Tool Filtering

**Purpose:** Dynamically filter tools based on mode and user settings

### Filtering Flow

```
1. User switches to mode (e.g., 'assistant')
   ↓
2. SettingsService.getToolsForMode('assistant')
   ↓
3. Returns: ['read_file', 'web_search', 'web_fetch']
   ↓
4. SystemPromptBuilder.filterToolDescriptions(fullText, allowedTools)
   ↓
5. Only allowed tools included in system prompt
   ↓
6. LLM sees only: read_file, web_search, web_fetch
```

### Wildcard Support

**Location:** `packages/core/src/context/SystemPromptBuilder.ts`

**Method:** `filterToolDescriptions(fullText: string, allowedTools: string[]): string`

| Pattern | Matches | Example |
|---------|---------|---------|
| `'*'` | All tools | All enabled tools |
| `'mcp:*'` | Prefix match | All MCP tools (mcp:weather, mcp:calendar, etc.) |
| `'git_*'` | Prefix match | All git tools (git_status, git_commit, etc.) |
| `'read_file'` | Exact match | Only read_file tool |

**Implementation:**
```typescript
filterToolDescriptions(fullText: string, allowedTools: string[]): string {
  // If wildcard, return all
  if (allowedTools.includes('*')) {
    return fullText;
  }

  const lines = fullText.split('\n');
  const filtered: string[] = [];

  for (const line of lines) {
    if (line.startsWith('- **')) {
      const match = line.match(/- \*\*([^:]+):/);
      if (match) {
        const toolName = match[1];
        
        const isAllowed = allowedTools.some((allowed) => {
          if (allowed === '*') return true;
          if (allowed.endsWith(':*')) {
            // Prefix wildcard: 'mcp:*'
            const prefix = allowed.slice(0, -1);
            return toolName.startsWith(prefix);
          }
          if (allowed.includes('_*')) {
            // Suffix wildcard: 'git_*'
            const prefix = allowed.slice(0, -1);
            return toolName.startsWith(prefix);
          }
          return toolName === allowed;
        });

        if (isAllowed) {
          filtered.push(line);
        }
      }
    } else {
      filtered.push(line);
    }
  }

  return filtered.join('\n');
}
```

---

## Tools UI

**Location:** `packages/cli/src/ui/components/tools/`

### ToolsPanel Component

**File:** `ToolsPanel.tsx`

**Purpose:** Main UI for managing tools

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Tools                                               │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│ Navigation   │  Tool Details                        │
│ (30%)        │  (70%)                               │
│              │                                      │
│ ▶ read_file  │  read_file                           │
│   write_file │  Read file contents                  │
│   shell      │                                      │
│   web_search │  Description:                        │
│   ...        │  Reads the contents of a file...     │
│              │                                      │
│              │  Example:                            │
│              │  Read package.json to check deps     │
│              │                                      │
│              │  Mode Settings:                      │
│              │  ☑ developer  ☑ debugger             │
│              │  ☑ assistant  ☑ planning             │
│              │  ☑ user                              │
│              │                                      │
│              │  [Apply] [Reset to Defaults]         │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

**Features:**
- Two-column layout (30% nav, 70% details)
- Enhanced tool descriptions with examples
- Per-mode enable/disable toggles
- Apply/Reset functionality
- Left/Right arrow navigation
- Keyboard shortcuts

**Key State:**
```typescript
interface ToolsPanelState {
  selectedTool: string | null;
  tools: ToolDefinition[];
  modeSettings: Record<string, Record<string, boolean>>;
  hasChanges: boolean;
}
```

### ToolModeSettings Component

**File:** `ToolModeSettings.tsx`

**Purpose:** Per-mode toggle controls

**Features:**
- Shows all 5 modes (developer, debugger, assistant, planning, user)
- Checkbox for each mode
- Visual feedback for changes
- Keyboard navigation

**Usage:**
```typescript
<ToolModeSettings
  toolId="read_file"
  modeSettings={{
    developer: true,
    debugger: true,
    assistant: true,
    planning: true,
    user: true
  }}
  onChange={(mode, enabled) => {
    settingsService.setToolForMode(mode, toolId, enabled);
  }}
/>
```

### ToolsContext

**File:** `ToolsContext.tsx`

**Purpose:** React context for tool state management

**Provides:**
```typescript
interface ToolsContextValue {
  tools: ToolDefinition[];
  selectedTool: string | null;
  setSelectedTool: (toolId: string) => void;
  getModeSettings: (toolId: string) => Record<string, boolean>;
  setModeSettings: (toolId: string, mode: string, enabled: boolean) => void;
  resetToDefaults: (toolId: string) => void;
  applyChanges: () => void;
}
```

---

## Tool Initialization

**Purpose:** Auto-initialize all tools in settings on first load

**Location:** `packages/cli/src/config/settingsService.ts`

**Method:** `initializeToolSettings(toolIds: string[]): void`

**Flow:**
```
1. App starts
   ↓
2. ToolRegistry loads all tools
   ↓
3. Get all tool IDs
   ↓
4. Call settingsService.initializeToolSettings(toolIds)
   ↓
5. For each tool:
   - Add to global tools list (enabled by default)
   - Add to each mode with default settings
   ↓
6. Save to ~/.ollm/settings.json
```

**Implementation:**
```typescript
initializeToolSettings(toolIds: string[]): void {
  let needsSave = false;

  // Initialize global tools
  if (!this.settings.tools) {
    this.settings.tools = {};
    needsSave = true;
  }

  for (const toolId of toolIds) {
    if (this.settings.tools[toolId] === undefined) {
      this.settings.tools[toolId] = true;
      needsSave = true;
    }
  }

  // Initialize per-mode settings
  if (!this.settings.toolsByMode) {
    this.settings.toolsByMode = {};
    needsSave = true;
  }

  for (const mode of Object.keys(DEFAULT_TOOLS_BY_MODE)) {
    if (!this.settings.toolsByMode[mode]) {
      this.settings.toolsByMode[mode] = {};
    }

    const defaults = DEFAULT_TOOLS_BY_MODE[mode];
    const isWildcard = defaults.includes('*');

    for (const toolId of toolIds) {
      if (this.settings.toolsByMode[mode][toolId] === undefined) {
        const shouldEnable = isWildcard || defaults.includes(toolId);
        this.settings.toolsByMode[mode][toolId] = shouldEnable;
        needsSave = true;
      }
    }
  }

  if (needsSave) {
    this.saveSettings();
  }
}
```

---

## Integration with Prompt System

### System Prompt Integration

**Flow:**
```
Mode Change
  ↓
ContextOrchestrator.rebuildSystemPrompt(settingsService)
  ↓
allowedTools = settingsService.getToolsForMode(currentMode)
  ↓
PromptOrchestratorIntegration.getSystemPrompt({
  modelId,
  allowedTools,
  mode,
  tier
})
  ↓
SystemPromptBuilder.build({
  modelSupportsTools,
  allowedTools
})
  ↓
Filtered tool descriptions in system prompt
  ↓
LLM receives prompt with correct tools
```

### Model Capability Check

**Purpose:** Only include tools if model supports function calling

**Flow:**
```typescript
// Get model entry
const modelEntry = profileManager.getModelEntry(modelId);

// Check tool support
const modelSupportsTools = modelEntry?.tool_support ?? false;

// Only include tools if supported
if (modelSupportsTools && allowedTools.length > 0) {
  const toolsSection = buildToolsSection(allowedTools);
  sections.push(toolsSection);
}
```

---

## Tool Execution

**Location:** `packages/core/src/tools/`

### Execution Flow

```
LLM requests tool call
  ↓
Tool call intercepted by provider
  ↓
Permission check (policy engine)
  ├─ AUTO mode: Auto-approve safe tools
  ├─ ASK mode: Prompt user for confirmation
  └─ YOLO mode: Auto-approve all tools
  ↓
Execute tool handler
  ↓
Format result
  ↓
Return to LLM
```

### Permission Levels

| Mode | Behavior | Use Case |
|------|----------|----------|
| **AUTO** | Auto-approve safe tools, ask for risky ones | Default, balanced |
| **ASK** | Ask for all tools | Maximum control |
| **YOLO** | Auto-approve all tools | Fast iteration |

### Risk Levels

| Level | Tools | Auto-Approve (AUTO mode) |
|-------|-------|--------------------------|
| **Low** | read_file, web_search, grep, ls | ✅ Yes |
| **Medium** | write_file, edit_file | ❌ Ask |
| **High** | shell | ❌ Ask |

---

## Tool Descriptions Template

**Location:** `packages/core/src/prompts/templates/system/ToolDescriptions.txt`

**Purpose:** Complete list of all tools with descriptions

**Format:**
```markdown
# Available Tools

## File Operations

- **read_file**: Read the contents of a file
- **write_file**: Write content to a file
- **edit_file**: Edit specific sections of a file

## Web Tools

- **web_search**: Search the internet
- **web_fetch**: Fetch content from a URL

## Shell

- **shell**: Execute shell commands

...
```

**Usage:**
- Loaded by SystemPromptBuilder
- Filtered based on allowedTools
- Included in system prompt if model supports tools

---

## Testing Tools

### Test Commands

```bash
# View current tools in prompt
/test prompt

# Switch mode and check tools
/mode assistant
/test prompt
# Should show only: read_file, web_search, web_fetch

/mode developer
/test prompt
# Should show all enabled tools
```

### UI Testing

1. Open Tools tab (Tab key to navigate)
2. Select a tool from left column
3. View details in right column
4. Toggle mode checkboxes
5. Click Apply to save changes
6. Switch modes and verify tools are filtered

---

## Performance Considerations

### Caching

- Tool registry cached in memory
- Settings loaded once per session
- Tool descriptions loaded once from template
- Filtered descriptions cached per mode

### Lazy Loading

- Tools registered on demand
- MCP tools loaded when MCP servers connect
- UI components render only when tab is active

---

## File Locations Reference

### Core Files
- `packages/core/src/tools/tool-registry.ts` - Tool registration
- `packages/cli/src/config/settingsService.ts` - Settings management
- `packages/core/src/context/SystemPromptBuilder.ts` - Tool filtering
- `packages/core/src/prompts/templates/system/ToolDescriptions.txt` - Tool descriptions

### UI Files
- `packages/cli/src/ui/components/tools/ToolsPanel.tsx` - Main UI
- `packages/cli/src/ui/components/tools/ToolModeSettings.tsx` - Mode toggles
- `packages/cli/src/ui/contexts/ToolsContext.tsx` - State management
- `packages/cli/src/ui/components/tabs/ToolsTab.tsx` - Tab wrapper

### Settings
- `~/.ollm/settings.json` - User tool configuration

---

## Extension Points

### Adding New Tools

1. **Define Tool:**
```typescript
const newTool: ToolDefinition = {
  id: 'my_tool',
  name: 'my_tool',
  description: 'Does something useful',
  category: 'utility',
  inputSchema: { /* JSON Schema */ },
  handler: async (args) => { /* Implementation */ },
  requiresConfirmation: false,
  riskLevel: 'low'
};
```

2. **Register Tool:**
```typescript
toolRegistry.registerTool(newTool);
```

3. **Add to Template:**
Edit `ToolDescriptions.txt` to include description

4. **Configure Defaults:**
Update `DEFAULT_TOOLS_BY_MODE` if needed

### Adding New Tool Categories

1. Update tool registry categories
2. Add category section to ToolDescriptions.txt
3. Update UI to display new category
4. Add category-specific filtering if needed

### Customizing Tool Filters

1. Update `DEFAULT_TOOLS_BY_MODE` in settingsService.ts
2. Modify `filterToolDescriptions()` for new patterns
3. Update UI to reflect new filtering logic

---

## Best Practices

1. **Keep tool descriptions concise** - They're included in every prompt
2. **Use wildcards for groups** - Easier to maintain than explicit lists
3. **Test with different modes** - Ensure filtering works correctly
4. **Document new tools** - Update ToolDescriptions.txt
5. **Set appropriate risk levels** - Affects permission prompts
6. **Cache aggressively** - Tools don't change at runtime
7. **Validate tool schemas** - Prevent runtime errors

---

## Common Patterns

### Disabling a Tool Globally

```typescript
settingsService.setToolState('shell', false);
```

### Enabling a Tool for Specific Mode

```typescript
settingsService.setToolForMode('assistant', 'write_file', true);
```

### Resetting Tool to Defaults

```typescript
settingsService.resetToolToDefaults('read_file');
```

### Getting All Tools for Current Mode

```typescript
const mode = contextManager.getMode();
const tools = settingsService.getToolsForMode(mode);
```

---

## Troubleshooting

### Tool Not Appearing in Prompt

1. Check if tool is enabled globally: `settings.tools[toolId]`
2. Check if tool is enabled for mode: `settings.toolsByMode[mode][toolId]`
3. Check if model supports tools: `modelEntry.tool_support`
4. Verify tool is in ToolDescriptions.txt
5. Test with `/test prompt` command

### Tool Settings Not Persisting

1. Check file permissions on `~/.ollm/settings.json`
2. Verify SettingsService.saveSettings() is called
3. Check for JSON syntax errors in settings file
4. Ensure settings directory exists

### Tool Filtering Not Working

1. Verify wildcard patterns are correct
2. Check filterToolDescriptions() logic
3. Test with different modes
4. Verify DEFAULT_TOOLS_BY_MODE configuration

---

## Related Documentation

- [dev_PromptComponents.md](./dev_PromptComponents.md) - Prompt system architecture
- [dev_ToolExecution.md](./dev_ToolExecution.md) - Tool execution details
- [dev_MCPIntegration.md](./dev_MCPIntegration.md) - MCP tool integration
- [PromptBuilderPolish.md](../../backlog/29-01-2026-Sesions-Rework/PromptBuilderPolish.md) - Design document
- [IMPLEMENTATION_TASKS.md](../../backlog/29-01-2026-Sesions-Rework/IMPLEMENTATION_TASKS.md) - Implementation status
