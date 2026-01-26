# Full System Integration Audit - Prompt System

**Date:** January 18, 2026  
**Status:** 🔍 COMPREHENSIVE AUDIT  
**Priority:** 🔴 CRITICAL

---

## Executive Summary

This audit examines how the **Dynamic Prompt System** (4 modes: Assistant, Planning, Developer, Tool) integrates with:

1. **Context Management** (stage-04b) - VRAM monitoring, snapshots, compression
2. **Services & Sessions** (stage-04) - Recording, compression, loop detection
3. **Tools & Policy** (stage-03) - Tool registry, policy engine, confirmations
4. **HotSwap Service** - Skill switching, context reseeding

**Key Finding:** The infrastructure is 90% complete but **not integrated**. We need to wire everything together.

---

## Part 1: Current Architecture

### What Exists ✅

#### 1. Context Management (stage-04b)
```
packages/core/src/context/
├── contextManager.ts       ✅ Orchestrates context operations
├── vramMonitor.ts          ✅ GPU memory tracking
├── contextPool.ts          ✅ Dynamic context sizing
├── snapshotManager.ts      ✅ Conversation checkpoints
├── compressionService.ts   ✅ Context compression
├── memoryGuard.ts          ✅ OOM prevention
├── tokenCounter.ts         ✅ Token counting
├── SystemPromptBuilder.ts  ✅ Modular prompt composition
└── HotSwapService.ts       ✅ Skill switching
```

#### 2. Prompt System
```
packages/core/src/prompts/
├── PromptRegistry.ts       ✅ Multi-source prompt management
├── types.ts                ✅ Prompt definitions
└── templates/
    ├── identity.ts         ✅ Agent identity
    ├── mandates.ts         ✅ Behavioral rules
    ├── sanity.ts           ✅ Reality checks
    └── stateSnapshot.ts    ✅ XML compression template
```

#### 3. Tools & Policy
```
packages/core/src/tools/
├── tool-registry.ts        ✅ Tool registration
├── HotSwapTool.ts          ✅ Skill switching tool
└── [30+ tools]             ✅ File, shell, web, etc.

packages/core/src/policy/
└── policyEngine.ts         ✅ Tool confirmation logic
```

#### 4. Session Management
```
packages/core/src/services/
├── chatRecordingService.ts ✅ Session persistence
├── chatCompressionService.ts ✅ Message compression
└── loopDetectionService.ts ✅ Infinite loop prevention
```

### What's Missing ❌

1. **No Initial System Prompt** - App starts with empty prompt
2. **No Mode Detection** - No context-aware prompt switching
3. **No Tool Filtering** - Planning mode can't restrict tools
4. **No UI Integration** - Right panel doesn't show mode/persona
5. **No Mode Manager** - No orchestration of mode transitions
6. **No Prompt Updates** - Prompt doesn't change when tools/skills change

---

## Part 2: Integration Points

### Integration Point 1: App Initialization

**Current Flow:**
```typescript
// packages/cli/src/features/context/ContextManagerContext.tsx
useEffect(() => {
  const manager = createContextManager(sessionId, modelInfo, config);
  await manager.start();
  // ❌ NO SYSTEM PROMPT SET
  setActive(true);
}, []);
```

**Required Flow:**
```typescript
useEffect(() => {
  const manager = createContextManager(sessionId, modelInfo, config);
  await manager.start();
  
  // ✅ BUILD INITIAL SYSTEM PROMPT
  const promptRegistry = new PromptRegistry();
  const promptBuilder = new SystemPromptBuilder(promptRegistry);
  const modeManager = new PromptModeManager(promptBuilder, promptRegistry);
  
  // Set initial mode (Assistant)
  const initialPrompt = modeManager.buildPromptForMode('assistant', {
    tools: [],
    skills: [],
    workspace: workspaceContext
  });
  
  manager.setSystemPrompt(initialPrompt);
  
  // Store mode manager for later use
  modeManagerRef.current = modeManager;
  
  setActive(true);
}, []);
```

### Integration Point 2: Message Flow

**Current Flow:**
```typescript
// User sends message
→ ChatContext.sendMessage()
→ ContextManager.addMessage()
→ Provider.chatStream()
→ Response streamed back
```

**Required Flow:**
```typescript
// User sends message
→ ChatContext.sendMessage()
→ ContextAnalyzer.analyzeMessage()  // NEW: Detect mode
→ ModeManager.updateMode()          // NEW: Switch if needed
→ ModeManager.buildPrompt()         // NEW: Rebuild prompt
→ ContextManager.setSystemPrompt()  // NEW: Update prompt
→ ContextManager.addMessage()
→ Provider.chatStream()
→ Response streamed back
```

### Integration Point 3: Tool Execution

**Current Flow:**
```typescript
// LLM requests tool
→ Tool call detected
→ PolicyEngine.checkPolicy()
→ Tool.execute()
→ Result returned to LLM
```

**Required Flow:**
```typescript
// LLM requests tool
→ Tool call detected
→ ModeManager.getCurrentMode()      // NEW: Check current mode
→ ModeManager.filterToolsForMode()  // NEW: Verify tool allowed
→ PolicyEngine.checkPolicy()
→ Tool.execute()
→ ModeManager.updateMode('tool')    // NEW: Switch to tool mode
→ Result returned to LLM
```

### Integration Point 4: HotSwap Integration

**Current Flow:**
```typescript
// HotSwapService.swap()
1. Generate snapshot
2. Clear context
3. Build new system prompt with skills
4. Reseed with snapshot
5. Emit 'active-skills-updated' event
```

**Required Flow:**
```typescript
// HotSwapService.swap()
1. Generate snapshot
2. Clear context
3. ModeManager.updateSkills(newSkills)  // NEW: Update mode manager
4. ModeManager.buildPrompt()            // NEW: Rebuild with skills
5. ContextManager.setSystemPrompt()     // NEW: Set new prompt
6. Reseed with snapshot
7. Emit 'active-skills-updated' event
8. Emit 'mode-changed' event            // NEW: Notify UI
```

### Integration Point 5: Context Compression

**Current Flow:**
```typescript
// CompressionService.compress()
1. Check if compression needed
2. Preserve system prompt
3. Summarize or truncate old messages
4. Keep recent messages
5. Return compressed context
```

**Required Flow:**
```typescript
// CompressionService.compress()
1. Check if compression needed
2. Preserve system prompt              // ✅ Already done
3. Use STATE_SNAPSHOT_PROMPT template  // NEW: XML format
4. Summarize or truncate old messages
5. Keep recent messages
6. Return compressed context
7. ModeManager.rebuildPrompt()         // NEW: Update prompt after compression
```

### Integration Point 6: UI Display

**Current State:**
```typescript
// ActiveContextState.tsx
interface ActiveContextState {
  activeSkills: string[];
  activeTools: string[];
  activeHooks: string[];
  activeMcpServers: string[];
  activePrompts: string[];
  currentPersona: string;
  contextStrategy: 'Standard' | 'Hot Swap';
}
```

**Required State:**
```typescript
interface ActiveContextState {
  activeSkills: string[];
  activeTools: string[];
  activeHooks: string[];
  activeMcpServers: string[];
  activePrompts: string[];
  currentPersona: string;
  currentMode: 'assistant' | 'planning' | 'developer' | 'tool';  // NEW
  allowedTools: string[];                                         // NEW
  contextStrategy: 'Standard' | 'Hot Swap';
}
```

---

## Part 3: Data Flow Analysis

### Scenario 1: User Asks General Question

```
User: "What's the weather like?"
│
├─> ContextAnalyzer.analyze()
│   └─> Keywords: "what", "weather"
│   └─> Confidence: assistant=0.8, developer=0.1
│   └─> Recommendation: assistant
│
├─> ModeManager.shouldSwitchMode()
│   └─> Current: assistant
│   └─> Recommended: assistant
│   └─> Switch: NO
│
├─> ModeManager.buildPrompt()
│   └─> Mode: assistant
│   └─> Tools: [] (no tools in assistant mode)
│   └─> Prompt: "You are a helpful AI assistant..."
│
├─> ContextManager.setSystemPrompt()
│   └─> Prompt updated
│
├─> ContextManager.addMessage()
│   └─> User message added
│
├─> Provider.chatStream()
│   └─> LLM generates response
│
└─> Response: "I don't have access to real-time weather..."
```

### Scenario 2: User Asks to Plan Feature

```
User: "Help me plan an authentication system"
│
├─> ContextAnalyzer.analyze()
│   └─> Keywords: "plan", "authentication", "system"
│   └─> Confidence: planning=0.9, developer=0.3
│   └─> Recommendation: planning
│
├─> ModeManager.shouldSwitchMode()
│   └─> Current: assistant
│   └─> Recommended: planning
│   └─> Switch: YES (confidence > 0.7)
│
├─> ModeManager.buildPrompt()
│   └─> Mode: planning
│   └─> Tools: [web_search, web_fetch, read_file, grep_search, list_directory]
│   └─> Prompt: "You are a technical architect and planner..."
│   └─> Restrictions: "You CANNOT write or modify code"
│
├─> ContextManager.setSystemPrompt()
│   └─> Prompt updated
│
├─> UI.updateMode()
│   └─> Display: "📋 Planning"
│   └─> Allowed Tools: [web_search, web_fetch, read_file, ...]
│
├─> ContextManager.addMessage()
│   └─> User message added
│
├─> Provider.chatStream()
│   └─> LLM generates response with tool calls
│   └─> Tool: web_search("authentication best practices")
│   └─> Tool: read_file("src/auth.ts")
│
└─> Response: "Based on your codebase and research, here's a plan..."
```

### Scenario 3: User Asks to Implement

```
User: "Let's implement it"
│
├─> ContextAnalyzer.analyze()
│   └─> Keywords: "implement"
│   └─> Confidence: developer=0.9, planning=0.2
│   └─> Recommendation: developer
│
├─> ModeManager.shouldSwitchMode()
│   └─> Current: planning
│   └─> Recommended: developer
│   └─> Switch: YES (confidence > 0.8)
│
├─> ModeManager.buildPrompt()
│   └─> Mode: developer
│   └─> Tools: [ALL TOOLS]
│   └─> Prompt: "You are a senior software engineer..."
│   └─> Mandates: "Follow existing patterns, test changes..."
│
├─> ContextManager.setSystemPrompt()
│   └─> Prompt updated
│
├─> UI.updateMode()
│   └─> Display: "👨‍💻 Developer"
│   └─> Allowed Tools: [ALL]
│
├─> ContextManager.addMessage()
│   └─> User message added
│
├─> Provider.chatStream()
│   └─> LLM generates response with tool calls
│   └─> Tool: read_file("src/auth.ts")
│   └─> Tool: str_replace(...)
│   └─> Tool: shell("npm test")
│
└─> Response: "I've implemented the authentication system..."
```

### Scenario 4: Context Compression Triggered

```
Context reaches 80% capacity
│
├─> MemoryGuard.onThreshold('warning')
│   └─> Trigger: compression
│
├─> CompressionService.compress()
│   └─> Strategy: hybrid
│   └─> Preserve: system prompt + recent 4096 tokens
│   └─> Summarize: older messages using STATE_SNAPSHOT_PROMPT
│   └─> Result: XML snapshot
│
├─> ContextManager.replaceMessages()
│   └─> Old messages replaced with summary
│
├─> ModeManager.rebuildPrompt()
│   └─> Mode: current mode (unchanged)
│   └─> Tools: current tools (unchanged)
│   └─> Prompt: rebuilt with current mode
│
├─> ContextManager.setSystemPrompt()
│   └─> Prompt updated (same mode, fresh build)
│
└─> Compression complete, conversation continues
```

### Scenario 5: HotSwap to New Skills

```
User: "/hotswap debugging"
│
├─> HotSwapTool.execute()
│   └─> Skills: ["debugging"]
│
├─> HotSwapService.swap(["debugging"])
│   │
│   ├─> Generate snapshot (XML format)
│   │   └─> Use STATE_SNAPSHOT_PROMPT
│   │   └─> Result: <state_snapshot>...</state_snapshot>
│   │
│   ├─> ContextManager.clear()
│   │   └─> All messages cleared except system prompt
│   │
│   ├─> ModeManager.updateSkills(["debugging"])
│   │   └─> Skills updated in mode manager
│   │
│   ├─> ModeManager.buildPrompt()
│   │   └─> Mode: developer (default for skills)
│   │   └─> Skills: ["debugging"]
│   │   └─> Prompt: includes debugging skill instructions
│   │
│   ├─> ContextManager.setSystemPrompt()
│   │   └─> New prompt with debugging skills
│   │
│   ├─> ContextManager.addMessage()
│   │   └─> Reseed with XML snapshot
│   │
│   ├─> UI.updateMode()
│   │   └─> Display: "👨‍💻 Developer (Debugging)"
│   │   └─> Active Skills: ["debugging"]
│   │
│   └─> Emit events
│       ├─> 'active-skills-updated'
│       └─> 'mode-changed'
│
└─> HotSwap complete, ready with debugging skills
```

---

## Part 4: Critical Integration Issues

### Issue 1: No Mode Manager 🔴

**Problem:** No central orchestrator for mode transitions

**Impact:**
- Can't detect when to switch modes
- Can't filter tools by mode
- Can't update UI with current mode
- Can't rebuild prompts dynamically

**Solution:** Create `PromptModeManager` class

### Issue 2: No Context Analyzer 🔴

**Problem:** No keyword detection or confidence scoring

**Impact:**
- Can't automatically detect mode from conversation
- User must manually switch modes
- No intelligent mode transitions

**Solution:** Create `ContextAnalyzer` class

### Issue 3: No Tool Filtering 🔴

**Problem:** Planning mode can't restrict tools

**Impact:**
- Planning mode has same tools as developer mode
- Can't enforce read-only restrictions
- No safety guardrails

**Solution:** Implement `filterToolsForMode()` in ModeManager

### Issue 4: No UI Integration 🔴

**Problem:** Right panel doesn't show current mode

**Impact:**
- User doesn't know which mode is active
- No visibility into allowed tools
- Confusing user experience

**Solution:** Update `ActiveContextState` and `ContextSection`

### Issue 5: HotSwap Not Integrated 🟡

**Problem:** HotSwap doesn't use ModeManager

**Impact:**
- Skill switching bypasses mode system
- Inconsistent prompt building
- Duplicate logic

**Solution:** Integrate HotSwap with ModeManager

### Issue 6: Compression Not Using XML 🟡

**Problem:** CompressionService doesn't use STATE_SNAPSHOT_PROMPT

**Impact:**
- Compression creates generic summaries
- Loses structured information
- Not compatible with HotSwap reseeding

**Solution:** Update CompressionService to use XML template

---

## Part 5: Integration Plan

### Phase 1: Core Infrastructure (3-4 hours)

**Task 1.1: Create ContextAnalyzer**
- File: `packages/core/src/context/ContextAnalyzer.ts` (new)
- Implement keyword detection
- Implement confidence scoring
- Implement mode recommendation

**Task 1.2: Create PromptModeManager**
- File: `packages/core/src/context/PromptModeManager.ts` (new)
- Implement mode tracking
- Implement mode transitions
- Implement prompt building per mode
- Implement tool filtering per mode

**Task 1.3: Create Mode Templates**
- File: `packages/core/src/prompts/templates/modes/` (new)
- `assistant.ts` - Assistant mode template
- `planning.ts` - Planning mode template
- `developer.ts` - Developer mode template
- `tool.ts` - Tool mode template

**Task 1.4: Export New Classes**
- File: `packages/core/src/index.ts`
- Export ContextAnalyzer
- Export PromptModeManager
- Export mode templates

### Phase 2: Integration with Context Manager (2-3 hours)

**Task 2.1: Initialize Mode Manager**
- File: `packages/cli/src/features/context/ContextManagerContext.tsx`
- Create PromptModeManager on init
- Build initial prompt (assistant mode)
- Set system prompt

**Task 2.2: Update on Message Send**
- File: `packages/cli/src/features/context/ChatContext.tsx`
- Analyze message before sending
- Update mode if needed
- Rebuild prompt
- Update system prompt

**Task 2.3: Update on Tool Execution**
- File: `packages/core/src/core/chatClient.ts`
- Check mode before tool execution
- Filter tools by mode
- Switch to tool mode during execution
- Switch back after execution

### Phase 3: UI Integration (2-3 hours)

**Task 3.1: Update ActiveContextState**
- File: `packages/cli/src/features/context/ActiveContextState.tsx`
- Add `currentMode` field
- Add `allowedTools` field
- Listen for 'mode-changed' events

**Task 3.2: Update ContextSection Display**
- File: `packages/cli/src/ui/components/layout/ContextSection.tsx`
- Display current mode with icon
- Display allowed tools
- Color-code by mode

**Task 3.3: Add Mode Commands**
- File: `packages/cli/src/commands/contextCommands.ts`
- `/mode assistant`
- `/mode planning`
- `/mode developer`
- `/mode auto`
- `/mode status`

### Phase 4: HotSwap Integration (1-2 hours)

**Task 4.1: Update HotSwapService**
- File: `packages/core/src/context/HotSwapService.ts`
- Accept ModeManager in constructor
- Use ModeManager.updateSkills()
- Use ModeManager.buildPrompt()
- Emit 'mode-changed' event

**Task 4.2: Update HotSwapTool**
- File: `packages/core/src/tools/HotSwapTool.ts`
- Pass ModeManager to HotSwapService
- Update tool description

### Phase 5: Compression Integration (1-2 hours)

**Task 5.1: Update CompressionService**
- File: `packages/core/src/services/chatCompressionService.ts`
- Use STATE_SNAPSHOT_PROMPT for summarization
- Validate XML structure
- Parse and format snapshot

**Task 5.2: Rebuild Prompt After Compression**
- File: `packages/cli/src/features/context/ContextManagerContext.tsx`
- Listen for 'compression-complete' event
- Rebuild prompt with ModeManager
- Update system prompt

### Phase 6: Testing & Refinement (3-4 hours)

**Task 6.1: Unit Tests**
- ContextAnalyzer tests
- PromptModeManager tests
- Tool filtering tests

**Task 6.2: Integration Tests**
- Mode transition tests
- HotSwap integration tests
- Compression integration tests

**Task 6.3: Manual Testing**
- Test all 4 modes
- Test mode transitions
- Test tool filtering
- Test UI display
- Test HotSwap
- Test compression

---

## Part 6: Success Criteria

### Must Have ✅

1. **Initial System Prompt** - App starts with assistant mode prompt
2. **Mode Detection** - Automatic mode switching based on keywords
3. **Tool Filtering** - Planning mode restricted to read-only tools
4. **UI Display** - Right panel shows current mode and allowed tools
5. **Mode Commands** - Manual mode switching with `/mode` command
6. **HotSwap Integration** - Skill switching uses mode system
7. **Compression Integration** - Uses XML snapshot format

### Should Have 🎯

1. **Smooth Transitions** - Hysteresis prevents rapid mode switching
2. **Mode History** - Track mode changes over time
3. **Mode Persistence** - Remember mode across sessions
4. **Mode Analytics** - Track mode usage patterns

### Nice to Have 💡

1. **Custom Modes** - User-defined modes
2. **Mode Profiles** - Different mode configurations per project
3. **Mode Suggestions** - AI suggests mode based on task

---

## Part 7: Risk Assessment

### High Risk 🔴

1. **Breaking Changes** - Modifying core context flow
   - Mitigation: Extensive testing, gradual rollout

2. **Performance Impact** - Mode detection on every message
   - Mitigation: Optimize keyword matching, cache results

3. **Tool Compatibility** - Existing tools may not work with filtering
   - Mitigation: Audit all tools, update schemas

### Medium Risk 🟡

1. **UI Complexity** - More state to manage
   - Mitigation: Clear state management, good documentation

2. **User Confusion** - Understanding modes
   - Mitigation: Clear UI indicators, help text, examples

### Low Risk 🟢

1. **Backward Compatibility** - Old sessions still work
   - Mitigation: Default to assistant mode for old sessions

---

## Summary

### Current State
- ✅ 90% of infrastructure exists
- ❌ 0% integration complete
- ❌ No mode detection
- ❌ No tool filtering
- ❌ No UI display

### Required Work
- **Total Effort:** 12-18 hours
- **Phase 1:** Core infrastructure (3-4h)
- **Phase 2:** Context integration (2-3h)
- **Phase 3:** UI integration (2-3h)
- **Phase 4:** HotSwap integration (1-2h)
- **Phase 5:** Compression integration (1-2h)
- **Phase 6:** Testing (3-4h)

### Next Steps
1. Create ContextAnalyzer class
2. Create PromptModeManager class
3. Create mode templates
4. Integrate with ContextManager
5. Update UI
6. Test thoroughly

---

**Status:** Audit complete, ready for implementation
**Priority:** 🔴 CRITICAL
**Estimated Completion:** 2-3 days of focused work
