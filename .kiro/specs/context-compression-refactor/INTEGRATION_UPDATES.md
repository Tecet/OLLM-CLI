# Context Compression Refactor - System Integration Updates

**Date:** January 28, 2026  
**Status:** Specification Updated  
**Priority:** 🔴 CRITICAL

---

## Summary

The context compression refactor specification has been updated to include comprehensive integration with existing systems. This ensures the new compression system works seamlessly with the tier/prompt/mode/model management systems that are already working and tested.

---

## What Was Added

### 1. New Functional Requirements (FR-11 through FR-16)

Six new functional requirements added to `requirements.md`:

- **FR-11: Tier System Integration** - Respect tier-specific prompt budgets (200-1500 tokens)
- **FR-12: Mode System Integration** - Mode-aware compression strategies
- **FR-13: Model Management Integration** - Model size affects compression quality
- **FR-14: Provider System Integration** - Use provider-specific context limits
- **FR-15: Goal System Integration** - Goals NEVER compressed, guide summarization
- **FR-16: Prompt Orchestrator Integration** - System prompt built by orchestrator

### 2. System Integration Design Section

Added comprehensive integration design to `design.md` with detailed implementations for:

1. **Tier Integration** - `TierAwareCompression` class
   - Tier-specific prompt budgets
   - Checkpoint budget calculations
   - Tier-aware compression triggers

2. **Mode Integration** - `ModeAwareCompression` class
   - Mode-specific summarization prompts
   - Preservation strategies per mode
   - Developer/Planning/Debugger mode support

3. **Model Integration** - `ModelAwareCompression` class
   - Model size detection
   - Reliability scoring
   - Warning thresholds based on model capabilities

4. **Provider Integration** - `ProviderAwareCompression` class
   - Provider-specific context limits
   - Pre-calculated 85% values from `LLM_profiles.json`
   - Provider validation

5. **Goal Integration** - `GoalAwareCompression` class
   - Goal-aware summarization prompts
   - Goal marker parsing
   - Goal progress tracking

6. **Prompt Orchestrator Integration** - `PromptOrchestratorIntegration` class
   - System prompt from orchestrator
   - Compression respects prompt structure
   - Skills/tools/hooks preservation

### 3. New Phase 5b: System Integration (7 tasks, ~4 days)

Added integration tasks to `tasks.md`:

- **TASK-510:** Tier System Integration (4 hours)
- **TASK-511:** Mode System Integration (4 hours)
- **TASK-512:** Model Management Integration (3 hours)
- **TASK-513:** Provider System Integration (4 hours)
- **TASK-514:** Goal System Integration (5 hours)
- **TASK-515:** Prompt Orchestrator Integration (4 hours)
- **TASK-516:** Wire Up All Integrations (4 hours)

**Total:** 28 hours (~4 days)

### 4. Updated Dependencies

Updated `requirements.md` dependencies section to include:

- Prompt System (tier/mode integration)
- Model Management (model size detection, tool support)
- Provider System (context window limits)
- Goal System (goal-aware compression)
- Prompt Orchestrator (system prompt building)

---

## Impact on Timeline

### Original Timeline

- **Total Tasks:** 25
- **Estimated Time:** 98.5 hours (~15 days)

### Updated Timeline

- **Total Tasks:** 32 (+7 integration tasks)
- **Estimated Time:** 126.5 hours (~19 days)
- **Additional Time:** 28 hours (~4 days)

### Breakdown by Priority

| Priority | Tasks | Estimated Time |
|----------|-------|----------------|
| P0 (Critical) | 24 | 98 hours |
| P1 (High) | 8 | 28.5 hours |
| **Total** | **32** | **126.5 hours** |

---

## Why These Integrations Are Critical

### 1. Tier System Integration (P0 - Critical)

**Without it:**
- Compression might violate tier-specific prompt budgets
- System prompt could be compressed (breaking tier structure)
- Token calculations would be incorrect

**With it:**
- Tier budgets respected (200-1500 tokens)
- System prompt never compressed
- Accurate token accounting

### 2. Mode System Integration (P1 - High)

**Without it:**
- Generic compression loses mode-specific context
- Developer mode loses code context
- Planning mode loses goals/decisions

**With it:**
- Mode-aware summarization prompts
- Code preserved in Developer mode
- Goals preserved in Planning mode

### 3. Model Management Integration (P1 - High)

**Without it:**
- No reliability scoring
- Same warnings for all models
- No quality tracking

**With it:**
- Model size affects compression quality
- Appropriate warnings per model
- Reliability tracking

### 4. Provider System Integration (P0 - Critical)

**Without it:**
- Wrong context limits used
- 85% values calculated at runtime (bug-prone)
- Provider errors not handled

**With it:**
- Provider limits from `LLM_profiles.json`
- Pre-calculated 85% values used
- Provider errors trigger emergency actions

### 5. Goal System Integration (P1 - High)

**Without it:**
- Goals might be compressed (losing context)
- No goal-aware summarization
- Goal progress not tracked

**With it:**
- Goals NEVER compressed
- Goal-aware summarization
- Goal markers parsed and tracked

### 6. Prompt Orchestrator Integration (P0 - Critical)

**Without it:**
- Compression system builds system prompt (wrong)
- Skills/tools/hooks not preserved
- Prompt structure broken

**With it:**
- PromptOrchestrator builds system prompt
- Compression respects prompt structure
- Skills/tools/hooks preserved

---

## Key Integration Points

### In Active Context Manager

```typescript
class ActiveContextManager {
  private tierIntegration: TierAwareCompression;
  private providerIntegration: ProviderAwareCompression;
  private promptOrchestrator: PromptOrchestratorIntegration;

  constructor(
    systemPrompt: Message,  // From PromptOrchestrator
    ollamaLimit: number,    // From Provider
    tier: ContextTier       // From Context Manager
  ) {
    // Integration with existing systems
  }
}
```

### In Compression Pipeline

```typescript
class CompressionPipeline {
  private modeIntegration: ModeAwareCompression;
  private goalIntegration: GoalAwareCompression;
  private modelIntegration: ModelAwareCompression;

  async compress(goal?: Goal): Promise<CompressionResult> {
    // Mode-aware summarization
    // Goal-aware preservation
    // Model-aware reliability
  }
}
```

### In Validation Service

```typescript
class ValidationService {
  private tierIntegration: TierAwareCompression;
  private providerIntegration: ProviderAwareCompression;

  validate(prompt: Message[]): ValidationResult {
    // Validate against tier budgets
    // Validate against provider limits
  }
}
```

---

## References to Existing Documentation

All integration designs reference existing documentation:

- `dev_PromptSystem.md` - Tier budgets, modes, goals, orchestrator
- `dev_ModelManagement.md` - Model size detection
- `dev_ProviderSystem.md` - Provider integration
- `dev_ContextManagement.md` - Context sizing, tier detection
- `dev_ContextCompression.md` - Reliability scoring

---

## Next Steps

1. **Review Integration Design** - Verify integration approach is correct
2. **Begin Phase 0** - Backup legacy code
3. **Implement Foundation** - Storage layers (Phase 1)
4. **Implement Compression** - Pipeline and summarization (Phase 2)
5. **Implement Lifecycle** - Checkpoint aging (Phase 3)
6. **Implement Orchestration** - Main coordinator (Phase 4)
7. **Implement UI** - Progress indicators (Phase 5)
8. **Implement Integration** - System integration (Phase 5b) ⭐ NEW
9. **Migration & Docs** - Migrate data, update docs (Phase 6)

---

## Files Modified

1. `.kiro/specs/context-compression-refactor/requirements.md`
   - Added FR-11 through FR-16 (6 new requirements)
   - Updated dependencies section

2. `.kiro/specs/context-compression-refactor/design.md`
   - Added "System Integration Design" section
   - 6 integration designs with code examples

3. `.kiro/specs/context-compression-refactor/tasks.md`
   - Added Phase 5b with 7 integration tasks
   - Updated summary (32 tasks, 126.5 hours)
   - Updated progress tracking

4. `.kiro/specs/context-compression-refactor/INTEGRATION_UPDATES.md` (NEW)
   - This document

---

## Conclusion

The specification now includes comprehensive integration with all existing systems. This ensures:

- ✅ Tier system compatibility
- ✅ Mode system compatibility
- ✅ Model management integration
- ✅ Provider system integration
- ✅ Goal system integration
- ✅ Prompt orchestrator integration

The new compression system will work seamlessly with the existing, tested systems without breaking any functionality.

**Status:** Specification Complete - Ready for Implementation  
**Timeline:** ~19 days (3-4 weeks)  
**Priority:** 🔴 CRITICAL

---

**Questions or Concerns?**

If you have any questions about the integration approach or need clarification on any design decisions, please let me know before beginning implementation.
