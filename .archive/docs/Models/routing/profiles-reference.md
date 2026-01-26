# Routing Profiles Reference

**Built-in Profile Specifications**

---

## Fast Profile

**Purpose:** Quick responses with small models

**Specifications:**
- **Preferred Families:** phi, gemma, tinyllama
- **Min Context Window:** 2048
- **Required Capabilities:** None
- **Fallback:** general

**Typical Models:**
- phi:3b
- gemma:2b
- tinyllama:1.1b

**Use Cases:**
- Quick questions
- Simple tasks
- Speed priority

---

## General Profile

**Purpose:** Balanced performance for most tasks

**Specifications:**
- **Preferred Families:** llama, mistral, qwen
- **Min Context Window:** 4096
- **Required Capabilities:** None
- **Fallback:** fast

**Typical Models:**
- llama3.1:8b
- mistral:7b
- qwen:7b

**Use Cases:**
- General questions
- Most tasks
- Default choice

---

## Code Profile

**Purpose:** Programming and code tasks

**Specifications:**
- **Preferred Families:** codellama, deepseek-coder, qwen-coder
- **Min Context Window:** 8192
- **Required Capabilities:** tools
- **Fallback:** general

**Typical Models:**
- codellama:13b
- deepseek-coder:6.7b
- qwen-coder:7b

**Use Cases:**
- Code generation
- Code review
- Debugging

---

## Creative Profile

**Purpose:** Creative writing and long-form content

**Specifications:**
- **Preferred Families:** llama, mixtral, qwen
- **Min Context Window:** 8192
- **Required Capabilities:** None
- **Fallback:** general

**Typical Models:**
- llama3.1:70b
- mixtral:8x7b
- qwen:14b

**Use Cases:**
- Creative writing
- Long-form content
- Quality priority

---

## Comparison Table

| Profile | Size | Speed | Quality | Context | Tools |
|---------|------|-------|---------|---------|-------|
| Fast | Small | ⚡⚡⚡ | ⭐⭐ | 2K | ❌ |
| General | Medium | ⚡⚡ | ⭐⭐⭐ | 4K | ✅ |
| Code | Medium | ⚡⚡ | ⭐⭐⭐⭐ | 8K | ✅ |
| Creative | Large | ⚡ | ⭐⭐⭐⭐⭐ | 8K+ | ✅ |

---

## See Also

- [User Guide](user-guide.md)
- [Development Guide](development-guide.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
