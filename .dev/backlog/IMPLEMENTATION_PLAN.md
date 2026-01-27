# Sessions, Compression & Input Preprocessing - Implementation Plan

**Created:** January 27, 2026  
**Status:** 🚧 Phase 0 In Progress (20% complete)  
**Estimated Timeline:** 13-21 days (or 2 hours if we're optimistic 😄)

## Current Progress

**Phase 0: Input Preprocessing** - 🚧 IN PROGRESS
- ✅ Service created (`inputPreprocessor.ts`)
- ✅ Types defined
- 🚧 ChatClient integration (next)
- ⏳ UI clarification flow
- ⏳ Intent snapshot storage
- ⏳ Tests

---

## Executive Summary

This plan consolidates ALL work related to:
1. **Input Preprocessing** (NEW) - Extract signal from noise, set goals
2. **Sessions** - Full chat history storage
3. **Snapshots** - Recovery points
4. **Compression** - In-memory optimization
5. **Checkpoints** - Progressive aging
6. **Rollover** - Emergency handling

---

## Key Innovation: Input Preprocessing (Phase 0)

**The Game-Changer:** Don't let garbage into context!

### Before (Current):
```
User: [3000 tokens: typos, logs, rambling, buried intent]
  ↓
Context: [3000 tokens of garbage]
  ↓
Compression: [Compresses garbage]
  ↓
Result: Wasted tokens, unclear direction
```

### After (New):
```
User: [3000 tokens: typos, logs, rambling, buried intent]
  ↓
LLM: "I understand you want to: [100 token clean intent]. Correct?"
  ↓
User: "Yes"
  ↓
LLM: "Goal: [goal]. Milestones: 1) 2) 3). Proceed?"
  ↓
User: "Yes"
  ↓
Context: [100 tokens clean signal] ✅
Session: [3000 tokens original] ✅ (for RAG)
Intent Snapshot: [Complete extraction] ✅
  ↓
Result: 97% token savings, clear goals, proactive LLM
```

---

## Implementation Phases

### Phase 0: Input Preprocessing (NEW) 🔥🔥🔥
**Priority:** HIGHEST | **Effort:** 2-3 days

**What:**
- Detect long messages (>500 tokens)
- Extract intent with LLM
- Fix typos automatically
- Clarify with user
- Propose goal with milestones
- Create intent snapshot
- Store clean signal in active context
- Store original in session file

**Why:**
- 30x token savings (3000 → 100 in example)
- Clear understanding before action
- Goal-driven conversation
- Proactive LLM behavior
- Intent snapshots for RAG/memory

**Files:**
- NEW: `packages/core/src/services/inputPreprocessor.ts`
- NEW: `packages/core/src/context/intentSnapshotManager.ts`
- NEW: `packages/cli/src/ui/components/chat/ClarificationPrompt.tsx`
- NEW: `packages/cli/src/ui/components/goals/GoalProposal.tsx`
- MODIFY: `packages/core/src/core/chatClient.ts`

---

### Phase 1: Pre-Send Validation 🔥
**Priority:** HIGH | **Effort:** 1-2 days

**What:**
- Add `validateAndBuildPrompt()` method
- Calculate total prompt size before sending
- Compare against Ollama limit
- Trigger emergency compression if exceeded

**Why:**
- Prevent context overflow
- Never send prompts that exceed limit
- Safety gate before Ollama

**Files:**
- MODIFY: `packages/core/src/context/contextManager.ts`
- MODIFY: `packages/core/src/core/chatClient.ts`

---

### Phase 2: Blocking Mechanism 🔥
**Priority:** HIGH | **Effort:** 1-2 days

**What:**
- Block user input during checkpoint creation
- Show progress indicator
- Give LLM time to summarize
- Timeout after 30 seconds

**Why:**
- Prevent interruption during summarization
- Better checkpoint quality
- Clear user feedback

**Files:**
- MODIFY: `packages/core/src/context/compressionCoordinator.ts`
- MODIFY: `packages/cli/src/features/context/ChatContext.tsx`

---

### Phase 3: Emergency Safety Triggers 🔥
**Priority:** HIGH | **Effort:** 2-3 days

**What:**
- Warning at 70% (informational)
- Checkpoint at 80% (normal)
- Emergency compression at 95% (aggressive)
- Emergency rollover at 100% (last resort)

**Why:**
- Graceful degradation
- Clear user warnings
- Prevent overflow

**Files:**
- MODIFY: `packages/core/src/context/messageStore.ts`
- MODIFY: `packages/core/src/context/compressionCoordinator.ts`
- MODIFY: `packages/core/src/context/checkpointManager.ts`

---

### Phase 4: Fix Session Storage 🔥
**Priority:** HIGH | **Effort:** 1-2 days

**What:**
- Debug empty session files
- Fix auto-save
- Ensure full history saved

**Why:**
- Data loss prevention
- Full history for RAG
- User can review conversations

**Files:**
- DEBUG: `packages/core/src/services/chatRecordingService.ts`
- MODIFY: `packages/core/src/core/chatClient.ts`

---

### Phase 5: Snapshot Clarification
**Priority:** MEDIUM | **Effort:** 1-2 days

**What:**
- Document two snapshot systems
- Clarify purposes
- Consolidate if redundant

**Why:**
- Clear architecture
- No conflicts
- Better maintenance

**Files:**
- REVIEW: `packages/core/src/context/snapshotManager.ts`
- REVIEW: `packages/core/src/prompts/modeSnapshotManager.ts`

---

### Phase 6: Aging Consistency
**Priority:** MEDIUM | **Effort:** 1 day

**What:**
- Ensure aging called consistently
- Enforce merge threshold
- Add metrics

**Why:**
- Consistent checkpoint quality
- Prevent checkpoint accumulation
- Track aging effectiveness

**Files:**
- MODIFY: `packages/core/src/context/compressionCoordinator.ts`
- MODIFY: `packages/core/src/context/checkpointManager.ts`

---

### Phase 7: UI Enhancements
**Priority:** LOW | **Effort:** 2-3 days

**What:**
- Progress indicators
- Warning messages
- Rollover explanation
- Quality indicators

**Why:**
- Better user experience
- Clear feedback
- Transparency

**Files:**
- MODIFY: `packages/cli/src/features/context/ChatContext.tsx`
- MODIFY: `packages/cli/src/ui/components/layout/ContextSection.tsx`

---

## Documentation

### Completed ✅
- `dev_CheckpointRollover.md` - Complete system (combined)
- `dev_ContextCompression.md` - Compression system
- `dev_ContextManagement.md` - Context management
- `dev_Tokeniser.md` - Token counting
- `dev_PromptSystem.md` - Prompt system
- `dev_InputPreprocessing.md` - NEW: Input preprocessing

### Task Tracking
- `.dev/backlog/sessions_todo.md` - Detailed task list
- `.dev/backlog/IMPLEMENTATION_PLAN.md` - This file

---

## Success Criteria

### Functional
- ✅ Input preprocessing extracts clean intent
- ✅ Pre-send validation prevents overflow
- ✅ Blocking mechanism works
- ✅ Emergency triggers prevent overflow
- ✅ Session files contain full history
- ✅ Snapshots enable recovery
- ✅ Checkpoints age progressively

### Performance
- ✅ 30x token savings from preprocessing
- ✅ No context overflow
- ✅ No data loss
- ✅ All tests passing (444/444)

### User Experience
- ✅ Clear clarification loop
- ✅ Goal-driven conversation
- ✅ Progress indicators
- ✅ Warning messages
- ✅ Full history accessible

---

## Timeline

| Phase | Days | Priority | Dependencies |
|-------|------|----------|--------------|
| Phase 0 | 2-3 | HIGHEST 🔥🔥🔥 | None |
| Phase 1 | 1-2 | HIGH 🔥 | None |
| Phase 4 | 1-2 | HIGH 🔥 | None |
| Phase 2 | 1-2 | HIGH 🔥 | Phase 1 |
| Phase 3 | 2-3 | HIGH 🔥 | Phase 1, 2 |
| Phase 6 | 1 | MEDIUM | Phase 3 |
| Phase 5 | 1-2 | MEDIUM | None |
| Phase 7 | 2-3 | LOW | All above |

**Total:** 13-21 days

**Parallel Work Possible:**
- Phase 0, 1, 4 can run in parallel (no dependencies)
- Phase 5 can run anytime (independent)

---

## Risk Assessment

### High Risk 🔴
1. **Input Preprocessing** - New feature, complex LLM integration
2. **Pre-Send Validation** - Critical for preventing overflow
3. **Session Storage** - Data loss if broken

### Medium Risk 🟡
1. **Blocking Mechanism** - Could freeze UI if buggy
2. **Emergency Triggers** - Must work reliably
3. **Checkpoint Aging** - Could degrade quality if wrong

### Low Risk 🟢
1. **Snapshot Clarification** - Documentation only
2. **Aging Consistency** - Incremental improvement
3. **UI Enhancements** - Cosmetic, can iterate

---

## Next Steps

1. **Review this plan** - Get approval
2. **Start Phase 0** - Input preprocessing (highest priority)
3. **Parallel work** - Phase 1 and 4 can start simultaneously
4. **Test continuously** - All tests must pass
5. **Document as we go** - Update docs with each phase

---

## Questions?

Ready to start implementation! 🚀

**Estimated completion:** 13-21 days (or 2 hours with magic ✨)
