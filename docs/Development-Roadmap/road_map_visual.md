# OLLM CLI - Visual Roadmap

> **Note:** This is a visual representation of the OLLM CLI development roadmap. All stages marked as "Planned" are future development and not yet implemented.

## Development Timeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OLLM CLI Development Roadmap                     │
└─────────────────────────────────────────────────────────────────────────┘

COMPLETED / IN PROGRESS
═══════════════════════════════════════════════════════════════════════════

Stage 1-8: Core Features                                    [████████████] 95%
├─ Interactive TUI (React + Ink)                           ✅ Complete
├─ Non-Interactive Mode                                    ✅ Complete
├─ Tool System (File, Shell, Web)                          ✅ Complete
├─ Policy Engine (ASK/AUTO/YOLO)                           ✅ Complete
├─ Context Management + VRAM Monitoring                    ✅ Complete
├─ Session Recording & Compression                         ✅ Complete
├─ Hook System                                             ✅ Complete
├─ MCP Integration                                         ✅ Complete
└─ Testing Infrastructure                                  ✅ Complete

Stage 9: Documentation & Release                           [████████████] 90%
├─ README.md                                               🔄 In Progress
├─ Configuration Reference                                 🔄 In Progress
├─ Troubleshooting Guide                                   🔄 In Progress
├─ Roadmap Documentation                                   ✅ Complete
├─ Package Configuration                                   🔄 In Progress
└─ Release Process                                         📋 Planned


PLANNED FUTURE DEVELOPMENT
═══════════════════════════════════════════════════════════════════════════

Stage 10: Kraken Integration                               [            ] 0%
Priority: HIGH
├─ CLI Bridge Execution                                    📋 Planned
├─ API Provider Integration                                📋 Planned
├─ Provider Discovery & Health Checks                      📋 Planned
├─ Auto-Escalation                                         📋 Planned
├─ Context Transfer                                        📋 Planned
└─ Cost Tracking & Budget Enforcement                      📋 Planned

Stage 11: Developer Productivity Tools                     [            ] 0%
Priority: HIGH
├─ Git Integration Tool                                    📋 Planned
├─ @-Mention Syntax                                        📋 Planned
├─ Context Loader                                          📋 Planned
├─ Diff Review Mode                                        📋 Planned
├─ Auto-Commit                                             📋 Planned
└─ Git Status in System Prompt                             📋 Planned

Stage 12: Cross-Platform Support                           [            ] 0%
Priority: MEDIUM
├─ Platform Detection                                      📋 Planned
├─ Configuration Path Resolution                           📋 Planned
├─ Terminal Capability Detection                           📋 Planned
├─ Cross-Platform GPU Monitoring                           📋 Planned
└─ Path Normalization                                      📋 Planned

Stage 13: Multi-Provider Support                           [            ] 0%
Priority: MEDIUM
├─ vLLM Provider                                           📋 Planned
├─ OpenAI-Compatible Provider                              📋 Planned
├─ SSE Stream Parsing                                      📋 Planned
├─ Provider Registry & Aliases                             📋 Planned
└─ Guided Decoding Support                                 📋 Planned

Stage 14: File Upload System                               [            ] 0%
Priority: MEDIUM
├─ Multiple Upload Methods                                 📋 Planned
├─ Session-Scoped Storage                                  📋 Planned
├─ File Deduplication                                      📋 Planned
├─ Image Processing                                        📋 Planned
└─ Storage Management                                      📋 Planned

Stage 15: Intelligence Layer                               [            ] 0%
Priority: HIGH
├─ Semantic Codebase Search (RAG)                          📋 Planned
├─ Structured JSON Output                                  📋 Planned
├─ Code Execution Sandbox                                  📋 Planned
├─ Vision & Image Analysis                                 📋 Planned
├─ Developer Productivity Tools                            📋 Planned
└─ Cost Tracking                                           📋 Planned
```

## Feature Dependencies

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Feature Dependency Graph                      │
└──────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │   Core Features     │
                    │   (Stages 1-8)      │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
        ┌───────────┐  ┌───────────┐  ┌───────────┐
        │  Stage 10 │  │  Stage 11 │  │  Stage 12 │
        │  Kraken   │  │  Dev Tools│  │  X-Plat   │
        └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
              │              │              │
              └──────┬───────┴──────┬───────┘
                     │              │
                     ▼              ▼
             ┌───────────┐  ┌───────────┐
             │  Stage 13 │  │  Stage 14 │
             │  Multi-   │  │  File     │
             │  Provider │  │  Upload   │
             └─────┬─────┘  └─────┬─────┘
                   │              │
                   └──────┬───────┘
                          │
                          ▼
                  ┌───────────┐
                  │  Stage 15 │
                  │  Intel.   │
                  │  Layer    │
                  └───────────┘
```

## Priority Matrix

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Priority vs Complexity Matrix                      │
└──────────────────────────────────────────────────────────────────────┘

High Priority
    │
    │   Stage 11          Stage 10          Stage 15
    │   Dev Tools         Kraken            Intelligence
    │   [Medium]          [High]            [High]
    │
    │
    │   Stage 12          Stage 13          Stage 14
    │   X-Platform        Multi-Provider    File Upload
    │   [Low]             [Medium]          [Medium]
    │
Low Priority
    └────────────────────────────────────────────────────────────────▶
        Low Complexity                              High Complexity
```

## Feature Availability Timeline

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Estimated Feature Timeline                       │
│                    (Subject to change based on                        │
│                   community feedback and resources)                   │
└──────────────────────────────────────────────────────────────────────┘

Q1 2026  │ ████████████ Stage 9: Docs & Release
         │
Q2 2026  │ ░░░░░░░░░░░░ Stage 10: Kraken Integration (Planned)
         │ ░░░░░░░░░░░░ Stage 11: Dev Productivity (Planned)
         │
Q2 2026  │ ░░░░░░░░░░░░ Stage 12: Cross-Platform (Planned)
         │ ░░░░░░░░░░░░ Stage 13: Multi-Provider (Planned)
         │
Q2 2026  │ ░░░░░░░░░░░░ Stage 14: File Upload (Planned)
         │ ░░░░░░░░░░░░ Stage 15: Intelligence Layer (Planned)
         │

Legend:
████ Completed/In Progress
░░░░ Planned (Timeline TBD)
```

## Feature Categories

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Features by Category                           │
└──────────────────────────────────────────────────────────────────────┘

🎨 USER INTERFACE
├─ Interactive TUI                                         ✅ Complete
├─ Non-Interactive Mode                                    ✅ Complete
├─ Status Bar & Indicators                                 ✅ Complete
└─ Diff Review UI                                          📋 Planned (S11)

🔧 CORE FUNCTIONALITY
├─ Tool System                                             ✅ Complete
├─ Policy Engine                                           ✅ Complete
├─ Hook System                                             ✅ Complete
├─ MCP Integration                                         ✅ Complete
└─ Git Integration                                         📋 Planned (S11)

🧠 INTELLIGENCE
├─ Context Management                                      ✅ Complete
├─ VRAM Monitoring                                         ✅ Complete
├─ Session Compression                                     ✅ Complete
├─ Semantic Search                                         📋 Planned (S15)
├─ Structured Output                                       📋 Planned (S15)
└─ Code Execution                                          📋 Planned (S15)

🔌 PROVIDERS
├─ Ollama (Local)                                          ✅ Complete
├─ External LLMs (Kraken)                                  📋 Planned (S10)
├─ vLLM                                                    📋 Planned (S13)
└─ OpenAI-Compatible                                       📋 Planned (S13)

📁 FILE HANDLING
├─ File Read/Write Tools                                   ✅ Complete
├─ @-Mention Context Loading                               📋 Planned (S11)
└─ File Upload System                                      📋 Planned (S14)

🖥️ PLATFORM
├─ Basic Cross-Platform                                    ✅ Complete
└─ Enhanced Cross-Platform                                 📋 Planned (S12)

🔍 VISION & MEDIA
├─ Image Analysis                                          📋 Planned (S15)
└─ Screenshot Capture                                      📋 Planned (S15)

💰 COST & TRACKING
├─ Basic Token Counting                                    ✅ Complete
├─ Cost Tracking                                           📋 Planned (S10/S15)
└─ Budget Enforcement                                      📋 Planned (S10)
```

## Implementation Status Legend

```
✅ Complete       - Feature is implemented and tested
🔄 In Progress    - Feature is currently being developed
📋 Planned        - Feature is planned for future development
⏸️ On Hold        - Feature development is paused
❌ Cancelled      - Feature will not be implemented
```

## Quick Links

- **[Roadmap Overview](./roadmap.md)** - Main entry point
- **[Future Development](./future-development.md)** - Detailed roadmap with specifications
- **[Future Features](./future-features.md)** - Quick reference guide
- **[Contributing](./future-development.md#contributing)** - How to contribute
- **[Feedback](./future-development.md#feedback)** - Share your thoughts

---

**Last Updated:** 2026-01-16  
**Document Version:** 1.1  
**Status:** Living document - Updated as development progresses
