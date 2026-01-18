# Context Management Documentation

**OLLM CLI - Context Management System**

---

## 📚 Documentation Overview

### Quick Access
- **[📑 Getting Started](getting-started.md)** - Quick start guide
- **[⚙️ Configuration](Context_configuration.md)** - Configuration options
- **[💻 Commands](Context_commands.md)** - CLI commands reference
- **[🏗️ Architecture](Context_architecture.md)** - System architecture

### Feature Guides
- **[📊 Management](management/)** - Context management guides
- **[📈 Monitoring](monitoring/)** - VRAM and memory monitoring
- **[🔌 API Reference](api/)** - Developer API documentation

---

## 🎯 What is Context Management?

Context Management is OLLM CLI's intelligent system for handling conversation memory efficiently. It ensures your local LLM can maintain long conversations without running out of GPU memory (VRAM) or hitting token limits.

### Key Features

**🔄 Dynamic Context Sizing**
- Automatically adjusts context window based on available VRAM
- Maximizes usable context without crashing
- Supports manual size configuration

**📸 Snapshot System**
- Save conversation checkpoints
- Restore previous conversation states
- Automatic snapshots at thresholds
- Rolling cleanup of old snapshots

**🗜️ Intelligent Compression**
- Multiple compression strategies (truncate, summarize, hybrid)
- Preserves recent messages
- LLM-based summarization
- Inflation guard prevents token bloat

**🛡️ Memory Safety**
- Real-time VRAM monitoring
- Automatic emergency actions
- Prevents out-of-memory crashes
- Configurable safety thresholds

**⚡ JIT Discovery**
- Automatically loads project context
- Traverses workspace for `.md` files
- Injects relevant context dynamically

---

## 📖 Documentation Structure

```
docs/Context/
├── README.md                    ← You are here
├── getting-started.md           Quick start guide
├── Context_architecture.md      System architecture
├── Context_configuration.md     Configuration guide
├── Context_commands.md          CLI commands
├── management/                  Context management
│   ├── README.md
│   ├── user-guide.md
│   ├── snapshots.md
│   └── compression.md
├── monitoring/                  VRAM & memory
│   ├── README.md
│   ├── vram-monitoring.md
│   └── memory-safety.md
└── api/                         API reference
    ├── README.md
    ├── context-manager.md
    ├── snapshot-manager.md
    └── compression-service.md
```

---

## 🎓 Learning Path

### Beginner
1. Read [Getting Started](getting-started.md)
2. Try [Basic Commands](Context_commands.md#basic-commands)
3. Configure [Auto-Sizing](Context_configuration.md#auto-sizing)

### Intermediate
1. Learn [Snapshot System](management/snapshots.md)
2. Configure [Compression](management/compression.md)
3. Monitor [VRAM Usage](monitoring/vram-monitoring.md)

### Advanced
1. Study [Architecture](Context_architecture.md)
2. Explore [API Reference](api/)
3. Implement [Custom Strategies](api/compression-service.md#custom-strategies)

---

## 🚀 Quick Start

### Check Context Status
```bash
/context
```

Output:
```
┌─ Context Status ─────────────────────────────────────┐
│ Model: llama3.1:8b                                   │
│ Context: 12,847 / 32,768 tokens (39%)               │
│ VRAM: 6.2 / 8.0 GB (77%)                            │
│ Auto-size: enabled                                   │
│ Snapshots: 3 available                               │
└──────────────────────────────────────────────────────┘
```

### Enable Auto-Sizing
```bash
/context auto
```

### Create Snapshot
```bash
/context snapshot
```

### Compress Context
```bash
/context compress
```

**Learn more:** [Getting Started Guide](getting-started.md)

---

## 💡 Common Use Cases

### Long Conversations
**Problem:** Conversation exceeds token limit  
**Solution:** Enable automatic compression and snapshots

```yaml
# ~/.ollm/config.yaml
context:
  compression:
    enabled: true
    strategy: hybrid
  snapshots:
    enabled: true
    autoCreate: true
```

**Learn more:** [Compression Guide](management/compression.md)

### Limited VRAM
**Problem:** GPU runs out of memory  
**Solution:** Enable auto-sizing with safety buffer

```yaml
# ~/.ollm/config.yaml
context:
  autoSize: true
  vramBuffer: 512  # MB
```

**Learn more:** [VRAM Monitoring](monitoring/vram-monitoring.md)

### Project Context
**Problem:** Need project-specific instructions  
**Solution:** Use JIT Discovery with `.md` files

Create `.ollm.md` in your project root with instructions.

**Learn more:** [User Guide](management/user-guide.md#jit-discovery)

---

## 🔧 Configuration

### Basic Configuration

```yaml
# ~/.ollm/config.yaml
context:
  targetSize: 16384      # Target context size
  autoSize: true         # Enable auto-sizing
  vramBuffer: 512        # Safety buffer (MB)
  
  compression:
    enabled: true
    strategy: hybrid     # truncate, summarize, or hybrid
    threshold: 0.8       # Trigger at 80%
  
  snapshots:
    enabled: true
    maxCount: 5
    autoCreate: true
```

**Learn more:** [Configuration Guide](Context_configuration.md)

---

## 📊 Features by Category

### Context Management
- [User Guide](management/user-guide.md) - Manual context management
- [Snapshots](management/snapshots.md) - Checkpoint system
- [Compression](management/compression.md) - Size optimization

### Monitoring
- [VRAM Monitoring](monitoring/vram-monitoring.md) - GPU memory tracking
- [Memory Safety](monitoring/memory-safety.md) - OOM prevention

### API
- [Context Manager](api/context-manager.md) - Main API
- [Snapshot Manager](api/snapshot-manager.md) - Snapshot API
- [Compression Service](api/compression-service.md) - Compression API

---

## 🐛 Troubleshooting

### Out of Memory Errors
**Symptoms:** GPU crashes, OOM errors  
**Solutions:**
1. Enable auto-sizing: `/context auto`
2. Reduce target size: `/context size 8192`
3. Increase VRAM buffer in config

**Learn more:** [Memory Safety](monitoring/memory-safety.md)

### Context Overflow
**Symptoms:** "Context length exceeded" errors  
**Solutions:**
1. Enable compression: Configure in settings
2. Create snapshot: `/context snapshot`
3. Clear old context: `/context clear`

**Learn more:** [User Guide](management/user-guide.md#troubleshooting)

### Slow Performance
**Symptoms:** Slow responses, high memory usage  
**Solutions:**
1. Use truncate strategy (faster than summarize)
2. Reduce preserve recent tokens
3. Disable auto-snapshots

**Learn more:** [Configuration Guide](Context_configuration.md#performance-tuning)

---

## 📚 Related Documentation

### OLLM CLI Documentation
- [Main README](../../README.md) - OLLM CLI overview
- [Configuration](../configuration.md) - General configuration
- [Troubleshooting](../troubleshooting.md) - Common issues

### Technical Documentation
- [Architecture](Context_architecture.md) - System design
- [API Reference](api/) - Developer documentation

---

## 🤝 Contributing

Want to improve Context Management documentation?

1. Read Contributing Guide (../../CONTRIBUTING.md)
2. Check Documentation Tracking (.dev/Context/CONTEXT_docs.md)
3. Submit pull requests

---

## 📞 Support

### Questions About Context Management
- Check [Getting Started](getting-started.md)
- Review [Troubleshooting](#troubleshooting)
- See [Configuration Guide](Context_configuration.md)

### Technical Questions
- Study [Architecture](Context_architecture.md)
- Review [API Reference](api/)
- Check code in `packages/core/src/context/`

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0  
**Status:** ✅ Complete
