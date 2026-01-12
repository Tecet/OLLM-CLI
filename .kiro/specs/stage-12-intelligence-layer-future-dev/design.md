# Design Document

## Overview

The Intelligence Layer extends OLLM CLI with advanced AI capabilities that enable semantic codebase understanding, reliable structured outputs, safe code execution, vision analysis, and enhanced developer productivity. This layer sits above the core provider system and integrates with existing tools, services, and the chat runtime.

The design follows a modular architecture where each capability (indexing, structured output, execution, vision, productivity tools) is implemented as an independent service or tool that can be enabled/disabled through configuration. All components respect the existing policy engine for user confirmations and integrate with the session recording system for undo/export functionality.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      Intelligence Layer                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Codebase Index                         │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │ Embedding  │  │  Vector    │  │   File     │         │  │
│  │  │  Service   │→ │   Store    │← │  Watcher   │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Structured Output System                     │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │   Schema   │  │ Validation │  │   Retry    │         │  │
│  │  │  Enforcer  │→ │  Service   │→ │  Handler   │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Code Execution Sandbox                    │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │     JS     │  │   Python   │  │    Bash    │         │  │
│  │  │  Executor  │  │  Executor  │  │  Executor  │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Vision Support                         │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │   Image    │  │  Vision    │  │ Screenshot │         │  │
│  │  │   Loader   │→ │   Model    │  │   Service  │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Productivity Tools                           │  │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐      │  │
│  │  │ Undo │  │Export│  │ Copy │  │Prompt│  │ Cost │      │  │
│  │  │ Tool │  │ Tool │  │ Tool │  │Tmpl  │  │Track │      │  │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────┬───────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼────────┐            ┌─────────▼────────┐
│  Core Provider │            │   Tool Registry  │
│     System     │            │  Policy Engine   │
└────────────────┘            └──────────────────┘
```


### Component Interactions

1. **Codebase Index** integrates with the file discovery service to watch for changes and automatically update embeddings
2. **Structured Output** extends provider request options and adds validation middleware to the chat client
3. **Code Execution** registers as a dangerous tool requiring confirmation through the policy engine
4. **Vision Support** extends the message format to support image parts and routes to vision-capable models
5. **Productivity Tools** leverage session recording service for undo/export and integrate with the clipboard

## Components and Interfaces

### 1. Codebase Index Service

```typescript
// packages/core/src/index/codebaseIndex.ts

interface CodebaseIndex {
  // Lifecycle
  initialize(rootPath: string, options: IndexOptions): Promise<void>;
  shutdown(): Promise<void>;
  
  // Indexing operations
  indexWorkspace(): Promise<IndexStats>;
  updateFile(filePath: string): Promise<void>;
  removeFile(filePath: string): Promise<void>;
  
  // Search operations
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getSummary(filePath: string): Promise<FileSummary | null>;
  
  // Status and management
  getStats(): IndexStats;
  clear(): Promise<void>;
  rebuild(): Promise<void>;
}

interface IndexOptions {
  extensions: string[];           // ['.ts', '.js', '.py']
  excludePatterns: string[];      // ['node_modules', 'dist']
  maxFileSize: number;            // Bytes, skip larger files
  chunkSize: number;              // Tokens per chunk
  chunkOverlap: number;           // Overlap between chunks
  autoIndex: boolean;             // Index on startup
  embeddingProvider: 'local' | 'ollama' | 'provider';
}

interface SearchOptions {
  topK: number;                   // Number of results (default: 5)
  threshold: number;              // Minimum similarity (0-1)
  fileTypes?: string[];           // Filter by extension
  maxTokens?: number;             // Limit total tokens returned
}

interface SearchResult {
  filePath: string;
  content: string;
  score: number;                  // Similarity score (0-1)
  startLine: number;
  endLine: number;
  metadata: {
    language: string;
    lastModified: Date;
  };
}

interface IndexStats {
  totalFiles: number;
  totalChunks: number;
  totalTokens: number;
  lastIndexed: Date;
  indexSize: number;              // Bytes on disk
}

interface FileSummary {
  filePath: string;
  language: string;
  exports: string[];              // Exported symbols
  imports: string[];              // Imported modules
  summary: string;                // AI-generated summary
}
```


### 2. Embedding Service

```typescript
// packages/core/src/index/embeddingService.ts

interface EmbeddingService {
  // Generate embeddings
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  
  // Similarity calculations
  cosineSimilarity(a: number[], b: number[]): number;
  
  // Configuration
  getDimensions(): number;
  getModel(): string;
}

// Implementation strategies:
// 1. LocalEmbeddingService: Uses @xenova/transformers with all-MiniLM-L6-v2
// 2. OllamaEmbeddingService: Uses Ollama embeddings API
// 3. ProviderEmbeddingService: Uses configured provider's embedding endpoint

class LocalEmbeddingService implements EmbeddingService {
  private pipeline: any;
  private model = 'Xenova/all-MiniLM-L6-v2';
  
  async initialize(): Promise<void> {
    const { pipeline } = await import('@xenova/transformers');
    this.pipeline = await pipeline('feature-extraction', this.model);
  }
  
  async embed(text: string): Promise<number[]> {
    const output = await this.pipeline(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }
  
  getDimensions(): number {
    return 384; // all-MiniLM-L6-v2 dimension
  }
}
```

### 3. Vector Store

```typescript
// packages/core/src/index/vectorStore.ts

interface VectorStore {
  // Storage operations
  upsert(id: string, vector: number[], metadata: VectorMetadata): Promise<void>;
  upsertBatch(items: VectorItem[]): Promise<void>;
  
  // Search operations
  searchByVector(vector: number[], topK: number, threshold?: number): Promise<VectorResult[]>;
  searchById(id: string): Promise<VectorResult | null>;
  
  // Management
  delete(id: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
  clear(): Promise<void>;
  
  // Statistics
  count(): Promise<number>;
  size(): Promise<number>; // Bytes on disk
}

interface VectorMetadata {
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  lastModified: number; // Timestamp
}

interface VectorItem {
  id: string;
  vector: number[];
  metadata: VectorMetadata;
}

interface VectorResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

// Implementation using better-sqlite3
class SqliteVectorStore implements VectorStore {
  private db: Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }
  
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        vector BLOB NOT NULL,
        metadata TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_created_at ON vectors(created_at);
    `);
  }
  
  async searchByVector(query: number[], topK: number, threshold = 0.0): Promise<VectorResult[]> {
    // Brute force cosine similarity search
    // For large datasets, consider using FAISS or lancedb
    const stmt = this.db.prepare('SELECT id, vector, metadata FROM vectors');
    const rows = stmt.all();
    
    const results = rows.map(row => {
      const vector = this.deserializeVector(row.vector);
      const score = this.cosineSimilarity(query, vector);
      return {
        id: row.id,
        score,
        metadata: JSON.parse(row.metadata),
      };
    });
    
    return results
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
```


### 4. Structured Output System

```typescript
// packages/core/src/output/structuredOutput.ts

interface StructuredOutputService {
  // Generate with schema enforcement
  generateWithSchema<T>(
    request: ProviderRequest,
    schema: JSONSchema,
    options?: StructuredOutputOptions
  ): Promise<T>;
  
  // Validate output against schema
  validate(output: string, schema: JSONSchema): ValidationResult<any>;
  
  // Extract JSON from mixed content
  extractJson(output: string): string | null;
}

interface StructuredOutputOptions {
  strict: boolean;                // Strict schema enforcement
  maxRetries: number;             // Retry on validation failure
  retryDelay: number;             // Delay between retries (ms)
}

interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: ValidationError[];
}

interface ValidationError {
  path: string;
  message: string;
  expected: string;
  received: string;
}

// JSON Schema definition
interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: any[];
  description?: string;
  additionalProperties?: boolean;
}

// Provider integration
interface ResponseFormat {
  type: 'text' | 'json' | 'json_schema';
  schema?: JSONSchema;
  strict?: boolean;
}
```


### 5. Code Execution Sandbox

```typescript
// packages/core/src/sandbox/codeExecutor.ts

interface CodeExecutor {
  // Execute code in sandbox
  execute(code: string, language: Language, options?: ExecutionOptions): Promise<ExecutionResult>;
  
  // Check if language is supported
  isSupported(language: Language): boolean;
  
  // Get language configuration
  getConfig(language: Language): LanguageConfig;
}

type Language = 'javascript' | 'typescript' | 'python' | 'bash';

interface ExecutionOptions {
  timeout: number;                // Milliseconds
  maxMemory: number;              // Bytes
  allowNetwork: boolean;
  allowFileSystem: boolean;
  workingDir?: string;
  env?: Record<string, string>;
}

interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;               // Milliseconds
  memoryUsed?: number;            // Bytes
  timedOut: boolean;
  error?: string;
}

interface LanguageConfig {
  enabled: boolean;
  defaultTimeout: number;
  maxMemory: number;
  allowNetwork: boolean;
  allowFileSystem: boolean;
}

// Language-specific executors
interface LanguageExecutor {
  execute(code: string, options: ExecutionOptions): Promise<ExecutionResult>;
  validate(code: string): Promise<ValidationResult<void>>;
}
```


### 6. Vision Support

```typescript
// packages/core/src/vision/visionService.ts

interface VisionService {
  // Analyze image with vision model
  analyzeImage(imagePath: string, prompt: string, options?: VisionOptions): Promise<string>;
  
  // Load and encode image
  loadImage(imagePath: string): Promise<ImageData>;
  
  // Check if model supports vision
  isVisionModel(modelName: string): boolean;
  
  // Get available vision models
  getVisionModels(): Promise<string[]>;
}

interface VisionOptions {
  detail: 'low' | 'high';         // Detail level for analysis
  maxDimension: number;           // Resize if larger
  model?: string;                 // Override default vision model
}

interface ImageData {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

// Screenshot service
interface ScreenshotService {
  // Capture screenshot
  capture(options: ScreenshotOptions): Promise<string>;
  
  // Check if browser is available
  isAvailable(): Promise<boolean>;
}

interface ScreenshotOptions {
  url?: string;                   // URL to capture
  fullPage?: boolean;             // Full page vs viewport
  selector?: string;              // CSS selector for element
  width?: number;                 // Viewport width
  height?: number;                // Viewport height
  quality?: number;               // JPEG quality (0-100)
  outputPath?: string;            // Save location
}
```


### 7. Productivity Tools

```typescript
// packages/core/src/tools/undo.ts
interface UndoParams {
  filePath?: string;              // Specific file, or last changed
  steps?: number;                 // Number of changes to undo (default: 1)
}

// packages/core/src/tools/export.ts
interface ExportParams {
  format: 'markdown' | 'json' | 'html';
  outputPath?: string;            // Default: session-{timestamp}.{ext}
  includeTools?: boolean;         // Include tool calls (default: true)
  includeSystem?: boolean;        // Include system messages (default: false)
}

// packages/core/src/tools/copy.ts
interface CopyParams {
  content?: string;               // Specific content to copy
  lastResponse?: boolean;         // Copy last AI response
  codeBlock?: number;             // Copy Nth code block (1-indexed)
}

// packages/core/src/services/promptTemplateService.ts
interface PromptTemplateService {
  list(): PromptTemplate[];
  get(name: string): PromptTemplate | null;
  create(template: PromptTemplate): void;
  delete(name: string): void;
  apply(name: string, variables?: Record<string, string>): string;
}

interface PromptTemplate {
  name: string;
  description: string;
  content: string;                // Template with {{variable}} placeholders
  variables: TemplateVariable[];
  category?: string;
}

interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

// packages/core/src/services/costTracker.ts
interface CostTracker {
  recordUsage(usage: TokenUsage, model: string): void;
  getSessionStats(): UsageStats;
  getDailyStats(date?: Date): UsageStats;
  getMonthlyStats(year: number, month: number): UsageStats;
  estimateCost(usage: TokenUsage, model: string): number;
  reset(): void;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface UsageStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  requestCount: number;
  modelBreakdown: Record<string, TokenUsage>;
}
```


## Data Models

### Codebase Index Storage

```typescript
// SQLite schema for vector store
interface VectorStoreSchema {
  vectors: {
    id: string;                   // Primary key: {filePath}:{chunkIndex}
    vector: Buffer;               // Serialized float array
    metadata: string;             // JSON metadata
    created_at: number;           // Unix timestamp
  };
  
  files: {
    path: string;                 // Primary key
    language: string;
    last_indexed: number;         // Unix timestamp
    chunk_count: number;
    token_count: number;
  };
}

// In-memory index structure
interface CodebaseIndexState {
  files: Map<string, FileIndexEntry>;
  chunks: Map<string, ChunkEntry>;
  stats: IndexStats;
}

interface FileIndexEntry {
  path: string;
  language: string;
  lastIndexed: Date;
  chunks: string[];             // Chunk IDs
}

interface ChunkEntry {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  vector: number[];
}
```

### Session Recording Extensions

```typescript
// Extend existing session recording for undo/export
interface SessionEvent {
  // ... existing fields
  
  // New fields for intelligence layer
  fileChanges?: FileChange[];
  imageAnalysis?: ImageAnalysisEvent[];
  codeExecutions?: CodeExecutionEvent[];
}

interface FileChange {
  filePath: string;
  timestamp: Date;
  previousContent: string;
  newContent: string;
  operation: 'create' | 'update' | 'delete';
}

interface ImageAnalysisEvent {
  timestamp: Date;
  imagePath: string;
  prompt: string;
  response: string;
  model: string;
}

interface CodeExecutionEvent {
  timestamp: Date;
  language: Language;
  code: string;
  result: ExecutionResult;
}
```

### Cost Tracking Storage

```typescript
// SQLite schema for cost tracking
interface CostTrackingSchema {
  usage: {
    id: string;                   // UUID
    timestamp: number;            // Unix timestamp
    session_id: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost: number;
  };
  
  sessions: {
    id: string;                   // Primary key
    started_at: number;
    ended_at: number;
    total_tokens: number;
    estimated_cost: number;
  };
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Codebase Indexing Properties

Property 1: Automatic indexing respects configuration
*For any* workspace with configured file extensions, when the workspace is loaded with auto-indexing enabled, all files matching the configured extensions should be indexed and files not matching should be excluded.
**Validates: Requirements 1.1, 7.2**

Property 2: Search results are ranked and limited
*For any* semantic search query with topK parameter, the returned results should be sorted by descending similarity score and limited to at most topK results.
**Validates: Requirements 1.3**

Property 3: File exclusion patterns are respected
*For any* workspace with .gitignore patterns and configured exclude patterns, indexed files should not match any exclusion pattern.
**Validates: Requirements 1.4, 7.3**

Property 4: Large files are skipped
*For any* file exceeding the configured maximum size, that file should not appear in the index.
**Validates: Requirements 1.5**

Property 5: Vector persistence round-trip
*For any* set of vectors stored in the vector store, after restarting the system, querying for those vectors should return the same vectors with the same metadata.
**Validates: Requirements 1.7**

Property 6: Clear removes all data
*For any* vector store with indexed data, after clearing the index, the store should contain zero vectors and zero files.
**Validates: Requirements 1.8**

### Structured Output Properties

Property 7: JSON mode produces valid JSON
*For any* request with JSON response format, the output should be parseable as valid JSON.
**Validates: Requirements 2.1**

Property 8: Schema conformance
*For any* JSON schema provided, the validated output should conform to all schema constraints including type, required fields, and structure.
**Validates: Requirements 2.2, 2.4**

Property 9: Retry on validation failure
*For any* structured output request that produces invalid output, the system should retry up to the configured maximum attempts before returning an error.
**Validates: Requirements 2.3**

Property 10: Validation errors are descriptive
*For any* output that fails schema validation, the error message should include the path, expected type, and received type for each violation.
**Validates: Requirements 2.5**

Property 11: Extract tool schema conformance
*For any* text and schema provided to the extract tool, the extracted data should conform to the provided schema.
**Validates: Requirements 2.6**

### Code Execution Properties

Property 12: Execution requires confirmation
*For any* code execution request, the system should require user confirmation before executing the code.
**Validates: Requirements 3.1, 10.1**

Property 13: Sandbox isolation
*For any* code executed in the sandbox with network and filesystem access disabled, attempts to access the network or files outside the working directory should fail.
**Validates: Requirements 3.2, 3.7, 3.8**

Property 14: Timeout enforcement
*For any* code execution that runs longer than the configured timeout, the sandbox should terminate the process and return a timeout error.
**Validates: Requirements 3.5**

Property 15: Output capture completeness
*For any* code execution that completes, the result should include stdout, stderr, exit code, and execution duration.
**Validates: Requirements 3.6**

Property 16: Environment variable restriction
*For any* code executed in the sandbox, sensitive environment variables should not be accessible to the executed code.
**Validates: Requirements 3.4, 10.2**

### Vision Support Properties

Property 17: Image loading and encoding
*For any* valid image file in supported formats (JPEG, PNG, GIF, WebP), the image should load successfully and be encoded as valid base64.
**Validates: Requirements 4.1**

Property 18: Vision message format
*For any* image analysis request, the message sent to the model should include both the image data and the analysis prompt.
**Validates: Requirements 4.2**

Property 19: Image resizing preserves aspect ratio
*For any* image exceeding maximum dimensions, the resized image should have dimensions at or below the maximum while maintaining the original aspect ratio.
**Validates: Requirements 4.4**

### Productivity Tool Properties

Property 20: Undo restores previous state
*For any* file modification recorded in session history, undoing that modification should restore the file to its previous content.
**Validates: Requirements 5.1**

Property 21: Undo defaults to most recent
*For any* session with multiple file modifications, when no file is specified for undo, the most recently modified file should be selected.
**Validates: Requirements 5.2**

Property 22: Export creates valid output
*For any* session export request, the exported file should exist, be readable, and contain the session data in the specified format.
**Validates: Requirements 5.3**

Property 23: Markdown export formatting
*For any* session exported to markdown, the output should contain formatted messages, tool calls, and responses with proper markdown structure.
**Validates: Requirements 5.4**

Property 24: Response extraction
*For any* session with AI responses, copying the last response should extract only the AI response text without tool calls or system messages.
**Validates: Requirements 5.6**

Property 25: Code block extraction
*For any* response containing N code blocks, extracting the Kth code block (where K ≤ N) should return the correct code block content.
**Validates: Requirements 5.7**

Property 26: Template listing completeness
*For any* set of created templates, listing templates should return all templates with their names and descriptions.
**Validates: Requirements 5.8**

Property 27: Template variable substitution
*For any* template with variables, applying the template with variable values should substitute all variable placeholders with the provided values.
**Validates: Requirements 5.9**

Property 28: Template persistence
*For any* valid template created, the template should be saved and retrievable in subsequent sessions.
**Validates: Requirements 5.10**

### Cost Tracking Properties

Property 29: Usage recording
*For any* model response generation, the cost tracker should record input tokens, output tokens, and model name.
**Validates: Requirements 6.1**

Property 30: Usage aggregation
*For any* set of recorded usage events, aggregating by session, day, or month should produce totals that equal the sum of individual events.
**Validates: Requirements 6.2, 6.3, 6.4**

Property 31: Budget warning threshold
*For any* monthly usage that exceeds the configured budget warning threshold, the system should trigger a warning.
**Validates: Requirements 6.6**

Property 32: Cost estimation accuracy
*For any* token usage and model, the estimated cost should match the provider-specific pricing calculation.
**Validates: Requirements 6.7**

Property 33: Usage persistence round-trip
*For any* recorded usage data, after restarting the system, querying for usage statistics should return the same data.
**Validates: Requirements 6.8**

### Configuration Properties

Property 34: Language execution filtering
*For any* language disabled in configuration, execution requests for that language should be rejected.
**Validates: Requirements 7.5**

Property 35: Sandbox restriction enforcement
*For any* sandbox restrictions configured (network, filesystem), the sandbox should enforce those restrictions during code execution.
**Validates: Requirements 7.6**

### Error Handling Properties

Property 36: Indexing continues on file errors
*For any* workspace where some files fail to index, the remaining files should still be indexed successfully.
**Validates: Requirements 9.1**

Property 37: Embedding retry with backoff
*For any* embedding generation failure, the system should retry up to 3 times with exponential backoff before failing.
**Validates: Requirements 9.2**

Property 38: Validation fallback after retries
*For any* structured output that fails validation after maximum retries, the system should return the raw output with a validation error.
**Validates: Requirements 9.4**

Property 39: Sandbox error isolation
*For any* code execution that crashes, the sandbox should capture the error and return it without crashing the main process.
**Validates: Requirements 9.5**

Property 40: Image error handling
*For any* corrupted or unreadable image file, the image analyze tool should return a descriptive error message.
**Validates: Requirements 9.6**

Property 41: Template validation errors
*For any* template with invalid syntax, the template service should return a validation error with details about the syntax issue.
**Validates: Requirements 9.8**

### Security Properties

Property 42: Vector metadata privacy
*For any* vector stored in the vector store, the metadata should not contain raw file contents.
**Validates: Requirements 10.4**

Property 43: Export sanitization
*For any* session export, sensitive information (API keys, tokens, passwords) should be sanitized from the exported content.
**Validates: Requirements 10.6**

Property 44: Cost tracking privacy
*For any* cost tracking session, no usage data should be transmitted to external services without explicit user consent.
**Validates: Requirements 10.7**

Property 45: URL validation
*For any* image URL provided, the system should validate the URL and reject URLs with malicious patterns or protocols.
**Validates: Requirements 10.8**


## Error Handling

### Indexing Errors

1. **File Read Failures**: Log error, skip file, continue indexing
2. **Embedding Generation Failures**: Retry with exponential backoff (3 attempts)
3. **Vector Store Corruption**: Detect on startup, offer rebuild option
4. **Large File Skipping**: Log warning with file path and size

### Structured Output Errors

1. **Invalid JSON**: Retry generation up to configured max retries
2. **Schema Validation Failure**: Return detailed validation errors with paths
3. **Provider Incompatibility**: Fall back to prompt-based JSON with validation
4. **Timeout**: Return partial output with timeout error

### Code Execution Errors

1. **Timeout**: Terminate process, return timeout error with duration
2. **Crash**: Capture error, return stack trace, isolate from main process
3. **Permission Denied**: Return descriptive error about sandbox restrictions
4. **Language Not Supported**: Return error listing supported languages
5. **Memory Exhaustion**: Terminate process, return memory limit error

### Vision Errors

1. **Non-Vision Model**: Return error indicating vision capability required
2. **Corrupted Image**: Return descriptive error with file path
3. **Unsupported Format**: Return error listing supported formats
4. **Image Too Large**: Resize automatically, log warning
5. **Screenshot Failure**: Return error with browser/URL details

### Productivity Tool Errors

1. **Undo No History**: Return error indicating no previous state available
2. **Export Write Failure**: Return error with file path and permissions
3. **Clipboard Unavailable**: Fall back to temp file, notify user
4. **Template Not Found**: Return error with available template names
5. **Template Invalid Syntax**: Return validation error with line/column

### Cost Tracking Errors

1. **Storage Write Failure**: Log error, continue operation (non-critical)
2. **Corrupted Usage Data**: Reset statistics, log warning
3. **Unknown Model Pricing**: Use default estimate, log warning


## Testing Strategy

### Dual Testing Approach

The intelligence layer requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests** verify specific examples, edge cases, and error conditions
- **Property tests** verify universal properties across all inputs
- Both are complementary and necessary for comprehensive coverage

### Unit Testing Focus

Unit tests should focus on:
- Specific examples that demonstrate correct behavior (e.g., indexing a known file structure)
- Integration points between components (e.g., codebase index with file watcher)
- Edge cases and error conditions (e.g., corrupted images, invalid templates)
- Configuration scenarios (e.g., disabled features, custom settings)

Avoid writing too many unit tests - property-based tests handle covering lots of inputs.

### Property-Based Testing

Property tests should focus on:
- Universal properties that hold for all inputs (e.g., search results always ranked)
- Comprehensive input coverage through randomization
- Round-trip properties (e.g., store/retrieve vectors, undo/redo)
- Invariants (e.g., sandbox isolation, schema conformance)

**Configuration**:
- Minimum 100 iterations per property test
- Each property test must reference its design document property
- Tag format: **Feature: stage-12-intelligence-layer, Property {number}: {property_text}**

### Testing by Component

**Codebase Index**:
- Unit: Index known file structure, verify expected files indexed
- Property: For any workspace, indexed files match configured extensions
- Property: For any search query, results are ranked by score
- Integration: File watcher triggers index updates

**Structured Output**:
- Unit: Validate specific JSON against known schema
- Property: For any schema, validated output conforms to schema
- Property: For any invalid output, retry occurs up to max attempts
- Integration: Provider integration with schema enforcement

**Code Execution**:
- Unit: Execute known code snippets, verify output
- Property: For any code exceeding timeout, execution terminates
- Property: For any sandbox restrictions, access is denied
- Integration: Policy engine confirmation flow

**Vision Support**:
- Unit: Load known images, verify encoding
- Property: For any valid image, loading succeeds
- Property: For any oversized image, resizing preserves aspect ratio
- Integration: Vision model message format

**Productivity Tools**:
- Unit: Undo specific file change, verify restoration
- Property: For any file modification, undo restores previous state
- Property: For any template with variables, substitution works
- Integration: Session recording integration

**Cost Tracking**:
- Unit: Record known usage, verify statistics
- Property: For any usage events, aggregation sums correctly
- Property: For any stored usage, persistence round-trip works
- Integration: Provider token counting

### Test Data Generation

For property-based tests, generate:
- **Files**: Random content, various sizes, different extensions
- **Schemas**: Random JSON schemas with varying complexity
- **Code**: Valid and invalid code in supported languages
- **Images**: Various formats, sizes, aspect ratios
- **Templates**: Valid and invalid template syntax
- **Usage Data**: Random token counts, models, timestamps

### Performance Testing

Separate performance tests should verify:
- Indexing 10,000 files completes within 60 seconds
- Search returns results within 500 milliseconds
- Code execution startup overhead under 100 milliseconds
- Image loading and encoding completes within 2 seconds

### Security Testing

Separate security tests should verify:
- Sandbox prevents access to parent process
- Environment variables are sanitized
- Exported sessions have secrets redacted
- URL validation rejects malicious URLs
- Vector metadata doesn't expose file contents

