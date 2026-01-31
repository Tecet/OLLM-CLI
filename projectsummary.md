# Project Summary — OLLM CLI (Hackathon Submission)

**Project:** OLLM CLI  
**Version:** v0.1.3 (alpha)  
**Author:** tecet  
**Date:** 2026-01-31  

---

## 1) What It Is

OLLM CLI is a **local‑first command‑line interface for open‑source LLMs**. It provides a terminal UI, tool execution, hooks, and MCP integration while keeping all data on the user’s machine.

---

## 2) Why It Matters

Running LLMs locally is powerful but painful: prompt routing, context limits, and tooling quickly become brittle. OLLM CLI provides a **single, consistent workflow** for:
- managing context window size and compression,
- controlling tool access safely,
- integrating external capabilities through MCP,
- keeping sessions reproducible and reviewable.

---

## 3) Key Features (Short)

- **Interactive TUI** (React + Ink)
- **Context management** (tiers, compression, snapshots)
- **Tool system** (file, web, shell, memory) with policy gates
- **Hooks & MCP** for extensibility
- **Local‑first** by default
- **Prompt builder** (template-based, per-mode tools + skills)

---

## 4) How To Run (Quick Path)

```bash
npm install -g @tecet/ollm
ollm --version
ollm
```

---

## 5) Demo Script (60 seconds)

1. Start the CLI:
   ```bash
   ollm
   ```
2. List models:
   ```bash
   /model list
   ```
3. Ask for a quick task:
   ```
   Summarize the README and list 3 key features.
   ```
4. Switch mode:
   ```bash
   /dev
   ```
5. Ask for a file read:
   ```
   Read package.json and tell me the current version.
   ```

---

## 6) Hackathon Artifacts

- **Steering docs:** `.kiro/steering/`
- **Reusable prompts:** `.kiro/prompts/`
- **Dev diary:** `.kiro/logs/KIRO Hackaton.md`
- **Devlog:** `DEVLOG.md`
- **Demo video:** https://www.youtube.com/watch?v=XhJQ_XYVgzk

---

## 7) Roadmap (Short)

- Stabilize context system (snapshot listing + tool defaults)
- Expand docs and add demo media (partially done)
- Improve test coverage on edge cases
