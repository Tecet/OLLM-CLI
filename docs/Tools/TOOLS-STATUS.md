# Tools Status Summary

**Last Updated:** January 23, 2026  
**Version:** v0.1.0

## Overview

All discrepancies from the initial audit have been resolved. This document provides the current status of all tools in the OLLM CLI system.

---

## Status Summary

### ✅ Issue 1: Tool ID Mismatch - RESOLVED

All tool IDs in the UI now use the correct format (underscores instead of hyphens).

**Corrected Tool IDs:**
- `read_file` (was: read-file)
- `read_many_files` (was: read-multiple-files)
- `edit_file` (was: edit-file)
- `write_file` (was: write-file)
- `ls` (was: list-directory)
- `web_search` (was: search-web)
- `web_fetch` (was: fetch-web)
- `shell` (was: execute-shell)
- `write_todos` (was: manage-todos)
- `complete_goal` (was: complete-goal)
- `create_checkpoint` (was: create-checkpoint)
- `create_goal` (was: create-goal)
- `read_reasoning` (was: read-past-reasoning)
- `record_decision` (was: record-decision)
- `switch_goal` (was: switch-goal)

### ✅ Issue 2: Missing Tools - DOCUMENTED

All tools are now visible in the UI with proper categorization:

**Previously "Missing" Tools (Now Visible):**
- `switch_goal` - Context category
- `remember` - Memory category
- `write_memory_dump` - Memory category
- `trigger_hot_swap` - Context category
- `search_documentation` - Other category

### ✅ Issue 3: Tool Registration - CORRECT ARCHITECTURE

**Search Documentation Tool:**
- Status: Correctly NOT registered in `registerBuiltInTools()`
- Reason: Requires ToolRouter (MCP integration) as runtime dependency
- Architecture: Similar to `MemoryDumpTool` and `HotSwapTool` - registered dynamically at runtime
- Action: No changes needed - this is the correct design

---

## Tool Categories and Status

### File Discovery (🔍)
| Tool | ID | Status | Version | Quick Command |
|------|-----|--------|---------|---------------|
| Find Files by Pattern | `glob` | Stable | v0.1.0 | - |
| List Directory | `ls` | Stable | v0.1.0 | `/ls` |
| Search File Contents | `grep` | Stable | v0.1.0 | - |

### File Operations (📝)
| Tool | ID | Status | Version | Quick Command |
|------|-----|--------|---------|---------------|
| Edit File | `edit_file` | Stable | v0.1.0 | - |
| Read File | `read_file` | Stable | v0.1.0 | - |
| Read Multiple Files | `read_many_files` | Stable | v0.1.0 | - |
| Write File | `write_file` | Stable | v0.1.0 | - |

### Shell (⚡)
| Tool | ID | Status | Version | Quick Command |
|------|-----|--------|---------|---------------|
| Execute Shell Command | `shell` | Stable | v0.1.0 | `/shell` |

### Memory (💾)
| Tool | ID | Status | Version | Quick Command |
|------|-----|--------|---------|---------------|
| Persistent Memory | `memory` | Stable | v0.1.0 | `/memory` |
| Remember Information | `remember` | Beta | v0.1.0 | - |
| Write Memory Dump | `write_memory_dump` | Beta | v0.1.0 | - |

### Context (🔄)
| Tool | ID | Status | Version | Quick Command |
|------|-----|--------|---------|---------------|
| Create Goal | `create_goal` | Beta | v0.1.0 | - |
| Complete Goal | `complete_goal` | Beta | v0.1.0 | - |
| Create Checkpoint | `create_checkpoint` | Beta | v0.1.0 | - |
| Record Decision | `record_decision` | Beta | v0.1.0 | - |
| Switch Goal | `switch_goal` | Beta | v0.1.0 | - |
| Read Past Reasoning | `read_reasoning` | Beta | v0.1.0 | - |
| Trigger Hot Swap | `trigger_hot_swap` | Alpha | v0.1.0 | - |

### Web (🌐)
| Tool | ID | Status | Version | Quick Command |
|------|-----|--------|---------|---------------|
| Search the Web | `web_search` | Stable | v0.1.0 | - |
| Fetch Web Content | `web_fetch` | Stable | v0.1.0 | - |

### Other (📦)
| Tool | ID | Status | Version | Quick Command |
|------|-----|--------|---------|---------------|
| Manage Todos | `write_todos` | Stable | v0.1.0 | `/todos` |
| Search Documentation | `search_documentation` | Alpha | v0.1.0 | - |

---

## Status Definitions

- **Stable** (🟢): Production-ready, fully tested, recommended for all users
- **Beta** (🟡): Functional but may have minor issues, suitable for most users
- **Alpha** (🔴): Early development, may have significant issues, use with caution

---

## Quick Commands

Tools with slash command shortcuts for faster access in chat:

- `/ls` - List directory contents
- `/shell` - Execute shell command
- `/memory` - Manage persistent memory
- `/todos` - Manage todo list

---

## System Prompt Integration

Tool usage guidance has been added to the core mandates prompt:

```
- **Tool Usage:** Proactively use available tools to gather information before making assumptions. 
  Prefer file reading tools over guessing file contents, use grep/glob for discovery, leverage 
  memory for important context, and use web search for current information about libraries and frameworks.
```

For detailed system prompt options, see `.dev/tools-audit.md` (development reference).

---

## Future Enhancements

### Planned Features
1. Tool usage analytics and metrics
2. Tool dependency visualization
3. Tool chaining suggestions
4. "Requires MCP" badges for MCP-dependent tools
5. Performance metrics (average execution time)
6. More slash commands for frequently used tools

### Under Consideration
1. Tool templates for common workflows
2. Tool favorites/bookmarks
3. Tool usage tutorials
4. Context-aware tool recommendations

---

## References

- **Tool Implementations:** `packages/core/src/tools/`
- **UI Components:** `packages/cli/src/ui/components/tools/`
- **Tool Registry:** `packages/core/src/tools/tool-registry.ts`
- **System Prompts:** `packages/core/src/prompts/templates/`
- **Development Audit:** `.dev/tools-audit.md` (not in git)

---

## Maintenance

When adding new tools:
1. Implement tool in `packages/core/src/tools/`
2. Register in `registerBuiltInTools()` or dynamically at runtime
3. Add description and usage example to `ToolsPanel.tsx`
4. Update categorization in `ToolsContext.tsx`
5. Add version and status information
6. Update this document
7. Test with multiple LLM models
8. Update system prompt if tool is critical

---

**All Issues Resolved** ✅  
**Total Tools:** 22  
**Stable Tools:** 13  
**Beta Tools:** 7  
**Alpha Tools:** 2
