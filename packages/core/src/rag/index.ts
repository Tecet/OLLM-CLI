/**
 * RAG (Retrieval-Augmented Generation) System
 * 
 * Exports all RAG-related interfaces, classes, and utilities.
 */

// Core interfaces
export type {
  RAGSystem,
  CodebaseIndex,
  EmbeddingService,
  LanceDBVectorStore,
  LanceDBIndex,
  RAGConfig,
  IndexOptions,
  SearchOptions,
  SearchResult,
  VectorMetadata,
  VectorItem,
  VectorResult,
  KnowledgeItem,
  KnowledgeResult,
  IndexStats,
  KnowledgeStats,
  RAGStatus
} from './RAGSystem.js';

// LanceDB setup
export {
  LanceDBSetup,
  createDefaultRAGConfig
} from './LanceDBSetup.js';

export type {
  TableSchema,
  SchemaField,
  LanceDBConnection,
  TableStats
} from './LanceDBSetup.js';

// Schemas
export {
  CODEBASE_INDEX_SCHEMA,
  DEBUGGER_KNOWLEDGE_SCHEMA,
  SECURITY_KNOWLEDGE_SCHEMA,
  PERFORMANCE_KNOWLEDGE_SCHEMA,
  PLANNING_KNOWLEDGE_SCHEMA,
  TABLE_SCHEMAS,
  getTableSchema,
  validateRecord,
  createCodebaseRecordId,
  parseCodebaseRecordId,
  createKnowledgeRecordId
} from './schemas.js';
