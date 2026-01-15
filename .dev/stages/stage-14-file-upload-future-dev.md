# Stage 13: File Upload System

**Goal**: Enable file uploads (images, code, documents) in terminal chat for LLM context. Files persist locally until session ends or history cleared.

**Prerequisites**: Stages 06-07 complete (CLI UI, Chat Sessions)

**Estimated Effort**: 3-4 days

---

## Overview

Allow users to share files with the LLM similar to how they can upload screenshots and snippets in web-based chat interfaces:

1. **Multiple Upload Methods** - Drag & drop, slash command, clipboard paste, @ mentions
2. **Session-Scoped Storage** - Files persist with session, cleaned up on deletion
3. **LLM Integration** - Images sent as base64 to vision models, text extracted from code
4. **Storage Limits** - Configurable size limits and retention periods

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Upload System                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Upload         │  │  Storage        │  │  LLM            │ │
│  │  Methods        │  │  Manager        │  │  Integration    │ │
│  │                 │  │                 │  │                 │ │
│  │  - /upload cmd  │  │  - session dir  │  │  - base64 img   │ │
│  │  - drag & drop  │  │  - manifest     │  │  - text extract │ │
│  │  - clipboard    │  │  - cleanup      │  │  - code blocks  │ │
│  │  - @ mention    │  │  - dedup        │  │  - file refs    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Storage Model

```
~/.ollm/
├── uploads/                    # Session-scoped uploads
│   └── {session_id}/           # Per-session directory
│       ├── manifest.json       # Upload metadata
│       ├── img_001.png         # Uploaded files
│       ├── snippet_002.ts
│       └── ...
└── config.yaml
```

**File Lifecycle**:
- Files persist until:
  1. Session deleted (`/session delete <id>`)
  2. Chat cleared with flag (`/clear --include-uploads`)
  3. Manual cleanup (`/uploads clear`)
  4. Retention period expires (default: 7 days)

---

## Tasks

### S13-T01: Upload Service Core

**Goal**: Core upload storage and management.

**Effort**: 1 day

**Steps**:

1. Create `packages/core/src/services/uploadService.ts`:

```typescript
interface UploadedFile {
  id: string;                    // Unique ID (uuid)
  sessionId: string;             // Parent session
  originalName: string;          // Original filename
  storagePath: string;           // Path in uploads dir
  mimeType: string;              // MIME type
  size: number;                  // Bytes
  uploadedAt: Date;
  checksum: string;              // SHA-256 for dedup
  metadata: {
    width?: number;              // For images
    height?: number;
    lineCount?: number;          // For code files
    language?: string;           // Detected language
  };
}

interface UploadService {
  upload(sessionId: string, file: Buffer, filename: string): Promise<UploadedFile>;
  get(id: string): Promise<UploadedFile | null>;
  list(sessionId: string): Promise<UploadedFile[]>;
  delete(id: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  cleanup(olderThan: Date): Promise<number>;
}
```

2. Implement manifest.json management per session
3. Add checksum-based deduplication
4. Size and type validation

**Deliverables**:
- `packages/core/src/services/uploadService.ts`
- `packages/core/src/services/__tests__/uploadService.test.ts`

**Acceptance Criteria**:
- [ ] Files stored in `~/.ollm/uploads/{sessionId}/`
- [ ] Manifest tracks all uploads with metadata
- [ ] Duplicate files detected by checksum
- [ ] Size limits enforced (default 10MB per file)

---

### S13-T02: Upload CLI Commands

**Goal**: Slash commands for file uploads.

**Effort**: 1 day

**Steps**:

1. Implement `/upload` command:

```
/upload <path>              # Upload file
/upload ./screenshots/*.png # Glob pattern support
/upload --paste             # Upload from clipboard
```

2. Implement `/uploads` management:

```
/uploads list               # List session uploads
/uploads show <id>          # Preview upload info
/uploads delete <id>        # Delete specific upload
/uploads clear              # Clear all session uploads
```

3. Support @ mention syntax:

```
> Analyze @~/Desktop/error.png
[Uploading error.png... done ✓]
```

**Deliverables**:
- `packages/cli/src/commands/uploadCommands.ts`

**Acceptance Criteria**:
- [ ] Single file upload works
- [ ] Glob patterns expand correctly
- [ ] @ mention triggers upload
- [ ] List shows all session uploads
- [ ] Clear removes files from disk

---

### S13-T03: Clipboard & Drag-Drop Support

**Goal**: Convenience upload methods.

**Effort**: 0.5 day

**Steps**:

1. Clipboard paste detection (Ctrl+V with image):

```
📋 Image detected in clipboard (1.2MB PNG)
   [Y] Upload  [N] Cancel  [V] View first
```

2. Terminal drag-drop where supported (iTerm2, OSC 52):

```
┌─────────────────────────────────────────────────────────────────┐
│                    Drop files here to upload                    │
│                    📁 ─────────────────────                     │
└─────────────────────────────────────────────────────────────────┘
```

3. Fallback message for unsupported terminals

**Deliverables**:
- `packages/cli/src/ui/components/DropZone.tsx`
- Clipboard detection in input handler

**Acceptance Criteria**:
- [ ] Clipboard paste works for images
- [ ] Drag-drop works in supported terminals
- [ ] Graceful fallback in unsupported terminals

---

### S13-T04: LLM Integration

**Goal**: Convert uploads to message content for models.

**Effort**: 1 day

**Steps**:

1. Image handling for vision models:

```typescript
interface MessageContentPart {
  type: 'text' | 'image_url' | 'file';
  
  // For images
  image_url?: {
    url: string;               // data:image/png;base64,...
    detail?: 'low' | 'high' | 'auto';
  };
  
  // For code/text
  file?: {
    name: string;
    content: string;
    language?: string;
  };
}
```

2. Image processing:
   - Resize large images (max 2048px)
   - Base64 encode for vision models
   - Detect vision-capable models

3. Text extraction:
   - Detect language from extension
   - Format as code block
   - Include line count metadata

**Deliverables**:
- `packages/core/src/services/imageProcessor.ts`
- `packages/core/src/services/textExtractor.ts`

**Acceptance Criteria**:
- [ ] Images encoded as base64
- [ ] Large images resized before encoding
- [ ] Text files included with syntax highlighting
- [ ] Non-vision models get text description

---

### S13-T05: UI Integration

**Goal**: Show uploads in side panel.

**Effort**: 0.5 day

**Steps**:

1. Uploads section in side panel:

```
┌─ 📎 Uploads (3) ───────────────────────────┐
│  🖼️ screenshot.png          1.2 MB  [x]   │
│  📄 error.log               24 KB   [x]   │
│  💻 snippet.ts              856 B   [x]   │
└────────────────────────────────────────────┘
```

2. Upload progress indicator
3. Quick actions (view, delete)
4. File type icons

**Deliverables**:
- `packages/cli/src/ui/components/panel/UploadsSection.tsx`

**Acceptance Criteria**:
- [ ] Uploads shown in side panel
- [ ] Delete button works
- [ ] Count updates in header
- [ ] Progress shown during upload

---

### S13-T06: Session Cleanup

**Goal**: Automatic cleanup of old uploads.

**Effort**: 0.5 day

**Steps**:

1. Cleanup on session delete
2. Startup cleanup of expired uploads
3. Configurable retention period

```yaml
# ~/.ollm/config.yaml
uploads:
  maxFileSize: 10485760       # 10MB
  maxSessionSize: 104857600   # 100MB per session
  retentionDays: 7            # Auto-cleanup
  allowedTypes:
    - image/*
    - text/*
    - application/json
```

**Deliverables**:
- `packages/core/src/services/uploadCleanup.ts`

**Acceptance Criteria**:
- [ ] Old sessions cleaned on startup
- [ ] Retention period configurable
- [ ] Storage limits enforced
- [ ] Cleanup logged for debugging

---

## Supported File Types

| Type | Extensions | Processing |
|------|------------|------------|
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` | Base64 for vision models |
| Code | `.ts`, `.js`, `.py`, `.md`, `.json`, etc. | Text extraction + syntax |
| Documents | `.txt`, `.csv`, `.log` | Plain text |
| Binary | `.pdf` (future) | Requires OCR extraction |

---

## Security Considerations

- **Path traversal**: Sanitize filenames, reject `../`
- **Size limits**: Enforce per-file and per-session limits
- **Type validation**: Check magic bytes, not just extension
- **Local only**: Files never leave machine unless sent to LLM

---

## Verification Checklist

- [ ] Upload via `/upload path/to/file`
- [ ] Upload via clipboard paste
- [ ] Upload via @ mention
- [ ] Images sent to vision models correctly
- [ ] Code files included as text
- [ ] Uploads persist across app restarts
- [ ] Uploads cleared with session deletion
- [ ] Storage limits enforced
- [ ] Expired uploads cleaned up

---

## Dependencies

New dependencies:
- `clipboardy` - Clipboard access
- `file-type` - MIME detection from magic bytes
- `sharp` - Image resizing (optional, for large images)
