# Current Prompt Components Analysis

**Date:** 2026-01-29  
**Purpose:** Review existing prompt components before refactoring

---

## Current System Prompt Structure

The system prompt is assembled in this order:

1. **Tier-specific template** (from `packages/core/src/prompts/templates/{mode}/tier{N}.txt`)
2. **Core Mandates** (~267 tokens) - Always included
3. **Active Skills** (variable) - Optional
4. **Sanity Checks** (~89 tokens) - Optional
5. **Additional Instructions** (variable) - Optional

---

## Component 1: Identity (NOT CURRENTLY USED)

**File:** `packages/core/src/prompts/templates/identity.ts`  
**Status:** ❌ Defined but not used in SystemPromptBuilder  
**Tokens:** ~30 tokens

```
You are {{agentType}}CLI agent specializing in software engineering tasks. 
Your primary goal is to help users safely and efficiently, adhering strictly 
to the following instructions and utilizing your available tools.
```

**Issues:**
- Has template variable `{{agentType}}` but no substitution logic
- Not registered or used in SystemPromptBuilder
- Redundant with tier-specific templates that already define identity

---

## Component 2: Core Mandates (ALWAYS INCLUDED)

**File:** `packages/core/src/prompts/templates/mandates.ts`  
**Status:** ✅ Always included via SystemPromptBuilder  
**Tokens:** ~267 tokens

```markdown
# Core Mandates

- **Conventions:** Rigorously adhere to existing project conventions (style, 
  naming, patterns) when reading or modifying code. Analyze surrounding code first.
  
- **Verification:** NEVER assume a library/framework is available. Verify via 
  'package.json' or imports before usage.
  
- **Idiomatic Changes:** Ensure changes integrate naturally. Understanding local 
  context (imports, class hierarchy) is mandatory.
  
- **Comments:** Add comments sparingly and only for "why", not "what".

- **Proactiveness:** Fulfill the request thoroughly, including adding tests for 
  new features.
  
- **Ambiguity:** Do not take significant actions beyond the clear scope of the 
  request.
  
- **Output:** Be professional and concise. Avoid conversational filler ("Okay", 
  "I will now").
  
- **Tool Usage:** Proactively use available tools to gather information before 
  making assumptions. Prefer file reading tools over guessing file contents, use 
  grep/glob for discovery, leverage memory for important context, and use web 
  search for current information about libraries and frameworks.
```

**Issues:**
- Good content but could be more concise
- Some points are redundant with tier templates
- "Proactiveness" about tests might not apply to all modes
- Could be split into separate concerns (code quality, tool usage, output style)

---

## Component 3: Sanity Checks (OPTIONAL)

**File:** `packages/core/src/prompts/templates/sanity.ts`  
**Status:** ⚠️ Optional, currently disabled (useSanityChecks: false)  
**Tokens:** ~89 tokens

```markdown
# Reality Check Protocol

- **Pre-Flight:** Before editing any file, you MUST read it first to verify its 
  content matches your assumptions.
  
- **Reproduction:** Before fixing a bug, you MUST reproduce it or read the exact 
  error log/traceback.
  
- **Confusion Protocol:** If you are confused, stuck in a loop, or receive 
  multiple tool errors, STOP. Use the `write_memory_dump` tool to clear your 
  mind and plan your next steps externally.
```

**Issues:**
- Good safety protocols for smaller models
- Currently disabled in PromptOrchestrator (useSanityChecks: false)
- Should be enabled for Tier 1-2 (smaller contexts/models)
- References `write_memory_dump` tool that may not exist

---

## Component 4: State Snapshot (COMPRESSION ONLY)

**File:** `packages/core/src/prompts/templates/stateSnapshot.ts`  
**Status:** ✅ Used only for compression, not in main system prompt  
**Tokens:** ~200 tokens

```
You are the specialized state manager. Your job is to compress the entire 
conversation history into a structured XML snapshot.

This snapshot will be the ONLY memory the agent has of the past. You MUST preserve:
1. The user's original goal.
2. Critical file system changes (what was read/written).
3. The current plan status (what is done, what is pending).

Structure your response EXACTLY as follows:

<state_snapshot>
  <overall_goal>
    <!-- Concise sentence describing the user's objective -->
  </overall_goal>

  <key_knowledge>
    <!-- Bullet points of learned facts, constraints, or user preferences -->
  </key_knowledge>

  <file_system_state>
    <!-- List of files accessed, modified, or created with brief notes -->
    <!-- e.g. - MODIFIED: src/app.ts (Added error handling) -->
  </file_system_state>

  <current_plan>
    <!-- Step-by-step plan with status -->
    <!-- 1. [DONE] Analyze requirements -->
    <!-- 2. [IN PROGRESS] Implement feature X -->
    <!-- 3. [TODO] Verify changes -->
  </current_plan>
</state_snapshot>
```

**Issues:**
- Good structure for compression
- Not part of main system prompt (correct)
- Used in chatCompressionService and HotSwapService

---

## Component 5: Skills (OPTIONAL)

**Status:** ⚠️ Placeholder, no actual skills defined  
**Tokens:** Variable

Currently just adds:
```markdown
# Active Skills
{skill content from registry}
```

**Issues:**
- No skills are currently registered in the system
- Placeholder functionality only
- Need to define actual skills (typescript, testing, debugging, etc.)

---

## Component 6: Additional Instructions (OPTIONAL)

**Status:** ⚠️ Placeholder, not used  
**Tokens:** Variable

Currently just adds:
```markdown
# Additional Instructions
{custom instructions}
```

**Issues:**
- No mechanism to set additional instructions
- Could be used for project-specific rules
- Could be loaded from `.ollm/ollm.md` or similar

---

## How Prompts Are Built

### Location 1: PromptOrchestrator.updateSystemPrompt()

**File:** `packages/core/src/context/promptOrchestrator.ts`

```typescript
updateSystemPrompt({ mode, tier, activeSkills, ... }) {
  // 1. Build base prompt (mandates + skills + sanity + additional)
  const basePrompt = this.systemPromptBuilder.build({
    interactive: true,
    useSanityChecks: false,  // ❌ Currently disabled
    skills: activeSkills,     // ⚠️ No skills registered
  });
  
  // 2. Get tier-specific template
  const tierPrompt = this.getSystemPromptForTierAndMode(mode, tier);
  
  // 3. Combine: [tierPrompt, basePrompt]
  const newPrompt = [tierPrompt, basePrompt].filter(Boolean).join('\n\n');
  
  return { message: systemPrompt, tokenBudget };
}
```

**Order:** Tier template FIRST, then mandates/skills/sanity

### Location 2: SystemPromptBuilder.build()

**File:** `packages/core/src/context/SystemPromptBuilder.ts`

```typescript
build(config: SystemPromptConfig): string {
  const sections: string[] = [];
  
  // 1. Mandates (always)
  sections.push(mandates.content);
  
  // 2. Skills (if any)
  if (config.skills?.length > 0) {
    sections.push('# Active Skills\n' + skillsContent.join('\n\n'));
  }
  
  // 3. Sanity checks (if enabled)
  if (config.useSanityChecks) {
    sections.push(sanity.content);
  }
  
  // 4. Additional instructions (if any)
  if (config.additionalInstructions) {
    sections.push('# Additional Instructions\n' + config.additionalInstructions);
  }
  
  return sections.join('\n\n');
}
```

**Order:** Mandates → Skills → Sanity → Additional

### Location 3: ChatClient (Dynamic Context)

**File:** `packages/core/src/core/chatClient.ts`

```typescript
// Get context additions from dynamic context manager
let systemPromptWithContext = options?.systemPrompt;
if (this.contextManager) {
  const contextAdditions = this.contextManager.getSystemPromptAdditions();
  if (contextAdditions) {
    systemPromptWithContext = (systemPromptWithContext || '') + contextAdditions;
  }
}
```

**Adds:** Memory context, focused files, etc. (appended to end)

---

## Issues Summary

### ❌ Critical Issues

1. **Identity prompt defined but not used** - Waste of code, confusing
2. **Sanity checks disabled** - Should be enabled for Tier 1-2
3. **No skills system** - Placeholder only, no actual skills
4. **Hardcoded in TypeScript** - Should be in template files for easy editing

### ⚠️ Design Issues

1. **Mandates too verbose** - 267 tokens, could be more concise
2. **Redundancy** - Some mandates overlap with tier templates
3. **No separation of concerns** - Mandates mix code quality, tool usage, output style
4. **No project-specific rules** - No way to add custom instructions per project
5. **Order inconsistency** - Tier template first, then mandates (should mandates be first?)

### 💡 Opportunities

1. **Move to templates** - All components should be `.txt` files, not TypeScript
2. **Tier-specific components** - Different mandates for different tiers
3. **Mode-specific components** - Different rules for assistant vs developer mode
4. **Skill system** - Define actual skills (typescript, testing, debugging, etc.)
5. **Project rules** - Load from `.ollm/ollm.md` or `.ollm/rules.txt`
6. **Dynamic context** - Better integration of memory, focused files, etc.

---

## Proposed New Structure

```
packages/core/src/prompts/templates/
├── system/                    # NEW: System-level components
│   ├── identity.txt          # Base identity (if needed)
│   ├── mandates/             # Core rules by tier
│   │   ├── tier1.txt        # Minimal mandates for small contexts
│   │   ├── tier2.txt        # Basic mandates
│   │   ├── tier3.txt        # Standard mandates
│   │   └── tier4-5.txt      # Full mandates
│   ├── sanity/               # Safety protocols by tier
│   │   ├── tier1.txt        # Essential safety for small models
│   │   ├── tier2.txt        # Basic safety
│   │   └── tier3-5.txt      # Full safety protocols
│   ├── skills/               # Skill definitions
│   │   ├── typescript.txt
│   │   ├── testing.txt
│   │   ├── debugging.txt
│   │   └── refactoring.txt
│   └── output-style/         # Output formatting rules
│       ├── concise.txt      # For assistant mode
│       ├── detailed.txt     # For developer mode
│       └── planning.txt     # For planning mode
├── assistant/                # Mode-specific templates (existing)
│   ├── tier1.txt
│   └── ...
└── ...
```

---

## Next Steps

1. **Review components** - Discuss what to keep, change, remove
2. **Define new structure** - Agree on folder organization
3. **Create templates** - Move from TypeScript to `.txt` files
4. **Update SystemPromptBuilder** - Load from templates instead of hardcoded
5. **Enable sanity checks** - For Tier 1-2
6. **Define skills** - Create actual skill definitions
7. **Test and validate** - Run budget validation, test with real models
