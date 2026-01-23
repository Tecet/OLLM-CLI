# Navigation System Fix - Tasks

**Version**: 1.0.0  
**Status**: 📋 Planning  
**Created**: January 23, 2026

## Overview

Tasks to fix the hierarchical navigation system by correcting ESC key handling.

## Tasks

### Phase 1: Fix ESC Handler

- [ ] 1. Update useGlobalKeyboardShortcuts.ts
  - Rename `handleCancel` to `handleEscape`
  - Reorder logic: cancel first (if streaming), then always navigate
  - Add direct `key.escape` handler
  - Update comments to explain dual purpose
  - Remove conditional that skips navigation
  - _Requirements: US-1, TR-1_

### Phase 2: Testing

- [ ] 2. Test Level 3 → Level 2 Navigation
  - Open syntax viewer from file tree
  - Press ESC
  - Verify focus returns to file tree
  - Test with and without streaming
  - _Requirements: US-1, TR-1_

- [ ] 3. Test Level 2 → Level 1 Navigation
  - Focus file tree (Level 2)
  - Press ESC
  - Verify focus moves to nav-bar (Level 1)
  - Test from all Level 2 areas
  - _Requirements: US-1, TR-1_

- [ ] 4. Test Level 1 Two-Step Navigation
  - Focus nav-bar on Tools tab
  - Press ESC
  - Verify switches to Chat tab (stays in nav-bar)
  - Press ESC again
  - Verify moves to user input
  - _Requirements: US-1, TR-1_

- [ ] 5. Test Streaming Cancellation
  - Start generation
  - Press ESC while streaming
  - Verify generation cancels
  - Verify navigation still happens
  - _Requirements: US-1, TR-1_

- [ ] 6. Test Tab Cycling
  - From user input, press Tab
  - Verify moves to chat-history
  - Press Tab again, verify moves to nav-bar
  - Press Tab again, verify moves to context-panel (if visible)
  - Press Tab again, verify wraps to user input
  - Test Shift+Tab in reverse
  - _Requirements: US-2, TR-2_

- [ ] 7. Test Enter Activation
  - Focus nav-bar on Files tab
  - Press Enter
  - Verify focus moves to file-tree
  - Verify mode switches to 'active'
  - Test on all tabs
  - _Requirements: US-3, TR-3_

### Phase 3: Edge Cases

- [ ] 8. Test ESC During Menu
  - Open context menu
  - Press ESC
  - Verify menu closes
  - Verify doesn't navigate away from current level
  - _Requirements: US-1_

- [ ] 9. Test ESC in Input Field
  - Focus chat input
  - Type some text
  - Press ESC
  - Verify appropriate behavior (clear or exit)
  - _Requirements: US-1_

- [ ] 10. Test Rapid ESC Presses
  - Open modal (Level 3)
  - Press ESC multiple times quickly
  - Verify smooth navigation through levels
  - Verify no race conditions
  - _Requirements: US-1_

### Phase 4: Documentation

- [ ] 11. Update Design Document
  - Add ESC key behavior section
  - Document dual purpose (navigate + cancel)
  - Add implementation notes
  - _Requirements: All_

- [ ] 12. Update Code Comments
  - Add comments explaining ESC logic
  - Document navigation hierarchy
  - Add examples
  - _Requirements: All_

### Phase 5: Verification

- [ ] 13. Run All Tests
  - Run unit tests
  - Run integration tests
  - Verify no regressions
  - _Requirements: All_

- [ ] 14. Manual Testing
  - Test all navigation paths
  - Test on different terminals
  - Test with different configurations
  - _Requirements: All_

- [ ] 15. Code Review
  - Request review
  - Address feedback
  - Get approval
  - _Requirements: All_

## Summary

**Total Tasks**: 15  
**Estimated Effort**: 2-4 hours  

**Phase 1 (Fix)**: 1 task, 30 minutes  
**Phase 2 (Testing)**: 6 tasks, 1 hour  
**Phase 3 (Edge Cases)**: 3 tasks, 30 minutes  
**Phase 4 (Documentation)**: 2 tasks, 30 minutes  
**Phase 5 (Verification)**: 3 tasks, 30 minutes  

## Success Criteria

- [ ] ESC always performs hierarchical navigation
- [ ] ESC cancels generation when streaming
- [ ] Tab/Shift+Tab cycle through Level 1
- [ ] Enter activates tab content
- [ ] All tests pass
- [ ] No regressions

## Notes

- This is a bug fix, not a feature
- Changes are minimal and focused
- No breaking changes to public APIs
- Existing tests should still pass
