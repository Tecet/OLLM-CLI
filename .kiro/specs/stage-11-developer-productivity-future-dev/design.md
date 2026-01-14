# Design Document: Developer Productivity Tools

## Overview

The Developer Productivity Tools system adds three high-impact features that enable Aider-like developer workflows: Git integration for version control operations, @-mentions for explicit context loading, and diff review mode for interactive change approval. These features work together to provide developers with fine-grained control over context, changes, and version history while maintaining the conversational interface of OLLM CLI.

The system consists of three core components: Git Tool and Service provide version control operations with auto-commit capabilities, Mention Parser and Context Loader enable explicit file/symbol/URL references in prompts, and Diff Reviewer provides interactive approval for file changes. Together, these components enable workflows where developers can reference specific code, review proposed changes before application, and automatically version their work.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Developer Productivity Layer                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Git Tool       │  │  Mention Parser │  │  Diff Reviewer  │ │
│  │                 │  │                 │  │                 │ │
│  │  - status       │  │  - @file        │  │  - show diff    │ │
│  │  - commit       │  │  - @glob        │  │  - approve      │ │
│  │  - diff         │  │  - @symbol      │  │  - reject       │ │
│  │  - undo         │  │  - @url         │  │  - edit         │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           v                    v                    v           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Core Runtime Integration                       ││
│  │  (Chat Client, Tool Registry, Input Processing)             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Git Tool**: Provides Git operations as a declarative tool (status, diff, commit, log, undo, stash, branch), validates repository state, formats output for LLM consumption, and integrates with policy engine for confirmations.

**Git Service**: Wraps simple-git library, manages repository operations, tracks AI-made changes for undo, generates semantic commit messages, handles auto-commit workflows, and respects .gitignore patterns.


**Mention Parser**: Parses @-mentions from user input using regex patterns, identifies mention types (file, glob, symbol, URL, directory), resolves mentions to paths/content, and handles special Git mentions (@git:status, @git:diff, @git:log:N).

**Context Loader**: Loads file content with metadata, resolves glob patterns to file lists, fetches URL content, provides symbol lookup (when AST parsing available), enforces token limits, and caches loaded content.

**Diff Reviewer**: Generates unified diffs for file changes, parses diffs into hunks, manages pending review queue, applies approved changes, rejects unwanted changes, and integrates with auto-commit.

**Configuration Manager**: Manages settings for Git integration (auto-commit, message style), mention parsing (token limits, file limits), and review mode (enabled, auto-approve rules, context lines).

**UI Components**: Displays diff review panels with syntax highlighting, handles keyboard shortcuts for approval/rejection, shows status bar indicators for Git state and pending reviews, and provides visual feedback for mentions.

## Components and Interfaces

### Git Tool

```typescript
interface GitParams {
  action: 'status' | 'diff' | 'commit' | 'log' | 'undo' | 'stash' | 'branch';
  message?: string;      // For commit action
  files?: string[];      // Specific files for diff/commit
  count?: number;        // For log action (limit)
}

interface GitToolResult extends ToolResult {
  llmContent: string;    // Formatted output for LLM
  returnDisplay: string; // Human-readable output
  gitData?: {            // Structured data
    status?: GitStatus;
    diff?: string;
    commits?: CommitInfo[];
    branch?: string;
  };
}

class GitTool implements DeclarativeTool<GitParams, GitToolResult> {
  name = 'git';
  displayName = 'Git Operations';
  description = 'Perform Git version control operations';
  
  schema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'diff', 'commit', 'log', 'undo', 'stash', 'branch'],
        description: 'Git operation to perform'
      },
      message: {
        type: 'string',
        description: 'Commit message (required for commit action)'
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific files to operate on'
      },
      count: {
        type: 'number',
        description: 'Number of log entries to show'
      }
    },
    required: ['action']
  };
  
  async execute(signal: AbortSignal): Promise<GitToolResult>;
}
```

**Action Behaviors**:

- **status**: Returns working tree status (modified, staged, untracked files)
- **diff**: Returns unified diff of unstaged changes
- **commit**: Creates commit with message, optionally for specific files
- **log**: Returns recent commit history (default 10, configurable)
- **undo**: Reverts last AI-made file change
- **stash**: Stashes or unstashes changes
- **branch**: Lists branches or switches to specified branch

**Implementation Notes**:
- Validate repository exists before operations
- Format output for both LLM and human consumption
- Include file counts and summaries in status
- Truncate large diffs with continuation indicator
- Track AI-made changes in metadata for undo
- Respect .gitignore for status and diff



### Git Service

```typescript
interface GitStatus {
  branch: string;
  modified: string[];
  staged: string[];
  untracked: string[];
  ahead: number;         // Commits ahead of remote
  behind: number;        // Commits behind remote
}

interface CommitInfo {
  hash: string;
  author: string;
  date: Date;
  message: string;
  files: string[];
}

interface CommitResult {
  hash: string;
  message: string;
  filesChanged: number;
}

interface AutoCommitOptions {
  enabled: boolean;
  messageStyle: 'semantic' | 'descriptive' | 'conventional';
  groupChanges: boolean;  // Group related changes into one commit
}

interface AIChangeMetadata {
  timestamp: Date;
  files: string[];
  operation: 'write' | 'edit' | 'delete';
  commitHash?: string;   // If auto-committed
}

interface GitService {
  // Core operations
  getStatus(): Promise<GitStatus>;
  getDiff(files?: string[]): Promise<string>;
  commit(message: string, files?: string[]): Promise<CommitResult>;
  getLog(count?: number): Promise<CommitInfo[]>;
  stash(action: 'push' | 'pop'): Promise<void>;
  getBranch(): Promise<string>;
  switchBranch(name: string): Promise<void>;
  listBranches(): Promise<string[]>;
  
  // AI-specific operations
  undoLastChange(): Promise<void>;
  generateCommitMessage(diff: string): Promise<string>;
  trackAIChange(files: string[], operation: string): void;
  getLastAIChange(): AIChangeMetadata | null;
  
  // Repository checks
  isInRepo(): Promise<boolean>;
  getRepoRoot(): Promise<string>;
  
  // Auto-commit
  enableAutoCommit(options: AutoCommitOptions): void;
  disableAutoCommit(): void;
  shouldAutoCommit(): boolean;
}
```

**Commit Message Generation**:

```typescript
// Semantic style: Focus on intent
"Add user authentication feature"
"Fix validation bug in form handler"
"Update dependencies to latest versions"

// Descriptive style: Describe changes
"Modified auth.ts and user.ts to add login flow"
"Changed validation logic in form.ts"
"Updated package.json with new dependency versions"

// Conventional style: Follow conventional commits
"feat: add user authentication"
"fix: correct form validation logic"
"chore: update dependencies"
```

**Undo Implementation**:
- Track last AI-made change with file list and operation
- For write/edit: revert file to previous version
- For delete: restore file from Git history
- If auto-committed: use `git revert` on commit
- If not committed: use `git checkout` on files

**Implementation Notes**:
- Use simple-git library for all Git operations
- Cache repository root to avoid repeated lookups
- Validate operations before execution
- Handle merge conflicts gracefully
- Support both staged and unstaged commits
- Generate commit messages using diff analysis



### Mention Parser

```typescript
interface ParsedMention {
  type: 'file' | 'glob' | 'symbol' | 'url' | 'directory' | 'git';
  raw: string;           // Original @mention text
  pattern: string;       // Extracted pattern (path, URL, etc.)
  startIndex: number;    // Position in input
  endIndex: number;      // End position in input
}

interface ResolvedMention {
  mention: ParsedMention;
  resolved: string[];    // Resolved paths/URLs
  content?: LoadedContext[];  // Loaded content
  error?: string;        // Error if resolution failed
}

interface MentionParser {
  // Parse mentions from text
  parse(text: string): ParsedMention[];
  
  // Resolve mention to actual content
  resolve(mention: ParsedMention): Promise<ResolvedMention>;
  
  // Remove mentions from text
  removeMentions(text: string, mentions: ParsedMention[]): string;
  
  // Check if text contains mentions
  hasMentions(text: string): boolean;
}
```

**Mention Patterns**:

```typescript
const MENTION_PATTERNS = {
  // File: @path/to/file.ts
  file: /@([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/g,
  
  // Glob: @src/**/*.ts
  glob: /@([a-zA-Z0-9_\-./]+\*[a-zA-Z0-9_\-./\*]*)/g,
  
  // Symbol: @ClassName or @ClassName.methodName
  symbol: /@([A-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)?)/g,
  
  // URL: @https://example.com or @http://example.com
  url: /@(https?:\/\/[^\s]+)/g,
  
  // Directory: @./directory/ or @directory/
  directory: /@(\.?\/[a-zA-Z0-9_\-./]+\/)/g,
  
  // Git special: @git:status, @git:diff, @git:log:5
  git: /@git:(status|diff|log(?::\d+)?)/g
};
```

**Parsing Algorithm**:

1. Apply each pattern regex to input text
2. Collect all matches with positions
3. Sort by start index
4. Resolve overlaps (prefer longer matches)
5. Classify by pattern type
6. Return ordered list of mentions

**Resolution Strategy**:

- **File**: Check file exists, resolve relative to workspace root
- **Glob**: Expand pattern, filter by .gitignore, limit to maxFilesPerGlob
- **Symbol**: Search for symbol in workspace (requires AST parsing)
- **URL**: Validate URL format, check accessibility
- **Directory**: List directory contents
- **Git**: Execute corresponding Git operation

**Implementation Notes**:
- Parse mentions before sending to LLM
- Resolve mentions in parallel for performance
- Cache resolved content to avoid duplicate loads
- Handle circular references (file mentions itself)
- Provide clear errors for unresolvable mentions
- Support escaping with backslash: \@notamention



### Context Loader

```typescript
interface LoadOptions {
  maxLines?: number;        // Limit lines loaded
  startLine?: number;       // Start from line
  endLine?: number;         // End at line
  includeLineNumbers?: boolean;
}

interface FileContext {
  path: string;
  content: string;
  language: string;
  tokenCount: number;
  lineCount: number;
}

interface SymbolContext {
  symbolPath: string;       // e.g., "ClassName.methodName"
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
}

interface UrlContext {
  url: string;
  content: string;
  contentType: string;
  tokenCount: number;
}

interface LoadedContext {
  type: 'file' | 'symbol' | 'url';
  data: FileContext | SymbolContext | UrlContext;
  loadedAt: Date;
}

interface ContextLoader {
  // Load file content
  loadFile(path: string, options?: LoadOptions): Promise<FileContext>;
  
  // Load multiple files (glob)
  loadGlob(pattern: string): Promise<FileContext[]>;
  
  // Load symbol (requires AST parsing)
  loadSymbol(symbolPath: string): Promise<SymbolContext>;
  
  // Load URL content
  loadUrl(url: string): Promise<UrlContext>;
  
  // Get total token count for loaded contexts
  getTotalTokens(contexts: LoadedContext[]): number;
  
  // Check if loading would exceed limits
  wouldExceedLimit(contexts: LoadedContext[], newContext: LoadedContext): boolean;
}
```

**File Loading**:

```typescript
async loadFile(path: string, options?: LoadOptions): Promise<FileContext> {
  // 1. Resolve path relative to workspace root
  const absolutePath = resolvePath(workspaceRoot, path);
  
  // 2. Check file exists and is readable
  if (!await fileExists(absolutePath)) {
    throw new Error(`File not found: ${path}`);
  }
  
  // 3. Read file content
  let content = await readFile(absolutePath, 'utf-8');
  
  // 4. Apply line range if specified
  if (options?.startLine || options?.endLine) {
    const lines = content.split('\n');
    const start = options.startLine ?? 1;
    const end = options.endLine ?? lines.length;
    content = lines.slice(start - 1, end).join('\n');
  }
  
  // 5. Detect language from extension
  const language = detectLanguage(path);
  
  // 6. Count tokens
  const tokenCount = countTokens(content);
  
  // 7. Return context
  return {
    path,
    content,
    language,
    tokenCount,
    lineCount: content.split('\n').length
  };
}
```

**Glob Loading**:

```typescript
async loadGlob(pattern: string): Promise<FileContext[]> {
  // 1. Expand glob pattern
  const files = await glob(pattern, {
    cwd: workspaceRoot,
    ignore: ['node_modules/**', '.git/**']
  });
  
  // 2. Check file count limit
  if (files.length > maxFilesPerGlob) {
    throw new Error(
      `Glob pattern matches ${files.length} files, ` +
      `exceeds limit of ${maxFilesPerGlob}`
    );
  }
  
  // 3. Load all files in parallel
  const contexts = await Promise.all(
    files.map(file => this.loadFile(file))
  );
  
  // 4. Check total token limit
  const totalTokens = contexts.reduce((sum, ctx) => sum + ctx.tokenCount, 0);
  if (totalTokens > maxTokensPerMention) {
    console.warn(
      `Glob loaded ${totalTokens} tokens, ` +
      `exceeds recommended limit of ${maxTokensPerMention}`
    );
  }
  
  return contexts;
}
```

**Symbol Loading** (requires AST parsing):

```typescript
async loadSymbol(symbolPath: string): Promise<SymbolContext> {
  // 1. Parse symbol path (e.g., "ClassName.methodName")
  const [className, memberName] = symbolPath.split('.');
  
  // 2. Search workspace for symbol definition
  const symbolInfo = await findSymbol(className, memberName);
  
  if (!symbolInfo) {
    throw new Error(`Symbol not found: ${symbolPath}`);
  }
  
  // 3. Extract symbol content from file
  const fileContent = await readFile(symbolInfo.filePath, 'utf-8');
  const lines = fileContent.split('\n');
  const content = lines.slice(
    symbolInfo.startLine - 1,
    symbolInfo.endLine
  ).join('\n');
  
  // 4. Count tokens
  const tokenCount = countTokens(content);
  
  return {
    symbolPath,
    filePath: symbolInfo.filePath,
    content,
    startLine: symbolInfo.startLine,
    endLine: symbolInfo.endLine,
    tokenCount
  };
}
```

**URL Loading**:

```typescript
async loadUrl(url: string): Promise<UrlContext> {
  // 1. Validate URL format
  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }
  
  // 2. Fetch content with timeout
  const response = await fetch(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'OLLM-CLI' }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  
  // 3. Get content type
  const contentType = response.headers.get('content-type') || 'text/plain';
  
  // 4. Read content
  let content = await response.text();
  
  // 5. Convert HTML to text if needed
  if (contentType.includes('text/html')) {
    content = htmlToText(content);
  }
  
  // 6. Truncate if too large
  const tokenCount = countTokens(content);
  if (tokenCount > maxTokensPerMention) {
    content = truncateToTokens(content, maxTokensPerMention);
  }
  
  return {
    url,
    content,
    contentType,
    tokenCount
  };
}
```

**Implementation Notes**:
- Cache loaded content with TTL (5 minutes)
- Respect .gitignore for file/glob loading
- Detect binary files and skip loading
- Provide progress feedback for large loads
- Support relative and absolute paths
- Handle encoding issues gracefully



### Diff Reviewer

```typescript
interface DiffReview {
  id: string;               // Unique review ID
  filePath: string;
  originalContent: string;
  proposedContent: string;
  diff: string;             // Unified diff format
  hunks: DiffHunk[];
  createdAt: Date;
  status: 'pending' | 'approved' | 'rejected';
}

interface DiffHunk {
  startLine: number;
  endLine: number;
  removed: string[];
  added: string[];
  context: string[];        // Surrounding lines
}

interface ReviewOptions {
  contextLines: number;     // Lines of context in diff
  showFullContext: boolean; // Show entire file
}

interface DiffReviewer {
  // Create diff for review
  createReview(
    filePath: string,
    newContent: string,
    options?: ReviewOptions
  ): Promise<DiffReview>;
  
  // Apply reviewed changes
  applyReview(reviewId: string): Promise<void>;
  
  // Reject changes
  rejectReview(reviewId: string): void;
  
  // Get pending reviews
  getPending(): DiffReview[];
  
  // Get review by ID
  getReview(reviewId: string): DiffReview | null;
  
  // Clear all pending reviews
  clearPending(): void;
  
  // Check if should auto-approve
  shouldAutoApprove(review: DiffReview): boolean;
}
```

**Diff Generation**:

```typescript
async createReview(
  filePath: string,
  newContent: string,
  options?: ReviewOptions
): Promise<DiffReview> {
  // 1. Read original content
  const originalContent = await readFile(filePath, 'utf-8')
    .catch(() => ''); // Empty if file doesn't exist
  
  // 2. Generate unified diff
  const diff = createPatch(
    filePath,
    originalContent,
    newContent,
    'original',
    'proposed',
    { context: options?.contextLines ?? 3 }
  );
  
  // 3. Parse diff into hunks
  const hunks = parseDiff(diff);
  
  // 4. Create review object
  const review: DiffReview = {
    id: generateId(),
    filePath,
    originalContent,
    proposedContent: newContent,
    diff,
    hunks,
    createdAt: new Date(),
    status: 'pending'
  };
  
  // 5. Check auto-approve rules
  if (this.shouldAutoApprove(review)) {
    await this.applyReview(review.id);
    review.status = 'approved';
  } else {
    // Add to pending queue
    this.pendingReviews.set(review.id, review);
  }
  
  return review;
}
```

**Auto-Approve Logic**:

```typescript
shouldAutoApprove(review: DiffReview): boolean {
  const config = this.config.review.autoApprove;
  
  // Check if auto-approve is enabled
  if (!config.smallChanges) {
    return false;
  }
  
  // Count changed lines
  const changedLines = review.hunks.reduce((sum, hunk) => {
    return sum + hunk.added.length + hunk.removed.length;
  }, 0);
  
  // Auto-approve if below threshold
  return changedLines <= config.smallChangeThreshold;
}
```

**Hunk Parsing**:

```typescript
function parseDiff(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = diff.split('\n');
  
  let currentHunk: Partial<DiffHunk> | null = null;
  
  for (const line of lines) {
    // Hunk header: @@ -start,count +start,count @@
    if (line.startsWith('@@')) {
      if (currentHunk) {
        hunks.push(currentHunk as DiffHunk);
      }
      
      const match = line.match(/@@ -(\d+),\d+ \+(\d+),\d+ @@/);
      currentHunk = {
        startLine: parseInt(match![2]),
        endLine: 0,
        removed: [],
        added: [],
        context: []
      };
    }
    // Removed line
    else if (line.startsWith('-')) {
      currentHunk?.removed.push(line.substring(1));
    }
    // Added line
    else if (line.startsWith('+')) {
      currentHunk?.added.push(line.substring(1));
    }
    // Context line
    else if (line.startsWith(' ')) {
      currentHunk?.context.push(line.substring(1));
    }
  }
  
  if (currentHunk) {
    hunks.push(currentHunk as DiffHunk);
  }
  
  return hunks;
}
```

**Implementation Notes**:
- Use `diff` library for unified diff generation
- Store pending reviews in memory (cleared on exit)
- Support batch approval of multiple reviews
- Emit events when reviews are created/approved/rejected
- Integrate with Git service for auto-commit
- Handle binary files (show "binary file changed")



### Input Processing Integration

```typescript
interface ProcessedInput {
  cleanedInput: string;         // Input with mentions removed
  mentions: ParsedMention[];    // Parsed mentions
  contexts: LoadedContext[];    // Loaded content
  errors: string[];             // Resolution errors
}

async function processUserInput(input: string): Promise<ProcessedInput> {
  // 1. Parse mentions from input
  const parser = new MentionParser();
  const mentions = parser.parse(input);
  
  // 2. Resolve all mentions in parallel
  const resolvedMentions = await Promise.all(
    mentions.map(mention => parser.resolve(mention))
  );
  
  // 3. Load content for resolved mentions
  const loader = new ContextLoader();
  const contexts: LoadedContext[] = [];
  const errors: string[] = [];
  
  for (const resolved of resolvedMentions) {
    if (resolved.error) {
      errors.push(resolved.error);
    } else if (resolved.content) {
      contexts.push(...resolved.content);
    }
  }
  
  // 4. Check token limits
  const totalTokens = loader.getTotalTokens(contexts);
  if (totalTokens > config.context.mentions.maxTokensPerMention) {
    console.warn(
      `Loaded ${totalTokens} tokens from mentions, ` +
      `exceeds limit of ${config.context.mentions.maxTokensPerMention}`
    );
  }
  
  // 5. Remove mentions from input
  const cleanedInput = parser.removeMentions(input, mentions);
  
  return {
    cleanedInput,
    mentions,
    contexts,
    errors
  };
}
```

**Context Message Generation**:

```typescript
function buildContextMessages(contexts: LoadedContext[]): Message[] {
  return contexts.map(ctx => {
    let content: string;
    
    if (ctx.type === 'file') {
      const fileCtx = ctx.data as FileContext;
      content = `File: ${fileCtx.path}\n` +
                `\`\`\`${fileCtx.language}\n` +
                `${fileCtx.content}\n` +
                `\`\`\``;
    }
    else if (ctx.type === 'symbol') {
      const symbolCtx = ctx.data as SymbolContext;
      content = `Symbol: ${symbolCtx.symbolPath}\n` +
                `File: ${symbolCtx.filePath}:${symbolCtx.startLine}-${symbolCtx.endLine}\n` +
                `\`\`\`\n` +
                `${symbolCtx.content}\n` +
                `\`\`\``;
    }
    else if (ctx.type === 'url') {
      const urlCtx = ctx.data as UrlContext;
      content = `URL: ${urlCtx.url}\n` +
                `Content-Type: ${urlCtx.contentType}\n\n` +
                `${urlCtx.content}`;
    }
    
    return {
      role: 'system',
      parts: [{
        type: 'text',
        text: content
      }]
    };
  });
}
```

**Integration with Chat Client**:

```typescript
// In chatClient.ts
async function sendMessage(userInput: string): Promise<void> {
  // 1. Process input for mentions
  const processed = await processUserInput(userInput);
  
  // 2. Show errors if any
  if (processed.errors.length > 0) {
    for (const error of processed.errors) {
      console.error(`Mention error: ${error}`);
    }
  }
  
  // 3. Build context messages
  const contextMessages = buildContextMessages(processed.contexts);
  
  // 4. Add context messages before user message
  const messages = [
    ...conversationHistory,
    ...contextMessages,
    {
      role: 'user',
      parts: [{ type: 'text', text: processed.cleanedInput }]
    }
  ];
  
  // 5. Send to LLM
  await provider.chat(messages, options);
}
```



### Tool Integration with Review Mode

```typescript
// In write-file.ts
class WriteFileTool implements DeclarativeTool<WriteFileParams, ToolResult> {
  constructor(
    private diffReviewer: DiffReviewer,
    private gitService: GitService,
    private config: Config
  ) {}
  
  async execute(signal: AbortSignal): Promise<ToolResult> {
    const { path, content } = this.params;
    
    // Check if review mode is enabled
    if (this.config.review.enabled) {
      // Create diff review
      const review = await this.diffReviewer.createReview(path, content);
      
      if (review.status === 'approved') {
        // Auto-approved, write directly
        await fs.writeFile(path, content);
        
        // Track for undo
        this.gitService.trackAIChange([path], 'write');
        
        // Auto-commit if enabled
        if (this.gitService.shouldAutoCommit()) {
          const message = await this.gitService.generateCommitMessage(
            await this.gitService.getDiff([path])
          );
          await this.gitService.commit(message, [path]);
        }
        
        return {
          llmContent: `File written: ${path}`,
          returnDisplay: `✓ ${path} (auto-approved)`
        };
      } else {
        // Queued for review
        return {
          llmContent: `Change queued for review: ${path}`,
          returnDisplay: `⏳ ${path} (pending review)`,
          pendingReview: review
        };
      }
    } else {
      // Review mode disabled, write directly
      await fs.writeFile(path, content);
      
      // Track for undo
      this.gitService.trackAIChange([path], 'write');
      
      // Auto-commit if enabled
      if (this.gitService.shouldAutoCommit()) {
        const message = await this.gitService.generateCommitMessage(
          await this.gitService.getDiff([path])
        );
        await this.gitService.commit(message, [path]);
      }
      
      return {
        llmContent: `File written: ${path}`,
        returnDisplay: `✓ ${path}`
      };
    }
  }
}
```

**Review Approval Flow**:

```typescript
// When user approves a review
async function approveReview(reviewId: string): Promise<void> {
  const review = diffReviewer.getReview(reviewId);
  
  if (!review) {
    throw new Error(`Review not found: ${reviewId}`);
  }
  
  // 1. Apply the change
  await diffReviewer.applyReview(reviewId);
  
  // 2. Track for undo
  gitService.trackAIChange([review.filePath], 'write');
  
  // 3. Auto-commit if enabled
  if (gitService.shouldAutoCommit()) {
    const message = await gitService.generateCommitMessage(review.diff);
    await gitService.commit(message, [review.filePath]);
  }
  
  // 4. Update UI
  console.log(`✓ Applied changes to ${review.filePath}`);
}
```



## Data Models

### Git Models

```typescript
interface GitStatus {
  branch: string;
  modified: string[];
  staged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

interface CommitInfo {
  hash: string;
  author: string;
  date: Date;
  message: string;
  files: string[];
}

interface CommitResult {
  hash: string;
  message: string;
  filesChanged: number;
}

interface AIChangeMetadata {
  timestamp: Date;
  files: string[];
  operation: 'write' | 'edit' | 'delete';
  commitHash?: string;
}
```

### Mention Models

```typescript
interface ParsedMention {
  type: 'file' | 'glob' | 'symbol' | 'url' | 'directory' | 'git';
  raw: string;
  pattern: string;
  startIndex: number;
  endIndex: number;
}

interface ResolvedMention {
  mention: ParsedMention;
  resolved: string[];
  content?: LoadedContext[];
  error?: string;
}
```

### Context Models

```typescript
interface FileContext {
  path: string;
  content: string;
  language: string;
  tokenCount: number;
  lineCount: number;
}

interface SymbolContext {
  symbolPath: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
}

interface UrlContext {
  url: string;
  content: string;
  contentType: string;
  tokenCount: number;
}

interface LoadedContext {
  type: 'file' | 'symbol' | 'url';
  data: FileContext | SymbolContext | UrlContext;
  loadedAt: Date;
}
```

### Review Models

```typescript
interface DiffReview {
  id: string;
  filePath: string;
  originalContent: string;
  proposedContent: string;
  diff: string;
  hunks: DiffHunk[];
  createdAt: Date;
  status: 'pending' | 'approved' | 'rejected';
}

interface DiffHunk {
  startLine: number;
  endLine: number;
  removed: string[];
  added: string[];
  context: string[];
}
```

### Configuration Models

```typescript
interface GitConfig {
  enabled: boolean;
  autoCommit: {
    enabled: boolean;
    messageStyle: 'semantic' | 'descriptive' | 'conventional';
    groupChanges: boolean;
  };
  showStatusInPrompt: boolean;
}

interface MentionConfig {
  enabled: boolean;
  maxFilesPerGlob: number;
  maxTokensPerMention: number;
  warnOnLargeContext: boolean;
}

interface ReviewConfig {
  enabled: boolean;
  autoApprove: {
    readOperations: boolean;
    smallChanges: boolean;
    smallChangeThreshold: number;
  };
  showFullContext: boolean;
  contextLines: number;
}
```



## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Git Tool Action Execution
*For any* valid Git action (status, diff, commit, log, undo, stash, branch), when the Git tool is invoked with that action, the system should execute the corresponding Git operation and return a result with the expected structure.
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

### Property 2: Git Status Structure
*For any* call to Git_Service.getStatus, the returned status object should contain all required fields: branch, modified, staged, untracked, ahead, and behind.
**Validates: Requirements 2.1**

### Property 3: Commit Log Count
*For any* positive integer count, when Git_Service.getLog is called with that count, the returned list should have length less than or equal to that count.
**Validates: Requirements 1.4, 2.4**

### Property 4: Undo Restores State
*For any* AI-made file change, when undoLastChange is called immediately after, the file should be restored to its previous state.
**Validates: Requirements 1.5, 2.5**

### Property 5: Commit Message Generation
*For any* diff and configured message style, when generateCommitMessage is called, the returned message should be non-empty and follow the configured style format.
**Validates: Requirements 2.6, 4.2, 4.3, 4.4**

### Property 6: Error Message Descriptiveness
*For any* Git operation that fails, the error message should be non-empty and include information about the failure cause.
**Validates: Requirements 2.9, 19.4**

### Property 7: Git Status in Prompt
*For any* system prompt built while in a Git repository with showStatusInPrompt enabled, the prompt should contain Git status information including modified, staged, and untracked file counts.
**Validates: Requirements 3.1, 3.3**

### Property 8: Auto-Commit on Approval
*For any* approved file change when auto-commit is enabled, a commit should be created containing that file.
**Validates: Requirements 4.1, 14.1**

### Property 9: Change Grouping
*For any* set of related file changes when auto-commit groupChanges is enabled, all changes should be included in a single commit.
**Validates: Requirements 4.5, 14.2**

### Property 10: Mention Type Identification
*For any* input text containing mentions of different types (file, glob, symbol, URL, directory, git), the Mention_Parser should correctly identify each mention with its appropriate type.
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

### Property 11: Multiple Mention Detection
*For any* input text containing multiple mentions, the Mention_Parser should identify all mentions and return them in order of appearance.
**Validates: Requirements 5.7**

### Property 12: Context Loader Return Structure
*For any* successful context load operation (file, glob, symbol, URL), the returned context should contain all required fields including content, tokenCount, and type-specific metadata.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 13: Glob File Limit Enforcement
*For any* glob pattern that matches more than maxFilesPerGlob files, the Context_Loader should return an error indicating the count exceeds the limit.
**Validates: Requirements 6.7**

### Property 14: Token Limit Warnings
*For any* loaded content with token count exceeding maxTokensPerMention, the system should display a warning including the actual token count and the limit.
**Validates: Requirements 6.8, 20.1, 20.2, 20.3**

### Property 15: Mention Deduplication
*For any* input containing multiple mentions of the same file, the Context_Loader should load that file only once.
**Validates: Requirements 7.6**

### Property 16: Mention Removal from Input
*For any* input text containing mentions, after processing, the cleaned input should not contain the mention syntax (@...).
**Validates: Requirements 7.4**

### Property 17: Context Message Formatting
*For any* loaded context (file, symbol, or URL), the generated system message should include the appropriate identifier (path, symbol path, or URL) and the content formatted with code blocks or appropriate markup.
**Validates: Requirements 8.1, 8.3, 8.4**

### Property 18: Context Message Ordering
*For any* conversation with loaded contexts, the context messages should appear before the user message in the message list.
**Validates: Requirements 8.5**

### Property 19: Multiple Context Messages
*For any* set of loaded contexts, each context should generate a separate system message.
**Validates: Requirements 8.2**

### Property 20: Diff Review Structure
*For any* diff review created, the review object should contain all required fields: id, filePath, originalContent, proposedContent, diff, hunks, createdAt, and status.
**Validates: Requirements 9.1, 9.2, 9.3**

### Property 21: Review Application
*For any* approved diff review, when applyReview is called, the file should be written with the proposed content.
**Validates: Requirements 9.4, 11.5**

### Property 22: Review Rejection
*For any* rejected diff review, the file should remain unchanged from its original state.
**Validates: Requirements 9.5, 11.6**

### Property 23: Pending Review Queue
*For any* set of created reviews that haven't been approved or rejected, getPending should return all of them.
**Validates: Requirements 9.6**

### Property 24: Review Mode File Operations
*For any* write-file or edit-file tool execution when review mode is enabled, a diff review should be created instead of directly modifying the file.
**Validates: Requirements 11.1, 11.2**

### Property 25: Auto-Approve Small Changes
*For any* diff review with total changed lines less than or equal to smallChangeThreshold when autoApprove.smallChanges is enabled, the review should be automatically approved.
**Validates: Requirements 12.4**

### Property 26: Diff Context Lines
*For any* diff review created with contextLines set to N, each hunk should include up to N lines of context before and after changes.
**Validates: Requirements 12.7**

### Property 27: Gitignore Respect in Operations
*For any* Git operation (status, diff) or glob pattern resolution, files matching .gitignore patterns should be excluded from results.
**Validates: Requirements 18.1, 18.3**

### Property 28: Explicit Mention Override
*For any* file mention that explicitly references a .gitignore'd file, the Context_Loader should still load that file.
**Validates: Requirements 18.2**



## Error Handling

### Git Tool and Service Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| No Repository Found | Git operation outside repository | Check if in Git repo, suggest `git init` |
| Uncommitted Changes | Operation requires clean working tree | Suggest committing or stashing changes |
| Permission Denied | Insufficient permissions for Git operation | Check file/directory permissions |
| Merge Conflict | Conflicting changes during operation | Provide conflict details, suggest resolution |
| Invalid Branch | Branch doesn't exist | List available branches |
| Detached HEAD | Not on a branch | Suggest checking out a branch |
| Network Error | Remote operation failed | Check connectivity, retry |
| Undo Not Available | No AI changes to undo | Inform user no changes tracked |

### Mention Parser Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| Invalid Pattern | Malformed mention syntax | Show correct syntax examples |
| Ambiguous Match | Multiple interpretations possible | Suggest more specific pattern |
| Circular Reference | File mentions itself | Detect and break cycle |
| Too Many Matches | Glob exceeds file limit | Suggest more specific pattern, show count |

### Context Loader Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| File Not Found | Referenced file doesn't exist | List similar files, check path |
| Permission Denied | Cannot read file | Check file permissions |
| Binary File | Attempted to load binary content | Skip with warning, suggest alternatives |
| Token Limit Exceeded | Content too large | Truncate with warning, suggest line ranges |
| Symbol Not Found | Symbol doesn't exist in workspace | Suggest similar symbols, check spelling |
| URL Fetch Failed | Network error or invalid URL | Check URL, connectivity, retry |
| Timeout | URL fetch took too long | Increase timeout, try again |
| Invalid Encoding | File encoding not supported | Suggest converting to UTF-8 |

### Diff Reviewer Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| Review Not Found | Invalid review ID | List pending reviews |
| File Modified | File changed since review created | Recreate review with current content |
| Disk Full | Cannot write file | Check disk space, suggest cleanup |
| File Locked | File in use by another process | Wait and retry, suggest closing applications |
| Invalid Diff | Diff parsing failed | Show raw diff, suggest manual review |

### Configuration Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| Invalid Config Value | Out of range or wrong type | Show valid range/type, use default |
| Missing Required Field | Required config not provided | Use default value, warn user |
| Conflicting Options | Incompatible settings | Explain conflict, suggest resolution |



## Testing Strategy

### Unit Tests

Unit tests verify specific examples, edge cases, and error conditions for individual components:

**Git Tool**:
- Each action (status, diff, commit, log, undo, stash, branch) returns expected format
- Error when invoked outside repository
- Handles missing parameters gracefully
- Formats output correctly for LLM and human display
- Respects .gitignore patterns

**Git Service**:
- getStatus returns complete status object
- getDiff generates valid unified diff
- commit creates commit with correct message
- getLog returns correct number of commits
- undoLastChange reverts file to previous state
- generateCommitMessage produces non-empty message
- isInRepo correctly detects repository
- getRepoRoot returns valid path
- Tracks AI changes correctly
- Auto-commit creates commits when enabled

**Mention Parser**:
- Identifies file mentions (@path/to/file.ts)
- Identifies glob mentions (@src/**/*.ts)
- Identifies symbol mentions (@ClassName, @ClassName.method)
- Identifies URL mentions (@https://example.com)
- Identifies directory mentions (@./dir/)
- Identifies Git mentions (@git:status, @git:diff, @git:log:5)
- Handles multiple mentions in one input
- Returns empty list for input without mentions
- Handles escaped mentions (\@notamention)
- Resolves overlapping patterns correctly

**Context Loader**:
- loadFile returns file content with metadata
- loadGlob expands pattern and loads all files
- loadSymbol finds and extracts symbol definition
- loadUrl fetches and returns URL content
- Handles non-existent files with error
- Handles empty glob results
- Enforces maxFilesPerGlob limit
- Warns when token limit exceeded
- Detects and handles binary files
- Caches loaded content

**Diff Reviewer**:
- createReview generates complete review object
- Parses diff into hunks correctly
- applyReview writes proposed content
- rejectReview discards changes
- getPending returns all pending reviews
- shouldAutoApprove respects threshold
- Handles binary files
- Generates unified diff format

**Input Processing**:
- Parses mentions from input
- Resolves mentions to content
- Removes mention syntax from cleaned input
- Adds context messages before user message
- Handles resolution errors gracefully
- Deduplicates repeated mentions

**Tool Integration**:
- Write-file creates review when review mode enabled
- Edit-file creates review when review mode enabled
- Direct write when review mode disabled
- Auto-commit after approval when enabled
- Tracks changes for undo

### Property-Based Tests

Property tests verify universal properties across all inputs using randomized test data. Each test should run a minimum of 100 iterations.

**Test Configuration**:
- Use `fast-check` library for TypeScript property-based testing
- Minimum 100 iterations per property test
- Each test references its design document property number
- Tag format: `Feature: stage-07b-developer-productivity, Property N: <property text>`

**Key Properties to Test**:

- Property 1: Git tool actions (generate random actions, verify execution)
- Property 2: Git status structure (generate random repo states, verify structure)
- Property 3: Commit log count (generate random counts, verify list length)
- Property 4: Undo restores state (make random changes, undo, verify restoration)
- Property 5: Commit message generation (generate random diffs, verify message format)
- Property 6: Error messages (generate random errors, verify non-empty messages)
- Property 7: Git status in prompt (generate random repo states, verify prompt content)
- Property 8: Auto-commit on approval (generate random changes, verify commits)
- Property 9: Change grouping (generate random change sets, verify single commit)
- Property 10: Mention type identification (generate random mentions, verify types)
- Property 11: Multiple mention detection (generate random multi-mention input, verify all found)
- Property 12: Context loader structure (generate random loads, verify structure)
- Property 13: Glob file limit (generate patterns with many matches, verify error)
- Property 14: Token warnings (generate large content, verify warnings)
- Property 15: Mention deduplication (generate duplicate mentions, verify single load)
- Property 16: Mention removal (generate input with mentions, verify removal)
- Property 17: Context message formatting (generate random contexts, verify format)
- Property 18: Context message ordering (generate random contexts, verify order)
- Property 19: Multiple context messages (generate multiple contexts, verify separate messages)
- Property 20: Diff review structure (generate random diffs, verify structure)
- Property 21: Review application (generate random reviews, verify file written)
- Property 22: Review rejection (generate random reviews, verify no change)
- Property 23: Pending review queue (generate random reviews, verify queue)
- Property 24: Review mode operations (generate random writes, verify reviews created)
- Property 25: Auto-approve small changes (generate small diffs, verify auto-approval)
- Property 26: Diff context lines (generate random diffs, verify context)
- Property 27: Gitignore respect (generate patterns with ignored files, verify exclusion)
- Property 28: Explicit mention override (generate mentions of ignored files, verify loading)

**Generators**:

```typescript
// Git action generator
const arbGitAction = fc.constantFrom(
  'status', 'diff', 'commit', 'log', 'undo', 'stash', 'branch'
);

// Mention generator
const arbMention = fc.oneof(
  fc.string().map(s => `@${s}.ts`),  // File
  fc.string().map(s => `@${s}/**/*.ts`),  // Glob
  fc.string({ minLength: 1 }).map(s => `@${s[0].toUpperCase()}${s.slice(1)}`),  // Symbol
  fc.webUrl().map(url => `@${url}`),  // URL
  fc.string().map(s => `@./${s}/`)  // Directory
);

// File context generator
const arbFileContext = fc.record({
  path: fc.string({ minLength: 1 }),
  content: fc.string(),
  language: fc.constantFrom('typescript', 'javascript', 'python', 'java'),
  tokenCount: fc.integer({ min: 0, max: 10000 }),
  lineCount: fc.integer({ min: 1, max: 1000 })
});

// Diff review generator
const arbDiffReview = fc.record({
  id: fc.uuid(),
  filePath: fc.string({ minLength: 1 }),
  originalContent: fc.string(),
  proposedContent: fc.string(),
  diff: fc.string(),
  hunks: fc.array(fc.record({
    startLine: fc.integer({ min: 1 }),
    endLine: fc.integer({ min: 1 }),
    removed: fc.array(fc.string()),
    added: fc.array(fc.string()),
    context: fc.array(fc.string())
  })),
  createdAt: fc.date(),
  status: fc.constantFrom('pending', 'approved', 'rejected')
});

// Git status generator
const arbGitStatus = fc.record({
  branch: fc.string({ minLength: 1 }),
  modified: fc.array(fc.string()),
  staged: fc.array(fc.string()),
  untracked: fc.array(fc.string()),
  ahead: fc.integer({ min: 0, max: 100 }),
  behind: fc.integer({ min: 0, max: 100 })
});

// Commit message style generator
const arbMessageStyle = fc.constantFrom('semantic', 'descriptive', 'conventional');
```

### Integration Tests

Integration tests verify interactions between components:

- Git Tool → Git Service: Tool invokes service methods correctly
- Mention Parser → Context Loader: Parsed mentions resolve to loaded content
- Context Loader → Input Processing: Loaded contexts added to conversation
- Diff Reviewer → Git Service: Approved reviews trigger auto-commit
- Write Tool → Diff Reviewer: File writes create reviews in review mode
- Configuration → All Components: Config settings applied correctly
- Status Bar → Git Service: Status bar shows current Git state
- Slash Commands → Services: Commands invoke correct operations

### Manual Testing

Manual testing scenarios for user-facing features:

1. **Git Integration**:
   - Use Git tool to check status in a repository
   - Make changes and view diff
   - Commit changes with generated message
   - Undo last AI change
   - Test outside repository (should error)

2. **@-Mentions**:
   - Reference a file with @path/to/file.ts
   - Use glob pattern @src/**/*.ts
   - Reference a URL @https://example.com
   - Use multiple mentions in one prompt
   - Test with non-existent file (should error)

3. **Diff Review**:
   - Enable review mode
   - Make file changes via tool
   - Review and approve changes
   - Review and reject changes
   - Test auto-approve for small changes
   - Approve multiple reviews at once

4. **Integration**:
   - Use @git:status to load Git status
   - Make changes, review, and auto-commit
   - Use slash commands (/git status, /review enable)
   - Check status bar for Git and review indicators

5. **Error Handling**:
   - Test with invalid mentions
   - Test with too many glob matches
   - Test with large files (token warnings)
   - Test Git operations with errors

