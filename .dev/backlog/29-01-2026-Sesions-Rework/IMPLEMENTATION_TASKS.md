# Prompt Builder Polish - Implementation Task List

**Date:** 2026-01-30  
**Status:** Ready for Implementation  
**Goal:** Systematic implementation of prompt builder improvements

---

## Logic Chain Audit

### ✅ Dependencies Verified

1. **Template System** → Must exist before moving prompts
2. **Settings Structure** → Must be updated before UI changes
3. **USER Mode** → Can be done early (independent)
4. **Skills System** → Depends on template system
5. **Tools UI** → Depends on settings structure
6. **Test Command** → Should be done last (depends on all changes)

### ⚠️ Issues Found & Resolved

1. ~~**Task 4 (Skills System)** is too large~~ → **FIXED:** Split into 8 smaller tasks
2. ~~**Task 5 (Focused Files)** is independent~~ → **FIXED:** Already working, changed to workspace boundary context
3. ~~**Task 6 (USER Mode)** should be done earlier~~ → **FIXED:** Moved to Phase 1
4. ~~**Phase ordering** doesn't match dependencies~~ → **FIXED:** Reordered phases

### ✅ Corrected Implementation Order

```
Phase 1: Foundation (Templates & USER Mode)
Phase 2: Settings & Backend Logic
Phase 3: UI Changes
Phase 4: Integration & Testing
Phase 5: Polish & Documentation
```

---

## PHASE 1: Foundation (Templates & USER Mode)

### TASK 1.1: Remove Unused Identity Prompt
**Estimated Time:** 5 minutes  
**Dependencies:** None  
**Risk:** Low

**Actions:**
- [ ] Delete `packages/core/src/prompts/templates/identity.ts`
- [ ] Search for IDENTITY_PROMPT references
- [ ] Remove any imports/references
- [ ] Commit: "chore: remove unused identity prompt"

**Verification:**
```bash
npm run build
npm run lint
```

---

### TASK 1.2: Create System Templates Folder Structure
**Estimated Time:** 10 minutes  
**Dependencies:** None  
**Risk:** Low

**Actions:**
- [ ] Create `packages/core/src/prompts/templates/system/` folder
- [ ] Create `packages/core/src/prompts/templates/system/skills/` folder
- [ ] Verify folders are included in build (check esbuild config)
- [ ] Commit: "chore: create system templates folder structure"

**Verification:**
```bash
ls -la packages/core/src/prompts/templates/system/
ls -la packages/core/src/prompts/templates/system/skills/
```

---

### TASK 1.3: Move Core Mandates to Template
**Estimated Time:** 20 minutes  
**Dependencies:** TASK 1.2  
**Risk:** Medium

**Actions:**
- [ ] Create `packages/core/src/prompts/templates/system/CoreMandates.txt`
- [ ] Write improved content (~180 tokens):
  ```markdown
  # Core Mandates
  
  - **Conventions:** Follow existing project patterns (style, naming, structure). Analyze surrounding code before changes.
  - **Verification:** Never assume libraries exist. Check package.json or imports first.
  - **Integration:** Changes must fit naturally. Understand local context (imports, hierarchy).
  - **Comments:** Only explain "why", not "what". Be sparing.
  - **Scope:** Stay within request boundaries. Ask before significant additions.
  - **Output:** Be professional and concise. No filler ("Okay", "I will now").
  ```
- [ ] Update `SystemPromptBuilder.ts` to load from file
- [ ] Test loading works
- [ ] Delete `packages/core/src/prompts/templates/mandates.ts`
- [ ] Run budget validation: `npm run validate:prompts`
- [ ] Commit: "refactor: move core mandates to template file"

**Verification:**
```bash
npm run validate:prompts
# Should show reduced token count for mandates
```

---

### TASK 1.4: Move Sanity Checks to Template
**Estimated Time:** 15 minutes  
**Dependencies:** TASK 1.2  
**Risk:** Low

**Actions:**
- [ ] Create `packages/core/src/prompts/templates/system/SanityChecks.txt`
- [ ] Copy existing content from sanity.ts
- [ ] Verify `write_memory_dump` tool exists (check tool registry)
- [ ] Update `SystemPromptBuilder.ts` to load from file
- [ ] Delete `packages/core/src/prompts/templates/sanity.ts`
- [ ] Commit: "refactor: move sanity checks to template file"

**Verification:**
```bash
npm run build
npm run lint
```

---

### TASK 1.5: Enable Sanity Checks for Tier 1-2
**Estimated Time:** 10 minutes  
**Dependencies:** TASK 1.4  
**Risk:** Low

**Actions:**
- [ ] Update `PromptOrchestrator.ts`:
  ```typescript
  const useSanityChecks = tier <= ContextTier.TIER_2_BASIC;
  ```
- [ ] Test with Tier 1 model (should include sanity checks)
- [ ] Test with Tier 3 model (should NOT include sanity checks)
- [ ] Commit: "feat: enable sanity checks for tier 1-2"

**Verification:**
```bash
/test prompt
# Check if sanity checks appear for tier 1-2
```

---

### TASK 1.6: Enable USER Mode in System
**Estimated Time:** 30 minutes  
**Dependencies:** None  
**Risk:** Medium

**Actions:**
- [ ] Update `packages/core/src/context/types.ts`:
  ```typescript
  export enum OperationalMode {
    DEVELOPER = 'developer',
    PLANNING = 'planning',
    ASSISTANT = 'assistant',
    DEBUGGER = 'debugger',
    USER = 'user',  // NEW
  }
  ```
- [ ] Update `packages/core/src/prompts/PromptModeManager.ts`:
  - Add user to getAllowedTools() → `user: ['*']`
  - Add user to getDeniedTools() → `user: []`
- [ ] Find and update all ModeType definitions
- [ ] Verify TieredPromptStore loads user templates
- [ ] Test mode switching
- [ ] Commit: "feat: enable USER mode in system"

**Verification:**
```bash
npm run build
npm run lint
npm run test
```

---

### TASK 1.7: Add /user Command
**Estimated Time:** 15 minutes  
**Dependencies:** TASK 1.6  
**Risk:** Low

**Actions:**
- [ ] Update `packages/cli/src/commands/modeShortcuts.ts`
- [ ] Add `/user` command (copy from `/developer` and modify)
- [ ] Update command registry
- [ ] Update `/help` output
- [ ] Test command works
- [ ] Commit: "feat: add /user mode command"

**Verification:**
```bash
/user
# Should switch to user mode
/help
# Should show /user command
```

---

## PHASE 2: Settings & Backend Logic

### TASK 2.1: Update Settings Structure for Per-Mode Tools
**Estimated Time:** 30 minutes  
**Dependencies:** TASK 1.6 (USER mode)  
**Risk:** Medium

**Actions:**
- [ ] Update `packages/cli/src/config/settingsService.ts`:
  - Add `toolsByMode` to UserSettings interface
  - Add DEFAULT_TOOLS_BY_MODE constant (all 5 modes)
- [ ] Add migration logic for existing settings
- [ ] Test settings load/save
- [ ] Commit: "feat: add per-mode tool settings structure"

**Verification:**
```bash
# Check settings file
cat ~/.ollm/settings.json
# Should have toolsByMode structure
```

---

### TASK 2.2: Implement Settings Service Methods
**Estimated Time:** 45 minutes  
**Dependencies:** TASK 2.1  
**Risk:** Medium

**Actions:**
- [ ] Implement `getToolsForMode(mode: string): string[]`
- [ ] Implement `setToolForMode(mode: string, toolId: string, enabled: boolean): void`
- [ ] Implement `resetToolToDefaults(toolId: string): void`
- [ ] Write unit tests for new methods
- [ ] Test with all 5 modes
- [ ] Commit: "feat: implement per-mode tool settings methods"

**Verification:**
```bash
npm run test -- settingsService
```

---

### TASK 2.3: Create Mode-Specific Skill Templates
**Estimated Time:** 60 minutes  
**Dependencies:** TASK 1.2  
**Risk:** Low

**Actions:**
- [ ] Create `system/skills/SkillsDeveloper.txt` (~100 tokens)
- [ ] Create `system/skills/SkillsDebugger.txt` (~100 tokens)
- [ ] Create `system/skills/SkillsAssistant.txt` (~80 tokens)
- [ ] Create `system/skills/SkillsPlanning.txt` (~90 tokens)
- [ ] Create `system/skills/SkillsUser.txt` (~70 tokens)
- [ ] Run budget validation
- [ ] Commit: "feat: add mode-specific skill templates"

**Content Guidelines:**
- Focus on mode-specific knowledge/guidelines
- Keep concise (50-100 tokens each)
- No tool descriptions (that's separate)
- Explain HOW to approach tasks in that mode

**Verification:**
```bash
npm run validate:prompts
# Check token counts for each skill file
```

---

### TASK 2.4: Create Tool Descriptions Template
**Estimated Time:** 45 minutes  
**Dependencies:** TASK 1.2  
**Risk:** Low

**Actions:**
- [ ] Create `system/ToolDescriptions.txt`
- [ ] Document all built-in tools:
  - File operations (read_file, write_file, str_replace, etc.)
  - Search & discovery (grep_search, file_search, get_diagnostics)
  - Web access (web_search, web_fetch)
  - Git operations (git_diff, git_log, git_status)
  - Development (shell, write_memory_dump)
  - MCP tools (mcp:*)
- [ ] Add usage guidelines section
- [ ] Keep total under 400 tokens
- [ ] Run budget validation
- [ ] Commit: "feat: add tool descriptions template"

**Verification:**
```bash
npm run validate:prompts
wc -w packages/core/src/prompts/templates/system/ToolDescriptions.txt
```

---

### TASK 2.5: Update SystemPromptBuilder Interface
**Estimated Time:** 30 minutes  
**Dependencies:** TASK 2.3, TASK 2.4  
**Risk:** Medium

**Actions:**
- [ ] Update `SystemPromptConfig` interface:
  ```typescript
  export interface SystemPromptConfig {
    interactive: boolean;
    mode: string;                    // NEW
    tier: ContextTier;               // NEW
    modelSupportsTools: boolean;     // NEW
    allowedTools: string[];          // NEW
    useSanityChecks?: boolean;
    additionalInstructions?: string;
  }
  ```
- [ ] Update build() method signature
- [ ] Add loadTemplate() helper method
- [ ] Add templateExists() helper method
- [ ] Commit: "refactor: update SystemPromptBuilder interface"

**Verification:**
```bash
npm run build
npm run lint
```

---

### TASK 2.6: Implement Skills Loading in SystemPromptBuilder
**Estimated Time:** 30 minutes  
**Dependencies:** TASK 2.5  
**Risk:** Medium

**Actions:**
- [ ] Implement mode-specific skills loading:
  ```typescript
  const skillsFile = `system/skills/Skills${capitalize(config.mode)}.txt`;
  if (this.templateExists(skillsFile)) {
    sections.push(this.loadTemplate(skillsFile));
  }
  ```
- [ ] Test with each mode (developer, debugger, assistant, planning, user)
- [ ] Verify correct skills load for each mode
- [ ] Commit: "feat: implement mode-specific skills loading"

**Verification:**
```bash
/test prompt
# Check if correct skills appear for current mode
```

---

### TASK 2.7: Implement Tool Filtering Logic
**Estimated Time:** 60 minutes  
**Dependencies:** TASK 2.6  
**Risk:** High

**Actions:**
- [ ] Implement `buildToolsSection(allowedTools: string[]): string`
- [ ] Implement `filterToolDescriptions(fullText: string, allowedTools: string[]): string`
- [ ] Handle wildcard patterns ('*', 'mcp:*', 'git_*')
- [ ] Test filtering with different tool lists
- [ ] Write unit tests
- [ ] Commit: "feat: implement tool filtering logic"

**Algorithm:**
```typescript
filterToolDescriptions(fullText: string, allowedTools: string[]): string {
  // 1. Parse tool descriptions by section
  // 2. For each tool, check if in allowedTools
  // 3. Handle wildcards: '*' = all, 'mcp:*' = all MCP, 'git_*' = all git tools
  // 4. Keep section headers if any tools in section are allowed
  // 5. Return filtered markdown
}
```

**Verification:**
```bash
npm run test -- SystemPromptBuilder
```

---

### TASK 2.8: Update PromptOrchestrator Integration
**Estimated Time:** 45 minutes  
**Dependencies:** TASK 2.7, TASK 2.2  
**Risk:** High

**Actions:**
- [ ] Update `updateSystemPrompt()` method:
  - Check model tool support from profile
  - Get allowed tools from SettingsService
  - Pass correct parameters to SystemPromptBuilder
- [ ] Test with tool-capable model
- [ ] Test with non-tool model
- [ ] Test with each mode
- [ ] Commit: "feat: integrate tool filtering in prompt orchestrator"

**Verification:**
```bash
/test prompt
# Check if tools are filtered correctly per mode
```

---

## PHASE 3: UI Changes

### TASK 3.1: Update ToolsContext for Per-Mode Settings
**Estimated Time:** 45 minutes  
**Dependencies:** TASK 2.2  
**Risk:** Medium

**Actions:**
- [ ] Add `getModeSettings(toolId: string)` method
- [ ] Add `setModeSettings(toolId: string, mode: string, enabled: boolean)` method
- [ ] Add `resetToDefaults(toolId: string)` method
- [ ] Update context state management
- [ ] Test context methods
- [ ] Commit: "feat: add per-mode methods to ToolsContext"

**Verification:**
```bash
npm run build
npm run lint
```

---

### TASK 3.2: Create ToolModeSettings Component
**Estimated Time:** 90 minutes  
**Dependencies:** TASK 3.1  
**Risk:** High

**Actions:**
- [ ] Create `packages/cli/src/ui/components/tools/ToolModeSettings.tsx`
- [ ] Show all 5 modes with enable/disable toggles
- [ ] Implement keyboard navigation (↑/↓, Enter/Space)
- [ ] Show default vs customized indicator
- [ ] Add Apply and Reset buttons
- [ ] Style with theme colors
- [ ] Test component in isolation
- [ ] Commit: "feat: create ToolModeSettings component"

**Component Structure:**
```tsx
interface ToolModeSettingsProps {
  toolId: string;
  modeSettings: Record<string, boolean>;
  onToggle: (mode: string) => void;
  onApply: () => void;
  onReset: () => void;
  focused: boolean;
}
```

**Verification:**
```bash
npm run build
# Manual testing in UI
```

---

### TASK 3.3: Update ToolList Component (Read-Only)
**Estimated Time:** 30 minutes  
**Dependencies:** None  
**Risk:** Low

**Actions:**
- [ ] Remove toggle functionality from ToolList
- [ ] Change ✓ to • for items
- [ ] Make it navigation-only
- [ ] Keep category expand/collapse
- [ ] Update styling
- [ ] Commit: "refactor: make ToolList read-only navigation"

**Verification:**
```bash
npm run build
# Manual testing in UI
```

---

### TASK 3.4: Update ToolDetails Component
**Estimated Time:** 45 minutes  
**Dependencies:** TASK 3.2, TASK 3.3  
**Risk:** Medium

**Actions:**
- [ ] Add ToolModeSettings below description
- [ ] Handle Apply button (save to settings)
- [ ] Handle Reset button (restore defaults)
- [ ] Manage focus between description and mode settings
- [ ] Update layout and styling
- [ ] Commit: "feat: integrate ToolModeSettings in ToolDetails"

**Verification:**
```bash
npm run build
# Manual testing in UI
```

---

### TASK 3.5: Implement Keyboard Navigation
**Estimated Time:** 30 minutes  
**Dependencies:** TASK 3.4  
**Risk:** Medium

**Actions:**
- [ ] Tab: Switch between left/right panels
- [ ] ↑/↓: Navigate tools (left) or modes (right)
- [ ] Enter/Space: Toggle mode setting (right panel)
- [ ] A: Apply changes
- [ ] R: Reset to defaults
- [ ] Esc: Exit to nav bar
- [ ] Test all keyboard shortcuts
- [ ] Commit: "feat: implement keyboard navigation for tools UI"

**Verification:**
```bash
# Manual testing - try all keyboard shortcuts
```

---

### TASK 3.6: Update Mode Switcher UI
**Estimated Time:** 20 minutes  
**Dependencies:** TASK 1.6  
**Risk:** Low

**Actions:**
- [ ] Add "User" option to mode selector dropdown
- [ ] Update status bar mode display
- [ ] Update any mode-specific UI elements
- [ ] Test mode switching in UI
- [ ] Commit: "feat: add user mode to UI mode selector"

**Verification:**
```bash
# Manual testing - switch to user mode in UI
```

---

## PHASE 4: Integration & Testing

### TASK 4.1: Add Workspace Boundary Context
**Estimated Time:** 30 minutes  
**Dependencies:** TASK 2.8  
**Risk:** Low

**Note:** Focused files are already working and passed in prompt. We need to ensure LLM understands workspace boundaries.

**Actions:**
- [ ] Verify focused files are still passed correctly (don't break existing logic)
- [ ] Add workspace boundary explanation to system prompt:
  ```markdown
  # Workspace Context
  
  **Current Workspace:** {workspace_path}
  
  You are working within this workspace directory. All file operations should be relative to this workspace root unless explicitly specified otherwise.
  
  **Focused Files:** The following files have been focused for your reference:
  {list of focused files with relative paths}
  
  These files are particularly relevant to the current task.
  ```
- [ ] Update SystemPromptBuilder to accept workspace info
- [ ] Pass workspace path from ChatClient/PromptOrchestrator
- [ ] Test with focused files
- [ ] Test workspace path is shown correctly
- [ ] Commit: "feat: add workspace boundary context to prompt"

**Verification:**
```bash
# Focus on files in UI, then /test prompt
# Should show workspace path and focused files section
# Verify focused files still work as before
```

---

### TASK 4.2: Implement Project Rules Loader
**Estimated Time:** 45 minutes  
**Dependencies:** TASK 2.8  
**Risk:** Medium

**Actions:**
- [ ] Check if `.ollm/ollm.md` exists in workspace
- [ ] Load content if exists
- [ ] Pass to SystemPromptBuilder as `projectRules`
- [ ] Add to prompt after skills/sanity checks
- [ ] Test with project that has `.ollm/ollm.md`
- [ ] Test without `.ollm/ollm.md`
- [ ] Commit: "feat: load project rules from .ollm/ollm.md"

**Verification:**
```bash
# Create .ollm/ollm.md in test project
echo "# Project Rules\nTest rule" > .ollm/ollm.md
/test prompt
# Should show project rules section
```

---

### TASK 4.3: Test All Modes with Correct Tools
**Estimated Time:** 60 minutes  
**Dependencies:** TASK 2.8, TASK 3.6  
**Risk:** Medium

**Test Matrix:**
- [ ] Developer mode → All tools
- [ ] Debugger mode → All tools
- [ ] Assistant mode → read_file, web_search, web_fetch only
- [ ] Planning mode → Read-only + web tools
- [ ] User mode → All tools (default)

**Actions:**
- [ ] Switch to each mode
- [ ] Run `/test prompt`
- [ ] Verify correct tools shown
- [ ] Verify correct skills shown
- [ ] Test with tool-capable model
- [ ] Test with non-tool model
- [ ] Document results
- [ ] Commit: "test: verify all modes show correct tools"

**Verification:**
```bash
/developer
/test prompt
# Should show all tools

/assistant
/test prompt
# Should show only read_file, web_search, web_fetch
```

---

### TASK 4.4: Test Settings Persistence
**Estimated Time:** 30 minutes  
**Dependencies:** TASK 3.5  
**Risk:** Medium

**Actions:**
- [ ] Customize tool settings for each mode in UI
- [ ] Apply changes
- [ ] Restart application
- [ ] Verify settings persisted
- [ ] Test reset to defaults
- [ ] Verify defaults restored
- [ ] Commit: "test: verify settings persistence"

**Verification:**
```bash
# 1. Customize settings in UI
# 2. Check settings file
cat ~/.ollm/settings.json
# 3. Restart app
# 4. Verify settings still customized
```

---

### TASK 4.5: Run Budget Validation
**Estimated Time:** 15 minutes  
**Dependencies:** All template tasks  
**Risk:** Low

**Actions:**
- [ ] Run `npm run validate:prompts`
- [ ] Check all tiers pass validation
- [ ] Check for warnings (>90% budget)
- [ ] Document token counts
- [ ] If any failures, adjust templates
- [ ] Commit: "test: validate prompt budgets"

**Verification:**
```bash
npm run validate:prompts
# All tiers should pass
# No errors, warnings acceptable
```

---

### TASK 4.6: Update Unit Tests
**Estimated Time:** 90 minutes  
**Dependencies:** All backend tasks  
**Risk:** Medium

**Actions:**
- [ ] Update SystemPromptBuilder tests
- [ ] Update PromptOrchestrator tests
- [ ] Update SettingsService tests
- [ ] Add tests for tool filtering
- [ ] Add tests for skills loading
- [ ] Run full test suite
- [ ] Fix any failing tests
- [ ] Commit: "test: update unit tests for prompt builder changes"

**Verification:**
```bash
npm run test
# All tests should pass
```

---

## PHASE 5: Polish & Documentation

### TASK 5.1: Refactor /test prompt Command Output
**Estimated Time:** 90 minutes  
**Dependencies:** All previous tasks  
**Risk:** Medium

**Actions:**
- [ ] Create formatting helper functions
- [ ] Integrate theme colors from settings
- [ ] Format section headers with accent color
- [ ] Align labels consistently
- [ ] Add collapsible sections for --full flag
- [ ] Format budget validation output
- [ ] Test with different terminal widths
- [ ] Test with different themes
- [ ] Commit: "feat: refactor /test prompt output formatting"

**Sections to format:**
- Options (model, mode, context, GPU)
- Tier prompt
- Core Mandates
- Sanity Checks (if enabled)
- Skills (if any)
- Available Tools (with count)
- Hooks (if enabled)
- Rules
- Mock User Message (--full only)
- Ollama Payload (--full only)

**Verification:**
```bash
/test prompt
/test prompt --full
/test prompt --budget
# Check formatting looks good
```

---

### TASK 5.2: Update Documentation
**Estimated Time:** 60 minutes  
**Dependencies:** All previous tasks  
**Risk:** Low

**Actions:**
- [ ] Update `/help` command output
- [ ] Add user mode to mode descriptions
- [ ] Document per-mode tool settings
- [ ] Update README if needed
- [ ] Update CHANGELOG
- [ ] Commit: "docs: update documentation for prompt builder changes"

**Files to update:**
- `/help` command
- Mode documentation
- Tool settings documentation
- User guides

**Verification:**
```bash
/help
# Should show updated information
```

---

### TASK 5.3: Create Migration Guide
**Estimated Time:** 30 minutes  
**Dependencies:** All previous tasks  
**Risk:** Low

**Actions:**
- [ ] Document breaking changes (if any)
- [ ] Explain new features
- [ ] Provide migration steps for users with custom prompts
- [ ] Add to documentation
- [ ] Commit: "docs: add migration guide for prompt builder changes"

**Verification:**
- Review guide for completeness
- Test migration steps

---

### TASK 5.4: Final Integration Test
**Estimated Time:** 60 minutes  
**Dependencies:** All previous tasks  
**Risk:** Low

**Test Scenarios:**
- [ ] Fresh install → All defaults work
- [ ] Existing user → Settings migrate correctly
- [ ] Switch between all 5 modes → Correct prompts/tools
- [ ] Customize tool settings → Persists correctly
- [ ] Model without tool support → No tool descriptions
- [ ] Model with tool support → Filtered tools shown
- [ ] Focused files → Explanation appears
- [ ] Project with .ollm/ollm.md → Rules loaded
- [ ] Budget validation → All tiers pass
- [ ] /test prompt → Formatted correctly

**Actions:**
- [ ] Run through all test scenarios
- [ ] Document any issues found
- [ ] Fix issues
- [ ] Re-test
- [ ] Commit: "test: final integration testing"

**Verification:**
```bash
# Run through all scenarios manually
# Document results
```

---

## Summary

### Total Estimated Time
- Phase 1: ~2.5 hours
- Phase 2: ~6.5 hours
- Phase 3: ~4.5 hours
- Phase 4: ~5.5 hours
- Phase 5: ~4 hours
- **Total: ~23 hours** (3 days of focused work)

### Risk Assessment
- **High Risk Tasks:** 3 (Tool filtering, PromptOrchestrator, ToolModeSettings)
- **Medium Risk Tasks:** 12
- **Low Risk Tasks:** 15

### Critical Path
```
TASK 1.2 (Folder structure)
  ↓
TASK 1.3 (Core Mandates) + TASK 1.4 (Sanity Checks) + TASK 1.6 (USER Mode)
  ↓
TASK 2.1 (Settings structure)
  ↓
TASK 2.2 (Settings methods)
  ↓
TASK 2.3 (Skills) + TASK 2.4 (Tool Descriptions)
  ↓
TASK 2.5-2.8 (SystemPromptBuilder + PromptOrchestrator)
  ↓
TASK 3.1-3.6 (UI Changes)
  ↓
TASK 4.1-4.6 (Integration & Testing)
  ↓
TASK 5.1-5.4 (Polish & Documentation)
```

### Success Metrics
- [ ] All prompt components in template files
- [ ] Core Mandates reduced to ~180 tokens
- [ ] Sanity checks enabled for Tier 1-2
- [ ] All 5 modes working (including USER)
- [ ] Per-mode tool settings functional
- [ ] UI redesign complete and tested
- [ ] All tests passing
- [ ] Budget validation passing
- [ ] Documentation updated
- [ ] Zero regressions

---

## Next Steps

1. Review this task list with team
2. Confirm task order and dependencies
3. Start with Phase 1 (Foundation)
4. Complete each task in order
5. Test thoroughly after each phase
6. Document any issues or changes needed

---

**Ready to start implementation!**
