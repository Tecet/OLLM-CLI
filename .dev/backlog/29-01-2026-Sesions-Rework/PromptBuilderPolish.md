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
1. Defines what skills are (typescript, testing, debugging, etc.)
2. Explains available tools to LLM based on user settings
3. Integrates with mode-specific tool restrictions
4. Allows combining skills per mode

**Current State:**
- ✅ Tool enable/disable UI exists (ToolsTab, ToolsPanel)
- ✅ Settings saved in `~/.ollm/settings.json` under `tools: { [toolId]: boolean }`
- ✅ ToolsContext manages tool state
- ⚠️ Mode-specific tool restrictions exist but are hardcoded
- ❌ No skills defined
- ❌ Tools not explained to LLM

**Tool Settings Storage:**
```typescript
// ~/.ollm/settings.json
{
  "tools": {
    "read_file": true,
    "write_file": true,
    "shell": false,
    // ... etc
  }
}
```

**Current Mode-Specific Tool Access (from PromptModeManager):**
```typescript
assistant: []                    // No tools
planning: [                      // Read-only + web
  'web_search', 'web_fetch',
  'read_file', 'read_multiple_files',
  'grep_search', 'file_search', 'list_directory',
  'get_diagnostics', 'write_memory_dump',
  'trigger_hot_swap', 'mcp:*'
]
developer: ['*']                 // All tools
debugger: [                      // Read + diagnostics + git
  'read_file', 'grep_search', 'list_directory',
  'get_diagnostics', 'shell',
  'git_diff', 'git_log',
  'web_search', 'write_file', 'str_replace',
  'write_memory_dump', 'trigger_hot_swap', 'mcp:*'
]
```

**Proposed Improvement:**

Instead of hardcoded mode restrictions, use a hybrid approach:
1. **Developer/Debugger modes:** Use ALL enabled tools (user controls via UI)
2. **Assistant/Planning modes:** Use mode-specific defaults + user overrides

**New Settings Structure:**
```typescript
// ~/.ollm/settings.json
{
  "tools": {
    // Global enable/disable (affects all modes)
    "read_file": true,
    "write_file": true,
    "shell": true,
    // ... etc
  },
  "toolsByMode": {
    // Optional: Override per mode
    "assistant": {
      "read_file": true,      // Enable for assistant
      "web_search": true,     // Enable for assistant
      "write_file": false     // Disable for assistant (even if globally enabled)
    },
    "planning": {
      // Uses defaults + global settings if not specified
    }
  }
}
```

**Implementation Strategy:**

#### 4.1: Create Skill Templates

**Location:** `packages/core/src/prompts/templates/system/skills/`

**Files to create:**
- `typescript.txt` - TypeScript best practices
- `testing.txt` - Testing strategies and tools
- `debugging.txt` - Debugging approaches
- `refactoring.txt` - Code refactoring guidelines
- `documentation.txt` - Documentation writing
- `git.txt` - Git workflow and commands

**Example: `typescript.txt`**
```markdown
# TypeScript Skill

You have expertise in TypeScript development:
- Use strict type checking
- Prefer interfaces over types for objects
- Use generics for reusable code
- Avoid `any`, use `unknown` when type is uncertain
- Leverage utility types (Partial, Pick, Omit, etc.)
```

**Note:** Skills are separate from tools. Skills are knowledge/guidelines, tools are actions.

#### 4.2: Create Tool Descriptions Template

**Location:** `packages/core/src/prompts/templates/system/ToolDescriptions.txt`

**Purpose:** Explain what each tool does (separate from tool schemas)

**Format:**
```markdown
# Available Tools

You have access to the following tools:

## File Operations
- read_file: Read content from a file
- write_file: Create or overwrite a file
- str_replace: Replace text in a file
- read_multiple_files: Read multiple files at once
- list_directory: List directory contents

## Search & Discovery
- grep_search: Search for text patterns in files
- file_search: Find files by name pattern
- get_diagnostics: Get compile/lint errors

## Web Access
- web_search: Search the web for information
- web_fetch: Fetch content from a URL

## Git Operations
- git_diff: Show changes in working directory
- git_log: Show commit history
- git_status: Show repository status

## Development
- shell: Execute shell commands
- write_memory_dump: Save important context to memory

## MCP Tools
- mcp:*: Model Context Protocol tools (varies by server)

Use tools proactively to gather information before making assumptions.
```

#### 4.3: Tool Filtering Logic

**New approach:**
1. Get globally enabled tools from settings
2. For developer/debugger: Use ALL enabled tools
3. For assistant/planning: Filter by mode defaults + user overrides
4. Generate tool descriptions for only the allowed tools

**Pseudocode:**
```typescript
function getToolsForMode(mode: string, settings: UserSettings): string[] {
  const globallyEnabled = Object.entries(settings.tools)
    .filter(([_, enabled]) => enabled)
    .map(([toolId, _]) => toolId);
  
  if (mode === 'developer' || mode === 'debugger') {
    // Use all globally enabled tools
    return globallyEnabled;
  }
  
  // For assistant/planning, use mode defaults
  const modeDefaults = getModeDefaults(mode);
  const modeOverrides = settings.toolsByMode?.[mode] || {};
  
  return globallyEnabled.filter(toolId => {
    // Check mode-specific override first
    if (toolId in modeOverrides) {
      return modeOverrides[toolId];
    }
    // Fall back to mode defaults
    return modeDefaults.includes(toolId) || modeDefaults.includes('*');
  });
}
```

#### 4.4: Update SystemPromptBuilder

**Changes needed:**
1. Load skill templates from files
2. Load tool descriptions template
3. Filter tool descriptions based on mode + settings
4. Combine skills + tools into coherent section

**Proposed build order:**
```
1. Tier-specific template (identity + mode-specific guidance)
2. Core Mandates (universal rules)
3. Available Tools (filtered by mode + user settings)
4. Active Skills (if any)
5. Sanity Checks (if Tier 1-2)
6. Project Rules (if any)
```

#### 4.5: Integration Points

**PromptOrchestrator.updateSystemPrompt():**
```typescript
updateSystemPrompt({ mode, tier, activeSkills, ... }) {
  // Get tools for this mode (respects user settings)
  const allowedTools = this.getToolsForMode(mode);
  
  // Build base prompt with tools and skills
  const basePrompt = this.systemPromptBuilder.build({
    interactive: true,
    mode: mode,                           // NEW: Pass mode
    tier: tier,                           // NEW: Pass tier
    allowedTools: allowedTools,           // NEW: Pass allowed tools
    useSanityChecks: tier <= Tier.TIER_2, // NEW: Enable for small tiers
    skills: activeSkills,
  });
  
  const tierPrompt = this.getSystemPromptForTierAndMode(mode, tier);
  const newPrompt = [tierPrompt, basePrompt].filter(Boolean).join('\n\n');
  
  return { message: systemPrompt, tokenBudget };
}
```

**SystemPromptBuilder.build():**
```typescript
build(config: SystemPromptConfig): string {
  const sections: string[] = [];
  
  // 1. Core Mandates (always)
  sections.push(this.loadTemplate('system/CoreMandates.txt'));
  
  // 2. Available Tools (filtered by mode + user settings)
  const toolsSection = this.buildToolsSection(config.allowedTools);
  if (toolsSection) sections.push(toolsSection);
  
  // 3. Active Skills (if any)
  if (config.skills?.length > 0) {
    const skillsSection = this.buildSkillsSection(config.skills);
    if (skillsSection) sections.push(skillsSection);
  }
  
  // 4. Sanity Checks (if enabled)
  if (config.useSanityChecks) {
    sections.push(this.loadTemplate('system/SanityChecks.txt'));
  }
  
  // 5. Project Rules (if any)
  if (config.projectRules) {
    sections.push('# Project Rules\n' + config.projectRules);
  }
  
  return sections.join('\n\n');
}

buildToolsSection(allowedTools: string[]): string {
  const allToolDescriptions = this.loadTemplate('system/ToolDescriptions.txt');
  
  // Filter to only show allowed tools
  return this.filterToolDescriptions(allToolDescriptions, allowedTools);
}
```

#### 4.6: UI Enhancement (Optional)

**Add per-mode tool settings:**
1. Add "Mode Overrides" section to ToolsTab
2. Show which tools are available in each mode
3. Allow users to override mode defaults
4. Save to `settings.toolsByMode`

**Benefits:**
- Users can customize assistant/planning tool access
- Developer/debugger always get all enabled tools
- Clear visibility of what tools are available per mode

**Actions:**
1. Create skill template files
2. Create ToolDescriptions.txt
3. Implement getToolsForMode() logic
4. Update SystemPromptBuilder interface
5. Implement buildToolsSection()
6. Implement buildSkillsSection()
7. Update PromptOrchestrator to pass mode/tier/tools
8. Test with each mode to verify correct tools shown
9. Validate token budgets still met
10. (Optional) Add per-mode tool settings UI

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
