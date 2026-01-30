# Alpha Release 0.1.2 - Task Tracker

**Date:** 2026-01-30  
**Goal:** Prepare and publish OLLM CLI v0.1.2 to npm  
**Status:** 🔄 IN PROGRESS

---

## Phase 1: Documentation Cleanup & Update ⏳

### 1.1 Consolidate Old Work (28-01-2026)
- [ ] Review and consolidate `.dev/backlog/28-01-2026-SessionsIDBug/`
- [ ] Review and consolidate `.dev/backlog/28-01-2026-SessionsContext/`
- [ ] Review and consolidate `.dev/backlog/28-01-2026-ContextFiltering/`
- [ ] Review and consolidate `.dev/backlog/28-01-2026-ContextCompressionAudit/`
- [ ] Create: `.dev/backlog/28-01-2026-AUDIT.md`
- [ ] Create: `.dev/backlog/28-01-2026-IMPLEMENTATION.md`
- [ ] Delete redundant files

### 1.2 Extract Unfinished Work
- [x] Review `PromptBuilderPolish.md` - extract TASK 5 (optional)
- [x] Review `IMPLEMENTATION_TASKS.md` - extract any incomplete items
- [x] Update `.dev/backlog/backlog.md` with unfinished work

### 1.3 Update Developer Documentation
- [ ] Update `dev_ContextManagement.md` - new session/snapshot system
- [ ] Update `dev_ContextCompression.md` - tier-aware compression
- [ ] Update `dev_ContextSnapshots.md` - new snapshot flow
- [ ] Verify `dev_ToolsManager.md` - already updated
- [ ] Verify `dev_PromptComponents.md` - already updated
- [ ] Update `dev_SessionStorage.md` - new session manager

### 1.4 Update User Documentation
- [ ] Update `docs/Context/ContextManagment.md`
- [ ] Update `docs/Context/ContextCompression.md`
- [ ] Update `docs/Context/ContextArchitecture.md`
- [ ] Update `docs/Tools/UserGuide.md` - new tools UI
- [ ] Update `docs/Prompts System/SystemPrompts.md` - template system

---

## Phase 2: Code Quality Fixes 🔧

### 2.1 Linting Errors
- [ ] Run `npm run lint` and capture errors
- [ ] Fix ESLint errors in `packages/cli/src/`
- [ ] Fix ESLint errors in `packages/core/src/`
- [ ] Fix ESLint errors in `packages/ollm-bridge/src/`
- [ ] Remove unused imports
- [ ] Verify `npm run lint` passes

### 2.2 TypeScript Errors
- [ ] Run `npm run build` and capture errors
- [ ] Fix type errors in `packages/cli/`
- [ ] Fix type errors in `packages/core/`
- [ ] Fix type errors in `packages/ollm-bridge/`
- [ ] Verify `npm run build` completes successfully

### 2.3 Test Suite
- [ ] Run `npm test` and capture failures
- [ ] Fix failing unit tests
- [ ] Fix failing integration tests
- [ ] Update test snapshots if needed
- [ ] Verify `npm test` passes
- [ ] Check coverage (aim for >70%)

---

## Phase 3: Formatting & Final Prep 🎨

### 3.1 Code Formatting
- [ ] Run `npm run format` (Prettier)
- [ ] Review and commit formatting changes
- [ ] Verify all files formatted correctly

### 3.2 Package Preparation
- [ ] Review `package.json` fields
- [ ] Update version to `0.1.2`
- [ ] Review `.npmignore` or `files` field
- [ ] Verify `bin` field
- [ ] Update `README.md` with install instructions
- [ ] Update `CHANGELOG.md` with 0.1.2 changes
- [ ] Test: `npm pack` and install from tarball

---

## Phase 4: NPM Publishing 🚀

### 4.1 Pre-publish Checks
- [ ] Verify npm login: `npm whoami`
- [ ] Run `npm publish --dry-run`
- [ ] Review what will be published
- [ ] Final build: `npm run build`
- [ ] Final test: `npm test`

### 4.2 Publish
- [ ] Create git tag: `git tag v0.1.2`
- [ ] Push tag: `git push origin v0.1.2`
- [ ] Publish: `npm publish`
- [ ] Verify on npmjs.com
- [ ] Test install: `npm install -g ollm-cli`

---

## Execution Order

1. ✅ **Phase 1**: Documentation (current)
2. ⏳ **Phase 2**: Code fixes (lint/types/tests)
3. ⏳ **Phase 3**: Formatting & prep
4. ⏳ **Phase 4**: Publish

---

## Notes

- Keep commits focused and descriptive
- Test after each major fix
- Document breaking changes in CHANGELOG
- Backup before publishing
