# Code Editor Specification - v0.4.0

**Status**: 📋 Ready for Implementation  
**Created**: January 22, 2026  
**Dependencies**: v0.3.0 File Explorer

## Overview

This specification defines a built-in terminal-based code editor for OLLM CLI. The editor will be the third window alongside Chat and Terminal, providing quick editing capabilities without leaving the application.

## Specification Files

### 1. [requirements.md](./requirements.md)
Defines what we're building and why.

**Contents**:
- 12 User Stories with acceptance criteria
- 6 Technical Requirements
- Success metrics
- Dependencies and references

**Key User Stories**:
- US-1: Open file in editor
- US-2: Navigate with cursor
- US-3: Insert and delete text
- US-4: Save file
- US-5: Undo and redo
- US-6: Copy, cut, and paste
- US-7: Find text
- US-8: Go to line
- US-9: Syntax highlighting
- US-10: Format with Prettier
- US-11: Close editor
- US-12: Multiple file support

### 2. [design.md](./design.md)
Defines how we're building it.

**Contents**:
- Architecture overview with diagrams
- Component structure
- Data structures and interfaces
- Core services (8 services)
- UI components (7 components)
- Integration points (4 integrations)
- State management
- Performance optimizations
- Error handling
- Testing strategy
- Security considerations
- Configuration

**Key Services**:
- EditorBuffer: Text content management
- EditorCursor: Cursor position and movement
- EditorHistory: Undo/redo stack
- EditorSelection: Text selection
- EditorClipboard: Copy/cut/paste
- EditorSyntax: Syntax highlighting
- EditorFormatter: Prettier integration
- EditorFileOps: File operations

### 3. [tasks.md](./tasks.md)
Defines the implementation plan.

**Contents**:
- 40 actionable tasks organized in 3 phases
- Each task includes:
  - Requirements mapping
  - Effort estimate
  - Files to create/modify
  - Acceptance criteria
- Phase 1: MVP (16 tasks, 3-4 days)
- Phase 2: Enhanced (11 tasks, 2-3 days)
- Phase 3: Polish (13 tasks, 2-3 days)

## Quick Start

### For Implementers

1. **Read the requirements** to understand what we're building
2. **Review the design** to understand the architecture
3. **Follow the tasks** in order, starting with Phase 1, Task 1
4. **Run tests** after each task to ensure quality
5. **Commit frequently** with clear messages

### For Reviewers

1. **Check requirements** are complete and testable
2. **Validate design** is sound and maintainable
3. **Review tasks** are actionable and properly scoped
4. **Verify acceptance criteria** are clear and measurable

## Implementation Timeline

**Total Effort**: 7-10 days

- **Phase 1 (MVP)**: 3-4 days
  - Basic editing, cursor navigation, save/load
  - Goal: Can open, edit, and save files
  
- **Phase 2 (Enhanced)**: 2-3 days
  - Undo/redo, clipboard, find, go-to-line
  - Goal: Comfortable editing experience
  
- **Phase 3 (Polish)**: 2-3 days
  - Syntax highlighting, Prettier, multi-file, auto-save
  - Goal: Production-ready editor

## Key Features

### MVP (Phase 1)
- ✅ Open files from File Explorer
- ✅ Cursor navigation (arrows, Home, End, PgUp/PgDn)
- ✅ Text insertion and deletion
- ✅ Save files with backup
- ✅ Dirty state tracking
- ✅ Window integration

### Enhanced (Phase 2)
- ✅ Undo/Redo (Ctrl+Z, Ctrl+Y)
- ✅ Copy/Cut/Paste (Ctrl+C, Ctrl+X, Ctrl+V)
- ✅ Find text (Ctrl+F)
- ✅ Go to line (Ctrl+G)
- ✅ Text selection (Shift+arrows)

### Polish (Phase 3)
- ✅ Syntax highlighting (50+ languages)
- ✅ Prettier formatting (Ctrl+Shift+F)
- ✅ Multiple file tabs
- ✅ Auto-save
- ✅ External change detection
- ✅ Focus system integration

## Integration Points

### 1. File Explorer
- Press `e` in File Explorer to open file in editor
- Editor window becomes active automatically
- File path passed to CodeEditor component

### 2. Window Management
- Editor is the 3rd window (Chat/Terminal/Editor)
- Ctrl+3 switches to editor
- Ctrl+1/2 switches to Chat/Terminal

### 3. Focus System
- Saving a file updates focused file content
- Keeps LLM context in sync with edits

### 4. Syntax Highlighting
- Reuses SyntaxViewer's shiki integration
- Supports 50+ programming languages
- Debounced updates for performance

## Technical Stack

### Dependencies
- **React + Ink**: UI framework
- **shiki**: Syntax highlighting (already installed)
- **prettier**: Code formatting (new dependency)
- **clipboardy**: Clipboard operations (new dependency)

### File Structure
```
packages/cli/src/ui/components/code-editor/
├── CodeEditor.tsx              # Main component
├── EditorHeader.tsx            # Header
├── EditorContent.tsx           # Content area
├── EditorFooter.tsx            # Footer
├── FindDialog.tsx              # Find dialog
├── GoToLineDialog.tsx          # Go-to-line dialog
├── services/                   # Core services
├── contexts/                   # State management
├── hooks/                      # Custom hooks
├── types.ts                    # TypeScript types
└── __tests__/                  # Tests
```

## Testing Strategy

### Unit Tests
- EditorBuffer: Text operations
- EditorCursor: Movement logic
- EditorHistory: Undo/redo
- EditorSelection: Selection logic

### Integration Tests
- File operations: Open, save, reload
- Keyboard shortcuts: All keybindings
- Focus integration: Update on save
- Window switching: Editor integration

### Property-Based Tests
- Undo/redo round-trip
- Buffer operations consistency
- Cursor movement boundaries

### Manual Testing
- Cross-platform: Windows, macOS, Linux
- Performance: Files up to 1MB
- Usability: Can edit without docs

## Success Metrics

1. **Adoption**: 50%+ of users use built-in editor
2. **Performance**: 95%+ operations < 100ms
3. **Reliability**: < 1% data loss incidents
4. **Usability**: Users can edit without reading docs

## References

### Related Documents
- Proposal: `.dev/CODE-EDITOR-PROPOSAL.md`
- Audit: `.dev/CODE-EDITOR-AUDIT-SUMMARY.md`
- File Explorer Spec: `.kiro/specs/v0.3.0 File Explorer/`

### Related Code
- SyntaxViewer: `packages/cli/src/ui/components/file-explorer/SyntaxViewer.tsx`
- EditorIntegration: `packages/cli/src/ui/components/file-explorer/EditorIntegration.ts`
- WindowContext: `packages/cli/src/ui/contexts/WindowContext.tsx`
- App.tsx: `packages/cli/src/ui/App.tsx`

### External Documentation
- Shiki: https://shiki.matsu.io/
- Prettier: https://prettier.io/docs/en/api.html
- Ink: https://github.com/vadimdemedes/ink
- React: https://react.dev/

## Questions or Issues?

If you have questions about this specification:
1. Check the design document for architecture details
2. Review the tasks document for implementation guidance
3. Refer to the proposal document for rationale
4. Ask in the development channel

## Status Updates

| Date | Status | Notes |
|------|--------|-------|
| 2026-01-22 | 📋 Spec Complete | Ready for implementation |

## Next Steps

1. ✅ Create spec directory and files
2. ✅ Write requirements.md
3. ✅ Write design.md
4. ✅ Write tasks.md
5. ⏳ Review and approve spec
6. ⏳ Create feature branch
7. ⏳ Start Phase 1 implementation
8. ⏳ Complete MVP
9. ⏳ Complete Enhanced features
10. ⏳ Complete Polish features
11. ⏳ Final testing and documentation
12. ⏳ Merge to main

---

**Ready to start?** Open [tasks.md](./tasks.md) and begin with Phase 1, Task 1!
