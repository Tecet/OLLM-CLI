# Requirements Document

## Introduction

This document specifies the requirements for the Developer Productivity Tools feature, which adds Git integration, context mentions, and diff review capabilities to OLLM CLI. These features enable Aider-like developer workflows by providing explicit context loading, change review, and version control integration.

## Glossary

- **Git_Tool**: A tool that provides Git operations (status, commit, diff, undo) to the LLM
- **Git_Service**: A service that wraps simple-git library and provides Git operations
- **Mention_Parser**: A component that parses @-mentions from user input
- **Context_Loader**: A component that loads file/symbol/URL content referenced by mentions
- **Diff_Reviewer**: A component that generates and manages diff reviews before applying changes
- **Review_Mode**: A mode where file changes require user approval before being applied
- **Auto_Commit**: A feature that automatically commits approved changes with generated messages
- **Mention**: An @-prefixed reference in user input (e.g., @file.ts, @src/**/*.ts)
- **Symbol**: A code entity like a class, function, or method that can be referenced
- **Diff_Hunk**: A contiguous section of changes in a diff
- **Semantic_Commit_Message**: A commit message that describes the purpose of changes

## Requirements

### Requirement 1: Git Integration Tool

**User Story:** As a developer, I want Git operations available as a tool, so that the LLM can check status, commit changes, and manage version control.

#### Acceptance Criteria

1. WHEN the Git_Tool is invoked with action "status", THE System SHALL return the current working tree status
2. WHEN the Git_Tool is invoked with action "diff", THE System SHALL return unstaged changes in unified diff format
3. WHEN the Git_Tool is invoked with action "commit" with a message, THE System SHALL commit staged or all changes with that message
4. WHEN the Git_Tool is invoked with action "log" with a count, THE System SHALL return the specified number of recent commits
5. WHEN the Git_Tool is invoked with action "undo", THE System SHALL revert the last AI-made file change
6. WHEN the Git_Tool is invoked with action "stash", THE System SHALL stash or unstash changes
7. WHEN the Git_Tool is invoked with action "branch", THE System SHALL list or switch branches
8. WHEN the Git_Tool is invoked outside a Git repository, THE System SHALL return an error indicating no repository found

### Requirement 2: Git Service

**User Story:** As a developer, I want a Git service that wraps Git operations, so that the system can interact with repositories safely and consistently.

#### Acceptance Criteria

1. WHEN Git_Service.getStatus is called, THE System SHALL return the current repository status including modified, staged, and untracked files
2. WHEN Git_Service.getDiff is called with optional file paths, THE System SHALL return the diff for specified files or all changes
3. WHEN Git_Service.commit is called with a message and optional files, THE System SHALL create a commit with the specified message
4. WHEN Git_Service.getLog is called with a count, THE System SHALL return commit history limited to that count
5. WHEN Git_Service.undoLastChange is called, THE System SHALL revert the most recent AI-made modification
6. WHEN Git_Service.generateCommitMessage is called with a diff, THE System SHALL generate a semantic commit message describing the changes
7. WHEN Git_Service.isInRepo is called, THE System SHALL return true if the current directory is within a Git repository
8. WHEN Git_Service.getRepoRoot is called, THE System SHALL return the root directory path of the repository
9. WHEN Git operations encounter errors, THE System SHALL return descriptive error messages

### Requirement 3: Git Context in System Prompt

**User Story:** As a developer, I want Git status included in the system prompt, so that the LLM is aware of the current repository state.

#### Acceptance Criteria

1. WHEN the System builds a system prompt and is in a Git repository, THE System SHALL include the current Git status
2. WHEN the System builds a system prompt and is not in a Git repository, THE System SHALL omit Git status information
3. WHEN Git status is included, THE System SHALL format it to show modified, staged, and untracked files
4. WHEN Git status inclusion is disabled in configuration, THE System SHALL omit Git status from the prompt

### Requirement 4: Auto-Commit Feature

**User Story:** As a developer, I want automatic commits after approved changes, so that my work is versioned without manual intervention.

#### Acceptance Criteria

1. WHEN auto-commit is enabled and a file change is approved, THE System SHALL create a commit for that change
2. WHEN auto-commit message style is "semantic", THE System SHALL generate semantic commit messages
3. WHEN auto-commit message style is "descriptive", THE System SHALL generate descriptive commit messages
4. WHEN auto-commit message style is "conventional", THE System SHALL generate conventional commit messages
5. WHEN auto-commit groupChanges is enabled, THE System SHALL group related changes into a single commit
6. WHEN auto-commit groupChanges is disabled, THE System SHALL create separate commits for each change
7. WHEN auto-commit is disabled, THE System SHALL not automatically commit changes

### Requirement 5: Mention Parser

**User Story:** As a developer, I want to use @-mentions to reference files and symbols, so that I can explicitly load context into the conversation.

#### Acceptance Criteria

1. WHEN user input contains "@path/to/file.ts", THE Mention_Parser SHALL identify it as a file mention
2. WHEN user input contains "@src/**/*.ts", THE Mention_Parser SHALL identify it as a glob pattern mention
3. WHEN user input contains "@ClassName", THE Mention_Parser SHALL identify it as a symbol mention
4. WHEN user input contains "@ClassName.methodName", THE Mention_Parser SHALL identify it as a method mention
5. WHEN user input contains "@https://example.com", THE Mention_Parser SHALL identify it as a URL mention
6. WHEN user input contains "@./directory/", THE Mention_Parser SHALL identify it as a directory mention
7. WHEN user input contains multiple mentions, THE Mention_Parser SHALL identify all of them
8. WHEN user input contains no mentions, THE Mention_Parser SHALL return an empty list

### Requirement 6: Context Loader

**User Story:** As a developer, I want the system to load content from mentions, so that referenced files and symbols are available to the LLM.

#### Acceptance Criteria

1. WHEN Context_Loader.loadFile is called with a file path, THE System SHALL return the file content with metadata
2. WHEN Context_Loader.loadGlob is called with a pattern, THE System SHALL return content for all matching files
3. WHEN Context_Loader.loadSymbol is called with a symbol path, THE System SHALL return the symbol definition
4. WHEN Context_Loader.loadUrl is called with a URL, THE System SHALL fetch and return the URL content
5. WHEN a file mention references a non-existent file, THE System SHALL return an error indicating the file was not found
6. WHEN a glob pattern matches no files, THE System SHALL return an empty list
7. WHEN a glob pattern matches more than the configured maximum files, THE System SHALL return an error with the count
8. WHEN loaded content exceeds the configured token limit, THE System SHALL return a warning

### Requirement 7: Mention Integration with Input Processing

**User Story:** As a developer, I want mentions processed automatically from my input, so that context is loaded without additional commands.

#### Acceptance Criteria

1. WHEN user input is processed and contains mentions, THE System SHALL parse all mentions
2. WHEN mentions are parsed, THE System SHALL resolve each mention to actual content
3. WHEN mentions are resolved, THE System SHALL add the content to the conversation context
4. WHEN mentions are processed, THE System SHALL remove the mention syntax from the cleaned input
5. WHEN mention resolution fails, THE System SHALL include an error message in the response
6. WHEN multiple mentions reference the same file, THE System SHALL load the file only once

### Requirement 8: Context Messages from Mentions

**User Story:** As a developer, I want loaded context formatted as system messages, so that the LLM receives the referenced content clearly.

#### Acceptance Criteria

1. WHEN file content is loaded from a mention, THE System SHALL format it as a system message with file path and language
2. WHEN multiple files are loaded, THE System SHALL create separate system messages for each file
3. WHEN symbol content is loaded, THE System SHALL format it with the symbol path and definition
4. WHEN URL content is loaded, THE System SHALL format it with the URL and fetched content
5. WHEN context messages are added, THE System SHALL include them before the user message in the conversation

### Requirement 9: Diff Reviewer

**User Story:** As a developer, I want to review diffs before changes are applied, so that I can approve or reject modifications.

#### Acceptance Criteria

1. WHEN Diff_Reviewer.createReview is called with a file path and new content, THE System SHALL generate a diff review
2. WHEN a diff review is created, THE System SHALL include the file path, original content, proposed content, and unified diff
3. WHEN a diff review is created, THE System SHALL parse the diff into hunks
4. WHEN Diff_Reviewer.applyReview is called with an approved review, THE System SHALL write the proposed content to the file
5. WHEN Diff_Reviewer.rejectReview is called, THE System SHALL discard the proposed changes
6. WHEN Diff_Reviewer.getPending is called, THE System SHALL return all pending reviews

### Requirement 10: Diff Review UI

**User Story:** As a developer, I want a visual diff review panel, so that I can see proposed changes clearly before approving them.

#### Acceptance Criteria

1. WHEN a diff review is pending, THE System SHALL display a Diff_Review_Panel
2. WHEN the Diff_Review_Panel is displayed, THE System SHALL show the file path being changed
3. WHEN the Diff_Review_Panel is displayed, THE System SHALL show each diff hunk with removed and added lines
4. WHEN the Diff_Review_Panel is displayed, THE System SHALL show action options: approve, reject, edit, approve all
5. WHEN the user presses "y", THE System SHALL approve the current review
6. WHEN the user presses "n", THE System SHALL reject the current review
7. WHEN the user presses "e", THE System SHALL open the file for editing
8. WHEN the user presses "a", THE System SHALL approve all pending reviews

### Requirement 11: Review Mode Integration with Tools

**User Story:** As a developer, I want file write operations to queue for review when review mode is enabled, so that I can approve changes before they are applied.

#### Acceptance Criteria

1. WHEN review mode is enabled and a write-file tool is executed, THE System SHALL create a diff review instead of writing directly
2. WHEN review mode is enabled and an edit-file tool is executed, THE System SHALL create a diff review instead of editing directly
3. WHEN review mode is disabled, THE System SHALL write files directly without review
4. WHEN a change is queued for review, THE System SHALL return a result indicating the review is pending
5. WHEN a review is approved, THE System SHALL apply the change and return success
6. WHEN a review is rejected, THE System SHALL discard the change and return rejection

### Requirement 12: Review Mode Configuration

**User Story:** As a developer, I want to configure review mode behavior, so that I can control when reviews are required.

#### Acceptance Criteria

1. WHEN review.enabled is true in configuration, THE System SHALL enable review mode
2. WHEN review.enabled is false in configuration, THE System SHALL disable review mode
3. WHEN review.autoApprove.readOperations is true, THE System SHALL auto-approve read operations
4. WHEN review.autoApprove.smallChanges is true and a change is below the threshold, THE System SHALL auto-approve it
5. WHEN review.autoApprove.smallChanges is false, THE System SHALL require review for all changes
6. WHEN review.showFullContext is true, THE System SHALL show surrounding lines in diffs
7. WHEN review.contextLines is set, THE System SHALL show that many lines of context in diffs

### Requirement 13: Review Mode CLI Flags

**User Story:** As a developer, I want CLI flags to control review mode, so that I can enable or disable it per session.

#### Acceptance Criteria

1. WHEN the CLI is invoked with "--review-diffs", THE System SHALL enable review mode for that session
2. WHEN the CLI is invoked with "--no-review", THE System SHALL disable review mode for that session
3. WHEN no review flag is provided, THE System SHALL use the configuration file setting

### Requirement 14: Git and Review Integration

**User Story:** As a developer, I want approved changes to be auto-committed when both features are enabled, so that my workflow is seamless.

#### Acceptance Criteria

1. WHEN a diff is approved and auto-commit is enabled, THE System SHALL commit the change
2. WHEN multiple diffs are approved, THE System SHALL include all files in the commit message
3. WHEN a diff is rejected, THE System SHALL not create a commit

### Requirement 15: Special Git Mentions

**User Story:** As a developer, I want special @git mentions to load Git information, so that I can reference repository state in prompts.

#### Acceptance Criteria

1. WHEN user input contains "@git:status", THE System SHALL load and include Git status
2. WHEN user input contains "@git:diff", THE System SHALL load and include the current diff
3. WHEN user input contains "@git:log:N", THE System SHALL load and include the last N commits
4. WHEN a Git mention is used outside a repository, THE System SHALL return an error

### Requirement 16: Slash Commands for Features

**User Story:** As a developer, I want slash commands for Git and review operations, so that I can control these features interactively.

#### Acceptance Criteria

1. WHEN the user types "/git status", THE System SHALL display Git status
2. WHEN the user types "/git commit [message]", THE System SHALL commit with the specified message
3. WHEN the user types "/git undo", THE System SHALL undo the last change
4. WHEN the user types "/review enable", THE System SHALL enable review mode
5. WHEN the user types "/review disable", THE System SHALL disable review mode
6. WHEN the user types "/review pending", THE System SHALL show all pending reviews

### Requirement 17: Status Bar Indicators

**User Story:** As a developer, I want status bar indicators for Git and review state, so that I can see the current state at a glance.

#### Acceptance Criteria

1. WHEN the System is in a Git repository, THE System SHALL display the current branch in the status bar
2. WHEN there are modified files, THE System SHALL display the count in the status bar
3. WHEN there are staged files, THE System SHALL display the count in the status bar
4. WHEN there are pending reviews, THE System SHALL display the count in the status bar
5. WHEN not in a Git repository, THE System SHALL not display Git information in the status bar

### Requirement 18: Gitignore Respect

**User Story:** As a developer, I want Git operations to respect .gitignore, so that ignored files are not included in operations.

#### Acceptance Criteria

1. WHEN Git_Service performs operations, THE System SHALL exclude files matching .gitignore patterns
2. WHEN a mention references an ignored file, THE System SHALL still load it (explicit reference)
3. WHEN a glob pattern is used, THE System SHALL exclude ignored files from results

### Requirement 19: Error Handling for Git Operations

**User Story:** As a developer, I want clear error messages for Git failures, so that I can understand and fix issues.

#### Acceptance Criteria

1. WHEN a Git operation fails due to no repository, THE System SHALL return an error indicating no repository found
2. WHEN a Git operation fails due to uncommitted changes, THE System SHALL return an error describing the conflict
3. WHEN a Git operation fails due to permissions, THE System SHALL return an error indicating permission denied
4. WHEN a Git operation fails for any reason, THE System SHALL include the underlying Git error message

### Requirement 20: Token Count Warnings for Mentions

**User Story:** As a developer, I want warnings when mentioned content is large, so that I can avoid exceeding context limits.

#### Acceptance Criteria

1. WHEN a single mention loads content exceeding the configured token limit, THE System SHALL display a warning
2. WHEN multiple mentions together exceed the context limit, THE System SHALL display a warning with the total
3. WHEN a warning is displayed, THE System SHALL include the token count and the limit
4. WHEN warnOnLargeContext is disabled, THE System SHALL not display warnings
