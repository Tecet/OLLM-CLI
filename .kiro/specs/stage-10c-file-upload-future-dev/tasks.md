# Implementation Plan: File Upload System

## Overview

This implementation plan breaks down the File Upload System into discrete coding tasks. The system will be built incrementally, starting with core storage and upload functionality, then adding LLM integration, CLI commands, UI components, and finally cleanup and security features. Each task builds on previous work and includes testing to validate correctness early.

## Tasks

- [ ] 1. Set up core upload infrastructure
  - Create directory structure for upload services
  - Define TypeScript interfaces and types
  - Set up testing framework with fast-check
  - _Requirements: All_

- [ ] 2. Implement Storage Manager
  - [ ] 2.1 Create StorageManager class with directory operations
    - Implement getSessionDir, ensureSessionDir, deleteSessionDir
    - Implement writeFile, readFile, deleteFile
    - Implement getSessionSize for storage tracking
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 2.2 Write property test for session directory management
    - **Property 7: Session Directory Management**
    - **Validates: Requirements 6.2, 6.3**

  - [ ] 2.3 Write unit tests for StorageManager
    - Test directory creation and deletion
    - Test file operations with various sizes
    - Test error handling for file system failures
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 3. Implement Manifest Manager
  - [ ] 3.1 Create ManifestManager class
    - Implement load and save operations for manifest.json
    - Implement addUpload and removeUpload
    - Implement findByChecksum for deduplication
    - Calculate and maintain totalSize
    - _Requirements: 6.4, 7.2_

  - [ ] 3.2 Write property test for manifest consistency
    - **Property 1: Upload Storage Consistency** (manifest portion)
    - **Validates: Requirements 6.4**

  - [ ] 3.3 Write unit tests for ManifestManager
    - Test manifest creation and loading
    - Test adding and removing uploads
    - Test checksum lookup
    - _Requirements: 6.4, 7.2_

- [ ] 4. Implement Upload Service core
  - [ ] 4.1 Create UploadService class with upload method
    - Implement file validation (size, type, path)
    - Calculate SHA-256 checksum
    - Check for duplicates using ManifestManager
    - Store file using StorageManager
    - Update manifest with metadata
    - _Requirements: 1.1, 7.1, 7.2, 8.1, 8.2, 11.1, 11.2, 15.1, 15.2_

  - [ ] 4.2 Write property test for upload storage consistency
    - **Property 1: Upload Storage Consistency**
    - **Validates: Requirements 1.1, 6.1, 6.4**

  - [ ] 4.3 Write property test for file deduplication
    - **Property 6: File Deduplication**
    - **Validates: Requirements 7.1, 7.2, 7.4**

  - [ ] 4.4 Write property test for size limit enforcement
    - **Property 4: Size Limit Enforcement**
    - **Validates: Requirements 1.5, 8.1, 8.2, 8.4**

  - [ ] 4.5 Write unit tests for UploadService
    - Test successful upload flow
    - Test duplicate detection (edge case)
    - Test oversized file rejection (edge case)
    - Test invalid MIME type rejection (edge case)
    - _Requirements: 1.1, 1.5, 7.2, 8.1, 8.2, 11.2_

- [ ] 5. Implement configuration loading
  - [ ] 5.1 Create configuration schema and loader
    - Define uploads configuration schema
    - Implement config loading with defaults (10MB, 100MB, 7 days)
    - Support allowed types configuration
    - _Requirements: 8.3, 11.3, 11.4, 12.3_

  - [ ] 5.2 Write property test for configuration loading
    - **Property 9: Configuration Loading with Defaults**
    - **Validates: Requirements 8.3, 11.3, 11.4, 12.3**

  - [ ] 5.3 Write unit tests for configuration
    - Test loading with missing config (defaults)
    - Test loading with partial config
    - Test loading with complete config
    - _Requirements: 8.3, 11.3, 11.4, 12.3_

- [ ] 6. Checkpoint - Ensure core upload tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement MIME type detection
  - [ ] 7.1 Add MIME type detection using magic bytes
    - Integrate file-type library for magic byte detection
    - Implement validation against allowed types
    - _Requirements: 11.1, 11.2_

  - [ ] 7.2 Write property test for MIME type validation
    - **Property 12: MIME Type Validation**
    - **Validates: Requirements 11.1, 11.2**

  - [ ] 7.3 Write unit tests for MIME detection
    - Test detection for common file types
    - Test rejection of disallowed types (edge case)
    - Test handling of files with misleading extensions (edge case)
    - _Requirements: 11.1, 11.2_

- [ ] 8. Implement path sanitization
  - [ ] 8.1 Create path sanitization utilities
    - Implement sanitization to remove `../` sequences
    - Implement validation to reject absolute paths
    - Implement path normalization
    - Add security logging for malicious attempts
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 8.2 Write property test for path traversal protection
    - **Property 14: Path Traversal Protection**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4**

  - [ ] 8.3 Write unit tests for path sanitization
    - Test removal of `../` sequences (edge case)
    - Test rejection of absolute paths (edge case)
    - Test normalization of various path formats
    - Test Unicode filename handling (edge case)
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [ ] 9. Implement Image Processor
  - [ ] 9.1 Create ImageProcessor class
    - Implement image dimension detection
    - Implement image resizing for images > 2048px
    - Implement base64 encoding
    - Handle vision model capability detection
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 9.2 Write property test for image processing
    - **Property 10: Image Processing for Vision Models**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [ ] 9.3 Write unit tests for ImageProcessor
    - Test base64 encoding
    - Test resizing for large images (edge case)
    - Test dimension detection
    - Test handling of corrupted images (edge case)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 10. Implement Text Extractor
  - [ ] 10.1 Create TextExtractor class
    - Implement content extraction from text files
    - Implement language detection from file extension
    - Implement line counting
    - Implement encoding detection
    - Format content as code blocks
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 10.2 Write property test for text extraction
    - **Property 11: Text File Extraction**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

  - [ ] 10.3 Write unit tests for TextExtractor
    - Test language detection for common extensions
    - Test line counting
    - Test encoding detection (UTF-8, ASCII)
    - Test handling of binary files (edge case)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 11. Implement upload deletion operations
  - [ ] 11.1 Add delete and deleteSession methods to UploadService
    - Implement single file deletion
    - Implement session-wide deletion
    - Update manifest and recalculate sizes
    - _Requirements: 5.3, 5.4, 6.3_

  - [ ] 11.2 Write property test for deletion consistency
    - **Property 8: Upload Deletion Consistency**
    - **Validates: Requirements 5.3, 5.4, 5.5**

  - [ ] 11.3 Write unit tests for deletion
    - Test single file deletion
    - Test session-wide deletion
    - Test manifest updates after deletion
    - _Requirements: 5.3, 5.4, 6.3_

- [ ] 12. Checkpoint - Ensure processing and deletion tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement automatic cleanup
  - [ ] 13.1 Create cleanup service
    - Implement scan for expired uploads
    - Implement deletion of old files
    - Implement manifest updates
    - Add logging for cleanup operations
    - _Requirements: 12.1, 12.2, 12.4_

  - [ ] 13.2 Write property test for automatic cleanup
    - **Property 13: Automatic Cleanup**
    - **Validates: Requirements 12.1, 12.2, 12.4**

  - [ ] 13.3 Write unit tests for cleanup
    - Test cleanup of expired uploads
    - Test retention period configuration
    - Test logging of cleanup operations
    - _Requirements: 12.1, 12.2, 12.4_

- [ ] 14. Implement /upload command
  - [ ] 14.1 Create upload command handler
    - Implement `/upload <path>` for single file
    - Implement glob pattern expansion
    - Implement `--paste` flag for clipboard
    - Display confirmation messages
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 14.2 Write property test for glob pattern expansion
    - **Property 2: Glob Pattern Expansion**
    - **Validates: Requirements 1.2**

  - [ ] 14.3 Write property test for clipboard upload
    - **Property 3: Clipboard Upload**
    - **Validates: Requirements 1.3, 3.1, 3.3, 3.4**

  - [ ] 14.4 Write unit tests for upload command
    - Test single file upload
    - Test glob pattern expansion
    - Test clipboard upload
    - Test error messages for failures
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 15. Implement /uploads management commands
  - [ ] 15.1 Create uploads management command handlers
    - Implement `/uploads list` command
    - Implement `/uploads show <id>` command
    - Implement `/uploads delete <id>` command
    - Implement `/uploads clear` command
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 15.2 Write property test for upload list display
    - **Property 15: Upload List Display**
    - **Validates: Requirements 5.1, 5.2, 13.1, 13.2**

  - [ ] 15.3 Write unit tests for management commands
    - Test list command output
    - Test show command output
    - Test delete command
    - Test clear command
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 16. Implement @ mention upload trigger
  - [ ] 16.1 Add @ mention detection and upload trigger
    - Detect `@<file_path>` in messages
    - Trigger upload for mentioned files
    - Replace mention with file reference
    - Display error for non-existent files
    - _Requirements: 2.1, 2.3, 2.4_

  - [ ] 16.2 Write property test for @ mention upload
    - **Property 5: @ Mention Upload Trigger**
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [ ] 16.3 Write unit tests for @ mention
    - Test mention detection
    - Test upload trigger
    - Test mention replacement
    - Test error handling for missing files
    - _Requirements: 2.1, 2.3, 2.4_

- [ ] 17. Implement clipboard paste detection
  - [ ] 17.1 Add clipboard paste detection in input handler
    - Detect Ctrl+V / Cmd+V with image content
    - Display confirmation prompt with file size
    - Trigger upload on confirmation
    - Handle non-image clipboard content
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 17.2 Write unit tests for clipboard detection
    - Test image detection
    - Test confirmation prompt
    - Test upload on confirmation
    - Test fallback for non-image content
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 18. Implement drag-and-drop support
  - [ ] 18.1 Add drag-and-drop detection where supported
    - Detect terminal drag-and-drop capability
    - Display drop zone indicator in supported terminals
    - Handle file drop events
    - Display fallback message in unsupported terminals
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 18.2 Write unit tests for drag-and-drop
    - Test capability detection
    - Test file drop handling
    - Test fallback message
    - _Requirements: 4.3, 4.4_

- [ ] 19. Checkpoint - Ensure CLI command tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Implement uploads UI section
  - [ ] 20.1 Create UploadsSection component for side panel
    - Display list of uploads with name, size, icon
    - Add delete button for each upload
    - Show upload count in header
    - Display progress indicator during upload
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [ ] 20.2 Write unit tests for UploadsSection
    - Test upload list rendering
    - Test delete button functionality
    - Test progress indicator display
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 21. Implement upload progress feedback
  - [ ] 21.1 Add progress indicators for uploads
    - Display progress indicator when upload begins
    - Show filename in progress indicator
    - Display success message on completion
    - Display error message with reason on failure
    - _Requirements: 14.1, 14.3, 14.4_

  - [ ] 21.2 Write unit tests for progress feedback
    - Test progress indicator display
    - Test success message
    - Test error message with reason
    - _Requirements: 14.1, 14.3, 14.4_

- [ ] 22. Wire upload system into chat flow
  - [ ] 22.1 Integrate uploads into message sending
    - Include uploaded images as image_url content parts
    - Include uploaded text files as code blocks
    - Handle vision vs non-vision model differences
    - _Requirements: 9.3, 9.4, 10.3_

  - [ ] 22.2 Write integration tests for LLM integration
    - Test image uploads with vision models
    - Test text uploads with code models
    - Test fallback for non-vision models
    - _Requirements: 9.3, 9.4, 10.3_

- [ ] 23. Add startup cleanup
  - [ ] 23.1 Integrate cleanup into application startup
    - Run cleanup on application start
    - Use configured retention period
    - Log cleanup results
    - _Requirements: 12.1, 12.2, 12.4_

  - [ ] 23.2 Write integration tests for startup cleanup
    - Test cleanup runs on startup
    - Test old files are deleted
    - Test logging
    - _Requirements: 12.1, 12.2, 12.4_

- [ ] 24. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100 iterations minimum
- Unit tests validate specific examples and edge cases
- Integration tests verify the system works with external dependencies
- The implementation uses TypeScript with fast-check for property-based testing
- New dependencies required: `clipboardy`, `file-type`, `sharp` (optional for image resizing)
