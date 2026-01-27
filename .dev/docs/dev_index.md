# Developer Documentation Index

**Last Updated:** January 27, 2026  
**Location:** `.dev/docs/knowledgeDB/`

---

# Overview

This index provides quick access to all developer knowledge base documents. Each `dev_*.md` file captures the **logic chains, design patterns, and architectural decisions** for a specific system or feature in OLLM CLI.

---

---

# Quick Reference by Topic

### Context & Memory
- [Context Management](./knowledgeDB/dev_ContextManagement.md) - Sizing, tiers, VRAM
- [Context Compression](./knowledgeDB/dev_ContextCompression.md) - Checkpoints, snapshots
- [Context Pre-Send Validation](./knowledgeDB/dev_ContextPreSendValidation.md) - Overflow prevention
- [Context Tokeniser](./knowledgeDB/dev_ContextTokeniser.md) - Token counting system
- [Context Snapshots](./knowledgeDB/dev_ContextSnapshots.md) - Two snapshot systems
- [Context Checkpoint Aging](./knowledgeDB/dev_ContextCheckpointAging.md) - Progressive compression
- [Context Checkpoint Rollover](./knowledgeDB/dev_ContextCheckpointRollover.md) - Emergency rollover
- [Context Input Preprocessing](./knowledgeDB/dev_ContextInputPreprocessing.md) - Intent extraction

### Sessions
- [Session Storage](./knowledgeDB/dev_SessionStorage.md) - Session recording

### Prompts & Models
- [Prompt System](./knowledgeDB/dev_PromptSystem.md) - Tiers, modes, templates
- [Model Management](./knowledgeDB/dev_ModelManagement.md) - Profiles, detection
- [Model Reasoning](./knowledgeDB/dev_ModelReasoning.md) - DeepSeek R1, QwQ
- [Model Compiler](./knowledgeDB/dev_ModelCompiler.md) - Profile compilation

### Providers & Integration
- [Provider System](./knowledgeDB/dev_ProviderSystem.md) - Ollama, future providers
- [MCP Integration](./knowledgeDB/dev_MCPIntegration.md) - External tools

### Tools & Hooks
- [Tool Execution](./knowledgeDB/dev_ToolExecution.md) - Registration, permissions
- [Hook System](./knowledgeDB/dev_HookSystem.md) - Events, automation

### User Interface
- [UI Frontend](./knowledgeDB/dev_UI_Front.md) - Layout, message rendering
- [UI Menu Windows](./knowledgeDB/dev_UI_MenuWindows.md) - Dialogs, notifications
- [UI Themes](./knowledgeDB/dev_UI_Themes.md) - Color schemes
- [UI Color ASCII](./knowledgeDB/dev_UI_ColorASCII.md) - Color and ASCII art

### Commands & System
- [Slash Commands](./knowledgeDB/dev_SlashCommands.md) - 50+ commands
- [Keybinds](./knowledgeDB/dev_Keybinds.md) - 70+ shortcuts
- [Terminal](./knowledgeDB/dev_Terminal.md) - PTY, ANSI rendering

### Distribution
- [npm Package](./knowledgeDB/dev_npm_package.md) - Packaging, installer

---



# Core Systems



### Context & Memory Management

#### [dev_ContextManagement.md](./knowledgeDB/dev_ContextManagement.md)
**Context sizing, tiers, VRAM monitoring, and auto-sizing logic**

- 5 context tiers (2K, 4K, 8K, 16K, 32K, 64K, 128K)
- VRAM-aware auto-sizing (one tier below max)
- Token counting and budget tracking
- Context pool management
- Memory guard and OOM prevention
- Hardware detection and capability tiers

**Key Logic:** User selection → Profile lookup → VRAM check → Auto-size recommendation → Context budget

---

#### [dev_ContextCompression.md](./knowledgeDB/dev_ContextCompression.md)
**Compression strategies, checkpoints, snapshots, and session storage**

- Compression triggers (80% of available budget)
- Checkpoint system (3-level hierarchy)
- Checkpoint aging and merging
- Snapshot creation and rollover
- Goal preservation (never compressed)
- Model size and compression quality
- Session history storage

**Key Logic:** Budget check → Trigger compression → Create checkpoint → Age existing → Merge oldest → Preserve goals

---

#### [dev_ContextPreSendValidation.md](./knowledgeDB/dev_ContextPreSendValidation.md)
**Pre-send validation to prevent context overflow (Phase 1)**

- 4-tier threshold system (70%, 80%, 95%, 100%)
- Emergency compression at 95%
- Emergency rollover at 100%
- Token budget calculation
- Validation before sending to Ollama
- Clear user warnings

**Key Logic:** Calculate total tokens → Check thresholds → Trigger emergency actions → Validate → Send

---

#### [dev_ContextTokeniser.md](./knowledgeDB/dev_ContextTokeniser.md)
**Token counting system with caching and validation**

- Fallback estimation (text.length / 4)
- Model multipliers (GPT, Llama, Code)
- Cache management
- Validation checks
- Metrics tracking
- Performance monitoring

**Key Logic:** Check cache → Calculate if miss → Validate → Cache → Return count

---

#### [dev_ContextSnapshots.md](./knowledgeDB/dev_ContextSnapshots.md)
**Two distinct snapshot systems (Phase 5)**

- Context Snapshots (recovery & rollback)
- Mode Snapshots (mode transitions)
- Different storage locations
- Different lifecycles
- No conflicts between systems

**Key Logic:** Context: Full conversation → Persistent | Mode: Last 5 messages → Temporary

---

#### [dev_ContextCheckpointAging.md](./knowledgeDB/dev_ContextCheckpointAging.md)
**Progressive checkpoint compression (Phase 6)**

- 3-level aging (Level 3 → 2 → 1)
- Merge threshold per tier
- 50% space reduction
- Key decisions preserved
- Token count updates

**Key Logic:** Age checkpoints → Merge oldest → Preserve key info → Update tokens

---

#### [dev_ContextCheckpointRollover.md](./knowledgeDB/dev_ContextCheckpointRollover.md)
**Emergency rollover strategy**

- Snapshot creation before rollover
- Keep last 10 user messages
- Ultra-compact summary (400 tokens)
- Clear all checkpoints
- Reset context

**Key Logic:** Create snapshot → Keep recent → Compact summary → Clear → Reset

---

## Input & Session Management

#### [dev_ContextInputPreprocessing.md](./knowledgeDB/dev_ContextInputPreprocessing.md)
**Intent extraction from noisy user messages (Phase 0)**

- 30x token savings
- Typo correction
- Intent extraction
- Goal proposal with milestones
- Intent snapshots
- Dual storage (clean + original)

**Key Logic:** Raw message → Extract intent → Fix typos → Propose goal → Store both

---

#### [dev_SessionStorage.md](./knowledgeDB/dev_SessionStorage.md)
**Session recording and auto-save (Phase 4)**

- Auto-save enabled by default
- Atomic writes with fsync
- Full history preservation
- Graceful interruption handling
- No data loss

**Key Logic:** Message/tool call → Record → Atomic write → fsync → Persist

---

## Prompt & Mode System

#### [dev_PromptSystem.md](./knowledgeDB/dev_PromptSystem.md)
**Prompt structure, tiers, modes, and template management**

- 5 prompt tiers (tier1.txt through tier5.txt)
- 4 operational modes (Assistant, Developer, Planning, User)
- Tier mapping (context size → prompt tier)
- System prompt composition
- Mode switching and prompt rebuilding
- Goal management integration

**Key Logic:** Context size → Tier selection → Mode templates → SystemPromptBuilder → Final prompt

---

## Model Management

#### [dev_ModelManagement.md](./knowledgeDB/dev_ModelManagement.md)
**Model detection, profiles, tool support, and context windows**

- Model profiles (LLM_profiles.json)
- User model tracking (user_models.json)
- Tool support detection (4 precedence levels)
- Model size detection (3B to 70B+)
- Context window configuration
- Model routing profiles

**Key Logic:** Model list → Match profiles → Detect capabilities → Save metadata → Runtime learning

---

#### [dev_ModelReasoning.md](./knowledgeDB/dev_ModelReasoning.md)
**Reasoning model support (DeepSeek R1, QwQ) - Partially Implemented**

- Ollama API integration (think parameter)
- Reasoning capture and display
- Extended warmup timeout (120s)
- Post-alpha tasks:
  - Reasoning-aware context management
  - Reasoning analytics
  - Reasoning history management
  - Reasoning-specific compression

**Status:** ⚠️ Basic implementation complete, advanced features post-alpha (3-4 weeks)

---

#### [dev_ModelCompiler.md](./knowledgeDB/dev_ModelCompiler.md)
**Model profile compilation and tier detection**

- Profile compilation from LLM_profiles.json
- Dynamic tier detection
- Model capability detection
- Profile caching

**Key Logic:** Load profiles → Detect capabilities → Compile → Cache

---

## Provider & Integration

#### [dev_ProviderSystem.md](./knowledgeDB/dev_ProviderSystem.md)
**Ollama provider integration and future provider plans**

- Ollama adapter (Tier 1 - primary)
- Message format translation
- Streaming (NDJSON parsing)
- Model management (list, pull, delete)
- Ollama settings and auto-start
- Future: vLLM (Tier 2), OpenAI-compatible (Tier 3)

**Key Logic:** Request → Provider adapter → Ollama API → Stream parser → Events → UI

---

#### [dev_MCPIntegration.md](./knowledgeDB/dev_MCPIntegration.md)
**Model Context Protocol integration for external tools**

- MCP client lifecycle
- Tool discovery and schema conversion
- Tool execution flow
- OAuth 2.0 integration
- Health monitoring and auto-recovery
- Transport types (stdio, SSE, HTTP)

**Key Logic:** Connect → Discover tools → Convert schemas → Register → Execute → Monitor health

---

## Tool & Hook Systems

#### [dev_ToolExecution.md](./knowledgeDB/dev_ToolExecution.md)
**Tool registration, execution, permissions, and policy engine**

- Tool categories (file, web, shell, memory, goal)
- Tool registration (built-in, MCP, dynamic)
- Permission system (YOLO, AUTO, ASK)
- Policy engine and risk evaluation
- Output handling and truncation
- Dynamic tool registration

**Key Logic:** Register → Validate → LLM request → Check permissions → Execute → Format → Return

---

#### [dev_HookSystem.md](./knowledgeDB/dev_HookSystem.md)
**Event-driven automation and safety gates**

- Event types (fileEdited, promptSubmit, agentStop, etc.)
- Action types (askAgent, runCommand)
- Trust model (trusted vs user hooks)
- Hook planning (conditions, rate limits, priority)
- Hook protocol (JSON-RPC 2.0)
- Legacy format translation

**Key Logic:** Event → Registry filter → Planner evaluate → Runner execute → Result log

---

## User Interface

#### [dev_UI_Front.md](./knowledgeDB/dev_UI_Front.md)
**Main interface layout, message rendering, and reasoning boxes**

- Layout structure (Header, Content, Side Panel, Status Bar)
- CSS-like layout specifications
- Message rendering architecture (line-based)
- Collapsible content system
- Reasoning box behavior (3 states)
- Tab system (Tools, Hooks, Files, MCP, Settings)
- Responsive behavior

**Key Logic:** ChatContext → buildChatLines() → Text lines → Ink render | message.expanded controls collapsible content

---

#### [dev_UI_MenuWindows.md](./knowledgeDB/dev_UI_MenuWindows.md)
**Dialogs, overlays, and notification system**

- 10 dialog types (Confirmation, Input, Selection, etc.)
- Dialog Manager (stack-based, focus management)
- Form components (TextInput, Select, Checkbox, Radio)
- Dialog transitions and animations
- Notification system (toast, banner, inline)

**Key Logic:** Open dialog → Push to stack → Focus management → User interaction → Close → Pop from stack

---

#### [dev_Terminal.md](./knowledgeDB/dev_Terminal.md)
**Integrated terminal with PTY and ANSI rendering**

- Dual terminal design (Terminal 1 & 2)
- PTY integration (platform-specific shells)
- ANSI rendering (token structure, color modes)
- Terminal Context API (sendCommand, sendRawInput, etc.)
- Scrollback buffer management
- Shell tool integration
- Performance optimization

**Key Logic:** User input → PTY → Shell → xterm.js parser → ANSI tokens → React render

---

## Commands & Keybinds

#### [dev_SlashCommands.md](./knowledgeDB/dev_SlashCommands.md)
**Complete reference of 50+ slash commands**

- Commands organized by category:
  - Session, Context, Model, Mode, Provider
  - Config, MCP, Extensions, Hooks
  - Git, Review, Workflows, Templates
  - Themes, Memory, Project, Metrics
  - Reasoning, Comparison, Utility
- Command aliases and subcommands
- Usage examples
- File locations

**Post-Alpha:** Integrate into help system (4-6h)

---

#### [dev_Keybinds.md](./knowledgeDB/dev_Keybinds.md)
**Complete reference of 70+ keyboard shortcuts**

- Keybinds organized by category:
  - Tab Navigation, Layout Controls
  - Chat Interaction, Review Mode
  - Navigation, File Explorer
  - Terminal, Global Focus Management
- User configuration (~/.ollm/user_keybinds.json)
- Merge strategy and format
- Known issues and conflicts

**Post-Alpha:** Settings UI tweaks (4-6h), Integration check (4-6h), Remove hardcoded keybinds (6-8h)

---

#### [dev_UI_Themes.md](./knowledgeDB/dev_UI_Themes.md)
**Complete theme system with 6 built-in color schemes**

- 6 built-in themes:
  - Solarized Dark (default)
  - Neon Dark
  - Dracula Dark
  - Nord Dark
  - Monokai Dark
  - Solarized Dark 2
- Complete color palettes for each theme
- Theme structure (bg, text, role, status, border, diff)
- Theme commands (/theme list, use, preview)
- User settings storage (~/.ollm/settings.json)
- Theme application flow
- Usage patterns in components

**Key Logic:** Load from settings → ThemeManager → Apply to UIContext → Render with theme colors

---

#### [dev_UI_ColorASCII.md](./knowledgeDB/dev_UI_ColorASCII.md)
**Color and ASCII art system**

- Color palette management
- ASCII art rendering
- ANSI escape codes
- Terminal color support

**Key Logic:** Color codes → ANSI escape → Terminal render

---

## Packaging & Distribution

#### [dev_npm_package.md](./knowledgeDB/dev_npm_package.md)
**npm packaging strategy and installer design**

- Package structure and metadata
- Interactive postinstall script
- Ollama auto-detection and installation
- Platform-specific installation (Windows, macOS, Linux)
- Default model pulling
- User consent and configuration

**Status:** ⚠️ Planned for post-alpha (1-2 weeks)

---

## Document Organization

### File Naming Convention
- `dev_[Feature].md` - Knowledge base documents
- Located in: `.dev/docs/knowledgeDB/`

### Document Structure
Each dev_ file includes:
- **Last Updated** - Date of last modification
- **Status** - Implementation status (✅ Implemented, ⚠️ Partial, ❌ Planned)
- **Related Documents** - Cross-references
- **Overview** - High-level description
- **Key Logic Chains** - Critical data flows
- **Implementation Details** - Code locations and examples
- **Best Practices** - Usage guidelines
- **File Locations** - Relevant source files



## Related Documentation

### Backlog & Planning
- `.dev/backlog/` - Audits, bug tracking, refactoring notes
- `.dev/docs/knowledgeDB/works_todo.md` - Active task list
- `.dev/docs/knowledgeDB/works_todo_ALPHA.md` - Alpha priorities (7 days)
- `.dev/docs/knowledgeDB/ALPHA_vs_BACKLOG.md` - Alpha vs post-alpha comparison
- `.dev/docs/knowledgeDB/AUDIT_contradictions.md` - Known contradictions

### Workspace Configuration
- `.kiro/steering/` - Workspace-level rules (tech.md, structure.md, product.md)
- `package.json` - Project metadata and scripts
- `tsconfig.base.json` - TypeScript configuration

---

## Maintenance

### When to Update
- **Logic changes** - Update relevant dev_ file when data flows change
- **New features** - Create new dev_ file or update existing
- **Bug fixes** - Update if logic chain affected
- **Refactoring** - Update file locations and references

### When to Create New dev_ File
- New major feature added
- Significant architectural pattern emerges
- Complex logic chains need documentation
- Multiple components interact in non-obvious ways

### Document Lifecycle
1. **During Development** - Track in backlog, create audits
2. **After Completion** - Extract logic chains, create/update dev_ file
3. **Maintenance** - Keep dev_ files current with code changes

---

## Statistics

**Total Documents:** 24  
**Core Systems:** 13 (Context: 7, Input/Session: 2, Models: 3, Providers: 1)  
**UI Documentation:** 4  
**Commands & System:** 3  
**Tools & Hooks:** 2  
**Distribution:** 1  

**Implementation Status:**
- ✅ Fully Implemented: 20
- ⚠️ Partially Implemented: 2 (Model Reasoning, npm Package)
- ❌ Planned: 1 (npm Package - post-alpha)

**Recent Work (Phases 0-6):**
- See [SESSIONS_WORK_COMPLETE.md](./SESSIONS_WORK_COMPLETE.md) for comprehensive summary

---

**Index Maintained By:** Development Team  
**Last Review:** January 27, 2026  
**Next Review:** After alpha release

---

## Naming Convention

**Format:** `dev_CategoryTopic.md` (NO underscore between words in topic)

**Examples:**
- ✅ `dev_ContextManagement.md` (correct)
- ✅ `dev_SessionStorage.md` (correct)
- ❌ `dev_Context_Management.md` (incorrect - underscore between words)
- ❌ `dev_Session_Storage.md` (incorrect - underscore between words)
