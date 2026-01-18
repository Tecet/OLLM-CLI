# Tasks: Dynamic Prompt System

**Feature:** Dynamic Prompt System with 8 Modes and Mode-Aware Snapshots  
**Status:** Not Started  
**Priority:** 🔴 CRITICAL

---

## Task Breakdown

### Phase 1: Core Infrastructure (3-4 hours)

- [x] 1. Create Context Analyzer
  - [x] 1.1 Create `ContextAnalyzer.ts` class
  - [x] 1.2 Implement keyword detection for all 8 modes
  - [x] 1.3 Implement confidence scoring algorithm
  - [x] 1.4 Implement conversation analysis (last 5 messages)
  - [x] 1.5 Add boost logic for explicit requests (+0.5)
  - [x] 1.6 Add boost logic for code blocks (+0.2)
  - [x] 1.7 Add boost logic for error messages (+0.3)
  - [x] 1.8 Write unit tests for ContextAnalyzer

- [x] 2. Create Prompt Mode Manager
  - [x] 2.1 Create `PromptModeManager.ts` class
  - [x] 2.2 Implement mode state tracking
  - [x] 2.3 Implement mode transition logic with confidence thresholds
  - [x] 2.4 Implement hysteresis (30s minimum duration)
  - [x] 2.5 Implement cooldown (10s between switches)
  
  - [x] 2.6 Implement prompt building per mode
  - [x] 2.7 Implement tool filtering per mode
  - [x] 2.8 Implement mode history tracking (last 100 transitions)
  - [x] 2.9 Implement event emitter for 'mode-changed' events
  - [x] 2.10 Write unit tests for PromptModeManager

- [x] 3. Create Mode Templates
  - [x] 3.1 Create `packages/core/src/prompts/templates/modes/` directory
  - [x] 3.2 Create `assistant.ts` template
  - [x] 3.3 Create `planning.ts` template
  - [x] 3.4 Create `developer.ts` template
  - [x] 3.5 Create `tool.ts` template
  - [x] 3.6 Create `debugger.ts` template
  - [x] 3.7 Create `security.ts` template
  - [x] 3.8 Create `reviewer.ts` template
  - [x] 3.9 Create `performance.ts` template
  - [x] 3.10 Create `index.ts` to export all templates

- [x] 4. Create Snapshot Manager
  - [x] 4.1 Create `SnapshotManager.ts` class
  - [x] 4.2 Implement `createTransitionSnapshot()` for JSON snapshots
  - [x] 4.3 Implement `createFullSnapshot()` for XML snapshots
  - [x] 4.4 Implement in-memory cache (last 10 snapshots)
  - [x] 4.5 Implement disk storage for snapshots
  - [x] 4.6 Implement snapshot retrieval by mode transition
  - [x] 4.7 Implement snapshot pruning (remove > 1 hour old)
  - [x] 4.8 Implement findings injection for specialized modes
  - [x] 4.9 Write unit tests for SnapshotManager

- [x] 5. Export New Classes
  - [x] 5.1 Export ContextAnalyzer from `packages/core/src/index.ts`
  - [x] 5.2 Export PromptModeManager from `packages/core/src/index.ts`
  - [x] 5.3 Export SnapshotManager from `packages/core/src/index.ts`
  - [x] 5.4 Export mode templates from `packages/core/src/index.ts`
  - [x] 5.5 Export mode types and interfaces

---

### Phase 2: Integration with Context Manager (2-3 hours)

- [ ] 6. Initialize Mode Manager on App Start
  - [x] 6.1 Update `ContextManagerContext.tsx` to create PromptModeManager
  - [x] 6.2 Create SnapshotManager instance
  - [x] 6.3 Load saved mode preference from settings (or default to assistant)
  - [x] 6.4 Build initial system prompt for loaded mode
  - [x] 6.5 Set system prompt in ContextManager
  - [x] 6.6 Store mode manager reference for later use
  - [x] 6.7 Register 'mode-changed' event listener

- [x] 7. Update Message Send Flow
  - [x] 7.1 Update `ChatContext.tsx` sendMessage function
  - [x] 7.2 Analyze message with ContextAnalyzer before sending
  - [x] 7.3 Check if mode should switch based on analysis
  - [x] 7.4 Create transition snapshot if switching to specialized mode
  - [x] 7.5 Switch mode if confidence threshold met
  - [x] 7.6 Rebuild system prompt with new mode
  - [x] 7.7 Update system prompt in ContextManager
  - [x] 7.8 Continue with normal message flow

- [x] 8. Update Tool Execution Flow
  - [x] 8.1 Update `chatClient.ts` executeTool function
  - [x] 8.2 Get current mode from ModeManager
  - [x] 8.3 Check if tool is allowed in current mode
  - [x] 8.4 Return error if tool not allowed with helpful message
  - [x] 8.5 Switch to tool mode during execution (if not already)
  - [x] 8.6 Execute tool
  - [x] 8.7 Switch back to previous mode after execution
  - [x] 8.8 Restore snapshot if returning from specialized mode

---

### Phase 3: UI Integration (2-3 hours)

- [x] 9. Update Active Context State
  - [x] 9.1 Update `ActiveContextState.tsx` interface
  - [x] 9.2 Add `currentMode` field
  - [x] 9.3 Add `allowedTools` field
  - [x] 9.4 Add `modeIcon` field
  - [x] 9.5 Add `modeColor` field
  - [x] 9.6 Listen for 'mode-changed' events from ModeManager
  - [x] 9.7 Update state when mode changes
  - [x] 9.8 Update allowed tools list when mode changes

- [x] 10. Update Context Section Display
  - [x] 10.1 Update `ContextSection.tsx` component
  - [x] 10.2 Display current mode with icon and color
  - [x] 10.3 Display current persona
  - [x] 10.4 Display allowed tools for current mode
  - [x] 10.5 Add visual indicator for auto-switch status
  - [x] 10.6 Add mode transition animation
  - [x] 10.7 Style mode display with appropriate colors

- [x] 11. Add Mode Commands
  - [x] 11.1 Create `modeCommands.ts` in commands directory
  - [x] 11.2 Implement `/mode assistant` command
  - [x] 11.3 Implement `/mode planning` command
  - [x] 11.4 Implement `/mode developer` command
  - [x] 11.5 Implement `/mode debugger` command
  - [x] 11.6 Implement `/mode security` command
  - [x] 11.7 Implement `/mode reviewer` command
  - [x] 11.8 Implement `/mode performance` command
  - [x] 11.9 Implement `/mode auto` command (enable auto-switching)
  - [x] 11.10 Implement `/mode status` command (show current mode)
  - [x] 11.11 Implement `/mode history` command (show mode transitions)
  - [x] 11.12 Register commands in command registry

---

### Phase 4: HotSwap Integration (1-2 hours)

- [x] 12. Update HotSwap Service
  - [x] 12.1 Update `HotSwapService.ts` constructor to accept ModeManager
  - [x] 12.2 Update `HotSwapService.ts` constructor to accept SnapshotManager
  - [x] 12.3 Update swap() to create transition snapshot before clearing
  - [x] 12.4 Update swap() to use ModeManager.updateSkills()
  - [x] 12.5 Update swap() to use ModeManager.buildPrompt()
  - [x] 12.6 Update swap() to emit 'mode-changed' event
  - [x] 12.7 Update swap() to default to developer mode for skills
  - [x] 12.8 Update swap() to store snapshot before context clear

- [x] 13. Update HotSwap Tool
  - [x] 13.1 Update `HotSwapTool.ts` to pass ModeManager to HotSwapService
  - [x] 13.2 Update `HotSwapTool.ts` to pass SnapshotManager to HotSwapService
  - [x] 13.3 Update tool description to mention mode switching
  - [x] 13.4 Update tool to handle mode restoration after swap

---

### Phase 5: Compression Integration (1-2 hours)

- [x] 14. Update Compression Service
  - [x] 14.1 Update `chatCompressionService.ts` to use STATE_SNAPSHOT_PROMPT
  - [x] 14.2 Implement XML snapshot generation for compression
  - [x] 14.3 Validate XML structure before compression
  - [x] 14.4 Parse and format XML snapshot
  - [x] 14.5 Emit 'compression-complete' event after compression

- [x] 15. Rebuild Prompt After Compression
  - [x] 15.1 Update `ContextManagerContext.tsx` to listen for 'compression-complete'
  - [x] 15.2 Rebuild prompt with ModeManager after compression
  - [x] 15.3 Preserve current mode after compression
  - [x] 15.4 Update system prompt in ContextManager

---

### Phase 6: Settings & Persistence (1-2 hours)

- [x] 16. Add Mode Settings
  - [x] 16.1 Update settings schema to include mode configuration
  - [x] 16.2 Add `prompt.mode` setting (auto | assistant | planning | developer | etc.)
  - [x] 16.3 Add `prompt.switching.enabled` setting
  - [x] 16.4 Add `prompt.switching.confidence_threshold` setting
  - [x] 16.5 Add `prompt.switching.min_duration` setting
  - [x] 16.6 Add `prompt.switching.cooldown` setting
  - [x] 16.7 Add per-mode enable/disable settings

- [ ] 17. Implement Mode Persistence
  - [x] 17.1 Save current mode to settings on mode change
  - [x] 17.2 Load mode preference on app start
  - [x] 17.3 Save auto-switch preference to settings
  - [x] 17.4 Load auto-switch preference on app start
  - [x] 17.5 Save mode history to session metadata
  - [x] 17.6 Restore mode history when resuming session

---

### Phase 7: Testing (3-4 hours)

- [x] 18. Unit Tests
  - [x] 18.1 Test ContextAnalyzer keyword detection
  - [x] 18.2 Test ContextAnalyzer confidence scoring
  - [x] 18.3 Test PromptModeManager mode transitions
  - [x] 18.4 Test PromptModeManager tool filtering
  - [x] 18.5 Test PromptModeManager hysteresis
  - [x] 18.6 Test PromptModeManager cooldown
  - [x] 18.7 Test SnapshotManager snapshot creation
  - [x] 18.8 Test SnapshotManager snapshot retrieval
  - [x] 18.9 Test SnapshotManager snapshot pruning
  - [x] 18.10 Test mode template rendering

- [x] 19. Integration Tests
  - [x] 19.1 Test mode switching flow (assistant → planning → developer)
  - [x] 19.2 Test specialized mode flow (developer → debugger → developer)
  - [x] 19.3 Test tool filtering in planning mode
  - [x] 19.4 Test HotSwap integration with mode system
  - [x] 19.5 Test compression integration with mode system
  - [x] 19.6 Test UI updates on mode change
  - [x] 19.7 Test snapshot restoration with findings
  - [x] 19.8 Test mode persistence across sessions

- [-] 20. Manual Testing
  - [ ] 20.1 Test assistant mode (general conversation)
  - [ ] 20.2 Test planning mode (research, read-only)
  - [ ] 20.3 Test developer mode (full implementation)
  - [ ] 20.4 Test tool mode (enhanced tool usage)
  - [ ] 20.5 Test debugger mode (error analysis)
  - [ ] 20.6 Test security mode (vulnerability detection)
  - [ ] 20.7 Test reviewer mode (code review)
  - [ ] 20.8 Test performance mode (optimization)
  - [ ] 20.9 Test automatic mode switching
  - [ ] 20.10 Test manual mode switching with commands
  - [ ] 20.11 Test tool restrictions in planning mode
  - [ ] 20.12 Test snapshot restoration after specialized mode
  - [ ] 20.13 Test UI display of current mode
  - [ ] 20.14 Test mode persistence across app restarts

---

### Phase 8: Enhancements - Additional Modes (3-4 hours)

- [~] 21. Create Prototype Mode
  - [ ] 21.1 Create `prototype.ts` mode template
  - [ ] 21.2 Add prototype mode to ModeType enum
  - [ ] 21.3 Configure tool access (all tools, no quality rules)
  - [ ] 21.4 Add keyword detection for prototype mode
  - [ ] 21.5 Add "// PROTOTYPE" comment injection
  - [ ] 21.6 Add suggestion to switch to planning/developer after success
  - [ ] 21.7 Write unit tests for prototype mode

- [~] 22. Create Teacher Mode
  - [ ] 22.1 Create `teacher.ts` mode template
  - [ ] 22.2 Add teacher mode to ModeType enum
  - [ ] 22.3 Configure tool access (read-only + web_search)
  - [ ] 22.4 Add keyword detection for teacher mode
  - [ ] 22.5 Implement teaching approach (analogies, examples, questions)
  - [ ] 22.6 Add suggestion to switch to developer after learning
  - [ ] 22.7 Write unit tests for teacher mode

---

### Phase 9: Enhancements - Mode Transition Suggestions (3-4 hours)

- [ ] 23. Implement Mode Transition Suggester
  - [ ] 23.1 Create `ModeTransitionSuggester.ts` class
  - [ ] 23.2 Implement suggestion logic for common transitions
  - [ ] 23.3 Add confidence scoring for suggestions
  - [ ] 23.4 Implement auto-switch vs ask-user logic
  - [ ] 23.5 Create UI component for suggestion display
  - [ ] 23.6 Add "Don't ask again" preference
  - [ ] 23.7 Write unit tests for suggester

---

### Phase 10: Enhancements - Mode Workflows (4-5 hours)

- [ ] 24. Implement Workflow System
  - [ ] 24.1 Create `WorkflowManager.ts` class
  - [ ] 24.2 Define workflow data structures
  - [ ] 24.3 Implement predefined workflows (feature_development, bug_fix, etc.)
  - [ ] 24.4 Add workflow progress tracking
  - [ ] 24.5 Implement workflow step transitions
  - [ ] 24.6 Create UI component for workflow display
  - [ ] 24.7 Add workflow commands (/workflow start, status, next, exit)
  - [ ] 24.8 Write unit tests for workflow system

---

### Phase 11: Enhancements - Mode Shortcuts (2-3 hours)

- [ ] 25. Implement Mode Shortcuts
  - [ ] 25.1 Define shortcut command mappings
  - [ ] 25.2 Implement mode switching shortcuts (/assist, /plan, /dev, etc.)
  - [ ] 25.3 Implement mode-specific action shortcuts
  - [ ] 25.4 Add /debug trace, reproduce, bisect commands
  - [ ] 25.5 Add /secure scan, audit, cve commands
  - [ ] 25.6 Add /review checklist, diff, quality commands
  - [ ] 25.7 Add /perf profile, benchmark, analyze commands
  - [ ] 25.8 Register all shortcuts in command registry
  - [ ] 25.9 Write unit tests for shortcuts

---

### Phase 12: Enhancements - Improved Planning Mode (2-3 hours)

- [ ] 26. Update Planning Mode Restrictions
  - [ ] 26.1 Define allowed file extensions for writing
  - [ ] 26.2 Define allowed directories for writing
  - [ ] 26.3 Implement file type validation in tool filter
  - [ ] 26.4 Implement directory validation in tool filter
  - [ ] 26.5 Update planning mode prompt template
  - [ ] 26.6 Add helpful error messages for restricted files
  - [ ] 26.7 Write unit tests for file restrictions

---

### Phase 13: Enhancements - Mode Confidence Display (2-3 hours)

- [ ] 27. Implement Confidence Display
  - [ ] 27.1 Update ActiveContextState with confidence fields
  - [ ] 27.2 Calculate confidence scores for all modes
  - [ ] 27.3 Track suggested modes with reasons
  - [ ] 27.4 Create UI component for confidence display
  - [ ] 27.5 Add visual confidence bars
  - [ ] 27.6 Update display on mode changes
  - [ ] 27.7 Write unit tests for confidence display

---

### Phase 14: Enhancements - Mode Metrics (3-4 hours)

- [ ] 28. Implement Mode Metrics Tracking
  - [ ] 28.1 Create `ModeMetricsTracker.ts` class
  - [ ] 28.2 Define metrics data structures
  - [ ] 28.3 Track mode entry/exit events
  - [ ] 28.4 Track mode-specific events (bugs found, fixes applied, etc.)
  - [ ] 28.5 Implement metrics aggregation
  - [ ] 28.6 Add metrics display to /mode status command
  - [ ] 28.7 Persist metrics to disk
  - [ ] 28.8 Write unit tests for metrics tracking

---

### Phase 15: Enhancements - Focus Mode (2-3 hours)

- [ ] 29. Implement Focus Mode
  - [ ] 29.1 Create `FocusModeManager.ts` class
  - [ ] 29.2 Implement focus mode enable/disable logic
  - [ ] 29.3 Implement mode switching prevention during focus
  - [ ] 29.4 Add focus mode timer with countdown
  - [ ] 29.5 Create UI component for focus mode display
  - [ ] 29.6 Add /mode focus commands
  - [ ] 29.7 Write unit tests for focus mode

---

### Phase 16: Enhancements - Hybrid Modes (4-5 hours)

- [ ] 30. Implement Hybrid Mode System
  - [ ] 30.1 Create `HybridModeManager.ts` class
  - [ ] 30.2 Implement mode combination logic
  - [ ] 30.3 Combine personas from multiple modes
  - [ ] 30.4 Combine tool access from multiple modes
  - [ ] 30.5 Combine prompts from multiple modes
  - [ ] 30.6 Define preset hybrid modes
  - [ ] 30.7 Add /mode hybrid commands
  - [ ] 30.8 Create UI component for hybrid mode display
  - [ ] 30.9 Write unit tests for hybrid modes

---

### Phase 17: Enhancements - Mode Memory (3-4 hours)

- [ ] 31. Implement Project Mode Preferences
  - [ ] 31.1 Create `ProjectModeMemory.ts` class
  - [ ] 31.2 Define project preferences data structure
  - [ ] 31.3 Implement preference loading from disk
  - [ ] 31.4 Implement preference saving to disk
  - [ ] 31.5 Add per-project mode thresholds
  - [ ] 31.6 Add per-project disabled modes
  - [ ] 31.7 Add per-project preferred workflows
  - [ ] 31.8 Load preferences on project open
  - [ ] 31.9 Write unit tests for mode memory

---

### Phase 18: Enhancements - Mode Transition Animations (2-3 hours)

- [ ] 32. Implement Transition Animations
  - [ ] 32.1 Create `ModeTransitionAnimator.ts` class
  - [ ] 32.2 Define animation data structures
  - [ ] 32.3 Implement transition message generation
  - [ ] 32.4 Create UI component for animations
  - [ ] 32.5 Add spinner/loading indicators
  - [ ] 32.6 Add mode-specific transition messages
  - [ ] 32.7 Write unit tests for animations

---

### Phase 19: RAG and Structured Output Integration (12-15 hours)

- [ ] 33. Setup LanceDB Infrastructure
  - [ ] 33.1 Add LanceDB dependency to package.json
  - [ ] 33.2 Add @xenova/transformers dependency
  - [ ] 33.3 Create `packages/core/src/rag/` directory
  - [ ] 33.4 Create `RAGSystem.ts` interface
  - [ ] 33.5 Create `LanceDBSetup.ts` class
  - [ ] 33.6 Implement database initialization
  - [ ] 33.7 Create tables for codebase index
  - [ ] 33.8 Create tables for mode-specific knowledge (debugger, security, performance, planning)
  - [ ] 33.9 Write unit tests for LanceDB setup

- [ ] 34. Implement Embedding Service
  - [ ] 34.1 Create `EmbeddingService.ts` interface
  - [ ] 34.2 Create `LocalEmbeddingService.ts` class
  - [ ] 34.3 Initialize embedding model (Xenova/all-MiniLM-L6-v2, 384-dim)
  - [ ] 34.4 Implement single text embedding
  - [ ] 34.5 Implement batch embedding
  - [ ] 34.6 Implement cosine similarity calculation
  - [ ] 34.7 Add embedding caching for performance
  - [ ] 34.8 Write unit tests for embedding service

- [ ] 35. Implement Codebase Index
  - [ ] 35.1 Create `CodebaseIndex.ts` class
  - [ ] 35.2 Implement workspace indexing with file watching
  - [ ] 35.3 Implement file chunking (512 tokens, 50 overlap)
  - [ ] 35.4 Implement incremental updates on file changes
  - [ ] 35.5 Implement semantic search with topK and threshold
  - [ ] 35.6 Respect .gitignore and exclude patterns
  - [ ] 35.7 Skip large files (configurable threshold)
  - [ ] 35.8 Implement index statistics and monitoring
  - [ ] 35.9 Write unit tests for codebase index

- [ ] 36. Implement LanceDB Vector Store
  - [ ] 36.1 Create `LanceDBVectorStore.ts` class
  - [ ] 36.2 Implement upsert operations (single and batch)
  - [ ] 36.3 Implement vector search with similarity scoring
  - [ ] 36.4 Implement delete operations
  - [ ] 36.5 Implement clear and count operations
  - [ ] 36.6 Add vector metadata storage
  - [ ] 36.7 Write unit tests for vector store

- [ ] 37. Implement Mode-Specific RAG Integration
  - [ ] 37.1 Create `ModeRAGIntegration.ts` class
  - [ ] 37.2 Implement context retrieval for debugger mode
  - [ ] 37.3 Implement context retrieval for security mode
  - [ ] 37.4 Implement context retrieval for performance mode
  - [ ] 37.5 Implement context retrieval for planning mode
  - [ ] 37.6 Implement knowledge indexing on mode exit
  - [ ] 37.7 Implement RAG context formatting for prompts
  - [ ] 37.8 Add RAG context injection to PromptModeManager
  - [ ] 37.9 Write unit tests for mode RAG integration

- [ ] 38. RAG Storage and Configuration
  - [ ] 38.1 Create storage directory structure (~/.ollm/rag/)
  - [ ] 38.2 Implement index persistence to disk
  - [ ] 38.3 Implement index cleanup/pruning
  - [ ] 38.4 Add RAG configuration to settings schema
  - [ ] 38.5 Implement RAG enable/disable toggle
  - [ ] 38.6 Add RAG statistics to /mode status command
  - [ ] 38.7 Write unit tests for storage and configuration

- [ ] 39. Implement Structured Output Service
  - [ ] 39.1 Create `packages/core/src/output/` directory
  - [ ] 39.2 Create `StructuredOutputService.ts` class
  - [ ] 39.3 Implement JSON schema validation with Ajv
  - [ ] 39.4 Implement generateWithSchema() with retry logic
  - [ ] 39.5 Implement extractJson() for mixed content
  - [ ] 39.6 Implement validation error formatting
  - [ ] 39.7 Add retry with exponential backoff
  - [ ] 39.8 Write unit tests for structured output service

- [ ] 40. Define Mode-Specific Schemas
  - [ ] 40.1 Create `MODE_OUTPUT_SCHEMAS` constant
  - [ ] 40.2 Define debugger mode schema (errors, rootCause, fixes)
  - [ ] 40.3 Define security mode schema (vulnerabilities, severity, recommendations)
  - [ ] 40.4 Define reviewer mode schema (issues, suggestions, positives)
  - [ ] 40.5 Define performance mode schema (bottlenecks, optimizations, estimatedImprovement)
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
  - [ ] 42.1 Update ProviderRequest interface to include responseFormat
  - [ ] 42.2 Implement ResponseFormat type (text | json | json_schema)
  - [ ] 42.3 Update provider adapters to support structured output
  - [ ] 42.4 Add fallback for providers without native support
  - [ ] 42.5 Test structured output with Ollama provider
  - [ ] 42.6 Write integration tests for provider structured output

---

### Phase 20: Documentation & Polish (1-2 hours)

- [ ] 43. Documentation
  - [ ] 43.1 Document all 10 modes (including prototype and teacher)
  - [ ] 43.2 Document mode workflows
  - [ ] 43.3 Document mode shortcuts
  - [ ] 43.4 Document focus mode and hybrid modes
  - [ ] 43.5 Document RAG integration
  - [ ] 43.6 Document structured output system
  - [ ] 43.7 Create user guide for all features
  - [ ] 43.8 Create developer guide for extending system
  - [ ] 43.9 Update CHANGELOG.md

- [ ] 44. Polish & Refinement
  - [ ] 44.1 Optimize keyword detection performance
  - [ ] 44.2 Optimize snapshot storage performance
  - [ ] 44.3 Optimize RAG search performance
  - [ ] 44.4 Optimize structured output validation
  - [ ] 44.5 Add error handling for all edge cases
  - [ ] 44.6 Add logging for all mode operations
  - [ ] 44.7 Add telemetry for mode usage (optional)
  - [ ] 44.8 Review and refactor code
  - [ ] 44.9 Final testing pass

---

## Estimated Timeline

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Core Infrastructure | 1-5 | 3-4 hours |
| Phase 2: Context Integration | 6-8 | 2-3 hours |
| Phase 3: UI Integration | 9-11 | 2-3 hours |
| Phase 4: HotSwap Integration | 12-13 | 1-2 hours |
| Phase 5: Compression Integration | 14-15 | 1-2 hours |
| Phase 6: Settings & Persistence | 16-17 | 1-2 hours |
| Phase 7: Testing | 18-20 | 3-4 hours |
| Phase 8: Additional Modes | 21-22 | 3-4 hours |
| Phase 9: Mode Suggestions | 23 | 3-4 hours |
| Phase 10: Mode Workflows | 24 | 4-5 hours |
| Phase 11: Mode Shortcuts | 25 | 2-3 hours |
| Phase 12: Improved Planning Mode | 26 | 2-3 hours |
| Phase 13: Confidence Display | 27 | 2-3 hours |
| Phase 14: Mode Metrics | 28 | 3-4 hours |
| Phase 15: Focus Mode | 29 | 2-3 hours |
| Phase 16: Hybrid Modes | 30 | 4-5 hours |
| Phase 17: Mode Memory | 31 | 3-4 hours |
| Phase 18: Transition Animations | 32 | 2-3 hours |
| Phase 19: RAG & Structured Output | 33-42 | 12-15 hours |
| Phase 20: Documentation & Polish | 43-44 | 1-2 hours |
| **Total** | **44 tasks** | **65-83 hours** |

---

## Implementation Strategy

### MVP (Minimum Viable Product) - 14-22 hours
**Phases 1-7:** Core system with 8 modes, auto-switching, tool filtering, UI integration

### Enhanced Version - 25-33 hours
**Phases 8-12:** Additional modes, suggestions, workflows, shortcuts, improved planning

### Advanced Version - 14-20 hours
**Phases 13-18:** Confidence display, metrics, focus mode, hybrid modes, animations

### Intelligence Layer - 12-15 hours
**Phase 19:** RAG with LanceDB, Structured Output with JSON schema enforcement

### Total Estimated Effort: 65-90 hours

---

## Success Criteria

### MVP - Must Have ✅
- [x] All 8 core modes implemented with correct personas and tool access
- [x] Automatic mode switching based on keywords
- [x] Tool filtering enforced (planning mode read-only for code)
- [x] UI displays current mode, persona, and allowed tools
- [x] Manual mode switching with `/mode` commands
- [x] HotSwap integration with mode system
- [x] Compression integration with XML snapshots
- [x] Mode-aware snapshots for specialized modes
- [x] Snapshot restoration with findings injection

### Enhanced - Should Have 🎯
- [x] Prototype and Teacher modes (10 total modes)
- [x] Mode transition suggestions
- [x] Mode workflows for common tasks
- [x] Mode-specific shortcuts
- [x] Planning mode can write docs/design files
- [x] Hysteresis prevents rapid mode switching (30s minimum)
- [x] Cooldown between mode switches (10s)
- [x] Mode history tracking (last 100 transitions)
- [x] Mode persistence across sessions

### Advanced - Nice to Have 💡
- [x] Mode confidence display in UI
- [x] Mode-specific metrics tracking
- [x] Focus mode prevents interruptions
- [x] Hybrid modes combine capabilities
- [x] Mode memory per project
- [x] Smooth transition animations

### Intelligence Layer - RAG & Structured Output 🚀
- [x] LanceDB setup and configuration
- [x] Embedding service with local model (all-MiniLM-L6-v2, 384-dim)
- [x] Codebase indexing with semantic search
- [x] Mode-specific knowledge bases (debugger, security, performance, planning)
- [x] RAG context injection on mode entry
- [x] Findings indexing on mode exit
- [x] Structured output service with JSON schema validation
- [x] Mode-specific output schemas (debugger, security, reviewer, performance)
- [x] Retry logic with exponential backoff
- [x] Provider integration for structured output

---

## Dependencies

### Required Before Starting
- ✅ SystemPromptBuilder exists
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
   - Mitigation: Extensive testing, gradual rollout
2. **Performance Impact** - Mode detection on every message
   - Mitigation: Optimize keyword matching, cache results

### Medium Risk 🟡
1. **UI Complexity** - More state to manage
   - Mitigation: Clear state management, good documentation
2. **User Confusion** - Understanding modes
   - Mitigation: Clear UI indicators, help text, examples

### Low Risk 🟢
1. **Backward Compatibility** - Old sessions still work
   - Mitigation: Default to assistant mode for old sessions

---

**Status:** Ready for implementation  
**Priority:** 🔴 CRITICAL  
**Estimated Completion:** 2-3 days of focused work
