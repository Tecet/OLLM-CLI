# Tool Chain Analysis - Logic Flow Verification

**Date:** 2026-01-30  
**Purpose:** Trace the complete logic chain from settings → mode selection → prompt orchestrator → LLM

---

## Overview

We need to verify that the tool configuration flows correctly through the entire system:

1. **Settings** (`~/.ollm/settings.json`) - User's tool preferences per mode
2. **SettingsService** - Loads and provides tool settings
3. **Mode Selection** - Current operational mode (developer/debugger/assistant/planning/user)
4. **PromptOrchestrator** - Builds system prompt with filtered tools
5. **SystemPromptBuilder** - Generates tool descriptions based on allowed tools
6. **LLM** - Receives prompt with available tools

---

## Current State Analysis

### ✅ Step 1: Settings Storage (COMPLETE)

**Location:** `~/.ollm/settings.json`

**Structure:**
```json
{
  "tools": {
    "read_file": true,
    "write_file": true,
    // ... all tools with global enable/disable
  },
  "toolsByMode": {
    "developer": { "read_file": true, "write_file": true, ... },
    "debugger": { "read_file": true, "write_file": true, ... },
    "assistant": { "read_file": true, "write_file": false, ... },
    "planning": { "read_file": true, "write_file": false, ... },
    "user": { "read_file": true, "write_file": true, ... }
  }
}
```

**Status:** ✅ Working
- Settings are saved to user's home directory
- All tools are initialized with defaults
- Per-mode configuration is complete

---

### ✅ Step 2: SettingsService (COMPLETE)

**Location:** `packages/cli/src/config/settingsService.ts`

**Key Methods:**
- `getToolsForMode(mode: string): string[]` - Returns enabled tools for a mode
- `setToolForMode(mode: string, toolId: string, enabled: boolean)` - Updates tool for mode
- `getModeSettingsForTool(toolId: string): Record<string, boolean>` - Gets all mode settings for a tool
- `initializeToolSettings(toolIds: string[])` - Initializes all tools in settings

**Logic:**
```typescript
getToolsForMode(mode: string): string[] {
  // 1. Get globally enabled tools
  const globallyEnabled = Object.entries(this.settings.tools || {})
    .filter(([_, enabled]) => enabled)
    .map(([toolId, _]) => toolId);
  
  // 2. Get mode-specific settings
  const modeSettings = this.settings.toolsByMode?.[mode];
  
  // 3. If no custom settings, use defaults
  if (!modeSettings || Object.keys(modeSettings).length === 0) {
    const defaults = DEFAULT_TOOLS_BY_MODE[mode] || [];
    if (defaults.includes('*')) {
      return globallyEnabled; // All enabled tools
    }
    return globallyEnabled.filter(tool => defaults.includes(tool));
  }
  
  // 4. Filter by mode settings
  return globallyEnabled.filter(toolId => modeSettings[toolId] === true);
}
```

**Status:** ✅ Working
- Correctly reads from settings.json
- Handles wildcards ('*')
- Filters tools based on mode

---

### ⚠️ Step 3: Mode Selection (NEEDS VERIFICATION)

**Location:** Multiple files
- `packages/core/src/context/types.ts` - OperationalMode enum
- `packages/core/src/prompts/PromptModeManager.ts` - Mode management
- `packages/cli/src/commands/modeShortcuts.ts` - Mode commands

**Current Mode Storage:**
- Mode is stored in `settings.prompt.mode`
- Mode can be changed via `/developer`, `/debugger`, `/assistant`, `/planning`, `/user` commands
- Mode is tracked in ContextManager

**Questions to Verify:**
1. ✅ Is current mode accessible when building prompts?
2. ⚠️ Does PromptOrchestrator receive the current mode?
3. ⚠️ Is mode passed to SystemPromptBuilder?

**Status:** ⚠️ NEEDS VERIFICATION

---

### ⚠️ Step 4: PromptOrchestrator Integration (NEEDS UPDATE)

**Location:** `packages/core/src/context/promptOrchestrator.ts`

**Current Implementation:**
```typescript
updateSystemPrompt({
  mode,
  tier,
  activeSkills,
  currentContext,
  contextPool,
  emit,
}: UpdateSystemPromptArgs): { message: Message; tokenBudget: number } {
  const useSanityChecks = tier <= ContextTier.TIER_2_BASIC;

  const basePrompt = this.systemPromptBuilder.build({
    interactive: true,
    useSanityChecks,
    skills: activeSkills,
    // ⚠️ MISSING: mode, tier, modelSupportsTools, allowedTools
  });
  
  // ...
}
```

**What's Missing:**
1. ❌ Model capabilities check (does model support tools?)
2. ❌ Get allowed tools from SettingsService based on current mode
3. ❌ Pass mode, tier, modelSupportsTools, allowedTools to SystemPromptBuilder

**Status:** ❌ NEEDS UPDATE

---

### ✅ Step 5: SystemPromptBuilder (COMPLETE)

**Location:** `packages/core/src/context/SystemPromptBuilder.ts`

**Current Implementation:**
```typescript
build(config: SystemPromptConfig): string {
  const sections: string[] = [];

  // 1. Core Mandates
  sections.push(this.loadTemplate('system/CoreMandates.txt'));

  // 2. Mode-Specific Skills
  if (config.mode) {
    const skillsFile = `system/skills/Skills${capitalize(config.mode)}.txt`;
    if (this.templateExists(skillsFile)) {
      sections.push(this.loadTemplate(skillsFile));
    }
  }

  // 3. Available Tools (only if model supports tools)
  if (config.modelSupportsTools && config.allowedTools && config.allowedTools.length > 0) {
    const toolsSection = this.buildToolsSection(config.allowedTools);
    if (toolsSection) sections.push(toolsSection);
  }

  // 4. Sanity Checks
  if (config.useSanityChecks) {
    sections.push(this.loadTemplate('system/SanityChecks.txt'));
  }

  return sections.join('\n\n');
}
```

**Status:** ✅ Working
- Loads mode-specific skills
- Filters tools based on allowedTools array
- Handles wildcard patterns

---

### ⚠️ Step 6: Model Capabilities (NEEDS VERIFICATION)

**Location:** `packages/core/src/routing/` (model profiles)

**Questions:**
1. ⚠️ Where is model tool support information stored?
2. ⚠️ How do we check if current model supports tools?
3. ⚠️ Is this information available in PromptOrchestrator?

**Status:** ⚠️ NEEDS VERIFICATION

---

## Critical Missing Links

### 🔴 Issue 1: PromptOrchestrator doesn't get SettingsService

**Problem:** PromptOrchestrator needs access to SettingsService to get allowed tools for current mode.

**Solution:** Pass SettingsService to PromptOrchestrator constructor or get it from service container.

---

### 🔴 Issue 2: PromptOrchestrator doesn't check model capabilities

**Problem:** We need to know if the current model supports tools before including tool descriptions.

**Solution:** Get model capabilities from ProfileManager or ModelContext.

---

### 🔴 Issue 3: updateSystemPrompt doesn't pass required parameters

**Problem:** SystemPromptBuilder expects mode, tier, modelSupportsTools, allowedTools but they're not being passed.

**Solution:** Update updateSystemPrompt to:
1. Get current model capabilities
2. Get allowed tools from SettingsService based on mode
3. Pass all required parameters to SystemPromptBuilder

---

## Proposed Fix

### Step 1: Update PromptOrchestrator Constructor

```typescript
interface PromptOrchestratorOptions {
  tokenCounter: TokenCounter;
  promptRegistry?: PromptRegistry;
  promptStore?: TieredPromptStore;
  settingsService?: SettingsService;  // NEW
  profileManager?: ProfileManager;    // NEW
}

export class PromptOrchestrator {
  private readonly settingsService: SettingsService;
  private readonly profileManager: ProfileManager;

  constructor({ 
    tokenCounter, 
    promptRegistry, 
    promptStore,
    settingsService,
    profileManager 
  }: PromptOrchestratorOptions) {
    this.tokenCounter = tokenCounter;
    this.promptRegistry = promptRegistry ?? new PromptRegistry();
    this.promptStore = promptStore ?? PromptOrchestrator.createPromptStore();
    this.systemPromptBuilder = new SystemPromptBuilder(this.promptRegistry);
    
    // NEW: Get or create instances
    this.settingsService = settingsService ?? SettingsService.getInstance();
    this.profileManager = profileManager ?? new ProfileManager();
  }
}
```

---

### Step 2: Update updateSystemPrompt Method

```typescript
updateSystemPrompt({
  mode,
  tier,
  activeSkills,
  currentContext,
  contextPool,
  emit,
  currentModel,  // NEW: Need current model
}: UpdateSystemPromptArgs): { message: Message; tokenBudget: number } {
  // Enable sanity checks for Tier 1-2
  const useSanityChecks = tier <= ContextTier.TIER_2_BASIC;

  // NEW: Check if model supports tools
  const modelProfile = this.profileManager.findProfile(currentModel);
  const modelSupportsTools = modelProfile?.tool_support ?? false;

  // NEW: Get allowed tools for current mode
  const allowedTools = modelSupportsTools 
    ? this.settingsService.getToolsForMode(mode)
    : [];

  // Build base prompt with all required parameters
  const basePrompt = this.systemPromptBuilder.build({
    interactive: true,
    mode: mode,                          // NEW
    tier: tier,                          // NEW
    modelSupportsTools: modelSupportsTools,  // NEW
    allowedTools: allowedTools,          // NEW
    useSanityChecks,
    skills: activeSkills,
  });

  const tierPrompt = this.getSystemPromptForTierAndMode(mode, tier);
  const newPrompt = [tierPrompt, basePrompt].filter(Boolean).join('\n\n');

  // ... rest of method
}
```

---

### Step 3: Update UpdateSystemPromptArgs Interface

```typescript
interface UpdateSystemPromptArgs {
  mode: OperationalMode;
  tier: ContextTier;
  activeSkills: string[];
  currentContext: ConversationContext;
  contextPool: ContextPool;
  emit?: EmitFn;
  currentModel: string;  // NEW: Add current model
}
```

---

## Implementation Plan

### Phase 4.1: Update PromptOrchestrator

1. Add SettingsService and ProfileManager to constructor
2. Update updateSystemPrompt to get model capabilities
3. Update updateSystemPrompt to get allowed tools
4. Pass all parameters to SystemPromptBuilder

### Phase 4.2: Update Callers

1. Find all places that call updateSystemPrompt
2. Add currentModel parameter
3. Verify mode is passed correctly

### Phase 4.3: Testing

1. Test with different modes
2. Test with tool-capable model
3. Test with non-tool model
4. Verify tools are filtered correctly
5. Check system prompt includes correct tools

---

## Files to Modify

1. `packages/core/src/context/promptOrchestrator.ts` - Main updates
2. Find callers of `updateSystemPrompt` (need to search)
3. Possibly `packages/core/src/context/contextManagerFactory.ts` - Pass dependencies

---

## Next Steps

1. ✅ Analyze current state (this document)
2. ⚠️ Find all callers of updateSystemPrompt
3. ⚠️ Update PromptOrchestrator
4. ⚠️ Update callers
5. ⚠️ Test integration
6. ⚠️ Verify LLM receives correct tools

---

**Status:** Analysis complete, ready to implement fixes.
