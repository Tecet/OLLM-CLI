# Implementation Plan: Intelligence Layer

## Overview

This implementation plan breaks down the Intelligence Layer feature into discrete coding tasks. The approach follows a bottom-up strategy: build foundational services first (embedding, vector store), then higher-level components (codebase index, structured output), and finally user-facing tools and integrations.

Each task builds on previous work and includes property-based tests to validate correctness properties from the design document. Tasks are organized to enable incremental progress with working functionality at each checkpoint.

## Tasks

- [ ] 1. Set up intelligence layer infrastructure
  - Create directory structure for new components
  - Add dependencies: better-sqlite3, @xenova/transformers, isolated-vm, clipboardy
  - Update TypeScript configuration for new packages
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [ ] 2. Implement embedding service
  - [ ] 2.1 Create embedding service interface and types
    - Define EmbeddingService interface in packages/core/src/index/embeddingService.ts
    - Define types for embedding options and results
    - _Requirements: 1.6_

  - [ ] 2.2 Implement local embedding service
    - Implement LocalEmbeddingService using @xenova/transformers
    - Add initialization and model loading
    - Implement embed() and embedBatch() methods
    - Implement cosineSimilarity() calculation
    - _Requirements: 1.6_

  - [ ]* 2.3 Write property tests for embedding service
    - **Property 37: Embedding retry with backoff**
    - **Validates: Requirements 9.2**

  - [ ]* 2.4 Write unit tests for embedding service
    - Test embedding generation for known text
    - Test batch embedding
    - Test similarity calculations
    - Test error handling
    - _Requirements: 1.6, 9.2_

- [ ] 3. Implement vector store
  - [ ] 3.1 Create vector store interface and SQLite schema
    - Define VectorStore interface in packages/core/src/index/vectorStore.ts
    - Define types for vector items, metadata, and results
    - Create SQLite schema for vectors and files tables
    - _Requirements: 1.7_

  - [ ] 3.2 Implement SQLite vector store
    - Implement SqliteVectorStore class
    - Implement upsert, upsertBatch, delete operations
    - Implement searchByVector with cosine similarity
    - Implement count, size, clear operations
    - _Requirements: 1.7, 1.8_

  - [ ]* 3.3 Write property tests for vector store
    - **Property 5: Vector persistence round-trip**
    - **Property 6: Clear removes all data**
    - **Validates: Requirements 1.7, 1.8**

  - [ ]* 3.4 Write unit tests for vector store
    - Test vector storage and retrieval
    - Test search functionality
    - Test deletion operations
    - Test statistics
    - _Requirements: 1.7, 1.8_


- [ ] 4. Implement codebase index service
  - [ ] 4.1 Create codebase index interface and types
    - Define CodebaseIndex interface in packages/core/src/index/codebaseIndex.ts
    - Define types for index options, search options, results, and statistics
    - _Requirements: 1.1, 1.3_

  - [ ] 4.2 Implement file chunking and processing
    - Implement file reading and chunking logic
    - Implement language detection
    - Implement token counting for chunks
    - _Requirements: 1.1_

  - [ ] 4.3 Implement codebase indexing
    - Implement initialize() and indexWorkspace() methods
    - Integrate with file discovery service for file enumeration
    - Integrate with embedding service for vector generation
    - Integrate with vector store for persistence
    - Implement file filtering by extension and size
    - _Requirements: 1.1, 1.4, 1.5_

  - [ ] 4.4 Implement semantic search
    - Implement search() method with query embedding
    - Implement result ranking and filtering
    - Implement topK limiting and threshold filtering
    - _Requirements: 1.3_

  - [ ] 4.5 Implement file watching and incremental updates
    - Integrate with file watcher for change detection
    - Implement updateFile() and removeFile() methods
    - _Requirements: 1.2_

  - [ ]* 4.6 Write property tests for codebase index
    - **Property 1: Automatic indexing respects configuration**
    - **Property 2: Search results are ranked and limited**
    - **Property 3: File exclusion patterns are respected**
    - **Property 4: Large files are skipped**
    - **Property 36: Indexing continues on file errors**
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 7.2, 7.3, 9.1**

  - [ ]* 4.7 Write unit tests for codebase index
    - Test indexing known file structure
    - Test search with known queries
    - Test file updates and removals
    - Test error handling
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 5. Checkpoint - Ensure codebase indexing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement structured output system
  - [ ] 6.1 Create structured output service interface
    - Define StructuredOutputService interface in packages/core/src/output/structuredOutput.ts
    - Define types for JSON schema, validation results, and options
    - _Requirements: 2.1, 2.2_

  - [ ] 6.2 Implement JSON schema validation
    - Implement validate() method using Zod or Ajv
    - Implement extractJson() for parsing mixed content
    - Implement detailed error reporting
    - _Requirements: 2.4, 2.5_

  - [ ] 6.3 Implement structured output generation with retry
    - Implement generateWithSchema() method
    - Integrate with provider for schema enforcement
    - Implement retry logic with configurable max attempts
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 6.4 Update provider types for structured output
    - Add ResponseFormat type to provider request options
    - Update ProviderRequest interface
    - _Requirements: 2.1, 2.2_

  - [ ] 6.5 Update LocalProvider for JSON mode
    - Update mapRequest() to handle responseFormat
    - Map to Ollama's format parameter
    - _Requirements: 2.1, 2.7_

  - [ ]* 6.6 Write property tests for structured output
    - **Property 7: JSON mode produces valid JSON**
    - **Property 8: Schema conformance**
    - **Property 9: Retry on validation failure**
    - **Property 10: Validation errors are descriptive**
    - **Property 38: Validation fallback after retries**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 9.4**

  - [ ]* 6.7 Write unit tests for structured output
    - Test JSON validation with known schemas
    - Test retry logic
    - Test error messages
    - Test provider integration
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 7. Implement extract tool
  - [ ] 7.1 Create extract tool
    - Define ExtractParams interface in packages/core/src/tools/extract.ts
    - Implement ExtractTool class using structured output service
    - Register tool with tool registry
    - _Requirements: 2.6_

  - [ ]* 7.2 Write property tests for extract tool
    - **Property 11: Extract tool schema conformance**
    - **Validates: Requirements 2.6**

  - [ ]* 7.3 Write unit tests for extract tool
    - Test extraction with known text and schemas
    - Test error handling
    - _Requirements: 2.6_


- [ ] 8. Implement code execution sandbox
  - [ ] 8.1 Create code executor interface and types
    - Define CodeExecutor interface in packages/core/src/sandbox/codeExecutor.ts
    - Define types for languages, execution options, and results
    - Define LanguageExecutor interface
    - _Requirements: 3.1, 3.6_

  - [ ] 8.2 Implement JavaScript executor
    - Create JsExecutor class in packages/core/src/sandbox/jsExecutor.ts
    - Use isolated-vm for sandboxing
    - Implement timeout enforcement
    - Implement output capture
    - _Requirements: 3.2, 3.5, 3.6_

  - [ ] 8.3 Implement Python executor
    - Create PythonExecutor class in packages/core/src/sandbox/pythonExecutor.ts
    - Use subprocess for execution
    - Implement timeout enforcement
    - Implement output capture
    - _Requirements: 3.3, 3.5, 3.6_

  - [ ] 8.4 Implement Bash executor
    - Create BashExecutor class in packages/core/src/sandbox/bashExecutor.ts
    - Use subprocess with restricted environment
    - Implement timeout enforcement
    - Implement output capture
    - _Requirements: 3.4, 3.5, 3.6_

  - [ ] 8.5 Implement main code executor service
    - Implement CodeExecutor class that delegates to language executors
    - Implement language support detection
    - Implement configuration loading
    - _Requirements: 3.1, 7.4, 7.5_

  - [ ]* 8.6 Write property tests for code execution
    - **Property 12: Execution requires confirmation**
    - **Property 13: Sandbox isolation**
    - **Property 14: Timeout enforcement**
    - **Property 15: Output capture completeness**
    - **Property 16: Environment variable restriction**
    - **Property 34: Language execution filtering**
    - **Property 35: Sandbox restriction enforcement**
    - **Property 39: Sandbox error isolation**
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 7.5, 7.6, 9.5, 10.1, 10.2**

  - [ ]* 8.7 Write unit tests for code execution
    - Test JavaScript execution
    - Test Python execution
    - Test Bash execution
    - Test timeout handling
    - Test error handling
    - Test configuration
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 9. Implement execute tool
  - [ ] 9.1 Create execute tool
    - Define ExecuteParams interface in packages/core/src/tools/execute.ts
    - Implement ExecuteTool class using code executor service
    - Implement confirmation logic (always dangerous)
    - Register tool with tool registry
    - _Requirements: 3.1_

  - [ ]* 9.2 Write unit tests for execute tool
    - Test tool registration
    - Test confirmation requirement
    - Test execution delegation
    - _Requirements: 3.1_

- [ ] 10. Checkpoint - Ensure code execution tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement vision support
  - [ ] 11.1 Create vision service interface
    - Define VisionService interface in packages/core/src/vision/visionService.ts
    - Define types for vision options and image data
    - _Requirements: 4.1, 4.2_

  - [ ] 11.2 Implement image loading and encoding
    - Implement loadImage() method
    - Support JPEG, PNG, GIF, WebP formats
    - Implement base64 encoding
    - Implement image resizing with aspect ratio preservation
    - _Requirements: 4.1, 4.4, 4.5_

  - [ ] 11.3 Implement vision model detection
    - Implement isVisionModel() method
    - Implement getVisionModels() method
    - Integrate with provider registry
    - _Requirements: 4.3_

  - [ ] 11.4 Implement image analysis
    - Implement analyzeImage() method
    - Create message with image part
    - Route to vision-capable model
    - _Requirements: 4.2, 4.3_

  - [ ] 11.5 Update provider message mapping for images
    - Update Message type to support image parts
    - Update LocalProvider.mapMessages() to handle images
    - _Requirements: 4.2_

  - [ ]* 11.6 Write property tests for vision support
    - **Property 17: Image loading and encoding**
    - **Property 18: Vision message format**
    - **Property 19: Image resizing preserves aspect ratio**
    - **Property 40: Image error handling**
    - **Validates: Requirements 4.1, 4.2, 4.4, 9.6**

  - [ ]* 11.7 Write unit tests for vision support
    - Test image loading for each format
    - Test resizing
    - Test vision model detection
    - Test message format
    - Test error handling
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 12. Implement image analyze tool
  - [ ] 12.1 Create image analyze tool
    - Define ImageAnalyzeParams interface in packages/core/src/tools/image-analyze.ts
    - Implement ImageAnalyzeTool class using vision service
    - Register tool with tool registry
    - _Requirements: 4.1, 4.2_

  - [ ]* 12.2 Write unit tests for image analyze tool
    - Test tool with known images
    - Test error handling
    - _Requirements: 4.1, 4.2, 4.3_


- [ ] 13. Implement undo tool
  - [ ] 13.1 Extend session recording for file changes
    - Update SessionEvent type to include fileChanges
    - Update chat recording service to track file modifications
    - Store previous file content before changes
    - _Requirements: 5.1_

  - [ ] 13.2 Create undo tool
    - Define UndoParams interface in packages/core/src/tools/undo.ts
    - Implement UndoTool class using session recording service
    - Implement file restoration logic
    - Implement most-recent-file selection
    - Register tool with tool registry
    - _Requirements: 5.1, 5.2_

  - [ ]* 13.3 Write property tests for undo tool
    - **Property 20: Undo restores previous state**
    - **Property 21: Undo defaults to most recent**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 13.4 Write unit tests for undo tool
    - Test undo with specific file
    - Test undo with default (most recent)
    - Test undo with no history
    - _Requirements: 5.1, 5.2_

- [ ] 14. Implement export tool
  - [ ] 14.1 Create export tool
    - Define ExportParams interface in packages/core/src/tools/export.ts
    - Implement ExportTool class using session recording service
    - Implement markdown formatting
    - Implement JSON formatting
    - Implement HTML formatting
    - Implement sanitization for sensitive data
    - Register tool with tool registry
    - _Requirements: 5.3, 5.4, 10.6_

  - [ ]* 14.2 Write property tests for export tool
    - **Property 22: Export creates valid output**
    - **Property 23: Markdown export formatting**
    - **Property 43: Export sanitization**
    - **Validates: Requirements 5.3, 5.4, 10.6**

  - [ ]* 14.3 Write unit tests for export tool
    - Test markdown export
    - Test JSON export
    - Test HTML export
    - Test sanitization
    - _Requirements: 5.3, 5.4, 10.6_

- [ ] 15. Implement copy tool
  - [ ] 15.1 Create copy tool
    - Define CopyParams interface in packages/core/src/tools/copy.ts
    - Implement CopyTool class using clipboardy
    - Implement last response extraction
    - Implement code block extraction
    - Register tool with tool registry
    - _Requirements: 5.5, 5.6, 5.7_

  - [ ]* 15.2 Write property tests for copy tool
    - **Property 24: Response extraction**
    - **Property 25: Code block extraction**
    - **Validates: Requirements 5.6, 5.7**

  - [ ]* 15.3 Write unit tests for copy tool
    - Test copying specific content
    - Test copying last response
    - Test copying code blocks
    - Test error handling
    - _Requirements: 5.5, 5.6, 5.7_

- [ ] 16. Implement prompt template service
  - [ ] 16.1 Create prompt template service
    - Define PromptTemplateService interface in packages/core/src/services/promptTemplateService.ts
    - Define types for templates and variables
    - Implement template storage (file-based)
    - Implement list, get, create, delete operations
    - Implement variable substitution with validation
    - _Requirements: 5.8, 5.9, 5.10_

  - [ ]* 16.2 Write property tests for prompt template service
    - **Property 26: Template listing completeness**
    - **Property 27: Template variable substitution**
    - **Property 28: Template persistence**
    - **Property 41: Template validation errors**
    - **Validates: Requirements 5.8, 5.9, 5.10, 9.8**

  - [ ]* 16.3 Write unit tests for prompt template service
    - Test template CRUD operations
    - Test variable substitution
    - Test validation
    - Test persistence
    - _Requirements: 5.8, 5.9, 5.10, 9.8_

- [ ] 17. Checkpoint - Ensure productivity tools tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Implement cost tracking service
  - [ ] 18.1 Create cost tracker service
    - Define CostTracker interface in packages/core/src/services/costTracker.ts
    - Define types for token usage and statistics
    - Create SQLite schema for usage tracking
    - Implement recordUsage() method
    - _Requirements: 6.1_

  - [ ] 18.2 Implement usage aggregation
    - Implement getSessionStats() method
    - Implement getDailyStats() method
    - Implement getMonthlyStats() method
    - _Requirements: 6.2, 6.3, 6.4_

  - [ ] 18.3 Implement cost estimation
    - Implement estimateCost() method with provider-specific pricing
    - Create pricing configuration for common models
    - _Requirements: 6.7_

  - [ ] 18.4 Implement budget warnings
    - Implement threshold checking
    - Integrate with notification system
    - _Requirements: 6.6_

  - [ ] 18.5 Integrate cost tracking with chat client
    - Update chat client to record usage after each response
    - Update status bar to display usage statistics
    - _Requirements: 6.1, 6.5_

  - [ ]* 18.6 Write property tests for cost tracking
    - **Property 29: Usage recording**
    - **Property 30: Usage aggregation**
    - **Property 31: Budget warning threshold**
    - **Property 32: Cost estimation accuracy**
    - **Property 33: Usage persistence round-trip**
    - **Property 44: Cost tracking privacy**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 10.7**

  - [ ]* 18.7 Write unit tests for cost tracking
    - Test usage recording
    - Test aggregation
    - Test cost estimation
    - Test budget warnings
    - Test persistence
    - Test privacy (no external calls)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 10.7_


- [ ] 19. Implement configuration support
  - [ ] 19.1 Update configuration schema
    - Add codebase section to config schema
    - Add output section for structured output
    - Add execution section for sandbox
    - Add vision section
    - Add cost section
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ] 19.2 Update configuration service
    - Load intelligence layer configuration
    - Provide configuration to services
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 19.3 Write unit tests for configuration
    - Test configuration loading
    - Test default values
    - Test validation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [ ] 20. Implement slash commands
  - [ ] 20.1 Add /codebase commands
    - Implement /codebase index command
    - Implement /codebase search command
    - Implement /codebase stats command
    - Implement /codebase clear command
    - _Requirements: 1.1, 1.3, 1.8_

  - [ ] 20.2 Add /prompt commands
    - Implement /prompt list command
    - Implement /prompt use command
    - Implement /prompt create command
    - Implement /prompt delete command
    - _Requirements: 5.8, 5.9, 5.10_

  - [ ]* 20.3 Write unit tests for slash commands
    - Test command parsing
    - Test command execution
    - Test error handling
    - _Requirements: 1.1, 1.3, 1.8, 5.8, 5.9, 5.10_

- [ ] 21. Implement security features
  - [ ] 21.1 Implement vector metadata privacy
    - Ensure vector metadata doesn't contain file contents
    - Store only file path, line numbers, and language
    - _Requirements: 10.4_

  - [ ] 21.2 Implement URL validation
    - Create URL validator for image loading
    - Reject malicious protocols and patterns
    - _Requirements: 10.8_

  - [ ]* 21.3 Write property tests for security
    - **Property 42: Vector metadata privacy**
    - **Property 45: URL validation**
    - **Validates: Requirements 10.4, 10.8**

  - [ ]* 21.4 Write unit tests for security
    - Test metadata privacy
    - Test URL validation
    - Test sanitization
    - _Requirements: 10.4, 10.6, 10.8_

- [ ] 22. Integration and wiring
  - [ ] 22.1 Wire codebase index to workspace initialization
    - Initialize codebase index on workspace load
    - Start file watcher for incremental updates
    - _Requirements: 1.1, 1.2_

  - [ ] 22.2 Wire structured output to provider system
    - Update provider adapters to support response format
    - Integrate validation middleware
    - _Requirements: 2.1, 2.2_

  - [ ] 22.3 Wire code execution to policy engine
    - Ensure execute tool requires confirmation
    - Configure as dangerous tool
    - _Requirements: 3.1_

  - [ ] 22.4 Wire vision support to message system
    - Update message types throughout the system
    - Update UI to display images
    - _Requirements: 4.2_

  - [ ] 22.5 Wire cost tracking to chat runtime
    - Record usage after each model response
    - Update status bar with usage display
    - _Requirements: 6.1, 6.5_

  - [ ]* 22.6 Write integration tests
    - Test end-to-end codebase indexing and search
    - Test end-to-end structured output generation
    - Test end-to-end code execution with confirmation
    - Test end-to-end image analysis
    - Test end-to-end cost tracking
    - _Requirements: All_

- [ ] 23. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 24. Documentation and examples
  - [ ]* 24.1 Update user documentation
    - Document codebase indexing features
    - Document structured output usage
    - Document code execution safety
    - Document vision support
    - Document productivity tools
    - Document cost tracking
    - _Requirements: All_

  - [ ]* 24.2 Create example configurations
    - Create example config for different use cases
    - Document configuration options
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 24.3 Create usage examples
    - Create examples for each major feature
    - Create tutorial for getting started
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- The implementation follows a bottom-up approach: foundational services first, then higher-level components, then user-facing features
