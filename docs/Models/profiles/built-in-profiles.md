# Built-in Project Profiles

**Profile Specifications**

---

## TypeScript Profile

**Detection:**
- File: `package.json`
- Contains: `"typescript"` dependency

**Default Settings:**
```yaml
model: llama3.1:8b
system_prompt: |
  You are a TypeScript expert helping with a TypeScript project.
  Follow TypeScript best practices and modern patterns.
  Prioritize type safety and code quality.
  Use functional programming patterns when appropriate.

routing:
  profile: code
  preferred_families:
    - llama
    - qwen
    - codellama

tools:
  allowed:
    - read_file
    - write_file
    - shell
    - grep
    - glob
```

**Use Cases:**
- TypeScript applications
- React/Vue/Angular projects
- Node.js with TypeScript

---

## Python Profile

**Detection:**
- File: `requirements.txt` or `setup.py`

**Default Settings:**
```yaml
model: codellama:13b
system_prompt: |
  You are a Python expert helping with a Python project.
  Follow PEP 8 style guide and Python best practices.
  Write type hints and docstrings.
  Use modern Python features (3.8+).

routing:
  profile: code
  preferred_families:
    - codellama
    - deepseek-coder
    - qwen

tools:
  allowed:
    - read_file
    - write_file
    - shell
    - grep
    - glob
```

**Use Cases:**
- Python applications
- Data science projects
- Django/Flask web apps

---

## Rust Profile

**Detection:**
- File: `Cargo.toml`

**Default Settings:**
```yaml
model: codellama:13b
system_prompt: |
  You are a Rust expert helping with a Rust project.
  Follow Rust best practices and idioms.
  Prioritize safety, performance, and correctness.
  Use the borrow checker effectively.

routing:
  profile: code
  preferred_families:
    - codellama
    - deepseek-coder

tools:
  allowed:
    - read_file
    - write_file
    - shell
    - grep
    - glob
```

**Use Cases:**
- Rust applications
- Systems programming
- Performance-critical code

---

## Go Profile

**Detection:**
- File: `go.mod`

**Default Settings:**
```yaml
model: codellama:13b
system_prompt: |
  You are a Go expert helping with a Go project.
  Follow Go best practices and idioms.
  Write simple, clear, and idiomatic Go code.
  Use goroutines and channels effectively.

routing:
  profile: code
  preferred_families:
    - codellama
    - qwen

tools:
  allowed:
    - read_file
    - write_file
    - shell
    - grep
    - glob
```

**Use Cases:**
- Go applications
- Microservices
- CLI tools

---

## Documentation Profile

**Detection:**
- Directory: `docs/`

**Default Settings:**
```yaml
model: llama3.1:70b
system_prompt: |
  You are a technical writer helping with documentation.
  Write clear, concise, and well-structured documentation.
  Use proper markdown formatting.
  Include examples and code snippets.
  Organize content logically.

routing:
  profile: creative
  preferred_families:
    - llama
    - mixtral

tools:
  allowed:
    - read_file
    - write_file
    - grep
  denied:
    - shell
```

**Use Cases:**
- Technical documentation
- API documentation
- User guides

---

## Comparison Table

| Profile | Model Size | Focus | Tools | Routing |
|---------|-----------|-------|-------|---------|
| TypeScript | Medium | Type safety | Full | Code |
| Python | Medium | Best practices | Full | Code |
| Rust | Medium | Safety | Full | Code |
| Go | Medium | Simplicity | Full | Code |
| Documentation | Large | Clarity | Limited | Creative |

---

## Customization

All profiles can be customized in `.ollm/project.yaml`:

```yaml
# Start with profile
type: typescript

# Override settings
model: your-model
system_prompt: |
  Your custom prompt

routing:
  profile: your-profile
  preferred_families:
    - your-families

tools:
  allowed:
    - your-tools
```

---

## See Also

- [User Guide](user-guide.md)
- [Project Profile Service API](../api/project-profile-service.md)
- [Configuration](../Models_configuration.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
