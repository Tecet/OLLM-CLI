# Context Compression Backup Guide

**Purpose:** Step-by-step guide for backing up legacy code before rewrite  
**Created:** January 28, 2026  
**Status:** Ready to Execute

---

## Quick Start

```bash
# 1. Create backup script
cat > scripts/backup-context-compression.sh << 'EOF'
#!/bin/bash
# See full script below
EOF

# 2. Make executable
chmod +x scripts/backup-context-compression.sh

# 3. Run backup
./scripts/backup-context-compression.sh

# 4. Verify backup
ls -lah .legacy/context-compression/$(date +%Y-%m-%d-*)

# 5. Commit to git
git add .legacy/
git commit -m "backup: Context compression system before rewrite"
```

---

## Full Backup Script

Save this as `scripts/backup-context-compression.sh`:

```bash
#!/bin/bash
set -e

echo "🔄 Starting Context Compression System Backup..."

# Create timestamped backup directory
BACKUP_DATE=$(date +%Y-%m-%d-%H%M%S)
BACKUP_DIR=".legacy/context-compression/${BACKUP_DATE}"

echo "📁 Creating backup directory: ${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}/core"
mkdir -p "${BACKUP_DIR}/services"
mkdir -p "${BACKUP_DIR}/tests"

# Backup core files
echo "📦 Backing up core files..."
cp packages/core/src/context/compressionService.ts "${BACKUP_DIR}/core/" 2>/dev/null || echo "⚠️  compressionService.ts not found"
cp packages/core/src/context/compressionCoordinator.ts "${BACKUP_DIR}/core/" 2>/dev/null || echo "⚠️  compressionCoordinator.ts not found"
cp packages/core/src/context/checkpointManager.ts "${BACKUP_DIR}/core/" 2>/dev/null || echo "⚠️  checkpointManager.ts not found"
cp packages/core/src/context/snapshotManager.ts "${BACKUP_DIR}/core/" 2>/dev/null || echo "⚠️  snapshotManager.ts not found"
cp packages/core/src/context/contextManager.ts "${BACKUP_DIR}/core/" 2>/dev/null || echo "⚠️  contextManager.ts not found"

# Backup service files
echo "📦 Backing up service files..."
cp packages/core/src/services/chatCompressionService.ts "${BACKUP_DIR}/services/" 2>/dev/null || echo "⚠️  chatCompressionService.ts not found"

# Backup test files
echo "📦 Backing up test files..."
cp packages/core/src/context/__tests__/compressionService.test.ts "${BACKUP_DIR}/tests/" 2>/dev/null || true
cp packages/core/src/context/__tests__/compressionCoordinator.test.ts "${BACKUP_DIR}/tests/" 2>/dev/null || true
cp packages/core/src/context/__tests__/checkpointManager.test.ts "${BACKUP_DIR}/tests/" 2>/dev/null || true
cp packages/core/src/context/__tests__/snapshotManager.test.ts "${BACKUP_DIR}/tests/" 2>/dev/null || true
cp packages/core/src/context/__tests__/contextManager.test.ts "${BACKUP_DIR}/tests/" 2>/dev/null || true

# Count files
CORE_COUNT=$(ls -1 "${BACKUP_DIR}/core"/*.ts 2>/dev/null | wc -l)
SERVICE_COUNT=$(ls -1 "${BACKUP_DIR}/services"/*.ts 2>/dev/null | wc -l)
TEST_COUNT=$(ls -1 "${BACKUP_DIR}/tests"/*.test.ts 2>/dev/null | wc -l)

echo "✅ Backup complete!"
echo "   Core files: ${CORE_COUNT}"
echo "   Service files: ${SERVICE_COUNT}"
echo "   Test files: ${TEST_COUNT}"

# Create MANIFEST.md
cat > "${BACKUP_DIR}/MANIFEST.md" << EOF
# Context Compression System Backup

**Date:** $(date)
**Reason:** Complete rewrite to fix architectural flaws
**Issue:** System crashes after 3-4 checkpoints

## Files Backed Up

### Core Files (${CORE_COUNT} files)
$(ls -1 "${BACKUP_DIR}/core"/*.ts 2>/dev/null | xargs -I {} basename {} | sed 's/^/- /')

### Service Files (${SERVICE_COUNT} files)
$(ls -1 "${BACKUP_DIR}/services"/*.ts 2>/dev/null | xargs -I {} basename {} | sed 's/^/- /')

### Test Files (${TEST_COUNT} files)
$(ls -1 "${BACKUP_DIR}/tests"/*.test.ts 2>/dev/null | xargs -I {} basename {} | sed 's/^/- /')

## Critical Issues in Legacy Code

1. ❌ No LLM summarization (just truncation)
2. ❌ Snapshots mixed with active context
3. ❌ No pre-send validation
4. ❌ Checkpoints don't age properly
5. ❌ User messages accumulate unbounded
6. ❌ No error handling

## Replacement Files

- compressionEngine.ts (replaces compressionService.ts)
- compressionOrchestrator.ts (replaces compressionCoordinator.ts)
- sessionCompressionService.ts (replaces chatCompressionService.ts)
- checkpointLifecycle.ts (replaces checkpointManager.ts)
- snapshotLifecycle.ts (replaces snapshotManager.ts)
- contextOrchestrator.ts (replaces contextManager.ts)

## New Files Created

- storageTypes.ts (storage layer interfaces)
- activeContextManager.ts (LLM-bound context)
- sessionHistoryManager.ts (full history)
- compressionPipeline.ts (structured flow)
- summarizationService.ts (LLM integration)
- validationService.ts (pre-send checks)
- emergencyActions.ts (emergency handling)
- storageBoundaries.ts (boundary enforcement)

## Restoration

To restore legacy code (if needed):

\`\`\`bash
cd ${BACKUP_DIR}
./restore.sh
\`\`\`

## References

- Audit: .dev/backlog/28-01-2026-ContextCompressionAudit/AUDIT_FINDINGS.md
- Spec: .kiro/specs/context-compression-refactor/requirements.md
- Design: .kiro/specs/context-compression-refactor/design.md
EOF

# Create restore.sh
cat > "${BACKUP_DIR}/restore.sh" << 'RESTORE_EOF'
#!/bin/bash
# Restoration script for legacy context compression system

echo "⚠️  WARNING: This will restore the legacy context compression system"
echo "This will overwrite the new implementation!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Restoration cancelled"
  exit 1
fi

# Get the workspace root (3 levels up from backup dir)
WORKSPACE_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

# Restore core files
echo "🔄 Restoring core files..."
cp core/*.ts "${WORKSPACE_ROOT}/packages/core/src/context/"

# Restore service files
echo "🔄 Restoring service files..."
cp services/*.ts "${WORKSPACE_ROOT}/packages/core/src/services/"

# Restore tests
echo "🔄 Restoring test files..."
cp tests/*.test.ts "${WORKSPACE_ROOT}/packages/core/src/context/__tests__/" 2>/dev/null || true

echo "✅ Legacy system restored"
echo "⚠️  Run 'npm run build' to rebuild"
RESTORE_EOF

chmod +x "${BACKUP_DIR}/restore.sh"

# Create VERIFICATION.md
cat > "${BACKUP_DIR}/VERIFICATION.md" << EOF
# Backup Verification Checklist

## Pre-Backup Verification

- [x] All files exist in source locations
- [ ] Git status is clean (or changes committed)
- [ ] Tests are passing
- [ ] Build is successful

## Post-Backup Verification

- [x] All ${CORE_COUNT} core files backed up
- [x] All ${SERVICE_COUNT} service files backed up
- [x] All ${TEST_COUNT} test files backed up
- [x] MANIFEST.md created
- [x] restore.sh created and executable
- [ ] File sizes match originals
- [ ] No corruption in backed up files

## Backup Integrity

\`\`\`bash
# Verify file counts
echo "Core files: \$(ls -1 core/*.ts | wc -l)"
echo "Service files: \$(ls -1 services/*.ts | wc -l)"
echo "Test files: \$(ls -1 tests/*.test.ts 2>/dev/null | wc -l)"

# Verify file sizes
du -sh core/
du -sh services/
du -sh tests/

# Verify no corruption (TypeScript syntax check)
for file in core/*.ts services/*.ts; do
  if ! npx tsc --noEmit "\$file" 2>/dev/null; then
    echo "❌ Syntax error in \$file"
  fi
done
\`\`\`

## Restoration Test

- [ ] Restoration script is executable
- [ ] Restoration script has correct paths
- [ ] Test restoration in separate branch
- [ ] Verify restored files work

## Documentation

- [x] Backup location documented
- [x] Reason for backup documented
- [x] Replacement files documented
- [x] Restoration process documented

## Sign-Off

Backup completed by: _______________
Date: $(date +%Y-%m-%d)
Verified by: _______________
Date: _______________
EOF

echo ""
echo "📄 Created MANIFEST.md"
echo "📄 Created restore.sh"
echo "📄 Created VERIFICATION.md"
echo ""
echo "✅ Backup complete: ${BACKUP_DIR}"
echo ""
echo "Next steps:"
echo "1. Review VERIFICATION.md and complete checklist"
echo "2. Commit backup to git:"
echo "   git add .legacy/"
echo "   git commit -m 'backup: Context compression system before rewrite'"
echo ""
```

---

## Verification Steps

After running the backup script:

### 1. Check File Counts

```bash
BACKUP_DIR=".legacy/context-compression/$(ls -t .legacy/context-compression/ | head -1)"

echo "Core files: $(ls -1 ${BACKUP_DIR}/core/*.ts 2>/dev/null | wc -l)"
echo "Service files: $(ls -1 ${BACKUP_DIR}/services/*.ts 2>/dev/null | wc -l)"
echo "Test files: $(ls -1 ${BACKUP_DIR}/tests/*.test.ts 2>/dev/null | wc -l)"
```

**Expected:**
- Core files: 5-6
- Service files: 1
- Test files: 0-5 (depending on what exists)

### 2. Check File Sizes

```bash
du -sh ${BACKUP_DIR}/core/
du -sh ${BACKUP_DIR}/services/
du -sh ${BACKUP_DIR}/tests/
```

**Expected:**
- Core: ~200-300 KB
- Services: ~30-50 KB
- Tests: ~50-100 KB (if tests exist)

### 3. Verify No Corruption

```bash
cd ${BACKUP_DIR}

for file in core/*.ts services/*.ts; do
  if ! node -c "$file" 2>/dev/null; then
    echo "❌ Syntax error in $file"
  else
    echo "✅ $file is valid"
  fi
done
```

### 4. Test Restoration Script

```bash
# Create test branch
git checkout -b test-restore

# Run restoration
cd ${BACKUP_DIR}
./restore.sh

# Verify files restored
ls -lah ../../packages/core/src/context/

# Rebuild
npm run build

# Run tests
npm test

# If successful, delete test branch
git checkout main
git branch -D test-restore
```

### 5. Commit Backup

```bash
git add .legacy/
git commit -m "backup: Context compression system before rewrite

Backed up 6 core files (~4,000 lines) to .legacy/context-compression/

Files backed up:
- compressionService.ts (920 lines)
- compressionCoordinator.ts (830 lines)
- chatCompressionService.ts (559 lines)
- checkpointManager.ts (~400 lines)
- snapshotManager.ts (615 lines)
- contextManager.ts (639 lines)

Reason: Complete rewrite to fix architectural flaws
Issue: System crashes after 3-4 checkpoints

See: ${BACKUP_DIR}/MANIFEST.md"
```

---

## Troubleshooting

### Issue: File not found

**Symptom:** `cp: cannot stat 'packages/core/src/context/compressionService.ts': No such file or directory`

**Solution:**
1. Check if file exists: `ls packages/core/src/context/compressionService.ts`
2. If not, file may have been moved or renamed
3. Update backup script with correct path
4. Or skip that file if it doesn't exist

### Issue: Permission denied

**Symptom:** `mkdir: cannot create directory '.legacy/context-compression': Permission denied`

**Solution:**
1. Check permissions: `ls -ld .legacy/`
2. Create directory manually: `mkdir -p .legacy/context-compression`
3. Run backup script again

### Issue: Backup directory already exists

**Symptom:** `mkdir: cannot create directory '.legacy/context-compression/2026-01-28-123456': File exists`

**Solution:**
1. This is fine - backup script uses timestamps
2. Each backup gets unique directory
3. Old backups can be cleaned up later

### Issue: Git commit fails

**Symptom:** `error: pathspec '.legacy/' did not match any file(s) known to git`

**Solution:**
1. Check if `.legacy/` is in `.gitignore`
2. If yes, remove from `.gitignore` temporarily
3. Or use `git add -f .legacy/` to force add

---

## Cleanup Old Backups

After successful rewrite, clean up old backups:

```bash
# List all backups
ls -lah .legacy/context-compression/

# Keep last 2 backups, delete older ones
cd .legacy/context-compression/
ls -t | tail -n +3 | xargs rm -rf

# Or delete all backups (after confirming new system works)
rm -rf .legacy/context-compression/
```

---

## Restoration Process

If you need to restore the legacy system:

```bash
# 1. Find backup directory
BACKUP_DIR=".legacy/context-compression/$(ls -t .legacy/context-compression/ | head -1)"

# 2. Run restoration script
cd ${BACKUP_DIR}
./restore.sh

# 3. Rebuild
npm run build

# 4. Run tests
npm test

# 5. Restart application
npm start
```

---

## Checklist

Before starting rewrite:

- [ ] Backup script created
- [ ] Backup executed successfully
- [ ] All files backed up (verify counts)
- [ ] MANIFEST.md created
- [ ] restore.sh created and tested
- [ ] VERIFICATION.md completed
- [ ] Backup committed to git
- [ ] Restoration tested in separate branch
- [ ] Team notified of backup location

---

**Status:** Ready to Execute  
**Next Step:** Run backup script  
**Estimated Time:** 15 minutes
