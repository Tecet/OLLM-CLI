# Implementation Plan: GitHub Integration

## Overview

This implementation plan breaks down the GitHub integration feature into discrete, manageable tasks. The plan follows a layered approach, starting with core infrastructure (API client, authentication), then building services (repositories, issues, PRs, etc.), and finally implementing the UI components. Each task builds incrementally on previous work, with property-based tests integrated throughout to validate correctness.

### Existing Placeholder Implementation

**Note:** A placeholder GitHub tab currently exists in the UI (created in stage-06a-github-panel-ui). When implementing this spec:

**Existing Components to Remove:**
- `packages/cli/src/ui/components/github/PlannedFeaturesList.tsx`
- `packages/cli/src/ui/components/github/FeatureSection.tsx`

**Existing Components to Replace:**
- `packages/cli/src/ui/components/tabs/GitHubTab.tsx` - Replace placeholder with functional implementation
- `packages/cli/src/ui/components/tabs/__tests__/GitHubTab.test.tsx` - Replace smoke tests with functional tests

**Existing Integration to Keep:**
- GitHub tab in TabBar navigation (Ctrl+6 shortcut)
- Tab routing in App.tsx
- TabType definition in UIContext

The placeholder shows a "Coming Soon" message with a list of planned features. Task 22 will replace this with the full functional implementation.

## Tasks

- [ ] 1. Set up GitHub integration infrastructure
  - Create directory structure: `packages/core/src/github/` with subdirectories for api, auth, services, utils
  - Set up TypeScript configuration for GitHub module
  - Install dependencies: `@octokit/rest`, `@octokit/graphql`, encryption libraries
  - Create base types and interfaces in `packages/core/src/github/types.ts`
  - _Requirements: 1.1, 8.1_

- [ ] 2. Implement GitHub API client and rate limiting
  - [ ] 2.1 Create REST API client
    - Implement `restClient.ts` with GET, POST, PATCH, DELETE methods
    - Add request/response interceptors for authentication headers
    - Implement error parsing and user-friendly error messages
    - _Requirements: 8.7_

  - [ ] 2.2 Write property test for REST client error handling
    - **Property 65: API errors produce user-friendly messages**
    - **Validates: Requirements 8.7**

  - [ ] 2.3 Create GraphQL API client
    - Implement `graphqlClient.ts` with query and mutation methods
    - Add support for GraphQL variables and fragments
    - Implement GraphQL error handling
    - _Requirements: 8.8_

  - [ ] 2.4 Write property test for GraphQL client
    - **Property 66: Multi-resource queries prefer GraphQL**
    - **Validates: Requirements 8.8**

  - [ ] 2.5 Implement rate limiter
    - Create `rateLimiter.ts` with quota tracking
    - Implement request queuing when rate limited
    - Add warning threshold detection
    - Implement exponential backoff for retries
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 2.6 Write property tests for rate limiter
    - **Property 61: Rate limit quota is tracked**
    - **Property 62: Rate limit warning appears at threshold**
    - **Property 63: Queued requests execute after reset**
    - **Property 64: Network errors trigger exponential backoff**
    - **Validates: Requirements 8.1, 8.2, 8.4, 8.5**

  - [ ] 2.7 Create unified GitHub client
    - Implement `githubClient.ts` combining REST and GraphQL clients
    - Add rate limiter integration
    - Implement request retry logic
    - _Requirements: 8.5_

- [ ] 3. Implement OAuth authentication and token management
  - [ ] 3.1 Create token store with encryption
    - Implement `tokenStore.ts` with encrypted storage
    - Use Node.js crypto module for AES-256 encryption
    - Store tokens in `~/.ollm/settings/github.json`
    - Implement account listing and deletion
    - _Requirements: 1.3, 1.6_

  - [ ] 3.2 Write property tests for token store
    - **Property 2: Token storage round-trip**
    - **Property 5: Token deletion removes access**
    - **Validates: Requirements 1.3, 1.6**

  - [ ] 3.3 Implement OAuth manager
    - Create `oauthManager.ts` with OAuth 2.0 flow
    - Implement authorization URL generation with state parameter
    - Implement authorization code exchange
    - Add token refresh logic
    - Implement scope management for organizations
    - _Requirements: 1.1, 1.2, 1.4, 1.7, 1.8_

  - [ ] 3.4 Write property tests for OAuth manager
    - **Property 1: OAuth URL contains required parameters**
    - **Property 3: Token refresh produces valid token**
    - **Property 6: Organization scopes included in OAuth URL**
    - **Validates: Requirements 1.1, 1.4, 1.7**

  - [ ] 3.5 Implement account manager for multi-account support
    - Create `accountManager.ts` with account switching
    - Implement active account tracking
    - Add account configuration management
    - _Requirements: 1.5_

  - [ ] 3.6 Write property test for account switching
    - **Property 4: Account switching activates correct account**
    - **Validates: Requirements 1.5**

- [ ] 4. Checkpoint - Ensure authentication tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement cache manager for offline support
  - [ ] 5.1 Create cache manager
    - Implement `cache.ts` with TTL-based caching
    - Use file-based storage in `~/.ollm/cache/github/`
    - Implement cache key generation (github:{resource}:{identifier})
    - Add cache expiration and cleanup
    - _Requirements: 9.1, 9.2, 9.6_

  - [ ] 5.2 Write property tests for cache manager
    - **Property 67: Online data is cached locally**
    - **Property 68: Offline requests serve from cache**
    - **Property 72: Expired cache refreshes when online**
    - **Validates: Requirements 9.1, 9.2, 9.6**

  - [ ] 5.3 Implement offline operation queue
    - Add operation queuing for offline writes
    - Implement sync logic for reconnection
    - Add offline status detection
    - _Requirements: 9.4, 9.5_

  - [ ] 5.4 Write property tests for offline queue
    - **Property 70: Offline writes are queued**
    - **Property 71: Reconnection syncs queued operations**
    - **Validates: Requirements 9.4, 9.5**

- [ ] 6. Implement repository manager
  - [ ] 6.1 Create repository manager service
    - Implement `repositoryManager.ts` with list, get, create, fork operations
    - Add pagination support for repository listing
    - Implement branch operations (list, create, delete)
    - Add repository insights fetching
    - Integrate with cache manager
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ] 6.2 Write property tests for repository manager
    - **Property 7: Repository pagination respects parameters**
    - **Property 8: Clone URL is authenticated**
    - **Property 9: Created repository matches specification**
    - **Property 10: Fork references original repository**
    - **Property 11: Branch listing includes required metadata**
    - **Property 12: New branch inherits base commit**
    - **Property 13: Protected branches cannot be deleted**
    - **Property 14: Repository insights contain all statistics**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

- [ ] 7. Implement issue manager
  - [ ] 7.1 Create issue manager service
    - Implement `issueManager.ts` with list, get, create, update operations
    - Add filtering support (state, assignee, labels, milestone)
    - Implement issue state transitions (close, reopen)
    - Add assignee, label, and milestone management
    - Implement issue search
    - Add issue template support
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ] 7.2 Write property tests for issue manager
    - **Property 15: Issue filtering returns matching results**
    - **Property 16: Created issue contains all specified fields**
    - **Property 17: Issue updates preserve unmodified fields**
    - **Property 18: Issue state transitions are correct**
    - **Property 19: Issue assignees include all specified users**
    - **Property 20: Issue labels include all added labels**
    - **Property 21: Issue milestone matches specified milestone**
    - **Property 22: Search query is properly formatted**
    - **Property 23: Issue templates populate fields correctly**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

- [ ] 8. Implement pull request manager
  - [ ] 8.1 Create PR manager service
    - Implement `prManager.ts` with list, get, create, update operations
    - Add filtering support (state, author, labels)
    - Implement PR merge with merge method selection
    - Add PR close operation
    - Implement reviewer management
    - Add PR status fetching (checks, reviews, conflicts)
    - Implement PR diff fetching
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [ ] 8.2 Write property tests for PR manager
    - **Property 24: PR filtering returns matching results**
    - **Property 25: Created PR contains all specified fields**
    - **Property 26: PR updates preserve unmodified fields**
    - **Property 27: Merged PR has correct state**
    - **Property 28: Closed PR is not merged**
    - **Property 29: PR status contains all required information**
    - **Property 30: PR reviewers include all requested users**
    - **Property 31: PR approval creates approval review**
    - **Property 32: PR change request creates changes-requested review**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9, 4.10**

- [ ] 9. Checkpoint - Ensure core services tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement review manager
  - [ ] 10.1 Create review manager service
    - Implement `reviewManager.ts` with list, create, submit review operations
    - Add review comment creation and reply functionality
    - Implement conversation resolution
    - Add code suggestion formatting
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 10.2 Write property tests for review manager
    - **Property 34: Review comment exists at specified location**
    - **Property 35: Comment reply references original**
    - **Property 36: Resolved thread has correct status**
    - **Property 37: Submitted review includes all pending comments**
    - **Property 38: Review threads include resolution status**
    - **Property 39: Code suggestions use correct format**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

- [ ] 11. Implement diff viewer component
  - [ ] 11.1 Create diff viewer for terminal
    - Implement `DiffViewer.tsx` with syntax highlighting
    - Add unified and split view modes
    - Implement pagination for large diffs
    - Use `highlight.js` for syntax highlighting
    - Add view mode toggle functionality
    - _Requirements: 5.1, 5.8, 5.9_

  - [ ] 11.2 Write property tests for diff viewer
    - **Property 33: Diff rendering includes syntax highlighting**
    - **Property 40: Diff view mode toggles correctly**
    - **Property 41: Large diffs are paginated**
    - **Validates: Requirements 5.1, 5.8, 5.9**

- [ ] 12. Implement GitHub Actions manager
  - [ ] 12.1 Create Actions manager service
    - Implement `actionsManager.ts` with workflow and run operations
    - Add workflow listing and details fetching
    - Implement workflow run listing and details
    - Add workflow triggering with inputs
    - Implement run cancellation
    - Add workflow log fetching
    - Implement artifact download
    - Add secret management (list, create)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [ ] 12.2 Write property tests for Actions manager
    - **Property 42: All workflows are listed**
    - **Property 43: Workflow runs include required fields**
    - **Property 44: Triggered workflow creates new run**
    - **Property 45: Cancelled run has cancelled status**
    - **Property 46: Workflow logs contain all jobs and steps**
    - **Property 47: Downloaded artifact exists at path**
    - **Property 48: Secret listings never expose values**
    - **Property 49: Created secret appears in list**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**

- [ ] 13. Implement notification manager
  - [ ] 13.1 Create notification manager service
    - Implement `notificationManager.ts` with polling and fetching
    - Add notification event subscription
    - Implement mark as read functionality
    - Add notification filtering
    - Integrate with system notifications (desktop)
    - Add sound alert support
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11_

  - [ ] 13.2 Write property tests for notification manager
    - **Property 50: Notification polling occurs at configured interval**
    - **Property 51: New notifications appear in UI**
    - **Property 52: Mention notifications are highlighted**
    - **Property 53: Review request notifications include PR details**
    - **Property 54: Assignment events generate notifications**
    - **Property 55: PR update events generate notifications**
    - **Property 56: Workflow failure notifications include details**
    - **Property 57: Desktop notifications are sent when enabled**
    - **Property 58: Sound alerts play when enabled**
    - **Property 59: Marked-as-read notifications have correct status**
    - **Property 60: Notification filter settings persist**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11**

- [ ] 14. Implement webhook handler
  - [ ] 14.1 Create webhook handler service
    - Implement `webhookHandler.ts` with HTTP server
    - Add webhook signature verification
    - Implement event routing for different event types
    - Add event handlers for push, issue, PR, workflow events
    - Implement security logging for invalid signatures
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ] 14.2 Write property tests for webhook handler
    - **Property 73: Webhook server listens when configured**
    - **Property 74: Invalid webhook signatures are rejected**
    - **Property 75: Push events update repository view**
    - **Property 76: Issue events update issue list**
    - **Property 77: PR events update PR view**
    - **Property 78: Workflow events update Actions view**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**

- [ ] 15. Checkpoint - Ensure all services tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Implement settings manager
  - [ ] 16.1 Create settings manager
    - Implement `settingsManager.ts` with configuration persistence
    - Add validation for polling interval (30s - 1h)
    - Implement webhook URL validation
    - Add workspace/user settings merging
    - Implement default value application
    - Store settings in `~/.ollm/settings/github.json`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ] 16.2 Write property tests for settings manager
    - **Property 79: Settings persist correctly**
    - **Property 80: Polling interval validation**
    - **Property 81: Desktop notifications request permissions**
    - **Property 82: Default visibility applies to new repositories**
    - **Property 83: Default merge method applies to PR merges**
    - **Property 84: Webhook URL validation**
    - **Property 85: Workspace settings override user settings**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7**

- [ ] 17. Implement GitHub panel UI container
  - [ ] 17.1 Create main GitHub panel component
    - Implement `GitHubPanel.tsx` as main container
    - Add authentication status display
    - Implement navigation menu (repositories, issues, PRs, actions, notifications)
    - Add account switcher for multiple accounts
    - Implement offline status indicator
    - Add error display with suggested actions
    - _Requirements: 12.1, 12.2, 12.6, 12.8, 9.3_

  - [ ] 17.2 Write property tests for GitHub panel
    - **Property 86: GitHub panel shows auth status**
    - **Property 87: Authenticated panel shows navigation**
    - **Property 69: Offline mode shows indicator**
    - **Property 91: Errors display with suggestions**
    - **Property 93: Multiple accounts show switcher**
    - **Validates: Requirements 12.1, 12.2, 12.6, 12.8, 9.3**

  - [ ] 17.3 Write unit tests for GitHub panel UI
    - Test rendering in authenticated vs unauthenticated states
    - Test navigation menu interactions
    - Test account switcher functionality
    - Test error display

- [ ] 18. Implement repository list UI component
  - [ ] 18.1 Create repository list component
    - Implement `RepositoryList.tsx` with pagination
    - Add keyboard navigation (arrow keys, page up/down)
    - Implement repository selection and detail view
    - Add loading indicators
    - Display repository metadata (stars, forks, description)
    - _Requirements: 12.3, 12.4, 12.5_

  - [ ] 18.2 Write property tests for repository list
    - **Property 88: Keyboard navigation works in lists**
    - **Property 89: Item selection shows details**
    - **Property 90: Long operations show progress**
    - **Validates: Requirements 12.3, 12.4, 12.5**

  - [ ] 18.3 Write unit tests for repository list UI
    - Test list rendering with various data sets
    - Test keyboard event handling
    - Test pagination controls
    - Test loading states

- [ ] 19. Implement issue list UI component
  - [ ] 19.1 Create issue list component
    - Implement `IssueList.tsx` with filtering UI
    - Add filter controls (state, assignee, labels, milestone)
    - Implement keyboard navigation
    - Add issue selection and detail view
    - Display issue metadata (state, labels, assignees)
    - _Requirements: 12.3, 12.4_

  - [ ] 19.2 Write unit tests for issue list UI
    - Test list rendering with filtered data
    - Test filter control interactions
    - Test issue selection
    - Test keyboard navigation

- [ ] 20. Implement pull request view UI component
  - [ ] 20.1 Create PR view component
    - Implement `PullRequestView.tsx` with PR details
    - Add PR status display (checks, reviews, conflicts)
    - Implement action buttons (merge, close, approve, request changes)
    - Add reviewer list display
    - Integrate diff viewer component
    - Display PR metadata (state, author, branches)
    - _Requirements: 12.4, 12.5_

  - [ ] 20.2 Write unit tests for PR view UI
    - Test PR details rendering
    - Test action button interactions
    - Test status display with various states
    - Test diff viewer integration

- [ ] 21. Implement notification badge UI component
  - [ ] 21.1 Create notification badge component
    - Implement `NotificationBadge.tsx` with unread count
    - Add notification list display
    - Implement notification type icons (mention, review, assignment)
    - Add mark as read functionality
    - Display notification details (title, repository, reason)
    - _Requirements: 12.7_

  - [ ] 21.2 Write property test for notification badge
    - **Property 92: Notification badge shows unread count**
    - **Validates: Requirements 12.7**

  - [ ] 21.3 Write unit tests for notification badge UI
    - Test badge rendering with various counts
    - Test notification list display
    - Test mark as read interaction
    - Test notification type styling

- [ ] 22. Integrate GitHub panel with main application
  - [ ] 22.1 Wire GitHub panel into main UI
    - Remove placeholder components: `PlannedFeaturesList.tsx`, `FeatureSection.tsx`
    - Replace `GitHubTab.tsx` placeholder content with full implementation
    - Keep existing Ctrl+6 keyboard shortcut
    - Keep existing tab position in navigation bar
    - Implement panel state management
    - Connect to GitHub services (auth, repositories, issues, PRs)
    - _Requirements: 12.1_

  - [ ] 22.2 Update tests
    - Remove placeholder smoke tests
    - Add functional unit tests for GitHubTab
    - Test authenticated vs unauthenticated states
    - Test navigation and keyboard shortcuts
    - Test integration with GitHub services

- [ ] 23. Implement integration tests
  - [ ] 23.1 Write end-to-end integration tests
    - Test complete OAuth flow
    - Test repository operations workflow
    - Test issue creation and management workflow
    - Test PR creation, review, and merge workflow
    - Test notification flow
    - Test offline mode and sync
    - Use test GitHub accounts and repositories

- [ ] 24. Final checkpoint - Ensure all tests pass
  - Run full test suite (unit + property + integration)
  - Verify all 93 properties are tested
  - Check test coverage meets 80% threshold
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- The implementation follows a bottom-up approach: infrastructure → services → UI
- All services integrate with cache manager for offline support
- All API calls go through rate limiter for quota management
- Authentication is required before any GitHub operations
