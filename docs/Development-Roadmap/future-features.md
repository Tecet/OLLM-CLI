# Future Features - Quick Reference

> **Status:** All features listed below are **planned for future development** and are not yet implemented.

This document provides a quick reference for planned future features in OLLM CLI. 

**For detailed information, see:**
- [Development Roadmap](./future-development.md) - Complete roadmap with detailed descriptions
- [Visual Roadmap](./road_map_visual.md) - Visual timeline and dependency graphs
- [Roadmap Overview](./roadmap.md) - Overview and quick reference
- Stage Specifications (../../.kiro/specs/) - Detailed requirements and design documents

---

## Stage 10: Kraken Integration 🦑

**External LLM Provider Access**

Access powerful cloud models when local models need assistance.

**Key Capabilities:**
- Invoke CLI-based coding agents (Gemini CLI, Claude Code, Codex CLI)
- Connect to cloud APIs (OpenAI, Anthropic, Google AI)
- Auto-escalation when local models fail
- Cost tracking and budget enforcement

**Use When:** Complex reasoning, large context, specialized domains

**Spec:** `.kiro/specs/stage-10-kraken-integration-future-dev/`

---

## Stage 11: Developer Productivity Tools 🛠️

**Git Integration & Context Loading**

Aider-like workflows with version control and explicit context.

**Key Capabilities:**
- Git operations (status, commit, diff, undo)
- @-mention syntax (@file, @symbol, @url, @git:status)
- Diff review with approve/reject
- Auto-commit with semantic messages

**Use When:** Version control integration, explicit context loading, change review

**Spec:** `.kiro/specs/stage-11-developer-productivity-future-dev/`

---

## Stage 12: Cross-Platform Support 🖥️

**Windows, macOS, Linux Compatibility**

Consistent behavior across all major operating systems.

**Key Capabilities:**
- Platform-appropriate config locations
- Cross-platform GPU monitoring
- Terminal capability detection
- Path normalization

**Use When:** Using OLLM CLI on different operating systems

**Spec:** `.kiro/specs/stage-12-cross-platform-future-dev/`

---

## Stage 13: Multi-Provider Support 🔌

**vLLM & OpenAI-Compatible Backends**

Extended provider system for high-performance and universal compatibility.

**Key Capabilities:**
- vLLM provider with guided decoding
- OpenAI-compatible adapter (LM Studio, LocalAI, Kobold)
- Provider aliases and feature detection
- Backward compatible with Ollama

**Use When:** Production deployments, alternative LLM servers, guided decoding

**Spec:** `.kiro/specs/stage-13-vllm-openai-future-dev/`

---

## Stage 14: File Upload System 📁

**Share Files with LLM**

Upload images, code, and documents through the terminal interface.

**Key Capabilities:**
- Multiple upload methods (commands, clipboard, drag-drop, @mentions)
- Image processing for vision models
- Session-scoped storage with cleanup
- File deduplication

**Use When:** Sharing screenshots, uploading code files, analyzing images

**Spec:** `.kiro/specs/stage-14-file-upload-future-dev/`

---

## Stage 15: Intelligence Layer 🧠

**Advanced AI Capabilities**

Semantic search, structured output, code execution, and vision support.

**Key Capabilities:**
- Semantic codebase search with RAG
- JSON schema enforcement
- Sandboxed code execution (JS, Python, Bash)
- Vision and image analysis
- Cost tracking and templates

**Use When:** Large codebases, structured data extraction, code testing, image analysis

**Spec:** `.kiro/specs/stage-15-intelligence-layer-future-dev/`

---

## Feature Comparison Matrix

| Feature | Stage | Priority | Dependencies |
|---------|-------|----------|--------------|
| External LLM Access | 10 | High | Core features |
| Git Integration | 11 | High | Core features |
| @-Mention Context | 11 | High | Core features |
| Diff Review | 11 | High | Core features |
| Cross-Platform | 12 | Medium | Core features |
| vLLM Provider | 13 | Medium | Core features |
| OpenAI-Compatible | 13 | Medium | Core features |
| File Upload | 14 | Medium | Core features |
| Semantic Search | 15 | High | Core features |
| Structured Output | 15 | High | Core features |
| Code Execution | 15 | High | Core features |
| Vision Support | 15 | High | Core features, File Upload |

---

## Configuration Preview

### Kraken Integration (Stage 10)

```yaml
kraken:
  enabled: true
  confirmBeforeRelease: true
  autoEscalation: false
  sessionBudget: 10.00  # USD
  providers:
    - name: gemini-cli
      type: cli
      tool: gemini
      defaultModel: gemini-2.0-flash-exp
    - name: openai
      type: api
      provider: openai
      apiKey: ${OPENAI_API_KEY}
      model: gpt-4
```

### Developer Productivity (Stage 11)

```yaml
git:
  enabled: true
  includeInSystemPrompt: true
  autoCommit:
    enabled: true
    messageStyle: semantic  # semantic, descriptive, conventional

review:
  enabled: true
  showFullContext: true
  contextLines: 3
  autoApprove:
    readOperations: true
    smallChanges: false
```

### Multi-Provider (Stage 13)

```yaml
provider: vllm  # local, vllm, openai-compatible

providers:
  vllm:
    baseUrl: http://localhost:8000
    apiKey: ${VLLM_API_KEY}
  
  openai-compatible:
    baseUrl: http://localhost:1234
    backend: lmstudio  # lmstudio, localai, kobold, llamacpp, generic
```

### File Upload (Stage 14)

```yaml
uploads:
  enabled: true
  maxFileSize: 10485760  # 10MB
  maxSessionSize: 104857600  # 100MB
  retentionDays: 7
  allowedTypes:
    - image/*
    - text/*
    - application/json
```

### Intelligence Layer (Stage 15)

```yaml
codebaseIndex:
  enabled: true
  extensions: ['.ts', '.js', '.py', '.java', '.go']
  excludePatterns: ['node_modules', 'dist', '.git']

sandbox:
  enabled: true
  timeout: 30000  # 30 seconds
  allowNetwork: false
  allowFilesystem: false

costTracking:
  enabled: true
  monthlyBudgetWarning: 100.00  # USD
```

---

## Timeline

**Current Status:** Stage 9 (Documentation and Release) in progress

**Future Stages:** Timeline to be determined based on:
- Community feedback and feature requests
- Resource availability
- Technical dependencies
- User workflow priorities

---

## Contributing

Interested in implementing a planned feature? See the [Development Roadmap](./future-development.md#contributing) for contribution guidelines.

---

**Last Updated:** 2026-01-16  
**Document Version:** 1.0
