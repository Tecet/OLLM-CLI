# Adaptive System Prompts - Routing & Switching

**Date:** January 20, 2026  
**Purpose:** Visual representation of prompt selection and switching logic  
**Status:** Design Complete

---

## Overview

The adaptive system prompt system automatically selects and switches prompts based on:
1. **Context Tier** - Detected from context size (2-4K, 4-8K, 8-32K, 32-64K, 64K+)
2. **Operational Mode** - User-selected mode (Developer, Planning, Assistant, Debugger)
3. **Hardware Capability** - Maximum context size hardware can support (auto-sizing)

**Note on 85% Context Cap (v2.1):** When user selects a context size (e.g., 4K), the app sends 85% (3482 tokens) to Ollama via `num_ctx` parameter. This is transparent to the user but affects actual token budgets. Prompt tier selection is based on the **user-selected size** (4K), not the 85% cap (3482).

This document provides visual diagrams showing how prompts are selected and when they switch.

---

## Prompt Selection Matrix

### Selection Logic

```mermaid
graph TB
    Start[Context Manager Start] --> DetectTier[Detect Context Tier]
    Start --> GetMode[Get Current Mode]
    
    DetectTier --> T1{Context Size?}
    T1 -->|≤ 4K| Tier1[Tier 1: 2-4K]
    T1 -->|≤ 8K| Tier2[Tier 2: 4-8K]
    T1 -->|≤ 32K| Tier3[Tier 3: 8-32K]
    T1 -->|≤ 64K| Tier4[Tier 4: 32-64K]
    T1 -->|> 64K| Tier5[Tier 5: 64K+]
    
    GetMode --> M1{Mode?}
    M1 --> Dev[Developer]
    M1 --> Plan[Planning]
    M1 --> Assist[Assistant]
    M1 --> Debug[Debugger]
    
    Tier1 --> Combine[Combine Tier + Mode]
    Tier2 --> Combine
    Tier3 --> Combine
    Tier4 --> Combine
    Tier5 --> Combine
    
    Dev --> Combine
    Plan --> Combine
    Assist --> Combine
    Debug --> Combine
    
    Combine --> Lookup[Lookup Prompt Template]
    Lookup --> Apply[Apply System Prompt]
    Apply --> Done[Ready for Conversation]
    
    style Tier3 fill:#6bcf7f
    style Dev fill:#61dafb
    style Combine fill:#ffd93d
    style Apply fill:#4d96ff
```

**Description:**
1. Context Manager starts and detects context tier from `maxTokens`
2. Gets current operational mode (defaults to Developer)
3. Combines tier + mode to create lookup key (e.g., "tier3-developer")
4. Looks up prompt template from `SYSTEM_PROMPT_TEMPLATES`
5. Applies prompt to conversation
6. Ready for user interaction

---

## Prompt Template Matrix

### 20 Prompt Combinations (5 Tiers × 4 Modes)

```mermaid
graph LR
    subgraph "Tier 1: 2-4K (~200 tokens)"
        T1D[Developer<br/>Essential]
        T1P[Planning<br/>Essential]
        T1A[Assistant<br/>Essential]
        T1X[Debugger<br/>Essential]
    end
    
    subgraph "Tier 2: 4-8K (~500 tokens)"
        T2D[Developer<br/>Detailed]
        T2P[Planning<br/>Detailed]
        T2A[Assistant<br/>Detailed]
        T2X[Debugger<br/>Detailed]
    end
    
    subgraph "Tier 3: 8-32K (~1000 tokens) ⭐"
        T3D[Developer<br/>Comprehensive]
        T3P[Planning<br/>Comprehensive]
        T3A[Assistant<br/>Comprehensive]
        T3X[Debugger<br/>Comprehensive]
    end
    
    subgraph "Tier 4: 32-64K (~1500 tokens)"
        T4D[Developer<br/>Expert]
        T4P[Planning<br/>Expert]
        T4A[Assistant<br/>Expert]
        T4X[Debugger<br/>Expert]
    end
    
    subgraph "Tier 5: 64K+ (~1500 tokens)"
        T5D[Developer<br/>Expert]
        T5P[Planning<br/>Expert]
        T5A[Assistant<br/>Expert]
        T5X[Debugger<br/>Expert]
    end
    
    style T3D fill:#6bcf7f
    style T3P fill:#6bcf7f
    style T3A fill:#6bcf7f
    style T3X fill:#6bcf7f
```

**Description:**
- Each cell represents a unique prompt template
- Tier determines prompt complexity and token budget
- Mode determines focus and guidance style
- Tier 3 is the primary target (90% of users)
- Total: 20 prompt templates (5 tiers × 4 modes)

---

## Hardware-Aware Prompt Selection ⭐

### The Problem

When auto-context sizing is enabled, the context window dynamically adjusts based on available VRAM. If we change the system prompt every time the context size changes, it can confuse the LLM mid-conversation.

### The Solution

Lock the prompt tier to hardware capability at startup when auto-sizing is enabled.

### Hardware Capability Detection

```mermaid
sequenceDiagram
    participant Start as Session Start
    participant VRAM as VRAM Monitor
    participant Pool as Context Pool
    participant Manager as Context Manager
    
    Start->>VRAM: Get VRAM info
    VRAM->>Pool: Available VRAM, Model Size
    Pool->>Pool: calculateOptimalSize()<br/>Account for:<br/>- Model in VRAM<br/>- KV cache<br/>- Safety buffer
    Pool->>Manager: Max possible context size
    Manager->>Manager: Map to Hardware Capability Tier
    
    Note over Manager: Hardware Capability Tier<br/>Locked for session
```

**What It Considers:**
- Model size already loaded in VRAM
- Available VRAM after model is loaded
- KV cache quantization type (f16, q8_0, q4_0)
- Safety buffer (512MB default)
- Returns: Maximum context size hardware can support

### Effective Prompt Tier Logic

```mermaid
graph TB
    Start[Prompt Selection Needed] --> GetHW[Get Hardware Capability Tier]
    Start --> GetActual[Get Actual Context Tier]
    
    GetHW --> HWTier[Hardware: e.g., Tier 3]
    GetActual --> ActualTier[Actual: e.g., Tier 3]
    
    HWTier --> AutoSize{Auto-Sizing<br/>Enabled?}
    ActualTier --> AutoSize
    
    AutoSize -->|Yes| UseLocked[Use Hardware Capability Tier<br/>Locked at startup]
    AutoSize -->|No| UseHigher[Use Higher of<br/>Hardware or Actual]
    
    UseLocked --> Effective[Effective Prompt Tier]
    UseHigher --> Effective
    
    Effective --> SelectPrompt[Select System Prompt]
    SelectPrompt --> Apply[Apply to Conversation]
    
    style UseLocked fill:#6bcf7f
    style UseHigher fill:#ffd93d
    style Effective fill:#4d96ff
```

**Logic:**
```typescript
function getEffectivePromptTier(): ContextTier {
  if (autoSizeEnabled) {
    // Lock to hardware capability - prevents mid-conversation changes
    return hardwareCapabilityTier;
  } else {
    // Use higher tier for best experience
    return max(hardwareCapabilityTier, actualContextTier);
  }
}
```

### Example Scenarios

#### Scenario 1: Auto-Sizing Enabled (Stable Prompts)

```
Hardware: 24GB VRAM, 13B model
├─ Hardware Capability: 32K context possible
├─ Hardware Capability Tier: Tier 3 (8-32K)
└─ Effective Prompt Tier: Tier 3 (LOCKED)

User Selection: 16K context
├─ Actual Context Tier: Tier 3 (8-32K)
└─ Context Window: 16K tokens

During Conversation:
├─ Auto-sizing adjusts: 16K → 20K → 18K → 22K
├─ Actual Context Tier: Stays Tier 3
├─ Effective Prompt Tier: Stays Tier 3 (LOCKED)
└─ System Prompt: NEVER CHANGES ✅

Result: Stable, consistent LLM behavior
```

#### Scenario 2: Manual Sizing (Dynamic Prompts)

```
Hardware: 24GB VRAM, 13B model
├─ Hardware Capability: 32K context possible
├─ Hardware Capability Tier: Tier 3 (8-32K)
└─ Effective Prompt Tier: Tier 3 (initial)

User Selection: 8K context
├─ Actual Context Tier: Tier 2 (4-8K)
├─ Effective Prompt Tier: Tier 3 (higher of HW or Actual)
└─ System Prompt: Tier 3 (1000 tokens)

User Changes to 32K:
├─ Actual Context Tier: Tier 3 (8-32K)
├─ Effective Prompt Tier: Tier 3 (higher of HW or Actual)
└─ System Prompt: Stays Tier 3 (no change)

Result: Best quality prompt for hardware
```

#### Scenario 3: Limited Hardware

```
Hardware: 8GB VRAM, 7B model
├─ Hardware Capability: 8K context possible
├─ Hardware Capability Tier: Tier 2 (4-8K)
└─ Effective Prompt Tier: Tier 2 (LOCKED)

User Selection: 16K context (wants more)
├─ Actual Context Tier: Tier 3 (8-32K)
├─ But hardware can only support: 8K
├─ Effective Prompt Tier: Tier 2 (hardware limit)
└─ System Prompt: Tier 2 (500 tokens)

Result: Realistic prompt for hardware capability
```

### Benefits

| Benefit | With Auto-Sizing | Without Auto-Sizing |
|---------|------------------|---------------------|
| **Prompt Stability** | ✅ Locked to HW tier | ⚠️ Can change with user |
| **Mid-Conversation Changes** | ❌ Never | ⚠️ Possible |
| **LLM Confusion** | ❌ None | ⚠️ Possible |
| **Optimal Quality** | ✅ For hardware | ✅ For selection |
| **Automatic** | ✅ Yes | ✅ Yes |

### Implementation Details

**Detection at Startup:**
```typescript
// In contextManager.ts start() method
async start(): Promise<void> {
  // Get VRAM info
  const vramInfo = await this.vramMonitor.getInfo();
  
  // Calculate max possible context
  const maxPossibleContext = this.contextPool.calculateOptimalSize(
    vramInfo,
    this.modelInfo
  );
  
  // Detect hardware capability tier (LOCKED for session)
  this.hardwareCapabilityTier = this.mapContextSizeToTier(maxPossibleContext);
  
  console.log('[ContextManager] Hardware capability tier:', this.hardwareCapabilityTier);
  
  // Apply initial system prompt based on effective tier
  this.updateSystemPrompt();
}
```

**Effective Tier Selection:**
```typescript
private getEffectivePromptTier(): ContextTier {
  if (this.config.autoSize) {
    // Lock to hardware capability when auto-sizing
    return this.hardwareCapabilityTier;
  }
  
  // Use higher tier when manual sizing
  const tierLevels = {
    [ContextTier.TIER_1_MINIMAL]: 1,
    [ContextTier.TIER_2_BASIC]: 2,
    [ContextTier.TIER_3_STANDARD]: 3,
    [ContextTier.TIER_4_PREMIUM]: 4,
    [ContextTier.TIER_5_ULTRA]: 5
  };
  
  const hwLevel = tierLevels[this.hardwareCapabilityTier];
  const actualLevel = tierLevels[this.actualContextTier];
  
  return hwLevel >= actualLevel 
    ? this.hardwareCapabilityTier 
    : this.actualContextTier;
}
```

**Resize Callback:**
```typescript
// In contextPool resize callback
async (newSize: number) => {
  // Update actual context tier
  const newTierConfig = this.detectContextTier();
  this.actualContextTier = newTierConfig.tier;
  
  // Emit event with tier info
  this.emit('context-resized', {
    newSize,
    actualContextTier: this.actualContextTier,
    hardwareCapabilityTier: this.hardwareCapabilityTier,
    effectivePromptTier: this.getEffectivePromptTier(),
    promptTierStable: this.config.autoSize
  });
  
  // NOTE: We do NOT call updateSystemPrompt() here!
  // When auto-sizing is enabled, effective prompt tier stays locked
}
```

### UI Integration

**Status Display:**
```typescript
<Box>
  <Text>Hardware Capability: </Text>
  <Text bold color="blue">{hardwareCapabilityTier}</Text>
</Box>

<Box>
  <Text>Actual Context: </Text>
  <Text bold color="yellow">{actualContextTier}</Text>
</Box>

<Box>
  <Text>Effective Prompt: </Text>
  <Text bold color="green">{effectivePromptTier}</Text>
  {autoSizeEnabled && <Text color="gray"> (locked)</Text>}
</Box>
```

**Visual Indicator:**
```
┌─ Context Status ─────────────┐
│ Hardware: Tier 3 (8-32K)     │
│ Actual:   Tier 3 (16K)       │
│ Prompt:   Tier 3 🔒 (locked) │
│                              │
│ Auto-sizing: Enabled         │
│ Prompt stable: Yes           │
└──────────────────────────────┘
```

---

## Automatic Tier Switching

### Scenario: User Switches Model (8K → 32K)

```mermaid
sequenceDiagram
    participant User
    participant Manager as Context Manager
    participant Detector as Tier Detector
    participant Selector as Prompt Selector
    participant LLM
    
    Note over User,LLM: Initial State: 8K Model, Developer Mode
    
    User->>Manager: Switch to 32K model
    Manager->>Detector: Detect new tier
    Detector->>Detector: maxTokens = 32768
    Detector->>Manager: Tier 3 (8-32K)
    
    Manager->>Manager: Tier changed: 1 → 3
    Manager->>Selector: Get prompt for Tier 3 + Developer
    Selector->>Selector: Lookup "tier3-developer"
    Selector->>Manager: Return ~1000 token prompt
    
    Manager->>Manager: Update system prompt
    Manager->>Manager: Recalculate context budget
    Manager->>LLM: Apply new prompt
    
    Manager->>User: Emit 'tier-changed' event
    Manager->>User: Emit 'system-prompt-updated' event
    
    Note over User,LLM: Current State: 32K Model, Developer Mode<br/>Prompt: 1000 tokens (Tier 3)
```

**Description:**
1. User switches from 8K to 32K model
2. Context Manager detects tier change (Tier 1 → Tier 3)
3. Prompt Selector retrieves appropriate prompt
4. System prompt scales from ~200 to ~1000 tokens
5. Context budget recalculated
6. Events emitted for UI updates
7. **Fully automatic** - no user action required

---

## Automatic Mode Switching

### Scenario: User Switches Mode (Developer → Planning)

```mermaid
sequenceDiagram
    participant User
    participant Manager as Context Manager
    participant Profile as Mode Profile
    participant Selector as Prompt Selector
    participant LLM
    
    Note over User,LLM: Initial State: Tier 3, Developer Mode
    
    User->>Manager: setMode(PLANNING)
    Manager->>Profile: Load Planning profile
    Profile->>Manager: Return profile config
    
    Manager->>Manager: Mode changed: Developer → Planning
    Manager->>Selector: Get prompt for Tier 3 + Planning
    Selector->>Selector: Lookup "tier3-planning"
    Selector->>Manager: Return ~1000 token prompt
    
    Manager->>Manager: Update system prompt
    Manager->>Manager: Update preservation rules
    Manager->>Manager: Update extraction patterns
    Manager->>LLM: Apply new prompt
    
    Manager->>User: Emit 'mode-changed' event
    Manager->>User: Emit 'system-prompt-updated' event
    
    Note over User,LLM: Current State: Tier 3, Planning Mode<br/>Prompt focus: Tasks and dependencies
```

**Description:**
1. User explicitly switches mode to Planning
2. Context Manager loads Planning mode profile
3. Prompt Selector retrieves planning-focused prompt
4. System prompt changes focus from code to tasks
5. Preservation rules updated (goals, requirements, tasks)
6. Extraction patterns updated
7. Events emitted for UI updates

---

## Combined Switching

### Scenario: User Switches Both Model and Mode

```mermaid
sequenceDiagram
    participant User
    participant Manager as Context Manager
    participant Detector as Tier Detector
    participant Profile as Mode Profile
    participant Selector as Prompt Selector
    participant LLM
    
    Note over User,LLM: Initial: 8K Model, Developer Mode<br/>Prompt: tier1-developer (~200 tokens)
    
    User->>Manager: Switch to 32K model
    Manager->>Detector: Detect tier
    Detector->>Manager: Tier 3 (8-32K)
    
    User->>Manager: setMode(PLANNING)
    Manager->>Profile: Load Planning profile
    Profile->>Manager: Return profile
    
    Manager->>Manager: Both tier and mode changed
    Manager->>Selector: Get prompt for Tier 3 + Planning
    Selector->>Selector: Lookup "tier3-planning"
    Selector->>Manager: Return ~1000 token prompt
    
    Manager->>Manager: Update system prompt
    Manager->>Manager: Update all configurations
    Manager->>LLM: Apply new prompt
    
    Manager->>User: Emit 'tier-changed' event
    Manager->>User: Emit 'mode-changed' event
    Manager->>User: Emit 'system-prompt-updated' event
    
    Note over User,LLM: Final: 32K Model, Planning Mode<br/>Prompt: tier3-planning (~1000 tokens)<br/>Focus: Code → Tasks, Size: 200 → 1000 tokens
```

**Description:**
1. User switches both model (8K → 32K) and mode (Developer → Planning)
2. Tier detection runs (Tier 1 → Tier 3)
3. Mode profile loads (Developer → Planning)
4. Prompt Selector combines both changes
5. Single prompt update with both tier and mode changes
6. All configurations updated atomically
7. Multiple events emitted for UI

---

## Prompt Selection Decision Tree

### Complete Decision Flow

```mermaid
graph TD
    Start[Prompt Selection Needed] --> Reason{Reason?}
    
    Reason -->|Initialization| Init[Initial Setup]
    Reason -->|Tier Change| TierChange[Tier Changed]
    Reason -->|Mode Change| ModeChange[Mode Changed]
    Reason -->|Manual Update| Manual[Manual Trigger]
    
    Init --> GetTier[Get Current Tier]
    TierChange --> GetTier
    ModeChange --> GetTier
    Manual --> GetTier
    
    GetTier --> GetMode[Get Current Mode]
    
    GetMode --> BuildKey[Build Lookup Key]
    BuildKey --> Key["key = 'tier' + tierNum + '-' + mode"]
    
    Key --> Lookup{Template Exists?}
    
    Lookup -->|Yes| Found[Use Template]
    Lookup -->|No| Fallback[Use Fallback]
    
    Fallback --> Default["Default: tier3-developer"]
    
    Found --> Validate[Validate Token Budget]
    Default --> Validate
    
    Validate --> Apply[Apply System Prompt]
    Apply --> Emit[Emit Events]
    Emit --> Done[Complete]
    
    style GetTier fill:#ffd93d
    style GetMode fill:#ffd93d
    style Found fill:#6bcf7f
    style Fallback fill:#ff6b6b
    style Apply fill:#4d96ff
```

**Description:**
1. **Trigger:** Initialization, tier change, mode change, or manual update
2. **Detection:** Get current tier and mode
3. **Key Building:** Combine into lookup key (e.g., "tier3-developer")
4. **Lookup:** Find template in `SYSTEM_PROMPT_TEMPLATES`
5. **Fallback:** If not found, use default (tier3-developer)
6. **Validation:** Verify token budget is within limits
7. **Application:** Set as system prompt
8. **Events:** Emit for UI updates

---

## Token Budget Flow

### How Token Budgets Scale with Tier

**Note on 85% Context Cap (v2.1):**
The diagrams below show user-selected context sizes. However, the app sends 85% of this to Ollama via `num_ctx`. For example:
- User selects: 8K → Ollama receives: 6963 tokens (85%)
- User selects: 32K → Ollama receives: 27853 tokens (85%)

Prompt tier selection is based on user-selected size, but actual token budgets are calculated against the 85% cap.

```mermaid
graph LR
    subgraph "Tier 1: 8K Context"
        T1[~200 tokens<br/>2.5% overhead]
        T1W[7,800 tokens<br/>work space]
    end
    
    subgraph "Tier 2: 16K Context"
        T2[~500 tokens<br/>3.1% overhead]
        T2W[15,500 tokens<br/>work space]
    end
    
    subgraph "Tier 3: 32K Context ⭐"
        T3[~1000 tokens<br/>3.1% overhead]
        T3W[31,000 tokens<br/>work space]
    end
    
    subgraph "Tier 4: 128K Context"
        T4[~1500 tokens<br/>1.2% overhead]
        T4W[126,500 tokens<br/>work space]
    end
    
    T1 --> T1W
    T2 --> T2W
    T3 --> T3W
    T4 --> T4W
    
    style T3 fill:#6bcf7f
    style T3W fill:#6bcf7f
```

**Description:**
- **Tier 1:** Minimal prompt (200 tokens) to maximize work space
- **Tier 2:** Detailed prompt (500 tokens) with examples
- **Tier 3:** Comprehensive prompt (1000 tokens) with frameworks ⭐
- **Tier 4:** Expert prompt (1500 tokens) with sophistication
- **Overhead:** Stays under 4% for all tiers (based on user-selected size)
- **Work Space:** Increases with context size
- **85% Cap:** Actual tokens sent to Ollama are 85% of shown values

---

## Mode Profile Impact

### How Mode Affects Prompt Content

```mermaid
graph TB
    subgraph "Developer Mode"
        D1[Core: Code Quality]
        D2[Focus: Architecture]
        D3[Examples: SOLID, Patterns]
        D4[Guardrails: Type Safety]
    end
    
    subgraph "Planning Mode"
        P1[Core: Task Breakdown]
        P2[Focus: Dependencies]
        P3[Examples: Estimation]
        P4[Guardrails: Clear Criteria]
    end
    
    subgraph "Assistant Mode"
        A1[Core: Communication]
        A2[Focus: User Needs]
        A3[Examples: Explanations]
        A4[Guardrails: Clarity]
    end
    
    subgraph "Debugger Mode"
        X1[Core: Root Cause]
        X2[Focus: Reproduction]
        X3[Examples: Debugging Steps]
        X4[Guardrails: Systematic]
    end
    
    Mode[Operational Mode] --> Developer
    Mode --> Planning
    Mode --> Assistant
    Mode --> Debugger
    
    Developer --> D1
    Developer --> D2
    Developer --> D3
    Developer --> D4
    
    Planning --> P1
    Planning --> P2
    Planning --> P3
    Planning --> P4
    
    Assistant --> A1
    Assistant --> A2
    Assistant --> A3
    Assistant --> A4
    
    Debugger --> X1
    Debugger --> X2
    Debugger --> X3
    Debugger --> X4
    
    style Developer fill:#61dafb
    style Planning fill:#ffd93d
    style Assistant fill:#6bcf7f
    style Debugger fill:#ff6b6b
```

**Description:**
- **Developer:** Focus on code quality, architecture, patterns
- **Planning:** Focus on task breakdown, dependencies, estimation
- **Assistant:** Focus on clear communication, user needs
- **Debugger:** Focus on root cause analysis, systematic debugging
- Each mode has different core responsibilities, focus areas, examples, and guardrails

---

## Prompt Update Lifecycle

### Complete Update Flow

```mermaid
stateDiagram-v2
    [*] --> Initialized: Context Manager Start
    
    Initialized --> Active: Initial Prompt Applied
    
    Active --> DetectingTier: Context Size Changed
    DetectingTier --> UpdatingPrompt: Tier Changed
    
    Active --> ChangingMode: User Changes Mode
    ChangingMode --> UpdatingPrompt: Mode Changed
    
    Active --> ManualUpdate: Manual Trigger
    ManualUpdate --> UpdatingPrompt: Update Requested
    
    UpdatingPrompt --> Validating: Prompt Selected
    Validating --> Applying: Validation Passed
    Applying --> NotifyingUI: Prompt Applied
    NotifyingUI --> Active: Events Emitted
    
    Validating --> Error: Validation Failed
    Error --> Fallback: Use Default
    Fallback --> Applying: Fallback Selected
    
    Active --> [*]: Context Manager Stop
    
    note right of UpdatingPrompt
        Combines tier + mode
        Looks up template
        Validates token budget
    end note
    
    note right of NotifyingUI
        Emits events:
        - tier-changed
        - mode-changed
        - system-prompt-updated
    end note
```

**Description:**
1. **Initialized:** Context Manager starts with default prompt
2. **Active:** Normal operation with current prompt
3. **Triggers:** Tier change, mode change, or manual update
4. **Updating:** Select new prompt based on tier + mode
5. **Validating:** Check token budget and template exists
6. **Applying:** Set as system prompt
7. **Notifying:** Emit events for UI updates
8. **Error Handling:** Fallback to default if validation fails

---

## UI Integration

### How UI Responds to Prompt Changes

```mermaid
sequenceDiagram
    participant Manager as Context Manager
    participant Provider as Context Provider
    participant Status as Context Status UI
    participant User
    
    Note over Manager,User: Prompt Update Triggered
    
    Manager->>Manager: Update system prompt
    Manager->>Provider: Emit 'system-prompt-updated'
    
    Provider->>Provider: Update state
    Provider->>Status: Re-render with new data
    
    Status->>Status: Show tier indicator
    Status->>Status: Show mode indicator
    Status->>Status: Show prompt size
    Status->>Status: Animate change
    
    Status->>User: Display visual feedback
    
    Note over Status,User: Brief highlight/animation<br/>Checkmark appears<br/>Color change
    
    Status->>Status: Clear animation after 1s
    
    Note over Manager,User: UI Updated, Ready for Input
```

**Description:**
1. Context Manager updates system prompt
2. Emits 'system-prompt-updated' event
3. Context Provider updates React state
4. Context Status UI re-renders
5. Shows tier, mode, and prompt size
6. Animates change (highlight, checkmark)
7. Animation clears after 1 second
8. User sees visual confirmation

---

## Prompt Template Storage

### File Organization

```mermaid
graph TB
    Root[packages/core/src/context/prompts/]
    
    Root --> T1[tier1/]
    Root --> T2[tier2/]
    Root --> T3[tier3/]
    Root --> T4[tier4/]
    
    T1 --> T1D[developer.txt<br/>~200 tokens]
    T1 --> T1P[planning.txt<br/>~200 tokens]
    T1 --> T1A[assistant.txt<br/>~200 tokens]
    T1 --> T1X[debugger.txt<br/>~200 tokens]
    
    T2 --> T2D[developer.txt<br/>~500 tokens]
    T2 --> T2P[planning.txt<br/>~500 tokens]
    T2 --> T2A[assistant.txt<br/>~500 tokens]
    T2 --> T2X[debugger.txt<br/>~500 tokens]
    
    T3 --> T3D[developer.txt<br/>~1000 tokens]
    T3 --> T3P[planning.txt<br/>~1000 tokens]
    T3 --> T3A[assistant.txt<br/>~1000 tokens]
    T3 --> T3X[debugger.txt<br/>~1000 tokens]
    
    T4 --> T4D[developer.txt<br/>~1500 tokens]
    T4 --> T4P[planning.txt<br/>~1500 tokens]
    T4 --> T4A[assistant.txt<br/>~1500 tokens]
    T4 --> T4X[debugger.txt<br/>~1500 tokens]
    
    style T3 fill:#6bcf7f
    style T3D fill:#6bcf7f
    style T3P fill:#6bcf7f
    style T3A fill:#6bcf7f
    style T3X fill:#6bcf7f
```

**Description:**
- Prompts stored in separate text files for maintainability
- Organized by tier (tier1/, tier2/, tier3/, tier4/)
- Each tier has 4 mode-specific prompts
- File naming: `{mode}.txt` (e.g., developer.txt)
- Token counts verified during build
- Easy to edit and version control

---

## Performance Considerations

### Prompt Selection Performance

```mermaid
graph LR
    subgraph "Fast Path (Cache Hit)"
        F1[Request Prompt] --> F2[Check Cache]
        F2 --> F3[Cache Hit]
        F3 --> F4[Return Cached]
        F4 --> F5[< 1ms]
    end
    
    subgraph "Slow Path (Cache Miss)"
        S1[Request Prompt] --> S2[Check Cache]
        S2 --> S3[Cache Miss]
        S3 --> S4[Load from Disk]
        S4 --> S5[Parse Template]
        S5 --> S6[Store in Cache]
        S6 --> S7[Return Prompt]
        S7 --> S8[< 10ms]
    end
    
    style F3 fill:#6bcf7f
    style S3 fill:#ffd93d
```

**Description:**
- **Fast Path:** Prompts cached in memory after first load (< 1ms)
- **Slow Path:** First load reads from disk (< 10ms)
- **Cache Key:** `tier{num}-{mode}` (e.g., "tier3-developer")
- **Cache Invalidation:** Only on application restart
- **Memory Usage:** ~50KB for all 16 prompts
- **Performance Impact:** Negligible

---

## Error Handling

### Fallback Strategy

```mermaid
graph TD
    Start[Prompt Selection] --> Lookup[Lookup Template]
    
    Lookup --> Exists{Exists?}
    
    Exists -->|Yes| Validate[Validate Token Budget]
    Exists -->|No| Fallback1[Try Tier 3 Same Mode]
    
    Fallback1 --> Exists2{Exists?}
    Exists2 -->|Yes| Validate
    Exists2 -->|No| Fallback2[Try Tier 3 Developer]
    
    Fallback2 --> Exists3{Exists?}
    Exists3 -->|Yes| Validate
    Exists3 -->|No| Error[Log Error]
    
    Validate --> Budget{Budget OK?}
    Budget -->|Yes| Success[Use Prompt]
    Budget -->|No| Warn[Log Warning]
    Warn --> Success
    
    Error --> Emergency[Use Hardcoded Default]
    Emergency --> Success
    
    Success --> Done[Prompt Applied]
    
    style Success fill:#6bcf7f
    style Fallback1 fill:#ffd93d
    style Fallback2 fill:#ffd93d
    style Error fill:#ff6b6b
```

**Description:**
1. **Primary:** Try requested tier + mode
2. **Fallback 1:** Try Tier 3 with same mode (most common)
3. **Fallback 2:** Try Tier 3 Developer (default)
4. **Emergency:** Use hardcoded default prompt
5. **Validation:** Check token budget (warn if over)
6. **Logging:** Log all fallbacks and errors
7. **Graceful:** Never fail, always provide a prompt

---

## Testing Strategy

### Prompt Selection Tests

```mermaid
graph TB
    subgraph "Unit Tests"
        U1[Test tier detection]
        U2[Test mode selection]
        U3[Test key building]
        U4[Test template lookup]
        U5[Test fallback logic]
        U6[Test token validation]
    end
    
    subgraph "Integration Tests"
        I1[Test tier switching]
        I2[Test mode switching]
        I3[Test combined switching]
        I4[Test UI updates]
        I5[Test event emission]
    end
    
    subgraph "E2E Tests"
        E1[Test full conversation]
        E2[Test model switching]
        E3[Test mode switching]
        E4[Test prompt quality]
    end
    
    Tests[Test Suite] --> Unit
    Tests --> Integration
    Tests --> E2E
    
    Unit --> U1
    Unit --> U2
    Unit --> U3
    Unit --> U4
    Unit --> U5
    Unit --> U6
    
    Integration --> I1
    Integration --> I2
    Integration --> I3
    Integration --> I4
    Integration --> I5
    
    E2E --> E1
    E2E --> E2
    E2E --> E3
    E2E --> E4
    
    style Tests fill:#4d96ff
    style Unit fill:#6bcf7f
    style Integration fill:#ffd93d
    style E2E fill:#ff6b6b
```

**Description:**
- **Unit Tests:** Test individual functions (tier detection, lookup, etc.)
- **Integration Tests:** Test component interactions (switching, events)
- **E2E Tests:** Test full user workflows (conversations, model changes)
- **Coverage Target:** > 80% for prompt selection logic
- **Performance Tests:** Verify < 10ms prompt selection time

---

## Summary

### Key Points

1. **Automatic Selection** ✅
   - Prompts selected based on tier + mode
   - No manual configuration needed
   - Fully automatic switching

2. **16 Prompt Templates** ✅
   - 4 tiers × 4 modes = 16 combinations
   - Each optimized for its context
   - Token budgets: ~200, ~500, ~1000, ~1500

3. **Seamless Switching** ✅
   - Tier changes: Automatic on model switch
   - Mode changes: User-triggered
   - Combined changes: Handled atomically
   - UI updates: Visual feedback

4. **Performance** ✅
   - Cached in memory (< 1ms)
   - First load from disk (< 10ms)
   - Negligible overhead
   - Graceful fallbacks

5. **Quality Scaling** ✅
   - Small contexts: Essential guidance
   - Medium contexts: Detailed guidance
   - Large contexts: Comprehensive guidance
   - Premium contexts: Expert guidance

---

## Related Documents

- **[compression-architecture.md](./compression-architecture.md)** - Complete system architecture
- **[ADAPTIVE-SYSTEM-PROMPTS.md](./ADAPTIVE-SYSTEM-PROMPTS.md)** - Detailed prompt examples
- **[IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)** - Task 3: Adaptive System Prompts
- **[PROMPT-BUDGET-REVISION.md](./PROMPT-BUDGET-REVISION.md)** - Token allocation rationale

---

**Document Status:** ✅ Complete  
**Last Updated:** January 20, 2026  
**Visual Diagrams:** 12 mermaid diagrams  
**Purpose:** Visual guide to prompt routing and switching


---

## Version History

### v2.2 (January 21, 2026)
- Added goal management integration
- Added reasoning trace capture
- Enhanced system prompts with goal tracking
- Updated documentation with new features

### v2.1 (January 20, 2026)
- Added 85% context cap strategy
- Added hardware-aware prompt selection
- Enhanced prompt stability for auto-sizing

### v2.0 (January 20, 2026)
- Initial release with adaptive system prompts
- 20 prompt templates (5 tiers × 4 modes)
- Automatic tier and mode switching
- Complete visual documentation
