# Prompt System

**Last Updated:** January 27, 2026  
**Status:** Source of Truth

**Related Documents:**
- `dev_ContextManagement.md` - Context sizing, tiers, VRAM
- `dev_ContextCompression.md` - Compression, checkpoints, snapshots
- `dev_ModelDB.md` - Model database schema and access patterns
- `dev_CheckpointRollover.md` - Checkpoint strategy, sessions, snapshots, and chat history

---

## Overview

The Prompt System manages system prompts that guide LLM behavior. It provides tier-specific prompts for different context sizes and mode-specific prompts for different operational modes.

**Core Responsibility:** Build and maintain the system prompt that defines LLM behavior.

---

## Architecture

### Component Hierarchy

```
ContextManager (Owner)
  ↓
PromptOrchestrator (Coordinator)
  ├─ TieredPromptStore (Mode+Tier Templates)
  ├─ PromptRegistry (Core Prompts)
  └─ SystemPromptBuilder (Assembly)
```

**Key Principle:** ContextManager is the ONLY owner of system prompts. All other components are helpers.

---

## Core Components

### 1. PromptOrchestrator
**Location:** `packages/core/src/context/promptOrchestrator.ts`

**Role:** Coordinates prompt loading and system prompt construction

**Responsibilities:**
- Loads tiered prompt templates from filesystem
- Resolves mode+tier combinations
- Calculates token budgets per tier
- Orchestrates SystemPromptBuilder
- Updates system prompt in conversation context

**Key Methods:**
```typescript
getSystemPromptForTierAndMode(mode, tier): string
  ↓ Loads from TieredPromptStore
  
getSystemPromptTokenBudget(tier): number
  ↓ Returns tier-specific budget
  
updateSystemPrompt({ mode, tier, activeSkills, ... })
  ↓ Builds and injects system prompt
```

### 2. TieredPromptStore
**Location:** `packages/core/src/prompts/tieredPromptStore.ts`

**Role:** Loads and stores mode+tier prompt templates from filesystem

**Key Methods:**
```typescript
load(): void
  ↓ Scans templates/ directory
  ↓ Loads all mode+tier combinations
  
get(mode, tier): string | undefined
  ↓ Returns template for mode+tier
  ↓ Returns undefined if not found
```

### 3. PromptRegistry
**Location:** `packages/core/src/prompts/PromptRegistry.ts`

**Role:** Registry for core prompts (mandates, sanity checks, skills)

**Key Methods:**
```typescript
register(definition: PromptDefinition): void
get(id: string): RegisteredPrompt | undefined
getByTag(tag: string): RegisteredPrompt[]
getBySource(source): RegisteredPrompt[]
clearMcpPrompts(serverName: string): void
```

### 4. SystemPromptBuilder
**Location:** `packages/core/src/context/SystemPromptBuilder.ts`

**Role:** Assembles final system prompt from registry components

**Assembly Order:**
```
1. Core Mandates (from registry: 'core-mandates')
2. Active Goals (from goal manager - never compressed)
3. Active Skills (from registry by skill IDs)
4. Sanity Checks (optional, from registry: 'sanity-reality-check')
5. Additional Instructions (custom user instructions)
```

---

## Prompt Tiers

Prompt tiers correspond to context tiers (see `dev_ContextManagement.md`) and determine the detail level of system prompts.

### Tier Token Budgets

| Tier | Context Size | Prompt Budget | % of Context |
|------|--------------|---------------|--------------|
| Tier 1 (Minimal) | 2K, 4K | 200 tokens | 5-10% |
| Tier 2 (Basic) | 8K | 500 tokens | 6.3% |
| Tier 3 (Standard) | 16K | 1000 tokens | 6.3% |
| Tier 4 (Premium) | 32K | 1500 tokens | 4.7% |
| Tier 5 (Ultra) | 64K, 128K | 1500 tokens | 1.2-2.3% |

**Principle:** Larger contexts can afford more detailed prompts without sacrificing user content space.

### Why Scale Prompts by Tier?

**Tier 1 (2-4K):** Minimal context
- ~200 tokens (5% of 4K)
- Essential behavior only
- No verbose instructions
- Focus on core capabilities

**Tier 2 (8K):** Basic context
- ~500 tokens (6.3% of 8K)
- Detailed guidance
- Basic tool instructions
- Mode-specific behavior

**Tier 3 (16K):** Standard context ⭐
- ~1000 tokens (6.3% of 16K)
- Comprehensive instructions
- Full tool documentation
- Mode-specific strategies

**Tier 4 (32K):** Premium context
- ~1500 tokens (4.7% of 32K)
- Expert-level guidance
- Advanced patterns
- Optimization strategies

**Tier 5 (64-128K):** Ultra context
- ~1500 tokens (1.2% of 131K)
- Maximum sophistication
- Complex reasoning patterns
- Multi-step workflows

---

## Goal Management System

### Overview

Goals are a critical part of the prompt system. They help the LLM stay focused on the task at hand and track progress through complex multi-step workflows.

**Key Principles:**
- Goals are NEVER compressed
- Goals are always included in system prompt
- Goals are updated when milestones are reached
- Goals guide checkpoint summarization

### Goal Structure

```typescript
interface Goal {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
  completedAt?: Date;
  checkpoints: Checkpoint[];
  decisions: Decision[];
  artifacts: Artifact[];
}

interface Checkpoint {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  completedAt?: Date;
}

interface Decision {
  id: string;
  description: string;
  rationale: string;
  locked: boolean;  // Locked decisions cannot be changed
}

interface Artifact {
  type: 'file' | 'test' | 'documentation';
  path: string;
  action: 'created' | 'modified' | 'deleted';
}
```

### Goal Lifecycle

```
1. User provides task
   ↓
2. LLM analyzes task and creates goal
   ↓
3. Goal added to system prompt (never compressed)
   ↓
4. LLM works on goal, creating checkpoints
   ↓
5. Checkpoints marked as completed
   ↓
6. Goal marked as completed when all checkpoints done
   ↓
7. Goal remains in prompt until user starts new task
```

### Goal in System Prompt

Goals are injected into the system prompt between mandates and skills:

```
[Core Mandates]

[Active Goal]
CURRENT GOAL: Implement user authentication system
Priority: High
Status: Active

Checkpoints:
✅ 1. Design authentication flow
✅ 2. Implement login endpoint
🔄 3. Add JWT token generation (IN PROGRESS)
⏳ 4. Create user registration
⏳ 5. Add password hashing

Key Decisions:
🔒 Use JWT for authentication (locked)
🔒 Store tokens in httpOnly cookies (locked)
- Use bcrypt for password hashing

Artifacts:
- Created: src/auth/login.ts
- Created: src/auth/jwt.ts
- Modified: src/routes/api.ts

[Active Skills]
[Sanity Checks]
[Additional Instructions]
```

### Goal-Aware Summarization

When creating checkpoints (see `dev_ContextCompression.md`), the LLM is instructed to summarize with the goal in mind:

```typescript
const summaryPrompt = `
ACTIVE GOAL: ${goal.description}

Summarize the following conversation, focusing on progress toward the goal:
${messagesToCompress.join('\n')}

Preserve:
- Decisions made toward the goal
- Checkpoints completed
- Files created/modified
- Blockers encountered
- Next steps planned

Provide a concise summary that maintains essential information for continuing work on the goal.
`;
```

### Goal Markers in LLM Output

The LLM can use special markers to update goals:

```
[GOAL] Implement user authentication system
[CHECKPOINT] Design authentication flow - COMPLETED
[DECISION] Use JWT for authentication - LOCKED
[ARTIFACT] Created src/auth/login.ts
[NEXT] Implement JWT token generation
```

These markers are parsed and used to update the goal structure automatically.

---

## Operational Modes

### Mode Profiles

**Assistant Mode** (Default)
- General-purpose conversational AI
- Balanced between helpfulness and safety
- Moderate tool usage
- Template: `templates/assistant/tier{1-5}.txt`

**Developer Mode**
- Code-focused assistance
- Aggressive tool usage
- Technical language
- Template: `templates/developer/tier{1-5}.txt`

**Planning Mode**
- Project planning and architecture
- Goal-oriented thinking
- Strategic recommendations
- Template: `templates/planning/tier{1-5}.txt`

**Debugger Mode**
- Error analysis and troubleshooting
- Systematic debugging approach
- Root cause analysis
- Template: `templates/debugger/tier{1-5}.txt`

**User Mode** (Custom)
- User-defined behavior
- Customizable prompt templates
- Same structure as Assistant mode (default copy)
- Template: `templates/user/tier{1-5}.txt`
- Command: `/mode user`

**Note:** User mode templates can be customized by editing the files in `templates/user/`. By default, they are copies of Assistant mode templates.

---

## Template Organization

### Filesystem Structure

```
packages/core/src/prompts/templates/
├── assistant/
│   ├── tier1.txt
│   ├── tier2.txt
│   ├── tier3.txt
│   ├── tier4.txt
│   └── tier5.txt
├── developer/
│   ├── tier1.txt
│   ├── tier2.txt
│   ├── tier3.txt
│   ├── tier4.txt
│   └── tier5.txt
├── planning/
│   ├── tier1.txt
│   ├── tier2.txt
│   ├── tier3.txt
│   ├── tier4.txt
│   └── tier5.txt
├── debugger/
│   ├── tier1.txt
│   ├── tier2.txt
│   ├── tier3.txt
│   ├── tier4.txt
│   └── tier5.txt
├── user/
│   ├── tier1.txt
│   ├── tier2.txt
│   ├── tier3.txt
│   ├── tier4.txt
│   └── tier5.txt
├── mandates.ts      (Core behavior)
├── sanity.ts        (Reality checks)
├── identity.ts      (Agent identity)
└── stateSnapshot.ts (State tracking)
```

### Fallback Strategy

```
1. Try: packages/core/dist/prompts/templates/
2. Fallback: packages/core/src/prompts/templates/
3. Use: Developer Tier 3 as last resort
```

---

## Prompt Construction Flow

### Startup Flow

```
ContextManager.start()
  ↓
Detect Hardware Capability Tier (see dev_ContextManagement.md)
  ↓
Detect Actual Context Tier (see dev_ContextManagement.md)
  ↓
Calculate Effective Prompt Tier
  ↓
PromptOrchestrator.updateSystemPrompt({
    mode: OperationalMode.ASSISTANT,
    tier: effectivePromptTier,
    activeSkills: [],
    activeGoal: null,  // No goal yet
    currentContext,
    contextPool
  })
  ↓
PromptOrchestrator Flow:
  ├─ TieredPromptStore.get(mode, tier)
  │   ↓ Returns mode+tier template
  ├─ GoalManager.getActiveGoal()
  │   ↓ Returns active goal (if any)
  ├─ SystemPromptBuilder.build({ skills, goal })
  │   ├─ PromptRegistry.get('core-mandates')
  │   ├─ Format active goal (if exists)
  │   │  ├─ Goal description
  │   │  ├─ Checkpoints (✅🔄⏳)
  │   │  ├─ Decisions (🔒)
  │   │  └─ Artifacts
  │   ├─ PromptRegistry.get(skillId) for each skill
  │   └─ PromptRegistry.get('sanity-reality-check') if enabled
  │   ↓ Returns assembled core prompt
  └─ Combine: [tierPrompt, corePrompt].join('\n\n')
  ↓
Create System Message
  ↓
Inject into currentContext.messages[0]
  ↓
Update token count
  ↓
Emit 'system-prompt-updated'
```

### Mode Change Flow

```
ContextManager.setMode(newMode)
  ↓
Update currentMode
  ↓
PromptOrchestrator.updateSystemPrompt({
    mode: newMode,
    tier: effectivePromptTier,  // Stays same
    ...
  })
  ↓
Load new mode+tier template
  ↓
Rebuild system prompt
  ↓
Replace in context
```

---

## Prompt Tier Selection Logic

### Current Implementation (v0.1.0)

**Rule:** Prompt tier ALWAYS follows selected context size

```typescript
// packages/core/src/context/contextManager.ts
// Simplified in Task 1: Single selectedTier variable
private selectedTier: ContextTier;  // Source of truth for tier

// Prompt tier always equals selectedTier
getPromptTier(): ContextTier {
  return this.selectedTier;
}
```

**Behavior:**
- Auto-sizing enabled: Prompt tier changes as context size changes
- Manual sizing: Prompt tier matches user-selected context size
- Single tier variable (selectedTier) is source of truth

**Example:**
```
Hardware: 24GB VRAM → Can support 32K context
User Selection: 16K context
Actual Context Tier: Tier 3 (16K)
Effective Prompt Tier: Tier 3 (follows actual)

If auto-sizing adjusts: 16K → 20K
  ↓ Actual Context Tier: Tier 4 (32K)
  ↓ Effective Prompt Tier: Tier 4 (follows actual)
  ↓ System prompt CHANGES mid-conversation ⚠️
```

**Known Issue:** This can cause prompt instability during auto-sizing. See `works_todo.md`.

---

## Prompt Registry

### Registered Prompts

```typescript
interface RegisteredPrompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  requiredTools?: string[];
  tags?: string[];
  source: 'static' | 'mcp' | 'config';
  serverName?: string;  // If from MCP
  registeredAt: number;
}
```

### Prompt Sources

- **static:** Built-in prompts (mandates, sanity)
- **mcp:** Prompts from MCP servers
- **config:** User-defined prompts

### MCP Integration

MCP servers can register prompts dynamically:

```typescript
// MCP server registers prompt
promptRegistry.register({
  id: 'github-workflow',
  name: 'GitHub Workflow',
  content: 'Instructions for GitHub operations...',
  source: 'mcp',
  serverName: 'github-mcp',
  tags: ['skill', 'github']
});

// When server disconnects, clear its prompts
promptRegistry.clearMcpPrompts('github-mcp');
```

---

## Configuration

### System Prompt Config

```typescript
interface SystemPromptConfig {
  interactive: boolean;
  useSanityChecks?: boolean;
  agentName?: string;
  additionalInstructions?: string;
  skills?: string[];  // Skill IDs to include
  goal?: Goal;        // Active goal to include
}
```

### Goal Manager API

```typescript
interface GoalManager {
  // Goal lifecycle
  createGoal(description: string, priority: 'high' | 'medium' | 'low'): Goal;
  getActiveGoal(): Goal | null;
  pauseGoal(goalId: string): void;
  completeGoal(goalId: string, summary: string): void;
  
  // Checkpoints
  createCheckpoint(goalId: string, description: string, metadata?: any, summary?: string): Checkpoint;
  updateCheckpoint(goalId: string, checkpointId: string, status: 'pending' | 'in-progress' | 'completed'): void;
  
  // Decisions
  recordDecision(goalId: string, description: string, rationale: string): Decision;
  lockDecision(goalId: string, decisionId: string): void;
  
  // Artifacts
  recordArtifact(goalId: string, type: 'file' | 'test' | 'documentation', path: string, action: 'created' | 'modified' | 'deleted'): void;
  
  // Query
  getGoalProgress(goalId: string): { completed: number; total: number; percentage: number };
  getGoalHistory(): Goal[];
}
```

### Default Values

```typescript
const DEFAULT_CONFIG = {
  interactive: true,
  useSanityChecks: true,
  agentName: 'Assistant',
  additionalInstructions: '',
  skills: []
};
```

---

## Events

### Prompt Events

- `system-prompt-updated` - System prompt changed
- `mode-changed` - Operational mode changed
- `active-skills-updated` - Active skills changed
- `active-tools-updated` - Active tools changed
- `active-hooks-updated` - Active hooks changed
- `active-mcp-updated` - Active MCP servers changed

---

## Best Practices

### 1. Prompt Design

- Keep Tier 1 prompts minimal (200 tokens max)
- Scale detail with tier size
- Use clear, concise language
- Focus on behavior, not implementation

### 2. Mode Selection

- Use Assistant mode for general tasks
- Use Developer mode for coding tasks
- Use Planning mode for architecture
- Use Debugger mode for troubleshooting

### 3. Skills

- Register skills in PromptRegistry
- Tag skills appropriately
- Keep skill prompts focused
- Test skills in isolation

### 4. MCP Prompts

- Clear prompts when server disconnects
- Version prompts for compatibility
- Document required tools
- Test prompt integration

### 5. User Mode Customization

- User mode templates are located in `templates/user/`
- By default, they are copies of Assistant mode
- Edit the tier files to customize behavior
- Changes take effect on next mode switch
- Keep tier token budgets in mind when editing

**Example Customization:**
```bash
# Edit user mode tier 3 prompt
nano packages/core/src/prompts/templates/user/tier3.txt

# Switch to user mode
/mode user
```

**Use Cases:**
- Domain-specific assistants (medical, legal, etc.)
- Company-specific tone and guidelines
- Specialized workflows
- Custom teaching styles
- Experimental prompt testing

---

## Troubleshooting

### Prompt Not Loading

**Symptom:** Default prompt used instead of tier-specific

**Solutions:**
1. Check template file exists
2. Verify file path is correct
3. Check fallback strategy
4. Review logs for loading errors

### Prompt Too Large

**Symptom:** Prompt exceeds tier budget

**Solutions:**
1. Reduce prompt verbosity
2. Remove unnecessary instructions
3. Split into skills
4. Use lower tier template

### Mode Change Not Working

**Symptom:** Prompt doesn't change when mode changes

**Solutions:**
1. Verify mode is set correctly
2. Check template exists for mode+tier
3. Review updateSystemPrompt() call
4. Check event emission

---

## Goal Integration Summary

Goals are integrated into both the Prompt System and Compression System:

**In Prompt System (dev_PromptSystem.md):**
- Goals are part of the system prompt
- Always visible to the LLM
- Updated when milestones are reached
- Guide LLM behavior and focus

**In Compression System (dev_ContextCompression.md):**
- Goals are NEVER compressed
- Goals guide summarization (what to preserve)
- Goal markers update goal structure
- Goals maintain continuity across compressions

**Flow:**
```
User provides task
  ↓
LLM analyzes and creates goal
  ↓
Goal added to system prompt (Prompt System)
  ↓
LLM works on goal, conversation grows
  ↓
Compression triggered (Compression System)
  ↓
LLM summarizes with goal context
  ↓
Goal preserved, history compressed
  ↓
Goal updated with progress markers
  ↓
Continue conversation with updated goal
```

---

## File Locations

| File | Purpose |
|------|---------|
| `packages/core/src/context/promptOrchestrator.ts` | Coordinator |
| `packages/core/src/prompts/tieredPromptStore.ts` | Template loader |
| `packages/core/src/prompts/PromptRegistry.ts` | Core prompt registry |
| `packages/core/src/context/SystemPromptBuilder.ts` | Prompt assembly |
| `packages/core/src/context/goalManager.ts` | Goal management |
| `packages/core/src/prompts/templates/assistant/` | Assistant mode prompts |
| `packages/core/src/prompts/templates/developer/` | Developer mode prompts |
| `packages/core/src/prompts/templates/planning/` | Planning mode prompts |
| `packages/core/src/prompts/templates/debugger/` | Debugger mode prompts |
| `packages/core/src/prompts/templates/user/` | User mode prompts (customizable) |
| `packages/core/src/prompts/templates/mandates.ts` | Core behavior |
| `packages/core/src/prompts/templates/sanity.ts` | Reality checks |

---

**Note:** This document focuses on prompt structure and management. For context sizing, see `dev_ContextManagement.md`. For compression, see `dev_ContextCompression.md`.
