# Tool Support Detection - Implementation Tasks

**Feature:** Robust tool support detection and filtering for model hot-swapping  
**Status:** Ready for Implementation  
**Created:** 2026-01-17

## Task List

### Phase 1: Data Model & Infrastructure

- [x] 1. Enhance user_models.json schema
  - [x] 1.1 Add `tool_support_source` field (string: 'profile' | 'user_confirmed' | 'auto_detected' | 'runtime_error')
  - [x] 1.2 Add `tool_support_confirmed_at` field (ISO timestamp)
  - [x] 1.3 Update TypeScript types in `packages/cli/src/config/types.ts`
  - [x] 1.4 Add migration logic to handle existing user_models.json files

- [x] 2. Create UserPromptContext
  - [x] 2.1 Create `packages/cli/src/features/context/UserPromptContext.tsx`
  - [x] 2.2 Implement promptUser() function with Promise-based API
  - [x] 2.3 Create UserPromptDialog component for rendering prompts
  - [x] 2.4 Integrate into App.tsx provider tree

### Phase 2: ModelContext Enhancements
- [x] 3. Enhanced tool support override tracking
  - [x] 3.1 Update toolSupportOverridesRef to store source and timestamp
  - [x] 3.2 Add helper function to check override precedence
  - [x] 3.3 Expose modelSupportsTools() in ModelContextValue interface

- [x] 4. Proactive tool support detection on model swap
  - [x] 4.1 Update setModelAndLoading() to check ProfileManager
  - [x] 4.2 Set proactive override for known non-tool models
  - [x] 4.3 Add system message showing tool support status
  - [x] 4.4 Handle unknown models with user prompt

- [x] 5. Unknown model handling
  - [x] 5.1 Add unknownModelPrompt state
  - [x] 5.2 Implement prompt flow: "Does this model support tools? (y/n/auto-detect)"
  - [x] 5.3 Add 30s timeout with safe default
  - [x] 5.4 Save user choice to user_models.json

- [x] 6. Auto-detect tool support
  - [x] 6.1 Implement autoDetectToolSupport() function
  - [x] 6.2 Send test request with minimal tool schema
  - [x] 6.3 Detect tool errors vs success
  - [x] 6.4 Add 5s timeout for auto-detect
  - [x] 6.5 Save result to user_models.json with source='auto_detected'

- [x] 7. Runtime learning with user confirmation
  - [x] 7.1 Implement handleToolError() callback
  - [x] 7.2 Detect tool unsupported errors from provider
  - [x] 7.3 Prompt user: "Update metadata? (y/n)"
  - [x] 7.4 Save to user_models.json if confirmed (source='user_confirmed')
  - [x] 7.5 Set session-only override if declined

- [x] 8. Metadata persistence
  - [x] 8.1 Implement saveToolSupport() function
  - [x] 8.2 Update existing user model entry or create new
  - [x] 8.3 Preserve other user overrides (manual_context, etc.)
  - [x] 8.4 Call ProfileManager.setUserModels() to persist

### Phase 3: ChatContext Enhancements
- [x] 9. Conditional tool registry creation
  - [x] 9.1 Check modelSupportsTools() before creating ToolRegistry
  - [x] 9.2 Only register tools if model supports them
  - [x] 9.3 Pass undefined for toolSchemas if tools disabled

- [x] 10. System prompt modification
  - [x] 10.1 Add note to system prompt when tools disabled
  - [x] 10.2 Note text: "This model does not support function calling. Do not attempt to use tools or make tool calls."
  - [x] 10.3 Ensure note is added before sending to LLM

- [x] 11. Graceful agent loop handling
  - [x] 11.1 Track initial model at start of agent loop
  - [x] 11.2 Detect model change mid-loop
  - [x] 11.3 Complete current turn if model changed
  - [x] 11.4 Add system message about transition

### Phase 4: ProfileManager Enhancements
- [x] 12. Startup metadata refresh
  - [x] 12.1 Add refreshMetadataAsync() method
  - [x] 12.2 Call on ProfileManager construction (async, non-blocking)
  - [x] 12.3 Query Ollama for installed models (2s timeout)
  - [x] 12.4 Update user_models.json preserving user overrides
  - [x] 12.5 Handle errors gracefully (silent fail)

- [x] 13. Enhanced updateUserModelsFromList()
  - [x] 13.1 Preserve tool_support_source when updating
  - [x] 13.2 Preserve tool_support_confirmed_at when updating
  - [x] 13.3 Don't override user_confirmed tool support

### Phase 5: Provider Integration
- [x] 14. Enhanced error detection in LocalProvider
  - [x] 14.1 Return detailed error events for tool errors
  - [x] 14.2 Include error type/code in ProviderEvent
  - [x] 14.3 Ensure existing retry logic still works

- [x] 15. Error propagation to ModelContext
  - [x] 15.1 Pass tool errors to handleToolError() callback
  - [x] 15.2 Include model name in error context
  - [x] 15.3 Debounce repeated errors (don't prompt multiple times)

### Phase 6: UI Components
- [x] 16. UserPromptDialog component
  - [x] 16.1 Create dialog component with Ink
  - [x] 16.2 Show message and options
  - [x] 16.3 Handle keyboard input (y/n/a for auto)
  - [x] 16.4 Support timeout with default choice

- [x] 17. System messages
  - [x] 17.1 Add helper for adding system messages to chat
  - [x] 17.2 Format tool support status messages
  - [x] 17.3 Format auto-detect progress messages

### Phase 7: Testing & Validation
- [ ] 18. Core unit tests
  - [ ] 18.1 Test modelSupportsTools() with various scenarios
  - [ ] 18.2 Test override precedence logic
  - [ ] 18.3 Test saveToolSupport() persistence
  - [ ] 18.4 Test system prompt modification

- [ ] 19. Property-based tests (critical correctness properties)
  - [ ] 19.1 Property: Tools never sent to non-supporting models
    - **Validates: Core safety requirement**
  - [ ] 19.2 Property: Unknown models always prompt or use safe default
    - **Validates: Safe defaults requirement**
  - [ ] 19.3 Property: Metadata persistence is consistent
    - **Validates: Data integrity requirement**
  - [ ] 19.4 Property: Override precedence is correct
    - **Validates: Configuration precedence requirement**

- [ ] 20. Checkpoint - Run focused tests after Phase 6 completion
  - Run unit tests for Phases 1-6
  - Run property-based tests
  - Fix any failures before proceeding to Phase 8

### Phase 8: Interactive Tools Panel (UI)
- [ ] 21. Tool configuration data layer
  - [ ] 21.1 Create default tool registry in `packages/cli/src/config/toolsConfig.ts`
  - [ ] 21.2 Define all 15 tools with metadata (id, displayName, category, description, docLink, risk)
  - [ ] 21.3 Add `tools` field to settings.json schema (map of toolId -> enabled boolean)
  - [ ] 21.4 Implement getToolState(toolId) in SettingsService (default: true)
  - [ ] 21.5 Implement setToolState(toolId, enabled) in SettingsService

- [ ] 22. Tool filtering integration
  - [ ] 22.1 Update ToolRegistry.getFunctionSchemas() to filter by enabled state
  - [ ] 22.2 Two-stage filtering: (1) model capability check, (2) user preference check
  - [ ] 22.3 Add getEnabledTools() helper function
  - [ ] 22.4 Ensure disabled tools are never exposed to LLM

- [ ] 23. ToolsPanel UI components
  - [ ] 23.1 Create `packages/cli/src/ui/components/tools/ToolsPanel.tsx`
  - [ ] 23.2 Create `packages/cli/src/ui/components/tools/CategorySection.tsx`
  - [ ] 23.3 Create `packages/cli/src/ui/components/tools/ToolItem.tsx`
  - [ ] 23.4 Create `packages/cli/src/ui/components/tools/ToolToggle.tsx`
  - [ ] 23.5 Implement windowed rendering for scrolling (like menu system)

- [ ] 24. Tools Panel navigation
  - [ ] 24.1 Add 'tools-panel' to FocusableId in FocusContext
  - [ ] 24.2 Register keyboard shortcuts: up/down (navigate), left/right/enter (toggle)
  - [ ] 24.3 Implement focus state handling and visual indicators
  - [ ] 24.4 Add help footer showing keyboard shortcuts

- [ ] 25. ToolsTab integration
  - [ ] 25.1 Replace ToolsTab content with ToolsPanel component
  - [ ] 25.2 Show tool count and enabled/disabled status
  - [ ] 25.3 Display categories: File Operations, File Discovery, Shell, Web, Memory, Context
  - [ ] 25.4 Show "Model doesn't support tools" message when applicable

- [ ] 26. Checkpoint - Run full test suite after Tools Panel completion
  - Run all unit tests
  - Run all property-based tests
  - Run integration tests for Tools Panel
  - Verify UI rendering and navigation

### Phase 9: Documentation & Cleanup
- [ ] 27. Update documentation
  - [ ] 27.1 Update model database docs with new fields
  - [ ] 27.2 Add user guide for unknown model handling
  - [ ] 27.3 Document auto-detect behavior
  - [ ] 27.4 Add Tools Panel user guide
  - [ ] 27.5 Document tool enable/disable persistence
  - [ ] 27.6 Add troubleshooting section

- [ ] 28. Code cleanup
  - [ ] 28.1 Remove debug logging
  - [ ] 28.2 Add JSDoc comments to new functions
  - [ ] 28.3 Ensure TypeScript strict mode compliance
  - [ ] 28.4 Run linter and fix warnings

- [ ] 29. Final validation checkpoint
  - [ ] 29.1 Run complete test suite
  - [ ] 29.2 Verify all success criteria met
  - [ ] 29.3 Update bugtracker with resolution
  - [ ] 29.4 Mark feature as complete

## Task Dependencies

```
Phase 1 (Data Model)
  ↓
Phase 2 (ModelContext) + Phase 4 (ProfileManager)
  ↓
Phase 3 (ChatContext) + Phase 5 (Provider)
  ↓
Phase 6 (UI Components - Prompts)
  ↓
Phase 7 (Testing)
  ↓
Phase 8 (Tools Panel UI) ← Can be done in parallel with Phase 7
  ↓
Phase 9 (Documentation)
```

## Estimated Effort

- Phase 1: 2 hours
- Phase 2: 4 hours
- Phase 3: 2 hours
- Phase 4: 2 hours
- Phase 5: 1 hour
- Phase 6: 2 hours
- Phase 7: 4 hours
- Phase 8: 6 hours (Tools Panel UI)
- Phase 9: 2 hours

**Total: ~25 hours** (3-4 days)

## Risk Assessment

- **Low Risk:** Data model changes (backward compatible)
- **Medium Risk:** ModelContext changes (well-isolated)
- **Low Risk:** ChatContext changes (conditional logic)
- **Low Risk:** ProfileManager changes (async, non-blocking)
- **Medium Risk:** User prompt flow (new UI pattern)

## Success Criteria

- [ ] Zero tool-related errors after model swap
- [ ] Unknown models prompt user or use safe default
- [ ] Runtime learning saves metadata with user confirmation
- [ ] Tools Panel displays all 15 tools organized by 6 categories
- [ ] User can enable/disable individual tools via keyboard navigation
- [ ] Tool enable/disable state persists in ~/.ollm/settings.json
- [ ] Disabled tools are never exposed to LLM (global filter)
- [ ] Two-stage filtering: model capability + user preference
- [ ] All tests pass (unit, integration, property-based)
- [ ] No performance regression on model swap
- [ ] Documentation updated and complete

## Notes

- Implement phases sequentially to maintain stability
- Test each phase before moving to next
- Keep existing provider-level retry as safety net
- User confirmation required before persisting metadata
- Safe defaults throughout (tool_support: false for unknown)
- **Tools Panel**: Global user preferences stored in settings.json
- **Two-stage filtering**: (1) Model capability check → (2) User preference check
- **Default tool registry**: Source of truth for all 15 tools with metadata
- **Phase 8 (Tools Panel)**: Can be implemented in parallel with Phase 7 (Testing)
- **Settings location**: `~/.ollm/settings.json` (Windows: `C:\Users\<user>\.ollm\settings.json`)
