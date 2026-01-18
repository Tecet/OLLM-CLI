# Hooks Panel UI - Implementation Tasks

**Feature:** Interactive UI for viewing and managing hooks  
**Status:** Not Started  
**Created:** 2026-01-17

## Task List

### Phase 1: Data Layer (3-4 hours)

- [ ] 1.1 Create HooksContext with state management
  - Create `packages/cli/src/ui/contexts/HooksContext.tsx`
  - Implement hook loading from HookRegistry
  - Add enabled state management from SettingsService
  - Create hook categorization logic
  - Add error handling for corrupted hooks

- [ ] 1.2 Create HookFileService for file operations
  - Create `packages/cli/src/services/hookFileService.ts`
  - Implement loadUserHooks() method
  - Implement saveHook() method
  - Implement updateHook() method
  - Implement deleteHook() method
  - Add hook validation logic

- [ ] 1.3 Enhance SettingsService for hooks
  - Update `packages/cli/src/config/settingsService.ts`
  - Add getHookSettings() method
  - Add setHookEnabled() method
  - Add removeHookSetting() method
  - Ensure settings persist correctly

- [ ] 1.4 Enhance HookRegistry for UI integration
  - Update `packages/core/src/hooks/hookRegistry.ts`
  - Add getHooksByCategory() method
  - Add getUserHooks() method
  - Add getBuiltinHooks() method
  - Add isEditable() and isDeletable() methods

### Phase 2: UI Components (4-5 hours)

- [ ] 2.1 Create HooksTab component
  - Create `packages/cli/src/ui/components/tabs/HooksTab.tsx`
  - Implement main container layout
  - Add loading and error states
  - Integrate with HooksContext
  - Add dialog state management

- [ ] 2.2 Create HookCategory component
  - Create `packages/cli/src/ui/components/hooks/HookCategory.tsx`
  - Implement collapsible category header
  - Add expand/collapse functionality
  - Show hook count per category
  - Add focus state styling

- [ ] 2.3 Create HookItem component
  - Create `packages/cli/src/ui/components/hooks/HookItem.tsx`
  - Implement hook display with toggle
  - Add enabled/disabled visual indicators
  - Show hook name and description
  - Add focus state styling

- [ ] 2.4 Create HookDetails component
  - Create `packages/cli/src/ui/components/hooks/HookDetails.tsx`
  - Display trigger conditions
  - Display action details
  - Show source and trusted status
  - Format patterns and commands

- [ ] 2.5 Create HookActions component
  - Create `packages/cli/src/ui/components/hooks/HookActions.tsx`
  - Display keyboard shortcuts (A/E/D/T)
  - Show action descriptions
  - Handle action button presses

### Phase 3: Navigation & Focus (2-3 hours)

- [ ] 3.1 Create useHookNavigation hook
  - Create `packages/cli/src/ui/hooks/useHookNavigation.ts`
  - Implement up/down navigation
  - Implement left/right toggle
  - Implement Enter for expand/collapse
  - Track focused index and expanded categories

- [ ] 3.2 Implement keyboard event handling
  - Add keyboard listener in HooksTab
  - Handle arrow keys for navigation
  - Handle action keys (A/E/D/T)
  - Handle Tab for returning to main nav
  - Handle Esc for closing dialogs

- [ ] 3.3 Add focus management
  - Implement focus indicator styling
  - Handle focus transitions
  - Ensure focus stays visible during scrolling
  - Add focus restoration after dialogs

### Phase 4: Dialog Components (4-5 hours)

- [ ] 4.1 Create AddHookDialog component
  - Create `packages/cli/src/ui/components/dialogs/AddHookDialog.tsx`
  - Implement form fields (name, description, event type, etc.)
  - Add form validation
  - Handle conditional fields (patterns for file events)
  - Implement save and cancel actions

- [ ] 4.2 Create EditHookDialog component
  - Create `packages/cli/src/ui/components/dialogs/EditHookDialog.tsx`
  - Pre-populate form with existing values
  - Reuse form validation from AddHookDialog
  - Handle built-in hook protection
  - Implement save and cancel actions

- [ ] 4.3 Create DeleteConfirmationDialog component
  - Create `packages/cli/src/ui/components/dialogs/DeleteConfirmationDialog.tsx`
  - Show hook name and warning message
  - Implement confirm and cancel buttons
  - Handle built-in hook protection
  - Add visual warning styling

- [ ] 4.4 Create TestHookDialog component
  - Create `packages/cli/src/ui/components/dialogs/TestHookDialog.tsx`
  - Implement hook test simulation
  - Display test progress and results
  - Show success/failure indicators
  - Add close button

- [ ] 4.5 Create shared form components
  - Create `packages/cli/src/ui/components/forms/FormField.tsx`
  - Create `packages/cli/src/ui/components/forms/SelectField.tsx`
  - Create `packages/cli/src/ui/components/forms/Button.tsx`
  - Add validation error display
  - Ensure consistent styling

### Phase 5: Integration & Testing (3-4 hours)

- [ ] 5.1 Integrate HooksTab with App
  - Update `packages/cli/src/ui/App.tsx`
  - Add HooksContext provider
  - Wire up hooks tab to main app

- [ ] 5.2 Add Hooks tab to TabBar
  - Update `packages/cli/src/ui/components/layout/TabBar.tsx`
  - Add Hooks tab to navigation
  - Ensure proper tab ordering
  - Test tab switching

- [ ] 5.3 Checkpoint - Run focused tests after UI implementation
  - Run unit tests for components
  - Test hook rendering and toggle functionality
  - Test dialog opening/closing
  - Test keyboard navigation
  - Fix any failures before proceeding

- [ ] 5.4 Property-based tests (critical correctness properties)
  - [ ] 5.4.1 Property: Toggle idempotency
    - **Validates: Enable/disable consistency**
  - [ ] 5.4.2 Property: Hook validation
    - **Validates: Configuration safety**
  - [ ] 5.4.3 Property: File persistence
    - **Validates: Data integrity**
  - [ ] 5.4.4 Property: Settings persistence
    - **Validates: State consistency**

### Phase 6: Polish & Documentation (2-3 hours)

- [ ] 6.1 Add loading states
  - Show spinner during hook loading
  - Show spinner during file operations
  - Add progress indicators for async operations

- [ ] 6.2 Improve error handling
  - Add user-friendly error messages
  - Handle file write errors gracefully
  - Handle corrupted hook files
  - Add error recovery options

- [ ] 6.3 Add visual polish
  - Improve color scheme for enabled/disabled
  - Add hover effects (if applicable)
  - Ensure consistent spacing
  - Add icons for actions

- [ ] 6.4 Performance optimization
  - Implement windowed rendering for large lists
  - Add debouncing for file operations
  - Optimize re-renders with memoization
  - Test with 50+ hooks

- [ ] 6.5 Update documentation
  - Update hooks user guide
  - Add screenshots/examples
  - Document keyboard shortcuts
  - Add troubleshooting section

- [ ] 6.6 Final validation checkpoint
  - Run complete test suite
  - Verify all success criteria met
  - Test with 50+ hooks for performance
  - Mark feature as complete

## Estimated Effort

**Total: 18-24 hours**

- Phase 1 (Data Layer): 3-4 hours
- Phase 2 (UI Components): 4-5 hours
- Phase 3 (Navigation): 2-3 hours
- Phase 4 (Dialogs): 4-5 hours
- Phase 5 (Integration): 3-4 hours
- Phase 6 (Polish): 2-3 hours

## Dependencies

- Stage-05 (Hook System) must be complete
- Stage-08b (Tools Panel) provides navigation patterns
- Stage-06 (CLI UI) provides base components

## Success Criteria

- [ ] All hooks displayed organized by category
- [ ] Enable/disable hooks with keyboard (left/right arrows)
- [ ] Add new custom hooks through UI
- [ ] Edit existing user hooks
- [ ] Delete user hooks with confirmation
- [ ] Test hooks before enabling
- [ ] Settings persist across sessions
- [ ] Keyboard navigation works smoothly
- [ ] Visual feedback for all actions
- [ ] No performance issues with 50+ hooks
- [ ] All tests passing
- [ ] Documentation complete

## Notes

- Reuse navigation patterns from Tools Panel (stage-08b)
- Built-in hooks are read-only (can disable but not edit/delete)
- User hooks stored in ~/.ollm/hooks/ directory
- Settings stored in ~/.ollm/settings.json
- Hook validation prevents invalid configurations
- Test feature helps users verify hooks work correctly
