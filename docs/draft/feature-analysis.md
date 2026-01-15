# OLLM CLI Feature Analysis & Recommendations

## Current State Assessment

After analyzing the codebase, OLLM CLI has a **solid foundation** with:

### ✅ Implemented

| Component | Status | Quality |
|-----------|--------|---------|
| **Provider System** | ✅ Complete | Excellent abstraction, extensible |
| **Tool System** | ✅ Complete | 12 tools with policy engine |
| **Session Management** | ✅ Complete | Recording, compression, loop detection |
| **Context Management** | ✅ Planned | Detailed spec, not fully coded |
| **Hooks System** | ✅ Spec Ready | Requirements defined, needs impl |
| **MCP Integration** | ✅ Spec Ready | Requirements defined, needs impl |
| **Extensions** | ✅ Spec Ready | Requirements defined, needs impl |

### 🔲 Not Yet Implemented

| Component | Notes |
|-----------|-------|
| Codebase Indexing | No vector DB / RAG support |
| Git Integration | No automatic commits |
| Vision/Image Support | Provider types exist, no tool |
| Structured Output | No JSON schema enforcement |
| Multi-turn Planning | No agent planning/delegation |
| Browser/Web Automation | Only web_fetch for static content |
| Code Execution | No sandboxed code runner |
| Project Templates | No scaffolding system |

---

## Gap Analysis: OLLM CLI vs Competitors

### vs Aider

| Feature | Aider | OLLM CLI | Gap |
|---------|-------|----------|-----|
| Git auto-commit | ✅ | ❌ | **High** |
| Multi-file edits | ✅ | ✅ | None |
| Repo map | ✅ | ❌ | **High** |
| Voice commands | ✅ | ❌ | Low |
| Diff preview | ✅ | ✅ | None |
| Undo changes | ✅ | ❌ | Medium |
| Token tracking | ✅ | ✅ | None |

### vs Continue.dev

| Feature | Continue | OLLM CLI | Gap |
|---------|----------|----------|-----|
| Codebase indexing | ✅ | ❌ | **High** |
| Context @-mentions | ✅ | ❌ | **High** |
| Slash commands | ✅ | ✅ | None |
| Terminal commands | ✅ | ✅ | None |
| Headless mode | ✅ | ✅ | None |
| Model switching | ✅ | ✅ | None |
| Custom prompts | ✅ | Partial | Medium |

### vs Cursor

| Feature | Cursor | OLLM CLI | Gap |
|---------|--------|----------|-----|
| IDE integration | ✅ | ❌ | Different product |
| Codebase RAG | ✅ | ❌ | **High** |
| Multi-file composer | ✅ | ✅ | None |
| Tab completion | ✅ | ❌ | N/A (CLI) |
| Rules files | ✅ | ✅ (.ollm/ollm.md) | None |

---

## Recommended Features to Add

### Priority 1: High Impact, Moderate Effort

#### 1. **Git Integration Tool**

Auto-commit changes with semantic messages:

```typescript
// New tool: packages/core/src/tools/git.ts

interface GitParams {
  action: 'status' | 'diff' | 'commit' | 'log' | 'undo';
  message?: string;
  files?: string[];
}

// Features:
// - auto-commit after successful tool executions
// - semantic commit message generation
// - git status awareness in prompts
// - undo last AI change
```

**Why**: Aider's killer feature. Tracks all changes, easy rollback.

---

#### 2. **Codebase Indexing / RAG**

Vector-based codebase search for semantic queries:

```typescript
// New service: packages/core/src/services/codebaseIndexService.ts

interface CodebaseIndex {
  // Index the codebase
  index(rootPath: string, options?: IndexOptions): Promise<void>;
  
  // Semantic search
  search(query: string, topK?: number): Promise<SearchResult[]>;
  
  // Get file summary
  getSummary(filePath: string): Promise<string>;
  
  // Incremental update
  updateFile(filePath: string): Promise<void>;
}

// Storage: SQLite + local embeddings (no cloud required)
// Model: All-MiniLM-L6-v2 or similar local embedding model
```

**Why**: Critical for large projects. Models need relevant context.

---

#### 3. **Context @-Mentions**

Reference files/symbols in prompts:

```
User: Refactor @src/utils/helpers.ts to use async/await
User: The @DatabaseService class needs a connection pool
User: Check @package.json for outdated dependencies
```

**Implementation**:
- Parse `@path` mentions in user input
- Auto-load file content into context
- Support glob patterns: `@src/**/*.ts`
- Support symbols: `@ClassName.methodName`

**Why**: Explicit context > implicit context. Reduces hallucination.

---

### Priority 2: Medium Impact, Moderate Effort

#### 4. **Structured Output / JSON Mode**

Enforce JSON schema on model outputs:

```typescript
// Enhancement to GenerationOptions
interface GenerationOptions {
  // ... existing
  responseFormat?: 'text' | 'json' | { type: 'json_schema'; schema: object };
}

// vLLM provider: use guided_json
// Ollama provider: use format: 'json'
```

**Why**: Critical for tool calling, data extraction, API responses.

---

#### 5. **Project Templates / Scaffolding**

Generate project structures from templates:

```bash
ollm scaffold react-app my-project
ollm scaffold express-api my-api
ollm scaffold python-cli my-tool
```

**Implementation**:
- Template registry (local + remote)
- Variable interpolation
- Post-generation hooks
- Custom templates in `~/.ollm/templates/`

**Why**: Common request. AI-assisted project creation.

---

#### 6. **Code Execution Tool**

Sandboxed execution for testing:

```typescript
// New tool: packages/core/src/tools/execute.ts

interface ExecuteParams {
  language: 'javascript' | 'python' | 'bash';
  code: string;
  timeout?: number;
}

// Features:
// - Sandboxed execution (vm2, pyodide, etc.)
// - Capture stdout/stderr
// - Resource limits
// - File I/O restrictions
```

**Why**: Test code before committing. Verify fixes work.

---

#### 7. **Image/Vision Support**

Analyze images with vision models:

```typescript
// New tool: packages/core/src/tools/image-analyze.ts

interface ImageAnalyzeParams {
  imagePath: string;
  prompt?: string;
}

// Existing MessagePart already supports images:
// { type: 'image'; data: string; mimeType: string }

// Need:
// - Tool to load and analyze images
// - Provider updates to handle vision models
// - UI updates to display images in terminal
```

**Why**: Screenshot debugging, UI analysis, document processing.

---

### Priority 3: Nice to Have

#### 8. **Agent Planning System**

Multi-step task decomposition:

```typescript
// New: packages/core/src/agents/planner.ts

interface TaskPlan {
  goal: string;
  steps: TaskStep[];
  currentStep: number;
  status: 'planning' | 'executing' | 'complete' | 'failed';
}

interface TaskStep {
  description: string;
  toolCalls: ToolCall[];
  dependencies: string[];
  status: 'pending' | 'running' | 'complete' | 'skipped';
}
```

**Why**: Complex tasks need planning. Prevents "just do it" failures.

---

#### 9. **Conversation Branching**

Fork and compare different approaches:

```bash
/branch new-approach     # Create branch from current state
/branch list             # Show branches
/branch switch main      # Switch branches
/branch merge new-approach  # Merge changes
```

**Why**: Explore alternatives without losing context.

---

#### 10. **Cost Tracking**

Track API usage and costs:

```typescript
// New: packages/core/src/services/costTracker.ts

interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  requests: number;
  estimatedCost: number;
  timeframe: 'session' | 'day' | 'month';
}

// Display:
// Session: 12,450 tokens (~$0.02)
// This month: 1.2M tokens (~$2.40)
```

**Why**: Budget awareness. Local vs cloud cost comparison.

---

#### 11. **Browser Automation Tool**

Headless browser for web interaction:

```typescript
// New tool: packages/core/src/tools/browser.ts

interface BrowserParams {
  action: 'navigate' | 'click' | 'type' | 'screenshot' | 'extract';
  url?: string;
  selector?: string;
  text?: string;
}

// Use: Playwright or Puppeteer
// Safe mode: Read-only by default
```

**Why**: Test web apps, scrape dynamic content, fill forms.

---

#### 12. **Diff Review Mode**

Interactive diff approval:

```bash
# Instead of auto-applying, show diff and ask
ollm --review-diffs

# Shows:
# ┌─ Proposed Change: src/utils.ts ─────────────────┐
# │ - function old() { ... }                         │
# │ + function new() { ... }                         │
# └─────────────────────────────────────────────────┘
# Apply? [y]es / [n]o / [e]dit / [a]ll
```

**Why**: More control over AI changes. Catch errors before commit.

---

## Implementation Roadmap

### Phase A: Core Productivity (4-5 days)

1. **Git Integration Tool** (2 days)
   - git status awareness
   - auto-commit with AI messages
   - undo last change

2. **@-Mentions** (2 days)
   - file path parsing
   - auto-context loading
   - glob pattern support

### Phase B: Intelligence Layer (5-7 days)

3. **Codebase Indexing** (4 days)
   - SQLite storage
   - Local embeddings
   - Semantic search API

4. **Structured Output** (2 days)
   - JSON mode for providers
   - Schema validation

### Phase C: Advanced Features (7-10 days)

5. **Code Execution** (3 days)
6. **Image/Vision** (2 days)
7. **Project Templates** (2 days)
8. **Cost Tracking** (2 days)

---

## Quick Wins (< 1 day each)

1. **Undo Tool** - Restore last file state from session
2. **Token Counter Display** - Show tokens in status bar
3. **Prompt Templates** - `/prompt list`, `/prompt use code-review`
4. **Export Chat** - Save conversation as markdown
5. **Model Presets** - Quick switch between model configs
6. **Auto-title Sessions** - AI-generated session names
7. **Copy Last Response** - `/copy` to clipboard

---

## Recommended New Stage

### Stage 11: Developer Experience Improvements

**Goal**: Add features that make daily development faster.

**Estimated Effort**: 7-10 days

#### Tasks

| ID | Task | Deliverables | Effort |
|----|------|--------------|--------|
| S11-T01 | Git integration tool | `git.ts`, tests | 2 days |
| S11-T02 | @-mentions parser | Context loader | 1.5 days |
| S11-T03 | Structured output | JSON mode | 1 day |
| S11-T04 | Diff review mode | Interactive approver | 1.5 days |
| S11-T05 | Quick win tools | undo, copy, export | 1.5 days |
| S11-T06 | Prompt templates | Template system | 1 day |

#### Acceptance Criteria

- [ ] Git status shown in prompt when in repo
- [ ] @file references auto-load content
- [ ] JSON output validated against schema
- [ ] Changes reviewed before commit
- [ ] Sessions export to markdown

---

## Summary: Top 5 Features to Add

| Rank | Feature | Impact | Effort | Why |
|------|---------|--------|--------|-----|
| 1 | **Git Integration** | Very High | Medium | Aider's killer feature |
| 2 | **@-Mentions** | Very High | Low | Explicit context control |
| 3 | **Codebase RAG** | Very High | High | Essential for large projects |
| 4 | **Structured Output** | High | Low | Tool calling reliability |
| 5 | **Diff Review** | High | Medium | User control over changes |

These five features would significantly close the gap with Aider and Continue.dev while maintaining OLLM CLI's local-first, provider-agnostic philosophy.
