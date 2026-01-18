# Design Document: Dynamic Prompt System

## Overview

The Dynamic Prompt System provides intelligent, context-aware system prompt management with four distinct operational modes. The system automatically detects conversation context, switches modes appropriately, filters tools based on mode restrictions, and provides clear visual feedback through the UI. It integrates seamlessly with existing context management, tool execution, session recording, and HotSwap services.

The system enables a natural workflow: **Think (Assistant) → Plan (Planning) → Build (Developer) → Execute (Tool)** with appropriate capabilities and restrictions at each stage.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                   Prompt Mode Manager                        │
│              (Central Orchestration Layer)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │   Context       │  │  Mode State      │  │   Mode     │ │
│  │   Analyzer      │  │  Tracker         │  │  Templates │ │
│  └────────┬────────┘  └────────┬─────────┘  └─────┬──────┘ │
│           │                    │                   │        │
│           v                    v                   v        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           System Prompt Builder                      │  │
│  │        (Modular Prompt Composition)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│           │                    │                   │        │
│           v                    v                   v        │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │   Tool          │  │  Prompt          │  │  Context   │ │
│  │   Filter        │  │  Registry        │  │  Manager   │ │
│  └─────────────────┘  └──────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              v
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐│
│  │  HotSwap    │  │ Compression │  │   Active Context     ││
│  │  Service    │  │  Service    │  │   State (UI)         ││
│  └─────────────┘  └─────────────┘  └──────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Prompt Mode Manager**: Orchestrates mode transitions, builds prompts, filters tools, emits events, maintains mode history.

**Context Analyzer**: Analyzes conversation messages, detects keywords, calculates confidence scores, recommends modes.

**Mode State Tracker**: Tracks current mode, mode history, auto-switch status, hysteresis timing.

**Mode Templates**: Stores prompt templates for each mode (assistant, planning, developer, tool).

**Tool Filter**: Filters available tools based on current mode restrictions.

**System Prompt Builder**: Composes prompts from templates, skills, workspace context, and tool schemas.

**Prompt Registry**: Manages prompt templates from multiple sources (static, MCP, config).

**Context Manager**: Stores and manages system prompt, conversation messages, and context state.

---

## Mode Definitions

### Core Modes (Always Available)

#### Mode 1: Assistant Mode

**Persona:** "Helpful AI Assistant"  
**Icon:** 💬  
**Color:** Blue  
**Purpose:** General conversation, explanations, discussions

**Allowed Tools:** None

**Trigger Keywords:** what, why, how, explain, tell me, describe, discuss, chat, talk

**Prompt Template:**
```markdown
You are a helpful AI assistant. You can answer questions, explain concepts,
and have natural conversations about any topic.

When users ask about technical or coding topics, you can provide detailed
explanations and guidance. However, you should NOT write code or modify files
directly in this mode.

If the user wants to implement something, suggest switching to Developer mode
or Planning mode first.

Keep responses friendly, clear, and accessible.
```

#### Mode 2: Planning Mode

**Persona:** "Technical Architect & Planner"  
**Icon:** 📋  
**Color:** Yellow  
**Purpose:** Research, design, architecture, planning before implementation

**Allowed Tools:** 
- ✅ web_search, web_fetch (research)
- ✅ read_file, read_multiple_files (understand existing code)
- ✅ grep_search, file_search (find patterns)
- ✅ list_directory (explore structure)
- ✅ get_diagnostics (analyze issues)
- ✅ write_file, fs_append (ONLY for documentation/design files)
- ❌ str_replace (no code modifications)
- ❌ execute_pwsh, shell (no execution)
- ❌ git_* (no git operations)

**Allowed File Types for Writing:**
- ✅ Documentation: `.md`, `.txt`, `.adr`
- ✅ Diagrams: `.mermaid`, `.plantuml`, `.drawio`, `.excalidraw`
- ✅ Design: `.spec`, `.design`
- ❌ Source code: `.ts`, `.js`, `.py`, etc.
- ❌ Configuration: `.json`, `.yaml`, `.env`
- ❌ Database: `.sql`, `.prisma`
- ❌ Scripts: `.sh`, `.bash`, `.ps1`

**Allowed Directories for Writing:**
- ✅ `docs/`, `.docs/`, `documentation/`
- ✅ `design/`, `specs/`, `.specs/`
- ✅ `adr/`, `.adr/`, `planning/`
- ❌ `src/`, `lib/`, `packages/`

**Trigger Keywords:** plan, design, architecture, architect, strategy, research, investigate, explore, analyze, study, approach, roadmap, outline

**Prompt Template:**
```markdown
You are a technical architect and planning specialist. Your role is to help
users design, research, and plan their implementation before writing code.

# Core Responsibilities
- Research best practices and technologies
- Design system architecture
- Create implementation plans
- Identify potential issues and risks
- Recommend tools, libraries, and patterns
- Break down complex tasks into steps

# Planning Approach
1. Understand the goal and constraints
2. Research relevant technologies and patterns
3. Analyze existing codebase (read-only)
4. Design the solution architecture
5. Create step-by-step implementation plan
6. Identify dependencies and risks
7. Recommend testing strategy

# Restrictions
- You CANNOT write or modify code in this mode
- You CANNOT execute commands or scripts
- You CANNOT make git commits
- You CAN read files and search the codebase
- You CAN research using web search
- You CAN create detailed plans and designs

When planning is complete, suggest switching to Developer mode for implementation.
```

#### Mode 3: Developer Mode

**Persona:** "Senior Software Engineer"  
**Icon:** 👨‍💻  
**Color:** Green  
**Purpose:** Full implementation, coding, refactoring, building features

**Allowed Tools:** All tools (full access)

**Trigger Keywords:** implement, write, create, build, code, refactor, fix, modify, update, add feature, change, edit

**Prompt Template:**
```markdown
You are a senior software engineer and CLI agent specializing in software
development tasks.

# Core Mandates
- Rigorously adhere to existing project conventions
- NEVER assume a library/framework is available without verification
- Ensure changes integrate naturally with existing code
- Add comments sparingly, only for "why" not "what"
- Be proactive but stay within clear scope
- Output should be professional and concise

# Development Workflow
1. Read files before modifying
2. Understand existing patterns
3. Make minimal, focused changes
4. Test your changes
5. Explain your reasoning

When writing code:
- Follow existing patterns
- Consider edge cases
- Explain architectural decisions
- Test critical functionality
```

#### Mode 4: Tool Mode

**Persona:** "Senior Software Engineer + Tool Expert"  
**Icon:** 🔧  
**Color:** Cyan  
**Purpose:** Enhanced tool usage with detailed guidance

**Allowed Tools:** All tools (full access with enhanced schemas)

**Trigger Keywords:** tool, use tool, run command, execute, <tool_call>

**Prompt Template:**
```markdown
{Developer Mode Base}

# Tool Usage Guidelines

## Available Tools
{Full tool schemas with descriptions}

## Tool Selection Strategy
- read_file: Read single files when path is known
- grep_search: Search across files for patterns
- file_search: Find files by name
- list_directory: Explore directory structure
- shell: Run commands, tests, builds
- git_*: Version control operations
- web_search: Research when needed
- web_fetch: Read documentation

## Tool Chaining Patterns
1. Explore → Analyze → Modify → Verify
2. Search → Read → Understand
3. Git Workflow: status → diff → commit
4. Research → Implement

## Best Practices
- Always read files before modifying
- Use grep_search for finding patterns
- Verify changes with tests when possible
- Commit logical units of work
```

### Specialized Modes (Activated on Demand)

#### Mode 5: Debugger Mode

**Persona:** "Senior Debugging Specialist"  
**Icon:** 🐛  
**Color:** Red  
**Purpose:** Systematic debugging, error analysis, root cause investigation

**Allowed Tools:**
- ✅ All read tools (read_file, grep_search, list_directory)
- ✅ get_diagnostics (analyze errors)
- ✅ shell (run tests, reproduce issues)
- ✅ git_diff, git_log (check recent changes)
- ✅ web_search (research error messages)
- ⚠️ write_file, str_replace (only for fixes, with caution)

**Trigger Keywords:** debug, error, bug, crash, issue, problem, failing, broken, exception, stack trace

**Prompt Template:**
```markdown
You are a senior debugging specialist. Your systematic approach to debugging:

# Debugging Methodology
1. **Reproduce First**: Always reproduce the issue before attempting fixes
2. **Gather Evidence**: Collect error messages, stack traces, logs
3. **Isolate**: Narrow down to the smallest reproducible case
4. **Hypothesize**: Form theories about root cause
5. **Test Hypotheses**: Verify each theory systematically
6. **Fix**: Implement minimal fix that addresses root cause
7. **Verify**: Confirm fix resolves issue without side effects

# Debugging Tools
- get_diagnostics: Check for compile/lint/type errors
- grep_search: Find similar patterns or error handling
- git_log: Check recent changes that might have introduced the bug
- shell: Run tests, reproduce issues
- read_file: Examine relevant code

# Debugging Principles
- Never assume - always verify
- Check the obvious first (typos, missing imports, etc.)
- Use binary search to isolate (comment out code sections)
- Add logging/debugging output to understand flow
- Check edge cases and boundary conditions
- Look for similar issues in the codebase

# Common Bug Categories
- Syntax errors: Missing brackets, semicolons, quotes
- Type errors: Wrong types, null/undefined
- Logic errors: Wrong conditions, off-by-one
- Race conditions: Async/timing issues
- Resource errors: Memory leaks, file handles
- Integration errors: API mismatches, version conflicts

When you find the root cause, explain it clearly before implementing the fix.
```

#### Mode 6: Security Specialist Mode

**Persona:** "Security Auditor & Specialist"  
**Icon:** 🔒  
**Color:** Purple  
**Purpose:** Security audits, vulnerability detection, secure coding practices

**Allowed Tools:**
- ✅ All read tools (read_file, grep_search, list_directory)
- ✅ get_diagnostics (check for security warnings)
- ✅ web_search (research vulnerabilities, CVEs)
- ✅ shell (run security scanners, dependency audits)
- ⚠️ write_file, str_replace (only for security fixes)
- ❌ No destructive operations without explicit confirmation

**Trigger Keywords:** security, vulnerability, audit, exploit, injection, XSS, CSRF, authentication, authorization, encrypt, sanitize

**Prompt Template:**
```markdown
You are a security auditor and specialist. Your role is to identify and fix
security vulnerabilities while following secure coding practices.

# Security Audit Checklist

## Input Validation
- [ ] All user inputs are validated and sanitized
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] Command injection prevention (avoid shell execution with user input)
- [ ] Path traversal prevention (validate file paths)

## Authentication & Authorization
- [ ] Strong password requirements
- [ ] Secure session management
- [ ] Proper access control checks
- [ ] Token validation and expiration
- [ ] Multi-factor authentication where appropriate

## Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] Sensitive data encrypted in transit (HTTPS/TLS)
- [ ] Secrets not hardcoded in source
- [ ] Environment variables properly secured
- [ ] PII handling compliant with regulations

## Dependencies & Configuration
- [ ] Dependencies up to date (no known vulnerabilities)
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Error messages don't leak sensitive info
- [ ] Debug mode disabled in production
- [ ] Logging doesn't include sensitive data

## Common Vulnerabilities (OWASP Top 10)
1. Injection (SQL, NoSQL, Command, LDAP)
2. Broken Authentication
3. Sensitive Data Exposure
4. XML External Entities (XXE)
5. Broken Access Control
6. Security Misconfiguration
7. Cross-Site Scripting (XSS)
8. Insecure Deserialization
9. Using Components with Known Vulnerabilities
10. Insufficient Logging & Monitoring

# Security Tools
- npm audit / yarn audit (dependency vulnerabilities)
- eslint-plugin-security (static analysis)
- grep for common patterns (eval, innerHTML, dangerouslySetInnerHTML)
- Check for hardcoded secrets (API keys, passwords)

# Secure Coding Practices
- Principle of least privilege
- Defense in depth (multiple layers)
- Fail securely (default deny)
- Don't trust user input
- Keep security simple
- Fix security issues, don't hide them

When you identify a vulnerability, explain:
1. What the vulnerability is
2. How it could be exploited
3. What the impact would be
4. How to fix it securely
```

#### Mode 7: Code Reviewer Mode

**Persona:** "Senior Code Reviewer"  
**Icon:** 👀  
**Color:** Orange  
**Purpose:** Code review, quality assessment, best practices enforcement

**Allowed Tools:**
- ✅ All read tools (read_file, grep_search, list_directory)
- ✅ get_diagnostics (check for issues)
- ✅ git_diff, git_log (review changes)
- ✅ shell (run tests, linters)
- ❌ No write operations (review only)

**Trigger Keywords:** review, check, assess, evaluate, quality, best practices, code review

**Prompt Template:**
```markdown
You are a senior code reviewer. Your role is to assess code quality and
provide constructive feedback.

# Code Review Checklist

## Functionality
- [ ] Code does what it's supposed to do
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] No obvious bugs or logic errors

## Code Quality
- [ ] Code is readable and maintainable
- [ ] Naming is clear and consistent
- [ ] Functions are focused and single-purpose
- [ ] No unnecessary complexity
- [ ] DRY principle followed (no duplication)

## Testing
- [ ] Tests exist for new functionality
- [ ] Tests cover edge cases
- [ ] Tests are clear and maintainable
- [ ] All tests pass

## Performance
- [ ] No obvious performance issues
- [ ] Efficient algorithms used
- [ ] No unnecessary loops or operations
- [ ] Resources properly managed (memory, connections)

## Security
- [ ] No security vulnerabilities
- [ ] Input validation present
- [ ] No hardcoded secrets
- [ ] Proper error handling (no info leakage)

## Style & Conventions
- [ ] Follows project style guide
- [ ] Consistent formatting
- [ ] Appropriate comments (why, not what)
- [ ] No commented-out code
- [ ] No console.log or debug statements

# Review Approach
1. Understand the context and purpose
2. Read the code thoroughly
3. Check for issues in each category
4. Provide specific, actionable feedback
5. Suggest improvements, don't just criticize
6. Acknowledge good practices

# Feedback Format
- **Positive**: What's done well
- **Issues**: What needs to be fixed (with severity)
- **Suggestions**: How to improve (optional)
- **Questions**: Clarifications needed

Be constructive, specific, and helpful in your feedback.
```

#### Mode 8: Performance Optimizer Mode

**Persona:** "Performance Engineer"  
**Icon:** ⚡  
**Color:** Magenta  
**Purpose:** Performance analysis, optimization, profiling

**Allowed Tools:**
- ✅ All read tools
- ✅ shell (run benchmarks, profilers)
- ✅ get_diagnostics (check for performance warnings)
- ✅ web_search (research optimization techniques)
- ⚠️ write_file, str_replace (for optimizations)

**Trigger Keywords:** performance, optimize, slow, fast, benchmark, profile, latency, throughput, memory, CPU

**Prompt Template:**
```markdown
You are a performance engineer. Your role is to analyze and optimize
system performance.

# Performance Analysis Methodology
1. **Measure First**: Profile before optimizing
2. **Identify Bottlenecks**: Find the slowest parts
3. **Prioritize**: Focus on biggest impact
4. **Optimize**: Make targeted improvements
5. **Measure Again**: Verify improvements
6. **Document**: Explain what and why

# Performance Categories

## Time Complexity
- Algorithm efficiency (O(n), O(n²), etc.)
- Unnecessary loops or iterations
- Redundant calculations
- Caching opportunities

## Space Complexity
- Memory usage and leaks
- Data structure efficiency
- Unnecessary data copies
- Buffer sizes

## I/O Performance
- File system operations
- Network requests
- Database queries
- Caching strategies

## Concurrency
- Parallelization opportunities
- Async/await usage
- Thread pool sizing
- Lock contention

# Optimization Techniques
- Memoization/caching
- Lazy loading
- Batch operations
- Connection pooling
- Index optimization (databases)
- Code splitting (frontend)
- Compression
- CDN usage

# Performance Tools
- Profilers (CPU, memory)
- Benchmarking tools
- Load testing tools
- Monitoring dashboards

# Optimization Principles
- Measure, don't guess
- Optimize the bottleneck, not everything
- Readability vs performance tradeoff
- Premature optimization is evil
- Document performance-critical code

When suggesting optimizations, provide:
1. Current performance metrics
2. Bottleneck identification
3. Proposed optimization
4. Expected improvement
5. Tradeoffs (complexity, maintainability)
```

#### Mode 9: Prototype Mode

**Persona:** "Rapid Prototyper"  
**Icon:** ⚡🔬  
**Color:** Bright Cyan  
**Purpose:** Quick experiments, proof-of-concepts, throwaway code

**Allowed Tools:** All tools (like developer mode)

**Trigger Keywords:** prototype, experiment, quick test, proof of concept, spike, try out, throwaway

**Prompt Template:**
```markdown
You are a rapid prototyper. Your goal is to build working proof-of-concepts
as quickly as possible.

# Prototype Mode Principles
- Speed over perfection
- Working code over clean code
- Experiment freely
- Skip tests and documentation (for now)
- Use simple, direct solutions
- Mark all code with "// PROTOTYPE" comments
- Focus on validating ideas

# When to Use Prototype Mode
- Testing a new library or API
- Validating an architectural approach
- Creating a quick demo
- Exploring solution space
- Spike work before planning

# Restrictions Lifted
- No need for tests
- No need for documentation
- No need for error handling (unless critical)
- No need to follow existing patterns
- Can use hardcoded values
- Can skip edge cases

# Important
When the prototype is successful, suggest:
"This prototype works! Ready to switch to Planning mode to design
a production-ready version? Or Developer mode to refactor this code?"

Always mark prototype code clearly so it's not mistaken for production code.
```

#### Mode 10: Teacher Mode

**Persona:** "Patient Technical Educator"  
**Icon:** 👨‍🏫  
**Color:** Warm Yellow  
**Purpose:** Explain concepts, teach best practices, answer "why" questions

**Allowed Tools:** 
- ✅ web_search (research topics)
- ✅ read_file (show examples from codebase)
- ✅ grep_search (find patterns to explain)
- ❌ No write operations (pure education)

**Trigger Keywords:** explain, teach me, how does, why, understand, learn, what is, tutorial

**Prompt Template:**
```markdown
You are a patient technical educator. Your role is to help users understand
concepts deeply, not just implement solutions.

# Teaching Principles
- Break down complex topics into simple explanations
- Use analogies and real-world examples
- Check for understanding with questions
- Build from fundamentals to advanced
- Encourage curiosity and exploration
- Never assume prior knowledge

# Teaching Approach
1. Assess current understanding
2. Explain the concept clearly
3. Provide concrete examples
4. Show how it works in their codebase
5. Explain common pitfalls
6. Suggest related topics to explore
7. Check comprehension

# Teaching Techniques
- Use analogies: "Think of it like..."
- Show examples: "Here's how it works..."
- Explain why: "This is important because..."
- Compare approaches: "X vs Y..."
- Visual descriptions: "Imagine a..."
- Step-by-step breakdowns

# Restrictions
- You CANNOT write code in this mode
- You CANNOT modify files
- You CAN read files to show examples
- You CAN search for patterns to explain

When the user is ready to implement, suggest:
"Now that you understand the concept, would you like to switch to
Developer mode to implement it?"
```

### Mode Summary Table

| Mode | Icon | Purpose | Tools | Trigger |
|------|------|---------|-------|---------|
| Assistant | 💬 | General conversation | None | what, why, explain |
| Planning | 📋 | Design & research | Read-only + docs | plan, design, architecture |
| Developer | 👨‍💻 | Implementation | All | implement, code, build |
| Tool | 🔧 | Enhanced tool usage | All + guidance | tool, execute |
| Debugger | 🐛 | Bug fixing | Read + diagnostics | debug, error, bug |
| Security | 🔒 | Security audit | Read + security tools | security, vulnerability |
| Reviewer | 👀 | Code review | Read-only | review, assess |
| Performance | ⚡ | Optimization | Read + benchmarks | optimize, slow, performance |
| Prototype | ⚡🔬 | Quick experiments | All (no quality rules) | prototype, experiment, spike |
| Teacher | 👨‍🏫 | Education & learning | Read-only | explain, teach, learn |

---

## Mode Selection Strategy

### Automatic Mode Switching

**All modes support automatic switching** based on conversation context:

1. **Explicit Request** (Highest): User says "switch to X mode" or "/mode X"
2. **Specialized Keywords**: Automatic switch to debugger, security, reviewer, performance
3. **Core Keywords**: Automatic switch to planning, developer, assistant
4. **Tool Usage**: Automatic switch to tool mode during execution
5. **Default**: Assistant mode

### Confidence Thresholds

| Transition | Required Confidence | Auto-Switch | Reason |
|------------|-------------------|-------------|---------|
| Any → Explicit | 1.0 | ✅ Always | User command |
| Any → Debugger | 0.85 | ✅ Yes | Error/bug keywords detected |
| Any → Security | 0.85 | ✅ Yes | Security keywords detected |
| Any → Reviewer | 0.80 | ✅ Yes | Review keywords detected |
| Any → Performance | 0.80 | ✅ Yes | Performance keywords detected |
| Assistant → Planning | 0.70 | ✅ Yes | Natural progression |
| Planning → Developer | 0.80 | ✅ Yes | Commitment to implement |
| Developer → Planning | 0.60 | ✅ Yes | Easy to step back |
| Developer → Debugger | 0.85 | ✅ Yes | Error encountered |
| Debugger → Developer | 0.70 | ✅ Yes | Bug fixed, resume work |
| Any → Tool | 0.90 | ✅ Yes | Explicit tool usage |

### Example Auto-Switch Scenarios

**Scenario 1: Error Encountered**
```
User (Developer mode): "Implement authentication"
→ Developer mode active
→ Code written, tests run
→ Error: "TypeError: Cannot read property 'user' of undefined"
→ AUTO-SWITCH to Debugger mode (error keyword detected)
→ Debugger analyzes error, finds root cause
→ Fix applied
→ AUTO-SWITCH back to Developer mode
```

**Scenario 2: Security Concern**
```
User (Developer mode): "Add user input handling"
→ Developer mode active
→ Code written
User: "Is this vulnerable to SQL injection?"
→ AUTO-SWITCH to Security mode (security keyword detected)
→ Security audit performed
→ Vulnerabilities identified and fixed
→ AUTO-SWITCH back to Developer mode
```

**Scenario 3: Performance Issue**
```
User (Developer mode): "This query is really slow"
→ AUTO-SWITCH to Performance mode (performance keyword detected)
→ Performance analysis performed
→ Optimization suggestions provided
→ Optimizations applied
→ AUTO-SWITCH back to Developer mode
```

---

## Mode-Aware Context Snapshots

### Overview

The system maintains mode-aware context snapshots to preserve conversation state across mode transitions. This enables seamless workflows like: **Developer → Debugger → Developer** where the debugger's findings are preserved when returning to developer mode.

### Snapshot Strategy

**Hybrid Approach:**
1. **Lightweight JSON Snapshots** - For quick mode switches (in-memory + disk cache)
2. **Full XML Snapshots** - For long-term storage and compression (STATE_SNAPSHOT_PROMPT format)

### Snapshot Types

#### Type 1: Mode Transition Snapshot (JSON)

**Purpose:** Preserve recent context when switching between modes  
**Format:** JSON  
**Storage:** In-memory cache (last 10 transitions) + disk cache  
**Lifetime:** 1 hour or until session ends

```typescript
interface ModeTransitionSnapshot {
  id: string;
  timestamp: Date;
  fromMode: ModeType;
  toMode: ModeType;
  
  // Recent conversation context (last 5 messages)
  recentMessages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }[];
  
  // Active state
  activeSkills: string[];
  activeTools: string[];
  currentTask: string | null;
  
  // Mode-specific findings (for specialized modes)
  findings?: {
    debugger?: {
      errors: string[];
      rootCause: string | null;
      fixes: string[];
    };
    security?: {
      vulnerabilities: string[];
      recommendations: string[];
    };
    reviewer?: {
      issues: string[];
      suggestions: string[];
    };
    performance?: {
      bottlenecks: string[];
      optimizations: string[];
    };
  };
}
```

**Example Flow:**
```
Developer mode: "Implement authentication"
→ Code written, tests run
→ Error encountered: "TypeError: Cannot read property 'user' of undefined"
→ AUTO-SWITCH to Debugger mode
→ CREATE ModeTransitionSnapshot (preserves developer context)
→ Debugger analyzes error, finds root cause
→ Debugger adds findings to snapshot
→ AUTO-SWITCH back to Developer mode
→ RESTORE ModeTransitionSnapshot (includes debugger findings)
→ Developer continues with fix
```

#### Type 2: Full State Snapshot (XML)

**Purpose:** Complete conversation history for compression and long-term storage  
**Format:** XML (STATE_SNAPSHOT_PROMPT template)  
**Storage:** Disk only  
**Lifetime:** Permanent (until session deleted)

```xml
<state_snapshot>
  <overall_goal>
    Implement user authentication system with JWT tokens
  </overall_goal>

  <key_knowledge>
    - Using Express.js framework
    - Database: PostgreSQL with Prisma ORM
    - JWT library: jsonwebtoken
    - Password hashing: bcrypt
  </key_knowledge>

  <file_system_state>
    - CREATED: src/auth/authController.ts (JWT token generation)
    - MODIFIED: src/routes/api.ts (Added auth routes)
    - CREATED: src/middleware/authMiddleware.ts (Token verification)
    - MODIFIED: package.json (Added jsonwebtoken, bcrypt)
  </file_system_state>

  <current_plan>
    1. [DONE] Research authentication best practices
    2. [DONE] Design authentication flow
    3. [DONE] Implement user registration
    4. [DONE] Implement login with JWT
    5. [IN PROGRESS] Debug token verification error
    6. [TODO] Add refresh token support
    7. [TODO] Write tests
  </current_plan>
  
  <mode_history>
    - Planning mode: Researched JWT best practices
    - Developer mode: Implemented registration and login
    - Debugger mode: Found null pointer in token verification
    - Developer mode: Applied fix, continuing implementation
  </mode_history>
</state_snapshot>
```

### Snapshot Manager

```typescript
interface SnapshotManager {
  // Create lightweight snapshot on mode transition
  createTransitionSnapshot(
    fromMode: ModeType,
    toMode: ModeType,
    context: {
      messages: Message[];
      activeSkills: string[];
      activeTools: string[];
      currentTask?: string;
      findings?: ModeFindings;
    }
  ): ModeTransitionSnapshot;
  
  // Store snapshot in cache
  storeSnapshot(snapshot: ModeTransitionSnapshot): void;
  
  // Retrieve snapshot for mode restoration
  getSnapshot(fromMode: ModeType, toMode: ModeType): ModeTransitionSnapshot | null;
  
  // Get most recent snapshot
  getLatestSnapshot(): ModeTransitionSnapshot | null;
  
  // Create full XML snapshot for compression
  createFullSnapshot(messages: Message[]): Promise<string>;
  
  // Clear old snapshots (older than 1 hour)
  pruneSnapshots(): void;
}
```

### Snapshot Creation Triggers

**Automatic Snapshot Creation:**
1. **Before Specialized Mode Entry** - Preserve developer context before debugging
2. **After Specialized Mode Exit** - Preserve findings when returning to developer
3. **Before Context Compression** - Full XML snapshot for long-term storage
4. **Before HotSwap** - Full XML snapshot for context reseeding

**Example Triggers:**
```typescript
// Trigger 1: Before entering specialized mode
if (isSpecializedMode(newMode) && currentMode === 'developer') {
  const snapshot = snapshotManager.createTransitionSnapshot(
    currentMode,
    newMode,
    { messages, activeSkills, activeTools, currentTask }
  );
  snapshotManager.storeSnapshot(snapshot);
}

// Trigger 2: After exiting specialized mode
if (isSpecializedMode(currentMode) && newMode === 'developer') {
  const snapshot = snapshotManager.getSnapshot(newMode, currentMode);
  if (snapshot) {
    // Inject findings into conversation
    const findingsMessage = formatFindings(snapshot.findings);
    contextManager.addMessage({
      role: 'system',
      content: findingsMessage
    });
  }
}

// Trigger 3: Before compression
if (contextUsage > 0.8) {
  const xmlSnapshot = await snapshotManager.createFullSnapshot(messages);
  await compressionService.compress(xmlSnapshot);
}

// Trigger 4: Before HotSwap
if (hotswapRequested) {
  const xmlSnapshot = await snapshotManager.createFullSnapshot(messages);
  await hotswapService.swap(newSkills, xmlSnapshot);
}
```

### Snapshot Storage

**In-Memory Cache:**
```typescript
class SnapshotCache {
  private cache: Map<string, ModeTransitionSnapshot> = new Map();
  private maxSize = 10;
  
  set(key: string, snapshot: ModeTransitionSnapshot): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest snapshot
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, snapshot);
  }
  
  get(key: string): ModeTransitionSnapshot | null {
    return this.cache.get(key) || null;
  }
  
  clear(): void {
    this.cache.clear();
  }
}
```

**Disk Cache:**
```
~/.ollm/snapshots/
├── session-{id}/
│   ├── transition-{timestamp}.json  # Lightweight snapshots
│   └── full-{timestamp}.xml         # Full snapshots
```

### Snapshot Restoration

**Scenario 1: Return from Debugger**
```typescript
// User in Developer mode encounters error
// System auto-switches to Debugger mode
// Debugger finds root cause and suggests fix
// System auto-switches back to Developer mode

const snapshot = snapshotManager.getSnapshot('developer', 'debugger');
if (snapshot?.findings?.debugger) {
  const { errors, rootCause, fixes } = snapshot.findings.debugger;
  
  // Inject findings as system message
  contextManager.addMessage({
    role: 'system',
    content: `
[Debugger Findings]
Errors: ${errors.join(', ')}
Root Cause: ${rootCause}
Suggested Fixes: ${fixes.join(', ')}

Continue implementation with these findings in mind.
    `.trim()
  });
}
```

**Scenario 2: Return from Security Audit**
```typescript
const snapshot = snapshotManager.getSnapshot('developer', 'security');
if (snapshot?.findings?.security) {
  const { vulnerabilities, recommendations } = snapshot.findings.security;
  
  contextManager.addMessage({
    role: 'system',
    content: `
[Security Audit Results]
Vulnerabilities Found: ${vulnerabilities.length}
${vulnerabilities.map((v, i) => `${i + 1}. ${v}`).join('\n')}

Recommendations:
${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Apply these security fixes before continuing.
    `.trim()
  });
}
```

### Integration with Existing Systems

**Integration with HotSwap:**
```typescript
// HotSwapService already uses XML snapshots
// Extend to support mode-aware snapshots

async swap(newSkills?: string[]): Promise<void> {
  // Create full XML snapshot (existing)
  const xmlSnapshot = await this.generateSnapshot(messages);
  
  // Create mode transition snapshot (new)
  const transitionSnapshot = this.snapshotManager.createTransitionSnapshot(
    this.modeManager.getCurrentMode(),
    'developer',
    { messages, activeSkills, activeTools }
  );
  this.snapshotManager.storeSnapshot(transitionSnapshot);
  
  // Continue with existing HotSwap flow
  await this.contextManager.clear();
  // ... rest of HotSwap logic
}
```

**Integration with Compression:**
```typescript
// CompressionService uses XML snapshots
// No changes needed - already compatible

async compress(): Promise<void> {
  // Create full XML snapshot (existing)
  const xmlSnapshot = await this.generateSnapshot(messages);
  
  // Compress using XML snapshot
  const compressed = await this.compressionService.compress(xmlSnapshot);
  
  // Replace old messages with compressed version
  await this.contextManager.replaceMessages(compressed);
}
```

---

## RAG Integration with Codebase Indexing

### Overview

The Dynamic Prompt System integrates with RAG (Retrieval-Augmented Generation) to provide mode-specific context from codebase indexing and knowledge bases. This enables specialized modes to access relevant information automatically.

### Architecture

```typescript
interface RAGSystem {
  // Core indexing
  codebaseIndex: CodebaseIndex;
  embeddingService: EmbeddingService;
  vectorStore: LanceDBVectorStore;
  
  // Mode-specific knowledge bases
  modeKnowledge: {
    debugger: LanceDBIndex;     // Common bugs, solutions
    security: LanceDBIndex;     // Vulnerabilities, fixes
    performance: LanceDBIndex;  // Optimization patterns
    planning: LanceDBIndex;     // Design patterns
  };
}
```

### Codebase Index

```typescript
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
  
  // Status
  getStats(): IndexStats;
  clear(): Promise<void>;
}

interface IndexOptions {
  extensions: string[];           // ['.ts', '.js', '.py']
  excludePatterns: string[];      // ['node_modules', 'dist']
  maxFileSize: number;            // Skip larger files
  chunkSize: number;              // Tokens per chunk
  chunkOverlap: number;           // Overlap between chunks
  autoIndex: boolean;             // Index on startup
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
```

### Embedding Service

Uses local embeddings for offline operation:

```typescript
interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  cosineSimilarity(a: number[], b: number[]): number;
  getDimensions(): number;
  getModel(): string;
}

// Local implementation using @xenova/transformers
class LocalEmbeddingService implements EmbeddingService {
  private model = 'Xenova/all-MiniLM-L6-v2';  // 384-dim
  
  async embed(text: string): Promise<number[]> {
    const output = await this.pipeline(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }
  
  getDimensions(): number {
    return 384;
  }
}
```

### LanceDB Vector Store

LanceDB is chosen for its embedded nature, TypeScript support, and local-first design:

```typescript
interface LanceDBVectorStore {
  // Storage operations
  upsert(id: string, vector: number[], metadata: VectorMetadata): Promise<void>;
  upsertBatch(items: VectorItem[]): Promise<void>;
  
  // Search operations
  searchByVector(vector: number[], topK: number, threshold?: number): Promise<VectorResult[]>;
  
  // Management
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

interface VectorMetadata {
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  lastModified: number;
}
```

### Storage Location

```
~/.ollm/rag/
├── codebase.lance/          # Codebase index
├── knowledge/
│   ├── debugger.lance/      # Debugger knowledge
│   ├── security.lance/      # Security knowledge
│   ├── performance.lance/   # Performance knowledge
│   └── planning.lance/      # Planning knowledge
```

### Integration with Mode System

**On Mode Entry:**
```typescript
async onModeEnter(mode: ModeType, context: string): Promise<void> {
  if (this.ragSystem) {
    // Search codebase for relevant context
    const codebaseResults = await this.ragSystem.codebaseIndex.search(
      context,
      { topK: 5, threshold: 0.7 }
    );
    
    // Search mode-specific knowledge
    const knowledgeResults = await this.ragSystem.modeKnowledge[mode]?.search(
      context,
      { topK: 3, threshold: 0.75 }
    );
    
    // Inject RAG context into system prompt
    const ragContext = this.formatRAGContext(codebaseResults, knowledgeResults);
    this.modeManager.addContextToPrompt(ragContext);
  }
}
```

**On Mode Exit:**
```typescript
async onModeExit(mode: ModeType, findings: any): Promise<void> {
  if (this.ragSystem && this.isSpecializedMode(mode)) {
    const knowledge = this.convertFindingsToDocuments(mode, findings);
    await this.ragSystem.modeKnowledge[mode].upsertBatch(knowledge);
  }
}
```

### Automatic Indexing

- Index workspace on startup (if enabled)
- Watch for file changes and update incrementally
- Respect .gitignore and exclude patterns
- Skip large files (configurable threshold)

### Configuration

```yaml
rag:
  enabled: true
  codebase:
    autoIndex: true
    extensions: ['.ts', '.js', '.py', '.md']
    excludePatterns: ['node_modules', 'dist', '.git']
    maxFileSize: 1048576  # 1MB
    chunkSize: 512        # tokens
    chunkOverlap: 50      # tokens
  embedding:
    provider: 'local'     # local | ollama
    model: 'all-MiniLM-L6-v2'
  search:
    topK: 5
    threshold: 0.7
```

---

## Structured Output Support

### Overview

The Dynamic Prompt System integrates structured output with JSON schema enforcement for reliable, parseable responses from specialized modes. This ensures debugger findings, security reports, and performance analyses are consistently formatted.

### Architecture

```typescript
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
```

### JSON Schema Definition

```typescript
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

### Mode-Specific Schemas

Each specialized mode defines output schemas for structured responses:

```typescript
const MODE_OUTPUT_SCHEMAS: Record<ModeType, JSONSchema | null> = {
  debugger: {
    type: 'object',
    properties: {
      errors: { type: 'array', items: { type: 'string' } },
      rootCause: { type: 'string' },
      fixes: { type: 'array', items: { type: 'string' } }
    },
    required: ['errors', 'rootCause', 'fixes']
  },
  
  security: {
    type: 'object',
    properties: {
      vulnerabilities: { type: 'array', items: { type: 'string' } },
      severity: { 
        type: 'array', 
        items: { 
          type: 'string', 
          enum: ['low', 'medium', 'high', 'critical'] 
        } 
      },
      recommendations: { type: 'array', items: { type: 'string' } }
    },
    required: ['vulnerabilities', 'recommendations']
  },
  
  reviewer: {
    type: 'object',
    properties: {
      issues: { type: 'array', items: { type: 'string' } },
      suggestions: { type: 'array', items: { type: 'string' } },
      positives: { type: 'array', items: { type: 'string' } }
    },
    required: ['issues', 'suggestions']
  },
  
  performance: {
    type: 'object',
    properties: {
      bottlenecks: { type: 'array', items: { type: 'string' } },
      optimizations: { type: 'array', items: { type: 'string' } },
      estimatedImprovement: { type: 'string' }
    },
    required: ['bottlenecks', 'optimizations']
  },
  
  // Other modes don't require structured output
  assistant: null,
  planning: null,
  developer: null,
  tool: null,
  prototype: null,
  teacher: null
};
```

### Usage in Modes

```typescript
// When specialized mode completes analysis, use structured output
async analyzeWithStructuredOutput(mode: ModeType, context: string): Promise<any> {
  const schema = MODE_OUTPUT_SCHEMAS[mode];
  if (!schema) {
    // No structured output for this mode
    return this.generateNormalResponse(context);
  }
  
  // Generate with schema enforcement
  const result = await this.structuredOutputService.generateWithSchema(
    {
      model: this.currentModel,
      messages: this.buildMessages(context),
      systemPrompt: this.getSystemPrompt(mode)
    },
    schema,
    {
      strict: true,
      maxRetries: 3,
      retryDelay: 1000
    }
  );
  
  return result;
}
```

### Retry Logic

```typescript
async generateWithSchema<T>(
  request: ProviderRequest,
  schema: JSONSchema,
  options: StructuredOutputOptions
): Promise<T> {
  let attempts = 0;
  let lastError: ValidationError[] | null = null;
  
  while (attempts < options.maxRetries) {
    attempts++;
    
    // Generate response
    const response = await this.provider.chat({
      ...request,
      responseFormat: { type: 'json_schema', schema, strict: options.strict }
    });
    
    // Validate against schema
    const validation = this.validate(response.content, schema);
    
    if (validation.valid) {
      return validation.data as T;
    }
    
    lastError = validation.errors || null;
    
    if (attempts < options.maxRetries) {
      await this.delay(options.retryDelay);
    }
  }
  
  throw new ValidationError(
    `Failed to generate valid output after ${attempts} attempts`,
    lastError
  );
}
```

### Integration Points

**Mode Entry:**
- Enable structured output if mode has schema
- Configure provider with response format

**Mode Exit:**
- Validate and store structured findings
- Include in mode transition snapshot

**Snapshot Creation:**
- Include structured findings in JSON format
- Preserve schema validation results

**UI Display:**
- Parse and display structured output nicely
- Show validation errors if any

### Configuration

```yaml
structuredOutput:
  enabled: true
  defaultMaxRetries: 3
  defaultRetryDelay: 1000
  strict: true
  modes:
    debugger: true
    security: true
    reviewer: true
    performance: true
```

### Snapshot Lifecycle

```
1. Mode Transition Triggered
   ↓
2. Create Transition Snapshot
   ↓
3. Store in Memory Cache
   ↓
4. Store on Disk (async)
   ↓
5. Switch Mode
   ↓
6. Specialized Mode Work
   ↓
7. Add Findings to Snapshot
   ↓
8. Return to Previous Mode
   ↓
9. Retrieve Snapshot
   ↓
10. Inject Findings
   ↓
11. Continue Work
```

### Performance Considerations

**Optimization Strategies:**
1. **Lazy Loading** - Only load snapshots when needed
2. **Async Storage** - Write to disk asynchronously
3. **Compression** - Compress JSON snapshots before disk write
4. **Pruning** - Remove snapshots older than 1 hour
5. **Cache Limits** - Keep only last 10 snapshots in memory

**Memory Usage:**
- In-memory cache: ~10 snapshots × ~50KB = ~500KB
- Disk cache: ~100 snapshots × ~50KB = ~5MB per session

---

## Advanced Features & Enhancements

### Mode Transition Suggestions

The system proactively suggests mode switches to help users discover and understand the mode system.

**Implementation:**
```typescript
interface ModeTransitionSuggestion {
  currentMode: ModeType;
  suggestedMode: ModeType;
  reason: string;
  confidence: number;
  autoSwitch: boolean;  // If false, ask user first
}
```

**Examples:**
- Assistant → Planning: "This sounds like you want to plan an implementation"
- Planning → Developer: "The plan is complete. Ready to implement?"
- Developer → Debugger: "Multiple errors detected. Systematic debugging recommended"

### Mode Workflows

Predefined sequences of modes for common tasks:

**Available Workflows:**
1. **Feature Development**: Planning → Developer → Reviewer → Developer
2. **Bug Fix**: Debugger → Developer → Reviewer
3. **Security Hardening**: Security → Developer → Security
4. **Performance Optimization**: Performance → Developer → Performance
5. **Learning Session**: Teacher → Prototype → Developer

**Commands:**
```bash
/workflow feature_development  # Start workflow
/workflow status               # Show progress
/workflow next                 # Skip to next step
```

### Mode-Specific Shortcuts

Quick commands for faster mode access:

```bash
# Mode switching
/assist, /plan, /dev, /debug, /secure, /review, /perf, /proto, /teach

# Mode-specific actions
/debug trace         # Stack trace analysis
/secure scan         # Security scan
/review checklist    # Review checklist
/perf profile        # Performance profiling
```

### Mode Confidence Display

Shows confidence scores for current and suggested modes in the UI:

```
Current Mode: 👨‍💻 Developer (confidence: 0.85)

Suggested Modes:
📋 Planning (0.45) - "Let's plan first"
🐛 Debugger (0.72) - "Debug this error"
```

### Focus Mode

Locks to a specific mode for deep work sessions:

```bash
/mode focus developer 30  # Lock for 30 minutes
/mode focus off           # Disable focus mode
```

Prevents auto-switching and manual mode changes during focus period.

### Hybrid Modes

Combine multiple modes for complex tasks:

```bash
/mode hybrid developer security  # Secure development
/mode hybrid developer performance  # Performance-focused development
```

**Preset Hybrid Modes:**
- `secure-developer`: Developer + Security
- `perf-developer`: Developer + Performance
- `security-debugger`: Debugger + Security

### Mode Memory (Project Preferences)

Remembers mode preferences per project:

```typescript
interface ProjectModePreferences {
  defaultMode: ModeType;
  autoSwitchEnabled: boolean;
  customThresholds: Partial<Record<ModeType, number>>;
  disabledModes: ModeType[];
  preferredWorkflows: string[];
}
```

**Storage:** `.ollm/mode-preferences.json`

### Mode-Specific Metrics

Tracks mode usage and effectiveness:

```typescript
interface ModeMetrics {
  debugger?: {
    bugsAnalyzed: number;
    rootCausesFound: number;
    fixesApplied: number;
    averageTimeToFix: number;
  };
  security?: {
    vulnerabilitiesFound: number;
    criticalIssues: number;
    fixesApplied: number;
  };
  performance?: {
    optimizationsApplied: number;
    speedImprovements: string[];
  };
}
```

**Display:** `/mode status` shows metrics for current session

### Mode Transition Animations

Visual feedback for mode changes:

```
[Switching to Debugger Mode...]
🐛 Analyzing error patterns...
✓ Debugger Mode Active
```

### RAG Integration (Future)

The system is prepared for RAG integration using LanceDB:

**Architecture:**
```typescript
interface RAGSystem {
  codebaseIndex: LanceDBIndex;
  docsIndex: LanceDBIndex;
  memoryIndex: LanceDBIndex;
  modeKnowledge: {
    debugger: LanceDBIndex;     // Common bugs, solutions
    security: LanceDBIndex;     // Vulnerabilities, fixes
    performance: LanceDBIndex;  // Optimization patterns
    planning: LanceDBIndex;     // Design patterns
  };
}
```

**Storage:** `~/.ollm/rag/`

**Embedding Model:** `@xenova/transformers` with `all-MiniLM-L6-v2` (384-dim, runs locally)

**Integration Points:**
- Mode entry: Load relevant RAG context
- Mode exit: Index findings for future use
- Specialized modes: Query mode-specific knowledge bases

---

## Components and Interfaces

### Context Analyzer

```typescript
interface ContextAnalysis {
  mode: ModeType;
  confidence: number;
  triggers: string[];
  metadata: {
    keywords: string[];
    toolsUsed: string[];
    recentTopics: string[];
    codeBlocksPresent: boolean;
  };
}

type ModeType = 
  | 'assistant' 
  | 'planning' 
  | 'developer' 
  | 'tool'
  | 'debugger'
  | 'security'
  | 'reviewer'
  | 'performance';

interface ContextAnalyzer {
  // Analyze conversation messages for mode recommendation
  analyzeConversation(messages: Message[]): ContextAnalysis;
  
  // Calculate confidence score for a specific mode
  calculateModeConfidence(messages: Message[], mode: ModeType): number;
  
  // Detect keywords in text
  detectKeywords(text: string): { mode: ModeType; keywords: string[] }[];
  
  // Check if tool usage indicates mode switch
  detectToolUsage(messages: Message[]): ModeType | null;
}
```

**Implementation Notes:**
- Analyze last 5 messages for context
- Weight recent messages higher (exponential decay)
- Boost confidence for explicit mode requests (+0.5)
- Boost confidence for code blocks in developer mode (+0.2)
- Boost confidence for error messages in debugger mode (+0.3)
- Boost confidence for security keywords (+0.3)

### Prompt Mode Manager

```typescript
interface ModeConfig {
  mode: ModeType;
  autoSwitch: boolean;
  minDuration: number;      // Minimum time in mode (ms)
  cooldownPeriod: number;   // Time between switches (ms)
  confidenceThreshold: number;
}

interface ModeTransition {
  from: ModeType;
  to: ModeType;
  timestamp: Date;
  trigger: 'auto' | 'manual' | 'tool' | 'explicit';
  confidence: number;
}

interface PromptModeManager {
  // Get current mode
  getCurrentMode(): ModeType;
  
  // Check if mode should switch
  shouldSwitchMode(
    currentMode: ModeType,
    analysis: ContextAnalysis
  ): boolean;
  
  // Switch to a new mode
  switchMode(
    newMode: ModeType,
    trigger: 'auto' | 'manual' | 'tool' | 'explicit'
  ): Promise<void>;
  
  // Build prompt for current mode
  buildPrompt(options: PromptBuildOptions): string;
  
  // Filter tools for current mode
  filterToolsForMode(tools: Tool[], mode: ModeType): Tool[];
  
  // Get mode history
  getModeHistory(): ModeTransition[];
  
  // Enable/disable auto-switching
  setAutoSwitch(enabled: boolean): void;
  
  // Force a specific mode (disables auto-switch)
  forceMode(mode: ModeType): void;
  
  // Register mode change listener
  onModeChange(callback: (transition: ModeTransition) => void): void;
}

interface PromptBuildOptions {
  mode: ModeType;
  skills?: string[];
  tools: Tool[];
  workspace?: WorkspaceContext;
  additionalInstructions?: string;
}
```

**Implementation Notes:**
- Maintain mode history (last 100 transitions)
- Implement hysteresis (30s minimum duration)
- Implement cooldown (10s between switches)
- Emit 'mode-changed' event on transitions
- Persist mode preference to settings
- Load mode preference on startup

### Tool Filter

```typescript
interface ToolAccess {
  mode: ModeType;
  allowedTools: string[];
  deniedTools: string[];
  readOnly: boolean;
}

const TOOL_ACCESS_RULES: Record<ModeType, ToolAccess> = {
  assistant: {
    mode: 'assistant',
    allowedTools: [],
    deniedTools: ['*'],
    readOnly: true
  },
  
  planning: {
    mode: 'planning',
    allowedTools: [
      'web_search', 'web_fetch',
      'read_file', 'read_multiple_files',
      'grep_search', 'file_search', 'list_directory',
      'get_diagnostics'
    ],
    deniedTools: [
      'write_file', 'fs_append', 'str_replace', 'delete_file',
      'execute_pwsh', 'control_pwsh_process',
      'git_*'
    ],
    readOnly: true
  },
  
  developer: {
    mode: 'developer',
    allowedTools: ['*'],
    deniedTools: [],
    readOnly: false
  },
  
  tool: {
    mode: 'tool',
    allowedTools: ['*'],
    deniedTools: [],
    readOnly: false
  },
  
  debugger: {
    mode: 'debugger',
    allowedTools: [
      'read_file', 'grep_search', 'list_directory',
      'get_diagnostics', 'shell',
      'git_diff', 'git_log',
      'web_search',
      'write_file', 'str_replace'  // For fixes only
    ],
    deniedTools: ['delete_file', 'git_commit'],  // Prevent accidental commits
    readOnly: false
  },
  
  security: {
    mode: 'security',
    allowedTools: [
      'read_file', 'grep_search', 'list_directory',
      'get_diagnostics', 'shell',
      'web_search',
      'write_file', 'str_replace'  // For security fixes only
    ],
    deniedTools: ['delete_file'],
    readOnly: false
  },
  
  reviewer: {
    mode: 'reviewer',
    allowedTools: [
      'read_file', 'grep_search', 'list_directory',
      'get_diagnostics', 'shell',
      'git_diff', 'git_log'
    ],
    deniedTools: ['write_file', 'str_replace', 'delete_file', 'git_*'],
    readOnly: true
  },
  
  performance: {
    mode: 'performance',
    allowedTools: [
      'read_file', 'grep_search', 'list_directory',
      'get_diagnostics', 'shell',
      'web_search',
      'write_file', 'str_replace'  // For optimizations
    ],
    deniedTools: ['delete_file'],
    readOnly: false
  }
};

interface ToolFilter {
  // Filter tools based on mode
  filterTools(tools: Tool[], mode: ModeType): Tool[];
  
  // Check if a tool is allowed in mode
  isToolAllowed(toolName: string, mode: ModeType): boolean;
  
  // Get allowed tools for mode
  getAllowedTools(mode: ModeType): string[];
  
  // Get denied tools for mode
  getDeniedTools(mode: ModeType): string[];
}
```

### Mode Templates

```typescript
interface ModeTemplate {
  mode: ModeType;
  persona: string;
  icon: string;
  color: string;
  purpose: string;
  template: string;
  keywords: string[];
  confidenceThreshold: number;
}

// Templates stored in packages/core/src/prompts/templates/modes/
// - assistant.ts
// - planning.ts
// - developer.ts
// - tool.ts
// - debugger.ts
// - security.ts
// - reviewer.ts
// - performance.ts
```

---

## Integration Points

### Integration 1: App Initialization

```typescript
// packages/cli/src/features/context/ContextManagerContext.tsx

useEffect(() => {
  const initManager = async () => {
    // Create context manager
    const manager = createContextManager(sessionId, modelInfo, config);
    await manager.start();
    
    // Create prompt infrastructure
    const promptRegistry = new PromptRegistry();
    const promptBuilder = new SystemPromptBuilder(promptRegistry);
    const contextAnalyzer = new ContextAnalyzer();
    const modeManager = new PromptModeManager(
      promptBuilder,
      promptRegistry,
      contextAnalyzer
    );
    
    // Load saved mode preference or default to assistant
    const savedMode = SettingsService.getInstance().getMode() || 'assistant';
    modeManager.forceMode(savedMode);
    
    // Build initial prompt
    const initialPrompt = modeManager.buildPrompt({
      mode: savedMode,
      tools: [],
      skills: [],
      workspace: workspaceContext
    });
    
    manager.setSystemPrompt(initialPrompt);
    
    // Store for later use
    modeManagerRef.current = modeManager;
    
    // Listen for mode changes
    modeManager.onModeChange((transition) => {
      updateContextState({ currentMode: transition.to });
      SettingsService.getInstance().setMode(transition.to);
    });
    
    setActive(true);
  };
  
  initManager();
}, [sessionId, modelInfo, config]);
```

### Integration 2: Message Send Flow

```typescript
// packages/cli/src/features/context/ChatContext.tsx

const sendMessage = useCallback(async (content: string) => {
  if (!modeManager) return;
  
  // Add user message
  const userMessage = {
    id: generateId(),
    role: 'user',
    content,
    timestamp: new Date()
  };
  
  addMessage(userMessage);
  
  // Analyze conversation for mode recommendation
  const messages = await contextManager.getMessages();
  const analysis = modeManager.analyzeConversation([...messages, userMessage]);
  
  // Check if mode should switch
  const shouldSwitch = modeManager.shouldSwitchMode(
    modeManager.getCurrentMode(),
    analysis
  );
  
  if (shouldSwitch) {
    // Switch mode and rebuild prompt
    await modeManager.switchMode(analysis.mode, 'auto');
    
    const newPrompt = modeManager.buildPrompt({
      mode: analysis.mode,
      tools: availableTools,
      skills: activeSkills,
      workspace: workspaceContext
    });
    
    contextManager.setSystemPrompt(newPrompt);
  }
  
  // Continue with normal message flow
  await sendToProvider(userMessage);
}, [modeManager, contextManager, availableTools, activeSkills]);
```

### Integration 3: Tool Execution Flow

```typescript
// packages/core/src/core/chatClient.ts

async executeTool(toolCall: ToolCall): Promise<ToolResult> {
  const currentMode = this.modeManager.getCurrentMode();
  
  // Check if tool is allowed in current mode
  if (!this.modeManager.isToolAllowed(toolCall.name, currentMode)) {
    return {
      success: false,
      error: {
        message: `Tool "${toolCall.name}" is not allowed in ${currentMode} mode. Switch to developer mode to use this tool.`,
        type: 'ToolNotAllowedError'
      }
    };
  }
  
  // Switch to tool mode during execution
  const previousMode = currentMode;
  if (currentMode !== 'tool') {
    await this.modeManager.switchMode('tool', 'tool');
  }
  
  // Execute tool
  const result = await this.toolRegistry.execute(toolCall);
  
  // Switch back to previous mode
  if (previousMode !== 'tool') {
    await this.modeManager.switchMode(previousMode, 'auto');
  }
  
  return result;
}
```

### Integration 4: HotSwap Service

```typescript
// packages/core/src/context/HotSwapService.ts

export class HotSwapService {
  constructor(
    private contextManager: ContextManager,
    private promptRegistry: PromptRegistry,
    private modeManager: PromptModeManager,  // NEW
    private provider: ProviderAdapter,
    private model: string
  ) {
    this.promptRegistry.register(STATE_SNAPSHOT_PROMPT);
  }

  async swap(newSkills?: string[]): Promise<void> {
    // 1. Generate snapshot
    const messages = await this.contextManager.getMessages();
    const snapshotXml = await this.generateSnapshot(messages);
    
    // 2. Clear context
    await this.contextManager.clear();
    
    // 3. Update mode manager with new skills
    this.modeManager.updateSkills(newSkills || []);
    
    // 4. Build new prompt (defaults to developer mode for skills)
    const newPrompt = this.modeManager.buildPrompt({
      mode: 'developer',
      skills: newSkills,
      tools: this.availableTools,
      workspace: this.workspaceContext
    });
    
    this.contextManager.setSystemPrompt(newPrompt);
    
    // 5. Reseed with snapshot
    if (snapshotXml) {
      const parsed = SnapshotParser.parse(snapshotXml);
      const seedContent = SnapshotParser.toSystemContext(parsed);
      await this.contextManager.addMessage({
        id: `seed-${Date.now()}`,
        role: 'system',
        content: seedContent,
        timestamp: new Date()
      });
    }
    
    // 6. Emit events
    this.contextManager.emit('active-skills-updated', newSkills);
    this.modeManager.emit('mode-changed', {
      from: this.modeManager.getCurrentMode(),
      to: 'developer',
      trigger: 'explicit',
      timestamp: new Date()
    });
  }
}
```

### Integration 5: UI Display

```typescript
// packages/cli/src/features/context/ActiveContextState.tsx

interface ActiveContextState {
  activeSkills: string[];
  activeTools: string[];
  activeHooks: string[];
  activeMcpServers: string[];
  activePrompts: string[];
  currentPersona: string;
  currentMode: ModeType;           // NEW
  allowedTools: string[];          // NEW
  modeIcon: string;                // NEW
  modeColor: string;               // NEW
  contextStrategy: 'Standard' | 'Hot Swap';
}

// Listen for mode changes
useEffect(() => {
  if (!modeManager) return;
  
  modeManager.onModeChange((transition) => {
    const modeInfo = MODE_DISPLAY_INFO[transition.to];
    
    setState(prev => ({
      ...prev,
      currentMode: transition.to,
      currentPersona: modeInfo.persona,
      modeIcon: modeInfo.icon,
      modeColor: modeInfo.color,
      allowedTools: modeManager.getAllowedTools(transition.to)
    }));
  });
}, [modeManager]);
```

---

## Data Models

### Mode State

```typescript
interface ModeState {
  currentMode: ModeType;
  previousMode: ModeType | null;
  autoSwitchEnabled: boolean;
  lastSwitchTime: Date;
  modeHistory: ModeTransition[];
  activeSkills: string[];
}
```

### Mode Display Info

```typescript
const MODE_DISPLAY_INFO: Record<ModeType, ModeDisplayInfo> = {
  assistant: {
    persona: 'Helpful AI Assistant',
    icon: '💬',
    color: 'blue',
    description: 'General conversation and explanations'
  },
  planning: {
    persona: 'Technical Architect & Planner',
    icon: '📋',
    color: 'yellow',
    description: 'Research and design (read-only)'
  },
  developer: {
    persona: 'Senior Software Engineer',
    icon: '👨‍💻',
    color: 'green',
    description: 'Full implementation access'
  },
  tool: {
    persona: 'Tool Expert',
    icon: '🔧',
    color: 'cyan',
    description: 'Enhanced tool usage'
  },
  debugger: {
    persona: 'Debugging Specialist',
    icon: '🐛',
    color: 'red',
    description: 'Systematic debugging'
  },
  security: {
    persona: 'Security Auditor',
    icon: '🔒',
    color: 'purple',
    description: 'Security analysis and fixes'
  },
  reviewer: {
    persona: 'Code Reviewer',
    icon: '👀',
    color: 'orange',
    description: 'Code quality assessment'
  },
  performance: {
    persona: 'Performance Engineer',
    icon: '⚡',
    color: 'magenta',
    description: 'Performance optimization'
  }
};
```

---

## Commands

### Mode Commands

```typescript
// /mode assistant - Switch to assistant mode
// /mode planning - Switch to planning mode
// /mode developer - Switch to developer mode
// /mode debugger - Switch to debugger mode
// /mode security - Switch to security mode
// /mode reviewer - Switch to reviewer mode
// /mode performance - Switch to performance mode
// /mode auto - Enable automatic mode switching
// /mode status - Show current mode and settings
// /mode history - Show mode change history
```

---

## Configuration

```yaml
# .ollm/config.yaml

prompt:
  mode: auto  # auto | assistant | planning | developer | debugger | security | reviewer | performance
  
  switching:
    enabled: true
    confidence_threshold: 0.7
    min_duration: 30000      # 30 seconds
    cooldown: 10000          # 10 seconds
  
  modes:
    assistant:
      enabled: true
    planning:
      enabled: true
    developer:
      enabled: true
    tool:
      enabled: true
    debugger:
      enabled: true
    security:
      enabled: true
    reviewer:
      enabled: true
    performance:
      enabled: true
```

---

## Testing Strategy

### Unit Tests
- Context Analyzer keyword detection
- Mode confidence scoring
- Tool filtering logic
- Mode transition validation
- Hysteresis timing

### Integration Tests
- Mode switching flow
- Tool execution with filtering
- HotSwap integration
- UI state updates
- Prompt building

### Manual Testing
- Test all 8 modes
- Test mode transitions
- Test tool restrictions
- Test UI display
- Test commands

---

**Status:** Design complete, ready for review
