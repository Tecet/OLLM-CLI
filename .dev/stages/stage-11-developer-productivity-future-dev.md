# Stage 5b: Developer Productivity Tools

**Goal**: Add Git integration, context mentions, and diff review to enable Aider-like developer workflows.

**Prerequisites**: Stage 05 complete (Hooks, Extensions, MCP)

**Estimated Effort**: 5-7 days

---

## Overview

This stage adds three high-impact features that make OLLM CLI competitive with tools like Aider and Continue.dev:

1. **Git Integration Tool** - Auto-commit, status awareness, undo
2. **@-Mentions Context Loading** - Explicit file/symbol context
3. **Diff Review Mode** - Interactive approval before changes

---

## Component Architecture

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
│  │                 Core Runtime Integration                    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Tasks

### S5b-T01: Git Integration Tool

**Goal**: Provide Git operations as a tool and enable auto-commit workflows.

**Steps**:

1. Create `packages/core/src/tools/git.ts`:

```typescript
interface GitParams {
  action: 'status' | 'diff' | 'commit' | 'log' | 'undo' | 'stash' | 'branch';
  message?: string;      // For commit
  files?: string[];      // Specific files
  count?: number;        // For log (limit)
}

class GitTool implements DeclarativeTool<GitParams, ToolResult> {
  name = 'git';
  displayName = 'Git Operations';
  
  // Actions:
  // - status: Show working tree status
  // - diff: Show unstaged changes
  // - commit: Commit staged/all changes
  // - log: Show recent commits
  // - undo: Revert last AI-made change
  // - stash: Stash/unstash changes
  // - branch: List/switch branches
}
```

2. Create `packages/core/src/services/gitService.ts`:

```typescript
import simpleGit from 'simple-git';

interface GitService {
  // Core operations
  getStatus(): Promise<GitStatus>;
  getDiff(files?: string[]): Promise<string>;
  commit(message: string, files?: string[]): Promise<CommitResult>;
  getLog(count?: number): Promise<CommitInfo[]>;
  
  // AI-specific operations
  undoLastChange(): Promise<void>;
  generateCommitMessage(diff: string): Promise<string>;
  isInRepo(): Promise<boolean>;
  getRepoRoot(): Promise<string>;
  
  // Auto-commit hooks
  onFileChange(callback: (files: string[]) => void): void;
  enableAutoCommit(options: AutoCommitOptions): void;
}

interface AutoCommitOptions {
  enabled: boolean;
  messageStyle: 'semantic' | 'descriptive' | 'conventional';
  groupChanges: boolean;  // Group related changes into one commit
}
```

3. Add git status to system prompt context:

```typescript
// In chatClient.ts, add git context
function buildSystemPrompt(): string {
  let prompt = basePrompt;
  
  if (await gitService.isInRepo()) {
    const status = await gitService.getStatus();
    prompt += `\n\nGit Status:\n${formatGitStatus(status)}`;
  }
  
  return prompt;
}
```

**Deliverables**:
- `packages/core/src/tools/git.ts`
- `packages/core/src/tools/__tests__/git.test.ts`
- `packages/core/src/services/gitService.ts`
- `packages/core/src/services/__tests__/gitService.test.ts`

**Acceptance Criteria**:
- [ ] Git status shows in working tree repos
- [ ] Commits are made with semantic messages
- [ ] Undo reverts last AI-made file change
- [ ] Auto-commit can be enabled via config
- [ ] Works with .gitignore (respects ignored files)

---

### S5b-T02: @-Mentions Context Loading

**Goal**: Allow users to explicitly reference files and symbols in prompts.

**Steps**:

1. Create `packages/core/src/context/mentionParser.ts`:

```typescript
interface ParsedMention {
  type: 'file' | 'glob' | 'symbol' | 'url' | 'directory';
  raw: string;           // Original @mention text
  resolved: string[];    // Resolved paths/content
  content?: string;      // Loaded content (if available)
}

interface MentionParser {
  // Parse mentions from text
  parse(text: string): ParsedMention[];
  
  // Resolve mention to actual content
  resolve(mention: ParsedMention): Promise<ResolvedContext>;
  
  // Patterns:
  // @path/to/file.ts        - Single file
  // @src/**/*.ts            - Glob pattern
  // @ClassName              - Symbol reference
  // @ClassName.methodName   - Method reference
  // @https://example.com    - URL reference
  // @./directory/           - Directory listing
}
```

2. Create `packages/core/src/context/contextLoader.ts`:

```typescript
interface ContextLoader {
  // Load file content
  loadFile(path: string, options?: LoadOptions): Promise<FileContext>;
  
  // Load multiple files (glob)
  loadGlob(pattern: string): Promise<FileContext[]>;
  
  // Load symbol (requires AST parsing)
  loadSymbol(symbolPath: string): Promise<SymbolContext>;
  
  // Load URL content
  loadUrl(url: string): Promise<UrlContext>;
}

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
}
```

3. Integrate with input handler:

```typescript
// In CLI input processing
async function processUserInput(input: string): Promise<ProcessedInput> {
  const parser = new MentionParser();
  const mentions = parser.parse(input);
  
  // Load all mentioned content
  const contexts: LoadedContext[] = [];
  for (const mention of mentions) {
    const resolved = await parser.resolve(mention);
    contexts.push(resolved);
  }
  
  return {
    cleanedInput: removeMentions(input),
    additionalContext: contexts,
  };
}
```

4. Update system prompt with loaded context:

```typescript
// Context is added to the conversation
function buildContextMessages(contexts: LoadedContext[]): Message[] {
  return contexts.map(ctx => ({
    role: 'system',
    parts: [{
      type: 'text',
      text: `File: ${ctx.path}\n\`\`\`${ctx.language}\n${ctx.content}\n\`\`\``
    }]
  }));
}
```

**Deliverables**:
- `packages/core/src/context/mentionParser.ts`
- `packages/core/src/context/contextLoader.ts`
- `packages/core/src/context/__tests__/mentionParser.test.ts`
- `packages/core/src/context/__tests__/contextLoader.test.ts`

**Acceptance Criteria**:
- [ ] `@file.ts` loads file content into context
- [ ] `@src/**/*.ts` loads multiple files via glob
- [ ] `@ClassName` loads class definition (if symbol parsing enabled)
- [ ] `@https://url` fetches and includes URL content
- [ ] Token count warning when context is large
- [ ] Mentions are highlighted in UI

---

### S5b-T03: Diff Review Mode

**Goal**: Show diffs for approval before applying file changes.

**Steps**:

1. Create `packages/core/src/review/diffReviewer.ts`:

```typescript
interface DiffReview {
  filePath: string;
  originalContent: string;
  proposedContent: string;
  diff: string;           // Unified diff format
  hunks: DiffHunk[];
}

interface DiffHunk {
  startLine: number;
  endLine: number;
  removed: string[];
  added: string[];
}

interface DiffReviewer {
  // Create diff for review
  createReview(filePath: string, newContent: string): Promise<DiffReview>;
  
  // Apply reviewed changes
  applyReview(review: DiffReview): Promise<void>;
  
  // Reject changes
  rejectReview(review: DiffReview): void;
  
  // Get pending reviews
  getPending(): DiffReview[];
}
```

2. Create `packages/cli/src/ui/components/DiffReviewPanel.tsx`:

```tsx
interface DiffReviewPanelProps {
  review: DiffReview;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onApproveAll: () => void;
}

function DiffReviewPanel({ review, onApprove, onReject }: DiffReviewPanelProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow">
      <Box>
        <Text bold>Proposed Change: </Text>
        <Text color="cyan">{review.filePath}</Text>
      </Box>
      
      <Box marginY={1}>
        {review.hunks.map((hunk, i) => (
          <DiffHunk key={i} hunk={hunk} />
        ))}
      </Box>
      
      <Box>
        <Text>[y]es</Text>
        <Text> / </Text>
        <Text>[n]o</Text>
        <Text> / </Text>
        <Text>[e]dit</Text>
        <Text> / </Text>
        <Text>[a]ll</Text>
      </Box>
    </Box>
  );
}
```

3. Integrate with write-file and edit-file tools:

```typescript
// In WriteFileTool.execute()
async execute(signal: AbortSignal): Promise<ToolResult> {
  if (this.reviewMode) {
    const review = await this.diffReviewer.createReview(
      this.params.path,
      this.params.content
    );
    
    // Queue for review instead of direct write
    return {
      llmContent: `Change queued for review: ${this.params.path}`,
      returnDisplay: 'Pending review',
      pendingReview: review,
    };
  }
  
  // Direct write if review mode disabled
  await fs.writeFile(this.params.path, this.params.content);
  return { /* ... */ };
}
```

4. Add review mode configuration:

```yaml
# ~/.ollm/config.yaml
review:
  enabled: true                    # Enable diff review mode
  autoApprove:
    readOperations: true           # Auto-approve reads
    smallChanges: true             # Auto-approve < 5 lines
    smallChangeThreshold: 5        # Lines threshold
  showFullContext: false           # Show surrounding lines
  contextLines: 3                  # Lines of context in diff
```

5. Add CLI flag:

```bash
ollm --review-diffs              # Enable review mode for session
ollm --no-review                 # Disable review mode
```

**Deliverables**:
- `packages/core/src/review/diffReviewer.ts`
- `packages/core/src/review/__tests__/diffReviewer.test.ts`
- `packages/cli/src/ui/components/DiffReviewPanel.tsx`
- Update `packages/core/src/tools/write-file.ts`
- Update `packages/core/src/tools/edit-file.ts`

**Acceptance Criteria**:
- [ ] Diffs shown before applying changes
- [ ] User can approve (y), reject (n), edit (e), or approve all (a)
- [ ] Small changes auto-approved if configured
- [ ] Review state persists across tool calls
- [ ] Changes batched for bulk review
- [ ] Keyboard shortcuts work in TUI

---

## S5b-T04: Integration and Polish

**Goal**: Ensure all three features work together seamlessly.

**Steps**:

1. Git + Diff Review integration:
   - After diff is approved, auto-commit if enabled
   - Commit message includes reviewed files

2. @-Mentions + Git integration:
   - `@git:status` shows git status
   - `@git:diff` shows current diff
   - `@git:log:5` shows last 5 commits

3. Update slash commands:

```
/git status              # Show git status
/git commit [message]    # Commit with message
/git undo                # Undo last change
/review enable           # Enable diff review
/review disable          # Disable diff review
/review pending          # Show pending reviews
```

4. Add status bar indicators:

```
┌─ OLLM CLI ─────────────────────────────────────────────────┐
│ Model: llama3.2:3b │ Context: 8.2K/32K │ Git: main +3 ~2  │
│                                         │ Review: 2 pending│
└────────────────────────────────────────────────────────────┘
```

**Deliverables**:
- Integration tests
- Updated UI components
- Slash command implementations
- Status bar updates

**Acceptance Criteria**:
- [ ] Git status shows in status bar
- [ ] Pending reviews shown in status bar
- [ ] Slash commands work for all features
- [ ] Features can be enabled/disabled via config

---

## File Structure After Stage 5b

```
packages/core/src/
├── context/
│   ├── mentionParser.ts       # NEW
│   ├── contextLoader.ts       # NEW
│   └── __tests__/
├── review/
│   ├── diffReviewer.ts        # NEW
│   └── __tests__/
├── services/
│   ├── gitService.ts          # NEW
│   └── __tests__/
└── tools/
    ├── git.ts                 # NEW
    └── __tests__/

packages/cli/src/
└── ui/
    └── components/
        └── DiffReviewPanel.tsx # NEW
```

---

## Configuration Schema Updates

```yaml
# ~/.ollm/config.yaml additions

git:
  enabled: true
  autoCommit:
    enabled: false
    messageStyle: semantic    # semantic | descriptive | conventional
    groupChanges: true
  showStatusInPrompt: true
  
context:
  mentions:
    enabled: true
    maxFilesPerGlob: 20
    maxTokensPerMention: 4096
    warnOnLargeContext: true
    
review:
  enabled: false              # Off by default
  autoApprove:
    readOperations: true
    smallChanges: true
    smallChangeThreshold: 5
  contextLines: 3
```

---

## Testing Strategy

### Unit Tests
- Mention parsing with various patterns
- Diff generation and application
- Git operations with mock repository

### Integration Tests
- Full workflow: mention → context → tool → review → commit
- Error handling for missing files, invalid globs
- Git operations in real repository

### Manual Testing
- Test with various project types
- Test with large files
- Test with binary files (should skip)

---

## Verification Checklist

- [ ] Git status displays in repos
- [ ] Git commit creates semantic messages
- [ ] Git undo reverts last change
- [ ] @file.ts loads file content
- [ ] @src/**/*.ts loads multiple files
- [ ] Invalid mentions show helpful error
- [ ] Diff review shows before write
- [ ] Approve/reject/edit work correctly
- [ ] Auto-approve works for small changes
- [ ] Status bar shows git and review state
- [ ] All features can be disabled via config

---

## Dependencies

- `simple-git` - Git operations
- `diff` - Already in project, for diff generation
- `picomatch` - Already in project, for glob patterns
