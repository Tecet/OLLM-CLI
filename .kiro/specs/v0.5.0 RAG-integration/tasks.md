# Implementation Plan: RAG Integration

## Overview

This implementation plan breaks down the RAG Integration feature into discrete, incremental coding tasks. The approach follows a bottom-up strategy: building core utilities first, then services, then integration, and finally testing. Each task builds on previous work and includes validation through tests.

## Current Status

✅ **Completed**:
- Basic directory structure created (`packages/core/src/rag/`)
- Core interfaces defined (RAGSystem.ts)
- LanceDB setup and initialization (LanceDBSetup.ts)
- Table schemas defined (schemas.ts)
- Basic schema tests written

⏳ **Remaining**:
- Install dependencies (`lancedb`, `@xenova/transformers`, `chokidar`)
- Implement all core components (TextChunker, EmbeddingService, VectorStore, CodebaseIndex, RAGManager)
- Write comprehensive tests (unit + property-based)
- Integrate with Mode Manager, Context Manager, Settings Service

## Tasks

- [ ] 1. Install dependencies and update configuration
  - Install `lancedb` (^0.10.0)
  - Install `@xenova/transformers` (^2.17.0)
  - Install `chokidar` (^4.0.0)
  - Update package.json with new dependencies
  - Verify TypeScript types are available
  - _Requirements: All (foundation)_

- [ ] 2. Implement Text Chunker
  - [ ] 2.1 Create TextChunker class with token-based splitting
    - Create `packages/core/src/rag/textChunker.ts`
    - Implement sliding window algorithm with configurable chunk size and overlap
    - Track line numbers and offsets for each chunk
    - Handle edge cases (empty text, single line, very long lines)
    - Use approximate token counting (chars / 4) for performance
    - _Requirements: 1.7_
  
  - [ ] 2.2 Write property test for chunk size and overlap
    - Create `packages/core/src/rag/__tests__/textChunker.property.test.ts`
    - **Property 4: Chunk Size and Overlap**
    - **Validates: Requirements 1.7**
    - Use fast-check with minimum 100 iterations
  
  - [ ] 2.3 Write unit tests for chunker edge cases
    - Create `packages/core/src/rag/__tests__/textChunker.test.ts`
    - Test empty files, single-line files, files with no newlines
    - Test boundary conditions for chunk sizes
    - Test line number tracking accuracy
    - _Requirements: 1.7_

- [ ] 3. Implement Embedding Service
  - [ ] 3.1 Create EmbeddingService class with @xenova/transformers
    - Create `packages/core/src/rag/embeddingService.ts`
    - Implement lazy model loading with caching
    - Add batch embedding support
    - Implement L2 normalization for embeddings
    - Add error handling with retry logic
    - Use Xenova/all-MiniLM-L6-v2 model (384 dimensions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [ ] 3.2 Write property test for embedding dimensions
    - Create `packages/core/src/rag/__tests__/embeddingService.property.test.ts`
    - **Property 9: Embedding Dimensions**
    - **Validates: Requirements 3.2**
    - Test with various text inputs (empty, short, long)
  
  - [ ] 3.3 Write property test for embedding performance
    - Add to `packages/core/src/rag/__tests__/embeddingService.property.test.ts`
    - **Property 10: Embedding Performance**
    - **Validates: Requirements 3.3**
    - Ensure <100ms per chunk
  
  - [ ] 3.4 Write unit tests for model loading and caching
    - Create `packages/core/src/rag/__tests__/embeddingService.test.ts`
    - Test first-time model download (may be slow)
    - Test subsequent uses with cached model
    - Test offline operation
    - Test batch processing
    - _Requirements: 3.4, 3.5, 3.6_

- [ ] 4. Implement Vector Store with LanceDB
  - [ ] 4.1 Create VectorStore class wrapping LanceDB
    - Create `packages/core/src/rag/vectorStore.ts`
    - Implement collection management (create, list, delete)
    - Implement insert, update, delete operations
    - Implement similarity search with configurable top-K and threshold
    - Add checksum-based corruption detection
    - Use existing LanceDBSetup for initialization
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.7, 9.3_
  
  - [ ] 4.2 Write property test for persistence round-trip
    - Create `packages/core/src/rag/__tests__/vectorStore.property.test.ts`
    - **Property 11: Vector Store Persistence Round-Trip**
    - **Validates: Requirements 4.1, 4.5**
    - Test insert → shutdown → restart → query
  
  - [ ] 4.3 Write property test for incremental update isolation
    - Add to `packages/core/src/rag/__tests__/vectorStore.property.test.ts`
    - **Property 12: Incremental Update Isolation**
    - **Validates: Requirements 4.3**
    - Ensure updates don't affect other records
  
  - [ ] 4.4 Write property test for concurrent read safety
    - Add to `packages/core/src/rag/__tests__/vectorStore.property.test.ts`
    - **Property 13: Concurrent Read Safety**
    - **Validates: Requirements 4.6**
    - Test multiple simultaneous reads
  
  - [ ] 4.5 Write property test for write atomicity
    - Add to `packages/core/src/rag/__tests__/vectorStore.property.test.ts`
    - **Property 14: Write Atomicity**
    - **Validates: Requirements 4.7**
    - Test interrupted writes
  
  - [ ] 4.6 Write unit tests for corruption detection
    - Create `packages/core/src/rag/__tests__/vectorStore.test.ts`
    - Test checksum validation
    - Test rebuild offer on corruption
    - Test basic CRUD operations
    - _Requirements: 9.3_

- [ ] 5. Checkpoint - Ensure core services tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Codebase Index
  - [ ] 6.1 Create CodebaseIndex class with file watching
    - Create `packages/core/src/rag/codebaseIndex.ts`
    - Implement workspace scanning with extension and pattern filtering
    - Add file watching using chokidar with debouncing and rate limiting
    - Implement file hashing for change detection
    - Integrate TextChunker for file splitting
    - Integrate EmbeddingService for chunk embedding
    - Integrate VectorStore for persistence
    - Add progress event emission
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 8.4, 8.6_
  
  - [ ]* 6.2 Write property test for automatic workspace indexing
    - Create `packages/core/src/rag/__tests__/codebaseIndex.property.test.ts`
    - **Property 1: Automatic Workspace Indexing**
    - **Validates: Requirements 1.1, 1.5**
  
  - [ ]* 6.3 Write property test for file system change propagation
    - Add to `packages/core/src/rag/__tests__/codebaseIndex.property.test.ts`
    - **Property 2: File System Change Propagation**
    - **Validates: Requirements 1.2, 1.3, 1.4**
  
  - [ ]* 6.4 Write property test for file size filtering
    - Add to `packages/core/src/rag/__tests__/codebaseIndex.property.test.ts`
    - **Property 3: File Size Filtering**
    - **Validates: Requirements 1.6**
  
  - [ ]* 6.5 Write property test for rate limiting
    - Add to `packages/core/src/rag/__tests__/codebaseIndex.property.test.ts`
    - **Property 26: Rate Limiting**
    - **Validates: Requirements 8.4**
  
  - [ ]* 6.6 Write property test for progress reporting
    - Add to `packages/core/src/rag/__tests__/codebaseIndex.property.test.ts`
    - **Property 27: Progress Reporting**
    - **Validates: Requirements 8.6**
  
  - [ ]* 6.7 Write property test for error isolation
    - Add to `packages/core/src/rag/__tests__/codebaseIndex.property.test.ts`
    - **Property 28: Error Isolation**
    - **Validates: Requirements 9.1**
  
  - [ ]* 6.8 Write unit tests for indexing edge cases
    - Create `packages/core/src/rag/__tests__/codebaseIndex.test.ts`
    - Test empty workspace
    - Test workspace with only excluded files
    - Test unreadable files
    - Test file watching events
    - _Requirements: 1.1, 1.5, 9.1_

- [ ] 7. Implement search functionality
  - [ ] 7.1 Add search method to CodebaseIndex
    - Extend `packages/core/src/rag/codebaseIndex.ts`
    - Implement query embedding generation
    - Implement vector similarity search
    - Implement result merging for adjacent chunks
    - Implement result formatting with source attribution
    - Add performance monitoring
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [ ]* 7.2 Write property test for search result correctness
    - Add to `packages/core/src/rag/__tests__/codebaseIndex.property.test.ts`
    - **Property 5: Search Result Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.6**
  
  - [ ]* 7.3 Write property test for search performance
    - Add to `packages/core/src/rag/__tests__/codebaseIndex.property.test.ts`
    - **Property 6: Search Performance**
    - **Validates: Requirements 2.3**
  
  - [ ]* 7.4 Write property test for chunk merging
    - Add to `packages/core/src/rag/__tests__/codebaseIndex.property.test.ts`
    - **Property 7: Chunk Merging**
    - **Validates: Requirements 2.4**
  
  - [ ]* 7.5 Write property test for search result completeness
    - Add to `packages/core/src/rag/__tests__/codebaseIndex.property.test.ts`
    - **Property 8: Search Result Completeness**
    - **Validates: Requirements 2.5**
  
  - [ ]* 7.6 Write unit tests for search edge cases
    - Add to `packages/core/src/rag/__tests__/codebaseIndex.test.ts`
    - Test empty index search
    - Test no results above threshold
    - Test single result
    - Test result ranking
    - _Requirements: 2.1, 2.2_

- [ ] 8. Checkpoint - Ensure codebase indexing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Knowledge Base system
  - [ ] 9.1 Create KnowledgeBase class for mode-specific storage
    - Create `packages/core/src/rag/knowledgeBase.ts`
    - Implement separate collections for each mode (debugger, security, performance, planning)
    - Add knowledge storage with metadata (timestamp, session ID, tags)
    - Add time-range query support
    - Add knowledge search with recency prioritization
    - Add manual clearing functionality
    - Use existing schemas from schemas.ts
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [ ]* 9.2 Write property test for knowledge base isolation
    - Create `packages/core/src/rag/__tests__/knowledgeBase.property.test.ts`
    - **Property 15: Knowledge Base Isolation**
    - **Validates: Requirements 5.1**
  
  - [ ]* 9.3 Write property test for knowledge storage routing
    - Add to `packages/core/src/rag/__tests__/knowledgeBase.property.test.ts`
    - **Property 16: Knowledge Storage Routing**
    - **Validates: Requirements 5.2**
  
  - [ ]* 9.4 Write property test for knowledge search routing
    - Add to `packages/core/src/rag/__tests__/knowledgeBase.property.test.ts`
    - **Property 17: Knowledge Search Routing**
    - **Validates: Requirements 5.3**
  
  - [ ]* 9.5 Write property test for knowledge metadata completeness
    - Add to `packages/core/src/rag/__tests__/knowledgeBase.property.test.ts`
    - **Property 18: Knowledge Metadata Completeness**
    - **Validates: Requirements 5.4**
  
  - [ ]* 9.6 Write property test for time range filtering
    - Add to `packages/core/src/rag/__tests__/knowledgeBase.property.test.ts`
    - **Property 19: Time Range Filtering**
    - **Validates: Requirements 5.5**
  
  - [ ]* 9.7 Write unit tests for knowledge base operations
    - Create `packages/core/src/rag/__tests__/knowledgeBase.test.ts`
    - Test clearing knowledge base
    - Test empty knowledge base queries
    - Test knowledge with various metadata
    - Test recency prioritization
    - _Requirements: 5.6_

- [ ] 10. Implement Configuration Management
  - [ ] 10.1 Create RAG configuration schema and validation
    - Create `packages/core/src/rag/config.ts`
    - Define JSON schema for RAG configuration
    - Implement configuration validation using ajv
    - Add configuration loading from settings service
    - Add default configuration values
    - Implement descriptive error messages for invalid config
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  
  - [ ]* 10.2 Write property test for configuration application
    - Create `packages/core/src/rag/__tests__/config.property.test.ts`
    - **Property 24: Configuration Application**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6**
  
  - [ ]* 10.3 Write property test for configuration validation
    - Add to `packages/core/src/rag/__tests__/config.property.test.ts`
    - **Property 25: Configuration Validation**
    - **Validates: Requirements 7.7, 7.8**
  
  - [ ]* 10.4 Write unit tests for configuration edge cases
    - Create `packages/core/src/rag/__tests__/config.test.ts`
    - Test missing optional fields
    - Test invalid values for each field
    - Test configuration enable/disable
    - Test default values
    - _Requirements: 7.1, 7.7, 7.8_

- [ ] 11. Implement RAG Manager (main coordinator)
  - [ ] 11.1 Create RAGManager class coordinating all components
    - Create `packages/core/src/rag/ragManager.ts`
    - Implement initialization and shutdown
    - Implement searchCodebase method
    - Implement searchKnowledge method
    - Implement storeKnowledge method
    - Implement getContextForMode method with token budget management
    - Implement rebuildCodebaseIndex method
    - Implement clearKnowledgeBase method
    - Implement getStatus method
    - Add error handling with retry logic
    - Coordinate CodebaseIndex, KnowledgeBase, EmbeddingService, VectorStore
    - _Requirements: 2.1, 2.2, 2.3, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.2_
  
  - [ ]* 11.2 Write property test for automatic context injection
    - Create `packages/core/src/rag/__tests__/ragManager.property.test.ts`
    - **Property 20: Automatic Context Injection**
    - **Validates: Requirements 6.1, 6.2**
  
  - [ ]* 11.3 Write property test for token limit compliance
    - Add to `packages/core/src/rag/__tests__/ragManager.property.test.ts`
    - **Property 21: Token Limit Compliance**
    - **Validates: Requirements 6.3**
  
  - [ ]* 11.4 Write property test for source attribution
    - Add to `packages/core/src/rag/__tests__/ragManager.property.test.ts`
    - **Property 22: Source Attribution**
    - **Validates: Requirements 6.4**
  
  - [ ]* 11.5 Write property test for recency prioritization
    - Add to `packages/core/src/rag/__tests__/ragManager.property.test.ts`
    - **Property 23: Recency Prioritization**
    - **Validates: Requirements 6.6**
  
  - [ ]* 11.6 Write property test for retry with exponential backoff
    - Add to `packages/core/src/rag/__tests__/ragManager.property.test.ts`
    - **Property 29: Retry with Exponential Backoff**
    - **Validates: Requirements 9.2**
  
  - [ ]* 11.7 Write property test for data validation
    - Add to `packages/core/src/rag/__tests__/ragManager.property.test.ts`
    - **Property 30: Data Validation**
    - **Validates: Requirements 9.6**
  
  - [ ]* 11.8 Write unit tests for RAG Manager operations
    - Create `packages/core/src/rag/__tests__/ragManager.test.ts`
    - Test initialization and shutdown
    - Test status reporting
    - Test rebuild index
    - Test clear knowledge base
    - Test empty context injection (no relevant results)
    - Test error handling
    - _Requirements: 6.5, 5.6_

- [ ] 12. Checkpoint - Ensure RAG Manager tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Integrate with Mode Manager
  - [ ] 13.1 Add RAG context injection to mode activation
    - Locate Mode Manager implementation (likely in `packages/core/src/modes/` or similar)
    - Modify Mode Manager to call RAGManager.getContextForMode on mode entry
    - Add RAG context to mode's system prompt
    - Handle cases where RAG is disabled
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [ ]* 13.2 Write integration tests for mode activation with RAG
    - Create `packages/core/src/rag/__tests__/integration/modeManager.test.ts`
    - Test debugger mode with RAG context
    - Test security mode with RAG context
    - Test performance mode with RAG context
    - Test planning mode with RAG context
    - Test mode activation with RAG disabled
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 14. Integrate with Context Manager
  - [ ] 14.1 Add RAG token budget to Context Manager
    - Locate Context Manager (likely in `packages/core/src/context/`)
    - Add configuration for RAG token allocation (e.g., 30% of context)
    - Modify Context Manager to reserve tokens for RAG
    - Add RAG context size tracking
    - _Requirements: 10.4_
  
  - [ ]* 14.2 Write integration tests for token budget management
    - Create `packages/core/src/rag/__tests__/integration/contextManager.test.ts`
    - Test RAG context respects token limits
    - Test RAG context with various budget sizes
    - Test RAG context with very small budgets
    - _Requirements: 10.4_

- [ ] 15. Integrate with Settings Service
  - [ ] 15.1 Add RAG configuration to settings schema
    - Update `schemas/settings.schema.json` with RAG configuration section
    - Add RAG configuration to default settings
    - Add settings validation for RAG section
    - Document all RAG configuration options
    - _Requirements: 10.5_
  
  - [ ]* 15.2 Write integration tests for settings loading
    - Create `packages/core/src/rag/__tests__/integration/settings.test.ts`
    - Test loading RAG configuration from settings
    - Test settings validation
    - Test settings updates
    - Test default values
    - _Requirements: 10.5_

- [ ] 16. Add RAG CLI commands
  - [ ] 16.1 Create CLI commands for RAG management
    - Locate CLI command implementation (likely in `packages/cli/src/commands/`)
    - Add `/rag index` command to trigger manual indexing
    - Add `/rag search <query>` command for manual search
    - Add `/rag status` command to show indexing status
    - Add `/rag clear <mode>` command to clear knowledge base
    - Add `/rag rebuild` command to rebuild index
    - Add command help text and examples
    - _Requirements: All (user interface)_
  
  - [ ]* 16.2 Write integration tests for CLI commands
    - Create `packages/cli/src/__tests__/commands/rag.test.ts`
    - Test each CLI command
    - Test command error handling
    - Test command output formatting
    - _Requirements: All (user interface)_

- [ ] 17. Add performance monitoring and logging
  - [ ] 17.1 Add performance metrics collection
    - Create `packages/core/src/rag/metrics.ts`
    - Track indexing time per file
    - Track search query latency
    - Track embedding generation time
    - Track memory usage
    - Add logging for all operations
    - Integrate with existing logging infrastructure
    - _Requirements: 8.1, 8.2_
  
  - [ ]* 17.2 Write unit tests for performance monitoring
    - Create `packages/core/src/rag/__tests__/metrics.test.ts`
    - Test metrics collection
    - Test logging output
    - Test metric aggregation
    - _Requirements: 8.1, 8.2_

- [ ] 18. Final integration testing
  - [ ]* 18.1 Write end-to-end integration tests
    - Create `packages/core/src/rag/__tests__/integration/e2e.test.ts`
    - Test complete workflow: index → search → mode activation → context injection
    - Test file watching and incremental updates
    - Test persistence and recovery after restart
    - Test concurrent operations (indexing + searching)
    - Test error recovery scenarios
    - _Requirements: All_
  
  - [ ]* 18.2 Write performance benchmark tests
    - Create `packages/core/src/rag/__tests__/benchmarks/performance.test.ts`
    - Test initial indexing of 1000 files (<30 seconds)
    - Test search query performance (<500ms)
    - Test embedding performance (<100ms)
    - Test memory usage (<500MB)
    - Use realistic test data
    - _Requirements: 1.8, 2.3, 3.3, 4.4, 8.1_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Run full test suite
  - Verify all 30 properties are tested
  - Check test coverage (>80% line coverage)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Documentation and examples
  - [ ] 20.1 Create user documentation
    - Update `packages/core/src/rag/README.md` with complete usage guide
    - Document configuration options in detail
    - Add usage examples for all public APIs
    - Document CLI commands with examples
    - Add troubleshooting guide for common issues
    - Add FAQ section
    - _Requirements: All (documentation)_
  
  - [ ] 20.2 Create developer documentation
    - Create `packages/core/src/rag/ARCHITECTURE.md`
    - Document architecture and design decisions
    - Add API documentation for RAGManager and all components
    - Document extension points for customization
    - Add performance tuning guide
    - Document testing strategy
    - _Requirements: All (documentation)_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties (30 total)
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions
- Performance tests validate non-functional requirements
- The implementation follows a bottom-up approach: utilities → services → integration → testing
- All property tests should run with minimum 100 iterations
- Each property test must be tagged with: `Feature: stage-10a-rag-integration, Property N: [property text]`
