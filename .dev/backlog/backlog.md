# OLLM CLI - Backlog

**Last Updated:** 2026-01-30

---

## High Priority

### Tools Integration
- [ ] **MCP Tool Wrapper Improvements**
  - Better error handling for MCP tool failures
  - Timeout configuration per tool
  - Retry logic for transient failures

### Context Management
- [ ] **Dynamic Context Adjustment**
  - Auto-adjust context size based on conversation complexity
  - Predictive compression before hitting limits

---

## Medium Priority

### Prompt System
- [ ] **TASK 5: Focused Files & Project Rules** (from PromptBuilderPolish)
  - Add focused files explanation to system prompt
  - Load project rules from `.ollm/ollm.md`
  - Integrate with prompt builder
  - **Priority:** Low - not critical for core functionality

### UI Improvements
- [ ] **File Explorer Enhancements**
  - Search/filter functionality
  - Recent files list
  - Favorites/bookmarks

### Testing
- [ ] **Increase Test Coverage**
  - Target: 80% coverage
  - Add integration tests for tool execution
  - Add E2E tests for common workflows

---

## Low Priority

### Documentation
- [ ] **Video Tutorials**
  - Getting started guide
  - Advanced features walkthrough
  - Tool configuration examples

### Performance
- [ ] **Optimization**
  - Profile startup time
  - Optimize context loading
  - Cache frequently used data

---

## Ideas / Future Considerations

### Multi-Model Support
- [ ] Support for multiple models in same session
- [ ] Model routing based on task type
- [ ] Cost optimization across models

### Collaboration Features
- [ ] Share sessions with team
- [ ] Export/import conversations
- [ ] Session templates

### Advanced Tools
- [ ] Code execution sandbox improvements
- [ ] Database query tools
- [ ] API testing tools

---

## Completed (Archive)

### 2026-01-30
- ✅ Template-based prompt system
- ✅ Per-mode tool configuration
- ✅ Tools UI redesign
- ✅ All 5 modes operational
- ✅ `/test prompt` improvements with colors
- ✅ Tool integration verification

### 2026-01-29
- ✅ Context compression refactor
- ✅ Session management improvements
- ✅ Snapshot system implementation

### 2026-01-28
- ✅ Context filtering
- ✅ File viewer feature
- ✅ Layout reorganization
