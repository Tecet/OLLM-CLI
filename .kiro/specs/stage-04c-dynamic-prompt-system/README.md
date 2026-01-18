# Dynamic Prompt System - Stage 04c

**Status:** ✅ Spec Complete - Ready for Implementation  
**Priority:** 🔴 CRITICAL  
**Estimated Effort:** 53-75 hours (1-2 weeks)

---

## Overview

The Dynamic Prompt System provides intelligent, context-aware system prompt management with **10 distinct operational modes** that automatically adapt based on conversation context. The system enables natural workflows like: **Think (Assistant) → Plan (Planning) → Build (Developer) → Debug (Debugger) → Build (Developer)** with appropriate capabilities and restrictions at each stage.

---

## Key Features

### 10 Operational Modes

#### Core Modes (Always Available)
1. **💬 Assistant** - General conversation, no tools
2. **📋 Planning** - Research & design, read-only tools + docs writing
3. **👨‍💻 Developer** - Full implementation, all tools
4. **🔧 Tool** - Enhanced tool usage with guidance

#### Specialized Modes (On-Demand)
5. **🐛 Debugger** - Systematic debugging and error analysis
6. **🔒 Security** - Security audits and vulnerability detection
7. **👀 Reviewer** - Code review and quality assessment
8. **⚡ Performance** - Performance analysis and optimization

#### Extended Modes (New)
9. **⚡🔬 Prototype** - Quick experiments, proof-of-concepts
10. **👨‍🏫 Teacher** - Education and concept explanation

### Automatic Mode Switching

- **Keyword Detection** - Analyzes conversation for mode-specific keywords
- **Confidence Scoring** - Calculates 0.0-1.0 confidence for each mode
- **Smart Transitions** - Switches modes when confidence exceeds thresholds (0.60-0.90)
- **Hysteresis** - 30s minimum duration prevents rapid switching
- **Cooldown** - 10s delay between switches for stability

### Mode-Aware Context Snapshots

- **Lightweight JSON Snapshots** - Quick mode switches (in-memory + disk)
- **Full XML Snapshots** - Long-term storage (STATE_SNAPSHOT_PROMPT format)
- **Findings Preservation** - Debugger/security/reviewer findings preserved across mode transitions
- **Automatic Creation** - Snapshots created before/after specialized mode entry/exit

### Tool Filtering

- **Planning Mode** - Restricted to read-only tools (web_search, read_file, grep_search, etc.)
- **Developer Mode** - Full tool access
- **Specialized Modes** - Curated tool sets for specific tasks
- **Clear Error Messages** - Helpful guidance when tool not allowed

### UI Integration

- **Right Panel Display** - Shows current mode icon, persona, allowed tools
- **Confidence Display** - Shows confidence scores for current and suggested modes
- **Visual Indicators** - Color-coded mode display with confidence bars
- **Real-Time Updates** - UI updates immediately on mode change
- **Mode Commands** - Manual control via `/mode` commands and shortcuts

### Advanced Features

- **Mode Transition Suggestions** - Proactive suggestions to switch modes
- **Mode Workflows** - Predefined sequences for common tasks (feature development, bug fix, etc.)
- **Mode Shortcuts** - Quick commands (`/debug`, `/secure`, `/review`, etc.)
- **Focus Mode** - Lock to a mode for deep work (prevents switching)
- **Hybrid Modes** - Combine multiple modes (e.g., secure-developer)
- **Mode Memory** - Remember preferences per project
- **Mode Metrics** - Track mode usage and effectiveness
- **Transition Animations** - Visual feedback for mode changes

### RAG Integration (Future)

- **LanceDB** - Embedded vector database for local-first RAG
- **Local Embeddings** - `@xenova/transformers` with `all-MiniLM-L6-v2`
- **Mode-Specific Knowledge** - Separate indexes for debugger, security, performance, planning
- **Context Injection** - Relevant knowledge loaded on mode entry
- **Findings Indexing** - Specialized mode findings saved for future use

---

## Documents

### 📋 Requirements Document
**File:** `requirements.md`  
**Status:** ✅ Complete

- 12 requirements with 96 acceptance criteria
- Covers all 10 modes, transitions, tool filtering, UI, persistence
- Property-based testing requirements included

### 🎨 Design Document
**File:** `design.md`  
**Status:** ✅ Complete

- Complete architecture with component diagrams
- All 10 mode definitions with personas and prompts
- Mode selection strategy with confidence thresholds
- Mode-aware context snapshot system (hybrid JSON/XML)
- Advanced features: suggestions, workflows, shortcuts, focus, hybrid, metrics
- RAG integration architecture (LanceDB)
- Integration points with existing systems
- Data models, commands, configuration
- Testing strategy

### ✨ Enhancements Document
**File:** `enhancements.md`  
**Status:** ✅ Complete

- Detailed specifications for all advanced features
- Prototype and Teacher mode templates
- Mode transition suggestions implementation
- Workflow system design
- Shortcuts and commands
- Improved planning mode restrictions
- Confidence display, metrics, focus mode, hybrid modes
- Mode memory and project preferences
- RAG integration with LanceDB
- Implementation examples and code snippets

### ✅ Tasks Document
**File:** `tasks.md`  
**Status:** ✅ Complete

- 40 tasks across 20 phases
- Detailed subtasks (300+ items)
- Estimated timeline: 53-75 hours
- Success criteria and risk assessment
- Dependencies and blockers identified
- Implementation strategy (MVP → Enhanced → Advanced → RAG)

---

## Implementation Phases

### MVP (Minimum Viable Product) - 14-22 hours
**Phases 1-7:** Core system with 8 modes, auto-switching, tool filtering, UI integration, HotSwap, compression, testing

### Enhanced Version - 25-33 hours
**Phases 8-12:** 
- Additional modes (Prototype, Teacher)
- Mode transition suggestions
- Mode workflows
- Mode shortcuts
- Improved planning mode (can write docs)

### Advanced Version - 14-20 hours
**Phases 13-18:**
- Confidence display
- Mode metrics tracking
- Focus mode
- Hybrid modes
- Mode memory (project preferences)
- Transition animations

### Future (RAG Integration) - 8-10 hours
**Phase 19:**
- LanceDB setup
- Embedding service
- Mode-specific knowledge bases
- RAG context injection

---

## Key Integration Points

### 1. App Initialization
```typescript
// Create mode manager on startup
const modeManager = new PromptModeManager(promptBuilder, promptRegistry);
const initialPrompt = modeManager.buildPrompt({ mode: 'assistant', ... });
contextManager.setSystemPrompt(initialPrompt);
```

### 2. Message Flow
```typescript
// Analyze and switch mode before sending
const analysis = contextAnalyzer.analyzeConversation(messages);
if (modeManager.shouldSwitchMode(currentMode, analysis)) {
  await modeManager.switchMode(analysis.mode, 'auto');
  const newPrompt = modeManager.buildPrompt({ mode: analysis.mode, ... });
  contextManager.setSystemPrompt(newPrompt);
}
```

### 3. Tool Execution
```typescript
// Filter tools by mode
if (!modeManager.isToolAllowed(toolName, currentMode)) {
  return error('Tool not allowed in current mode');
}
```

### 4. HotSwap
```typescript
// Use mode manager for skill switching
modeManager.updateSkills(newSkills);
const newPrompt = modeManager.buildPrompt({ mode: 'developer', skills: newSkills });
```

### 5. UI Display
```typescript
// Listen for mode changes
modeManager.onModeChange((transition) => {
  updateUI({ currentMode: transition.to, ... });
});
```

---

## Example Workflows

### Workflow 1: Natural Progression
```
User: "What's the best way to implement authentication?"
→ Assistant mode (general discussion)

User: "Let's plan an authentication system"
→ AUTO-SWITCH to Planning mode (research, design, write docs)

User: "Let's implement it"
→ AUTO-SWITCH to Developer mode (full implementation)
```

### Workflow 2: Error Handling
```
Developer mode: Implementing feature
→ Error encountered: "TypeError: Cannot read property..."
→ AUTO-SWITCH to Debugger mode
→ Debugger analyzes error, finds root cause
→ CREATE snapshot with findings
→ AUTO-SWITCH back to Developer mode
→ RESTORE snapshot (includes debugger findings)
→ Developer continues with fix
```

### Workflow 3: Learning Then Building
```
User: "Explain how JWT authentication works"
→ AUTO-SWITCH to Teacher mode
→ Teacher explains concept with examples

User: "Let me try building a quick prototype"
→ AUTO-SWITCH to Prototype mode
→ Quick prototype built (no tests, no docs)

User: "This works! Let's make it production-ready"
→ AUTO-SWITCH to Planning mode
→ Design production version
→ AUTO-SWITCH to Developer mode
→ Implement production code
```

### Workflow 4: Using Workflows
```
User: "/workflow feature_development"
→ Step 1: Planning mode (research & design)
→ Step 2: Developer mode (implement)
→ Step 3: Reviewer mode (code review)
→ Step 4: Developer mode (apply feedback)
→ Workflow complete!
```

### Workflow 5: Focus Mode
```
User: "/mode focus developer 60"
→ Locked to Developer mode for 60 minutes
→ No auto-switching
→ No manual switching
→ Deep work session
→ Timer expires, focus mode disabled
```

---

## Success Metrics

### MVP - Must Have ✅
- [x] All 8 core modes implemented
- [x] Automatic mode switching
- [x] Tool filtering enforced
- [x] UI displays current mode
- [x] Manual mode control
- [x] HotSwap integration
- [x] Compression integration
- [x] Mode-aware snapshots

### Enhanced - Should Have 🎯
- [x] Prototype and Teacher modes (10 total)
- [x] Mode transition suggestions
- [x] Mode workflows
- [x] Mode shortcuts
- [x] Planning mode can write docs
- [x] Hysteresis (30s minimum)
- [x] Cooldown (10s)
- [x] Mode history
- [x] Mode persistence

### Advanced - Nice to Have 💡
- [x] Confidence display
- [x] Mode metrics
- [x] Focus mode
- [x] Hybrid modes
- [x] Mode memory per project
- [x] Transition animations

### Future - RAG 🚀
- [x] LanceDB integration
- [x] Local embeddings
- [x] Mode-specific knowledge bases
- [x] Context injection
- [x] Findings indexing
- [x] Snapshot pruning

---

## Dependencies

### Existing Infrastructure ✅
- SystemPromptBuilder
- PromptRegistry
- STATE_SNAPSHOT_PROMPT template
- HotSwapService
- ContextManager
- Tool registry

### New Components (To Be Built)
- ContextAnalyzer
- PromptModeManager
- SnapshotManager
- Mode templates (8 files)
- Mode commands

---

## Risk Mitigation

### High Risk 🔴
- **Breaking Changes** → Extensive testing, gradual rollout
- **Performance Impact** → Optimize keyword matching, cache results

### Medium Risk 🟡
- **UI Complexity** → Clear state management, documentation
- **User Confusion** → Clear indicators, help text, examples

### Low Risk 🟢
- **Backward Compatibility** → Default to assistant mode for old sessions

---

## Next Steps

1. **Review Spec** - Ensure all stakeholders approve design
2. **Start Phase 1** - Create core infrastructure (ContextAnalyzer, PromptModeManager)
3. **Iterate** - Build, test, refine each phase
4. **Deploy** - Gradual rollout with feature flag

---

**Ready for Implementation:** ✅ Yes  
**Blockers:** None  
**Estimated Completion:** 2-3 days of focused work
