# RAG (Retrieval-Augmented Generation) System

This directory contains the RAG infrastructure for semantic search and knowledge bases in the Dynamic Prompt System.

## Overview

The RAG system provides:
- **Codebase Indexing**: Semantic search across your workspace files
- **Mode-Specific Knowledge**: Specialized knowledge bases for debugger, security, performance, and planning modes
- **Local Embeddings**: Uses `@xenova/transformers` for offline operation
- **Vector Storage**: LanceDB for efficient vector search

## Architecture

```
rag/
├── RAGSystem.ts          # Core interfaces and types
├── LanceDBSetup.ts       # Database initialization
├── schemas.ts            # Table schemas for all databases
├── index.ts              # Public exports
└── __tests__/            # Unit tests
```

## Components

### RAGSystem Interface

Defines the core RAG system architecture:
- `CodebaseIndex`: Index and search workspace files
- `EmbeddingService`: Generate vector embeddings
- `LanceDBVectorStore`: Store and search vectors
- `modeKnowledge`: Mode-specific knowledge bases

### LanceDBSetup

Handles database initialization and table creation:
- Creates storage directory
- Initializes LanceDB connection
- Creates tables for codebase and mode knowledge
- Provides table management utilities

### Schemas

Defines table schemas for:
- **Codebase Index**: File paths, chunks, embeddings, metadata
- **Debugger Knowledge**: Bugs, errors, solutions
- **Security Knowledge**: Vulnerabilities, CVEs, fixes
- **Performance Knowledge**: Bottlenecks, optimizations
- **Planning Knowledge**: Design patterns, architectures

## Usage

### Initialize RAG System

```typescript
import { LanceDBSetup, createDefaultRAGConfig } from './rag/index.js';

// Create configuration
const config = createDefaultRAGConfig('~/.ollm/rag');

// Initialize database
const setup = new LanceDBSetup(config);
const connection = await setup.initialize();

// Use tables
const codebaseTable = connection.tables.get('codebase');
const debuggerTable = connection.tables.get('debugger');
```

### Create Custom Table

```typescript
const customSchema = {
  name: 'custom_knowledge',
  dimensions: 384,
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'content', type: 'string', required: true },
    { name: 'timestamp', type: 'timestamp', required: true }
  ]
};

const table = await setup.createTable(customSchema);
```

### Validate Records

```typescript
import { validateRecord, CODEBASE_INDEX_SCHEMA } from './rag/index.js';

const record = {
  id: 'file.ts:0',
  vector: new Array(384).fill(0),
  filePath: 'src/file.ts',
  content: 'code content',
  startLine: 1,
  endLine: 10,
  language: 'typescript',
  lastModified: Date.now()
};

const result = validateRecord(record, CODEBASE_INDEX_SCHEMA);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## Configuration

Default configuration:

```typescript
{
  enabled: true,
  storageDir: '~/.ollm/rag',
  codebase: {
    autoIndex: true,
    extensions: ['.ts', '.js', '.py', '.md', '.json'],
    excludePatterns: ['node_modules', 'dist', '.git'],
    maxFileSize: 1048576, // 1MB
    chunkSize: 512,
    chunkOverlap: 50
  },
  embedding: {
    provider: 'local',
    model: 'Xenova/all-MiniLM-L6-v2'
  },
  search: {
    topK: 5,
    threshold: 0.7
  }
}
```

## Storage Structure

```
~/.ollm/rag/
├── codebase_index.lance/       # Codebase vectors
├── knowledge_debugger.lance/   # Debugger knowledge
├── knowledge_security.lance/   # Security knowledge
├── knowledge_performance.lance/# Performance knowledge
└── knowledge_planning.lance/   # Planning knowledge
```

## Dependencies

- `vectordb` (^0.10.0): LanceDB for vector storage
- `@xenova/transformers` (^2.17.0): Local embeddings

## Testing

Run tests:

```bash
npm test -- packages/core/src/rag/__tests__/schemas.test.ts --run
```

Note: LanceDBSetup tests require the `vectordb` package to be installed.

## Future Enhancements

This is Phase 19 of the Dynamic Prompt System (marked as FUTURE):

1. **Embedding Service**: Implement local embedding generation
2. **Codebase Index**: Implement workspace indexing and search
3. **Vector Store**: Implement LanceDB vector operations
4. **Mode Integration**: Integrate with mode-specific knowledge bases
5. **RAG Context**: Inject relevant context on mode entry
6. **Knowledge Indexing**: Store findings on mode exit

## Status

✅ **Completed**:
- Core interfaces and types
- LanceDB setup and initialization
- Table schemas for all databases
- Unit tests for schemas
- Comprehensive documentation

⏳ **Pending** (Future Development):
- Embedding service implementation
- Codebase indexing implementation
- Vector store operations
- Mode integration
- RAG context injection

## Related Documentation

- [Dynamic Prompt System Design](../.kiro/specs/stage-04c-dynamic-prompt-system/design.md)
- [Task List](../.kiro/specs/stage-04c-dynamic-prompt-system/tasks.md)
- [Requirements](../.kiro/specs/stage-04c-dynamic-prompt-system/requirements.md)
