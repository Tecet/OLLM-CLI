# Stage 11: Intelligence Layer

**Goal**: Add advanced AI capabilities including codebase indexing, structured output, code execution, and vision support.

**Prerequisites**: Stages 01-10 complete (core functionality stable, multi-provider support)

**Estimated Effort**: 10-14 days

---

## Overview

This stage adds the "intelligence layer" that enables OLLM CLI to work effectively with large codebases and provide more reliable outputs:

1. **Codebase Indexing / RAG** - Semantic search across codebase
2. **Structured Output** - JSON schema enforcement
3. **Code Execution Sandbox** - Test code before committing
4. **Image/Vision Support** - Analyze screenshots and images
5. **Quick Win Tools** - Undo, copy, export, templates, cost tracking

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Intelligence Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Codebase       │  │  Structured     │  │  Code           │ │
│  │  Index          │  │  Output         │  │  Executor       │ │
│  │                 │  │                 │  │                 │ │
│  │  - embeddings   │  │  - json_schema  │  │  - sandbox      │ │
│  │  - search       │  │  - validation   │  │  - timeout      │ │
│  │  - summaries    │  │  - guided gen   │  │  - capture      │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Vision         │  │  Cost           │  │  Quick Win      │ │
│  │  Support        │  │  Tracker        │  │  Tools          │ │
│  │                 │  │                 │  │                 │ │
│  │  - analyze img  │  │  - tokens       │  │  - undo         │ │
│  │  - screenshot   │  │  - sessions     │  │  - export       │ │
│  │  - OCR          │  │  - monthly      │  │  - templates    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tasks

### S11-T01: Codebase Indexing / RAG

**Goal**: Enable semantic search across codebase for relevant context retrieval.

**Effort**: 4 days

**Steps**:

1. Create `packages/core/src/index/codebaseIndex.ts`:

```typescript
interface CodebaseIndex {
  // Initialize/update index
  index(rootPath: string, options?: IndexOptions): Promise<IndexStats>;
  
  // Semantic search
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  // Get file summary
  getSummary(filePath: string): Promise<FileSummary>;
  
  // Update on file change
  updateFile(filePath: string): Promise<void>;
  removeFile(filePath: string): Promise<void>;
  
  // Index status
  getStats(): Promise<IndexStats>;
  clear(): Promise<void>;
}

interface IndexOptions {
  extensions?: string[];          // ['.ts', '.js', '.py']
  excludePatterns?: string[];     // ['node_modules', 'dist']
  maxFileSize?: number;           // Skip large files
  chunkSize?: number;             // Tokens per chunk
  chunkOverlap?: number;          // Overlap between chunks
}

interface SearchOptions {
  topK?: number;                  // Number of results
  threshold?: number;             // Minimum similarity
  fileTypes?: string[];           // Filter by extension
  maxTokens?: number;             // Limit total tokens
}

interface SearchResult {
  filePath: string;
  content: string;
  score: number;
  startLine: number;
  endLine: number;
}
```

2. Create `packages/core/src/index/embeddingService.ts`:

```typescript
interface EmbeddingService {
  // Generate embeddings
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  
  // Similarity search
  similarity(a: number[], b: number[]): number;
}

// Implementation options:
// 1. Local: transformers.js with all-MiniLM-L6-v2
// 2. Ollama: ollama.embeddings() API
// 3. vLLM: /v1/embeddings endpoint
```

3. Create `packages/core/src/index/vectorStore.ts`:

```typescript
// SQLite-based vector storage (local, no external DB)
interface VectorStore {
  // Store vectors
  upsert(id: string, vector: number[], metadata: object): Promise<void>;
  
  // Search by vector
  searchByVector(vector: number[], topK: number): Promise<VectorResult[]>;
  
  // Delete
  delete(id: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
}

// Use: better-sqlite3 with blob storage for vectors
// Alternative: lancedb for more features
```

4. Auto-index on workspace load:

```typescript
// In CLI startup
async function initializeWorkspace(path: string) {
  const index = new CodebaseIndex();
  
  if (config.codebase.autoIndex) {
    await index.index(path, {
      extensions: config.codebase.extensions,
      excludePatterns: config.codebase.exclude,
    });
  }
}
```

5. Add `/codebase` slash commands:

```
/codebase index          # Index current workspace
/codebase search <query> # Search codebase
/codebase stats          # Show index stats
/codebase clear          # Clear index
```

**Deliverables**:
- `packages/core/src/index/codebaseIndex.ts`
- `packages/core/src/index/embeddingService.ts`
- `packages/core/src/index/vectorStore.ts`
- `packages/core/src/index/__tests__/*.test.ts`

**Acceptance Criteria**:
- [ ] Codebase indexed on first load
- [ ] Semantic search returns relevant results
- [ ] Index updates on file changes
- [ ] Works offline with local embeddings
- [ ] Respects .gitignore

---

### S11-T02: Structured Output / JSON Mode

**Goal**: Enforce JSON schema on model outputs for reliable parsing.

**Effort**: 2 days

**Steps**:

1. Update `packages/core/src/provider/types.ts`:

```typescript
interface GenerationOptions {
  // ... existing options
  
  // Structured output
  responseFormat?: ResponseFormat;
}

type ResponseFormat = 
  | 'text'
  | 'json'
  | { 
      type: 'json_schema'; 
      schema: JSONSchema; 
      strict?: boolean;
    };

interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: any[];
  description?: string;
}
```

2. Update providers to support structured output:

```typescript
// LocalProvider (Ollama)
private mapRequest(request: ProviderRequest) {
  return {
    // ... existing mapping
    format: request.options?.responseFormat === 'json' ? 'json' : undefined,
  };
}

// VllmProvider
private mapRequest(request: ProviderRequest) {
  const body: any = { /* ... */ };
  
  if (request.options?.responseFormat) {
    if (typeof request.options.responseFormat === 'object') {
      // vLLM guided decoding
      body.guided_json = request.options.responseFormat.schema;
    }
  }
  
  return body;
}
```

3. Add validation layer:

```typescript
// packages/core/src/output/jsonValidator.ts

interface JsonValidator {
  validate(output: string, schema: JSONSchema): ValidationResult;
  parse(output: string): any;
  extractJson(output: string): string | null;  // Extract JSON from mixed output
}

interface ValidationResult {
  valid: boolean;
  data?: any;
  errors?: string[];
}
```

4. Tool for structured extraction:

```typescript
// New tool for data extraction
interface ExtractParams {
  content: string;
  schema: JSONSchema;
  description?: string;
}

class ExtractTool implements DeclarativeTool<ExtractParams, ToolResult> {
  // Uses structured output to extract data matching schema
}
```

**Deliverables**:
- Update `packages/core/src/provider/types.ts`
- Update `packages/ollm-bridge/src/provider/localProvider.ts`
- Update `packages/ollm-bridge/src/provider/vllmProvider.ts` (when created)
- `packages/core/src/output/jsonValidator.ts`
- `packages/core/src/tools/extract.ts`

**Acceptance Criteria**:
- [ ] JSON mode works with Ollama
- [ ] JSON schema enforced with vLLM
- [ ] Invalid JSON triggers retry
- [ ] Extraction tool reliably extracts structured data
- [ ] Works with existing tool calling

---

### S11-T03: Code Execution Sandbox

**Goal**: Execute code snippets in a sandboxed environment for testing.

**Effort**: 3 days

**Steps**:

1. Create `packages/core/src/tools/execute.ts`:

```typescript
interface ExecuteParams {
  language: 'javascript' | 'typescript' | 'python' | 'bash';
  code: string;
  timeout?: number;         // Default: 10 seconds
  captureOutput?: boolean;  // Default: true
}

class ExecuteTool implements DeclarativeTool<ExecuteParams, ToolResult> {
  name = 'execute';
  displayName = 'Execute Code';
  
  // Policy: Always requires confirmation (dangerous)
  async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails> {
    return {
      level: 'dangerous',
      message: `Execute ${this.params.language} code`,
      preview: this.params.code.slice(0, 200),
    };
  }
}
```

2. Create `packages/core/src/sandbox/executor.ts`:

```typescript
interface CodeExecutor {
  execute(code: string, language: Language): Promise<ExecutionResult>;
  
  // Language-specific configuration
  configure(language: Language, options: ExecutorOptions): void;
}

interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;        // Milliseconds
  memoryUsed?: number;     // Bytes
}

interface ExecutorOptions {
  timeout: number;
  maxMemory: number;
  allowNetwork: boolean;
  allowFileSystem: boolean;
  workingDir?: string;
}
```

3. Implement language executors:

```typescript
// JavaScript/TypeScript: Use vm2 or isolated-vm
class JsExecutor implements LanguageExecutor {
  async execute(code: string): Promise<ExecutionResult> {
    const { VM } = require('vm2');
    const vm = new VM({
      timeout: this.options.timeout,
      sandbox: this.getSandbox(),
    });
    
    return vm.run(code);
  }
}

// Python: Use subprocess with timeout
class PythonExecutor implements LanguageExecutor {
  async execute(code: string): Promise<ExecutionResult> {
    // Write to temp file, execute with python, capture output
  }
}

// Bash: Use subprocess with restricted environment
class BashExecutor implements LanguageExecutor {
  async execute(code: string): Promise<ExecutionResult> {
    // Execute with sh -c, capture output
  }
}
```

**Deliverables**:
- `packages/core/src/tools/execute.ts`
- `packages/core/src/sandbox/executor.ts`
- `packages/core/src/sandbox/jsExecutor.ts`
- `packages/core/src/sandbox/pythonExecutor.ts`
- `packages/core/src/sandbox/bashExecutor.ts`
- Tests for each executor

**Acceptance Criteria**:
- [ ] JavaScript code executes in sandbox
- [ ] Python code executes if python available
- [ ] Bash commands execute with restrictions
- [ ] Timeout kills long-running code
- [ ] Output is captured and returned
- [ ] Network/filesystem access can be restricted

---

### S11-T04: Image/Vision Support

**Goal**: Analyze images using vision-capable models.

**Effort**: 2 days

**Steps**:

1. Create `packages/core/src/tools/image-analyze.ts`:

```typescript
interface ImageAnalyzeParams {
  imagePath: string;
  prompt?: string;           // What to analyze
  detail?: 'low' | 'high';   // Detail level
}

class ImageAnalyzeTool implements DeclarativeTool<ImageAnalyzeParams, ToolResult> {
  name = 'image_analyze';
  displayName = 'Analyze Image';
  
  async execute(): Promise<ToolResult> {
    // Load image as base64
    const imageData = await this.loadImage(this.params.imagePath);
    
    // Create message with image part
    const message: Message = {
      role: 'user',
      parts: [
        { type: 'image', data: imageData.base64, mimeType: imageData.mimeType },
        { type: 'text', text: this.params.prompt || 'Describe this image.' }
      ]
    };
    
    // Call vision model
    const response = await this.provider.chatStream({
      model: this.getVisionModel(),
      messages: [message],
    });
    
    return { llmContent: await collectResponse(response) };
  }
}
```

2. Update provider to handle images:

```typescript
// In LocalProvider.mapMessages()
private mapMessages(messages: Message[]): OllamaMessage[] {
  return messages.map(msg => {
    const images: string[] = [];
    let content = '';
    
    for (const part of msg.parts) {
      if (part.type === 'text') {
        content += part.text;
      } else if (part.type === 'image') {
        images.push(part.data);  // Base64 data
      }
    }
    
    return {
      role: msg.role,
      content,
      ...(images.length > 0 && { images }),
    };
  });
}
```

3. Add screenshot tool:

```typescript
interface ScreenshotParams {
  url?: string;              // Take screenshot of URL
  fullPage?: boolean;        // Full page vs viewport
  selector?: string;         // Specific element
}

class ScreenshotTool implements DeclarativeTool<ScreenshotParams, ToolResult> {
  // Uses Playwright for screenshots
  // Returns path to saved image
}
```

**Deliverables**:
- `packages/core/src/tools/image-analyze.ts`
- `packages/core/src/tools/screenshot.ts`
- Update provider message mapping, Vision model detection

**Acceptance Criteria**:
- [ ] Images load and analyze with vision models
- [ ] Supports JPEG, PNG, GIF, WebP
- [ ] Screenshot captures web pages
- [ ] Large images are resized appropriately
- [ ] Error for non-vision models

---

### S11-T05: Quick Win Tools

**Goal**: Add small but useful tools for better developer experience.

**Effort**: 3 days

**Steps**:

1. **Undo Tool** - Restore previous file state:

```typescript
interface UndoParams {
  filePath?: string;         // Specific file, or last changed
  steps?: number;            // How many changes to undo
}

class UndoTool {
  // Uses session recording to find previous state
  // Restores file to that state
}
```

2. **Export Tool** - Save conversation as markdown:

```typescript
interface ExportParams {
  format: 'markdown' | 'json' | 'html';
  outputPath?: string;
  includeTools?: boolean;
}

class ExportTool {
  // Exports current session to file
}
```

3. **Copy Tool** - Copy to clipboard:

```typescript
interface CopyParams {
  content?: string;          // Specific content
  lastResponse?: boolean;    // Copy last AI response
  codeBlock?: number;        // Copy Nth code block from last response
}

class CopyTool {
  // Uses clipboardy to copy content
}
```

4. **Prompt Templates** - Reusable prompts:

```typescript
interface PromptTemplateService {
  list(): PromptTemplate[];
  get(name: string): PromptTemplate;
  create(template: PromptTemplate): void;
  delete(name: string): void;
  apply(name: string, variables?: Record<string, string>): string;
}

// Usage:
// /prompt use code-review
// /prompt create bug-fix
// /prompt list
```

5. **Cost Tracker** - Token usage and costs:

```typescript
interface CostTracker {
  recordUsage(usage: TokenUsage): void;
  getSessionStats(): UsageStats;
  getDailyStats(): UsageStats;
  getMonthlyStats(): UsageStats;
  estimateCost(usage: TokenUsage, model: string): number;
}

// Display in status bar:
// "Session: 12.4K tokens (~$0.02)"
```

**Deliverables**:
- `packages/core/src/tools/undo.ts`
- `packages/core/src/tools/export.ts`
- `packages/core/src/tools/copy.ts`
- `packages/core/src/services/promptTemplateService.ts`
- `packages/core/src/services/costTracker.ts`

**Acceptance Criteria**:
- [ ] Undo restores previous file state
- [ ] Export creates readable markdown
- [ ] Copy works with clipboard
- [ ] Templates can be created and used
- [ ] Cost shows in status bar

---

## Configuration Schema Updates

```yaml
# ~/.ollm/config.yaml additions

codebase:
  autoIndex: true
  extensions: ['.ts', '.js', '.py', '.go', '.rs', '.java']
  exclude: ['node_modules', 'dist', '.git', 'vendor']
  maxFileSize: 100000        # 100KB
  embeddingModel: 'local'    # 'local' | 'ollama' | 'provider'
  
output:
  jsonMode:
    enabled: true
    strictParsing: true
    retryOnError: true
    maxRetries: 3
    
execution:
  enabled: true
  timeout: 10000             # 10 seconds
  languages:
    javascript: true
    python: true
    bash: false              # Disabled by default
  sandbox:
    allowNetwork: false
    allowFileSystem: false
    
vision:
  defaultModel: 'llava'
  maxImageSize: 4096         # Max dimension
  screenshotQuality: 80
  
cost:
  trackUsage: true
  showInStatusBar: true
  budgetWarning: 10.00       # Warn at $10/month
```

---

## Testing Strategy

### Unit Tests
- Vector similarity calculations
- JSON schema validation
- Code execution sandbox isolation
- Image loading and encoding

### Integration Tests
- Full RAG workflow: index → search → context
- Structured output with real models
- Code execution with various languages
- Vision analysis with test images

### Performance Tests
- Indexing speed for large codebases
- Search latency
- Embedding generation throughput

---

## Verification Checklist

- [ ] Codebase indexes in under 60s for 10K files
- [ ] Semantic search returns relevant results
- [ ] JSON mode produces valid JSON
- [ ] Code execution is properly sandboxed
- [ ] Images analyze correctly with vision models
- [ ] Undo works for file changes
- [ ] Export produces readable markdown
- [ ] Cost tracking is accurate
- [ ] All features work offline

---

## Dependencies

New dependencies:
- `better-sqlite3` - Vector storage
- `@xenova/transformers` - Local embeddings (optional)
- `isolated-vm` or `vm2` - JavaScript sandbox
- `clipboardy` - Clipboard access
- `playwright` - Screenshots (optional)
