# Requirements Document

## Introduction

The File Upload System enables users to share files (images, code, documents) with the LLM through the terminal chat interface. Files are stored locally in session-scoped directories and integrated into the conversation context. This feature provides multiple upload methods including slash commands, clipboard paste, drag-and-drop, and @ mentions, with automatic cleanup and storage management.

## Glossary

- **Upload_Service**: The core service responsible for managing file uploads, storage, and metadata
- **Session**: A chat conversation instance with its own isolated file storage
- **Manifest**: A JSON file tracking all uploaded files and their metadata for a session
- **Vision_Model**: An LLM capable of processing image inputs
- **Checksum**: A SHA-256 hash used for file deduplication
- **Storage_Manager**: Component responsible for file persistence and cleanup
- **Upload_Method**: The mechanism used to upload a file (command, clipboard, drag-drop, mention)
- **Retention_Period**: The duration after which uploaded files are automatically deleted
- **MIME_Type**: The media type identifier for uploaded files
- **Base64_Encoding**: The encoding format used to transmit images to vision models

## Requirements

### Requirement 1: File Upload via Slash Command

**User Story:** As a user, I want to upload files using slash commands, so that I can share files with the LLM through a simple command interface.

#### Acceptance Criteria

1. WHEN a user executes `/upload <path>` with a valid file path, THE Upload_Service SHALL store the file in the session directory and add it to the manifest
2. WHEN a user executes `/upload` with a glob pattern, THE Upload_Service SHALL expand the pattern and upload all matching files
3. WHEN a user executes `/upload --paste`, THE Upload_Service SHALL upload the file from the system clipboard
4. WHEN a file upload completes, THE System SHALL display a confirmation message with the file name and size
5. IF a file exceeds the configured size limit, THEN THE Upload_Service SHALL reject the upload and display an error message

### Requirement 2: File Upload via @ Mention

**User Story:** As a user, I want to upload files using @ mention syntax, so that I can seamlessly reference and upload files in my messages.

#### Acceptance Criteria

1. WHEN a user types `@<file_path>` in a message, THE System SHALL detect the mention and trigger an upload
2. WHEN an @ mention upload is triggered, THE System SHALL display an upload progress indicator
3. WHEN an @ mention upload completes, THE System SHALL replace the mention with a reference to the uploaded file
4. IF the mentioned file does not exist, THEN THE System SHALL display an error message and not send the message

### Requirement 3: Clipboard Upload Detection

**User Story:** As a user, I want to paste images from my clipboard, so that I can quickly share screenshots and copied images with the LLM.

#### Acceptance Criteria

1. WHEN a user pastes content with Ctrl+V or Cmd+V, THE System SHALL detect if the clipboard contains an image
2. WHEN an image is detected in the clipboard, THE System SHALL prompt the user to confirm the upload with file size information
3. WHEN the user confirms a clipboard upload, THE Upload_Service SHALL store the image in the session directory
4. IF the clipboard does not contain an image, THEN THE System SHALL process the paste as normal text input

### Requirement 4: Drag-and-Drop Upload

**User Story:** As a user, I want to drag and drop files into the terminal, so that I can upload files using a familiar interaction pattern.

#### Acceptance Criteria

1. WHERE the terminal supports drag-and-drop, THE System SHALL display a drop zone indicator
2. WHEN a user drags files over the terminal, THE System SHALL highlight the drop zone
3. WHEN a user drops files onto the terminal, THE Upload_Service SHALL upload all dropped files
4. WHERE the terminal does not support drag-and-drop, THE System SHALL display a message indicating alternative upload methods

### Requirement 5: Upload Management Commands

**User Story:** As a user, I want to manage my uploaded files, so that I can view, inspect, and delete files as needed.

#### Acceptance Criteria

1. WHEN a user executes `/uploads list`, THE System SHALL display all uploaded files for the current session with name, size, and upload time
2. WHEN a user executes `/uploads show <id>`, THE System SHALL display detailed metadata for the specified upload
3. WHEN a user executes `/uploads delete <id>`, THE Upload_Service SHALL remove the file from storage and update the manifest
4. WHEN a user executes `/uploads clear`, THE Upload_Service SHALL delete all uploaded files for the current session
5. WHEN files are deleted, THE System SHALL display a confirmation message with the count of deleted files

### Requirement 6: Session-Scoped Storage

**User Story:** As a developer, I want uploads to be scoped to sessions, so that files are organized and isolated per conversation.

#### Acceptance Criteria

1. WHEN a file is uploaded, THE Storage_Manager SHALL store it in a directory named after the session ID
2. WHEN a session is created, THE Storage_Manager SHALL create a corresponding upload directory
3. WHEN a session is deleted, THE Storage_Manager SHALL delete all files in the session's upload directory
4. THE Storage_Manager SHALL maintain a manifest.json file in each session directory tracking all uploads

### Requirement 7: File Deduplication

**User Story:** As a user, I want duplicate files to be detected, so that I don't waste storage space uploading the same file multiple times.

#### Acceptance Criteria

1. WHEN a file is uploaded, THE Upload_Service SHALL calculate a SHA-256 checksum
2. WHEN a checksum matches an existing file in the session, THE Upload_Service SHALL reuse the existing file instead of storing a duplicate
3. WHEN a duplicate is detected, THE System SHALL display a message indicating the file already exists
4. THE Upload_Service SHALL maintain separate reference counts for deduplicated files

### Requirement 8: Storage Limits Enforcement

**User Story:** As a system administrator, I want configurable storage limits, so that uploads don't consume excessive disk space.

#### Acceptance Criteria

1. WHEN a file is uploaded, THE Upload_Service SHALL check if the file size exceeds the configured per-file limit
2. WHEN the total session storage would exceed the configured per-session limit, THE Upload_Service SHALL reject the upload
3. THE Upload_Service SHALL read storage limits from the configuration file with default values of 10MB per file and 100MB per session
4. IF a storage limit is exceeded, THEN THE System SHALL display an error message with the limit and current usage

### Requirement 9: Image Processing for Vision Models

**User Story:** As a user, I want uploaded images to be sent to vision-capable models, so that the LLM can analyze visual content.

#### Acceptance Criteria

1. WHEN an image is uploaded and the current model supports vision, THE System SHALL encode the image as base64
2. WHEN an image exceeds 2048 pixels in width or height, THE System SHALL resize it before encoding
3. WHEN sending a message with uploaded images, THE System SHALL include the images as image_url content parts
4. WHEN the current model does not support vision, THE System SHALL include a text description of the image instead

### Requirement 10: Text File Extraction

**User Story:** As a user, I want uploaded code and text files to be included in the conversation, so that the LLM can analyze file contents.

#### Acceptance Criteria

1. WHEN a text or code file is uploaded, THE System SHALL extract the file contents
2. WHEN a code file is uploaded, THE System SHALL detect the programming language from the file extension
3. WHEN sending a message with uploaded text files, THE System SHALL format the content as code blocks with syntax highlighting
4. THE System SHALL include metadata such as line count and detected language with text file uploads

### Requirement 11: File Type Validation

**User Story:** As a developer, I want file types to be validated, so that only supported file types are uploaded.

#### Acceptance Criteria

1. WHEN a file is uploaded, THE Upload_Service SHALL detect the MIME type using magic bytes
2. WHEN a file's MIME type is not in the allowed types list, THE Upload_Service SHALL reject the upload
3. THE Upload_Service SHALL support image types (image/*), text types (text/*), and application/json by default
4. THE Upload_Service SHALL read allowed types from the configuration file

### Requirement 12: Automatic Cleanup

**User Story:** As a system administrator, I want old uploads to be automatically cleaned up, so that disk space is reclaimed over time.

#### Acceptance Criteria

1. WHEN the application starts, THE Storage_Manager SHALL scan for uploads older than the configured retention period
2. WHEN expired uploads are found, THE Storage_Manager SHALL delete the files and update manifests
3. THE Storage_Manager SHALL read the retention period from the configuration file with a default of 7 days
4. WHEN cleanup occurs, THE System SHALL log the number of files deleted

### Requirement 13: Upload UI Display

**User Story:** As a user, I want to see my uploaded files in the UI, so that I can track what files are included in the conversation.

#### Acceptance Criteria

1. WHEN files are uploaded, THE System SHALL display them in an "Uploads" section of the side panel
2. WHEN displaying uploads, THE System SHALL show the file name, size, and file type icon
3. WHEN a user clicks the delete button on an upload, THE System SHALL remove the file
4. WHILE an upload is in progress, THE System SHALL display a progress indicator

### Requirement 14: Upload Progress Feedback

**User Story:** As a user, I want to see upload progress, so that I know when large files are being processed.

#### Acceptance Criteria

1. WHEN a file upload begins, THE System SHALL display a progress indicator with the file name
2. WHILE a file is uploading, THE System SHALL update the progress indicator
3. WHEN a file upload completes, THE System SHALL display a success message
4. IF a file upload fails, THEN THE System SHALL display an error message with the failure reason

### Requirement 15: Path Traversal Protection

**User Story:** As a security engineer, I want file paths to be sanitized, so that path traversal attacks are prevented.

#### Acceptance Criteria

1. WHEN a file path is provided, THE Upload_Service SHALL sanitize the filename to remove directory traversal sequences
2. THE Upload_Service SHALL reject file paths containing `../` or absolute paths outside the upload directory
3. THE Upload_Service SHALL normalize all file paths before storage
4. IF a malicious path is detected, THEN THE System SHALL log a security warning and reject the upload
