# Subagent Assignment Guide

This guide provides recommendations for distributing work among coding subagents based on skill requirements and dependencies.

## Team Structure Recommendations

### Option A: 3 Subagents (Sequential with Overlap)

| Agent   | Stages          | Focus Area                                 |
| ------- | --------------- | ------------------------------------------ |
| Agent 1 | 01, 02, 07      | Foundation, Core Runtime, Model Management |
| Agent 2 | 03, 04, 04b, 05 | Tools, Services, Context, Extensions       |
| Agent 3 | 06, 08, 09      | CLI/UI, Testing, Documentation             |

**Timeline**: ~14-17 days with overlap

### Option B: 4 Subagents (Maximum Parallelism)

| Agent   | Stages         | Focus Area                    |
| ------- | -------------- | ----------------------------- |
| Agent 1 | 01, 02         | Foundation, Core Runtime      |
| Agent 2 | 03             | Tool System                   |
| Agent 3 | 04, 04b, 05    | Services, Context, Extensions |
| Agent 4 | 06, 07, 08, 09 | CLI/UI, Testing, Docs         |

**Timeline**: ~12-14 days with parallelism

### Option C: 2 Subagents (Minimal Team)

| Agent   | Stages              | Focus Area                               |
| ------- | ------------------- | ---------------------------------------- |
| Agent 1 | 01, 02, 03, 04, 04b | Backend (Core, Tools, Services, Context) |
| Agent 2 | 05, 06, 07, 08, 09  | Frontend (Extensions, UI, Release)       |

**Timeline**: ~20-25 days

---

## Skill Requirements by Stage

### Stage 01: Foundation

- **Skills**: npm workspaces, TypeScript config, esbuild, ESLint
- **Complexity**: Low
- **Good for**: Any agent, good starting point

### Stage 02: Core Runtime

- **Skills**: TypeScript, async iterators, streaming, API design
- **Complexity**: High
- **Good for**: Experienced TypeScript developer

### Stage 03: Tool System

- **Skills**: File system APIs, shell execution, schema validation
- **Complexity**: High
- **Good for**: Systems-oriented developer

### Stage 04: Services

- **Skills**: State management, file I/O, data persistence
- **Complexity**: Medium
- **Good for**: Backend-focused developer

### Stage 04b: Context Management

- **Skills**: GPU APIs, memory management, compression algorithms
- **Complexity**: High
- **Good for**: Systems/performance-oriented developer

### Stage 05: Hooks & Extensions

- **Skills**: Plugin architecture, IPC, MCP protocol
- **Complexity**: High
- **Good for**: Architecture-minded developer

### Stage 06: CLI & UI

- **Skills**: React, Ink, terminal UI, CLI parsing
- **Complexity**: High
- **Good for**: Frontend/UI developer

### Stage 07: Model Management

- **Skills**: API integration, routing logic
- **Complexity**: Medium
- **Good for**: Any agent

### Stage 08: Testing

- **Skills**: Vitest, testing patterns, mocking
- **Complexity**: Medium
- **Good for**: QA-focused developer

### Stage 09: Documentation

- **Skills**: Technical writing, packaging, npm publish
- **Complexity**: Low
- **Good for**: Any agent, good finishing task

---

## Handoff Points

### Stage 01 → Stage 02

- **Deliverables**: Working build, lint, test scripts
- **Verification**: `npm run build` succeeds

### Stage 02 → Stages 03/04

- **Deliverables**: Provider interfaces, ChatClient, Turn
- **Verification**: Can stream text from mock provider

### Stages 03/04 → Stage 04b

- **Deliverables**: Tool registry, basic services
- **Verification**: Tools execute, sessions save

### Stage 04b → Stage 05

- **Deliverables**: Context manager, snapshots, compression
- **Verification**: Context auto-sizes, snapshots work

### Stage 05 → Stage 06

- **Deliverables**: Hooks, extensions, MCP client
- **Verification**: Hooks fire, MCP tools appear

### Stage 06 → Stage 07

- **Deliverables**: Working CLI and TUI
- **Verification**: Interactive chat works

### Stage 07 → Stage 08

- **Deliverables**: Model management, routing
- **Verification**: Can list/pull models

### Stage 08 → Stage 09

- **Deliverables**: Test suite, compatibility matrix
- **Verification**: Tests pass

---

## Communication Protocol

### Daily Sync Points

1. **Start of day**: Share current task and blockers
2. **End of day**: Share completed tasks and handoffs

### Handoff Checklist

- [ ] All tasks in stage completed
- [ ] Tests pass
- [ ] Code committed and pushed
- [ ] Brief summary of implementation decisions
- [ ] Known issues or TODOs documented

### Blocking Issues

- If blocked on dependency from another agent:
  1. Document the blocker clearly
  2. Work on non-blocked tasks if possible
  3. Escalate if blocking for >4 hours

---

## Task Breakdown by Agent (Option A)

### Agent 1: Core Infrastructure

**Week 1**:

- S01-T01: Workspace setup
- S01-T02: TypeScript config
- S01-T03: Build pipeline
- S01-T04: Lint and format
- S01-T05: Base CLI entry
- S02-T01: Provider registry
- S02-T02: Chat runtime

**Week 2**:

- S02-T03: Tool call loop
- S02-T04: Local provider adapter
- S02-T05: ReAct fallback
- S02-T06: Token estimation
- S07-T01: Model management service
- S07-T02: Model routing
- S07-T03: Model limits
- S07-T04: Options schema

### Agent 2: Tools & Extensions

**Week 1**:

- S03-T01: Tool registry
- S03-T02: File tools
- S03-T03: Shell tool
- S03-T04: Web tools
- S03-T05: Policy engine
- S03-T06: Output handling

**Week 2**:

- S03-T03: Shell tool
- S03-T04: Web tools
- S03-T05: Policy engine
- S03-T06: Output handling
- S04-T01: Session recording
- S04-T02: Chat compression
- S04-T03: Loop detection
- S04-T04: Context manager
- S04-T05: File discovery
- S04-T06: Environment sanitization

**Week 3**:

- S04b-T01: VRAM monitor
- S04b-T02: Token counter
- S04b-T03: Context pool
- S04b-T04: Snapshot storage
- S04b-T05: Snapshot manager
- S04b-T06: Compression service
- S04b-T07: Memory guard
- S04b-T08: /context command
- S05-T01: Hook system
- S05-T02: Hook trust
- S05-T03: Extension manager
- S05-T04: MCP client

### Agent 3: UI & Release

**Week 3**:

- S06-T01: Config loader
- S06-T02: Non-interactive runner
- S06-T03: Interactive UI
- S06-T04: Model UI

**Week 4**:

- S08-T01: Unit tests
- S08-T02: Integration tests
- S08-T03: UI tests
- S08-T04: Compatibility matrix
- S09-T01: Documentation
- S09-T02: Packaging
- S09-T03: Release checklist

---

## Risk Mitigation

### High-Risk Areas

1. **Stage 02 (Core Runtime)**: Complex async streaming
   - Mitigation: Start early, allocate extra time
2. **Stage 04b (Context Management)**: GPU memory APIs vary by vendor
   - Mitigation: Build abstraction layer, test on multiple GPUs
3. **Stage 05 (MCP)**: External protocol integration
   - Mitigation: Use reference implementations
4. **Stage 06 (UI)**: Terminal rendering complexity
   - Mitigation: Use Ink's built-in components

### Contingency Plans

- If Stage 02 delays: Stages 03/04 can start with mock provider
- If Stage 04b delays: Stage 05 can start with fixed context size
- If Stage 05 delays: Stage 06 can start with hooks disabled
- If Stage 08 delays: Ship with minimal tests, add later

---

## Quality Gates

Each stage must pass these gates before handoff:

1. **Code Quality**
   - Lint passes
   - TypeScript compiles without errors
   - No `any` types without justification

2. **Functionality**
   - All acceptance criteria met
   - Manual testing completed
   - Edge cases handled

3. **Documentation**
   - Public APIs documented
   - Complex logic commented
   - README updated if needed

4. **Testing**
   - Unit tests for new code
   - Integration tests where applicable
   - Coverage meets threshold
