# Documentation Reorganization Plan

**Created:** January 27, 2026  
**Purpose:** Organize documentation with clear naming conventions and remove duplicates

---

## Naming Convention

**Format:** `dev_<CategoryTopic>.md` (no underscore between words in topic)

**Examples:**
- `dev_ContextManagement.md` (NOT dev_Context_Management.md)
- `dev_SessionStorage.md` (NOT dev_Session_Storage.md)
- `dev_CheckpointAging.md` (already correct)

**Categories:**
- `Context` - Context management, compression, checkpoints
- `Session` - Session recording, storage, snapshots
- `Input` - Input processing, preprocessing
- `Snapshot` - Snapshot systems

---

## Files to Reorganize (Focus Group)

### Context Management Group (7 files)
1. `dev_CheckpointAging.md` → **Keep as is** ✅
2. `dev_CheckpointRollover.md` → **Keep as is** ✅
3. `dev_ContextCompression.md` → **Keep as is** ✅
4. `dev_ContextManagement.md` → **Keep as is** ✅
5. `dev_PreSendValidation.md` → `dev_ContextPreSendValidation.md`
6. `dev_Tokeniser.md` → `dev_ContextTokeniser.md`
7. `dev_SnapshotSystems.md` → `dev_ContextSnapshots.md`

### Input Processing Group (1 file)
1. `dev_InputPreprocessing.md` → **Keep as is** ✅

### Session Management Group (3 files)
1. `dev_SessionRecording.md` → **DELETE** (duplicate of SessionStorage.md)
2. `dev_SessionStorage.md` → **Keep as is** ✅
3. `dev_SessionsCompressionSummary.md` → **DELETE** (duplicate, keep in SESSIONS_WORK_COMPLETE.md)

### Other Files (Keep as is)
1. `dev_PromptSystem.md` → **Keep as is** ✅
2. `dev_ProviderSystem.md` → **Keep as is** ✅

---

## Actions Summary

**Rename (3 files):**
- `dev_PreSendValidation.md` → `dev_ContextPreSendValidation.md`
- `dev_Tokeniser.md` → `dev_ContextTokeniser.md`
- `dev_SnapshotSystems.md` → `dev_ContextSnapshots.md`

**Delete (2 files):**
- `dev_SessionRecording.md` (duplicate)
- `dev_SessionsCompressionSummary.md` (duplicate)

**Keep as is (8 files):**
- dev_CheckpointAging.md
- dev_CheckpointRollover.md
- dev_ContextCompression.md
- dev_ContextManagement.md
- dev_InputPreprocessing.md
- dev_SessionStorage.md
- dev_PromptSystem.md
- dev_ProviderSystem.md

---

## Duplicate Content to Remove

### 1. dev_SessionRecording.md
**Status:** Duplicate of dev_SessionStorage.md  
**Action:** DELETE  
**Reason:** Both cover the same ChatRecordingService

### 2. dev_SessionsCompressionSummary.md
**Status:** Summary document  
**Action:** DELETE (keep content in SESSIONS_WORK_COMPLETE.md)  
**Reason:** Duplicate summary, main summary is in .dev/docs/SESSIONS_WORK_COMPLETE.md

---

## Content Consolidation

### Context Management Documents

**Keep Separate (Each has unique focus):**
- `dev_Context_Management.md` - Overall context management architecture
- `dev_Context_Compression.md` - Compression strategies and algorithms
- `dev_Context_CheckpointAging.md` - Checkpoint aging system (Phase 6)
- `dev_Context_CheckpointRollover.md` - Rollover strategy and emergency handling
- `dev_Context_PreSendValidation.md` - Pre-send validation (Phase 1)
- `dev_Context_Tokeniser.md` - Token counting system
- `dev_Context_Snapshots.md` - Two snapshot systems (Phase 5)

**Add Cross-References:**
Each document should reference related documents at the top.

### Session Management Documents

**Keep:**
- `dev_Session_Storage.md` - Session storage system (Phase 4)

**Delete:**
- `dev_SessionRecording.md` - Duplicate content

---

## New Index Document

Create `dev_INDEX.md` as the main entry point with:
- Overview of all documentation
- Quick links to each category
- Brief description of each document
- Recommended reading order for new developers

---

## Cross-Reference Template

Add to the top of each document:

```markdown
**Related Documentation:**
- [Context Management](./dev_Context_Management.md) - Overview
- [Compression](./dev_Context_Compression.md) - Compression strategies
- [Checkpoints](./dev_Context_CheckpointAging.md) - Checkpoint aging
```

---

## Implementation Steps

1. ✅ Create this reorganization plan
2. [ ] Create dev_INDEX.md
3. [ ] Rename files following new convention
4. [ ] Delete duplicate files
5. [ ] Add cross-references to each document
6. [ ] Update references in other files (.dev/backlog/, etc.)
7. [ ] Verify all links work
8. [ ] Commit changes

---

## File Rename Map

```
# Context Management
dev_CheckpointAging.md → dev_Context_CheckpointAging.md
dev_CheckpointRollover.md → dev_Context_CheckpointRollover.md
dev_ContextCompression.md → dev_Context_Compression.md
dev_ContextManagement.md → dev_Context_Management.md
dev_PreSendValidation.md → dev_Context_PreSendValidation.md
dev_Tokeniser.md → dev_Context_Tokeniser.md
dev_SnapshotSystems.md → dev_Context_Snapshots.md

# Input Processing
dev_InputPreprocessing.md → dev_Input_Preprocessing.md

# Session Management
dev_SessionStorage.md → dev_Session_Storage.md
dev_SessionRecording.md → DELETE
dev_SessionsCompressionSummary.md → DELETE

# Model Management
dev_ModelCompiler.md → dev_Model_Compiler.md
dev_ModelManagement.md → dev_Model_Management.md
dev_ModelReasoning.md → dev_Model_Reasoning.md

# Prompt System
dev_PromptSystem.md → dev_Prompt_System.md

# Provider System
dev_ProviderSystem.md → dev_Provider_System.md

# Hook System
dev_HookSystem.md → dev_Hook_System.md

# MCP Integration
dev_MCPIntegration.md → dev_MCP_Integration.md

# Tool Execution
dev_ToolExecution.md → dev_Tool_Execution.md

# UI
dev_UI_Front.md → dev_UI_Frontend.md
# (others keep as is)

# System
dev_Keybinds.md → dev_System_Keybinds.md
dev_SlashCommands.md → dev_System_SlashCommands.md
dev_Terminal.md → dev_System_Terminal.md
dev_npm_package.md → dev_System_NpmPackage.md
```

---

## Expected Result

**Before:** 27 files, some duplicates, inconsistent naming  
**After:** 24 files, no duplicates, clear naming convention, cross-referenced

**Benefits:**
- Easy to find related documents
- Clear categorization
- No duplicate content
- Cross-references for navigation
- Index document for overview

