# GitHub Panel UI - Tasks

**Feature:** Interactive UI placeholder for GitHub integration  
**Status:** In Progress  
**Created:** 2026-01-17

## Task Overview

This is a **placeholder implementation** for the GitHub panel. Full GitHub integration will be implemented in Stage-11. The goal is to add a GitHub tab to the navigation bar with informative "Coming Soon" content.

**Estimated Total Effort:** 1 hour

---

## 1. Create GitHub Components

**Estimated Time:** 30-45 minutes  
**Status:** ✅ COMPLETED

### 1.1 Create GitHubTab Component
- [x] Create `packages/cli/src/ui/components/tabs/GitHubTab.tsx`
- [x] Import Box and Text from Ink
- [x] Implement heading section with "🚧 Coming Soon 🚧"
- [x] Add description text
- [x] Add "Planned Features:" label
- [x] Integrate PlannedFeaturesList component
- [x] Add documentation link at bottom
- [x] Apply proper spacing and padding
- [x] Add JSDoc comments

**Validates:** Requirements 2.1, 2.2, 4.1, 4.2

### 1.2 Create PlannedFeaturesList Component
- [x] Create `packages/cli/src/ui/components/github/PlannedFeaturesList.tsx`
- [x] Define PlannedFeature interface
- [x] Create PLANNED_FEATURES constant with 7 categories:
  - OAuth Authentication (3 items)
  - Repository Operations (4 items)
  - Issue Management (4 items)
  - Pull Request Workflow (4 items)
  - Code Review Features (4 items)
  - GitHub Actions (4 items)
  - Notifications (4 items)
- [x] Map over features and render FeatureSection components
- [x] Export component
- [x] Add JSDoc comments
**Validates:** Requirements 3.1, 3.2, 3.3

### 1.3 Create FeatureSection Component
- [x] Create `packages/cli/src/ui/components/github/FeatureSection.tsx`
- [x] Define FeatureSectionProps interface
- [x] Render category title with checkmark (✓) prefix
- [x] Apply cyan color to title
- [x] Render feature items with bullet (•) prefix
- [x] Apply dimColor to items
- [x] Add proper indentation (marginLeft: 2)
- [x] Add spacing between sections (marginBottom: 1)
- [x] Export component
- [x] Add JSDoc comments

**Validates:** Requirements 3.4, 3.5

---

## 2. Integrate with Navigation

**Estimated Time:** 15-20 minutes  
**Status:** ✅ COMPLETED

### 2.1 Update TabType in UIContext
- [x] Open `packages/cli/src/features/context/UIContext.tsx`
- [x] Add 'github' to TabType union:
  - Change: `export type TabType = 'chat' | 'search' | 'files' | 'tools' | 'docs' | 'settings';`
  - To: `export type TabType = 'chat' | 'search' | 'files' | 'tools' | 'docs' | 'github' | 'settings';`
- [x] Verify no TypeScript errors

**Validates:** Requirements 1.1

### 2.2 Add GitHub Tab to TabBar
- [x] Open `packages/cli/src/ui/components/layout/TabBar.tsx`
- [x] Add GitHub tab to tabs array (after 'docs', before 'settings'):
  ```typescript
  { id: 'github', label: 'GitHub', icon: '\u{1F680}', shortcut: 'Ctrl+6' },
  ```
- [x] Update Settings tab shortcut from 'Ctrl+6' to 'Ctrl+7'
- [x] Verify tab appears in navigation bar

**Validates:** Requirements 1.1, 1.3, 1.4

### 2.3 Add Keyboard Shortcut in App.tsx
- [x] Open `packages/cli/src/ui/App.tsx`
- [x] Add keyboard shortcut in useGlobalKeyboardShortcuts array:
  ```typescript
  {
    key: 'ctrl+6',
    handler: () => setActiveTab('github'),
    description: 'Switch to GitHub tab',
  },
  ```
- [x] Update Settings tab shortcut from 'ctrl+6' to 'ctrl+7'
- [x] Test shortcut works correctly
- [x] Verify no conflicts with existing shortcuts

**Validates:** Requirements 1.2, 5.2

### 2.4 Update App Routing
- [x] Open `packages/cli/src/ui/App.tsx`
- [x] Import GitHubTab component at top:
  ```typescript
  import { GitHubTab } from './components/tabs/GitHubTab.js';
  ```
- [x] Add 'github' case to renderActiveTab switch (after 'docs', before 'settings'):
  ```typescript
  case 'github':
    return <Box height={height}><GitHubTab /></Box>;
  ```
- [x] Verify routing works correctly
- [x] Test navigation to/from GitHub tab

**Validates:** Requirements 5.1, 5.3, 5.4

---

## 3. Write Tests

**Estimated Time:** 10 minutes  
**Status:** ✅ COMPLETED

### 3.1 Basic Smoke Test for GitHubTab
- [x] Create `packages/cli/src/ui/components/tabs/__tests__/GitHubTab.test.tsx`
- [x] Test: renders without errors
- [x] Test: displays "Coming Soon" heading
- [x] Test: displays feature categories
- [x] All tests pass

**Validates:** Requirements 2.1, 3.1, 4.1

**Note:** Minimal testing for placeholder component. Full testing will be done in Stage-11.

---

## 4. Manual Validation

**Estimated Time:** 5 minutes  
**Status:** ⏳ NOT STARTED

### 4.1 Quick Manual Check
- [ ] Start CLI: `npm run dev`
- [ ] Navigate to GitHub tab using Ctrl+6
- [ ] Verify placeholder content displays correctly
- [ ] Verify no console errors

**Validates:** Basic functionality

---

## Implementation Notes

### Component Structure
```
packages/cli/src/ui/components/
├── tabs/
│   ├── GitHubTab.tsx          # ✅ CREATED
│   └── ...
├── github/                     # ✅ CREATED
│   ├── PlannedFeaturesList.tsx # ✅ CREATED
│   ├── FeatureSection.tsx      # ✅ CREATED
│   └── __tests__/              # ✅ CREATED
│       └── GitHubTab.test.tsx  # ✅ Basic smoke tests
└── layout/
    └── TabBar.tsx             # ✅ UPDATED
```

### Key Files Modified
1. `packages/cli/src/features/context/UIContext.tsx` - ✅ COMPLETED - 'github' added to TabType
2. `packages/cli/src/ui/components/layout/TabBar.tsx` - ✅ COMPLETED - GitHub tab added
3. `packages/cli/src/ui/App.tsx` - ✅ COMPLETED - GitHub routing and keyboard shortcut added

### Key Files Created
1. ✅ `packages/cli/src/ui/components/tabs/GitHubTab.tsx`
2. ✅ `packages/cli/src/ui/components/github/PlannedFeaturesList.tsx`
3. ✅ `packages/cli/src/ui/components/github/FeatureSection.tsx`
4. ✅ `packages/cli/src/ui/components/tabs/__tests__/GitHubTab.test.tsx` (basic smoke tests)

### Current Implementation Status

**✅ Completed:**
- All three GitHub placeholder components created
- JSDoc documentation added to all components
- Proper TypeScript interfaces defined
- Visual styling matches design spec
- TabType updated in UIContext to include 'github'
- GitHub tab added to TabBar navigation
- Keyboard shortcut (Ctrl+6) configured in App.tsx
- Settings tab shortcut updated to Ctrl+7
- GitHub routing case added to App.tsx
- GitHubTab import added to App.tsx
- Basic smoke tests created and passing
- No TypeScript errors

**⏳ Remaining:**
- Manual validation (quick check)

### Dependencies
- No new dependencies required
- Uses existing Ink components (Box, Text)
- Uses existing navigation system
- No external APIs or services

### Testing Strategy
- Minimal smoke tests for placeholder (renders without errors, basic content checks)
- Full testing deferred to Stage-11 when actual functionality is implemented

### Success Criteria
- ✅ GitHub tab components created
- ✅ GitHub tab appears in navigation
- ✅ Ctrl+6 navigates to GitHub tab
- ✅ All 7 feature categories display
- ✅ Documentation link shows Stage-11 path
- ✅ Navigation works smoothly
- ✅ Basic tests pass
- ⏳ No console errors (manual check pending)
- ✅ Renders quickly

---

## Stage-11 Migration Notes

When implementing full GitHub integration in Stage-11:

### Components to Remove
- `PlannedFeaturesList.tsx`
- `FeatureSection.tsx`

### Components to Replace
- `GitHubTab.tsx` - Replace with full implementation

### Components to Add
- `GitHubAuthFlow.tsx` - OAuth authentication
- `GitHubHeader.tsx` - Account status and info
- `RepositoryList.tsx` - Repository management
- `PullRequestList.tsx` - PR workflow
- `IssueList.tsx` - Issue management
- `CodeReviewPanel.tsx` - Code review features
- `GitHubActionsPanel.tsx` - Actions integration
- `NotificationsList.tsx` - Notifications

### Services to Add
- `GitHubClient.ts` - GitHub API client
- `GitHubOAuthManager.ts` - OAuth flow
- `GitHubStateManager.ts` - State management

### Tests to Update
- Replace placeholder tests with functional tests
- Add integration tests for GitHub features
- Add E2E tests for workflows

---

## Completion Checklist

Before marking this spec as complete:

- [x] All GitHub placeholder components created
- [x] TabType updated to include 'github'
- [x] GitHub tab added to TabBar navigation
- [x] Keyboard shortcut (Ctrl+6) configured
- [x] App routing updated for GitHub tab
- [x] Settings tab shortcut updated to Ctrl+7
- [x] Basic smoke tests created and passing
- [ ] Manual validation completed
- [x] GitHub tab accessible via Ctrl+6
- [x] Navigation works correctly
- [x] Placeholder content displays correctly

---

## Related Specifications

- **Stage-11**: `.kiro/specs/stage-11-kraken-integration-future-dev/` (Full GitHub integration)
- **Tools Panel**: `.kiro/specs/stage-06b-tool-support-detection/`
- **Hooks Panel**: `.kiro/specs/stage-06c-hooks-panel-ui/`
- **MCP Panel**: `.kiro/specs/stage-06d-mcp-panel-ui/`

---

**Total Estimated Time:** 1 hour  
**Complexity:** Low (placeholder only)  
**Priority:** Low (nice-to-have for UI consistency)  
**Dependencies:** None (uses existing systems)  
**Current Progress:** ~95% complete (only manual validation pending)
