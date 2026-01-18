# Implementation Plan: Developer Productivity Tools

## Overview

This implementation plan breaks down the Developer Productivity Tools feature into discrete coding tasks. The feature adds Git integration, @-mentions context loading, and diff review mode to enable Aider-like developer workflows. Tasks are organized to build incrementally, with testing integrated throughout.

## Tasks

- [ ] 1. Set up Git Service foundation
  - Create `packages/core/src/services/gitService.ts` with GitService interface
  - Implement core Git operations using simple-git library
  - Add repository detection (isInRepo, getRepoRoot)
  - Add error handling for non-repository contexts
  - _Requirements: 1.8, 2.7, 2.8, 19.1_

- [ ]* 1.1 Write property test for Git Service
  - **Property 2: Git status structure**
  - **Validates: Requirements 2.1**

- [ ] 2. Implement Git status and diff operations
  - [ ] 2.1 Implement getStatus method
    - Return GitStatus with branch, modified, staged, untracked, ahead, behind
    - Respect .gitignore patterns
    - _Requirements: 1.1, 2.1, 18.1_

  - [ ]* 2.2 Write property test for Git status
    - **Property 1: Git tool action execution (status)**
    - **Validates: Requirements 1.1**

  - [ ] 2.3 Implement getDiff method
    - Generate unified diff for unstaged changes
    - Support optional file path filtering
    - _Requirements: 1.2, 2.2_

  - [ ]* 2.4 Write property test for getDiff
    - **Property 1: Git tool action execution (diff)**
    - **Validates: Requirements 1.2**

- [ ] 3. Implement Git commit and log operations
  - [ ] 3.1 Implement commit method
    - Create commits with message and optional file list
    - Return CommitResult with hash and files changed
    - _Requirements: 1.3, 2.3_

  - [ ] 3.2 Implement getLog method
    - Return commit history with configurable count
    - Default to 10 commits
    - _Requirements: 1.4, 2.4_

  - [ ]* 3.3 Write property test for commit log count
    - **Property 3: Commit log count**
    - **Validates: Requirements 1.4, 2.4**

  - [ ] 3.4 Implement stash and branch operations
    - Add stash push/pop support
    - Add branch listing and switching
    - _Requirements: 1.6, 1.7_

- [ ] 4. Implement AI change tracking and undo
  - [ ] 4.1 Add AI change metadata tracking
    - Track file changes with timestamp and operation type
    - Store last AI change for undo
    - _Requirements: 2.5_

  - [ ] 4.2 Implement undoLastChange method
    - Revert last AI-made file change
    - Handle write, edit, and delete operations
    - Support both committed and uncommitted changes
    - _Requirements: 1.5, 2.5_

  - [ ]* 4.3 Write property test for undo
    - **Property 4: Undo restores state**
    - **Validates: Requirements 1.5, 2.5**

- [ ] 5. Implement commit message generation
  - [ ] 5.1 Add generateCommitMessage method
    - Analyze diff to generate semantic messages
    - Support semantic, descriptive, and conventional styles
    - _Requirements: 2.6, 4.2, 4.3, 4.4_

  - [ ]* 5.2 Write property test for commit messages
    - **Property 5: Commit message generation**
    - **Validates: Requirements 2.6, 4.2, 4.3, 4.4**

- [ ] 6. Implement auto-commit functionality
  - [ ] 6.1 Add auto-commit configuration support
    - Enable/disable auto-commit
    - Configure message style
    - Configure change grouping
    - _Requirements: 4.1, 4.5, 4.6, 4.7_

  - [ ] 6.2 Implement auto-commit logic
    - Commit approved changes automatically
    - Group related changes when configured
    - _Requirements: 4.1, 4.5, 4.6_

  - [ ]* 6.3 Write property test for auto-commit
    - **Property 8: Auto-commit on approval**
    - **Validates: Requirements 4.1, 14.1**

  - [ ]* 6.4 Write property test for change grouping
    - **Property 9: Change grouping**
    - **Validates: Requirements 4.5, 14.2**

- [ ] 7. Create Git Tool
  - [ ] 7.1 Create `packages/core/src/tools/git.ts`
    - Implement DeclarativeTool interface
    - Define GitParams schema with action enum
    - Add tool to tool registry
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ] 7.2 Implement tool execute method
    - Route actions to Git Service methods
    - Format output for LLM and human display
    - Handle errors gracefully
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 7.3 Write unit tests for Git Tool
    - Test each action type
    - Test error handling outside repository
    - Test output formatting

- [ ] 8. Integrate Git status into system prompt
  - [ ] 8.1 Update chatClient.ts to include Git status
    - Check if in repository
    - Get status from Git Service
    - Format status for prompt
    - Respect showStatusInPrompt configuration
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 8.2 Write property test for Git status in prompt
    - **Property 7: Git status in prompt**
    - **Validates: Requirements 3.1, 3.3**

- [ ] 9. Checkpoint - Ensure Git integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Mention Parser
  - [ ] 10.1 Create `packages/core/src/context/mentionParser.ts`
    - Define ParsedMention and ResolvedMention interfaces
    - Implement regex patterns for each mention type
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 10.2 Implement parse method
    - Apply regex patterns to input text
    - Collect matches with positions
    - Resolve overlaps (prefer longer matches)
    - Classify by pattern type
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 10.3 Write property test for mention identification
    - **Property 10: Mention type identification**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

  - [ ]* 10.4 Write property test for multiple mentions
    - **Property 11: Multiple mention detection**
    - **Validates: Requirements 5.7**

  - [ ] 10.3 Implement resolve method
    - Resolve file mentions to paths
    - Expand glob patterns
    - Validate URLs
    - Handle special Git mentions
    - _Requirements: 5.1, 5.2, 5.5, 5.6_

  - [ ] 10.4 Implement removeMentions method
    - Remove mention syntax from input text
    - Preserve surrounding text
    - _Requirements: 7.4_

  - [ ]* 10.5 Write property test for mention removal
    - **Property 16: Mention removal from input**
    - **Validates: Requirements 7.4**

- [ ] 11. Implement Context Loader
  - [ ] 11.1 Create `packages/core/src/context/contextLoader.ts`
    - Define FileContext, SymbolContext, UrlContext interfaces
    - Define LoadedContext interface
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 11.2 Implement loadFile method
    - Read file content
    - Detect language from extension
    - Count tokens
    - Support line range options
    - _Requirements: 6.1_

  - [ ] 11.3 Implement loadGlob method
    - Expand glob pattern
    - Enforce maxFilesPerGlob limit
    - Load all matching files in parallel
    - Warn if total tokens exceed limit
    - _Requirements: 6.2, 6.6, 6.7, 6.8_

  - [ ]* 11.4 Write property test for glob file limit
    - **Property 13: Glob file limit enforcement**
    - **Validates: Requirements 6.7**

  - [ ] 11.5 Implement loadUrl method
    - Validate URL format
    - Fetch content with timeout
    - Convert HTML to text if needed
    - Truncate if too large
    - _Requirements: 6.4_

  - [ ] 11.6 Implement loadSymbol method (basic)
    - Search for symbol in workspace
    - Extract symbol definition
    - Note: Full AST parsing is optional for MVP
    - _Requirements: 6.3_

  - [ ]* 11.7 Write property test for context loader structure
    - **Property 12: Context loader return structure**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

  - [ ]* 11.8 Write property test for token warnings
    - **Property 14: Token limit warnings**
    - **Validates: Requirements 6.8, 20.1, 20.2, 20.3**

- [ ] 12. Integrate mention parsing with input processing
  - [ ] 12.1 Update input processing in chatClient.ts
    - Parse mentions from user input
    - Resolve mentions to content
    - Load contexts
    - Handle resolution errors
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [ ] 12.2 Implement mention deduplication
    - Track loaded files
    - Skip duplicate loads
    - _Requirements: 7.6_

  - [ ]* 12.3 Write property test for deduplication
    - **Property 15: Mention deduplication**
    - **Validates: Requirements 7.6**

  - [ ] 12.3 Build context messages
    - Format file contexts with code blocks
    - Format symbol contexts with location
    - Format URL contexts with content type
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 12.4 Write property test for context formatting
    - **Property 17: Context message formatting**
    - **Validates: Requirements 8.1, 8.3, 8.4**

  - [ ]* 12.5 Write property test for multiple context messages
    - **Property 19: Multiple context messages**
    - **Validates: Requirements 8.2**

  - [ ] 12.4 Add context messages to conversation
    - Insert context messages before user message
    - _Requirements: 8.5_

  - [ ]* 12.6 Write property test for message ordering
    - **Property 18: Context message ordering**
    - **Validates: Requirements 8.5**

- [ ] 13. Implement special Git mentions
  - [ ] 13.1 Add Git mention handling to Mention Parser
    - Parse @git:status, @git:diff, @git:log:N patterns
    - Resolve to Git operations
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ]* 13.2 Write unit tests for Git mentions
    - Test each Git mention type
    - Test error outside repository

- [ ] 14. Checkpoint - Ensure mention and context tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Implement Diff Reviewer
  - [ ] 15.1 Create `packages/core/src/review/diffReviewer.ts`
    - Define DiffReview and DiffHunk interfaces
    - Implement DiffReviewer class
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 15.2 Implement createReview method
    - Read original file content
    - Generate unified diff using diff library
    - Parse diff into hunks
    - Check auto-approve rules
    - _Requirements: 9.1, 9.2, 9.3, 12.4_

  - [ ]* 15.3 Write property test for review structure
    - **Property 20: Diff review structure**
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [ ] 15.3 Implement diff hunk parsing
    - Parse unified diff format
    - Extract removed and added lines
    - Include context lines
    - _Requirements: 9.3, 12.7_

  - [ ]* 15.4 Write property test for context lines
    - **Property 26: Diff context lines**
    - **Validates: Requirements 12.7**

  - [ ] 15.4 Implement applyReview method
    - Write proposed content to file
    - Update review status
    - _Requirements: 9.4, 11.5_

  - [ ]* 15.5 Write property test for review application
    - **Property 21: Review application**
    - **Validates: Requirements 9.4, 11.5**

  - [ ] 15.5 Implement rejectReview method
    - Discard proposed changes
    - Update review status
    - _Requirements: 9.5, 11.6_

  - [ ]* 15.6 Write property test for review rejection
    - **Property 22: Review rejection**
    - **Validates: Requirements 9.5, 11.6**

  - [ ] 15.6 Implement pending review management
    - Store pending reviews in memory
    - Implement getPending method
    - Implement getReview method
    - Implement clearPending method
    - _Requirements: 9.6_

  - [ ]* 15.7 Write property test for pending queue
    - **Property 23: Pending review queue**
    - **Validates: Requirements 9.6**

- [ ] 16. Implement auto-approve logic
  - [ ] 16.1 Implement shouldAutoApprove method
    - Check autoApprove.smallChanges configuration
    - Count changed lines in hunks
    - Compare to threshold
    - _Requirements: 12.4_

  - [ ]* 16.2 Write property test for auto-approve
    - **Property 25: Auto-approve small changes**
    - **Validates: Requirements 12.4**

- [ ] 17. Integrate Diff Reviewer with file tools
  - [ ] 17.1 Update write-file tool
    - Check if review mode enabled
    - Create diff review instead of direct write
    - Handle auto-approved reviews
    - Track changes for undo
    - Trigger auto-commit if enabled
    - _Requirements: 11.1, 11.4, 11.5_

  - [ ]* 17.2 Write property test for review mode operations
    - **Property 24: Review mode file operations**
    - **Validates: Requirements 11.1, 11.2**

  - [ ] 17.2 Update edit-file tool
    - Check if review mode enabled
    - Create diff review instead of direct edit
    - Handle auto-approved reviews
    - _Requirements: 11.2, 11.4, 11.5_

  - [ ] 17.3 Implement review approval flow
    - Apply review
    - Track for undo
    - Trigger auto-commit if enabled
    - _Requirements: 11.5, 14.1_

  - [ ] 17.4 Implement review rejection flow
    - Discard changes
    - Notify user
    - _Requirements: 11.6, 14.3_

- [ ] 18. Create Diff Review UI Component
  - [ ] 18.1 Create `packages/cli/src/ui/components/DiffReviewPanel.tsx`
    - Display file path
    - Display diff hunks with syntax highlighting
    - Show action options (y/n/e/a)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 18.2 Implement keyboard shortcuts
    - 'y' for approve
    - 'n' for reject
    - 'e' for edit
    - 'a' for approve all
    - _Requirements: 10.5, 10.6, 10.7, 10.8_

  - [ ]* 18.3 Write unit tests for DiffReviewPanel
    - Test rendering with review data
    - Test keyboard event handling
    - Test action callbacks

- [ ] 19. Implement configuration support
  - [ ] 19.1 Add Git configuration schema
    - Add git.enabled
    - Add git.autoCommit settings
    - Add git.showStatusInPrompt
    - _Requirements: 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 19.2 Add mention configuration schema
    - Add context.mentions.enabled
    - Add context.mentions.maxFilesPerGlob
    - Add context.mentions.maxTokensPerMention
    - Add context.mentions.warnOnLargeContext
    - _Requirements: 6.7, 6.8, 20.4_

  - [ ] 19.3 Add review configuration schema
    - Add review.enabled
    - Add review.autoApprove settings
    - Add review.contextLines
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ]* 19.4 Write unit tests for configuration
    - Test configuration loading
    - Test default values
    - Test validation

- [ ] 20. Implement CLI flags
  - [ ] 20.1 Add --review-diffs flag
    - Enable review mode for session
    - _Requirements: 13.1_

  - [ ] 20.2 Add --no-review flag
    - Disable review mode for session
    - _Requirements: 13.2_

  - [ ]* 20.3 Write unit tests for CLI flags
    - Test flag parsing
    - Test precedence over config

- [ ] 21. Implement slash commands
  - [ ] 21.1 Add /git commands
    - /git status
    - /git commit [message]
    - /git undo
    - _Requirements: 16.1, 16.2, 16.3_

  - [ ] 21.2 Add /review commands
    - /review enable
    - /review disable
    - /review pending
    - _Requirements: 16.4, 16.5, 16.6_

  - [ ]* 21.3 Write unit tests for slash commands
    - Test command parsing
    - Test command execution

- [ ] 22. Implement status bar indicators
  - [ ] 22.1 Add Git status to status bar
    - Show current branch
    - Show modified file count
    - Show staged file count
    - Hide when not in repository
    - _Requirements: 17.1, 17.2, 17.3, 17.5_

  - [ ] 22.2 Add review status to status bar
    - Show pending review count
    - _Requirements: 17.4_

  - [ ]* 22.3 Write unit tests for status bar
    - Test Git status display
    - Test review status display
    - Test hiding when not applicable

- [ ] 23. Implement .gitignore respect
  - [ ] 23.1 Update Git Service to respect .gitignore
    - Filter status results
    - Filter diff results
    - _Requirements: 18.1_

  - [ ] 23.2 Update Context Loader to respect .gitignore
    - Filter glob results
    - Allow explicit file mentions to override
    - _Requirements: 18.2, 18.3_

  - [ ]* 23.3 Write property test for gitignore respect
    - **Property 27: Gitignore respect in operations**
    - **Validates: Requirements 18.1, 18.3**

  - [ ]* 23.4 Write property test for explicit override
    - **Property 28: Explicit mention override**
    - **Validates: Requirements 18.2**

- [ ] 24. Implement error handling
  - [ ] 24.1 Add descriptive error messages for Git operations
    - No repository found
    - Uncommitted changes
    - Permission denied
    - Merge conflicts
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [ ]* 24.2 Write property test for error messages
    - **Property 6: Error message descriptiveness**
    - **Validates: Requirements 2.9, 19.4**

  - [ ] 24.2 Add error handling for mention resolution
    - File not found
    - Invalid pattern
    - Too many matches
    - _Requirements: 6.5, 6.6, 6.7, 7.5_

  - [ ] 24.3 Add error handling for context loading
    - Permission denied
    - Binary files
    - Token limit exceeded
    - URL fetch failed
    - _Requirements: 6.5, 6.8, 20.1, 20.2, 20.3_

  - [ ] 24.4 Add error handling for diff review
    - Review not found
    - File modified since review
    - Disk full
    - _Requirements: 9.4, 9.5_

- [ ] 25. Final checkpoint - Integration testing
  - [ ] 25.1 Test Git + Diff Review integration
    - Approved changes trigger auto-commit
    - Commit messages include reviewed files
    - _Requirements: 14.1, 14.2_

  - [ ] 25.2 Test @-Mentions + Git integration
    - @git:status loads Git status
    - @git:diff loads current diff
    - @git:log:N loads commit history
    - _Requirements: 15.1, 15.2, 15.3_

  - [ ] 25.3 Test complete workflow
    - Use @file.ts to load context
    - Make changes via LLM
    - Review and approve changes
    - Verify auto-commit
    - Use /git status to check
    - _Requirements: All_

  - [ ]* 25.4 Write integration tests
    - Test full workflow end-to-end
    - Test error scenarios
    - Test configuration combinations

- [ ] 26. Documentation and polish
  - [ ] 26.1 Update README with new features
    - Document Git integration
    - Document @-mentions syntax
    - Document diff review mode
    - Document configuration options

  - [ ] 26.2 Add inline code documentation
    - Document all public interfaces
    - Add usage examples
    - Document error conditions

  - [ ] 26.3 Create user guide
    - Getting started with Git integration
    - Using @-mentions effectively
    - Configuring review mode
    - Troubleshooting common issues

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions
- The implementation builds incrementally: Git → Mentions → Review → Integration
