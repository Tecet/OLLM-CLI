/**
 * RAG (Retrieval-Augmented Generation) System
 * 
 * Provides semantic search and knowledge base capabilities for the Dynamic Prompt System.
 * Integrates with LanceDB for vector storage and @xenova/transformers for local embeddings.
 */

/**
 * Core RAG system interface that orchestrates all RAG components
 */
export interface RAGSystem {
  /** Codebase indexing and search */
  codebaseIndex: CodebaseIndex;
  
  /** Embedding service for vector generation */
  embeddingService: EmbeddingService;
  
  /** Vector storage backend */
  vectorStore: LanceDBVectorStore;
  
  /** Mode-specific knowledge bases */
  modeKnowledge: {
    debugger: LanceDBIndex;     // Common bugs, solutions
    security: LanceDBIndex;     // Vulnerabilities, fixes
    performance: LanceDBIndex;  // Optimization patterns
    planning: LanceDBIndex;     // Design patterns
  };
  
  /** Initialize the RAG system */
  initialize(config: RAGConfig): Promise<void>;
  
  /** Shutdown and cleanup resources */
  shutdown(): Promise<void>;
  
  /** Get system status and statistics */
  getStatus(): RAGStatus;
}

/**
 * Codebase indexing and semantic search
 */
export interface CodebaseIndex {
  /** Initialize the index for a workspace */
  initialize(rootPath: string, options: IndexOptions): Promise<void>;
  
  /** Shutdown and cleanup */
  shutdown(): Promise<void>;
  
  /** Index the entire workspace */
  indexWorkspace(): Promise<IndexStats>;
  
  /** Update a single file in the index */
  updateFile(filePath: string): Promise<void>;
  
  /** Remove a file from the index */
  removeFile(filePath: string): Promise<void>;
  
  /** Search for relevant code chunks */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  /** Get index statistics */
  getStats(): IndexStats;
  
  /** Clear the entire index */
  clear(): Promise<void>;
}

/**
 * Embedding service for generating vector representations
 */
export interface EmbeddingService {
  /** Generate embedding for a single text */
  embed(text: string): Promise<number[]>;
  
  /** Generate embeddings for multiple texts (batch) */
  embedBatch(texts: string[]): Promise<number[][]>;
  
  /** Calculate cosine similarity between two vectors */
  cosineSimilarity(a: number[], b: number[]): number;
  
  /** Get embedding dimensions */
  getDimensions(): number;
  
  /** Get model name */
  getModel(): string;
  
  /** Initialize the embedding model */
  initialize(): Promise<void>;
  
  /** Cleanup resources */
  shutdown(): Promise<void>;
}

/**
 * LanceDB vector store interface
 */
export interface LanceDBVectorStore {
  /** Insert or update a vector */
  upsert(id: string, vector: number[], metadata: VectorMetadata): Promise<void>;
  
  /** Insert or update multiple vectors (batch) */
  upsertBatch(items: VectorItem[]): Promise<void>;
  
  /** Search for similar vectors */
  searchByVector(vector: number[], topK: number, threshold?: number): Promise<VectorResult[]>;
  
  /** Delete a vector by ID */
  delete(id: string): Promise<void>;
  
  /** Clear all vectors */
  clear(): Promise<void>;
  
  /** Get total vector count */
  count(): Promise<number>;
  
  /** Initialize the vector store */
  initialize(tableName: string, dimensions: number): Promise<void>;
  
  /** Shutdown and cleanup */
  shutdown(): Promise<void>;
}

/**
 * Mode-specific knowledge base index
 */
export interface LanceDBIndex {
  /** Add knowledge to the index */
  add(knowledge: KnowledgeItem): Promise<void>;
  
  /** Add multiple knowledge items (batch) */
  addBatch(items: KnowledgeItem[]): Promise<void>;
  
  /** Search for relevant knowledge */
  search(query: string, topK: number, threshold?: number): Promise<KnowledgeResult[]>;
  
  /** Clear the index */
  clear(): Promise<void>;
  
  /** Get index statistics */
  getStats(): KnowledgeStats;
}

/**
 * Configuration for the RAG system
 */
export interface RAGConfig {
  /** Enable/disable RAG system */
  enabled: boolean;
  
  /** Storage directory for vector databases */
  storageDir: string;
  
  /** Codebase indexing configuration */
  codebase: {
    autoIndex: boolean;
    extensions: string[];
    excludePatterns: string[];
    maxFileSize: number;
    chunkSize: number;
    chunkOverlap: number;
  };
  
  /** Embedding configuration */
  embedding: {
    provider: 'local' | 'ollama';
    model: string;
  };
  
  /** Search configuration */
  search: {
    topK: number;
    threshold: number;
  };
}

/**
 * Options for indexing operations
 */
export interface IndexOptions {
  /** File extensions to index */
  extensions: string[];
  
  /** Patterns to exclude (glob) */
  excludePatterns: string[];
  
  /** Maximum file size to index (bytes) */
  maxFileSize: number;
  
  /** Chunk size in tokens */
  chunkSize: number;
  
  /** Overlap between chunks in tokens */
  chunkOverlap: number;
  
  /** Auto-index on startup */
  autoIndex: boolean;
}

/**
 * Options for search operations
 */
export interface SearchOptions {
  /** Number of results to return */
  topK?: number;
  
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  
  /** Filter by file extension */
  extensions?: string[];
  
  /** Filter by file path pattern */
  pathPattern?: string;
}

/**
 * Search result from codebase index
 */
export interface SearchResult {
  /** File path relative to workspace root */
  filePath: string;
  
  /** Code chunk content */
  content: string;
  
  /** Similarity score (0-1) */
  score: number;
  
  /** Start line number */
  startLine: number;
  
  /** End line number */
  endLine: number;
  
  /** Additional metadata */
  metadata: {
    language: string;
    lastModified: Date;
  };
}

/**
 * Vector metadata for storage
 */
export interface VectorMetadata {
  /** File path */
  filePath: string;
  
  /** Start line number */
  startLine: number;
  
  /** End line number */
  endLine: number;
  
  /** Programming language */
  language: string;
  
  /** Last modified timestamp */
  lastModified: number;
  
  /** Additional custom metadata */
  [key: string]: unknown;
}

/**
 * Vector item for batch operations
 */
export interface VectorItem {
  /** Unique identifier */
  id: string;
  
  /** Vector embedding */
  vector: number[];
  
  /** Associated metadata */
  metadata: VectorMetadata;
}

/**
 * Vector search result
 */
export interface VectorResult {
  /** Vector ID */
  id: string;
  
  /** Similarity score (0-1) */
  score: number;
  
  /** Associated metadata */
  metadata: VectorMetadata;
}

/**
 * Knowledge item for mode-specific knowledge bases
 */
export interface KnowledgeItem {
  /** Unique identifier */
  id: string;
  
  /** Knowledge content */
  content: string;
  
  /** Knowledge type (e.g., 'bug', 'vulnerability', 'pattern') */
  type: string;
  
  /** Additional metadata */
  metadata: {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    tags?: string[];
    source?: string;
    timestamp?: number;
    [key: string]: unknown;
  };
}

/**
 * Knowledge search result
 */
export interface KnowledgeResult {
  /** Knowledge item */
  item: KnowledgeItem;
  
  /** Similarity score (0-1) */
  score: number;
}

/**
 * Index statistics
 */
export interface IndexStats {
  /** Total number of files indexed */
  fileCount: number;
  
  /** Total number of chunks */
  chunkCount: number;
  
  /** Total size in bytes */
  totalSize: number;
  
  /** Last index time */
  lastIndexed: Date | null;
  
  /** Index status */
  status: 'idle' | 'indexing' | 'error';
}

/**
 * Knowledge base statistics
 */
export interface KnowledgeStats {
  /** Total number of knowledge items */
  itemCount: number;
  
  /** Last update time */
  lastUpdated: Date | null;
}

/**
 * RAG system status
 */
export interface RAGStatus {
  /** Is RAG system initialized */
  initialized: boolean;
  
  /** Codebase index status */
  codebaseIndex: IndexStats;
  
  /** Mode knowledge statistics */
  modeKnowledge: {
    debugger: KnowledgeStats;
    security: KnowledgeStats;
    performance: KnowledgeStats;
    planning: KnowledgeStats;
  };
  
  /** Embedding service status */
  embeddingService: {
    model: string;
    dimensions: number;
    ready: boolean;
  };
}
