# Implementation Plan: Stage 6 - CLI and UI

## Overview

This implementation plan breaks down the Stage 6 CLI and UI feature into discrete, incremental coding tasks. Each task builds on previous work and includes specific requirements references for traceability. The plan follows a bottom-up approach, implementing foundational services first, then UI components, and finally integration.

## Tasks

- [x] 1. Set up CLI infrastructure and configuration system
  - Create CLI entry point with argument parsing
  - Implement layered configuration loader
  - Set up JSON schema validation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 21.1-21.17_
  - _Started: 2026-01-13 13:22_
  - _Completed: 2026-01-13 13:37_
  - _Duration: 15m_
  - _Credits: 9.34_

- [x] 1.1 Write property test for configuration precedence
  - **Property 1: Configuration Precedence**
  - **Validates: Requirements 1.1, 1.3**

- [x] 1.2 Write property test for configuration validation errors
  - **Property 2: Configuration Validation Errors**
  - **Validates: Requirements 1.2, 22.1**

- [x] 1.3 Write property test for configuration defaults
  - **Property 3: Configuration Defaults**
  - **Validates: Requirements 1.5**

- [x] 2. Implement GPU monitoring service
  - [x] 2.1 Create GPU monitor interface and types
    - Define GPUInfo interface
    - Define GPUMonitor interface
    - Implement vendor detection logic
    - _Requirements: 2.1, 2.6_
  - _Started: 2026-01-13 13:40_
  - _Completed: 2026-01-13 14:05_
  - _Duration: 25m_
  - _Credits: 10.21_

  - [x] 2.2 Implement platform-specific GPU queries
    - Implement NVIDIA query (nvidia-smi)
    - Implement AMD query (rocm-smi)
    - Implement Apple Silicon query (ioreg)
    - Implement CPU fallback (system RAM)
    - _Requirements: 2.2, 2.4, 2.5, 2.6_

  - [x] 2.3 Write property test for GPU temperature warning
    - **Property 4: GPU Temperature Warning**
    - **Validates: Requirements 2.3**

  - [x] 2.4 Write property test for VRAM query structure
    - **Property 5: VRAM Query Structure**
    - **Validates: Requirements 2.4**

  - [x] 2.5 Write unit tests for GPU monitor
    - Test vendor detection with mocked commands
    - Test query parsing with sample outputs
    - Test fallback behavior
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Implement non-interactive runner
  - [x] 3.1 Create non-interactive runner with output formats
    - Implement text output format
    - Implement JSON output format
    - Implement stream-json output format
    - Handle stdin input
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_
  - _Started: 2026-01-13 14:07_
  - _Completed: 2026-01-13 14:23_
  - _Duration: 16m_
  - _Credits: 19.14_

  - [x] 3.2 Implement error handling with exit codes
    - Handle provider connection failures
    - Handle model not found errors
    - Handle timeout errors
    - Write errors to stderr
    - _Requirements: 3.6, 22.4_

  - [x] 3.3 Write property test for non-interactive mode selection
    - **Property 6: Non-Interactive Mode Selection**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 3.4 Write property test for output format compliance
    - **Property 7: Output Format Compliance**
    - **Validates: Requirements 3.4**

  - [x] 3.5 Write property test for NDJSON stream format
    - **Property 8: NDJSON Stream Format**
    - **Validates: Requirements 3.5**

  - [x] 3.6 Write property test for error exit codes
    - **Property 9: Error Exit Codes**
    - **Validates: Requirements 3.6**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Started: 2026-01-13 14:26_
  - _Completed: 2026-01-13 14:47_
  - _Duration: 21m_
  - _Credits: 7.62_

- [x] 5. Implement UI context management
  - [x] 5.1 Create UIContext for global UI state
    - Implement active tab state
    - Implement side panel visibility state
    - Implement theme state
    - Implement notifications state
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.5_
  - _Started: 2026-01-13 14:52_
  - _Completed: 2026-01-13 15:06_
  - _Duration: 14m_
  - _Credits: 10.12_

  - [x] 5.2 Create GPUContext for GPU monitoring state
    - Integrate with GPU monitor service
    - Implement polling and updates
    - Handle loading and error states
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 5.3 Create ChatContext for chat state
    - Implement message list state
    - Implement streaming state
    - Implement waiting state
    - Implement input state
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 5.4 Create ReviewContext for diff review state
    - Implement review list state
    - Implement approve/reject actions
    - Implement batch actions
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 6. Implement theme system
  - [x] 6.1 Create UI settings with default theme
    - Define Theme interface
    - Define Typography interface
    - Define Keybinds interface
    - Implement default UI settings
    - _Requirements: 18.1, 18.6, 23.1, 23.2, 23.3_
  - _Started: 2026-01-13 15:07_
  - _Completed: 2026-01-13 15:22_
  - _Duration: 15m_
  - _Credits: 9.07_

  - [x] 6.2 Implement built-in themes
    - Implement Default Dark theme
    - Implement Dracula theme
    - Implement Nord theme
    - Implement Monokai theme
    - Implement Solarized Dark theme
    - _Requirements: 18.1_

  - [x] 6.3 Create theme manager service
    - Implement theme loading
    - Implement custom theme loading from ui.yaml
    - Implement theme merging (deep merge)
    - Implement theme application
    - _Requirements: 18.2, 18.3, 18.4, 18.5_

  - [x] 6.4 Write property test for theme merging
    - **Property 31: Theme Merging**
    - **Validates: Requirements 18.2**

  - [x] 6.5 Write property test for theme switching
    - **Property 32: Theme Switching**
    - **Validates: Requirements 18.4**

- [x] 7. Implement layout components
  - [x] 7.1 Create TabBar component
    - Implement tab rendering with icons
    - Implement keyboard shortcuts (Ctrl+1-6)
    - Implement notification badges
    - Implement active tab highlighting
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 20.1_
  - _Started: 2026-01-13 15:26_
  - _Completed: 2026-01-13 16:35_
  - _Duration: 1h 9m_
  - _Credits: 33.51_

  - [x] 7.2 Write property test for tab keyboard shortcuts
    - **Property 10: Tab Keyboard Shortcuts**
    - **Validates: Requirements 4.2**

  - [x] 7.3 Write property test for notification badge display
    - **Property 11: Notification Badge Display**
    - **Validates: Requirements 4.3**

  - [x] 7.4 Write property test for active tab highlighting
    - **Property 13: Active Tab Highlighting**
    - **Validates: Requirements 4.5**

  - [x] 7.5 Create SidePanel component
    - Implement collapsible panel with Ctrl+P toggle
    - Create ContextSection component
    - Create GitSection component
    - Create ReviewSection component
    - Create ToolsSection component
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 20.2_

  - [x] 7.6 Write property test for side panel toggle
    - **Property 14: Side Panel Toggle**
    - **Validates: Requirements 5.1**

  - [x] 7.7 Write property test for side panel visibility persistence
    - **Property 15: Side Panel Visibility Persistence**
    - **Validates: Requirements 5.5**

  - [x] 7.8 Create StatusBar component
    - Implement connection status indicator
    - Implement model name display
    - Implement token usage display
    - Implement git status display
    - Implement GPU status display
    - Implement review count display
    - Implement cost estimate display
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 7.9 Write property test for connection status indicators
    - **Property 16: Connection Status Indicators**
    - **Validates: Requirements 6.1**

  - [x] 7.10 Write property test for token usage format
    - **Property 17: Token Usage Format**
    - **Validates: Requirements 6.3**

  - [x] 7.11 Write property test for review count display
    - **Property 18: Review Count Display**
    - **Validates: Requirements 6.6**

  - [x] 7.12 Create InputBox component
    - Implement multi-line input support
    - Implement Enter to send
    - Implement Shift+Enter for newline
    - Implement Up arrow for edit previous
    - _Requirements: 20.9, 20.10, 20.11_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Started: 2026-01-13 16:37_
  - _Completed: 2026-01-13 17:09_
  - _Duration: 32m_
  - _Credits: 12.56_

- [x] 9. Implement chat components
  - [x] 9.1 Create Message component
    - Implement role-based colors
    - Implement message header with timestamp
    - Implement message content rendering
    - _Requirements: 7.1_
  - _Started: 2026-01-13 17:11_
  - _Completed: 2026-01-13 17:24_
  - _Duration: 13m_
  - _Credits: 15.09_

  - [x] 9.2 Write property test for role-based message colors
    - **Property 19: Role-Based Message Colors**
    - **Validates: Requirements 7.1**

  - [x] 9.3 Create ToolCall component
    - Implement tool name display
    - Implement arguments display with wrapping
    - Implement result display
    - Implement expand/collapse for long arguments
    - _Requirements: 7.3, 7.4_

  - [x] 9.4 Write property test for tool call display completeness
    - **Property 20: Tool Call Display Completeness**
    - **Validates: Requirements 7.3**

  - [x] 9.5 Write property test for long argument wrapping
    - **Property 21: Long Argument Wrapping**
    - **Validates: Requirements 7.4**

  - [x] 9.6 Create StreamingIndicator component
    - Implement spinner animation
    - Support different spinner types (dots, line, arc, bounce)
    - Implement configurable text
    - _Requirements: 7.5_

  - [x] 9.7 Create ChatHistory component
    - Implement message list rendering
    - Implement streaming text display
    - Implement Llama animation during waiting
    - Implement scroll management
    - Implement inline diff display for small diffs
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3, 8.4_

  - [x] 9.8 Write property test for diff size threshold
    - **Property 22: Diff Size Threshold**
    - **Validates: Requirements 7.6, 7.7**

  - [x] 9.9 Write property test for tab state preservation
    - **Property 12: Tab State Preservation**
    - **Validates: Requirements 4.4**

- [x] 10. Implement performance metrics
  - [x] 10.1 Create metrics types and interfaces
    - Define InferenceMetrics interface
    - Define SessionStats interface
    - Define MetricsConfig interface
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  - _Started: 2026-01-13 17:26_
  - _Completed: 2026-01-13 17:47_
  - _Duration: 21m_
  - _Credits: 16.70_

  - [x] 10.2 Create MetricsCollector service
    - Implement generation tracking
    - Implement first token recording
    - Implement completion recording
    - Implement session stats aggregation
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 24.1, 24.2, 24.3, 24.4, 24.5_

  - [x] 10.3 Create MetricsDisplay component
    - Implement full metrics display
    - Implement compact metrics display
    - Apply theme colors
    - Support toggle visibility
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [x] 10.4 Write property test for metrics display completeness
    - **Property 25: Metrics Display Completeness**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4**

  - [x] 10.5 Write property test for TTFT conditional display
    - **Property 26: TTFT Conditional Display**
    - **Validates: Requirements 15.5**

  - [x] 10.6 Write property test for compact metrics format
    - **Property 27: Compact Metrics Format**
    - **Validates: Requirements 15.6**

- [x] 11. Implement reasoning model support
  - [x] 11.1 Create ReasoningParser service
    - Implement think block parsing
    - Implement streaming parser with state
    - Extract thinking content and response
    - Handle nested and malformed blocks
    - _Requirements: 16.1_
  - _Started: 2026-01-13 17:53_
  - _Completed: 2026-01-13 18:17_
  - _Duration: 24m_
  - _Credits: 16.86_

  - [x] 11.2 Write property test for reasoning block extraction
    - **Property 28: Reasoning Block Extraction**
    - **Validates: Requirements 16.1**

  - [x] 11.3 Create ReasoningBox component
    - Implement nested scrollable container
    - Implement 8-line visible height with scroll
    - Implement expand/collapse toggle
    - Implement auto-scroll during streaming
    - Implement auto-collapse on completion
    - Support Ctrl+R keyboard shortcut
    - _Requirements: 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 25.2, 25.3_

  - [x] 11.4 Write property test for reasoning box toggle
    - **Property 29: Reasoning Box Toggle**
    - **Validates: Requirements 16.6**

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Started: 2026-01-13 18:21_
  - _Completed: 2026-01-13 18:56_
  - _Duration: 35m_
  - _Credits: 18.37_

- [x] 13. Implement tab components
  - [x] 13.1 Create ChatTab component
    - Integrate ChatHistory component
    - Integrate InputBox component
    - Handle message sending
    - Handle streaming state
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  - _Started: 2026-01-13 19:21_
  - _Completed: 2026-01-13 19:46_
  - _Duration: 25m_
  - _Credits: 20.15_

  - [x] 13.2 Create ToolsTab component
    - Implement pending reviews list
    - Create DiffViewer component with syntax highlighting
    - Create ReviewActions component
    - Implement approve/reject actions
    - Implement batch actions
    - Display tool execution history
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 13.3 Write property test for review list completeness
    - **Property 23: Review List Completeness**
    - **Validates: Requirements 9.1**

  - [x] 13.4 Write property test for review approval removal
    - **Property 24: Review Approval Removal**
    - **Validates: Requirements 9.3, 9.4**

  - [x] 13.5 Create FilesTab component
    - Display context files list
    - Display git status
    - Implement add/remove context files
    - Implement quick git actions
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 13.6 Create SearchTab component (scaffold)
    - Create search input field
    - Create results display placeholder
    - Add note about Stage 11 implementation
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 13.7 Create DocsTab component
    - Create DocsService for loading documentation
    - Create DocViewer component for markdown rendering
    - Create DocNav component for navigation
    - Implement keyboard navigation (j/k, Enter, Backspace)
    - Support internal links
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 13.8 Create SettingsTab component
    - Create ModelPicker component
    - Create ProviderSelector component
    - Create ThemePicker component
    - Create SessionInfo component
    - Create OptionsPanel component
    - Implement quick actions (save, export, clear)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

- [x] 14. Implement launch screen
  - [x] 14.1 Create LaunchScreen component
    - Integrate LlamaAnimation (standard size)
    - Create VersionBanner component
    - Create QuickActions component
    - Create RecentSessions component
    - Implement dismiss on keypress
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  - _Started: 2026-01-13 19:48_
  - _Completed: 2026-01-13 20:02_
  - _Duration: 14m_
  - _Credits: 8.48_

  - [x] 14.2 Implement /home command
    - Add command to return to launch screen
    - _Requirements: 14.6_

- [x] 15. Implement session management commands
  - [x] 15.1 Create session command handlers
    - Implement /new command with confirmation
    - Implement /clear command
    - Implement /compact command
    - Implement /session save command
    - Implement /session list command
    - Implement /session resume command
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 19.9_
  - _Started: 2026-01-13 20:04_
  - _Completed: 2026-01-13 20:12_
  - _Duration: 8m_
  - _Credits: 5.21_

  - [x] 15.2 Write property test for session resume
    - **Property 30: Session Resume**
    - **Validates: Requirements 17.7**

- [x] 16. Implement slash command system
  - [x] 16.1 Create slash command parser and dispatcher
    - Parse slash commands from input
    - Implement command registry
    - Implement command execution
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.11, 19.12_
  - _Started: 2026-01-13 20:13_
  - _Completed: 2026-01-13 20:38_
  - _Duration: 25m_
  - _Credits: 18.14_

  - [x] 16.2 Implement model commands
    - /model list
    - /model use
    - /model pull
    - /model rm
    - /model info
    - _Requirements: 19.2_

  - [x] 16.3 Implement provider commands
    - /provider list
    - /provider use
    - _Requirements: 19.3_

  - [x] 16.4 Implement git commands
    - /git status
    - /git commit
    - /git undo
    - _Requirements: 19.5_

  - [x] 16.5 Implement review commands
    - /review enable
    - /review disable
    - /review pending
    - _Requirements: 19.6_

  - [x] 16.6 Implement extension commands
    - /extensions list
    - /extensions enable
    - /extensions disable
    - _Requirements: 19.7_

  - [x] 16.7 Implement theme commands
    - /theme list
    - /theme use
    - /theme preview
    - _Requirements: 19.8_

  - [x] 16.8 Implement context commands
    - /context
    - /new (already implemented in 15.1)
    - /clear (already implemented in 15.1)
    - /compact (already implemented in 15.1)
    - _Requirements: 19.9_

  - [x] 16.9 Implement metrics commands
    - /metrics
    - /metrics toggle
    - /metrics reset
    - _Requirements: 19.10_

  - [x] 16.10 Implement reasoning commands
    - /reasoning toggle
    - /reasoning expand
    - /reasoning collapse
    - _Requirements: 19.11_

  - [x] 16.11 Implement utility commands
    - /help
    - /exit
    - /home (already implemented in 14.2)
    - _Requirements: 19.12_

  - [x] 16.12 Write property test for command suggestions
    - **Property 33: Command Suggestions**
    - **Validates: Requirements 22.2**

  - [x] 16.13 Write property test for missing argument help
    - **Property 34: Missing Argument Help**
    - **Validates: Requirements 22.3**

- [x] 17. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Started: 2026-01-13 20:39_
  - _Completed: 2026-01-13 20:48_
  - _Duration: 9m_
  - _Credits: 4.52_

- [x] 18. Implement keyboard shortcuts
  - [x] 18.1 Create keyboard input handler
    - Implement shortcut registry
    - Implement shortcut execution
    - Handle shortcut conflicts
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 20.13_
  - _Started: 2026-01-13 20:51_
  - _Completed: 2026-01-13 20:59_
  - _Duration: 8m_
  - _Credits: 8.47_

  - [x] 18.2 Wire up all keyboard shortcuts
    - Ctrl+1-6 for tab switching
    - Ctrl+P for side panel toggle
    - Ctrl+L for clear chat
    - Ctrl+S for save session
    - Ctrl+K for command palette
    - Ctrl+/ for toggle debug
    - Escape for cancel
    - Up arrow for edit previous
    - Enter for send
    - Shift+Enter for newline
    - y/n for approve/reject
    - j/k for scroll (Docs tab)
    - Tab for cycle focus
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 20.13_

- [x] 19. Implement error handling
  - [x] 19.1 Add configuration error handling
    - Display file path and line number for parse errors
    - Display validation errors with paths
    - Show missing field warnings with defaults
    - _Requirements: 22.1_
    - _Started: 2026-01-13 21:26_
    - _Completed: 2026-01-13 22:06_
    - _Duration: 40m_
    - _Credits: 21.06_

  - [x] 19.2 Add GPU monitoring error handling
    - Log warnings for detection failures
    - Fall back to CPU mode silently
    - Retry queries with exponential backoff
    - _Requirements: 22.5_

  - [x] 19.3 Add non-interactive error handling
    - Handle provider connection failures
    - Handle model not found errors
    - Handle timeout errors
    - Handle invalid output format errors
    - _Requirements: 22.4_

  - [x] 19.4 Write property test for connection error display
    - **Property 35: Connection Error Display**
    - **Validates: Requirements 22.4**

  - [x] 19.5 Add UI error handling
    - Implement error boundaries for components
    - Log errors to debug output
    - Display user-friendly error messages
    - _Requirements: 22.5_

- [x] 20. Integration and wiring
  - [x] 20.1 Create main App component
    - Wire up all contexts
    - Wire up launch screen
    - Wire up main interface
    - Handle state transitions
    - _Requirements: All_
  - _Started: 2026-01-13 22:08_
  - _Completed: 2026-01-13 22:20_
  - _Duration: 12m_
  - _Credits: 19.36_

  - [x] 20.2 Integrate GPU monitoring with status bar
    - Start GPU polling on app start
    - Update status bar with GPU info
    - Display warnings for high temperature
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.5_

  - [x] 20.3 Integrate metrics collection with chat
    - Start generation tracking on message send
    - Record first token on streaming start
    - Record completion on streaming end
    - Display metrics under messages
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 20.4 Integrate reasoning parser with chat
    - Parse think blocks during streaming
    - Display reasoning box when detected
    - Handle auto-collapse on completion
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 20.5 Integrate theme system with all components
    - Apply theme to all UI components
    - Support theme switching at runtime
    - Persist theme preference
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [x] 20.6 Wire up configuration to UI
    - Load configuration on startup
    - Apply UI settings from config
    - Apply metrics settings from config
    - Apply reasoning settings from config
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 24.1, 24.2, 24.3, 24.4, 24.5, 25.1, 25.2, 25.3, 25.4, 25.5_

- [x] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Test configuration to UI flow
  - Test GPU monitoring to status bar flow
  - Test chat to metrics flow
  - Test review to tools tab flow
  - Test session management flow
  - Test theme switching flow
  - _Requirements: All_
  - _Started: 2026-01-13 22:22_
  - _Completed: 2026-01-13 22:32_
  - _Duration: 10m_
  - _Credits: 3.40_

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions
- The implementation follows a bottom-up approach: services → components → integration
