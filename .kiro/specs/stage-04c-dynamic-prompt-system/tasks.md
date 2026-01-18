# Tasks: Dynamic Prompt System

**Feature:** Dynamic Prompt System with 10 Modes and Mode-Aware Snapshots  
**Status:** In Progress (Phases 1-17 Complete, 18-20 Remaining)  
**Priority:** 🔴 CRITICAL

---

## Task Breakdown

### Phase 1: Core Infrastructure ✅ COMPLETE

- [x] 1. Create Context Analyzer
- [x] 2. Create Prompt Mode Manager
- [x] 3. Create Mode Templates (all 10 modes)
- [x] 4. Create Snapshot Manager
- [x] 5. Export New Classes

---

### Phase 2: Integration with Context Manager ✅ COMPLETE

- [x] 6. Initialize Mode Manager on App Start
- [x] 7. Update Message Send Flow
- [x] 8. Update Tool Execution Flow

---

### Phase 3: UI Integration ✅ COMPLETE

- [x] 9. Update Active Context State
- [x] 10. Update Context Section Display
- [x] 11. Add Mode Commands

---

### Phase 4: HotSwap Integration ✅ COMPLETE

- [x] 12. Update HotSwap Service
- [x] 13. Update HotSwap Tool

---

### Phase 5: Compression Integration ✅ COMPLETE

- [x] 14. Update Compression Service
- [x] 15. Rebuild Prompt After Compression

---

### Phase 6: Settings & Persistence ✅ COMPLETE

- [x] 16. Add Mode Settings
- [x] 17. Implement Mode Persistence

---

### Phase 7: Testing ✅ COMPLETE

- [x] 18. Unit Tests
- [x] 19. Integration Tests
- [x] 20. Manual Testing

---

### Phase 8: Enhancements - Additional Modes ✅ COMPLETE

- [x] 21. Create Prototype Mode
- [x] 22. Create Teacher Mode

---

### Phase 9: Enhancements - Mode Transition Suggestions ✅ COMPLETE

- [x] 23. Implement Mode Transition Suggester

---

### Phase 10: Enhancements - Mode Workflows ✅ COMPLETE

- [x] 24. Implement Workflow System

---

### Phase 11: Enhancements - Mode Shortcuts ✅ COMPLETE

- [x] 25. Implement Mode Shortcuts

---

### Phase 12: Enhancements - Improved Planning Mode ✅ COMPLETE

- [x] 26. Update Planning Mode Restrictions

---

### Phase 13: Enhancements - Mode Confidence Display ✅ COMPLETE

- [x] 27. Implement Confidence Display

---

### Phase 14: Enhancements - Mode Metrics ✅ COMPLETE

- [x] 28. Implement Mode Metrics Tracking

---

### Phase 15: Enhancements - Focus Mode (2-3 hours) ⚠️ OPTIONAL

- [x] 29. Implement Focus Mode
  - [x] 29.1 Complete `FocusModeManager.ts` class implementation
  - [x] 29.2 Implement focus mode enable/disable logic with timer
  - [x] 29.3 Implement mode switching prevention during focus
  - [x] 29.4 Add focus mode timer with countdown display
  - [x] 29.5 Integrate with PromptModeManager to block auto-switching
  - [x] 29.6 Add `/mode focus <mode> <duration>` and `/mode focus off` commands to modeCommands.ts
  - [x] 29.7 Create UI component for focus mode display in status bar
  - [x] 29.8 Add focus mode state to ActiveContextState
  - [x] 29.9 Write unit tests for FocusModeManager
  - [x] 29.10 Write integration tests for focus mode with mode switching

**Note:** Focus mode is an optional enhancement. The core mode system is fully functional without it.

---

### Phase 16: Enhancements - Hybrid Modes ✅ COMPLETE

- [x] 30. Implement Hybrid Mode System

---

### Phase 17: Enhancements - Mode Memory ✅ COMPLETE

- [x] 31. Implement Project Mode Preferences

---

### Phase 18: Enhancements - Mode Transition Animations (2-3 hours) ⚠️ OPTIONAL

- [x] 32. Implement Transition Animations
  - [x] 32.1 Complete `ModeTransitionAnimator.ts` class (file exists but incomplete)
  - [x] 32.2 Finish animation data structures and mode-specific configurations
  - [x] 32.3 Implement transition message generation for all modes
  - [x] 32.4 Create UI component for displaying animations in chat
  - [x] 32.5 Add spinner/loading indicators during transitions
  - [x] 32.6 Add mode-specific transition messages (e.g., "Switching to Debugger Mode...")
  - [x] 32.7 Integrate with PromptModeManager to trigger animations on mode change
  - [x] 32.8 Write unit tests for ModeTransitionAnimator
  - [x] 32.9 Write integration tests for animation display

**Note:** Transition animations are an optional visual enhancement. The mode system works fully without them.

---

###hase 19: RAG and Structured Output Integration (12-15 hours) 🚀 FUTURE

**Status:** Not started - This is a major future enhancement for the intelligence layer.

- [-] 33. Setup LanceDB Infrastructure
  - [x] 33.1 Add `vectordb` or `lancedb` dependency to package.json
  - [x] 33.2 Add `@xenova/transformers` dependency for local embeddings
  - [x] 33.3 Create `packages/core/src/rag/` directory
  - [x] 33.4 Create `RAGSystem.ts` interface defining the RAG architecture
  - [x] 33.5 Create `LanceDBSetup.ts` class for database initialization
  - [x] 33.6 Implement database initialization with proper error handling
  - [x] 33.7 Create table schema for codebase index (file paths, chunks, embeddings)
  - [x] 33.8 Create tables for mode-specific knowledge (debugger, security, performance, planning)
  - [-] 33.9 Write unit tests for LanceDB setup and initialization

- [ ] 34. Implement Embedding Service
  - [ ] 34.1 Create `EmbeddingService.ts` interface
  -ansformers
  - [ ] 34.3 Initialize embedding model (Xenova/all-MiniLM-L6-v2, 384-dim)
  - [ ] 34.4 Implement single text embedding with proper error handling
  - [ ] 34.5 Implement batch embedding for efficient processing
  - [ ] 34.6 Implement cosine similarity calculation for search
  - [ ] 34.7 Add embedding caching for performance (LRU cache)
  - [ ] 34.8 Write unit tests for embedding service

- [ ] 35. Implement Codebase Index
  - [ ] 35.1 Create `CodebaseIndex.ts` class
  - [ ] 35.2 Implement workspace indexing with file watching (chokidar)
  - [ ] 35.3 Implement file chunking (512 tokens, 50 token overlap)
  - [ ] 35.4 Implement incremental updates on file changes
  - [ ] 35.5 Implement semantic search with topK and threshold parameters
  - [ ] 35.6 Respect .gitignore and exclude patterns (node_modules, dist, etc.)
  - [ ] 35.7 Skip large files (configurable threshold, default 1MB)
  - [ ] 35.8 Implement index statistics and monitoring (file count, chunk count, etc.)
  - [ ] 35.9 Write unit tests for codebase index

- [ ] 36. Implement LanceDB Vector Store
  - [ ] 36.1 Create `LanceDBVectorStore.ts` class
  - [ ] 36.2 Implement upsert operations (single and batch)
  - [ ] 36.3 Implement vector search with similarity scoring
  - [ ] 36.4 Implement delete operations for cleanup
  - [ ] 36.5 Implement clear and count operations
  - [ ] 36.6 Add vector metadata storage (file path, line numbers, language)
  - [ ] 36.7 Write unit tests for vector store operations

- [ ] 37. Implement Mode-Specific RAG Integration
  - [ ] 37.1 Create `ModeRAGIntegration.ts` class
  - [ ] 37.2 Implement context retrieval for debugger mode (error patterns, solutions)
  - [ ] 37.3 Implement context retrieval for security mode (vulnerabilities, fixes)
  - [ ] 37.4 Implement context retrieval for performance mode (optimization patterns)
  - [ ] 37.5 Implement context retrieval for planning mode (design patterns, architectures)
  - [ ] 37.6 Implement knowledge indexing on mode exit (store findings)
  - [ ] 37.7 Implement RAG context formattor prompts
  - [ ] 37.8 Add RAG context injection to PromptModeManager.buildPrompt()
  - [ ] 37.9 Write unit tests for mode RAG integration

- [ ] 38. RAG Storage and Configuration
  - [ ] 38.1 Create storage directory structure (~/.ollm/rag/)
  - [ ] 38.2 Implement index persistence to disk
  - [ ] 38.3 Implement index cleanup/pruning (remove old entries)
  - [ ] 38.4 Add RAG configuration to settings schema (enabled, topK, threshold)
  - [ ] 38.5 Implement RAG enable/disable toggle in settings
  - [ ] 38.6 Add RAG statistics to `/mode status` command output
  - [ ] 38.7 Write unit tests for storage and configuration

- [ ] 39. Implement Structured Output Service
  - [ ] 39.1 Create `packages/core/src/output/` directory
  - [ ] 39.2 Create `StructuredOutputService.ts` class
  - [ ] 39.3 Implement JSON schema validation with Ajv library
  - [ ] 39.4 Implement generateWithSchema() with retry logic
  - [ ] 39.5 Implement extractJson() for mixed content parsing
  - [ ] 39.6 Implement validation error forma
  - [ ] 39.7 Add retry with exponential backoff (3 retries, 1s delay)
  - [ ] 39.8 Write unit tests for structured output service

- [ ] 40. Define Mode-Specific Schemas
  - [ ] 40.1 Create `MODE_OUTPUT_SCHEMAS` constant in output/schemas.ts
  - [ ] 40.2 Define debugger mode schema (errors, rootCause, fixes)
  - [ ] 40.3 Define security mode schema (vulnerabilities, severity, recommendations)
  - [ ] 40.4 Define reviewer mode schema (issues, suggestions, positives)
  -ottlenecks, optimizations, estimatedImprovement)
  - [ ] 40.6 Add schema validation tests for each mode

- [ ] 41. Integrate Structured Output with Modes
  - [ ] 41.1 Update PromptModeManager to use structured output for specialized modes
  - [ ] 41.2 Enable structured output on mode entry (if schema exists)
  - [ ] 41.3 Validate output on mode exit
  - [ ] 41.4 Store structured findings in mode transition snapshots
  - [ ] 41.5 Format structured output for UI display
  - [ ] 41.6 Add structured output configuration to settings
  - [ ] 41.7 Write integration tests for structured output with modes

- [ ] 42. Provider Integration for Structured Output
  - [ ] 42.1 Update ProviderRequest interface to include responseFormat field
  - [ ] 42.2 Implement ResponseFormat type (text | json | json_schema)
  - [ ] 42.3 Update provider adapters to support structured output
  - [ ] 42.4 Add fallback for providers without native support (parse JSON from text)
  - [ ] 42.5 Test structured output with Ollama provider
  - [ ] 42.6 Write integration tests for provider structured output

**Note:** Phase 19 is a major future enhancement that adds semantic search and structured output capabilities. The mode system is fully functional without it.

---

### Phase 20: Documentation & Polish (1-2 hours)

- [ ] 43. Documentation
  - [ ] 43.1 Create `docs/modes/README.md` documenting all 10 modes
  - [ ] 43.2 Document mode workflows in `docs/modes/workflows.md`
  - [ ] 43.3 Document mode shortcuts in `docs/modes/shortcuts.md`
  - [ ] 43.4 Document hybrid modes in `docs/modes/hybrid-modes.md`
  - [ ] 43.5 Document focus mode (if implemented) in `docs/modes/focus-mode.md`
  - [ ] 43.6 Document RAG integration (if implemented) in `docs/modes/rag-integration.md`
  - [ ] 43.7 Document structured output (if implemented) in `docs/modes/structured-output.md`
  - [ ] 43.8 Create user guide in `docs/modes/user-guide.md`
  - [ ] 43.9 Create developer guide in `docs/modes/developer-guide.md`
  - [ ] 43.10 Update CHANGELOG.md with mode system features

olish & Refinement
  - [ ] 44.1 Optimize keyword detection performance (benchmark and profile)
  - [ ] 44.2 Optimize snapshot storage performance (async writes, compression)
  - [ ] 44.3 Optimize RAG search performance (if implemented)
  - [ ] 44.4 Optimize structured output validation (if implemented)
  - [ ] 44.5 Add comprehensive error handling for all edge cases
  - [ ] 44.6 Add logging for all mode operations (debug level)
  - [ ] 44.7 Add telemetry for mode usage (optional, privacy-respecting)
  - [ ] 44.8 Review and refactor code for maintainability
  - [ ] 44.9 Final testing pass (all modes, all transitions, all commands)

---

## Implementation Status Summary

### ✅ Completed (Phases 1-17)
- **Core Infrastructure**: All 10 modes, mode manager, context analyzer, snapshot manager
- **Integration**: Context manager, message flow, tool execution, HotSwap, compression
- **UI**: Active context state, mode display, commands
- **Enhancements**: Suggestions, workflows, shortcuts, ple display, metrics, hybrid modes, mode memory
- **Testing**: Comprehensive unit, integration, and manual tests

### ⚠️ Optional (Phases 15, 18)
- **Focus Mode**: Prevents mode switching during deep work sessions (nice-to-have)
- **Transition Animations**: Visual feedback for mode changes (nice-to-have)

### 🚀 Future (Phase 19)
- **RAG Integration**: Semantic search with LanceDB and local embeddings (major enhancement)
- **Structured Output**: JSON schema enforcement for specialize

### 📝 Remaining (Phase 20)
- **Documentation**: User and developer guides for all features
- **Polish**: Performance optimization, error handling, final testing

---

## Estimated Timeline

| Phase | Status | Estimated Time |
|-------|--------|----------------|
| Phases 1-17 | ✅ Complete | ~50-60 hours |
| Phase 15 (Focus Mode) | ⚠️ Optional | 2-3 hours |
| Phase 18 (Animations) | ⚠️ Optional | 2-3 hours |
| Phase 19 (RAG & Structured Output) | 🚀 Future | 12-15 hours |
| Phase 20 (Documentation & Polish) | 📝 Remaining | 1-2 hours |

**Current Progress:** ~85% complete (core system fully functional)  
**Remaining for MVP:** 1-2 hours (documentation and polish)  
**Optional Enhancements:** 4-6 hours (focus mode + animations)  
**Future Intelligence Layer:** 12-15 hours (RAG + structured output)

---

## Success Criteria

### MVP - Must Have ✅ COMPLETE
- [x] All 10 modes implemented with correct personas and tool access
- [x] Automatic mode switching based on keywords
- [x] Tool filtering enforced (planning modead-only for code)
- [x] UI displays current mode, persona, and allowed tools
- [x] Manual mode switching with `/mode` commands
- [x] HotSwap integration with mode system
- [x] Compression integration with XML snapshots
- [x] Mode-aware snapshots for specialized modes
- [x] Snapshot restoration with findings injection

### Enhanced - Should Have ✅ COMPLETE
- [x] Prototype and Teacher modes (10 total modes)
- [x] Mode transition suggestions
- [x] Mode workflows for common tasks
- [x] Mode-specific shortcuts
- [x] Planning mode can write docs/design files
- [x] Hysteresis prevents rapid mode switching (30s minimum)
- [x] Cooldown between mode switches (10s)
- [x] Mode history tracking (last 100 transitions)
- [x] Mode persistence across sessions
- [x] Mode confidence display in UI
- [x] Mode-specific metrics tracking
- [x] Hybrid modes combine capabilities
- [x] Mode memory per project

### Advanced - Nice to Have ⚠️ OPTIONAL
- [ ] Focus mode prevents interruptions
- [ ] Smooth transition animations

### Intelligence Layer - Future 🚀
- [ ] LanceDB setup and configuration
- [ ] Embedding service with local model
- [ ] Codebase indexing with semantic search
- [ ] Mode-specific knowledge bases
- [ ] RAG context injection on mode entry
- [ ] Findings indexing on mode exit
- [ ] Structured output service with JSON schema validation
- [ ] Mode-specific output schemas
- [ ] Retry logic with exponential backoff
- [ ] Provider integration for structured output

---

## Next Steps

### Immediate (1-2 hours)
1. **Complete Phase 20**: Write documentation and perform final polish
   - Document all 10 modes with examples
   - Create user guide for mode commands
   - Create developer guide for extending modes
   - Update CHANGELOG.md
   - Final testing pass

### Optional (4-6 hours)
2. **Phase 15**: Implement Focus Mode (if desired)
3. **Phase 18**: Complete Transition Animations (if desired)

### Future (12-15 hours)
4. **Phase 19**: Implement RAG and Structured Output (major enhancement)

---

## Dependencies

### Required Before Starting ✅
 ✅ SystemPromptBuilder exists
- ✅ PromptRegistry exists
- ✅ STATE_SNAPSHOT_PROMPT template exists
- ✅ HotSwapService exists
- ✅ ContextManager exists
- ✅ Tool registry exists

### Blocked By
- None (all dependencies exist)

---

## Risk Assessment

### High Risk 🔴
1. **Breaking Changes** - Modifying core context flow
   - ✅ Mitigated: Extensive testing completed, system stable
2. **Performance Impact** - Mode detection on every message
   - ✅ Mitigated: Optimized keyword matching, minimal overhead

### Medium Risk 🟡
1. **UI Complexity** - More state to manage
   - ✅ Mitigated: Clear state management implemented
2. **User Confusion** - Understanding modes
   - ⚠️ Needs: Documentation and user guide (Phase 20)

### Low Risk 🟢
1. **Backward Compatibility** - Old sessions still work
   - ✅ Mitigated: Default to assistant mode for old sessions

---

**Status:** Core system complete, documentation remaining  
**Priority:** 🔴 CRITICAL  
**Estimated Completion:** 1-2 hours for documentation

