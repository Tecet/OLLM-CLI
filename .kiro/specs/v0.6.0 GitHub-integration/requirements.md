# Requirements Document: GitHub Integration

## Introduction

This document specifies the requirements for comprehensive GitHub integration in OLLM CLI. The feature enables developers to manage repositories, issues, pull requests, code reviews, GitHub Actions, and notifications directly from the terminal interface. The integration supports both personal and organization accounts with secure OAuth 2.0 authentication.

## Glossary

- **GitHub_Client**: The service responsible for communicating with GitHub's REST and GraphQL APIs
- **OAuth_Manager**: The component handling GitHub OAuth 2.0 authentication flow and token management
- **Repository_Manager**: The service managing repository operations (clone, create, fork, branch management)
- **Issue_Manager**: The service handling GitHub issue operations
- **PR_Manager**: The service managing pull request workflows
- **Review_Manager**: The service handling code review operations
- **Actions_Manager**: The service managing GitHub Actions workflows and runs
- **Notification_Manager**: The service handling GitHub notifications and alerts
- **Token_Store**: Secure storage for GitHub authentication tokens
- **Rate_Limiter**: Component managing GitHub API rate limits
- **Webhook_Handler**: Service processing GitHub webhook events for real-time updates
- **GitHub_Panel**: The terminal UI component displaying GitHub information
- **Diff_Viewer**: Component rendering code diffs in the terminal
- **Settings_Manager**: Service managing GitHub integration configuration

## Requirements

### Requirement 1: Authentication and Authorization

**User Story:** As a developer, I want to securely authenticate with GitHub, so that I can access my repositories and perform operations on my behalf.

#### Acceptance Criteria

1. WHEN a user initiates GitHub authentication, THE OAuth_Manager SHALL redirect to GitHub's OAuth authorization page
2. WHEN GitHub returns an authorization code, THE OAuth_Manager SHALL exchange it for an access token
3. WHEN an access token is received, THE Token_Store SHALL encrypt and persist the token to ~/.ollm/settings/github.json
4. WHEN an access token expires, THE OAuth_Manager SHALL automatically refresh the token using the refresh token
5. WHERE multiple accounts are configured, THE OAuth_Manager SHALL allow switching between authenticated accounts
6. WHEN a user revokes access, THE Token_Store SHALL securely delete all stored tokens for that account
7. WHEN accessing organization resources, THE OAuth_Manager SHALL request appropriate organization scopes
8. IF token refresh fails, THEN THE OAuth_Manager SHALL prompt the user to re-authenticate

### Requirement 2: Repository Management

**User Story:** As a developer, I want to manage GitHub repositories from the terminal, so that I can perform common repository operations without leaving my workflow.

#### Acceptance Criteria

1. WHEN a user requests repository listing, THE Repository_Manager SHALL fetch and display repositories with pagination support
2. WHEN a user clones a repository, THE Repository_Manager SHALL execute git clone with the authenticated URL
3. WHEN a user creates a new repository, THE Repository_Manager SHALL create it via GitHub API with specified visibility and settings
4. WHEN a user forks a repository, THE Repository_Manager SHALL create a fork under the authenticated user's account
5. WHEN a user lists branches, THE Repository_Manager SHALL display all branches with protection status and latest commit
6. WHEN a user creates a branch, THE Repository_Manager SHALL create it from the specified base branch
7. WHEN a user deletes a branch, THE Repository_Manager SHALL verify it's not protected before deletion
8. WHEN a user views repository insights, THE Repository_Manager SHALL display statistics including stars, forks, issues, and PRs
9. IF a repository operation fails due to permissions, THEN THE Repository_Manager SHALL return a descriptive error message

### Requirement 3: Issue Management

**User Story:** As a developer, I want to manage GitHub issues from the terminal, so that I can track and organize work items efficiently.

#### Acceptance Criteria

1. WHEN a user lists issues, THE Issue_Manager SHALL fetch issues with filtering by state, assignee, labels, and milestone
2. WHEN a user creates an issue, THE Issue_Manager SHALL create it with title, body, labels, assignees, and milestone
3. WHEN a user edits an issue, THE Issue_Manager SHALL update the specified fields via GitHub API
4. WHEN a user closes an issue, THE Issue_Manager SHALL update the issue state to closed
5. WHEN a user reopens an issue, THE Issue_Manager SHALL update the issue state to open
6. WHEN a user assigns an issue, THE Issue_Manager SHALL add the specified users to the assignees list
7. WHEN a user adds labels, THE Issue_Manager SHALL apply the labels to the issue
8. WHEN a user sets a milestone, THE Issue_Manager SHALL associate the issue with the specified milestone
9. WHEN a user searches issues, THE Issue_Manager SHALL use GitHub's search API with the provided query
10. WHERE issue templates exist, THE Issue_Manager SHALL list available templates and populate new issues accordingly

### Requirement 4: Pull Request Workflow

**User Story:** As a developer, I want to manage pull requests from the terminal, so that I can review and merge code changes efficiently.

#### Acceptance Criteria

1. WHEN a user lists pull requests, THE PR_Manager SHALL fetch PRs with filtering by state, author, and labels
2. WHEN a user creates a pull request, THE PR_Manager SHALL create it with title, body, base branch, and head branch
3. WHEN a user edits a pull request, THE PR_Manager SHALL update the specified fields via GitHub API
4. WHEN a user merges a pull request, THE PR_Manager SHALL perform the merge using the specified merge method
5. WHEN a user closes a pull request, THE PR_Manager SHALL update the PR state to closed without merging
6. WHEN a user views PR status, THE PR_Manager SHALL display check runs, review status, and merge conflicts
7. WHEN a user requests reviewers, THE PR_Manager SHALL add the specified users as reviewers
8. IF merge conflicts exist, THEN THE PR_Manager SHALL display conflict details and prevent merging
9. WHEN a user approves a pull request, THE PR_Manager SHALL submit an approval review
10. WHEN a user requests changes, THE PR_Manager SHALL submit a review requesting changes

### Requirement 5: Code Review Features

**User Story:** As a developer, I want to perform code reviews in the terminal, so that I can review changes without switching to a browser.

#### Acceptance Criteria

1. WHEN a user views a pull request diff, THE Diff_Viewer SHALL render the diff with syntax highlighting
2. WHEN a user adds an inline comment, THE Review_Manager SHALL create a review comment at the specified line
3. WHEN a user replies to a comment, THE Review_Manager SHALL add the reply to the comment thread
4. WHEN a user resolves a thread, THE Review_Manager SHALL mark the conversation as resolved
5. WHEN a user submits a review, THE Review_Manager SHALL submit all pending comments with the review state
6. WHEN a user views review threads, THE Review_Manager SHALL display all conversations with resolution status
7. WHERE code suggestions are provided, THE Review_Manager SHALL format them as GitHub suggestion blocks
8. WHEN a user switches diff view mode, THE Diff_Viewer SHALL toggle between unified and split view
9. WHEN viewing large diffs, THE Diff_Viewer SHALL paginate the output for readability

### Requirement 6: GitHub Actions Integration

**User Story:** As a developer, I want to monitor and manage GitHub Actions from the terminal, so that I can track CI/CD pipelines without leaving my workflow.

#### Acceptance Criteria

1. WHEN a user lists workflows, THE Actions_Manager SHALL fetch all workflows in the repository
2. WHEN a user views workflow runs, THE Actions_Manager SHALL display runs with status, conclusion, and duration
3. WHEN a user triggers a workflow, THE Actions_Manager SHALL dispatch a workflow_dispatch event with provided inputs
4. WHEN a user cancels a workflow run, THE Actions_Manager SHALL cancel the in-progress run
5. WHEN a user views workflow logs, THE Actions_Manager SHALL fetch and display logs for each job and step
6. WHEN a user downloads artifacts, THE Actions_Manager SHALL download the artifact zip file to the specified location
7. WHEN a user lists secrets, THE Actions_Manager SHALL display secret names without exposing values
8. WHEN a user creates a secret, THE Actions_Manager SHALL encrypt and store the secret via GitHub API
9. IF a workflow fails, THEN THE Actions_Manager SHALL highlight failed steps and display error messages

### Requirement 7: Notifications System

**User Story:** As a developer, I want to receive GitHub notifications in the terminal, so that I stay informed about important events without checking the browser.

#### Acceptance Criteria

1. WHEN notifications are enabled, THE Notification_Manager SHALL poll GitHub notifications API at configured intervals
2. WHEN a new notification arrives, THE Notification_Manager SHALL display it in the GitHub panel
3. WHEN a user is mentioned, THE Notification_Manager SHALL highlight the mention notification
4. WHEN a review is requested, THE Notification_Manager SHALL display the review request with PR details
5. WHEN an issue is assigned, THE Notification_Manager SHALL notify the user of the assignment
6. WHEN a PR is updated, THE Notification_Manager SHALL show the update notification
7. WHEN a workflow fails, THE Notification_Manager SHALL alert the user with failure details
8. WHERE desktop notifications are enabled, THE Notification_Manager SHALL send system notifications
9. WHERE sound alerts are enabled, THE Notification_Manager SHALL play notification sounds
10. WHEN a user marks a notification as read, THE Notification_Manager SHALL update the notification status via API
11. WHEN a user configures notification filters, THE Settings_Manager SHALL persist the filter preferences

### Requirement 8: Rate Limiting and Error Handling

**User Story:** As a developer, I want the GitHub integration to handle API limits gracefully, so that I can continue working without interruptions.

#### Acceptance Criteria

1. WHEN making API requests, THE Rate_Limiter SHALL track remaining rate limit quota
2. WHEN rate limit is approaching, THE Rate_Limiter SHALL display a warning in the status bar
3. IF rate limit is exceeded, THEN THE Rate_Limiter SHALL queue requests until the limit resets
4. WHEN rate limit resets, THE Rate_Limiter SHALL resume processing queued requests
5. WHEN a network error occurs, THE GitHub_Client SHALL retry the request with exponential backoff
6. IF authentication fails, THEN THE OAuth_Manager SHALL prompt the user to re-authenticate
7. WHEN GitHub API returns an error, THE GitHub_Client SHALL parse and display a user-friendly error message
8. WHERE GraphQL API is available, THE GitHub_Client SHALL prefer GraphQL for efficient multi-resource queries

### Requirement 9: Offline Mode Support

**User Story:** As a developer, I want to access cached GitHub data when offline, so that I can review information without an internet connection.

#### Acceptance Criteria

1. WHEN online, THE GitHub_Client SHALL cache repository, issue, and PR data locally
2. WHEN offline, THE GitHub_Client SHALL serve data from the local cache
3. WHEN offline, THE GitHub_Panel SHALL display a visual indicator showing offline status
4. WHEN attempting write operations offline, THE GitHub_Client SHALL queue the operations for later execution
5. WHEN connection is restored, THE GitHub_Client SHALL sync queued operations with GitHub API
6. WHEN cache expires, THE GitHub_Client SHALL refresh data from GitHub API when online

### Requirement 10: Webhook Integration

**User Story:** As a developer, I want real-time updates from GitHub, so that I see changes immediately without manual refreshing.

#### Acceptance Criteria

1. WHERE webhooks are configured, THE Webhook_Handler SHALL listen for GitHub webhook events
2. WHEN a webhook event is received, THE Webhook_Handler SHALL verify the signature for security
3. WHEN a push event occurs, THE Webhook_Handler SHALL update the repository view
4. WHEN an issue event occurs, THE Webhook_Handler SHALL update the issue list
5. WHEN a pull request event occurs, THE Webhook_Handler SHALL update the PR view
6. WHEN a workflow run event occurs, THE Webhook_Handler SHALL update the Actions view
7. IF webhook signature verification fails, THEN THE Webhook_Handler SHALL reject the event and log the security violation

### Requirement 11: Configuration Management

**User Story:** As a developer, I want to configure GitHub integration settings, so that I can customize the behavior to match my workflow.

#### Acceptance Criteria

1. WHEN a user configures settings, THE Settings_Manager SHALL persist configuration to ~/.ollm/settings/github.json
2. WHEN a user sets notification polling interval, THE Settings_Manager SHALL validate the interval is between 30 seconds and 1 hour
3. WHEN a user enables desktop notifications, THE Settings_Manager SHALL request system notification permissions
4. WHEN a user configures default repository visibility, THE Settings_Manager SHALL apply it to new repositories
5. WHEN a user sets preferred merge method, THE Settings_Manager SHALL use it as default for PR merges
6. WHEN a user configures webhook endpoint, THE Settings_Manager SHALL validate the URL format
7. WHERE workspace-level settings exist, THE Settings_Manager SHALL merge them with user-level settings with workspace taking precedence

### Requirement 12: UI Integration

**User Story:** As a developer, I want a dedicated GitHub panel in the terminal UI, so that I can access GitHub features without leaving the interface.

#### Acceptance Criteria

1. WHEN the GitHub panel is opened, THE GitHub_Panel SHALL display authentication status and account information
2. WHEN authenticated, THE GitHub_Panel SHALL show navigation options for repositories, issues, PRs, actions, and notifications
3. WHEN viewing a list, THE GitHub_Panel SHALL support keyboard navigation and pagination
4. WHEN selecting an item, THE GitHub_Panel SHALL display detailed information in a focused view
5. WHEN performing an action, THE GitHub_Panel SHALL show progress indicators for long-running operations
6. WHEN an error occurs, THE GitHub_Panel SHALL display the error message with suggested actions
7. WHEN notifications arrive, THE GitHub_Panel SHALL display a badge with unread count
8. WHERE multiple accounts are configured, THE GitHub_Panel SHALL show an account switcher


## Existing Placeholder Implementation

**Status:** A placeholder GitHub tab was implemented in stage-06a-github-panel-ui (now consolidated here)

### What Exists
The following components were created as a "Coming Soon" placeholder:

**Components:**
- `packages/cli/src/ui/components/tabs/GitHubTab.tsx` - Main placeholder tab
- `packages/cli/src/ui/components/github/PlannedFeaturesList.tsx` - List of planned features
- `packages/cli/src/ui/components/github/FeatureSection.tsx` - Individual feature category display

**Integration:**
- GitHub tab added to TabBar navigation (Ctrl+6 shortcut)
- Tab routing integrated in App.tsx
- TabType updated in UIContext to include 'github'
- Settings tab shortcut moved to Ctrl+7

**Content:**
The placeholder displays:
- "🚧 Coming Soon 🚧" heading
- Description: "GitHub integration will be available in a future release"
- List of 7 planned feature categories (OAuth, Repositories, Issues, PRs, Code Review, Actions, Notifications)
- Documentation link to this spec

### Migration Strategy
When implementing full GitHub integration:
1. **Remove** placeholder components: `PlannedFeaturesList.tsx`, `FeatureSection.tsx`
2. **Replace** `GitHubTab.tsx` with full implementation
3. **Add** new functional components (auth flow, repository list, PR view, etc.)
4. **Update** tests from smoke tests to functional tests
5. **Keep** existing navigation integration (tab position, keyboard shortcut)

### Files to Replace/Remove
- ❌ Remove: `packages/cli/src/ui/components/github/PlannedFeaturesList.tsx`
- ❌ Remove: `packages/cli/src/ui/components/github/FeatureSection.tsx`
- 🔄 Replace: `packages/cli/src/ui/components/tabs/GitHubTab.tsx`
- 🔄 Update: `packages/cli/src/ui/components/tabs/__tests__/GitHubTab.test.tsx`

## References

- Design Plan: `.dev/docs/Ui/github-panel-interactive-plan.md`
- Tools Panel: `.kiro/specs/stage-08b-tool-support-detection/`
- Hooks Panel: `.kiro/specs/stage-08c-hooks-panel-ui/`
- MCP Panel: `.kiro/specs/stage-08d-mcp-panel-ui/`
- Navigation System: `.dev/docs/Ui/scroll.md`
