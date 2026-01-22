# Model Management Documentation

**OLLM CLI - Model Management & Routing**

Welcome to the Model Management documentation for OLLM CLI. This guide covers model lifecycle management, intelligent routing, cross-session memory, prompt templates, and project profiles.

---

## 📚 Documentation Overview

### Quick Access
- **[📑 Complete Documentation Index](Models_index.md)** - Comprehensive index with summaries

### Getting Started
- **[Getting Started Guide](getting-started.md)** - Quick start guide for model management

### Core Documentation
- **[Model Architecture](Models_architecture.md)** - Complete system architecture and design
- **[Model Commands Reference](Models_commands.md)** - Complete CLI command reference
- **[Model Configuration](Models_configuration.md)** - Configuration guide
- **[Model Compatibility](model-compatibility.md)** - Tested models and compatibility matrix

### Feature Guides
- **[Model Routing](routing/)** - Intelligent model selection
- **[Memory System](memory/)** - Cross-session memory
- **[Templates](templates/)** - Prompt templates
- **[Project Profiles](profiles/)** - Project-specific configuration

---

## 🚀 Quick Links

### For Users
- [Getting Started](getting-started.md) - Start here
- [Model Commands](Models_commands.md) - Command reference
- [Using Memory](memory/user-guide.md) - Persistent context
- [Using Templates](templates/user-guide.md) - Reusable prompts
- [Project Profiles](profiles/user-guide.md) - Project configuration

### For Developers
- [Model Architecture](Models_architecture.md) - System design
- [Routing System](routing/development-guide.md) - Custom routing
- [API Reference](api/) - API documentation

---

## 🎯 What is Model Management?

The **Model Management** system provides comprehensive control over LLM models and their usage in OLLM CLI:

### 1. **Model Lifecycle**
Complete model management operations:
- List available models
- Pull (download) new models
- Delete unused models
- View model information
- Keep models loaded for faster responses

### 2. **Intelligent Routing**
Automatic model selection based on task type:
- Fast profile (quick responses)
- General profile (balanced performance)
- Code profile (code generation)
- Creative profile (writing tasks)

### 3. **Cross-Session Memory**
Persistent context across sessions:
- Store facts and preferences
- Automatic injection into prompts
- LLM-initiated memory storage
- Search and manage memories

### 4. **Prompt Templates**
Reusable prompts with variables:
- Variable substitution
- Default values
- Required variables
- User and workspace templates

### 5. **Project Profiles**
Auto-detect and apply project settings:
- TypeScript, Python, Rust, Go detection
- Project-specific models
- Custom system prompts
- Tool restrictions

---

## 📖 Documentation Structure

```
docs/Models/
├── README.md                    ← You are here
├── getting-started.md           Quick start guide
├── Models_architecture.md       System architecture
├── Models_commands.md           CLI commands
├── Models_configuration.md      Configuration guide
├── routing/                     Model routing docs
│   ├── README.md
│   ├── user-guide.md
│   ├── development-guide.md
│   └── profiles-reference.md
├── memory/                      Memory system docs
│   ├── README.md
│   ├── user-guide.md
│   └── api-reference.md
├── templates/                   Template system docs
│   ├── README.md
│   ├── user-guide.md
│   └── template-reference.md
├── profiles/                    Project profiles docs
│   ├── README.md
│   ├── user-guide.md
│   └── built-in-profiles.md
└── api/                         API reference
    ├── README.md
    ├── model-management-service.md
    ├── model-router.md
    ├── memory-service.md
    ├── template-service.md
    └── project-profile-service.md
```

---

## 🎓 Learning Path

### Beginner
1. Read [Getting Started](getting-started.md)
2. Try [Model Commands](Models_commands.md)
3. Explore [Using Memory](memory/user-guide.md)
4. Use [Templates](templates/user-guide.md)

### Intermediate
1. Understand [Model Architecture](Models_architecture.md)
2. Configure [Model Routing](routing/user-guide.md)
3. Set up [Project Profiles](profiles/user-guide.md)
4. Customize [Configuration](Models_configuration.md)

### Advanced
1. Create [Custom Routing](routing/development-guide.md)
2. Build [Template Libraries](templates/template-reference.md)
3. Study [API Reference](api/)

---

## 🔑 Key Concepts

### Model Management Service
Core component for model lifecycle operations.

**Features:**
- List, pull, delete, inspect models
- Keep-alive management
- Progress tracking
- Cache management
- Error handling

**See:** [Model Architecture](Models_architecture.md#model-management-service)

### Model Router
Intelligent model selection based on task profiles.

**Features:**
- Profile-based selection
- Preferred family matching
- Fallback chains
- Configuration overrides
- Capability filtering

**See:** [Routing Guide](routing/)

### Memory Service
Persistent context across sessions.

**Features:**
- Store facts and preferences
- Automatic prompt injection
- Token budget management
- LLM-initiated storage
- Search and categorization

**See:** [Memory Guide](memory/)

### Template Service
Reusable prompts with variable substitution.

**Features:**
- YAML template format
- Variable substitution
- Default values
- Required validation
- User and workspace templates

**See:** [Templates Guide](templates/)

### Project Profile Service
Auto-detect and apply project-specific settings.

**Features:**
- File-based detection
- Built-in profiles
- Custom overrides
- Settings precedence
- Project initialization

**See:** [Profiles Guide](profiles/)

---

## 💡 Common Use Cases

### Manage Models
```bash
# List available models
/model list

# Download a model
/model pull llama3.1:8b

# View model details
/model info llama3.1:8b

# Keep model loaded
/model keep llama3.1:8b

# Delete unused model
/model delete old-model:7b
```

**Learn more:** [Model Commands](Models_commands.md)

### Use Intelligent Routing
```yaml
# Enable routing in config
model:
  routing:
    enabled: true
    defaultProfile: general
    overrides:
      code: deepseek-coder:6.7b
```

**Learn more:** [Routing Guide](routing/user-guide.md)

### Store Memories
```bash
# Add a memory
/memory add user_name Alice

# List memories
/memory list

# Search memories
/memory search project

# Forget a memory
/memory forget old_preference
```

**Learn more:** [Memory Guide](memory/user-guide.md)

### Use Templates
```bash
# List templates
/template list

# Use a template
/template use code_review language=TypeScript code="..."

# Create a template
/template create my_template
```

**Learn more:** [Templates Guide](templates/user-guide.md)

### Configure Project Profiles
```bash
# Auto-detect project type
/project detect

# Use a specific profile
/project use typescript

# Initialize project config
/project init
```

**Learn more:** [Profiles Guide](profiles/user-guide.md)

---

## 🛠️ Configuration

### Model Settings
```yaml
model:
  default: llama3.1:8b
  routing:
    enabled: true
    defaultProfile: general
  keepAlive:
    enabled: true
    models:
      - llama3.1:8b
    timeout: 300
```

### Generation Options
```yaml
options:
  temperature: 0.7
  maxTokens: 4096
  topP: 0.9
  numCtx: 8192
```

### Memory Settings
```yaml
memory:
  enabled: true
  tokenBudget: 500
```

### Template Directories
```yaml
templates:
  directories:
    - ~/.ollm/templates
    - .ollm/templates
```

**Learn more:** [Configuration Guide](Models_configuration.md)

---

## 🔍 Troubleshooting

### Common Issues

**Model not found:**
- Check model name: `/model list`
- Pull the model: `/model pull <name>`
- Verify provider is running

**Routing not working:**
- Check routing enabled in config
- Verify models match profile requirements
- Check configuration overrides

**Memory not persisting:**
- Check memory enabled in config
- Verify file permissions
- Check storage location: `~/.ollm/memory.json`

**Template not found:**
- List templates: `/template list`
- Check template directories
- Verify YAML syntax

**Project profile not detected:**
- Check for characteristic files
- Manually select profile: `/project use <name>`
- Initialize project: `/project init`

**See:** [Troubleshooting Guide](../troubleshooting.md)

---

## 📊 Status & Roadmap

### Implementation Status
- ✅ Model Management Service (Complete)
- ✅ Model Router (Complete)
- ✅ Memory Service (Complete)
- ✅ Template Service (Complete)
- ✅ Project Profile Service (Complete)
- ✅ CLI Commands (Complete)
- ✅ Integration Tests (Complete)

**Overall:** 100% complete

### Features
- ✅ Model lifecycle operations
- ✅ Intelligent routing
- ✅ Cross-session memory
- ✅ Prompt templates
- ✅ Project profiles
- ✅ Keep-alive management
- ✅ Model comparison
- ✅ Configuration validation

---

## 🤝 Contributing

### Documentation
- Report issues or suggest improvements
- Submit pull requests
- Add examples and tutorials

### Development
- See Development Documentation (../../.dev/Models/)
- Follow Contributing Guide (../../CONTRIBUTING.md)

---

## 📞 Support

### Resources
- [Main Documentation](../)
- [Troubleshooting](../troubleshooting.md)
- GitHub Issues (https://github.com/ollm/ollm-cli/issues)

### Community
- Discord: [Join our server](#)
- Forum: [Community forum](#)
- Twitter: [@ollm_cli](#)

---

## 📄 License

OLLM CLI is open source software. See [LICENSE](../../LICENSE) for details.

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0  
**Status:** Complete

