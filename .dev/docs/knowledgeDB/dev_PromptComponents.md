# Prompt Components System

**Last Updated:** 2026-01-31  
**Status:** Production  
**Purpose:** Technical reference for how system prompts are built and managed

## Overview

The prompt system builds dynamic system prompts based on:

- **Context Tier** (1-5) - Model size and capabilities
- **Operational Mode** (developer, debugger, assistant, planning, user)
- **Model Capabilities** - Tool support, reasoning, etc.
- **User Settings** - Per-mode tool configuration

## Architecture

### Component Flow

```
User Input + Context
  ↓
ContextManagerFactory
  ↓
PromptOrchestratorIntegration
  ↓
SystemPromptBuilder
  ↓
Template Files (*.txt)
  ↓
Final System Prompt → LLM
```

### Key Components

1. **SystemPromptBuilder** - Assembles prompt from templates
2. **PromptOrchestratorIntegration** - Coordinates prompt building
3. **PromptOrchestrator** - Manages tier-specific prompts
4. **TieredPromptStore** - Loads mode/tier-specific base prompts
5. **SettingsService** - Provides user tool configuration

---

## System Prompt Structure

A complete system prompt consists of:

```
1. Core Mandates          (~93 tokens)
2. Sanity Checks          (~100 tokens, Tier 1-2 only)
3. Mode-Specific Skills   (~70-100 tokens)
4. Tool Descriptions      (dynamic, filtered by mode)
5. Tier-Specific Prompt   (from TieredPromptStore)
```

**Total:** ~400-600 tokens (down from ~800-1000 tokens)

---

## Component Details

### 1. SystemPromptBuilder

**Location:** `packages/core/src/context/SystemPromptBuilder.ts`

**Purpose:** Assembles the final system prompt from template files

**Interface:**

```typescript
interface SystemPromptConfig {
  interactive: boolean;
  mode?: string; // Current operational mode
  tier?: number; // Context tier (1-5)
  modelSupportsTools?: boolean; // Model capability
  allowedTools?: string[]; // Tools for this mode
  useSanityChecks?: boolean; // Enable sanity checks
  agentName?: string;
  additionalInstructions?: string;
  skills?: string[]; // Legacy support
}
```

**Methods:**

- `build(config: SystemPromptConfig): string` - Builds complete prompt
- `loadTemplate(relativePath: string): string` - Loads template file
- `buildToolsSection(allowedTools: string[]): string` - Filters tools
- `filterToolDescriptions(fullText: string, allowedTools: string[]): string` - Applies wildcards

**Template Loading:**

```typescript
// Base directory: packages/core/src/prompts/templates/
loadTemplate('system/CoreMandates.txt');
loadTemplate('system/skills/SkillsDeveloper.txt');
loadTemplate('system/ToolDescriptions.txt');
loadTemplate('system/SanityChecks.txt');
```

---

### 2. Template Files

**Location:** `packages/core/src/prompts/templates/system/`

#### Core Mandates (`CoreMandates.txt`)

- **Size:** ~93 tokens
- **Content:** Essential behavioral rules
- **Always included:** Yes
- **Purpose:** Core instructions for all interactions

#### Sanity Checks (`SanityChecks.txt`)

- **Size:** ~100 tokens
- **Content:** Error prevention guidelines
- **Included when:** `tier <= ContextTier.TIER_2_BASIC`
- **Purpose:** Help smaller models avoid common mistakes

#### Tool Descriptions (`ToolDescriptions.txt`)

- **Size:** ~400 tokens (full)
- **Content:** All available tools with descriptions
- **Filtering:** Dynamic based on mode and user settings
- **Purpose:** Inform LLM about available tools

#### Mode-Specific Skills

**Location:** `packages/core/src/prompts/templates/system/skills/`

| File                  | Size        | Mode      | Focus                      |
| --------------------- | ----------- | --------- | -------------------------- |
| `SkillsDeveloper.txt` | ~100 tokens | developer | Code creation, refactoring |
| `SkillsDebugger.txt`  | ~100 tokens | debugger  | Bug investigation, testing |
| `SkillsAssistant.txt` | ~80 tokens  | assistant | Information retrieval      |
| `SkillsPlanning.txt`  | ~90 tokens  | planning  | Analysis, architecture     |
| `SkillsUser.txt`      | ~70 tokens  | user      | General assistance         |

---

### 3. PromptOrchestratorIntegration

**Location:** `packages/core/src/context/integration/promptOrchestratorIntegration.ts`

**Purpose:** Integrates prompt building with context compression system

**Key Methods:**

```typescript
getSystemPrompt(config: SystemPromptConfig): Message
```

- Gets tier-specific prompt from PromptOrchestrator
- Builds base prompt with skills/tools/hooks
- Combines into final system prompt message
- Returns Message object for context manager

```typescript
buildBasePrompt(config: SystemPromptConfig): string
```

- Checks model tool support via ProfileManager
- Gets allowed tools from config
- Filters tools based on model capabilities
- Adds hooks and sanity checks

**Integration Points:**

- **ProfileManager** - Model capability detection
- **PromptOrchestrator** - Tier-specific prompts
- **SystemPromptBuilder** - Template assembly

---

### 4. PromptOrchestrator

**Location:** `packages/core/src/context/promptOrchestrator.ts`

**Purpose:** Manages tier and mode-specific base prompts

**Key Methods:**

```typescript
getSystemPromptForTierAndMode(mode: OperationalMode, tier: ContextTier): string
```

- Loads appropriate prompt from TieredPromptStore
- Returns tier-optimized base prompt
- Handles fallbacks for missing prompts

```typescript
getSystemPromptTokenBudget(tier: ContextTier): number
```

- Returns token budget for tier
- Used by compression system
- Ensures prompts stay within limits

**Tier Budgets:**

- Tier 1 (≤4K): 800 tokens
- Tier 2 (≤8K): 1200 tokens
- Tier 3 (≤16K): 1500 tokens
- Tier 4 (≤32K): 2000 tokens
- Tier 5 (>32K): 2500 tokens

---

### 5. TieredPromptStore

**Location:** `packages/core/src/prompts/tieredPromptStore.ts`

**Purpose:** Loads mode and tier-specific prompt files

**Prompt File Structure:**

```
packages/core/src/prompts/templates/
├── developer/
│   ├── tier1.txt
│   ├── tier2.txt
│   ├── tier3.txt
│   ├── tier4.txt
│   └── tier5.txt
├── debugger/
│   └── ...
├── assistant/
│   └── ...
├── planning/
│   └── ...
└── user/
    └── ...
```

**Loading Logic:**

1. Try to load `{mode}/tier{tier}.txt`
2. If not found, try `{mode}/tier3.txt` (default)
3. If still not found, use fallback prompt
4. Cache loaded prompts for performance

---

### 6. Tool Filtering System

**Purpose:** Dynamically filter tools based on mode and user settings

**Flow:**

```
User Settings (~/.ollm/settings.json)
  ↓
SettingsService.getToolsForMode(mode)
  ↓
Returns: ['read_file', 'web_search', ...]
  ↓
SystemPromptBuilder.filterToolDescriptions(fullText, allowedTools)
  ↓
Filtered tool descriptions
```

**Wildcard Support:**

| Pattern       | Matches      | Example           |
| ------------- | ------------ | ----------------- |
| `'*'`         | All tools    | All enabled tools |
| `'mcp:*'`     | Prefix match | All MCP tools     |
| `'git_*'`     | Prefix match | All git tools     |
| `'read_file'` | Exact match  | Only read_file    |

**Default Tools Per Mode:**

```typescript
const DEFAULT_TOOLS_BY_MODE = {
  developer: ['*'], // All tools
  debugger: ['*'], // All tools
  assistant: ['read_file', 'web_search', 'web_fetch'],
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
    'mcp:*',
  ],
  user: ['*'], // All tools (customizable)
};
```

---

## Integration with Context System

### ContextOrchestrator Integration

**Location:** `packages/core/src/context/orchestration/contextOrchestrator.ts`

**Method:** `rebuildSystemPrompt(settingsService?: any): void`

**Purpose:** Rebuilds system prompt when mode or tier changes

**Flow:**

1. Get allowed tools from SettingsService for current mode
2. Call PromptOrchestratorIntegration.getSystemPrompt()
3. Pass modelId, allowedTools, mode, tier
4. Update ActiveContextManager with new system prompt

**Triggers:**

- Mode change (via ContextOrchestratorAdapter.setMode())
- Tier change (via ContextOrchestratorAdapter.updateConfig())
- Manual rebuild request

---

### ContextManagerFactory Integration

**Location:** `packages/core/src/context/contextManagerFactory.ts`

**Purpose:** Initial system prompt creation during context manager setup

**Flow:**

1. Get SettingsService from config.services
2. Get allowed tools for initial mode
3. Create PromptOrchestratorIntegration with ProfileManager
4. Build initial system prompt with all parameters
5. Pass to ContextOrchestrator constructor

**Services Required:**

- `settingsService` - Tool configuration
- `profileManager` - Model capabilities
- `promptOrchestrator` - Tier-specific prompts

---

## Model Capability Detection

**Purpose:** Determine if model supports function calling

**Flow:**

```typescript
// Get model entry from ProfileManager
const modelEntry = profileManager.getModelEntry(modelId);

// Check tool support flag
const modelSupportsTools = modelEntry?.tool_support ?? false;

// Only include tools if model supports them
if (modelSupportsTools && allowedTools.length > 0) {
  // Add tool descriptions to prompt
}
```

**Tool Support Flag:**

- Defined in `LLM_profiles.json`
- Property: `tool_support: true/false`
- Used to prevent tool descriptions for non-capable models

---

## Prompt Building Example

### Input Configuration

```typescript
const config = {
  mode: 'assistant',
  tier: ContextTier.TIER_3_STANDARD,
  modelId: 'llama3.2:3b',
  modelSupportsTools: true,
  allowedTools: ['read_file', 'web_search', 'web_fetch'],
  useSanityChecks: false,
  interactive: true,
};
```

### Output Prompt Structure

```
# Core Mandates
[~93 tokens from CoreMandates.txt]

# Assistant Skills
[~80 tokens from SkillsAssistant.txt]

# Available Tools
- **read_file**: Read file contents
- **web_search**: Search the web
- **web_fetch**: Fetch web page content

# Tier 3 Base Prompt
[Tier-specific instructions from assistant/tier3.txt]
```

**Total:** ~400-500 tokens

---

## Settings Integration

### User Settings Structure

**Location:** `~/.ollm/settings.json`

```json
{
  "tools": {
    "read_file": true,
    "write_file": true,
    "web_search": true,
    ...
  },
  "toolsByMode": {
    "developer": {
      "read_file": true,
      "write_file": true,
      ...
    },
    "assistant": {
      "read_file": true,
      "web_search": true,
      "web_fetch": true,
      ...
    }
  }
}
```

### SettingsService Methods

```typescript
// Get tools for specific mode
getToolsForMode(mode: string): string[]

// Set tool for specific mode
setToolForMode(mode: string, toolId: string, enabled: boolean): void

// Get mode settings for a tool
getModeSettingsForTool(toolId: string): Record<string, boolean>

// Reset tool to defaults
resetToolToDefaults(toolId: string): void
```

---

## Testing & Debugging

### Test Prompt Command

**Command:** `/test prompt`

**Purpose:** Preview the exact prompt that will be sent to LLM

**Output Includes:**

- Complete system prompt
- Current mode and tier
- Token counts
- Model configuration
- Ollama parameters

**Usage:**

```bash
/mode assistant
/test prompt
# Shows assistant mode prompt with filtered tools

/mode developer
/test prompt
# Shows developer mode prompt with all tools
```

---

## Performance Considerations

### Token Savings

**Before Optimization:**

- Core mandates: ~267 tokens (hardcoded)
- Mixed skills: ~200 tokens
- All tools: ~400 tokens
- **Total:** ~800-1000 tokens

**After Optimization:**

- Core mandates: ~93 tokens (template)
- Mode-specific skills: ~70-100 tokens
- Filtered tools: ~100-300 tokens (dynamic)
- **Total:** ~400-600 tokens

**Savings:** 40-50% reduction

### Caching

- Template files loaded once and cached
- TieredPromptStore caches loaded prompts
- Token counts cached by TokenCounterService
- Settings loaded once per session

---

## File Locations Reference

### Core Files

- `packages/core/src/context/SystemPromptBuilder.ts`
- `packages/core/src/context/integration/promptOrchestratorIntegration.ts`
- `packages/core/src/context/promptOrchestrator.ts`
- `packages/core/src/prompts/tieredPromptStore.ts`

### Template Files

- `packages/core/src/prompts/templates/system/CoreMandates.txt`
- `packages/core/src/prompts/templates/system/SanityChecks.txt`
- `packages/core/src/prompts/templates/system/ToolDescriptions.txt`
- `packages/core/src/prompts/templates/system/skills/*.txt`

### Mode Prompts

- `packages/core/src/prompts/templates/{mode}/tier{1-5}.txt`

### Settings

- `packages/cli/src/config/settingsService.ts`
- `~/.ollm/settings.json` (user settings)

---

## Extension Points

### Adding New Modes

1. Create mode enum entry in `packages/core/src/context/types.ts`
2. Add mode to `DEFAULT_TOOLS_BY_MODE` in `settingsService.ts`
3. Create skill template: `system/skills/Skills{Mode}.txt`
4. Create tier prompts: `modes/{mode}/tier{1-5}.txt`
5. Add mode command in `packages/cli/src/commands/modeShortcuts.ts`

### Adding New Templates

1. Create template file in `packages/core/src/prompts/templates/system/`
2. Add loading logic in `SystemPromptBuilder.build()`
3. Update token budget calculations if needed

### Customizing Tool Filters

1. Update `DEFAULT_TOOLS_BY_MODE` in `settingsService.ts`
2. Modify `filterToolDescriptions()` for new wildcard patterns
3. Update UI in `ToolsPanel.tsx` if needed

---

## Best Practices

1. **Keep templates concise** - Every token counts
2. **Use wildcards** - Easier to maintain than explicit lists
3. **Test with `/test prompt`** - Verify changes before deployment
4. **Cache aggressively** - Templates don't change at runtime
5. **Validate tier budgets** - Ensure prompts fit within limits
6. **Document changes** - Update this file when modifying system

---

## Related Documentation

- [dev_ToolsManager.md](./dev_ToolsManager.md) - Tool system architecture
- [dev_ContextManagement.md](./dev_ContextManagement.md) - Context system
- [PromptBuilderPolish.md](../../backlog/29-01-2026-Sesions-Rework/PromptBuilderPolish.md) - Design document
- [IMPLEMENTATION_TASKS.md](../../backlog/29-01-2026-Sesions-Rework/IMPLEMENTATION_TASKS.md) - Implementation status
