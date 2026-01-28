#!/bin/bash
# Backup script for context compression system before rewrite
# This script backs up all legacy files that will be replaced

set -e  # Exit on error

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

if [ -f "packages/core/src/context/compressionService.ts" ]; then
  cp packages/core/src/context/compressionService.ts "${BACKUP_DIR}/core/"
  echo "  ✓ compressionService.ts"
else
  echo "  ⚠️  compressionService.ts not found"
fi

if [ -f "packages/core/src/context/compressionCoordinator.ts" ]; then
  cp packages/core/src/context/compressionCoordinator.ts "${BACKUP_DIR}/core/"
  echo "  ✓ compressionCoordinator.ts"
else
  echo "  ⚠️  compressionCoordinator.ts not found"
fi

if [ -f "packages/core/src/context/checkpointManager.ts" ]; then
  cp packages/core/src/context/checkpointManager.ts "${BACKUP_DIR}/core/"
  echo "  ✓ checkpointManager.ts"
else
  echo "  ⚠️  checkpointManager.ts not found"
fi

if [ -f "packages/core/src/context/snapshotManager.ts" ]; then
  cp packages/core/src/context/snapshotManager.ts "${BACKUP_DIR}/core/"
  echo "  ✓ snapshotManager.ts"
else
  echo "  ⚠️  snapshotManager.ts not found"
fi

if [ -f "packages/core/src/context/contextManager.ts" ]; then
  cp packages/core/src/context/contextManager.ts "${BACKUP_DIR}/core/"
  echo "  ✓ contextManager.ts"
else
  echo "  ⚠️  contextManager.ts not found"
fi

# Backup service files
echo "📦 Backing up service files..."

if [ -f "packages/core/src/services/chatCompressionService.ts" ]; then
  cp packages/core/src/services/chatCompressionService.ts "${BACKUP_DIR}/services/"
  echo "  ✓ chatCompressionService.ts"
else
  echo "  ⚠️  chatCompressionService.ts not found"
fi

# Backup test files
echo "📦 Backing up test files..."

if [ -f "packages/core/src/context/__tests__/compressionService.test.ts" ]; then
  cp packages/core/src/context/__tests__/compressionService.test.ts "${BACKUP_DIR}/tests/"
  echo "  ✓ compressionService.test.ts"
fi

if [ -f "packages/core/src/context/__tests__/compressionCoordinator.test.ts" ]; then
  cp packages/core/src/context/__tests__/compressionCoordinator.test.ts "${BACKUP_DIR}/tests/"
  echo "  ✓ compressionCoordinator.test.ts"
fi

if [ -f "packages/core/src/context/__tests__/checkpointManager.test.ts" ]; then
  cp packages/core/src/context/__tests__/checkpointManager.test.ts "${BACKUP_DIR}/tests/"
  echo "  ✓ checkpointManager.test.ts"
fi

if [ -f "packages/core/src/context/__tests__/snapshotManager.test.ts" ]; then
  cp packages/core/src/context/__tests__/snapshotManager.test.ts "${BACKUP_DIR}/tests/"
  echo "  ✓ snapshotManager.test.ts"
fi

if [ -f "packages/core/src/context/__tests__/contextManager.test.ts" ]; then
  cp packages/core/src/context/__tests__/contextManager.test.ts "${BACKUP_DIR}/tests/"
  echo "  ✓ contextManager.test.ts"
fi

# Create MANIFEST.md
echo "📝 Creating MANIFEST.md..."
cat > "${BACKUP_DIR}/MANIFEST.md" << EOF
# Context Compression System Backup

**Date:** $(date)
**Reason:** Complete rewrite to fix architectural flaws
**Issue:** System crashes after 3-4 checkpoints

## Files Backed Up

### Core Files (6 files, ~4,000 lines)
- compressionService.ts (920 lines)
- compressionCoordinator.ts (830 lines)
- chatCompressionService.ts (559 lines)
- checkpointManager.ts (~400 lines)
- snapshotManager.ts (615 lines)
- contextManager.ts (639 lines)

### Test Files
- All associated test files

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
# Run restoration script
cd ${BACKUP_DIR}
./restore.sh
\`\`\`

## References

- Audit: .dev/backlog/28-01-2026-ContextCompressionAudit/AUDIT_FINDINGS.md
- Spec: .kiro/specs/v0.1.1 Context Compression Refactor/requirements.md
EOF

# Create restore.sh
echo "📝 Creating restore.sh..."
cat > "${BACKUP_DIR}/restore.sh" << 'RESTORE_EOF'
#!/bin/bash
# Restoration script for legacy context compression system

echo "⚠️  WARNING: This will restore the legacy context compression system"
echo "This will overwrite the new implementation!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restoration cancelled"
  exit 1
fi

# Get the root directory (3 levels up from backup dir)
ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"

# Restore core files
echo "Restoring core files..."
cp core/*.ts "${ROOT_DIR}/packages/core/src/context/" 2>/dev/null || echo "No core files to restore"

# Restore service files
echo "Restoring service files..."
cp services/*.ts "${ROOT_DIR}/packages/core/src/services/" 2>/dev/null || echo "No service files to restore"

# Restore tests
echo "Restoring test files..."
cp tests/*.test.ts "${ROOT_DIR}/packages/core/src/context/__tests__/" 2>/dev/null || echo "No test files to restore"

echo "✅ Legacy system restored"
echo "Run 'npm run build' to rebuild"
RESTORE_EOF

chmod +x "${BACKUP_DIR}/restore.sh"

# Create VERIFICATION.md
echo "📝 Creating VERIFICATION.md..."
cat > "${BACKUP_DIR}/VERIFICATION.md" << 'EOF'
# Backup Verification Checklist

## Pre-Backup Verification

- [ ] All files exist in source locations
- [ ] Git status is clean (or changes committed)
- [ ] Tests are passing
- [ ] Build is successful

## Post-Backup Verification

- [ ] All 6 core files backed up
- [ ] All test files backed up
- [ ] MANIFEST.md created
- [ ] restore.sh created and executable
- [ ] File sizes match originals
- [ ] No corruption in backed up files

## Backup Integrity

```bash
# Verify file counts
echo "Core files: $(ls -1 core/*.ts 2>/dev/null | wc -l)"
echo "Service files: $(ls -1 services/*.ts 2>/dev/null | wc -l)"
echo "Test files: $(ls -1 tests/*.test.ts 2>/dev/null | wc -l)"

# Verify file sizes
du -sh core/ 2>/dev/null || echo "No core files"
du -sh services/ 2>/dev/null || echo "No service files"
du -sh tests/ 2>/dev/null || echo "No test files"
```

## Restoration Test

- [ ] Restoration script is executable
- [ ] Restoration script has correct paths
- [ ] Test restoration in separate branch
- [ ] Verify restored files work

## Documentation

- [ ] Backup location documented
- [ ] Reason for backup documented
- [ ] Replacement files documented
- [ ] Restoration process documented

## Sign-Off

Backup completed by: _______________
Date: $(date)
Verified by: _______________
Date: _______________
EOF

# Summary
echo ""
echo "✅ Backup complete!"
echo ""
echo "📁 Backup location: ${BACKUP_DIR}"
echo "📄 Files backed up:"
ls -1 "${BACKUP_DIR}/core/" 2>/dev/null | wc -l | xargs echo "   Core files:"
ls -1 "${BACKUP_DIR}/services/" 2>/dev/null | wc -l | xargs echo "   Service files:"
ls -1 "${BACKUP_DIR}/tests/" 2>/dev/null | wc -l | xargs echo "   Test files:"
echo ""
echo "📝 Documentation:"
echo "   - MANIFEST.md: Backup details"
echo "   - restore.sh: Restoration script"
echo "   - VERIFICATION.md: Verification checklist"
echo ""
echo "Next steps:"
echo "1. Review ${BACKUP_DIR}/VERIFICATION.md"
echo "2. Commit backup to git"
echo "3. Begin implementation"
