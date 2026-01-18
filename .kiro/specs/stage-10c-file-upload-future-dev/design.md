# Design Document: File Upload System

## Overview

The File Upload System provides a comprehensive solution for sharing files with LLMs through the terminal interface. It supports multiple upload methods (slash commands, @ mentions, clipboard paste, drag-and-drop), manages files in session-scoped storage, and integrates uploaded content into LLM conversations. The system handles images for vision models and text extraction for code files, with automatic cleanup and security protections.

The design follows a layered architecture with clear separation between upload methods, storage management, and LLM integration. Files are stored locally in `~/.ollm/uploads/{sessionId}/` with a manifest tracking metadata, checksums for deduplication, and configurable retention policies.

## Architecture

The system consists of three primary layers:

1. **Upload Layer**: Handles multiple input methods (commands, clipboard, drag-drop, mentions)
2. **Storage Layer**: Manages file persistence, deduplication, and cleanup
3. **Integration Layer**: Processes files for LLM consumption (base64 encoding, text extraction)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Upload Methods                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ /upload cmd  │  │  @ mention   │  │  clipboard   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
│         └──────────────────┴──────────────────┘                  │
│                            │                                      │
├────────────────────────────┼──────────────────────────────────────┤
│                    Upload Service Core                           │
│  ┌─────────────────────────┴─────────────────────────┐          │
│  │  - File validation (type, size, path)             │          │
│  │  - Checksum calculation (SHA-256)                 │          │
│  │  - Deduplication check                            │          │
│  │  - Manifest management                            │          │
│  └─────────────────────────┬─────────────────────────┘          │
├────────────────────────────┼──────────────────────────────────────┤
│                      Storage Manager                             │
│  ┌─────────────────────────┴─────────────────────────┐          │
│  │  - Session directory management                    │          │
│  │  - File persistence                                │          │
│  │  - Cleanup (retention, session deletion)          │          │
│  │  - Storage limit enforcement                       │          │
│  └─────────────────────────┬─────────────────────────┘          │
├────────────────────────────┼──────────────────────────────────────┤
│                     LLM Integration                              │
│  ┌─────────────────────────┴─────────────────────────┐          │
│  │  Image Processor          Text Extractor          │          │
│  │  - Resize (max 2048px)    - Language detection    │          │
│  │  - Base64 encoding        - Code block formatting │          │
│  │  - Vision model check     - Metadata extraction   │          │
│  └────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Upload Service

The core service managing file uploads and metadata.

```typescript
interface UploadedFile {
  id: string;                    // UUID v4
  sessionId: string;             // Parent session ID
  originalName: string;          // Original filename
  storagePath: string;           // Absolute path in uploads dir
  mimeType: string;              // Detected MIME type
  size: number;                  // File size in bytes
  uploadedAt: Date;              // Upload timestamp
  checksum: string;              // SHA-256 hash
  metadata: {
    width?: number;              // Image width in pixels
    height?: number;             // Image height in pixels
    lineCount?: number;          // Line count for text files
    language?: string;           // Detected programming language
  };
}

interface UploadService {
  /**
   * Upload a file to the session storage
   * @throws UploadError if validation fails or storage limit exceeded
   */
  upload(
    sessionId: string,
    file: Buffer,
    filename: string
  ): Promise<UploadedFile>;

  /**
   * Get upload metadata by ID
   */
  get(id: string): Promise<UploadedFile | null>;

  /**
   * List all uploads for a session
   */
  list(sessionId: string): Promise<UploadedFile[]>;

  /**
   * Delete a specific upload
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all uploads for a session
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * Clean up uploads older than the specified date
   * @returns Number of files deleted
   */
  cleanup(olderThan: Date): Promise<number>;
}
```

### Storage Manager

Handles file system operations and directory management.

```typescript
interface StorageManager {
  /**
   * Get the upload directory path for a session
   */
  getSessionDir(sessionId: string): string;

  /**
   * Ensure session directory exists
   */
  ensureSessionDir(sessionId: string): Promise<void>;

  /**
   * Write file to session directory
   * @returns Absolute path to stored file
   */
  writeFile(
    sessionId: string,
    filename: string,
    content: Buffer
  ): Promise<string>;

  /**
   * Read file from session directory
   */
  readFile(sessionId: string, filename: string): Promise<Buffer>;

  /**
   * Delete file from session directory
   */
  deleteFile(sessionId: string, filename: string): Promise<void>;

  /**
   * Delete entire session directory
   */
  deleteSessionDir(sessionId: string): Promise<void>;

  /**
   * Get total storage used by a session
   */
  getSessionSize(sessionId: string): Promise<number>;
}
```

### Manifest Manager

Manages the manifest.json file tracking uploads per session.

```typescript
interface Manifest {
  sessionId: string;
  uploads: UploadedFile[];
  totalSize: number;
  lastUpdated: Date;
}

interface ManifestManager {
  /**
   * Load manifest for a session
   */
  load(sessionId: string): Promise<Manifest>;

  /**
   * Save manifest for a session
   */
  save(manifest: Manifest): Promise<void>;

  /**
   * Add upload to manifest
   */
  addUpload(sessionId: string, upload: UploadedFile): Promise<void>;

  /**
   * Remove upload from manifest
   */
  removeUpload(sessionId: string, uploadId: string): Promise<void>;

  /**
   * Find upload by checksum (for deduplication)
   */
  findByChecksum(sessionId: string, checksum: string): Promise<UploadedFile | null>;
}
```

### Image Processor

Processes images for vision models.

```typescript
interface ImageProcessor {
  /**
   * Process image for LLM consumption
   * - Resize if larger than maxDimension
   * - Encode as base64
   */
  process(
    imageBuffer: Buffer,
    options?: {
      maxDimension?: number;  // Default: 2048
      quality?: number;        // Default: 85
    }
  ): Promise<ProcessedImage>;

  /**
   * Get image dimensions
   */
  getDimensions(imageBuffer: Buffer): Promise<{ width: number; height: number }>;
}

interface ProcessedImage {
  base64: string;              // data:image/png;base64,...
  mimeType: string;
  originalSize: number;
  processedSize: number;
  dimensions: {
    width: number;
    height: number;
  };
}
```

### Text Extractor

Extracts and formats text content from code files.

```typescript
interface TextExtractor {
  /**
   * Extract text content from file
   */
  extract(
    fileBuffer: Buffer,
    filename: string
  ): Promise<ExtractedText>;

  /**
   * Detect programming language from filename
   */
  detectLanguage(filename: string): string | null;
}

interface ExtractedText {
  content: string;
  language: string | null;
  lineCount: number;
  encoding: string;            // e.g., 'utf-8'
}
```

### Upload Commands

CLI command handlers for upload operations.

```typescript
interface UploadCommands {
  /**
   * Handle /upload command
   */
  handleUpload(args: {
    path?: string;
    paste?: boolean;
    sessionId: string;
  }): Promise<void>;

  /**
   * Handle /uploads list command
   */
  handleList(sessionId: string): Promise<void>;

  /**
   * Handle /uploads show command
   */
  handleShow(uploadId: string): Promise<void>;

  /**
   * Handle /uploads delete command
   */
  handleDelete(uploadId: string): Promise<void>;

  /**
   * Handle /uploads clear command
   */
  handleClear(sessionId: string): Promise<void>;
}
```

## Data Models

### File Storage Structure

```
~/.ollm/
└── uploads/
    └── {session-id}/
        ├── manifest.json
        ├── {uuid-1}.png
        ├── {uuid-2}.ts
        └── {uuid-3}.log
```

### Manifest Format

```json
{
  "sessionId": "session-abc123",
  "uploads": [
    {
      "id": "upload-uuid-1",
      "sessionId": "session-abc123",
      "originalName": "screenshot.png",
      "storagePath": "/home/user/.ollm/uploads/session-abc123/upload-uuid-1.png",
      "mimeType": "image/png",
      "size": 1258291,
      "uploadedAt": "2026-01-15T10:30:00Z",
      "checksum": "sha256:abc123...",
      "metadata": {
        "width": 1920,
        "height": 1080
      }
    }
  ],
  "totalSize": 1258291,
  "lastUpdated": "2026-01-15T10:30:00Z"
}
```

### Configuration Schema

```yaml
uploads:
  maxFileSize: 10485760          # 10MB in bytes
  maxSessionSize: 104857600      # 100MB in bytes
  retentionDays: 7               # Auto-cleanup after 7 days
  allowedTypes:
    - "image/*"
    - "text/*"
    - "application/json"
  imageProcessing:
    maxDimension: 2048           # Resize images larger than this
    quality: 85                  # JPEG quality (1-100)
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Upload Storage Consistency
*For any* valid file and session, when a file is uploaded, the file should exist in the session directory, appear in the manifest with correct metadata, and the manifest total size should equal the sum of all upload sizes.
**Validates: Requirements 1.1, 6.1, 6.4**

### Property 2: Glob Pattern Expansion
*For any* glob pattern and directory structure, when uploading with a glob pattern, all files matching the pattern should be uploaded and none that don't match should be uploaded.
**Validates: Requirements 1.2**

### Property 3: Clipboard Upload
*For any* clipboard content, when executing upload with --paste flag, if the clipboard contains an image it should be uploaded, otherwise the operation should fail gracefully.
**Validates: Requirements 1.3, 3.1, 3.3, 3.4**

### Property 4: Size Limit Enforcement
*For any* file, when the file size exceeds the configured per-file limit or would cause the session to exceed the per-session limit, the upload should be rejected with an error message containing the limit and current usage.
**Validates: Requirements 1.5, 8.1, 8.2, 8.4**

### Property 5: @ Mention Upload Trigger
*For any* message containing `@<file_path>`, when the file exists, the system should trigger an upload and replace the mention with a file reference; when the file doesn't exist, the system should display an error and not send the message.
**Validates: Requirements 2.1, 2.3, 2.4**

### Property 6: File Deduplication
*For any* file uploaded multiple times to the same session, when the checksum matches an existing upload, only one copy should be stored on disk, the manifest should reference the same file, and reference counts should be maintained correctly.
**Validates: Requirements 7.1, 7.2, 7.4**

### Property 7: Session Directory Management
*For any* session, when the session is created, an upload directory should be created; when files are uploaded, they should be stored in that directory; when the session is deleted, the entire directory and all files should be removed.
**Validates: Requirements 6.2, 6.3**

### Property 8: Upload Deletion Consistency
*For any* upload deletion operation (single file or clear all), the files should be removed from disk, the manifest should be updated to remove the entries, and the total size should be recalculated correctly.
**Validates: Requirements 5.3, 5.4, 5.5**

### Property 9: Configuration Loading with Defaults
*For any* configuration file state (missing, partial, or complete), the system should load configured values when present and use default values (10MB per file, 100MB per session, 7 day retention, image/text/json types) when not specified.
**Validates: Requirements 8.3, 11.3, 11.4, 12.3**

### Property 10: Image Processing for Vision Models
*For any* image upload, when the current model supports vision, the image should be resized if larger than 2048px, encoded as base64, and included as an image_url content part; when the model doesn't support vision, a text description should be included instead.
**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Property 11: Text File Extraction
*For any* text or code file upload, the system should extract the content, detect the programming language from the extension, format it as a code block, and include metadata (line count, language).
**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 12: MIME Type Validation
*For any* file upload, the system should detect the MIME type using magic bytes (not just extension), and reject files whose MIME type is not in the allowed types list.
**Validates: Requirements 11.1, 11.2**

### Property 13: Automatic Cleanup
*For any* set of uploads, when the application starts or cleanup is triggered, all uploads older than the retention period should be deleted, manifests should be updated, and the number of deleted files should be logged.
**Validates: Requirements 12.1, 12.2, 12.4**

### Property 14: Path Traversal Protection
*For any* file path provided by the user, the system should sanitize the path to remove directory traversal sequences (`../`), reject absolute paths outside the upload directory, normalize the path, and log security warnings for malicious attempts.
**Validates: Requirements 15.1, 15.2, 15.3, 15.4**

### Property 15: Upload List Display
*For any* session with uploads, when listing uploads, all uploads should be displayed with name, size, upload time, and file type icon; when showing a specific upload, all metadata should be displayed.
**Validates: Requirements 5.1, 5.2, 13.1, 13.2**

## Error Handling

### Upload Errors

The system handles various upload error conditions:

1. **File Not Found**: When a specified file path doesn't exist
   - Error: `UploadError: File not found: {path}`
   - Action: Display error, don't proceed with upload

2. **Size Limit Exceeded**: When file or session size limit is exceeded
   - Error: `UploadError: File size {size} exceeds limit {limit}`
   - Error: `UploadError: Session storage {current} + {fileSize} would exceed limit {limit}`
   - Action: Reject upload, display current usage

3. **Invalid File Type**: When MIME type is not allowed
   - Error: `UploadError: File type {mimeType} not allowed`
   - Action: Reject upload, list allowed types

4. **Path Traversal Attempt**: When malicious path is detected
   - Error: `SecurityError: Path traversal attempt detected: {path}`
   - Action: Reject upload, log security warning

5. **Storage Error**: When file system operations fail
   - Error: `StorageError: Failed to write file: {reason}`
   - Action: Rollback partial upload, clean up

6. **Checksum Collision**: When different files have same checksum (extremely rare)
   - Error: `UploadError: Checksum collision detected`
   - Action: Reject upload, log warning

### Recovery Strategies

1. **Partial Upload Cleanup**: If upload fails mid-process, remove partial files
2. **Manifest Rollback**: If manifest update fails, restore previous state
3. **Retry Logic**: For transient file system errors, retry up to 3 times
4. **Graceful Degradation**: If image processing fails, upload original without processing

## Testing Strategy

The File Upload System requires comprehensive testing using both unit tests and property-based tests to ensure correctness across all upload scenarios.

### Unit Testing

Unit tests focus on specific examples, edge cases, and integration points:

1. **Upload Service**
   - Test upload with valid file
   - Test upload with oversized file (edge case)
   - Test upload with invalid MIME type (edge case)
   - Test deduplication with identical files
   - Test manifest updates after operations

2. **Storage Manager**
   - Test directory creation and deletion
   - Test file write and read operations
   - Test session size calculation
   - Test cleanup of empty directories

3. **Image Processor**
   - Test base64 encoding
   - Test image resizing for large images (edge case)
   - Test dimension detection
   - Test handling of corrupted images (edge case)

4. **Text Extractor**
   - Test language detection for common extensions
   - Test line counting
   - Test encoding detection (UTF-8, ASCII, etc.)
   - Test handling of binary files (edge case)

5. **Path Sanitization**
   - Test removal of `../` sequences (edge case)
   - Test rejection of absolute paths (edge case)
   - Test normalization of various path formats
   - Test handling of Unicode in filenames (edge case)

### Property-Based Testing

Property tests verify universal properties across all inputs using fast-check library. Each test should run a minimum of 100 iterations.

**Test Configuration:**
- Library: fast-check (TypeScript property-based testing)
- Minimum iterations: 100 per property
- Tag format: `Feature: stage-14-file-upload-future-dev, Property {number}: {property_text}`

**Property Test Implementation:**

1. **Property 1: Upload Storage Consistency**
   - Generate: Random files (various sizes, types), random session IDs
   - Action: Upload file
   - Assert: File exists in session dir, manifest contains entry, total size is correct
   - Tag: `Feature: stage-14-file-upload-future-dev, Property 1: Upload Storage Consistency`

2. **Property 2: Glob Pattern Expansion**
   - Generate: Random directory structures, random glob patterns
   - Action: Upload with glob pattern
   - Assert: All matching files uploaded, no non-matching files uploaded
   - Tag: `Feature: stage-14-file-upload-future-dev, Property 2: Glob Pattern Expansion`

3. **Property 3: Clipboard Upload**
   - Generate: Random clipboard content (images, text, empty)
   - Action: Upload with --paste
   - Assert: Images uploaded, non-images handled gracefully
   - Tag: `Feature: stage-14-file-upload-future-dev, Property 3: Clipboard Upload`

4. **Property 4: Size Limit Enforcement**
   - Generate: Random files with sizes around limits
   - Action: Upload file
   - Assert: Oversized files rejected with correct error message
   - Tag: `Feature: stage-14-file-upload-future-dev, Property 4: Size Limit Enforcement`

5. **Property 5: @ Mention Upload Trigger**
   - Generate: Random messages with @ mentions, random file existence
   - Action: Process message
   - Assert: Existing files uploaded and mentioned, non-existing files error
   - Tag: `Feature: stage-14-file-upload-future-dev, Property 5: @ Mention Upload Trigger`

6. **Property 6: File Deduplication**
   - Generate: Random files, upload same file multiple times
   - Action: Upload duplicates
   - Assert: Only one copy on disk, correct reference counts
   - Tag: `Feature: stage-14-file-upload-future-dev, Property 6: File Deduplication`

7. **Property 7: Session Directory Management**
   - Generate: Random session IDs
   - Action: Create session, upload files, delete session
   - Assert: Directory created, files stored, directory deleted
   - Tag: `Feature: stage-14-file-upload-future-dev, Property 7: Session Directory Management`

8. **Property 8: Upload Deletion Consistency**
   - Generate: Random uploads, random deletion operations
   - Action: Delete uploads
   - Assert: Files removed, manifest updated, size recalculated
   - Tag: `Feature: stage-14-file-upload-future-dev, Property 8: Upload Deletion Consistency`

9. **Property 9: Configuration Loading with Defaults**
   - Generate: Random configuration states (missing, partial, complete)
   - Action: Load configuration
   - Assert: Configured values used when present, defaults used otherwise
   - Tag: `Feature: stage-14-file-upload-future-dev, Property 9: Configuration Loading with Defaults`

10. **Property 10: Image Processing for Vision Models**
    - Generate: Random images (various sizes), random model capabilities
    - Action: Process image for LLM
    - Assert: Vision models get base64, large images resized, non-vision models get text
    - Tag: `Feature: stage-14-file-upload-future-dev, Property 10: Image Processing for Vision Models`

11. **Property 11: Text File Extraction**
    - Generate: Random text/code files with various extensions
    - Action: Extract text
    - Assert: Content extracted, language detected, metadata included
    - Tag: `Feature: stage-14-file-upload-future-dev, Property 11: Text File Extraction`

12. **Property 12: MIME Type Validation**
    - Generate: Random files with various MIME types
    - Action: Upload file
    - Assert: Allowed types accepted, disallowed types rejected
    - Tag: `Feature: stage-14-file-upload-future-dev, Property 12: MIME Type Validation`

13. **Property 13: Automatic Cleanup**
    - Generate: Random uploads with various ages
    - Action: Run cleanup
    - Assert: Old uploads deleted, manifests updated, count logged
    - Tag: `Feature: stage-14-file-upload-future-dev, Property 13: Automatic Cleanup`

14. **Property 14: Path Traversal Protection**
    - Generate: Random file paths including malicious ones
    - Action: Sanitize and validate path
    - Assert: Traversal sequences removed, malicious paths rejected, warnings logged
    - Tag: `Feature: stage-14-file-upload-future-dev, Property 14: Path Traversal Protection`

15. **Property 15: Upload List Display**
    - Generate: Random uploads
    - Action: List uploads, show specific upload
    - Assert: All uploads displayed with correct information
    - Tag: `Feature: stage-14-file-upload-future-dev, Property 15: Upload List Display`

### Integration Testing

Integration tests verify the system works correctly with external dependencies:

1. **File System Integration**
   - Test with real file system operations
   - Test with various file permissions
   - Test with disk space constraints

2. **Clipboard Integration**
   - Test with actual clipboard operations (platform-specific)
   - Test clipboard detection across platforms

3. **LLM Provider Integration**
   - Test image uploads with vision models (Ollama with llava)
   - Test text uploads with code-focused models
   - Test fallback behavior with non-vision models

4. **UI Integration**
   - Test upload commands in CLI
   - Test upload display in side panel
   - Test progress indicators during upload

### Test Data Generators

For property-based testing, implement smart generators:

```typescript
// Generate valid file buffers with various sizes
const fileBufferArbitrary = fc.uint8Array({ minLength: 1, maxLength: 1024 * 1024 });

// Generate valid filenames (no path traversal)
const safeFilenameArbitrary = fc.string({ minLength: 1, maxLength: 255 })
  .filter(name => !name.includes('..') && !name.includes('/'));

// Generate malicious filenames (for security testing)
const maliciousFilenameArbitrary = fc.oneof(
  fc.constant('../etc/passwd'),
  fc.constant('../../secret.txt'),
  fc.constant('/etc/shadow')
);

// Generate session IDs
const sessionIdArbitrary = fc.uuid();

// Generate MIME types
const mimeTypeArbitrary = fc.oneof(
  fc.constant('image/png'),
  fc.constant('image/jpeg'),
  fc.constant('text/plain'),
  fc.constant('application/json'),
  fc.constant('application/octet-stream')  // Disallowed type
);
```

### Coverage Goals

- Unit test coverage: 80% minimum
- Property test coverage: All 15 properties implemented
- Integration test coverage: All external integrations tested
- Edge case coverage: All error conditions tested

### Continuous Integration

Tests should run in CI pipeline:
- Run all unit tests on every commit
- Run property tests with 100 iterations
- Run integration tests on pull requests
- Generate coverage reports
- Fail build if coverage drops below 80%
