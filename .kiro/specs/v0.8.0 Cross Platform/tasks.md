# Implementation Plan: Cross-Platform Support

## Overview

This implementation plan breaks down the cross-platform support feature into discrete coding tasks. The approach follows a bottom-up strategy: build foundational utilities first (platform detection, path handling), then implement platform-specific components (config paths, GPU monitoring, terminal capabilities), and finally integrate everything with the existing codebase.

## Tasks

- [ ] 1. Create platform detection utilities
  - Create `packages/core/src/utils/platform.ts` with PlatformInfo interface and getPlatformInfo() function
  - Implement platform detection using process.platform
  - Implement Unicode support detection for Windows terminals
  - Cache platform info for performance
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ]\* 1.1 Write property test for platform detection consistency
  - **Property 1: Platform detection consistency**
  - **Validates: Requirements 1.1, 1.6**

- [ ]\* 1.2 Write unit tests for platform-specific values
  - Test shell, shellFlag, pythonCommand on current platform
  - Test boolean flags match os field
  - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Create path normalization utilities
  - Create `packages/core/src/utils/paths.ts` with path normalization functions
  - Implement normalizeForDisplay() to convert backslashes to forward slashes
  - Implement toNativePath() to use platform-native separators
  - Implement joinPath() wrapper around path.join()
  - Implement resolvePath() to handle mixed separators
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]\* 2.1 Write property test for display path normalization
  - **Property 8: Display paths use forward slashes**
  - **Validates: Requirements 6.1, 10.4**

- [ ]\* 2.2 Write property test for native path conversion
  - **Property 9: Native paths use platform separator**
  - **Validates: Requirements 6.2, 6.5**

- [ ]\* 2.3 Write property test for path joining with mixed separators
  - **Property 10: Path joining handles mixed separators**
  - **Validates: Requirements 6.4**

- [ ]\* 2.4 Write property test for absolute path validation
  - **Property 17: Config paths are absolute**
  - **Validates: Requirements 2.1-2.7**

- [ ] 3. Implement cross-platform config path resolution
  - Create `packages/core/src/config/paths.ts` with ConfigPaths interface
  - Implement getConfigPaths() with platform-specific logic
  - Implement Windows paths using APPDATA and LOCALAPPDATA
  - Implement macOS paths using Library directories
  - Implement Linux paths using XDG Base Directory spec
  - Implement getLegacyConfigPath() for backward compatibility
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ]\* 3.1 Write property test for XDG environment variable override
  - **Property 12: XDG environment variables override defaults**
  - **Validates: Requirements 2.5, 2.6, 2.7, 9.4, 9.5, 9.6**

- [ ]\* 3.2 Write unit tests for platform-specific config paths
  - Test Windows APPDATA paths
  - Test macOS Library paths
  - Test Linux XDG paths with and without env vars
  - Test legacy path detection
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement terminal capability detection
  - Create `packages/cli/src/utils/terminal.ts` with TerminalCapabilities interface
  - Implement getTerminalCapabilities() function
  - Implement color support detection (NO_COLOR, FORCE_COLOR, COLORTERM, TERM)
  - Implement Unicode support detection for Windows
  - Implement terminal dimension detection
  - Create icons object with Unicode and ASCII fallbacks
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [ ]\* 5.1 Write property test for NO_COLOR disabling color
  - **Property 2: NO_COLOR disables color**
  - **Validates: Requirements 3.2, 9.2**

- [ ]\* 5.2 Write property test for COLORTERM enabling true color
  - **Property 3: COLORTERM enables true color**
  - **Validates: Requirements 3.3**

- [ ]\* 5.3 Write property test for TERM 256color support
  - **Property 4: TERM 256color enables 256-color**
  - **Validates: Requirements 3.4**

- [ ]\* 5.4 Write property test for non-TTY disabling color
  - **Property 5: Non-TTY disables color**
  - **Validates: Requirements 3.1**

- [ ]\* 5.5 Write property test for FORCE_COLOR enabling color
  - **Property 13: FORCE_COLOR enables color**
  - **Validates: Requirements 9.3**

- [ ]\* 5.6 Write property test for Unicode fallback ASCII characters
  - **Property 6: Unicode fallback provides ASCII**
  - **Validates: Requirements 3.9, 8.2**

- [ ]\* 5.7 Write property test for color hierarchy consistency
  - **Property 16: Color hierarchy consistency**
  - **Validates: Requirements 3.3, 3.4**

- [ ]\* 5.8 Write unit tests for terminal capability detection
  - Test with various TERM values
  - Test Windows-specific environment variables
  - Test icon fallbacks
  - _Requirements: 3.5, 3.6, 3.7, 3.8_

- [ ] 6. Implement cross-platform GPU monitoring
  - Update `packages/core/src/services/gpuMonitor.ts` with platform-specific logic
  - Implement queryWindowsGPU() for Windows nvidia-smi paths
  - Implement queryLinuxGPU() for nvidia-smi and rocm-smi
  - Implement queryMacGPU() for Apple Silicon
  - Implement getCPUFallback() for when GPU is unavailable
  - Add error handling to never throw exceptions
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ]\* 6.1 Write property test for GPU monitoring never throwing
  - **Property 7: GPU monitoring never throws**
  - **Validates: Requirements 4.6, 4.7, 8.1**

- [ ]\* 6.2 Write property test for NVIDIA_SMI_PATH override
  - **Property 11: Environment variable override for GPU path**
  - **Validates: Requirements 4.2, 9.1**

- [ ]\* 6.3 Write property test for VRAM usage constraint
  - **Property 18: VRAM usage constraint**
  - **Validates: Requirements 4.1-4.5**

- [ ]\* 6.4 Write unit tests for platform-specific GPU monitoring
  - Mock nvidia-smi output on Windows and Linux
  - Mock rocm-smi output on Linux
  - Test CPU fallback behavior
  - Test with invalid GPU tool output
  - _Requirements: 4.1, 4.3, 4.4, 4.5_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Update shell executor for cross-platform support
  - Update `packages/core/src/sandbox/executor.ts` to use platform info
  - Update BashExecutor to use platform-specific shell and flags
  - Update PythonExecutor to use platform-specific Python command
  - Handle temporary file creation with platform-appropriate line endings
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]\* 8.1 Write unit tests for shell executor platform behavior
  - Test correct shell and flags on current platform
  - Test correct Python command on current platform
  - Test temporary file creation
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 9. Implement graceful degradation and fallback behavior
  - Update components to handle missing platform-specific tools
  - Add logging for warnings when tools are unavailable
  - Ensure system continues operating with fallbacks
  - Implement default values when environment variables are unset
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ]\* 9.1 Write property test for missing tools triggering fallback
  - **Property 14: Missing tools trigger fallback**
  - **Validates: Requirements 8.4**

- [ ]\* 9.2 Write property test for undefined environment variables using defaults
  - **Property 15: Undefined environment variables use defaults**
  - **Validates: Requirements 8.5**

- [ ]\* 9.3 Write unit tests for graceful degradation
  - Test GPU monitoring with missing tools
  - Test terminal capabilities with minimal environment
  - Test config paths with no environment variables
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [ ] 10. Update existing code to use new platform utilities
  - Update config loading to use getConfigPaths()
  - Update file operations to use path normalization utilities
  - Update UI components to use terminal capability detection
  - Update GPU monitoring integration to use new cross-platform implementation
  - Ensure consistent path display throughout the application
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ]\* 10.1 Write integration tests for cross-platform behavior
  - Test config loading on current platform
  - Test file operations with mixed path separators
  - Test UI rendering with terminal capabilities
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 11. Set up CI matrix for cross-platform testing
  - Update `.github/workflows/test.yml` to run on Windows, macOS, Linux
  - Configure matrix for Node.js versions 18, 20, 22
  - Ensure all tests pass on all platforms
  - _Requirements: 7.1, 7.2_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Run full test suite on current platform
  - Verify all property tests pass with 100+ iterations
  - Verify all unit tests pass
  - Verify integration tests pass
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Integration tests verify cross-platform behavior in realistic scenarios
- CI matrix testing ensures all platforms are validated automatically
