# Context Compression System Refactor - Requirements

**Feature Name:** context-compression-refactor  
**Created:** January 28, 2026  
**Status:** Draft  
**Priority:** 🔴 CRITICAL

---

## Executive Summary

The context compression system has critical architectural flaws causing crashes after 3-4 checkpoints. This spec addresses the fundamental issues identified in the audit and rebuilds the system to match the documented design.

**Problem:** System crashes after 3-4 checkpoints due to:

- LLM not involved in compression (just truncation)
- Snapshots mixed with active context
- No pre-send validation
- Checkpoints don't age properly
- User messages accumulate unbounded
- No error handling

**Solution:** Rebuild compression system with proper LLM summarization, storage layer separation, pre-send validation, checkpoint aging, and comprehensive error handling.

---

## Background

### Current State

The system has documentation describing an ideal compression system, but the implementation doesn't match. Key issues:

1. **No LLM Summarization:** Compression uses truncation instead of asking LLM to create semantic summaries
2. **Storage Layer Confusion:** Active context, snapshots, and session history are mixed together
3. **Missing Validation:** No hard stop before sending oversized prompts to Ollama
4. **Checkpoint Accumulation:** Old checkpoints don't compress further, causing context to fill up
5. **Unbounded User Messages:** User messages never compress, growing indefinitely
6. **Poor Error Handling:** System crashes instead of degrading gracefully

### Impact

- Users experience crashes after 3-4 checkpoints
- Long conversations impossible
- Data loss on crashes
- Poor user experience
- System unreliable for production use

---

## Goals

### Primary Goals

1. **Prevent Crashes:** System must never crash due to context overflow
2. **Enable Long Conversations:** Support 10+ checkpoints without degradation
3. **Semantic Compression:** LLM creates meaningful summaries, not truncation
4. **Clear Storage Layers:** Separate active context, snapshots, and session history
5. **Graceful Degradation:** Handle errors without crashing

### Secondary Goals

6. **Goal-Aware Compression:** Preserve goal-relevant information
7. **Checkpoint Aging:** Progressively compress old checkpoints
8. **User Experience:** Show progress, explain what's happening
9. **Performance:** Compression completes in 2-5 seconds
10. **Testing:** Comprehensive test coverage for all scenarios

---

## User Stories

### US-1: As a user, I want long conversations without crashes

**Acceptance Criteria:**

- [ ] Can have conversations with 10+ checkpoints
- [ ] System never crashes due to context overflow
- [ ] Conversation quality maintained across compressions
- [ ] Clear indication of compression progress

**Priority:** P0 (Critical)

---

### US-2: As a user, I want meaningful summaries of conversation history

**Acceptance Criteria:**

- [ ] LLM creates semantic summaries of old messages
- [ ] Summaries preserve key decisions and context
- [ ] Summaries are concise but informative
- [ ] Can review summaries if needed

**Priority:** P0 (Critical)

---

### US-3: As a user, I want the system to prevent context overflow

**Acceptance Criteria:**

- [ ] System validates prompt size before sending to Ollama
- [ ] System never sends oversized prompts
- [ ] System takes corrective action if prompt too large
- [ ] Clear error messages if prompt can't fit

**Priority:** P0 (Critical)

---

### US-4: As a user, I want old checkpoints to compress further

**Acceptance Criteria:**

- [ ] Old checkpoints re-summarize to free space
- [ ] Compression levels: Detailed → Moderate → Compact → Merged
- [ ] Aging happens automatically
- [ ] Space freed for new conversation

**Priority:** P0 (Critical)

---

### US-5: As a user, I want graceful error handling

**Acceptance Criteria:**

- [ ] System handles LLM errors gracefully
- [ ] System handles Ollama errors gracefully
- [ ] Clear error messages
- [ ] Recovery mechanisms available

**Priority:** P0 (Critical)

---

### US-6: As a user, I want goal-aware compression

**Acceptance Criteria:**

- [ ] Goals guide what information to preserve
- [ ] Goal-relevant information prioritized
- [ ] Goals visible across compressions
- [ ] Goal progress tracked

**Priority:** P1 (High)

---

### US-7: As a user, I want to see compression progress

**Acceptance Criteria:**

- [ ] UI shows "Compressing context..."
- [ ] Progress indicator visible
- [ ] User input blocked during compression
- [ ] Clear completion message

**Priority:** P1 (High)

---

### US-8: As a user, I want to review full conversation history

**Acceptance Criteria:**

- [ ] Full uncompressed history saved to disk
- [ ] Can review history anytime
- [ ] History never affected by compression
- [ ] Can export history

**Priority:** P2 (Medium)

---

## Functional Requirements

### FR-1: Storage Layer Separation

**Description:** Clearly separate three storage layers

**Requirements:**

- FR-1.1: Active context contains only what goes to LLM
- FR-1.2: Snapshots used only for recovery, never sent to LLM
- FR-1.3: Session history stores full uncompressed conversation
- FR-1.4: No mixing of storage layers
- FR-1.5: Runtime enforcement of boundaries

**Acceptance Criteria:**

- [ ] Three distinct storage interfaces defined
- [ ] Active context manager created
- [ ] Snapshot manager refactored
- [ ] Session history manager created
- [ ] Boundaries enforced at runtime

**Priority:** P0 (Critical)

---

### FR-2: LLM-Based Summarization

**Description:** LLM creates semantic summaries of conversation history

**Requirements:**

- FR-2.1: LLM called to summarize old messages
- FR-2.2: Summarization prompts for each compression level
- FR-2.3: User input blocked during summarization
- FR-2.4: Progress shown to user
- FR-2.5: Error handling for LLM failures

**Acceptance Criteria:**

- [ ] Summarization service created
- [ ] Prompts for all compression levels
- [ ] LLM integration working
- [ ] UI shows progress
- [ ] Errors handled gracefully

**Priority:** P0 (Critical)

---

### FR-3: Pre-Send Validation

**Description:** Validate prompt size before sending to Ollama

**Requirements:**

- FR-3.1: Calculate total tokens before sending
- FR-3.2: Compare against Ollama limit
- FR-3.3: Block sending if oversized
- FR-3.4: Take corrective action if needed
- FR-3.5: Re-validate after action

**Acceptance Criteria:**

- [ ] Validation service created
- [ ] Validates before every send
- [ ] Takes action if oversized
- [ ] Re-validates after action
- [ ] Throws error if can't fix

**Priority:** P0 (Critical)

---

### FR-4: Checkpoint Aging

**Description:** Progressively compress old checkpoints

**Requirements:**

- FR-4.1: Checkpoints age over time
- FR-4.2: Aging levels: Level 3 → 2 → 1 → Merged
- FR-4.3: LLM re-summarizes at each level
- FR-4.4: Space freed for new conversation
- FR-4.5: Oldest checkpoints merged

**Acceptance Criteria:**

- [ ] Aging logic implemented
- [ ] LLM re-summarization working
- [ ] Space freed correctly
- [ ] Merging works
- [ ] Tests pass

**Priority:** P0 (Critical)

---

### FR-5: Compression Pipeline

**Description:** Structured compression pipeline with clear stages

**Requirements:**

- FR-5.1: Identification stage - which messages to compress
- FR-5.2: Preparation stage - format for LLM
- FR-5.3: Summarization stage - LLM creates summary
- FR-5.4: Checkpoint creation stage - store summary
- FR-5.5: Context update stage - replace old with summary
- FR-5.6: Validation stage - verify result fits

**Acceptance Criteria:**

- [ ] Pipeline class created
- [ ] All stages implemented
- [ ] Progress reporting works
- [ ] Error handling at each stage
- [ ] Integration with context manager

**Priority:** P0 (Critical)

---

### FR-6: Error Handling

**Description:** Comprehensive error handling throughout system

**Requirements:**

- FR-6.1: Try-catch around all LLM calls
- FR-6.2: Try-catch around all Ollama calls
- FR-6.3: Graceful degradation on errors
- FR-6.4: User-friendly error messages
- FR-6.5: Recovery mechanisms

**Acceptance Criteria:**

- [ ] All error cases handled
- [ ] Graceful degradation works
- [ ] User sees helpful messages
- [ ] Recovery mechanisms available
- [ ] No crashes

**Priority:** P0 (Critical)

---

### FR-7: Goal Integration

**Description:** Goals guide compression decisions

**Requirements:**

- FR-7.1: Goals passed to LLM during summarization
- FR-7.2: Goal-relevant information prioritized
- FR-7.3: Goals preserved across compressions
- FR-7.4: Goal progress tracked
- FR-7.5: Goal markers parsed from LLM output

**Acceptance Criteria:**

- [ ] Goals in summarization prompts
- [ ] Goal-aware compression works
- [ ] Goals preserved
- [ ] Progress tracked
- [ ] Markers parsed

**Priority:** P1 (High)

---

### FR-8: User Message Management

**Description:** Prevent unbounded user message accumulation

**Requirements:**

- FR-8.1: Keep recent 10-20 user messages in full
- FR-8.2: Summarize older user messages
- FR-8.3: Include summaries in checkpoints
- FR-8.4: Prevent unbounded growth
- FR-8.5: Maintain conversation continuity

**Acceptance Criteria:**

- [ ] Recent messages preserved
- [ ] Old messages summarized
- [ ] Summaries in checkpoints
- [ ] Growth bounded
- [ ] Continuity maintained

**Priority:** P1 (High)

---

### FR-9: Compression Progress UI

**Description:** Show compression progress to user

**Requirements:**

- FR-9.1: UI component for progress
- FR-9.2: Shows "Compressing context..."
- FR-9.3: Progress indicator
- FR-9.4: Blocks user input
- FR-9.5: Shows completion

**Acceptance Criteria:**

- [ ] UI component created
- [ ] Progress shown
- [ ] Input blocked
- [ ] Completion shown
- [ ] Good UX

**Priority:** P1 (High)

---

### FR-10: Emergency Actions

**Description:** Emergency actions when context critical

**Requirements:**

- FR-10.1: Compress checkpoint at lower level
- FR-10.2: Merge multiple checkpoints
- FR-10.3: Emergency rollover
- FR-10.4: Aggressive user message summarization
- FR-10.5: Snapshot before emergency action

**Acceptance Criteria:**

- [ ] All emergency actions implemented
- [ ] Triggered correctly
- [ ] Snapshots created
- [ ] Space freed
- [ ] Tests pass

**Priority:** P1 (High)

---

### FR-11: Tier System Integration

**Description:** Integrate with existing tier system for prompt budgets

**Requirements:**

- FR-11.1: Respect tier-specific prompt budgets (see `dev_PromptSystem.md`)
- FR-11.2: Compression thresholds based on tier
- FR-11.3: System prompt preservation across compressions
- FR-11.4: Tier changes don't break compression state
- FR-11.5: Prompt budget calculations include checkpoints

**Acceptance Criteria:**

- [ ] Tier budgets respected (200-1500 tokens)
- [ ] Compression triggers account for tier
- [ ] System prompt never compressed
- [ ] Tier changes handled gracefully
- [ ] Token calculations include all prompt components

**Priority:** P0 (Critical)

**References:**

- `dev_PromptSystem.md` - Tier token budgets
- `dev_ContextManagement.md` - Tier detection logic

---

### FR-12: Mode System Integration

**Description:** Integrate with operational modes (Assistant, Developer, Planning, Debugger, User)

**Requirements:**

- FR-12.1: Mode-specific compression strategies
- FR-12.2: Mode changes don't break compression
- FR-12.3: Mode context preserved in summaries
- FR-12.4: Developer mode preserves code context
- FR-12.5: Planning mode preserves goals/decisions

**Acceptance Criteria:**

- [ ] Mode-aware summarization prompts
- [ ] Mode changes handled gracefully
- [ ] Code context preserved in Developer mode
- [ ] Goals preserved in Planning mode
- [ ] Tests for all modes

**Priority:** P1 (High)

**References:**

- `dev_PromptSystem.md` - Operational modes

---

### FR-13: Model Management Integration

**Description:** Integrate with model size detection and tool support

**Requirements:**

- FR-13.1: Model size affects compression reliability scoring
- FR-13.2: Larger models = better compression quality
- FR-13.3: Model size used in warning thresholds
- FR-13.4: Tool support detection doesn't break compression
- FR-13.5: Model swaps preserve compression state

**Acceptance Criteria:**

- [ ] Model size integrated into reliability calculation
- [ ] Compression quality varies by model size
- [ ] Warnings account for model capabilities
- [ ] Tool support changes handled
- [ ] Model swaps don't lose state

**Priority:** P1 (High)

**References:**

- `dev_ModelManagement.md` - Model size detection
- `dev_ContextCompression.md` - Reliability scoring

---

### FR-14: Provider System Integration

**Description:** Integrate with provider context limits

**Requirements:**

- FR-14.1: Use provider-specific context limits (from `LLM_profiles.json`)
- FR-14.2: Respect `ollama_context_size` (85% pre-calculated values)
- FR-14.3: Compression triggers based on provider limits
- FR-14.4: Provider errors trigger emergency actions
- FR-14.5: Future provider support (vLLM, Claude, etc.)

**Acceptance Criteria:**

- [ ] Provider limits read from profiles
- [ ] 85% values used correctly
- [ ] Compression triggers respect provider
- [ ] Provider errors handled
- [ ] Architecture supports future providers

**Priority:** P0 (Critical)

**References:**

- `dev_ProviderSystem.md` - Provider integration
- `dev_ContextManagement.md` - Context sizing logic

---

### FR-15: Goal System Integration

**Description:** Deep integration with goal management system

**Requirements:**

- FR-15.1: Goals NEVER compressed (always in system prompt)
- FR-15.2: Goal context guides summarization
- FR-15.3: Goal markers parsed from LLM output
- FR-15.4: Goal progress tracked across compressions
- FR-15.5: Checkpoints preserve goal-relevant information

**Acceptance Criteria:**

- [ ] Goals always in system prompt
- [ ] Goal-aware summarization working
- [ ] Goal markers parsed correctly
- [ ] Progress tracked accurately
- [ ] Goal info preserved in checkpoints

**Priority:** P1 (High)

**References:**

- `dev_PromptSystem.md` - Goal management system

---

### FR-16: Prompt Orchestration Integration

**Description:** Integrate with PromptOrchestrator for system prompt building

**Requirements:**

- FR-16.1: System prompt built by PromptOrchestrator
- FR-16.2: Compression doesn't interfere with prompt assembly
- FR-16.3: Checkpoints included in prompt structure
- FR-16.4: Skills/tools/hooks preserved
- FR-16.5: MCP prompts handled correctly

**Acceptance Criteria:**

- [ ] PromptOrchestrator builds system prompt
- [ ] Compression respects prompt structure
- [ ] Checkpoints integrated into prompt
- [ ] Skills/tools/hooks preserved
- [ ] MCP integration works

**Priority:** P0 (Critical)

**References:**

- `dev_PromptSystem.md` - PromptOrchestrator

---

## Non-Functional Requirements

### NFR-1: Performance

**Requirements:**

- NFR-1.1: Compression completes in 2-5 seconds
- NFR-1.2: Validation completes in <100ms
- NFR-1.3: Checkpoint aging completes in 1-2 seconds
- NFR-1.4: No UI blocking except during compression
- NFR-1.5: Memory usage stays reasonable

**Acceptance Criteria:**

- [ ] Performance benchmarks met
- [ ] No UI lag
- [ ] Memory usage acceptable
- [ ] Tests verify performance

**Priority:** P1 (High)

---

### NFR-2: Reliability

**Requirements:**

- NFR-2.1: System never crashes
- NFR-2.2: Graceful degradation on errors
- NFR-2.3: Data never lost
- NFR-2.4: Recovery always possible
- NFR-2.5: 99.9% uptime

**Acceptance Criteria:**

- [ ] No crashes in testing
- [ ] All error cases handled
- [ ] Data loss prevented
- [ ] Recovery mechanisms work
- [ ] Uptime target met

**Priority:** P0 (Critical)

---

### NFR-3: Maintainability

**Requirements:**

- NFR-3.1: Clear separation of concerns
- NFR-3.2: Well-documented code
- NFR-3.3: Comprehensive tests
- NFR-3.4: Easy to debug
- NFR-3.5: Easy to extend

**Acceptance Criteria:**

- [ ] Code follows architecture
- [ ] Documentation complete
- [ ] Test coverage >80%
- [ ] Debugging tools available
- [ ] Extension points clear

**Priority:** P1 (High)

---

### NFR-4: Testability

**Requirements:**

- NFR-4.1: Unit tests for all components
- NFR-4.2: Integration tests for flows
- NFR-4.3: Property-based tests for compression
- NFR-4.4: Long conversation tests (10+ checkpoints)
- NFR-4.5: Error scenario tests

**Acceptance Criteria:**

- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Property tests written
- [ ] Long conversation tests pass
- [ ] Error tests pass

**Priority:** P1 (High)

---

## Constraints

### Technical Constraints

1. **Ollama Context Limit:** Fixed limit per model (e.g., 6800 tokens for 8K)
2. **LLM Availability:** LLM must be running for summarization
3. **Token Counting:** Must be accurate to prevent overflow
4. **Backward Compatibility:** Must support existing sessions
5. **Platform Support:** Windows, macOS, Linux

### Business Constraints

1. **Timeline:** Critical fix needed ASAP
2. **Resources:** Limited development time
3. **Testing:** Must test thoroughly before release
4. **Documentation:** Must update all docs
5. **Migration:** Must migrate existing data

---

## Dependencies

### Internal Dependencies

1. **Context Manager:** Core orchestration
2. **Token Counter:** Accurate token counting
3. **Snapshot Manager:** Recovery mechanism
4. **Session Manager:** Session lifecycle
5. **Prompt System:** System prompt structure, tier/mode integration
6. **Model Management:** Model size detection, tool support
7. **Provider System:** Context window limits, provider integration
8. **Goal System:** Goal-aware compression
9. **Prompt Orchestrator:** System prompt building

### External Dependencies

1. **Ollama:** LLM provider
2. **LLM Models:** For summarization
3. **File System:** For storage
4. **React/Ink:** For UI
5. **TypeScript:** For type safety

---

## Success Metrics

### Quantitative Metrics

1. **Crash Rate:** 0% (down from current ~100% after 3-4 checkpoints)
2. **Checkpoint Limit:** Support 10+ checkpoints (up from 3-4)
3. **Compression Time:** 2-5 seconds per compression
4. **Context Accuracy:** >90% after 5 compressions
5. **Test Coverage:** >80%

### Qualitative Metrics

1. **User Satisfaction:** Positive feedback on long conversations
2. **Reliability:** Users trust system for important work
3. **Clarity:** Users understand what's happening
4. **Recovery:** Users can recover from errors
5. **Performance:** System feels responsive

---

## Risks and Mitigation

### Risk 1: LLM Summarization Quality

**Risk:** LLM creates poor summaries, losing important context

**Mitigation:**

- Test with multiple models
- Provide clear summarization prompts
- Allow user to review summaries
- Keep full history on disk

**Likelihood:** Medium  
**Impact:** High

---

### Risk 2: Performance Degradation

**Risk:** Compression takes too long, blocking user

**Mitigation:**

- Optimize LLM calls
- Show progress indicator
- Allow cancellation
- Cache summaries

**Likelihood:** Low  
**Impact:** Medium

---

### Risk 3: Backward Compatibility

**Risk:** Existing sessions break with new system

**Mitigation:**

- Migration scripts
- Backward compatibility layer
- Thorough testing
- Rollback plan

**Likelihood:** Medium  
**Impact:** High

---

### Risk 4: Edge Cases

**Risk:** Unexpected scenarios cause crashes

**Mitigation:**

- Comprehensive testing
- Error handling everywhere
- Graceful degradation
- User feedback

**Likelihood:** Medium  
**Impact:** Medium

---

## Out of Scope

The following are explicitly out of scope for this refactor:

1. **UI Redesign:** Focus on functionality, not UI changes
2. **New Features:** Only fix existing system, no new features
3. **Performance Optimization:** Beyond basic requirements
4. **Cloud Sync:** Local-only for now
5. **Multi-Model Support:** Single model per session

---

## Rewrite Strategy

### Approach: Clean Slate Rewrite

To avoid carrying forward legacy code and broken parts, we will:

1. **Backup all existing files** to `.legacy/context-compression/`
2. **Write completely new implementations** from scratch
3. **Use new file names** to avoid confusion
4. **Maintain backward compatibility** through adapters
5. **Migrate gradually** with feature flags

### Files to Backup and Rewrite

#### Core Compression Files (Complete Rewrite)

| Old File                    | Location                      | Lines | Backup To                                 | New File                       | Reason                              |
| --------------------------- | ----------------------------- | ----- | ----------------------------------------- | ------------------------------ | ----------------------------------- |
| `compressionService.ts`     | `packages/core/src/context/`  | 920   | `.legacy/context-compression/2026-01-28/` | `compressionEngine.ts`         | No LLM integration, just truncation |
| `compressionCoordinator.ts` | `packages/core/src/context/`  | 830   | `.legacy/context-compression/2026-01-28/` | `compressionOrchestrator.ts`   | Mixed concerns, unclear flow        |
| `chatCompressionService.ts` | `packages/core/src/services/` | 559   | `.legacy/context-compression/2026-01-28/` | `sessionCompressionService.ts` | Duplicate logic, XML generation     |
| `checkpointManager.ts`      | `packages/core/src/context/`  | ~400  | `.legacy/context-compression/2026-01-28/` | `checkpointLifecycle.ts`       | Aging doesn't work properly         |
| `snapshotManager.ts`        | `packages/core/src/context/`  | 615   | `.legacy/context-compression/2026-01-28/` | `snapshotLifecycle.ts`         | Mixed with active context           |
| `contextManager.ts`         | `packages/core/src/context/`  | 639   | `.legacy/context-compression/2026-01-28/` | `contextOrchestrator.ts`       | Too many responsibilities           |

**Total Legacy Code:** ~4,000 lines to be replaced

#### Supporting Files (Partial Rewrite)

| Old File                 | Location                     | Action          | New File                 | Reason                                      |
| ------------------------ | ---------------------------- | --------------- | ------------------------ | ------------------------------------------- |
| `snapshotStorage.ts`     | `packages/core/src/context/` | Keep & Refactor | `snapshotStorage.ts`     | Storage logic is sound, just needs cleanup  |
| `snapshotCoordinator.ts` | `packages/core/src/context/` | Keep & Refactor | `snapshotCoordinator.ts` | Coordination logic is minimal               |
| `snapshotUtils.ts`       | `packages/core/src/context/` | Keep            | `snapshotUtils.ts`       | Utilities are well-tested                   |
| `messageStore.ts`        | `packages/core/src/context/` | Keep & Refactor | `messageStore.ts`        | Core logic sound, needs integration updates |
| `tokenCounter.ts`        | `packages/core/src/context/` | Keep            | `tokenCounter.ts`        | Token counting works correctly              |
| `types.ts`               | `packages/core/src/context/` | Extend          | `types.ts`               | Add new types, keep existing                |

#### New Files to Create

| New File                   | Purpose                     | Lines (Est.) | Dependencies                        |
| -------------------------- | --------------------------- | ------------ | ----------------------------------- |
| `storageTypes.ts`          | Storage layer interfaces    | 200          | None                                |
| `activeContextManager.ts`  | Active context (LLM-bound)  | 400          | storageTypes.ts                     |
| `snapshotLifecycle.ts`     | Recovery snapshots          | 500          | storageTypes.ts, snapshotStorage.ts |
| `sessionHistoryManager.ts` | Full history storage        | 300          | storageTypes.ts                     |
| `compressionPipeline.ts`   | Structured compression flow | 600          | summarizationService.ts             |
| `summarizationService.ts`  | LLM summarization           | 400          | provider types                      |
| `validationService.ts`     | Pre-send validation         | 300          | tokenCounter.ts                     |
| `checkpointLifecycle.ts`   | Checkpoint aging            | 500          | summarizationService.ts             |
| `emergencyActions.ts`      | Emergency compression       | 400          | compressionPipeline.ts              |
| `contextOrchestrator.ts`   | Main coordination           | 700          | All above                           |
| `storageBoundaries.ts`     | Boundary enforcement        | 200          | storageTypes.ts                     |

**Total New Code:** ~4,500 lines (clean, well-tested)

### New Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ contextOrchestrator.ts (Main Coordination)                  │
│ - Coordinates all subsystems                                │
│ - Manages conversation lifecycle                            │
│ - Enforces storage boundaries                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
    ┌───────────────────────┼───────────────────────┐
    ↓                       ↓                       ↓
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ Active      │    │ Snapshot        │    │ Session History  │
│ Context     │    │ Lifecycle       │    │ Manager          │
│ Manager     │    │                 │    │                  │
│             │    │                 │    │                  │
│ (LLM-bound) │    │ (Recovery)      │    │ (Full history)   │
└─────────────┘    └─────────────────┘    └──────────────────┘
       ↓                    ↓                       ↓
┌─────────────────────────────────────────────────────────────┐
│ Storage Boundaries (Runtime Enforcement)                    │
│ - Prevents cross-contamination                              │
│ - Type guards and validation                                │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ Compression Pipeline                                        │
│ 1. Identification → 2. Preparation → 3. Summarization      │
│ 4. Checkpoint Creation → 5. Context Update → 6. Validation │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ Supporting Services                                         │
│ - Summarization Service (LLM integration)                   │
│ - Validation Service (Pre-send checks)                      │
│ - Checkpoint Lifecycle (Aging)                              │
│ - Emergency Actions (Critical situations)                   │
└─────────────────────────────────────────────────────────────┘
```

### File Organization

```
packages/core/src/context/
├── types/
│   └── storageTypes.ts          # NEW: Storage layer interfaces
│
├── storage/
│   ├── activeContextManager.ts  # NEW: Active context (LLM-bound)
│   ├── snapshotLifecycle.ts     # NEW: Recovery snapshots
│   ├── sessionHistoryManager.ts # NEW: Full history
│   └── storageBoundaries.ts     # NEW: Boundary enforcement
│
├── compression/
│   ├── compressionPipeline.ts   # NEW: Structured flow
│   ├── compressionEngine.ts     # NEW: Core compression logic
│   ├── summarizationService.ts  # NEW: LLM summarization
│   └── validationService.ts     # NEW: Pre-send validation
│
├── checkpoints/
│   ├── checkpointLifecycle.ts   # NEW: Checkpoint management
│   └── emergencyActions.ts      # NEW: Emergency handling
│
├── orchestration/
│   └── contextOrchestrator.ts   # NEW: Main coordinator
│
├── legacy/                       # Temporary during migration
│   ├── compressionService.ts    # OLD: Will be deleted
│   ├── compressionCoordinator.ts # OLD: Will be deleted
│   └── contextManager.ts        # OLD: Will be deleted
│
└── __tests__/
    ├── storage/
    │   ├── activeContextManager.test.ts
    │   ├── snapshotLifecycle.test.ts
    │   └── sessionHistoryManager.test.ts
    ├── compression/
    │   ├── compressionPipeline.test.ts
    │   ├── summarizationService.test.ts
    │   └── validationService.test.ts
    └── integration/
        ├── longConversation.test.ts
        ├── checkpointAging.test.ts
        └── errorHandling.test.ts
```

### Backup Process

#### Step 1: Create Backup Structure

```bash
# Create timestamped backup directory
BACKUP_DATE=$(date +%Y-%m-%d-%H%M%S)
BACKUP_DIR=".legacy/context-compression/${BACKUP_DATE}"
mkdir -p "${BACKUP_DIR}"

# Create subdirectories
mkdir -p "${BACKUP_DIR}/core"
mkdir -p "${BACKUP_DIR}/services"
mkdir -p "${BACKUP_DIR}/tests"
```

#### Step 2: Backup Core Files

```bash
# Backup compression files
cp packages/core/src/context/compressionService.ts \
   "${BACKUP_DIR}/core/"

cp packages/core/src/context/compressionCoordinator.ts \
   "${BACKUP_DIR}/core/"

cp packages/core/src/context/checkpointManager.ts \
   "${BACKUP_DIR}/core/"

cp packages/core/src/context/snapshotManager.ts \
   "${BACKUP_DIR}/core/"

cp packages/core/src/context/contextManager.ts \
   "${BACKUP_DIR}/core/"

# Backup service files
cp packages/core/src/services/chatCompressionService.ts \
   "${BACKUP_DIR}/services/"
```

#### Step 3: Backup Tests

```bash
# Backup test files
cp -r packages/core/src/context/__tests__/compressionService.test.ts \
   "${BACKUP_DIR}/tests/" 2>/dev/null || true

cp -r packages/core/src/context/__tests__/compressionCoordinator.test.ts \
   "${BACKUP_DIR}/tests/" 2>/dev/null || true

cp -r packages/core/src/context/__tests__/checkpointManager.test.ts \
   "${BACKUP_DIR}/tests/" 2>/dev/null || true

cp -r packages/core/src/context/__tests__/snapshotManager.test.ts \
   "${BACKUP_DIR}/tests/" 2>/dev/null || true

cp -r packages/core/src/context/__tests__/contextManager.test.ts \
   "${BACKUP_DIR}/tests/" 2>/dev/null || true
```

#### Step 4: Create Backup Manifest

```bash
cat > "${BACKUP_DIR}/MANIFEST.md" << EOF
# Context Compression System Backup

**Date:** $(date)
**Reason:** Complete rewrite to fix architectural flaws
**Issue:** System crashes after 3-4 checkpoints

## Files Backed Up

### Core Files (6 files, ~4,000 lines)
- compressionService.ts (920 lines)
- compressionCoordinator.ts (830 lines)
- chatCompressionService.ts (559 lines)
- checkpointManager.ts (~400 lines)
- snapshotManager.ts (615 lines)
- contextManager.ts (639 lines)

### Test Files
- All associated test files

## Critical Issues in Legacy Code

1. ❌ No LLM summarization (just truncation)
2. ❌ Snapshots mixed with active context
3. ❌ No pre-send validation
4. ❌ Checkpoints don't age properly
5. ❌ User messages accumulate unbounded
6. ❌ No error handling

## Replacement Files

- compressionEngine.ts (replaces compressionService.ts)
- compressionOrchestrator.ts (replaces compressionCoordinator.ts)
- sessionCompressionService.ts (replaces chatCompressionService.ts)
- checkpointLifecycle.ts (replaces checkpointManager.ts)
- snapshotLifecycle.ts (replaces snapshotManager.ts)
- contextOrchestrator.ts (replaces contextManager.ts)

## New Files Created

- storageTypes.ts (storage layer interfaces)
- activeContextManager.ts (LLM-bound context)
- sessionHistoryManager.ts (full history)
- compressionPipeline.ts (structured flow)
- summarizationService.ts (LLM integration)
- validationService.ts (pre-send checks)
- emergencyActions.ts (emergency handling)
- storageBoundaries.ts (boundary enforcement)

## Restoration

To restore legacy code (if needed):

\`\`\`bash
# Copy files back
cp ${BACKUP_DIR}/core/*.ts packages/core/src/context/
cp ${BACKUP_DIR}/services/*.ts packages/core/src/services/

# Rebuild
npm run build
\`\`\`

## References

- Audit: .dev/backlog/28-01-2026-ContextCompressionAudit/AUDIT_FINDINGS.md
- Spec: .kiro/specs/context-compression-refactor/requirements.md
EOF
```

#### Step 5: Create Restoration Script

```bash
cat > "${BACKUP_DIR}/restore.sh" << 'EOF'
#!/bin/bash
# Restoration script for legacy context compression system

echo "⚠️  WARNING: This will restore the legacy context compression system"
echo "This will overwrite the new implementation!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restoration cancelled"
  exit 1
fi

# Restore core files
echo "Restoring core files..."
cp core/*.ts ../../packages/core/src/context/

# Restore service files
echo "Restoring service files..."
cp services/*.ts ../../packages/core/src/services/

# Restore tests
echo "Restoring test files..."
cp tests/*.test.ts ../../packages/core/src/context/__tests__/ 2>/dev/null || true

echo "✅ Legacy system restored"
echo "Run 'npm run build' to rebuild"
EOF

chmod +x "${BACKUP_DIR}/restore.sh"
```

#### Step 6: Verification Checklist

```bash
cat > "${BACKUP_DIR}/VERIFICATION.md" << EOF
# Backup Verification Checklist

## Pre-Backup Verification

- [ ] All files exist in source locations
- [ ] Git status is clean (or changes committed)
- [ ] Tests are passing
- [ ] Build is successful

## Post-Backup Verification

- [ ] All 6 core files backed up
- [ ] All test files backed up
- [ ] MANIFEST.md created
- [ ] restore.sh created and executable
- [ ] File sizes match originals
- [ ] No corruption in backed up files

## Backup Integrity

\`\`\`bash
# Verify file counts
echo "Core files: \$(ls -1 core/*.ts | wc -l)"  # Should be 6
echo "Service files: \$(ls -1 services/*.ts | wc -l)"  # Should be 1
echo "Test files: \$(ls -1 tests/*.test.ts 2>/dev/null | wc -l)"

# Verify file sizes
du -sh core/
du -sh services/
du -sh tests/

# Verify no corruption
for file in core/*.ts services/*.ts; do
  if ! node -c "\$file" 2>/dev/null; then
    echo "❌ Syntax error in \$file"
  fi
done
\`\`\`

## Restoration Test

- [ ] Restoration script is executable
- [ ] Restoration script has correct paths
- [ ] Test restoration in separate branch
- [ ] Verify restored files work

## Documentation

- [ ] Backup location documented
- [ ] Reason for backup documented
- [ ] Replacement files documented
- [ ] Restoration process documented

## Sign-Off

Backup completed by: _______________
Date: _______________
Verified by: _______________
Date: _______________
EOF
```

#### Step 7: Execute Backup

```bash
# Run the backup
echo "Starting backup..."
bash backup-context-compression.sh

# Verify backup
echo "Verifying backup..."
ls -lah "${BACKUP_DIR}"

# Check file counts
echo "Core files: $(ls -1 ${BACKUP_DIR}/core/*.ts | wc -l)"
echo "Service files: $(ls -1 ${BACKUP_DIR}/services/*.ts | wc -l)"

# Create git commit for backup
git add .legacy/
git commit -m "backup: Context compression system before rewrite

Backed up 6 core files (~4,000 lines) to .legacy/context-compression/

Files backed up:
- compressionService.ts
- compressionCoordinator.ts
- chatCompressionService.ts
- checkpointManager.ts
- snapshotManager.ts
- contextManager.ts

Reason: Complete rewrite to fix architectural flaws
Issue: System crashes after 3-4 checkpoints

See: .legacy/context-compression/${BACKUP_DATE}/MANIFEST.md"

echo "✅ Backup complete and committed to git"
```

### Migration Strategy

#### Phase 0: Backup & Setup (1 day)

- Backup all existing files
- Create new file structure
- Set up feature flags
- Create compatibility layer

#### Phase 1: New Foundation (2-3 days)

- Write new storage layer interfaces
- Implement active context manager
- Implement snapshot lifecycle
- Implement session history manager
- **No legacy code used**

#### Phase 2: New Compression Engine (2-3 days)

- Write new compression pipeline
- Implement LLM summarization service
- Implement checkpoint lifecycle
- Implement validation service
- **No legacy code used**

#### Phase 3: New Orchestration (2-3 days)

- Write new context orchestrator
- Implement emergency actions
- Implement boundary enforcement
- Wire up all new components
- **No legacy code used**

#### Phase 4: Integration & Testing (2-3 days)

- Feature flag to switch between old/new
- Test new system thoroughly
- Migrate existing sessions
- Verify backward compatibility

#### Phase 5: Cutover & Cleanup (1-2 days)

- Enable new system by default
- Remove feature flags
- Delete old imports
- Update documentation
- Archive legacy code

**Total Estimated Time:** 2-3 weeks

### Feature Flag Strategy

```typescript
// config/features.ts
export const FEATURES = {
  USE_NEW_COMPRESSION: process.env.OLLM_NEW_COMPRESSION === 'true',
  USE_NEW_CONTEXT_MANAGER: process.env.OLLM_NEW_CONTEXT === 'true',
  USE_NEW_CHECKPOINTS: process.env.OLLM_NEW_CHECKPOINTS === 'true',
};

// contextManager.ts (temporary adapter)
import { FEATURES } from './config/features.js';

export function createContextManager(config: ContextConfig) {
  if (FEATURES.USE_NEW_CONTEXT_MANAGER) {
    return new ContextOrchestrator(config); // New implementation
  } else {
    return new ConversationContextManager(config); // Legacy
  }
}
```

### Compatibility Layer

```typescript
// adapters/legacyContextAdapter.ts
export class LegacyContextAdapter {
  // Adapts old session format to new format
  static migrateSession(oldSession: OldSession): NewSession {
    return {
      id: oldSession.sessionId,
      messages: this.convertMessages(oldSession.messages),
      checkpoints: this.convertCheckpoints(oldSession.metadata),
      // ... conversion logic
    };
  }

  // Adapts old snapshot format to new format
  static migrateSnapshot(oldSnapshot: OldSnapshot): NewSnapshot {
    return {
      id: oldSnapshot.id,
      activeContext: this.extractActiveContext(oldSnapshot),
      recoveryData: this.extractRecoveryData(oldSnapshot),
      // ... conversion logic
    };
  }
}
```

### Benefits of Clean Rewrite

1. **No Legacy Bugs:** Start fresh without inherited flaws
2. **Clear Architecture:** Follow documented design exactly
3. **Better Testing:** Write tests alongside new code
4. **Easier Maintenance:** Clean, well-structured code
5. **Performance:** Optimize from the start
6. **Type Safety:** Full TypeScript coverage
7. **Documentation:** Document as we write

### Risks and Mitigation

**Risk:** Rewrite takes longer than refactor

**Mitigation:**

- Clear requirements and design
- Incremental development
- Feature flags for gradual rollout
- Keep legacy code as fallback

**Risk:** Breaking changes for users

**Mitigation:**

- Compatibility layer for old sessions
- Migration scripts
- Thorough testing
- Gradual rollout with feature flags

**Risk:** Missing edge cases from legacy code

**Mitigation:**

- Review legacy code for edge cases
- Document known issues
- Comprehensive test suite
- User feedback during beta

---

## Acceptance Criteria

### System-Level Acceptance

- [ ] System supports 10+ checkpoints without crashes
- [ ] LLM creates semantic summaries
- [ ] Pre-send validation prevents overflow
- [ ] Checkpoints age progressively
- [ ] Error handling prevents crashes
- [ ] Full history preserved on disk
- [ ] Tests pass (>80% coverage)
- [ ] Documentation updated
- [ ] Migration scripts work
- [ ] User feedback positive

### Phase-Level Acceptance

- [ ] Phase 1: Storage layers separated
- [ ] Phase 2: LLM summarization working
- [ ] Phase 3: Validation and aging working
- [ ] Phase 4: Integration complete
- [ ] Phase 5: Documentation and release ready

---

## Appendix

### Related Documents

- [Audit Findings](.dev/backlog/28-01-2026-ContextCompressionAudit/AUDIT_FINDINGS.md)
- [Context Compression](./dev/docs/knowledgeDB/dev_ContextCompression.md)
- [Context Management](./dev/docs/knowledgeDB/dev_ContextManagement.md)
- [Context Snapshots](./dev/docs/knowledgeDB/dev_ContextSnapshots.md)

### Glossary

- **Active Context:** What gets sent to LLM (compressed)
- **Snapshot:** Full conversation state for recovery
- **Session History:** Complete uncompressed conversation
- **Checkpoint:** Compressed summary of old messages
- **Aging:** Progressive compression of old checkpoints
- **Rollover:** Emergency context reset

---

**Status:** Draft - Ready for Review  
**Next Step:** Design document creation
