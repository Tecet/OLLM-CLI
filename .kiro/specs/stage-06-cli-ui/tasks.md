# Implementation Plan: CLI and UI

## Overview

This implementation plan breaks down the CLI and UI feature into discrete coding tasks. The approach follows a bottom-up strategy: build core services first (configuration, GPU monitoring), then UI components, then integrate everything into the full application. Each task builds on previous work and includes testing to validate functionality early.

## Tasks

- [ ] 1. Set up CLI package structure and configuration system
  - Create directory structure for CLI package
  - Set up TypeScript configuration
  - Create configuration schema and types
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 1.1 Implement configuration loader with layered resolution
  - Create ConfigLoader class with merge logic
  - Implement precedence rules (system → user → workspace → env → CLI)
  - Add YAML/JSON parsing with error handling
  - _Requirements: 1.1, 1.2_

- [ ] 1.2 Write property test for configuration precedence
  - **Property 1: Configuration Precedence**
  - **Validates: Requirements 1.1**

- [ ] 1.3 Implement configuration validation with JSON schema
  - Create JSON schema for AppConfig
  - Integrate Ajv validator
  - Generate detailed validation error messages
  - _Requirements: 1.3, 1.5_

- [ ] 1.4 Write property test for configuration validation
  - **Property 2: Configuration Error Messages Include Path**
  - **Property 3: Configuration Validation Before Application**
  - **Validates: Requirements 1.2, 1.3, 1.5**

- [ ] 2. Implement GPU monitoring service
  - Create GPUMonitor service with platform detection
  - Implement NVIDIA command execution and parsing
  - Implement AMD command execution and parsing
  - Implement Apple/CPU fallback
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 2.1 Write unit tests for GPU platform detection
  - Test NVIDIA detection and parsing
  - Test AMD detection and parsing
  - Test Apple/CPU fallback
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 2.2 Implement GPU polling and callbacks
  - Add polling mechanism with configurable interval
  - Implement threshold callbacks (high temp, low VRAM)
  - Add start/stop controls
  - _Requirements: 2.5, 2.6, 2.7, 2.8_

- [ ] 2.3 Write property tests for GPU monitoring
  - **Property 4: GPU Polling Interval**
  - **Property 5: GPU Threshold Callbacks**
  - **Property 6: GPU Polling Stops**
  - **Validates: Requirements 2.5, 2.6, 2.7, 2.8**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement non-interactive runner
  - Create NonInteractiveRunner class
  - Implement single-turn execution with --prompt flag
  - Add stdin piping support
  - _Requirements: 3.1, 3.6_

- [ ] 4.1 Write property test for non-interactive execution
  - **Property 7: Non-Interactive Single Turn**
  - **Property 10: Stdin Piping**
  - **Validates: Requirements 3.1, 3.6**

- [ ] 4.2 Implement output formatters
  - Create text output formatter
  - Create JSON output formatter
  - Create stream-json output formatter
  - _Requirements: 3.2, 3.3, 3.4_

- [ ] 4.3 Write property test for output formats
  - **Property 8: Output Format Correctness**
  - **Validates: Requirements 3.2, 3.3, 3.4**

- [ ] 4.4 Implement error handling for non-interactive mode
  - Add stderr error output
  - Add exit code handling
  - _Requirements: 3.5_

- [ ] 4.5 Write property test for error handling
  - **Property 9: Error Exit Codes**
  - **Validates: Requirements 3.5**

- [ ] 5. Implement theme system
  - Create theme configuration with dark mode colors
  - Define role colors (user, assistant, system, tool)
  - Define status colors (success, warning, error, info)
  - Define diff colors (added, removed)
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [ ] 5.1 Write property test for theme colors
  - **Property 42: Theme Color Application**
  - **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5**

- [ ] 6. Implement core UI layout components
  - Create AppContainer with layout structure
  - Create TabBar component with 6 tabs
  - Create StatusBar component
  - Create InputBox component
  - _Requirements: 4.1, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ] 6.1 Implement tab navigation and keyboard shortcuts
  - Add Ctrl+1-6 shortcuts for tab switching
  - Implement tab state preservation
  - Add notification badges
  - _Requirements: 4.2, 4.3, 4.4_

- [ ] 6.2 Write property tests for tab navigation
  - **Property 11: Tab Keyboard Shortcuts**
  - **Property 12: Tab Badges**
  - **Property 13: Tab State Preservation**
  - **Validates: Requirements 4.2, 4.3, 4.4**

- [ ] 6.3 Implement status bar components
  - Add connection status indicator
  - Add model name display
  - Add token usage display
  - Add git status display
  - Add GPU info display with fallback
  - Add review count display
  - Add cost estimate display
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

- [ ] 6.4 Write property tests for status bar
  - **Property 18: Status Bar Connection Indicator**
  - **Property 19: Status Bar Component Display**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9**

- [ ] 7. Implement side panel component
  - Create SidePanel with collapsible sections
  - Add Ctrl+P toggle functionality
  - Implement width adjustment logic
  - _Requirements: 5.1, 5.2_

- [ ] 7.1 Write property tests for side panel
  - **Property 14: Side Panel Toggle**
  - **Property 15: Side Panel Width Adjustment**
  - **Validates: Requirements 5.1, 5.2**

- [ ] 7.2 Implement side panel sections
  - Create ContextSection for @-mentioned files
  - Create GitSection for git status
  - Create ReviewSection for pending reviews
  - Create ToolsSection for active tools
  - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 7.3 Write property tests for side panel updates
  - **Property 16: Side Panel Reactive Updates**
  - **Validates: Requirements 5.4, 5.5, 5.6, 5.7**

- [ ] 7.4 Implement side panel persistence
  - Save visibility preference to config
  - Restore preference on launch
  - _Requirements: 5.8_

- [ ] 7.5 Write property test for side panel persistence
  - **Property 17: Side Panel Persistence**
  - **Validates: Requirements 5.8**

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement chat interface components
  - Create ChatHistory component
  - Create Message component with role colors
  - Create StreamingIndicator with spinner
  - Create ToolCall display component
  - _Requirements: 7.1, 7.2, 7.4_

- [ ] 9.1 Write property tests for chat display
  - **Property 20: Message Role Colors**
  - **Property 22: Tool Call Display Completeness**
  - **Validates: Requirements 7.1, 7.4**

- [ ] 9.2 Implement streaming and incremental rendering
  - Add streaming text display
  - Implement incremental rendering
  - _Requirements: 7.3_

- [ ] 9.3 Write property test for streaming
  - **Property 21: Streaming Incremental Rendering**
  - **Validates: Requirements 7.3**

- [ ] 9.4 Implement tool argument wrapping and inline diffs
  - Add 80-character wrapping with expand option
  - Add inline diff preview for small changes (≤5 lines)
  - _Requirements: 7.5, 7.6_

- [ ] 9.5 Write property tests for wrapping and diffs
  - **Property 23: Tool Argument Wrapping**
  - **Property 24: Inline Diff Threshold**
  - **Validates: Requirements 7.5, 7.6**

- [ ] 9.6 Implement input box with keyboard handling
  - Add Enter to send message
  - Add Shift+Enter for newline
  - _Requirements: 7.7, 7.8_

- [ ] 9.7 Write unit tests for input handling
  - Test Enter sends message
  - Test Shift+Enter adds newline
  - _Requirements: 7.7, 7.8_

- [ ] 10. Implement Tools tab
  - Create ToolsTab component
  - Create DiffViewer component with syntax highlighting
  - Create ReviewActions component
  - _Requirements: 8.1, 8.2_

- [ ] 10.1 Write property tests for Tools tab
  - **Property 25: Pending Reviews Display**
  - **Property 26: Diff Color Coding**
  - **Validates: Requirements 8.1, 8.2**

- [ ] 10.2 Implement review actions
  - Add Apply action
  - Add Reject action
  - Add Apply All and Reject All batch actions
  - _Requirements: 8.3, 8.4, 8.5_

- [ ] 10.3 Write property tests for review actions
  - **Property 27: Review Actions**
  - **Property 28: Batch Review Actions**
  - **Validates: Requirements 8.3, 8.4, 8.5**

- [ ] 10.4 Implement tool execution history
  - Add history display with expand/collapse
  - _Requirements: 8.6_

- [ ] 10.5 Write property test for tool history
  - **Property 29: Tool History Display**
  - **Validates: Requirements 8.6**

- [ ] 11. Implement Files tab
  - Create FilesTab component
  - Add context files list display
  - Add git status display
  - Add file removal action
  - Add quick git actions
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 11.1 Write property tests for Files tab
  - **Property 30: Context Files Display**
  - **Property 31: Git Status Display**
  - **Validates: Requirements 9.1, 9.2**

- [ ] 11.2 Write unit tests for file actions
  - Test file removal
  - Test git actions availability
  - _Requirements: 9.3, 9.4_

- [ ] 12. Implement documentation service and Docs tab
  - Create DocsService for indexing and rendering
  - Create DocsTab component
  - Create DocViewer component
  - Create DocNav component
  - _Requirements: 10.1, 10.2_

- [ ] 12.1 Write property tests for Docs tab
  - **Property 32: Documentation Navigation**
  - **Property 33: Documentation Rendering**
  - **Property 34: Documentation Links**
  - **Property 35: Documentation History**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.6**

- [ ] 12.2 Write unit tests for docs keyboard navigation
  - Test j/k scrolling
  - Test Enter to open
  - Test Backspace to go back
  - _Requirements: 10.4, 10.5, 10.6_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement Settings tab
  - Create SettingsTab component
  - Create ModelPicker component
  - Create SessionInfo component
  - Add option controls (temperature, max tokens, review mode)
  - Add quick actions (save, export, clear)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 14.1 Write property tests for Settings tab
  - **Property 36: Model Picker Display**
  - **Property 37: Model Selection**
  - **Property 38: Session Info Display**
  - **Property 39: Settings Immediate Application**
  - **Validates: Requirements 11.1, 11.2, 11.3, 11.5**

- [ ] 14.2 Write unit tests for settings controls
  - Test option controls
  - Test quick actions
  - _Requirements: 11.4, 11.6_

- [ ] 15. Implement Launch Screen
  - Create LaunchScreen component
  - Load ASCII art from docs/OLLM_v01.txt
  - Add version display
  - Add recent sessions list
  - Add quick action hints
  - Implement dismissal on keypress
  - Add /home command support
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [ ] 15.1 Write property tests for Launch Screen
  - **Property 40: Recent Sessions Display**
  - **Property 41: Launch Screen Dismissal**
  - **Validates: Requirements 12.3, 12.5**

- [ ] 15.2 Write unit tests for Launch Screen display
  - Test ASCII art loading
  - Test version display
  - Test quick action hints
  - Test /home command
  - _Requirements: 12.1, 12.2, 12.4, 12.6_

- [ ] 16. Implement slash command system
  - Create SlashCommandHandler
  - Implement command parsing
  - Implement all slash commands:
    - /model list|use|pull|rm|info
    - /provider list|use
    - /session list|resume|delete|save|export
    - /git status|commit|undo
    - /review enable|disable|pending
    - /extensions list|enable|disable
    - /context
    - /clear
    - /help
    - /exit
    - /home
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

- [ ] 16.1 Write unit tests for slash commands
  - Test each command parses correctly
  - Test each command executes correctly
  - Test invalid commands show help
  - _Requirements: 13.1-13.10_

- [ ] 17. Implement CLI flag parsing
  - Set up yargs or commander for argument parsing
  - Implement all CLI flags:
    - --prompt/-p
    - --model/-m
    - --provider
    - --host
    - --list-models
    - --pull-model
    - --remove-model
    - --model-info
    - --output/-o
    - --review-diffs
    - --no-review
    - --debug
    - --no-color
    - --config/-c
    - --session/-s
    - --version/-v
    - --help/-h
  - _Requirements: 14.1-14.12_

- [ ] 17.1 Write unit tests for CLI flags
  - Test each flag parses correctly
  - Test flag precedence over config
  - Test help and version flags
  - _Requirements: 14.1-14.12_

- [ ] 18. Implement keyboard shortcuts system
  - Register all keyboard shortcuts:
    - Ctrl+1-6 (tab switching)
    - Ctrl+P (toggle panel)
    - Ctrl+L (clear chat)
    - Ctrl+S (save session)
    - Ctrl+K (command palette)
    - Esc (cancel/return)
    - Tab (cycle focus)
    - j/k (scroll in Docs)
  - _Requirements: 15.1-15.8_

- [ ] 18.1 Write unit tests for keyboard shortcuts
  - Test each shortcut triggers correct action
  - Test shortcuts don't conflict
  - _Requirements: 15.1-15.8_

- [ ] 19. Implement comprehensive error handling
  - Add error handling for config loading
  - Add error handling for model loading
  - Add error handling for tool execution
  - Add error handling for GPU monitoring
  - Add error handling for invalid commands
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 19.1 Write property test for error messages
  - **Property 43: Error Message Completeness**
  - **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**

- [ ] 20. Integration and wiring
  - Wire all components together in AppContainer
  - Connect configuration to all components
  - Connect GPU monitor to status bar
  - Connect chat client to chat interface
  - Connect tool handler to Tools tab
  - Connect git service to Files tab and side panel
  - Connect docs service to Docs tab
  - Test end-to-end flows
  - _Requirements: All_

- [ ] 20.1 Write integration tests
  - Test launch → chat → tool call → review → apply flow
  - Test launch → settings → model switch → chat flow
  - Test launch → docs → navigate → back flow
  - Test non-interactive with various flags
  - _Requirements: All_

- [ ] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: services → components → integration
- GPU monitoring gracefully falls back to CPU mode on errors
- Configuration loading has clear precedence rules
- All UI components use the dark theme
- Keyboard shortcuts are configurable via config file
- All tests are required for comprehensive validation from the start
