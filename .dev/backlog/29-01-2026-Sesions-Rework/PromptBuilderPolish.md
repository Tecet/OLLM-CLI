# Prompt Builder Polish - Redesign System

**Date:** 2026-01-30  
**Status:** Planning  
**Goal:** Move prompt components from hardcoded TypeScript to template files and improve system

---

## Overview

Current system has prompt components hardcoded in TypeScript files. We need to:
1. Move components to `.txt` template files
2. Improve Core Mandates for efficiency
3. Implement proper skills system with tool integration
4. Enable sanity checks for smaller models
5. Integrate focused files and project rules

### Skills vs Tools vs Hooks vs MCP

**Important distinction:**

- **Skills** = Knowledge/guidelines (e.g., "TypeScript best practices", "Testing strategies")
  - Defined in template files
  - Explain HOW to do things
  - No executable actions
  
- **Tools** = Executable actions (e.g., `read_file`, `write_file`, `shell`)
  - Registered in ToolRegistry
  - LLM can call them via function calling
  - User can enable/disable in UI
  
- **Hooks** = Event-driven automation (e.g., "run lint on file save")
  - Defined in `.ollm/hooks/`
  - Triggered by events (fileEdited, promptSubmit, etc.)
  - Can run commands or ask agent
  
- **MCP** = External tool servers (e.g., GitHub MCP, AWS MCP)
  - Provide additional tools via Model Context Protocol
  - Tools appear as `mcp:server:tool` (e.g., `mcp:github:create_issue`)
  - User can enable/disable servers

**In system prompt:**
- Skills: Explain knowledge/guidelines
- Tools: List available tools and what they do
- Hooks: Not mentioned (internal automation)
- MCP: Included in tools list as `mcp:*` or specific MCP tools

---

## Current State

### What Works ✅
- Tier-specific templates (assistant/debugger/developer/planning/user)
- Mode-specific tool restrictions in PromptModeManager
- Token counting and budget validation
- Dynamic prompt assembly

### What Needs Work ⚠️
- Core Mandates hardcoded in TypeScript (should be template)
- Sanity checks disabled (should enable for Tier 1-2)
- No skills system (placeholder only)
- Identity prompt unused (dead code)
- No project-specific rules integration
- Focused files not explained to LLM

---

## Task Breakdown

### TASK 1: Remove Unused Identity Prompt ✅

**Status:** AGREED - Not needed, tier templates already define identity

**Action:**
- Delete `packages/core/src/prompts/templates/identity.ts`
- Remove any references to IDENTITY_PROMPT

**Rationale:** Tier-specific templates already include identity/persona

---

### TASK 2: Move Core Mandates to Template

**Status:** TODO

**Goal:** Move Core Mandates from TypeScript to template file for easy editing

**Current Location:**
- `packages/core/src/prompts/templates/mandates.ts` (267 tokens)

**New Location:**
- `packages/core/src/prompts/templates/system/CoreMandates.txt`

**Current Content (needs improvement):**
```markdown
# Core Mandates

- **Conventions:** Rigorously adhere to existing project conventions (style, naming, patterns) when reading or modifying code. Analyze surrounding code first.
- **Verification:** NEVER assume a library/framework is available. Verify via 'package.json' or imports before usage.
- **Idiomatic Changes:** Ensure changes integrate naturally. Understanding local context (imports, class hierarchy) is mandatory.
- **Comments:** Add comments sparingly and only for "why", not "what".
- **Proactiveness:** Fulfill the request thoroughly, including adding tests for new features.
- **Ambiguity:** Do not take significant actions beyond the clear scope of the request.
- **Output:** Be professional and concise. Avoid conversational filler ("Okay", "I will now").
- **Tool Usage:** Proactively use available tools to gather information before making assumptions. Prefer file reading tools over guessing file contents, use grep/glob for discovery, leverage memory for important context, and use web search for current information about libraries and frameworks.
```

**Improvements Needed:**
1. More concise wording (reduce token count)
2. Remove "Proactiveness" about tests (not universal)
3. Separate tool usage into skills section
4. Focus on universal rules only

**Proposed Improved Version (~180 tokens):**
```markdown
# Core Mandates

- **Conventions:** Follow existing project patterns (style, naming, structure). Analyze surrounding code before changes.
- **Verification:** Never assume libraries exist. Check package.json or imports first.
- **Integration:** Changes must fit naturally. Understand local context (imports, hierarchy).
- **Comments:** Only explain "why", not "what". Be sparing.
- **Scope:** Stay within request boundaries. Ask before significant additions.
- **Output:** Be professional and concise. No filler ("Okay", "I will now").
```

**Actions:**
1. Create `packages/core/src/prompts/templates/system/CoreMandates.txt`
2. Update SystemPromptBuilder to load from file instead of hardcoded
3. Remove `packages/core/src/prompts/templates/mandates.ts`
4. Update PromptRegistry to load system templates
5. Test with budget validation

---

### TASK 3: Move Sanity Checks to Template and Enable

**Status:** TODO

**Goal:** Enable sanity checks for Tier 1-2 and move to template file

**Current Location:**
- `packages/core/src/prompts/templates/sanity.ts` (89 tokens)
- Currently disabled: `useSanityChecks: false` in PromptOrchestrator

**New Location:**
- `packages/core/src/prompts/templates/system/SanityChecks.txt`

**Current Content:**
```markdown
# Reality Check Protocol

- **Pre-Flight:** Before editing any file, you MUST read it first to verify its content matches your assumptions.
- **Reproduction:** Before fixing a bug, you MUST reproduce it or read the exact error log/traceback.
- **Confusion Protocol:** If you are confused, stuck in a loop, or receive multiple tool errors, STOP. Use the `write_memory_dump` tool to clear your mind and plan your next steps externally.
```

**Issues:**
- References `write_memory_dump` tool that may not exist
- Good content, just needs to be enabled

**Actions:**
1. Create `packages/core/src/prompts/templates/system/SanityChecks.txt`
2. Verify `write_memory_dump` tool exists or update reference
3. Update SystemPromptBuilder to load from file
4. Enable sanity checks for Tier 1-2:
   ```typescript
   const useSanityChecks = tier <= ContextTier.TIER_2_BASIC;
   ```
5. Remove `packages/core/src/prompts/templates/sanity.ts`
6. Test with small models (3B) on Tier 1-2

---

### TASK 4: Implement Skills System with Tool Integration

**Status:** TODO - COMPLEX

**Goal:** Create skills system that:
1. Defines mode-specific skills (developer, assistant, planning, debugger)
2. Explains available tools to LLM based on user settings per mode
3. Gives users full control over which tools each mode can use
4. Provides sensible defaults that users can override

**Architecture Overview:**

```
Model Check → Mode Check → Settings Check → Tools Passed to LLM
     ↓             ↓              ↓                    ↓
Tool support?  Which mode?  User settings?    Filtered tools
(yes/no)      (dev/assist)  (per mode)       + descriptions
```

**Flow:**
1. Check if model supports tools (from model capabilities)
2. If no tool support → Skip tool descriptions entirely
3. If tool support → Get current mode
4. Load user settings for that mode from `settings.json`
5. Filter tools based on mode + user preferences
6. Generate tool descriptions for allowed tools only
7. Add to system prompt

---

#### 4.1: Update Settings Structure

**Current:**
```json
{
  "tools": {
    "read_file": true,
    "write_file": true,
    "shell": false
  }
}
```

**New (per-mode tool settings):**
```json
{
  "tools": {
    // Global enable/disable (affects all modes)
    "read_file": true,
    "write_file": true,
    "shell": true,
    "web_search": true,
    "git_diff": true
  },
  "toolsByMode": {
    "developer": {
      // Developer gets all enabled tools by default
      // User can disable specific tools if needed
      "shell": true,
      "write_file": true,
      "git_diff": true
      // ... all tools enabled
    },
    "debugger": {
      // Debugger gets all enabled tools by default
      "shell": true,
      "git_diff": true,
      "write_file": true
      // ... all tools enabled
    },
    "assistant": {
      // Assistant gets limited tools by default
      "read_file": true,
      "web_search": true,
      "web_fetch": true,
      // write_file: false (not in list = disabled)
      // shell: false (not in list = disabled)
    },
    "planning": {
      // Planning gets read-only + web tools by default
      "read_file": true,
      "read_multiple_files": true,
      "grep_search": true,
      "file_search": true,
      "list_directory": true,
      "web_search": true,
      "web_fetch": true,
      "get_diagnostics": true
      // write_file: false (not in list = disabled)
      // shell: false (not in list = disabled)
    }
  }
}
```

**Default Tool Sets (if user hasn't customized):**
```typescript
const DEFAULT_TOOLS_BY_MODE = {
  developer: ['*'],  // All enabled tools
  debugger: ['*'],   // All enabled tools
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
  ]
};
```

---

#### 4.2: Create Mode-Specific Skill Templates

**Location:** `packages/core/src/prompts/templates/system/skills/`

**Files to create:**
- `SkillsDeveloper.txt` - Full development capabilities
- `SkillsAssistant.txt` - Conversational assistance
- `SkillsPlanning.txt` - Planning and analysis
- `SkillsDebugger.txt` - Debugging and troubleshooting

**Example: `SkillsDeveloper.txt`**
```markdown
# Developer Skills

You are a full-stack developer with expertise in:

## Code Development
- Write clean, maintainable code following best practices
- Use appropriate design patterns and architectures
- Implement proper error handling and logging
- Write comprehensive tests (unit, integration, e2e)

## Code Quality
- Follow existing project conventions and style
- Refactor code for better readability and performance
- Add meaningful comments explaining "why", not "what"
- Use type systems effectively (TypeScript, etc.)

## Problem Solving
- Break down complex problems into manageable steps
- Research solutions using web search when needed
- Verify assumptions by reading actual code/docs
- Test changes before considering them complete

## Tools Usage
- Use file operations to read and modify code
- Execute shell commands for builds, tests, deployments
- Use git for version control and collaboration
- Search codebase efficiently with grep/file search
```

**Example: `SkillsAssistant.txt`**
```markdown
# Assistant Skills

You are a helpful AI assistant focused on:

## Communication
- Provide clear, concise explanations
- Ask clarifying questions when needed
- Adapt communication style to user preferences
- Be friendly and professional

## Information Gathering
- Search the web for current information
- Read documentation and files when relevant
- Synthesize information from multiple sources
- Verify facts before presenting them

## Guidance
- Offer suggestions and recommendations
- Explain concepts in accessible terms
- Provide examples when helpful
- Guide users toward solutions without doing everything for them

## Limitations
- You cannot modify files or execute commands
- You focus on information and guidance
- You can read files to understand context
- You can search the web for current information
```

**Example: `SkillsPlanning.txt`**
```markdown
# Planning Skills

You are a strategic planner and analyst with expertise in:

## Analysis
- Break down complex requirements into clear steps
- Identify dependencies and potential blockers
- Assess risks and propose mitigations
- Evaluate multiple approaches objectively

## Planning
- Create detailed, actionable plans
- Define clear milestones and success criteria
- Estimate effort and complexity realistically
- Prioritize tasks based on impact and dependencies

## Research
- Gather information from codebase and documentation
- Search for best practices and solutions
- Analyze existing implementations
- Identify patterns and anti-patterns

## Documentation
- Document plans clearly and concisely
- Create structured outlines and roadmaps
- Explain rationale behind decisions
- Maintain context for future reference

## Limitations
- You cannot modify files directly
- You focus on planning and analysis
- You can read files to understand current state
- You can search for information and best practices
```

**Example: `SkillsDebugger.txt`**
```markdown
# Debugger Skills

You are a debugging specialist with expertise in:

## Problem Diagnosis
- Reproduce issues systematically
- Read error logs and stack traces carefully
- Identify root causes, not just symptoms
- Form and test hypotheses methodically

## Investigation
- Use diagnostics tools to gather information
- Search codebase for relevant code paths
- Check git history for recent changes
- Compare working vs broken states

## Analysis
- Understand code flow and data transformations
- Identify edge cases and boundary conditions
- Recognize common bug patterns
- Assess impact and severity

## Resolution
- Propose targeted fixes with minimal changes
- Verify fixes don't introduce new issues
- Add tests to prevent regression
- Document findings for future reference

## Tools Usage
- Read files to understand implementation
- Use grep to find related code
- Check diagnostics for compile/lint errors
- Use git to see recent changes
- Execute shell commands for testing
```

---

#### 4.3: Create Tool Descriptions Template

**Location:** `packages/core/src/prompts/templates/system/ToolDescriptions.txt`

**Purpose:** Explain what each tool does (will be filtered per mode)

**Format:**
```markdown
# Available Tools

You have access to the following tools:

## File Operations
- **read_file**: Read content from a file. Use when you need to see file contents.
- **write_file**: Create or overwrite a file. Use when creating new files.
- **str_replace**: Replace specific text in a file. Use for targeted edits.
- **read_multiple_files**: Read multiple files at once. More efficient than multiple read_file calls.
- **list_directory**: List directory contents. Use to explore project structure.

## Search & Discovery
- **grep_search**: Search for text patterns across files. Use to find code, imports, usages.
- **file_search**: Find files by name pattern. Use to locate specific files.
- **get_diagnostics**: Get compile/lint/type errors. Use to check code health.

## Web Access
- **web_search**: Search the web for information. Use for current docs, solutions, best practices.
- **web_fetch**: Fetch content from a URL. Use to read specific documentation pages.

## Git Operations
- **git_diff**: Show changes in working directory. Use to see what's modified.
- **git_log**: Show commit history. Use to understand recent changes.
- **git_status**: Show repository status. Use to see tracked/untracked files.

## Development
- **shell**: Execute shell commands. Use for builds, tests, package management.
- **write_memory_dump**: Save important context to memory. Use when context is getting full.

## MCP Tools
- **mcp:***: Model Context Protocol tools from external servers. Varies by installed MCP servers.

**Tool Usage Guidelines:**
- Always read files before editing to verify assumptions
- Use grep/file_search to discover code before making changes
- Check diagnostics after modifications
- Search web for current information about libraries/frameworks
- Use shell for builds, tests, and verification
```

---

#### 4.4: Update Tool Filtering Logic

**New SettingsService methods:**
```typescript
// In SettingsService
getToolsForMode(mode: string): string[] {
  const settings = this.getSettings();
  
  // Get globally enabled tools
  const globallyEnabled = Object.entries(settings.tools || {})
    .filter(([_, enabled]) => enabled)
    .map(([toolId, _]) => toolId);
  
  // Get mode-specific settings (or use defaults)
  const modeSettings = settings.toolsByMode?.[mode];
  
  if (!modeSettings) {
    // Use defaults if user hasn't customized
    const defaults = DEFAULT_TOOLS_BY_MODE[mode] || [];
    if (defaults.includes('*')) {
      return globallyEnabled; // All enabled tools
    }
    return globallyEnabled.filter(tool => defaults.includes(tool));
  }
  
  // User has customized this mode
  return globallyEnabled.filter(toolId => {
    return modeSettings[toolId] === true;
  });
}

setToolForMode(mode: string, toolId: string, enabled: boolean): void {
  const settings = this.getSettings();
  
  if (!settings.toolsByMode) {
    settings.toolsByMode = {};
  }
  
  if (!settings.toolsByMode[mode]) {
    settings.toolsByMode[mode] = {};
  }
  
  settings.toolsByMode[mode][toolId] = enabled;
  this.saveSettings(settings);
}
```

---

#### 4.5: Update SystemPromptBuilder

**New interface:**
```typescript
export interface SystemPromptConfig {
  interactive: boolean;
  mode: string;                    // NEW: Current mode
  tier: ContextTier;               // NEW: Current tier
  modelSupportsTools: boolean;     // NEW: Model capability
  allowedTools: string[];          // NEW: Tools for this mode
  useSanityChecks?: boolean;
  additionalInstructions?: string;
}
```

**New build logic:**
```typescript
build(config: SystemPromptConfig): string {
  const sections: string[] = [];
  
  // 1. Core Mandates (always)
  sections.push(this.loadTemplate('system/CoreMandates.txt'));
  
  // 2. Mode-Specific Skills
  const skillsFile = `system/skills/Skills${capitalize(config.mode)}.txt`;
  if (this.templateExists(skillsFile)) {
    sections.push(this.loadTemplate(skillsFile));
  }
  
  // 3. Available Tools (only if model supports tools)
  if (config.modelSupportsTools && config.allowedTools.length > 0) {
    const toolsSection = this.buildToolsSection(config.allowedTools);
    if (toolsSection) sections.push(toolsSection);
  }
  
  // 4. Sanity Checks (if enabled for small tiers)
  if (config.useSanityChecks) {
    sections.push(this.loadTemplate('system/SanityChecks.txt'));
  }
  
  // 5. Additional Instructions (if any)
  if (config.additionalInstructions) {
    sections.push('# Additional Instructions\n' + config.additionalInstructions);
  }
  
  return sections.join('\n\n');
}

buildToolsSection(allowedTools: string[]): string {
  const allToolDescriptions = this.loadTemplate('system/ToolDescriptions.txt');
  
  // Filter to only show allowed tools
  return this.filterToolDescriptions(allToolDescriptions, allowedTools);
}

filterToolDescriptions(fullText: string, allowedTools: string[]): string {
  // Parse tool descriptions and filter to only allowed tools
  // Keep section headers, remove tools not in allowedTools list
  // Return filtered markdown
}
```

---

#### 4.6: Update PromptOrchestrator

**Changes:**
```typescript
updateSystemPrompt({ mode, tier, ... }) {
  // Check if model supports tools
  const modelEntry = profileManager.getModelEntry(this.model);
  const modelSupportsTools = modelEntry?.tool_support ?? false;
  
  // Get allowed tools for this mode (from user settings)
  const allowedTools = modelSupportsTools 
    ? settingsService.getToolsForMode(mode)
    : [];
  
  // Build base prompt
  const basePrompt = this.systemPromptBuilder.build({
    interactive: true,
    mode: mode,
    tier: tier,
    modelSupportsTools: modelSupportsTools,
    allowedTools: allowedTools,
    useSanityChecks: tier <= ContextTier.TIER_2_BASIC,
  });
  
  const tierPrompt = this.getSystemPromptForTierAndMode(mode, tier);
  const newPrompt = [tierPrompt, basePrompt].filter(Boolean).join('\n\n');
  
  return { message: systemPrompt, tokenBudget };
}
```

---

#### 4.7: Redesign Tools UI

**Current UI:**
```
┌─ Left Column ────────┬─ Right Column ──────────────────┐
│ ▸ File Discovery     │ Find Files by Pattern           │
│   ✓ Find Files       │                                 │
│   ✓ List Directory   │ Version: v0.1.0 (Stable)        │
│ ▸ File Operations    │ Status: ✓ Enabled               │
│   ✓ Edit File        │                                 │
│   ✓ Read File        │ Description of selected tool... │
│ ▸ Shell              │                                 │
│   ✓ Execute Shell    │                                 │
└──────────────────────┴─────────────────────────────────┘
```

**New UI Design:**

```
┌─ Left Column (Label Only) ─┬─ Right Column (Interactive) ────────────────┐
│                             │                                             │
│ ▸ File Discovery            │ Find Files by Pattern                       │
│   • Find Files              │                                             │
│   • List Directory          │ Version: v0.1.0 (Stable)                    │
│                             │ Status: ✓ Enabled Globally                  │
│ ▸ File Operations           │                                             │
│   • Edit File               │ Description of tool...                      │
│   • Read File               │                                             │
│                             │ ┌─ Per-Mode Settings ──────────────────┐   │
│ ▸ Shell                     │ │                                       │   │
│   • Execute Shell           │ │ Developer:  [✓ Enabled ]              │   │
│                             │ │ Debugger:   [✓ Enabled ]              │   │
│ ▸ Memory                    │ │ Assistant:  [✗ Disabled] ← Navigate   │   │
│   • Persistent Memory       │ │ Planning:   [✓ Enabled ]              │   │
│                             │ │                                       │   │
│ ▸ Context                   │ │ [Apply] [Reset to Defaults]           │   │
│   • Complete Goal           │ └───────────────────────────────────────┘   │
│                             │                                             │
└─────────────────────────────┴─────────────────────────────────────────────┘

Navigation:
- Left: Browse tools (read-only, no toggle)
- Right: Navigate per-mode settings, toggle enable/disable
- Tab: Switch between left/right panels
```

**Key Changes:**

1. **Left Column (Tool List):**
   - Remove toggle functionality (✓ → •)
   - Make it label-only for navigation
   - Show global enabled status in right panel
   - User navigates to select which tool to configure

2. **Right Column (Tool Details + Per-Mode Settings):**
   - Show tool description (as before)
   - Add "Per-Mode Settings" section below description
   - List all 4 modes with enable/disable toggles
   - User can navigate through modes with arrow keys
   - Toggle with Enter/Space
   - Apply button to save changes
   - Reset button to restore defaults

3. **Navigation Flow:**
   ```
   1. User navigates left column to select tool
   2. Right panel shows tool description
   3. User tabs to right panel
   4. User navigates through mode settings
   5. User toggles enable/disable per mode
   6. User applies changes
   ```

**Component Structure:**

```typescript
// ToolsTab.tsx
<Box flexDirection="column">
  <Box flexDirection="row">
    {/* Left Panel - Tool List (Read-only) */}
    <ToolList 
      tools={tools}
      selectedTool={selectedTool}
      onSelect={setSelectedTool}
      focused={focusedPanel === 'left'}
    />
    
    {/* Right Panel - Tool Details + Mode Settings */}
    <ToolDetails
      tool={selectedTool}
      modeSettings={modeSettings}
      onToggleMode={handleToggleMode}
      onApply={handleApply}
      onReset={handleReset}
      focused={focusedPanel === 'right'}
    />
  </Box>
</Box>

// ToolList.tsx (Left Panel)
// - Show categories and tools
// - No toggle functionality
// - Just navigation and selection
// - Visual indicator for selected tool

// ToolDetails.tsx (Right Panel)
// - Show tool description
// - Show global status
// - Show per-mode settings section
// - Allow navigation through modes
// - Allow toggle per mode
// - Apply/Reset buttons
```

**Per-Mode Settings Section:**

```typescript
interface ModeSettingRow {
  mode: 'developer' | 'debugger' | 'assistant' | 'planning';
  enabled: boolean;
  isDefault: boolean; // Using default or customized
}

// Visual representation
<Box flexDirection="column" borderStyle="single" padding={1}>
  <Text bold>Per-Mode Settings</Text>
  <Text dimColor>Configure which modes can use this tool</Text>
  
  {modes.map((mode, index) => (
    <Box key={mode.mode}>
      <Text>
        {mode.mode.padEnd(12)}: 
        {mode.enabled ? '[✓ Enabled ]' : '[✗ Disabled]'}
        {mode.isDefault && <Text dimColor> (default)</Text>}
        {index === selectedModeIndex && <Text color="cyan"> ←</Text>}
      </Text>
    </Box>
  ))}
  
  <Box marginTop={1} gap={1}>
    <Text>[Enter] Toggle  [A] Apply  [R] Reset</Text>
  </Box>
</Box>
```

**Settings Storage:**

```json
{
  "tools": {
    "file_search": true,  // Global enable/disable
    "read_file": true,
    "write_file": true
  },
  "toolsByMode": {
    "developer": {
      "file_search": true,
      "read_file": true,
      "write_file": true
    },
    "debugger": {
      "file_search": true,
      "read_file": true,
      "write_file": true
    },
    "assistant": {
      "file_search": false,  // Disabled for assistant
      "read_file": true,
      "write_file": false
    },
    "planning": {
      "file_search": true,
      "read_file": true,
      "write_file": false
    }
  }
}
```

**Implementation Steps:**

1. **Update ToolList component:**
   - Remove toggle functionality
   - Make it read-only navigation
   - Change ✓ to • for items
   - Keep category expand/collapse

2. **Create ToolModeSettings component:**
   - Show 4 modes with enable/disable
   - Allow navigation through modes
   - Toggle with Enter/Space
   - Show default vs customized indicator

3. **Update ToolDetails component:**
   - Add ToolModeSettings below description
   - Handle Apply button (save to settings)
   - Handle Reset button (restore defaults)
   - Manage focus between description and mode settings

4. **Update ToolsContext:**
   - Add getModeSettings(toolId) method
   - Add setModeSettings(toolId, mode, enabled) method
   - Add resetToDefaults(toolId) method
   - Load/save from settings.toolsByMode

5. **Update SettingsService:**
   - Add toolsByMode to UserSettings interface
   - Implement getToolForMode(toolId, mode)
   - Implement setToolForMode(toolId, mode, enabled)
   - Implement resetToolToDefaults(toolId)

6. **Keyboard Navigation:**
   - Tab: Switch between left/right panels
   - ↑/↓: Navigate tools (left) or modes (right)
   - Enter/Space: Toggle mode setting (right panel)
   - A: Apply changes
   - R: Reset to defaults
   - Esc: Exit to nav bar

**Benefits:**
- ✅ Clear separation: browse tools vs configure modes
- ✅ All mode settings visible at once
- ✅ Easy to see which modes have access
- ✅ Cherry-pick tools per mode
- ✅ Visual indicator for defaults vs custom
- ✅ Apply/Reset for safety

---

#### 4.8: Implementation Steps

**Phase 1: Settings Structure**
1. Update UserSettings interface with toolsByMode
2. Add DEFAULT_TOOLS_BY_MODE constants
3. Implement getToolsForMode() in SettingsService
4. Implement setToolForMode() in SettingsService
5. Test settings save/load

**Phase 2: Skill Templates**
1. Create system/skills/ folder
2. Write SkillsDeveloper.txt
3. Write SkillsAssistant.txt
4. Write SkillsPlanning.txt
5. Write SkillsDebugger.txt
6. Validate token counts

**Phase 3: Tool Descriptions**
1. Create system/ToolDescriptions.txt
2. Document all built-in tools
3. Add usage guidelines
4. Validate token count

**Phase 4: SystemPromptBuilder**
1. Update SystemPromptConfig interface
2. Implement mode-specific skills loading
3. Implement tool filtering logic
4. Implement filterToolDescriptions()
5. Test with each mode

**Phase 5: PromptOrchestrator**
1. Add model tool support check
2. Integrate with SettingsService
3. Pass correct parameters to SystemPromptBuilder
4. Test with tool-capable and non-tool models

**Phase 6: UI Redesign**
1. Add mode selector to ToolsTab
2. Update ToolsContext for per-mode settings
3. Implement "Copy to" and "Reset" buttons
4. Add visual indicators for defaults vs custom
5. Test UI interactions

**Phase 7: Testing & Validation**
1. Test each mode with correct tools
2. Verify model without tool support works
3. Validate token budgets
4. Test UI tool selection
5. Test settings persistence
6. Run budget validation script

---

### TASK 5: Integrate Focused Files and Project Rules

**Status:** TODO

**Goal:** Explain focused files to LLM and load project-specific rules

**Current State:**
- Focused files are injected but not explained
- No project rules system
- `.ollm/ollm.md` exists but not used in prompts

**Focused Files:**
- User can focus on specific files in UI
- Files are injected into system prompt
- But LLM doesn't know what "focused files" means

**Proposed Solution:**

#### 5.1: Focused Files Explanation

Add to system prompt when focused files exist:
```markdown
# Focused Files

The user has focused on these files for this conversation:
{list of focused files}

These files are particularly relevant to the current task. Reference them when appropriate.
```

**Implementation:**
- Update ChatClient or PromptOrchestrator
- Check for focused files
- Add explanation section if any exist

#### 5.2: Project Rules

Load project-specific rules from `.ollm/ollm.md`:
```markdown
# Project Rules

{content from .ollm/ollm.md}
```

**Implementation:**
- Check if `.ollm/ollm.md` exists
- Load content
- Pass to SystemPromptBuilder as `projectRules`
- Add to prompt after skills/sanity checks

**Actions:**
1. Add focused files explanation logic
2. Implement project rules loader
3. Update SystemPromptBuilder to accept projectRules
4. Test with real project that has `.ollm/ollm.md`
5. Validate token budgets

---

## New Folder Structure

```
packages/core/src/prompts/templates/
├── system/                          # NEW: System-level components
│   ├── CoreMandates.txt            # Universal rules (~180 tokens)
│   ├── SanityChecks.txt            # Safety protocols (~89 tokens)
│   ├── ToolDescriptions.txt        # Tool explanations (~300 tokens)
│   └── skills/                     # Skill definitions
│       ├── typescript.txt          # TypeScript best practices
│       ├── testing.txt             # Testing strategies
│       ├── debugging.txt           # Debugging approaches
│       ├── refactoring.txt         # Refactoring guidelines
│       ├── documentation.txt       # Documentation writing
│       └── git.txt                 # Git workflow
├── assistant/                       # Mode-specific templates (existing)
│   ├── tier1.txt
│   ├── tier2.txt
│   ├── tier3.txt
│   ├── tier4.txt
│   └── tier5.txt
├── debugger/
│   └── ...
├── developer/
│   └── ...
├── planning/
│   └── ...
└── user/
    └── ...
```

---

## Implementation Order

### Phase 1: Cleanup and Move to Templates
1. ✅ Remove identity.ts (unused)
2. Create system/ folder structure
3. Move CoreMandates to template
4. Move SanityChecks to template
5. Update SystemPromptBuilder to load from files
6. Test and validate budgets

### Phase 2: Enable Sanity Checks
1. Enable sanity checks for Tier 1-2
2. Verify write_memory_dump tool exists
3. Test with small models
4. Validate behavior

### Phase 3: Skills and Tools System
1. Create skill template files
2. Create ToolDescriptions.txt
3. Implement tool filtering by mode
4. Update SystemPromptBuilder
5. Update PromptOrchestrator
6. Test each mode
7. Validate budgets

### Phase 4: Project Integration
1. Implement focused files explanation
2. Implement project rules loader
3. Test with real projects
4. Validate budgets

---

## Success Criteria

- [ ] All prompt components in template files (no hardcoded TypeScript)
- [ ] Core Mandates more concise (~180 tokens vs 267)
- [ ] Sanity checks enabled for Tier 1-2
- [ ] Skills system working with actual skill definitions
- [ ] Tools explained to LLM per mode
- [ ] Focused files explained when present
- [ ] Project rules loaded from `.ollm/ollm.md`
- [ ] All tier budgets still met
- [ ] Budget validation script passes
- [ ] Tests updated and passing

---

## Token Budget Impact

**Current:**
- Tier template: 140-1088 tokens
- Core Mandates: 267 tokens
- **Total:** 407-1355 tokens

**After improvements:**
- Tier template: 140-1088 tokens (unchanged)
- Core Mandates: ~180 tokens (reduced)
- Tool Descriptions: ~100-300 tokens (filtered by mode)
- Skills: ~50-100 tokens per skill (optional)
- Sanity Checks: ~89 tokens (Tier 1-2 only)
- **Total:** ~420-1657 tokens (slight increase, but more useful)

**Mitigation:**
- Tool descriptions filtered by mode (only show allowed tools)
- Skills are optional (only add when needed)
- Sanity checks only for Tier 1-2
- More concise Core Mandates saves 87 tokens

---

## Notes

- Keep backward compatibility during transition
- Test with real models at each phase
- Run budget validation after each change
- Update documentation as we go
- Consider creating migration guide for users with custom prompts
