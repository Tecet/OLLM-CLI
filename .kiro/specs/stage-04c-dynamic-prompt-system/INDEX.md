# Dynamic Prompt System - Document Index

**Stage:** 04c  
**Status:** ✅ Complete  
**Last Updated:** January 18, 2026

---

## Quick Navigation

| Document | Purpose | Size | Read Time |
|----------|---------|------|-----------|
| **[README.md](./README.md)** | Overview & quick reference | 11 KB | 5 min |
| **[SUMMARY.md](./SUMMARY.md)** | Executive summary | 10 KB | 5 min |
| **[requirements.md](./requirements.md)** | Requirements & acceptance criteria | 12 KB | 10 min |
| **[design.md](./design.md)** | Complete architecture & design | 58 KB | 30 min |
| **[enhancements.md](./enhancements.md)** | Advanced features specification | 41 KB | 25 min |
| **[tasks.md](./tasks.md)** | Implementation tasks & timeline | 23 KB | 15 min |
| **[architecture-diagram.md](./architecture-diagram.md)** | Visual architecture diagrams | 26 KB | 10 min |
| **[INDEX.md](./INDEX.md)** | This file | 3 KB | 2 min |

**Total:** 184 KB of documentation

---

## Reading Guide

### For Stakeholders (10 minutes)
1. Read **README.md** - Get the overview
2. Read **SUMMARY.md** - Understand scope and effort
3. Skim **architecture-diagram.md** - See the big picture

### For Product Managers (20 minutes)
1. Read **README.md** - Overview
2. Read **requirements.md** - What we're building
3. Read **SUMMARY.md** - Timeline and phases
4. Review **tasks.md** - Implementation strategy

### For Developers (60 minutes)
1. Read **README.md** - Overview
2. Read **requirements.md** - Requirements
3. Read **design.md** - Complete architecture
4. Read **enhancements.md** - Advanced features
5. Read **tasks.md** - Implementation tasks
6. Review **architecture-diagram.md** - Visual reference

### For Quick Reference (2 minutes)
1. Read **README.md** - Quick overview
2. Check **tasks.md** - See what needs to be done

---

## Document Descriptions

### README.md
**Purpose:** Quick overview and reference  
**Contains:**
- Feature summary
- 10 operational modes
- Key features (auto-switching, snapshots, RAG)
- Implementation phases
- Example workflows
- Success metrics

**Best for:** First-time readers, quick reference

---

### SUMMARY.md
**Purpose:** Executive summary of complete specification  
**Contains:**
- What we built
- Complete feature set (MVP → Enhanced → Advanced → RAG)
- Implementation strategy
- Key decisions and rationale
- Success criteria
- Risk mitigation
- Next steps

**Best for:** Stakeholders, project managers, decision makers

---

### requirements.md
**Purpose:** Formal requirements specification  
**Contains:**
- 12 requirements
- 96 acceptance criteria
- User stories
- Glossary
- Detailed specifications for:
  - Mode definitions
  - Context analysis
  - Mode transitions
  - Tool filtering
  - Prompt building
  - UI integration
  - Manual control
  - HotSwap integration
  - Compression integration
  - Mode persistence
  - Mode history
  - Error handling

**Best for:** Understanding what needs to be built, acceptance testing

---

### design.md
**Purpose:** Complete architecture and design specification  
**Contains:**
- System architecture diagrams
- All 10 mode definitions with full prompts
- Mode selection strategy
- Confidence thresholds
- Mode-aware context snapshots (JSON + XML)
- Advanced features:
  - Mode transition suggestions
  - Mode workflows
  - Mode shortcuts
  - Confidence display
  - Focus mode
  - Hybrid modes
  - Mode memory
  - Metrics tracking
  - Transition animations
- RAG integration architecture
- Component interfaces (TypeScript)
- Integration points
- Data models
- Commands
- Configuration
- Testing strategy

**Best for:** Developers implementing the system, architects

---

### enhancements.md
**Purpose:** Detailed specifications for advanced features  
**Contains:**
- Prototype mode (full template and implementation)
- Teacher mode (full template and implementation)
- Mode transition suggestions (with examples)
- Mode workflows (5 predefined workflows)
- Mode shortcuts (30+ commands)
- Improved planning mode restrictions
- Mode confidence display
- Mode-specific metrics
- Focus mode
- Hybrid modes
- Mode memory (project preferences)
- Transition animations
- RAG integration (LanceDB setup, embeddings, knowledge bases)
- Implementation examples
- Code snippets

**Best for:** Understanding advanced features, implementation details

---

### tasks.md
**Purpose:** Implementation task breakdown  
**Contains:**
- 40 main tasks
- 300+ subtasks
- 20 phases
- Estimated timeline: 53-75 hours
- Phase breakdown:
  - Phase 1-7: MVP (14-22 hours)
  - Phase 8-12: Enhanced (25-33 hours)
  - Phase 13-18: Advanced (14-20 hours)
  - Phase 19: RAG (8-10 hours)
  - Phase 20: Documentation (1-2 hours)
- Success criteria
- Dependencies
- Risk assessment

**Best for:** Project planning, sprint planning, tracking progress

---

### architecture-diagram.md
**Purpose:** Visual architecture diagrams  
**Contains:**
- System overview diagram
- Mode management layer
- 10 operational modes
- Integration layer
- RAG integration (future)
- Mode transition flow
- Workflow execution flow
- RAG integration flow
- Storage structure

**Best for:** Visual learners, presentations, understanding data flow

---

### INDEX.md
**Purpose:** Navigation and document guide  
**Contains:**
- Document index
- Reading guides for different roles
- Document descriptions
- Quick reference

**Best for:** Finding the right document, understanding structure

---

## Key Statistics

### Specification Metrics
- **Total Documents:** 8
- **Total Size:** 184 KB
- **Total Lines:** ~5,000
- **Requirements:** 12
- **Acceptance Criteria:** 96
- **Tasks:** 40
- **Subtasks:** 300+
- **Modes:** 10
- **Features:** 20+

### Implementation Metrics
- **Estimated Effort:** 53-75 hours
- **Timeline:** 1-2 weeks
- **Phases:** 20
- **Components:** 15+
- **Integration Points:** 6
- **Test Cases:** 100+

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-18 | Initial complete specification |
| | | - 8 core modes |
| | | - Mode-aware snapshots |
| | | - Basic features |
| 2.0 | 2026-01-18 | Enhanced specification |
| | | - Added Prototype and Teacher modes (10 total) |
| | | - Added mode transition suggestions |
| | | - Added mode workflows |
| | | - Added mode shortcuts |
| | | - Improved planning mode restrictions |
| | | - Added confidence display |
| | | - Added mode metrics |
| | | - Added focus mode |
| | | - Added hybrid modes |
| | | - Added mode memory |
| | | - Added transition animations |
| | | - Added RAG integration (LanceDB) |

---

## Related Documents

### External References
- `.dev/audit/system-prompt-audit-2026-01-18.md` - Original audit
- `.dev/audit/full-integration-audit-2026-01-18.md` - Integration analysis
- `.dev/audit/dynamic-prompt-switching-2026-01-18.md` - Initial design
- `packages/core/src/context/HotSwapService.ts` - Existing implementation
- `packages/core/src/prompts/templates/stateSnapshot.ts` - XML template

### Dependencies
- `packages/core/src/context/SystemPromptBuilder.ts`
- `packages/core/src/prompts/PromptRegistry.ts`
- `packages/core/src/context/ContextManager.ts`
- `packages/core/src/tools/tool-registry.ts`

---

## Contact & Support

For questions about this specification:
1. Review the appropriate document above
2. Check the architecture diagrams
3. Review the requirements and acceptance criteria
4. Consult the tasks document for implementation details

---

**Specification Status:** ✅ Complete  
**Ready for Implementation:** ✅ Yes  
**Blockers:** None  
**Next Step:** Begin Phase 1 (Core Infrastructure)
