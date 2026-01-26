# OLLM CLI - Tools Audit

**Date:** January 23, 2026  
**Purpose:** Comprehensive audit of all tools in the system, their implementation status, descriptions, and usage examples.

---

## Tools Status Overview

| Tool Name | Tool ID | Status | Registered | UI Description | Notes |
|-----------|---------|--------|------------|----------------|-------|
| Find Files by Pattern | `glob` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| List Directory | `ls` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Search File Contents | `grep` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Search the Web | `web_search` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Edit File | `edit_file` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Read File | `read_file` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Read Multiple Files | `read_many_files` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Write File | `write_file` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Persistent Memory | `memory` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Complete Goal | `complete_goal` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Create Checkpoint | `create_checkpoint` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Create Goal | `create_goal` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Manage Todos | `write_todos` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Read Past Reasoning | `read_reasoning` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Record Decision | `record_decision` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Execute Shell Command | `shell` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |
| Fetch Web Content | `web_fetch` | ✅ Implemented | ✅ Yes | ✅ Yes | Fully functional |

### Additional Tools (Not in User's List)

| Tool Name | Tool ID | Status | Registered | UI Description | Notes |
|-----------|---------|--------|------------|----------------|-------|
| Switch Goal | `switch_goal` | ✅ Implemented | ✅ Yes | ✅ Yes | Not shown in user's list |
| Remember Information | `remember` | ✅ Implemented | ✅ Yes | ✅ Yes | Simplified memory tool |
| Write Memory Dump | `write_memory_dump` | ✅ Implemented | ⚠️ Dynamic | ✅ Yes | Registered at runtime |
| Trigger Hot Swap | `trigger_hot_swap` | ✅ Implemented | ⚠️ Dynamic | ✅ Yes | Registered at runtime |
| Search Documentation | `search_documentation` | ⚠️ Partial | ❌ No | ✅ Yes | Exists but not registered |

---

## Detailed Tool Information

### File Discovery Tools

#### 1. Find Files by Pattern (`glob`)
- **Status:** ✅ Fully Implemented
- **Category:** File Discovery
- **File:** `packages/core/src/tools/glob.ts`
- **Description:** Searches the entire codebase for files matching specific patterns using glob syntax with wildcards. Perfect for finding configuration files, source code, or any files matching a specific naming convention across your project.
- **Usage Example:** "Find all *.ts files" or "Show me all configuration files matching *.config.js"
- **Special Features:** Supports wildcards (* and **), respects .gitignore, can filter hidden files
- **Commands:** None
- **Symbols:** None

#### 2. List Directory (`ls`)
- **Status:** ✅ Fully Implemented
- **Category:** File Discovery
- **File:** `packages/core/src/tools/ls.ts`
- **Description:** Provides detailed directory listings showing files, folders, sizes, and permissions. Helps understand project structure and navigate the file system hierarchy.
- **Usage Example:** "Show me what's in the src folder" or "List all files in the current directory"
- **Special Features:** Supports recursive listing, shows file sizes and permissions
- **Commands:** `/ls` - Quick directory listing command
- **Symbols:** None

#### 3. Search File Contents (`grep`)
- **Status:** ✅ Fully Implemented
- **Category:** File Discovery
- **File:** `packages/core/src/tools/grep.ts`
- **Description:** Sophisticated text search tool that scans through file contents to find specific patterns or text using regular expressions. Essential for code analysis and refactoring tasks.
- **Usage Example:** "Search for the function definition of handleSubmit" or "Find all TODO comments"
- **Special Features:** Regular expression support, case-sensitive/insensitive search, context lines
- **Commands:** None
- **Symbols:** None

---

### File Operations Tools

#### 4. Read File (`read_file`)
- **Status:** ✅ Fully Implemented
- **Category:** File Operations
- **File:** `packages/core/src/tools/read-file.ts`
- **Description:** Reads and displays the complete contents of a single file from your workspace. Fundamental for examining source code, configuration files, and documentation.
- **Usage Example:** "Show me the contents of @src/index.ts" or "Read the package.json file"
- **Special Features:** Supports line range selection, handles large files
- **Commands:** None
- **Symbols:** `@` - Can reference files with @ symbol (e.g., @src/index.ts)

#### 5. Read Multiple Files (`read_many_files`)
- **Status:** ✅ Fully Implemented
- **Category:** File Operations
- **File:** `packages/core/src/tools/read-many-files.ts`
- **Description:** Efficiently reads multiple files at once, allowing examination of several related files simultaneously. Useful for understanding how different parts of the codebase interact.
- **Usage Example:** "Show me both the component and its test file" or "Read all configuration files"
- **Special Features:** Batch reading, maintains file context
- **Commands:** None
- **Symbols:** `@` - Can reference multiple files with @ symbol

#### 6. Edit File (`edit_file`)
- **Status:** ✅ Fully Implemented
- **Category:** File Operations
- **File:** `packages/core/src/tools/edit-file.ts`
- **Description:** Precise file editing tool that modifies specific sections using search-and-replace operations. Ensures safe, targeted changes by requiring exact text matching.
- **Usage Example:** "Change the port from 3000 to 8080 in server.ts" or "Update the function name"
- **Special Features:** Shows diff before applying, exact text matching, prevents accidental modifications
- **Commands:** None
- **Symbols:** None

#### 7. Write File (`write_file`)
- **Status:** ✅ Fully Implemented
- **Category:** File Operations
- **File:** `packages/core/src/tools/write-file.ts`
- **Description:** Creates new files or completely overwrites existing ones with new content. Essential for generating new source files and creating configuration files.
- **Usage Example:** "Create a new component file called Button.tsx" or "Generate a README.md file"
- **Special Features:** Creates directories if needed, overwrites existing files
- **Commands:** None
- **Symbols:** None

---

### Web Tools

#### 8. Search the Web (`web_search`)
- **Status:** ✅ Fully Implemented
- **Category:** Web
- **File:** `packages/core/src/tools/web-search.ts`
- **Description:** Searches the internet for current information, documentation, tutorials, and solutions to technical problems. Invaluable for up-to-date information about libraries and frameworks.
- **Usage Example:** "Search for the latest React 19 features" or "Find documentation for Express.js"
- **Special Features:** Returns multiple results with snippets, filters by relevance
- **Commands:** None
- **Symbols:** None

#### 9. Fetch Web Content (`web_fetch`)
- **Status:** ✅ Fully Implemented
- **Category:** Web
- **File:** `packages/core/src/tools/web-fetch.ts`
- **Description:** Retrieves and displays content from specific web URLs. Perfect for accessing online documentation, reading API specifications, and fetching remote configuration files.
- **Usage Example:** "Fetch the content from https://api.example.com/docs" or "Get the README from GitHub"
- **Special Features:** Handles various content types, follows redirects
- **Commands:** None
- **Symbols:** None

---

### Shell Tool

#### 10. Execute Shell Command (`shell`)
- **Status:** ✅ Fully Implemented
- **Category:** Shell
- **File:** `packages/core/src/tools/shell.ts`
- **Description:** Executes shell commands directly in your system terminal. Allows running build scripts, installing packages, running tests, managing git operations, or executing any command-line operation.
- **Usage Example:** "Run npm install" or "Execute the test suite with npm test"
- **Special Features:** Streams output, handles long-running commands, environment variable support
- **Commands:** `/shell` - Quick shell command execution
- **Symbols:** None

---

### Memory & Context Tools

#### 11. Persistent Memory (`memory`)
- **Status:** ✅ Fully Implemented
- **Category:** Memory
- **File:** `packages/core/src/tools/memory.ts`
- **Description:** Stores and retrieves important information across conversation sessions. Creates persistent memory that survives session restarts.
- **Usage Example:** "Remember that we're using TypeScript strict mode" or "Save the API endpoint URL"
- **Special Features:** Persistent storage, searchable, organized by keys
- **Commands:** `/memory` - Quick memory management
- **Symbols:** None

#### 12. Remember Information (`remember`)
- **Status:** ✅ Fully Implemented
- **Category:** Memory
- **File:** `packages/core/src/tools/remember.ts`
- **Description:** Simplified memory tool for quickly storing important facts or information. Provides an easy way to save context throughout conversations.
- **Usage Example:** "Remember that the database port is 5432" or "Store the fact that we use ESLint"
- **Special Features:** Simpler interface than full memory tool
- **Commands:** None
- **Symbols:** None

#### 13. Write Memory Dump (`write_memory_dump`)
- **Status:** ✅ Fully Implemented (Dynamic Registration)
- **Category:** Memory
- **File:** `packages/core/src/tools/MemoryDumpTool.ts`
- **Description:** Creates a comprehensive snapshot of the current conversation context and memory state. Useful for debugging, creating backups, or exporting session state.
- **Usage Example:** "Create a memory dump for debugging" or "Export the current conversation state"
- **Special Features:** Captures full context, exportable format
- **Commands:** None
- **Symbols:** None
- **Note:** Registered dynamically at runtime in ChatContext

#### 14. Read Past Reasoning (`read_reasoning`)
- **Status:** ✅ Fully Implemented
- **Category:** Context
- **File:** `packages/core/src/tools/read-reasoning.ts`
- **Description:** Retrieves and reviews previous reasoning, decisions, and thought processes from earlier in the conversation. Helps maintain context and consistency across long development sessions.
- **Usage Example:** "What was our reasoning for choosing this architecture?" or "Review the decisions made"
- **Special Features:** Accesses conversation history, maintains context
- **Commands:** None
- **Symbols:** None

---

### Goal Management Tools

#### 15. Create Goal (`create_goal`)
- **Status:** ✅ Fully Implemented
- **Category:** Context
- **File:** `packages/core/src/tools/goal-management.ts`
- **Description:** Defines a new goal or objective for the AI to work towards. Helps structure complex projects by breaking them into manageable, trackable goals.
- **Usage Example:** "Create a goal to implement user authentication" or "Add a goal for writing unit tests"
- **Special Features:** Goal tracking, hierarchical goals
- **Commands:** None
- **Symbols:** None

#### 16. Complete Goal (`complete_goal`)
- **Status:** ✅ Fully Implemented
- **Category:** Context
- **File:** `packages/core/src/tools/goal-management.ts`
- **Description:** Marks a specific goal or task as completed in your workflow. Helps track progress on multi-step projects.
- **Usage Example:** "Mark the authentication feature as complete" or "Complete the database setup goal"
- **Special Features:** Progress tracking, completion timestamps
- **Commands:** None
- **Symbols:** None

#### 17. Create Checkpoint (`create_checkpoint`)
- **Status:** ✅ Fully Implemented
- **Category:** Context
- **File:** `packages/core/src/tools/goal-management.ts`
- **Description:** Creates a snapshot of the current conversation state, allowing you to save important decision points or milestones. You can return to these checkpoints later if needed.
- **Usage Example:** "Create a checkpoint before refactoring" or "Save the current state as a milestone"
- **Special Features:** State snapshots, rollback capability
- **Commands:** None
- **Symbols:** None

#### 18. Record Decision (`record_decision`)
- **Status:** ✅ Fully Implemented
- **Category:** Context
- **File:** `packages/core/src/tools/goal-management.ts`
- **Description:** Documents important decisions made during development, including the rationale behind them. Creates a decision log for maintaining project consistency.
- **Usage Example:** "Record the decision to use PostgreSQL" or "Document why we chose this design pattern"
- **Special Features:** Decision history, rationale tracking
- **Commands:** None
- **Symbols:** None

#### 19. Switch Goal (`switch_goal`)
- **Status:** ✅ Fully Implemented
- **Category:** Context
- **File:** `packages/core/src/tools/goal-management.ts`
- **Description:** Changes focus from one goal to another, allowing management of multiple objectives and switching between different aspects of your project.
- **Usage Example:** "Switch to working on the frontend" or "Change focus to the testing goal"
- **Special Features:** Context switching, maintains goal state
- **Commands:** None
- **Symbols:** None
- **Note:** Not shown in user's visible tool list

---

### Task Management Tools

#### 20. Manage Todos (`write_todos`)
- **Status:** ✅ Fully Implemented
- **Category:** Other
- **File:** `packages/core/src/tools/write-todos.ts`
- **Description:** Manages a list of pending tasks and action items. Add, complete, or review todos to keep track of what needs to be done in your project.
- **Usage Example:** "Add a todo to fix the login bug" or "Show me all pending todos"
- **Special Features:** Persistent todo list, completion tracking, priority support
- **Commands:** `/todos` - Quick todo management
- **Symbols:** None

---

### Advanced Tools

#### 21. Trigger Hot Swap (`trigger_hot_swap`)
- **Status:** ✅ Fully Implemented (Dynamic Registration)
- **Category:** Other
- **File:** `packages/core/src/tools/HotSwapTool.ts`
- **Description:** Dynamically switches between different AI models or configurations during a conversation. Allows leveraging different model capabilities for different tasks without restarting.
- **Usage Example:** "Switch to a faster model for simple tasks" or "Use a more capable model for complex reasoning"
- **Special Features:** Mid-conversation model switching, preserves context
- **Commands:** None
- **Symbols:** None
- **Note:** Registered dynamically at runtime in ChatContext

#### 22. Search Documentation (`search_documentation`)
- **Status:** ⚠️ Partially Implemented
- **Category:** Other
- **File:** `packages/core/src/tools/semantic-tools.ts`
- **Description:** Searches through project documentation and indexed content using semantic search. Helps find relevant information in large documentation sets by understanding query meaning.
- **Usage Example:** "Search the docs for authentication examples" or "Find information about API endpoints"
- **Special Features:** Semantic search, RAG integration
- **Commands:** None
- **Symbols:** None
- **Note:** Tool exists but is NOT registered in registerBuiltInTools() - needs to be added

---

## Cross-Check with UI Descriptions

### Tools with Descriptions in ToolsPanel.tsx

✅ All 22 tools have descriptions  
✅ All descriptions use correct tool IDs (underscores, not hyphens)  
✅ All tools have usage examples  
✅ All tools have version and status information
✅ Tools with slash commands show Quick Commands section

### Status Summary

**Issue 1: Tool ID Mismatch** - ✅ RESOLVED
- All tool IDs in ToolsPanel.tsx now use correct format (underscores)
- Descriptions properly reference: read_file, read_many_files, edit_file, write_file, ls, web_search, web_fetch, shell, write_todos, complete_goal, create_checkpoint, create_goal, read_reasoning, record_decision, switch_goal

**Issue 2: Missing from User's List** - ✅ DOCUMENTED
- Switch Goal (`switch_goal`) - ✅ Implemented, shown in UI under Context category
- Remember Information (`remember`) - ✅ Implemented, shown in UI under Memory category
- Write Memory Dump (`write_memory_dump`) - ✅ Implemented, shown in UI under Memory category
- Trigger Hot Swap (`trigger_hot_swap`) - ✅ Implemented, shown in UI under Context category
- Search Documentation (`search_documentation`) - ⚠️ Partially implemented, shown in UI under Other category

**Issue 3: Not Registered** - ✅ CORRECT BEHAVIOR
- Search Documentation (`search_documentation`) exists in `packages/core/src/tools/semantic-tools.ts` but is NOT registered in `registerBuiltInTools()`
- **Reason:** This tool requires ToolRouter (MCP integration) as a runtime dependency, similar to MemoryDumpTool and HotSwapTool
- **Status:** Correctly not registered in built-in tools - should be registered dynamically at runtime when MCP is available
- **Action:** No action needed - this is the correct architecture

---

## Remaining Action Items

### High Priority
1. ✅ **All tool IDs corrected** - Completed
2. ✅ **All tools documented** - Completed
3. ✅ **Version and status added** - Completed
4. ✅ **Search Documentation architecture** - Correct as-is (runtime registration)

### Medium Priority
5. ⚠️ Consider adding "Requires MCP" badge for tools that need MCP integration
6. ⚠️ Add tool usage analytics to track which tools are most used
7. ⚠️ Consider adding tool dependencies display (e.g., "Requires: MCP Server")

### Low Priority
8. ⚠️ Add more slash commands for frequently used tools
9. ⚠️ Consider adding tool chaining suggestions (e.g., "Works well with: grep, read_file")
10. ⚠️ Add tool performance metrics (average execution time)

---

## Summary

**Total Tools Implemented:** 22  
**Tools in User's List:** 17  
**Fully Functional:** 22  
**Partially Implemented:** 1 (search_documentation - not registered)  
**Under Development:** 0  
**Tools with UI Descriptions:** 22  
**Tool ID Mismatches:** 15 (need to be fixed)

All tools from the user's list are fully implemented and functional. The main issue is that the UI descriptions use incorrect tool IDs (hyphens instead of underscores), which needs to be corrected.

---

## System Prompt Integration Options

This section documents various approaches for integrating tool guidance into system prompts to improve LLM tool usage.

### Option 1: Brief Mandate (IMPLEMENTED)

**Location:** `packages/core/src/prompts/templates/mandates.ts`

**Content:**
```
- **Tool Usage:** Proactively use available tools to gather information before making assumptions. Prefer file reading tools over guessing file contents, use grep/glob for discovery, leverage memory for important context, and use web search for current information about libraries and frameworks.
```

**Pros:**
- Concise and doesn't bloat the system prompt
- Encourages proactive tool usage
- Fits naturally with other mandates
- Low token cost (~50 tokens)

**Cons:**
- Doesn't provide specific tool guidance
- No category-specific instructions
- Assumes LLM knows tool capabilities

**Best for:** General-purpose usage, keeping prompts lean

---

### Option 2: Detailed Tools Section

**Location:** Could be added to `SystemPromptBuilder` as optional section

**Content:**
```markdown
# Available Tools

You have access to the following tool categories:

## File Discovery (🔍)
- **glob**: Find files by pattern (*.ts, **/*.config.js)
- **grep**: Search file contents with regex
- **ls**: List directory contents
Use these to explore the codebase before making changes.

## File Operations (📝)
- **read_file**: Read single file contents
- **read_many_files**: Read multiple files at once
- **edit_file**: Make precise edits with search-replace
- **write_file**: Create or overwrite files
Always read files before editing. Use edit_file for targeted changes.

## Shell (⚡)
- **shell**: Execute terminal commands
Use for running tests, installing packages, git operations.

## Memory (💾)
- **memory**: Store/retrieve persistent information
- **remember**: Quick fact storage
- **write_memory_dump**: Create session snapshots
Use memory to save important decisions and context.

## Context (🔄)
- **create_goal**: Define new objectives
- **complete_goal**: Mark goals as done
- **create_checkpoint**: Save progress points
- **record_decision**: Document important choices
- **switch_goal**: Change focus between goals
- **read_reasoning**: Review past decisions
- **trigger_hot_swap**: Switch AI models
Use these to manage complex multi-step projects.

## Web (🌐)
- **web_search**: Search internet for current info
- **web_fetch**: Retrieve content from URLs
Use web_search for library docs, API references, latest versions.

## Other (📦)
- **write_todos**: Manage task lists
- **search_documentation**: Semantic doc search
```

**Pros:**
- Comprehensive tool overview
- Category-based organization
- Specific usage guidance
- Helps LLM understand tool relationships

**Cons:**
- High token cost (~400-500 tokens)
- May be redundant with tool schemas
- Requires maintenance when tools change

**Best for:** Complex projects, new users, when tool usage is critical

---

### Option 3: Category-Specific Hints

**Location:** Could be injected based on detected project type

**Content:**
```markdown
# Tool Usage Hints

For this TypeScript project:
- Use grep to find function/class definitions
- Use glob to locate test files (*.test.ts, *.spec.ts)
- Use read_many_files to review related components
- Use web_search for TypeScript/React documentation
- Use memory to track architectural decisions
```

**Pros:**
- Context-aware guidance
- Lower token cost (~100 tokens)
- Relevant to current project
- Can be dynamic based on project type

**Cons:**
- Requires project detection logic
- May miss general tool capabilities
- Needs templates for each project type

**Best for:** Project-specific workflows, language-specific patterns

---

### Option 4: Tool Usage Examples

**Location:** Could be added as a separate prompt template

**Content:**
```markdown
# Tool Usage Patterns

**Before editing files:**
1. Use glob/grep to find relevant files
2. Use read_file to examine current content
3. Use edit_file for targeted changes
4. Verify changes with grep

**For research tasks:**
1. Use web_search for current information
2. Use web_fetch for specific documentation
3. Use memory to save important findings

**For complex projects:**
1. Use create_goal to define objectives
2. Use create_checkpoint at milestones
3. Use record_decision for important choices
4. Use read_reasoning to review past work
```

**Pros:**
- Teaches workflow patterns
- Shows tool combinations
- Practical examples
- Medium token cost (~200 tokens)

**Cons:**
- May be too prescriptive
- Doesn't cover all scenarios
- Could limit creativity

**Best for:** Teaching best practices, workflow optimization

---

### Option 5: Minimal Tool Hints

**Location:** Single line in mandates or identity

**Content:**
```
Use available tools proactively: read before editing, search before assuming, remember important context.
```

**Pros:**
- Extremely concise (~20 tokens)
- Covers key principles
- Minimal prompt bloat

**Cons:**
- Very general
- No specific tool guidance
- Assumes LLM knowledge

**Best for:** Token-constrained scenarios, experienced users

---

### Option 6: Tool Categories Only

**Location:** Could be added to system prompt header

**Content:**
```markdown
# Available Tool Categories
- File Discovery (glob, grep, ls)
- File Operations (read, write, edit)
- Shell (command execution)
- Memory (persistent storage)
- Context (goals, decisions, reasoning)
- Web (search, fetch)
```

**Pros:**
- Very concise (~50 tokens)
- Shows tool organization
- Helps with tool discovery

**Cons:**
- No usage guidance
- Minimal detail
- Requires LLM to infer usage

**Best for:** Quick reference, tool discovery

---

## Recommendations

### Current Implementation
✅ **Option 1** is currently implemented in the mandates prompt.

### Recommended Additions

1. **For Production:** Keep Option 1 (current implementation)
   - Provides good balance of guidance vs. token cost
   - Encourages proactive tool usage without being prescriptive

2. **For Power Users:** Consider adding Option 6 as optional
   - Can be toggled via configuration
   - Helps with tool discovery
   - Minimal token overhead

3. **For Specific Projects:** Implement Option 3 dynamically
   - Detect project type (TypeScript, Python, etc.)
   - Inject relevant tool hints
   - Use project profiles to customize

4. **For Documentation:** Keep Option 2 in this file
   - Reference for future prompt tuning
   - Useful for understanding tool ecosystem
   - Can be selectively copied when needed

### Future Enhancements

- **Dynamic tool hints** based on conversation context
- **Tool usage analytics** to identify underutilized tools
- **Adaptive prompts** that adjust based on LLM performance
- **Tool chaining suggestions** for common workflows
- **Context-aware tool recommendations** based on user query

---

## Testing Tool Usage

To verify LLM tool usage effectiveness:

1. **Monitor tool call frequency** - Are tools being used proactively?
2. **Check tool selection** - Is the right tool chosen for the task?
3. **Evaluate tool chaining** - Are tools combined effectively?
4. **Measure success rate** - Do tool calls achieve desired results?
5. **Track user corrections** - How often do users override tool choices?

---

## Maintenance Notes

When adding new tools:
1. Update this audit document
2. Add descriptions to ToolsPanel.tsx
3. Update categorization in ToolsContext.tsx
4. Consider updating system prompt if tool is critical
5. Add usage examples to documentation
6. Test tool with various LLM models

When modifying system prompts:
1. Test with multiple models (different sizes/capabilities)
2. Measure token cost impact
3. Verify tool usage doesn't degrade
4. Check for prompt injection vulnerabilities
5. Document changes in this file
