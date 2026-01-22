# Window Container Refactor - Implementation Tasks

## Phase 1: Foundation Components

### Task 1.0: Code Audit and Cleanup Preparation
- [ ] Audit WindowContext.tsx for legacy code and optimization opportunities
- [ ] Audit App.tsx renderActiveTab function for slop and outdated patterns
- [ ] Audit WindowSwitcher.tsx for reusability improvements
- [ ] Audit ChatTab.tsx for window-related legacy code
- [ ] Audit Terminal.tsx for integration issues
- [ ] Audit EditorMockup.tsx for integration issues
- [ ] Audit SidePanel.tsx for window container readiness
- [ ] Document findings and create cleanup checklist
- [ ] Identify code that can be removed vs refactored
- [ ] Plan comment additions for complex logic

**Verification**: Audit document created with actionable cleanup items

### Task 1.1: Create WindowIndicator Component
- [ ] Create `packages/cli/src/ui/components/layout/WindowIndicator.tsx`
- [ ] Implement WindowIndicatorProps interface
- [ ] Render dots/labels for each window
- [ ] Highlight active window
- [ ] Support positioning (top-left, top-right, etc.)
- [ ] Add theme support
- [ ] Add comprehensive code comments explaining logic
- [ ] Remove any debug/console.log statements
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/components/layout/WindowIndicator.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: Component renders correctly in isolation, passes TypeScript and lint checks

### Task 1.2: Create WindowContainer Component
- [ ] Create `packages/cli/src/ui/components/layout/WindowContainer.tsx`
- [ ] Implement WindowContainerProps interface
- [ ] Implement WindowContentProps interface
- [ ] Render WindowIndicator
- [ ] Render active window content only
- [ ] Handle height calculations (subtract indicator height)
- [ ] Add theme support
- [ ] Add comprehensive code comments for complex logic
- [ ] Ensure clean, optimized code with no legacy patterns
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/components/layout/WindowContainer.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: Component switches windows correctly when activeWindowId changes, passes TypeScript and lint checks

## Phase 2: Context Extension

### Task 2.0: Audit WindowContext Before Extension
- [ ] Review current WindowContext implementation
- [ ] Identify any unused state or methods
- [ ] Check for optimization opportunities
- [ ] Document current behavior and dependencies
- [ ] Plan backward compatibility strategy

**Verification**: Audit notes created with clear extension plan

### Task 2.1: Extend WindowContext
- [ ] Update `packages/cli/src/ui/contexts/WindowContext.tsx`
- [ ] Add ContainerState interface
- [ ] Add containers Map to state
- [ ] Implement registerContainer method
- [ ] Implement unregisterContainer method
- [ ] Implement getContainerState method
- [ ] Implement switchContainerWindow method
- [ ] Implement setContainerWindow method
- [ ] Keep existing API for backward compatibility
- [ ] Add comprehensive comments explaining container management
- [ ] Remove any legacy code or unused exports
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/contexts/WindowContext.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: Multiple containers can coexist with independent state, passes TypeScript and lint checks

### Task 2.2: Create useWindowContainer Hook
- [ ] Add useWindowContainer hook to WindowContext
- [ ] Accept containerId parameter
- [ ] Return activeWindowId, switchWindow, setWindow
- [ ] Handle container not found case
- [ ] Add comprehensive comments
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint on WindowContext.tsx
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: Hook returns correct state for each container, passes TypeScript and lint checks

## Phase 3: Window Content Wrappers

### Task 3.0: Audit Existing Components Before Wrapping
- [ ] Audit ChatTab.tsx for wrapper compatibility
- [ ] Audit Terminal.tsx for wrapper compatibility
- [ ] Audit EditorMockup.tsx for wrapper compatibility
- [ ] Audit ToolsTab.tsx for wrapper compatibility
- [ ] Identify props that need to be passed through
- [ ] Document any legacy code to remove during wrapping
- [ ] Plan comment strategy for wrapper components

**Verification**: Audit document with wrapper implementation plan

### Task 3.1: Create ChatWindow Wrapper
- [ ] Create `packages/cli/src/ui/components/windows/ChatWindow.tsx`
- [ ] Implement WindowContentProps interface
- [ ] Wrap ChatTab component
- [ ] Remove WindowSwitcher from ChatTab (moved to WindowContainer)
- [ ] Pass through all necessary props
- [ ] Handle metrics and reasoning config
- [ ] Add clear comments explaining wrapper purpose
- [ ] Clean up any legacy code in ChatTab during integration
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/components/windows/ChatWindow.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: ChatWindow renders ChatTab correctly, passes TypeScript and lint checks

### Task 3.2: Create TerminalWindow Wrapper
- [ ] Create `packages/cli/src/ui/components/windows/TerminalWindow.tsx`
- [ ] Implement WindowContentProps interface
- [ ] Wrap Terminal component
- [ ] Pass through height/width props
- [ ] Handle focus state
- [ ] Add comments explaining terminal integration
- [ ] Optimize Terminal component if needed
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/components/windows/TerminalWindow.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: TerminalWindow renders Terminal correctly, passes TypeScript and lint checks

### Task 3.3: Create EditorWindow Wrapper
- [ ] Create `packages/cli/src/ui/components/windows/EditorWindow.tsx`
- [ ] Implement WindowContentProps interface
- [ ] Wrap EditorMockup component
- [ ] Pass through height/width props
- [ ] Handle focus state
- [ ] Add comments for editor integration
- [ ] Clean up EditorMockup if needed
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/components/windows/EditorWindow.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: EditorWindow renders EditorMockup correctly, passes TypeScript and lint checks

### Task 3.4: Create ToolsWindow Wrapper (Right Panel)
- [ ] Create `packages/cli/src/ui/components/windows/ToolsWindow.tsx`
- [ ] Implement WindowContentProps interface
- [ ] Wrap ToolsTab component
- [ ] Pass through height/width props
- [ ] Handle focus state
- [ ] Add comments for right panel context
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/components/windows/ToolsWindow.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: ToolsWindow renders ToolsTab correctly, passes TypeScript and lint checks

### Task 3.5: Create WorkspaceWindow Wrapper (Right Panel)
- [ ] Create `packages/cli/src/ui/components/windows/WorkspaceWindow.tsx`
- [ ] Implement WindowContentProps interface
- [ ] Wrap WorkspacePanel component
- [ ] Pass through height/width props
- [ ] Handle focus state
- [ ] Add comments explaining workspace integration
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/components/windows/WorkspaceWindow.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: WorkspaceWindow renders WorkspacePanel correctly, passes TypeScript and lint checks

### Task 3.6: Create RightTerminalWindow Wrapper (Right Panel)
- [ ] Create `packages/cli/src/ui/components/windows/RightTerminalWindow.tsx`
- [ ] Implement WindowContentProps interface
- [ ] Create independent Terminal instance
- [ ] Pass through height/width props
- [ ] Handle focus state
- [ ] Add comments explaining independent terminal instance
- [ ] Ensure no state conflicts with main terminal
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/components/windows/RightTerminalWindow.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: RightTerminalWindow renders independent Terminal correctly, passes TypeScript and lint checks

### Task 3.7: Create RightChatWindow Wrapper (Right Panel)
- [ ] Create `packages/cli/src/ui/components/windows/RightChatWindow.tsx`
- [ ] Implement WindowContentProps interface
- [ ] Create independent ChatTab instance
- [ ] Pass through height/width props
- [ ] Handle focus state
- [ ] Add comments explaining independent chat instance
- [ ] Ensure no state conflicts with main chat
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/components/windows/RightChatWindow.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: RightChatWindow renders independent ChatTab correctly, passes TypeScript and lint checks

## Phase 4: Input Routing & Theme Updates

### Task 4.1: Create InputRoutingContext
- [ ] Create `packages/cli/src/ui/contexts/InputRoutingContext.tsx`
- [ ] Implement InputRoutingState interface
- [ ] Implement InputRoutingContextValue interface
- [ ] Create InputRoutingProvider component
- [ ] Implement linkToMain method
- [ ] Implement linkToRight method
- [ ] Export useInputRouting hook
- [ ] Add comprehensive comments explaining input routing concept
- [ ] Ensure clean, optimized implementation
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/contexts/InputRoutingContext.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: Context provides correct state and methods, passes TypeScript and lint checks

### Task 4.2: Update Theme System
- [ ] Update `packages/cli/src/config/types.ts` BorderTheme interface
- [ ] Add `linked: string` property to BorderTheme
- [ ] Update `packages/cli/src/config/styles.ts` defaultDarkTheme
- [ ] Add `linked: '#10b981'` (green) to border theme
- [ ] Update all other built-in themes with linked color
- [ ] Add comments explaining linked border purpose
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/config/types.ts packages/cli/src/config/styles.ts`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: All themes have linked border color defined, passes TypeScript and lint checks

### Task 4.3: Update WindowContainer for Linked Indicator
- [ ] Add `linkedIndicator?: boolean` prop to WindowContainerProps
- [ ] Update border color logic to use theme.border.linked when linkedIndicator is true
- [ ] Update rendering to show green border when linked
- [ ] Add comments explaining linked indicator visual feedback
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/components/layout/WindowContainer.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write unit tests

**Verification**: WindowContainer shows green border when linkedIndicator is true, passes TypeScript and lint checks

## Phase 5: App.tsx Integration

### Task 5.0: Audit App.tsx Before Major Changes
- [ ] Review renderActiveTab function for legacy patterns
- [ ] Identify all window-related special cases to remove
- [ ] Document current keyboard shortcut handling
- [ ] Plan provider hierarchy changes
- [ ] Create backup/rollback plan

**Verification**: Comprehensive audit document with integration plan

### Task 5.1: Add InputRoutingProvider to App
- [ ] Import InputRoutingProvider in App.tsx
- [ ] Wrap WindowProvider with InputRoutingProvider
- [ ] Verify provider hierarchy is correct
- [ ] Add comments explaining provider order
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/App.tsx`
- [ ] Fix all TypeScript errors and linting warnings
- [ ] Write integration tests

**Verification**: InputRoutingProvider is available throughout app, passes TypeScript and lint checks

### Task 5.2: Update renderActiveTab Function
- [ ] Remove special cases for Terminal/Editor
- [ ] Replace ChatTab with WindowContainer for 'chat' tab
- [ ] Configure windows array: Chat, Terminal, Editor
- [ ] Wire up activeWindowId from WindowContext
- [ ] Wire up onWindowChange callback
- [ ] Set showIndicator={true}
- [ ] Set indicatorPosition="top-right"
- [ ] Pass linkedIndicator from useInputRouting
- [ ] Pass hasFocus from FocusManager
- [ ] Add comprehensive comments explaining new architecture
- [ ] Remove old commented code
- [ ] Clean up unused imports
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/App.tsx`
- [ ] Fix all TypeScript errors and linting warnings

**Verification**: Chat tab renders WindowContainer instead of ChatTab directly, passes TypeScript and lint checks

### Task 5.3: Update Main Window Switching Logic
- [ ] Update global keyboard handler in App.tsx
- [ ] Check if on chat tab before switching
- [ ] Use useWindowContainer('main-window') hook
- [ ] Call switchWindow('prev') for Ctrl+Left
- [ ] Call switchWindow('next') for Ctrl+Right
- [ ] Remove old switchWindow() call
- [ ] Add comments explaining container-scoped switching
- [ ] Clean up any legacy window switching code
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/App.tsx`
- [ ] Fix all TypeScript errors and linting warnings

**Verification**: Ctrl+Left/Right switches main windows correctly, passes TypeScript and lint checks

### Task 5.4: Add Right Panel Window Switching
- [ ] Add Ctrl+Shift+Left keyboard handler
- [ ] Check if side panel is visible
- [ ] Use useWindowContainer('right-panel') hook
- [ ] Call switchWindow('prev')
- [ ] Add Ctrl+Shift+Right keyboard handler
- [ ] Call switchWindow('next')
- [ ] Add comments explaining right panel switching
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/App.tsx`
- [ ] Fix all TypeScript errors and linting warnings

**Verification**: Ctrl+Shift+Left/Right switches right panel windows, passes TypeScript and lint checks

### Task 5.5: Add Input Routing Shortcuts
- [ ] Add Ctrl+Up keyboard handler
- [ ] Call linkToMain() from useInputRouting
- [ ] Add Ctrl+Down keyboard handler
- [ ] Call linkToRight() from useInputRouting
- [ ] Add visual feedback (border color change)
- [ ] Add comments explaining input routing shortcuts
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/App.tsx`
- [ ] Fix all TypeScript errors and linting warnings

**Verification**: Ctrl+Up/Down changes linked container and border color, passes TypeScript and lint checks

### Task 5.6: Update SidePanel.tsx
- [ ] Audit SidePanel.tsx for legacy code
- [ ] Import WindowContainer
- [ ] Import useInputRouting and useWindowContainer
- [ ] Replace current content with WindowContainer
- [ ] Configure windows: Tools, Workspace, Terminal, Chat
- [ ] Wire up activeWindowId
- [ ] Wire up onWindowChange
- [ ] Pass linkedIndicator from useInputRouting
- [ ] Set showIndicator={true}
- [ ] Add comprehensive comments
- [ ] Remove old layout code
- [ ] Clean up unused imports
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint: `npm run lint -- packages/cli/src/ui/components/layout/SidePanel.tsx`
- [ ] Fix all TypeScript errors and linting warnings

**Verification**: Side panel uses WindowContainer with 4 windows, passes TypeScript and lint checks

### Task 5.7: Update Focus Management
- [ ] Ensure 'chat-history' focus ID works for all windows
- [ ] Update focus detection for Terminal
- [ ] Update focus detection for Editor
- [ ] Add focus detection for right panel windows
- [ ] Test Tab cycling with WindowContainer
- [ ] Test ESC navigation with WindowContainer
- [ ] Add comments explaining focus integration
- [ ] Run TypeScript compiler check: `npx tsc --noEmit`
- [ ] Run ESLint on modified focus-related files
- [ ] Fix all TypeScript errors and linting warnings

**Verification**: Focus management works correctly with WindowContainer, passes TypeScript and lint checks

## Phase 6: Testing & Verification

### Task 6.1: Unit Tests
- [ ] Test WindowIndicator component
- [ ] Test WindowContainer component
- [ ] Test WindowContext container management
- [ ] Test useWindowContainer hook
- [ ] Test InputRoutingContext
- [ ] Test useInputRouting hook
- [ ] Test window wrapper components (all 7 wrappers)
- [ ] Test theme updates
- [ ] Achieve 80%+ code coverage

**Verification**: All unit tests pass

### Task 6.2: Integration Tests
- [ ] Test main window switching end-to-end
- [ ] Test right panel window switching end-to-end
- [ ] Test input routing end-to-end
- [ ] Test focus management with windows
- [ ] Test navigation (Tab, ESC) with windows
- [ ] Test keyboard shortcuts (Ctrl+Left/Right, Ctrl+Shift+Left/Right, Ctrl+Up/Down)
- [ ] Test with all windows (main + right panel)
- [ ] Test linked indicator visual feedback

**Verification**: All integration tests pass

### Task 6.3: Visual Verification
- [ ] Verify navbar always visible with Chat window
- [ ] Verify navbar always visible with Terminal window
- [ ] Verify navbar always visible with Editor window
- [ ] Verify WindowIndicator shows correct state (main window)
- [ ] Verify WindowIndicator shows correct state (right panel)
- [ ] Verify linked indicator (green border) on main window
- [ ] Verify linked indicator (green border) on right panel
- [ ] Verify no z-index/layering issues
- [ ] Verify smooth window transitions
- [ ] Verify independent chat/terminal instances work

**Verification**: Visual inspection confirms correct rendering

### Task 6.4: Regression Testing
- [ ] Test all existing tabs (Tools, Hooks, MCP, etc.)
- [ ] Test side panel visibility toggle
- [ ] Test all keyboard shortcuts
- [ ] Test focus cycling
- [ ] Test ESC navigation hierarchy
- [ ] Test mouse interactions
- [ ] Test with side panel hidden
- [ ] Test with side panel visible

**Verification**: No regressions in existing functionality

## Phase 7: Cleanup & Documentation

### Task 6.1: Code Cleanup
- [ ] Remove old renderActiveTab special cases
- [ ] Remove WindowSwitcher from ChatTab
- [ ] Remove unused imports
- [ ] Clean up commented code
- [ ] Run linter and fix issues

**Verification**: Code is clean and follows style guide

### Task 6.2: Documentation
- [ ] Document WindowContainer component API
- [ ] Document WindowIndicator component API
- [ ] Document useWindowContainer hook
- [ ] Add usage examples
- [ ] Update architecture documentation
- [ ] Add inline code comments

**Verification**: Documentation is complete and accurate

### Task 6.3: Update Spec Files
- [ ] Mark all tasks as complete
- [ ] Update design document with final implementation
- [ ] Document any deviations from original plan
- [ ] Add lessons learned section

**Verification**: Spec files are up to date

## Optional Enhancements (Future Work)

### Enhancement 1: Right Panel Windows
- [ ] Apply WindowContainer to right panel
- [ ] Create ToolsWindow wrapper
- [ ] Create WorkspaceWindow wrapper
- [ ] Configure windows for right panel
- [ ] Test window switching in right panel

### Enhancement 2: Window State Persistence
- [ ] Save active window to settings
- [ ] Restore active window on startup
- [ ] Persist per container
- [ ] Add settings UI

### Enhancement 3: Dynamic Window Registration
- [ ] Create WindowRegistry service
- [ ] Allow plugins to register windows
- [ ] Support runtime window addition/removal
- [ ] Update WindowContainer to use registry

## Rollback Plan

If issues are discovered:

1. **Immediate Rollback**:
   - Revert App.tsx changes
   - Restore old renderActiveTab logic
   - Keep new components for future use

2. **Partial Rollback**:
   - Keep WindowContainer for chat tab only
   - Revert Terminal/Editor to old logic
   - Fix issues and re-integrate

3. **Full Rollback**:
   - Revert all changes
   - Document issues encountered
   - Plan alternative approach

## Success Criteria Checklist

- [ ] Navbar always visible (no z-index issues)
- [ ] Window switching works (Ctrl+Left/Right)
- [ ] Visual indicator shows correct state
- [ ] Focus management works correctly
- [ ] Navigation (Tab, ESC) works correctly
- [ ] No regressions in existing features
- [ ] Code is maintainable and well-documented
- [ ] Component is reusable for right panel
- [ ] All tests pass
- [ ] Performance is maintained or improved

## Estimated Effort

- **Phase 1**: 4 hours (Foundation Components)
- **Phase 2**: 3 hours (Context Extension)
- **Phase 3**: 3 hours (Window Wrappers)
- **Phase 4**: 4 hours (App.tsx Integration)
- **Phase 5**: 6 hours (Testing & Verification)
- **Phase 6**: 2 hours (Cleanup & Documentation)

**Total**: ~22 hours

## Dependencies

- Existing WindowContext
- Existing WindowSwitcher
- Focus management system
- Layout system (4-row structure)
- Theme system

## Notes

- This is a significant refactoring that touches core UI components
- Thorough testing is critical to avoid regressions
- Consider implementing behind a feature flag initially
- Plan for gradual rollout and monitoring
- Document all changes for future reference
