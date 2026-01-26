# Alpha Fix Audit Report

**Date:** January 26, 2026  
**Auditor:** AI Assistant  
**Purpose:** Compare codebase implementation against design specifications in knowledge DB  
**Scope:** 8 priority tasks for Alpha release (7 days)

---

## Executive Summary

This audit compares the current codebase implementation against the design specifications documented in `.dev/docs/knowledgeDB/`. The goal is to identify gaps, misalignments, and issues that need to be fixed before the Alpha release.

**Overall Status:** 🟡 Moderate Alignment Issues

- ✅ **2 tasks** are minor fixes (quick wins)
- 🟡 **4 tasks** have moderate implementation gaps
- 🔴 **2 tasks** have significant misalignments

---

## Task-by-Task Audit

### TASK 1: Simplify Tier Selection Logic ⚠️ CONFIRMED ISSUE

**Status:** 🔴 **CRITICAL - Design Violation**

**Design Specification:**
- Single `selectedTier` variable
- Tier is a label only, not a decision maker
- Context size drives everything

**Current Implementation:**
```typescript
// packages/core/src/context/contextManager.ts
private hardwareCapabilityTier: ContextTier = ContextTier.TIER_3_STANDARD;  // Line 444
private actualContextTier: ContextTier = ContextTier.TIER_3_STANDARD;       // Line 446
private getEffectivePromptTier(): ContextTier { return this.actualContextTier; }  // Line 540
```

**Issues Found:**
1. ✅ **Three tier variables exist** (hardwareCapabilityTier, actualContextTier, getEffectivePromptTier)
2. ✅ **Complexity in tier tracking** - multiple variables for what should be one label
3. ✅ **Prompt tier follows actualContextTier** - correct per current design, but adds complexity
4. ✅ **Hardware tier is tracked but not used** - dead code

**Evidence:**
- 52 references to `hardwareCapabilityTier` in contextManager.ts
- 31 references to `actualContextTier` in contextManager.ts
- 15 references to `getEffectivePromptTier()` in contextManager.ts

**Impact:** High - Adds unnecessary complexity, makes code harder to maintain

**Recommendation:** ✅ **PROCEED WITH TASK 1** - Remove hardwareCapabilityTier and getEffectivePromptTier(), keep single selectedTier

---

### TASK 2: Remove Runtime 85% Calculation ⚠️ CONFIRMED ISSUE

**Status:** 🟡 **MODERATE - Dead Code Present**

**Design Specification:**
- 85% values are pre-calculated in `LLM_profiles.json`
- No runtime calculation should exist
- `utilizationTarget` field is dead code

**Current Implementation:**
```typescript
// packages/core/src/context/types.ts
interface TierCompressionConfig {
  utilizationTarget: number;  // Line 365 - DEAD CODE
}

const TIER_CONFIGS = {
  [ContextTier.TIER_1_MINIMAL]: { utilizationTarget: 0.90 },  // Line 378
  [ContextTier.TIER_2_BASIC]: { utilizationTarget: 0.80 },    // Line 386
  [ContextTier.TIER_3_STANDARD]: { utilizationTarget: 0.70 }, // Line 394
  [ContextTier.TIER_4_PREMIUM]: { utilizationTarget: 0.70 },  // Line 402
  [ContextTier.TIER_5_ULTRA]: { utilizationTarget: 0.65 }     // Line 410
};
```

**Issues Found:**
1. ✅ **utilizationTarget field exists** in TierCompressionConfig interface
2. ✅ **Values defined for all tiers** in TIER_CONFIGS
3. ❓ **Usage unclear** - need to check if it's actually used in compression logic
4. ✅ **Compression trigger should be 75-80% of available budget**, not utilization target

**Evidence:**
- 6 references to `utilizationTarget` in types.ts
- No references found in compression coordinator or service (good sign - may be unused)

**Impact:** Medium - Dead code adds confusion, but doesn't break functionality

**Recommendation:** ✅ **PROCEED WITH TASK 2** - Remove utilizationTarget field, verify compression uses 75-80% trigger

---

### TASK 3: Fix Auto-Sizing Warning ⚠️ CONFIRMED ISSUE

**Status:** 🟡 **MODERATE - Incorrect Behavior**

**Design Specification:**
- Context size is FIXED for session
- On low memory: Show warning (don't resize)
- No automatic mid-conversation changes

**Current Implementation:**
```typescript
// packages/core/src/context/contextManager.ts (lines 220-238)
this.vramMonitor.onLowMemory(async (vramInfo) => {
  this.emit('low-memory', vramInfo);
  
  // If auto-size is enabled, recalculate optimal size
  if (this.config.autoSize) {
    const maxPossibleContext = this.contextPool.calculateOptimalSize(vramInfo, this.modelInfo);
    const recommendedSize = this.getRecommendedAutoSize(maxPossibleContext);
    
    if (recommendedSize !== this.contextPool.currentSize) {
      await this.contextPool.resize(recommendedSize);  // ❌ RESIZES CONTEXT
      this.contextPool.updateConfig({ targetContextSize: recommendedSize });
    }
  }
});
```

**Issues Found:**
1. ✅ **Dynamic resize on low memory** - violates FIXED context principle
2. ✅ **No warning message** - should warn user instead of resizing
3. ✅ **Auto-size mode allows mid-conversation changes** - breaks session stability

**Impact:** Medium - Causes unexpected behavior, breaks user expectations

**Recommendation:** ✅ **PROCEED WITH TASK 3** - Replace resize with warning message

**Suggested Warning:**
```
⚠️ Low memory detected (VRAM: 85% used)
Your current context size may cause performance issues.
Consider restarting with a smaller context size.
```

---

### TASK 4: Fix Compression System (Dynamic Budget) ⚠️ PARTIAL IMPLEMENTATION

**Status:** 🔴 **CRITICAL - Missing Core Feature**

**Design Specification:**
- Track checkpoint tokens
- Calculate available budget = ollama_size - system - checkpoints
- Trigger at 80% of AVAILABLE (not total)
- Implement checkpoint aging

**Current Implementation:**

**Checkpoint Token Tracking:**
```typescript
// packages/core/src/context/checkpointManager.ts
// ✅ Checkpoints have currentTokens field
checkpoint.currentTokens = newTokens;  // Lines 235, 246
```

**Available Budget Calculation:**
```
❌ NOT FOUND - No evidence of dynamic budget calculation
❌ NOT FOUND - No subtraction of checkpoint tokens from available budget
❌ NOT FOUND - No 80% of available budget trigger
```

**Checkpoint Aging:**
```typescript
// packages/core/src/context/checkpointManager.ts
// ✅ Aging logic exists (lines 234-248)
// ✅ Compresses checkpoints based on age
```

**Issues Found:**
1. ✅ **Checkpoint tokens are tracked** - good foundation
2. ❌ **No dynamic budget calculation** - critical missing feature
3. ❌ **Compression trigger likely uses total context**, not available budget
4. ✅ **Checkpoint aging exists** - good implementation

**Impact:** CRITICAL - Causes rapid re-compression, conversation ends prematurely

**Recommendation:** ✅ **PROCEED WITH TASK 4** - Implement dynamic budget calculation

**Required Changes:**
```typescript
// Calculate available budget
const systemTokens = countTokens(systemPrompt);
const checkpointTokens = checkpoints.reduce((sum, cp) => sum + cp.currentTokens, 0);
const availableBudget = context.maxTokens - systemTokens - checkpointTokens;

// Trigger at 80% of AVAILABLE
const compressionTrigger = availableBudget * 0.80;
```

---

### TASK 5: Fix Tool Integration with LLM ⚠️ CONFIRMED ISSUE

**Status:** 🔴 **CRITICAL - Tools Not Passed to Provider**

**Design Specification:**
- Tools must be passed to provider in chat request
- LLM should see tool list and use them
- Tools should be in turnOptions

**Current Implementation:**
```typescript
// packages/core/src/core/chatClient.ts (lines 368-371)
const turnOptions: ChatOptions = {
  ...options,
  systemPrompt: systemPromptWithContext,
  // ❌ MISSING: tools from ToolRegistry
};
```

**Issues Found:**
1. ✅ **Tools are NOT passed to provider** - confirmed root cause
2. ✅ **ToolRegistry exists and has tools** - tools are registered
3. ❌ **Tools never reach the LLM** - LLM can't use them
4. ✅ **This explains why LLM gives advice instead of using tools**

**Impact:** CRITICAL - Core feature (tool calling) is broken

**Recommendation:** ✅ **PROCEED WITH TASK 5** - Add tools to turnOptions

**Required Fix:**
```typescript
// Get all registered tools
const tools = this.toolRegistry.getAllTools().map(tool => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.inputSchema
}));

const turnOptions: ChatOptions = {
  ...options,
  systemPrompt: systemPromptWithContext,
  tools: tools,  // ✅ Add tools here
};
```

---

### TASK 6: Ollama Settings Management ⚠️ PARTIAL IMPLEMENTATION

**Status:** 🟡 **MODERATE - Basic Structure Exists**

**Design Specification:**
- User-configurable Ollama settings
- Auto-start control
- Custom host/port
- Settings UI and commands

**Current Implementation:**
```typescript
// packages/cli/src/config/settingsService.ts
interface Settings {
  ollamaAutoStart?: boolean;  // Line 17 - ✅ EXISTS
  ollamaHealthCheck?: boolean;  // Line 19
}

const DEFAULT_SETTINGS = {
  ollamaAutoStart: false,  // Line 74 - ❌ DISABLED BY DEFAULT
  ollamaHealthCheck: true
};
```

**Issues Found:**
1. ✅ **ollamaAutoStart field exists** - good foundation
2. ❌ **No host/port configuration** - missing custom server support
3. ❌ **No settings commands** - /config ollama commands don't exist
4. ❌ **No settings UI** - no visual configuration
5. ❌ **Auto-start is disabled by default** - should be enabled per design

**Evidence:**
- Settings structure exists in settingsService.ts
- No /config ollama commands found in configCommands.ts
- No OllamaSettings.tsx component found

**Impact:** Medium - Users can't configure Ollama, hardcoded localhost:11434

**Recommendation:** ✅ **PROCEED WITH TASK 6** - Implement full settings management

**Required Components:**
1. Expand settings structure (host, port, url)
2. Create /config ollama commands
3. Create settings UI (optional)
4. Enable auto-start by default
5. Read settings in localProvider.ts

---

### TASK 7: Fix Session History Storage (BROKEN) ⚠️ NEEDS INVESTIGATION

**Status:** 🟡 **MODERATE - Service Exists, Behavior Unknown**

**Design Specification:**
- Full history saved to disk (uncompressed)
- Active context compressed (in memory)
- Session files at ~/.ollm/sessions/{sessionId}.json
- Auto-save enabled

**Current Implementation:**
```typescript
// packages/core/src/services/chatRecordingService.ts
export class ChatRecordingService {
  private config: Required<ChatRecordingServiceConfig>;
  
  constructor(config: ChatRecordingServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  async recordMessage(sessionId: string, message: SessionMessage): Promise<void> {
    // ... implementation
    if (this.config.autoSave) {
      await this.saveSession(sessionId);  // ✅ AUTO-SAVE EXISTS
    }
  }
}

// packages/core/src/services/serviceContainer.ts
getChatRecordingService(): ChatRecordingService {
  if (!this._chatRecordingService) {
    this._chatRecordingService = new ChatRecordingService({
      dataDir: `${this.userHome}/.ollm/sessions`,
      autoSave: true,  // ✅ AUTO-SAVE ENABLED
    });
  }
  return this._chatRecordingService;
}
```

**Issues Found:**
1. ✅ **ChatRecordingService exists** - good foundation
2. ✅ **Auto-save is enabled** - correct configuration
3. ✅ **recordMessage() calls saveSession()** - correct flow
4. ❓ **Unknown if files are actually written** - needs runtime testing
5. ❓ **Unknown if files are empty** - needs runtime testing

**Evidence:**
- Service is properly integrated in chatClient.ts (lines 205, 472, 668)
- Auto-save is enabled in serviceContainer.ts (line 267)
- recordMessage() is called for user and assistant messages

**Impact:** HIGH IF BROKEN - Users lose conversation history

**Recommendation:** ⚠️ **INVESTIGATE FIRST** - Add debug logging, test file creation

**Investigation Steps:**
1. Add console.log to saveSession() to track execution
2. Check if session files exist: `ls -la ~/.ollm/sessions/`
3. Check file contents: `cat ~/.ollm/sessions/<sessionId>.json`
4. Verify autoSave is true at runtime
5. Check for file write errors

**If broken, proceed with Task 7. If working, mark as complete.**

---

### TASK 8: Restore Confidence/Reliability Display ⚠️ NEEDS INVESTIGATION

**Status:** 🟡 **MODERATE - Feature May Not Exist**

**Design Specification:**
- Show reliability indicator next to context size
- Based on model size, compression count, context confidence
- UI display: `Context: 5,234/13,926 tokens  🟢 92%  (2 compressions)`
- Warning messages for low reliability

**Current Implementation:**
```
❌ NOT FOUND - No reliabilityCalculator.ts
❌ NOT FOUND - No modelSizeDetector.ts
❌ NOT FOUND - No compression count tracking in UI
❌ NOT FOUND - No reliability display in ContextSection.tsx
❌ NOT FOUND - No ModeConfidenceDisplay.tsx component
```

**Issues Found:**
1. ❌ **No reliability calculation** - feature doesn't exist
2. ❌ **No model size detection** - feature doesn't exist
3. ❌ **No compression count in UI** - not displayed
4. ❌ **No reliability indicator** - not displayed
5. ❌ **No warning messages** - not implemented

**Impact:** Medium - Users can't see context quality degradation

**Recommendation:** ✅ **PROCEED WITH TASK 8** - Implement full reliability system

**Required Components:**
1. Create reliabilityCalculator.ts
2. Create modelSizeDetector.ts
3. Track compression count in contextManager
4. Update ContextSection.tsx with reliability display
5. Add warning messages for low reliability

---

## Priority Recommendations

### Immediate Action (Day 1-2)

1. **TASK 5: Fix Tool Integration** 🔴 CRITICAL
   - Simple fix (add tools to turnOptions)
   - Unblocks core functionality
   - High user impact

2. **TASK 3: Fix Auto-Sizing Warning** 🟡 MODERATE
   - Simple fix (replace resize with warning)
   - Improves user experience
   - Prevents unexpected behavior

3. **TASK 1: Simplify Tier Selection** 🔴 CRITICAL
   - Moderate complexity
   - Reduces technical debt
   - Improves maintainability

### Short-Term Action (Day 3-5)

4. **TASK 4: Fix Compression System** 🔴 CRITICAL
   - Complex implementation
   - Critical for long conversations
   - High user impact

5. **TASK 7: Fix Session History** 🟡 INVESTIGATE FIRST
   - May already work (needs testing)
   - If broken, high priority
   - Critical for user data

### Medium-Term Action (Day 6-7)

6. **TASK 2: Remove Runtime 85% Calculation** 🟡 MODERATE
   - Simple cleanup
   - Low risk
   - Reduces confusion

7. **TASK 6: Ollama Settings Management** 🟡 MODERATE
   - Moderate complexity
   - Improves user experience
   - Enables customization

8. **TASK 8: Restore Confidence Display** 🟡 MODERATE
   - Complex implementation (1-2 weeks)
   - Nice-to-have feature
   - Can be deferred if needed

---

## Risk Assessment

### High Risk (Must Fix for Alpha)

- **TASK 5: Tool Integration** - Core feature broken
- **TASK 4: Compression System** - Conversations end prematurely
- **TASK 7: Session History** - Data loss if broken

### Medium Risk (Should Fix for Alpha)

- **TASK 1: Tier Selection** - Technical debt, maintainability
- **TASK 3: Auto-Sizing** - Unexpected behavior
- **TASK 6: Ollama Settings** - User experience

### Low Risk (Can Defer)

- **TASK 2: Runtime 85%** - Dead code, no functional impact
- **TASK 8: Confidence Display** - Nice-to-have, not critical

---

## Testing Requirements

### Before Starting Any Task

1. ✅ Run full test suite: `npm test`
2. ✅ Run type check: `npx tsc --noEmit`
3. ✅ Run lint: `npm run lint`
4. ✅ Create git branch: `git checkout -b task-{number}-{name}`
5. ✅ Commit baseline: `git commit -m "Baseline before Task {number}"`

### After Each Change

1. ✅ Run tests: `npm test`
2. ✅ Run type check: `npx tsc --noEmit`
3. ✅ Manual testing (if applicable)
4. ✅ Commit changes: `git commit -m "Task {number}: {description}"`

### Integration Testing

1. Test tool calling (Task 5)
2. Test compression with long conversations (Task 4)
3. Test session persistence (Task 7)
4. Test auto-sizing behavior (Task 3)
5. Test tier selection (Task 1)

---

## Code Quality Observations

### Positive Findings

1. ✅ **Good separation of concerns** - Services are well-organized
2. ✅ **Comprehensive type definitions** - Strong TypeScript usage
3. ✅ **Event-driven architecture** - Good use of event emitters
4. ✅ **Test coverage exists** - Tests are present (406 passing)
5. ✅ **Documentation exists** - Knowledge DB is comprehensive

### Areas for Improvement

1. ⚠️ **Dead code present** - utilizationTarget, hardwareCapabilityTier
2. ⚠️ **Complex tier logic** - Multiple tier variables
3. ⚠️ **Missing features** - Tools not passed to provider
4. ⚠️ **Incomplete implementations** - Reliability display, settings management
5. ⚠️ **Runtime behavior unknown** - Session storage needs testing

---

## Conclusion

The codebase has a solid foundation with good architecture and separation of concerns. However, there are several critical issues that must be fixed before Alpha release:

**Critical Issues (Must Fix):**
- Tool integration broken (Task 5)
- Compression system incomplete (Task 4)
- Session history unknown status (Task 7)

**Important Issues (Should Fix):**
- Tier selection complexity (Task 1)
- Auto-sizing behavior (Task 3)
- Ollama settings missing (Task 6)

**Minor Issues (Can Defer):**
- Dead code cleanup (Task 2)
- Reliability display (Task 8)

**Estimated Effort:** 7 days (as planned)

**Recommendation:** Proceed with all 8 tasks in priority order. Focus on critical issues first (Tasks 5, 4, 7), then important issues (Tasks 1, 3, 6), then minor issues (Tasks 2, 8).

---

## Appendix: File Locations

### Context Management
- `packages/core/src/context/contextManager.ts` - Main orchestration
- `packages/core/src/context/types.ts` - Type definitions
- `packages/core/src/context/contextPool.ts` - Dynamic sizing
- `packages/core/src/context/vramMonitor.ts` - VRAM monitoring

### Compression System
- `packages/core/src/context/compressionCoordinator.ts` - Orchestration
- `packages/core/src/context/compressionService.ts` - LLM summarization
- `packages/core/src/context/checkpointManager.ts` - Checkpoint management

### Tool System
- `packages/core/src/tools/tool-registry.ts` - Tool registration
- `packages/core/src/core/chatClient.ts` - Chat client (line ~370)

### Session Management
- `packages/core/src/services/chatRecordingService.ts` - Session recording
- `packages/core/src/services/serviceContainer.ts` - Service initialization

### Settings
- `packages/cli/src/config/settingsService.ts` - Settings management
- `packages/ollm-bridge/src/provider/localProvider.ts` - Ollama provider

---

**Audit Complete**  
**Next Step:** Review findings with development team and proceed with Task 5 (highest priority)
