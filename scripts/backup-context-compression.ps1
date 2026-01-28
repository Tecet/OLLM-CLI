# Backup script for context compression system before rewrite
# This script backs up all legacy files that will be replaced

Write-Host "Starting Context Compression System Backup..." -ForegroundColor Cyan

# Create timestamped backup directory
$BackupDate = Get-Date -Format "yyyy-MM-dd-HHmmss"
$BackupDir = ".legacy/context-compression/$BackupDate"

Write-Host "Creating backup directory: $BackupDir" -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$BackupDir/core" -Force | Out-Null
New-Item -ItemType Directory -Path "$BackupDir/services" -Force | Out-Null
New-Item -ItemType Directory -Path "$BackupDir/tests" -Force | Out-Null

# Backup core files
Write-Host "Backing up core files..." -ForegroundColor Yellow

$coreFiles = @(
    "packages/core/src/context/compressionService.ts",
    "packages/core/src/context/compressionCoordinator.ts",
    "packages/core/src/context/checkpointManager.ts",
    "packages/core/src/context/snapshotManager.ts",
    "packages/core/src/context/contextManager.ts"
)

foreach ($file in $coreFiles) {
    if (Test-Path $file) {
        Copy-Item $file "$BackupDir/core/" -Force
        Write-Host "  Backed up: $(Split-Path $file -Leaf)" -ForegroundColor Green
    } else {
        Write-Host "  Not found: $(Split-Path $file -Leaf)" -ForegroundColor DarkYellow
    }
}

# Backup service files
Write-Host "Backing up service files..." -ForegroundColor Yellow

$serviceFile = "packages/core/src/services/chatCompressionService.ts"
if (Test-Path $serviceFile) {
    Copy-Item $serviceFile "$BackupDir/services/" -Force
    Write-Host "  Backed up: chatCompressionService.ts" -ForegroundColor Green
} else {
    Write-Host "  Not found: chatCompressionService.ts" -ForegroundColor DarkYellow
}

# Backup test files
Write-Host "Backing up test files..." -ForegroundColor Yellow

$testFiles = @(
    "packages/core/src/context/__tests__/compressionService.test.ts",
    "packages/core/src/context/__tests__/compressionCoordinator.test.ts",
    "packages/core/src/context/__tests__/checkpointManager.test.ts",
    "packages/core/src/context/__tests__/snapshotManager.test.ts",
    "packages/core/src/context/__tests__/contextManager.test.ts"
)

foreach ($file in $testFiles) {
    if (Test-Path $file) {
        Copy-Item $file "$BackupDir/tests/" -Force
        Write-Host "  Backed up: $(Split-Path $file -Leaf)" -ForegroundColor Green
    }
}

# Create MANIFEST.md
Write-Host "Creating MANIFEST.md..." -ForegroundColor Yellow
$currentDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$manifest = "# Context Compression System Backup`n`n"
$manifest += "**Date:** $currentDate`n"
$manifest += "**Reason:** Complete rewrite to fix architectural flaws`n"
$manifest += "**Issue:** System crashes after 3-4 checkpoints`n`n"
$manifest += "## Files Backed Up`n`n"
$manifest += "### Core Files (6 files, ~4,000 lines)`n"
$manifest += "- compressionService.ts (920 lines)`n"
$manifest += "- compressionCoordinator.ts (830 lines)`n"
$manifest += "- chatCompressionService.ts (559 lines)`n"
$manifest += "- checkpointManager.ts (~400 lines)`n"
$manifest += "- snapshotManager.ts (615 lines)`n"
$manifest += "- contextManager.ts (639 lines)`n`n"
$manifest += "### Test Files`n"
$manifest += "- All associated test files`n`n"
$manifest += "## Critical Issues in Legacy Code`n`n"
$manifest += "1. No LLM summarization (just truncation)`n"
$manifest += "2. Snapshots mixed with active context`n"
$manifest += "3. No pre-send validation`n"
$manifest += "4. Checkpoints don't age properly`n"
$manifest += "5. User messages accumulate unbounded`n"
$manifest += "6. No error handling`n`n"
$manifest += "## Replacement Files`n`n"
$manifest += "- compressionEngine.ts (replaces compressionService.ts)`n"
$manifest += "- compressionOrchestrator.ts (replaces compressionCoordinator.ts)`n"
$manifest += "- sessionCompressionService.ts (replaces chatCompressionService.ts)`n"
$manifest += "- checkpointLifecycle.ts (replaces checkpointManager.ts)`n"
$manifest += "- snapshotLifecycle.ts (replaces snapshotManager.ts)`n"
$manifest += "- contextOrchestrator.ts (replaces contextManager.ts)`n`n"
$manifest += "## New Files Created`n`n"
$manifest += "- storageTypes.ts (storage layer interfaces)`n"
$manifest += "- activeContextManager.ts (LLM-bound context)`n"
$manifest += "- sessionHistoryManager.ts (full history)`n"
$manifest += "- compressionPipeline.ts (structured flow)`n"
$manifest += "- summarizationService.ts (LLM integration)`n"
$manifest += "- validationService.ts (pre-send checks)`n"
$manifest += "- emergencyActions.ts (emergency handling)`n"
$manifest += "- storageBoundaries.ts (boundary enforcement)`n`n"
$manifest += "## Restoration`n`n"
$manifest += "To restore legacy code (if needed):`n`n"
$manifest += "``````powershell`n"
$manifest += "cd $BackupDir`n"
$manifest += ".\restore.ps1`n"
$manifest += "``````"

Set-Content -Path "$BackupDir/MANIFEST.md" -Value $manifest

# Create restore.ps1
Write-Host "Creating restore.ps1..." -ForegroundColor Yellow

$restore = "# Restoration script for legacy context compression system`n`n"
$restore += "Write-Host 'WARNING: This will restore the legacy context compression system' -ForegroundColor Red`n"
$restore += "Write-Host 'This will overwrite the new implementation!' -ForegroundColor Red`n"
$restore += "`$confirm = Read-Host 'Are you sure? (yes/no)'`n`n"
$restore += "if (`$confirm -ne 'yes') {`n"
$restore += "    Write-Host 'Restoration cancelled' -ForegroundColor Yellow`n"
$restore += "    exit 1`n"
$restore += "}`n`n"
$restore += "# Get the root directory`n"
$restore += "`$RootDir = (Get-Item (Split-Path -Parent `$PSScriptRoot)).Parent.Parent.FullName`n`n"
$restore += "# Restore core files`n"
$restore += "Write-Host 'Restoring core files...' -ForegroundColor Yellow`n"
$restore += "if (Test-Path 'core/*.ts') {`n"
$restore += "    Copy-Item 'core/*.ts' `"`$RootDir/packages/core/src/context/`" -Force`n"
$restore += "}`n`n"
$restore += "# Restore service files`n"
$restore += "Write-Host 'Restoring service files...' -ForegroundColor Yellow`n"
$restore += "if (Test-Path 'services/*.ts') {`n"
$restore += "    Copy-Item 'services/*.ts' `"`$RootDir/packages/core/src/services/`" -Force`n"
$restore += "}`n`n"
$restore += "# Restore tests`n"
$restore += "Write-Host 'Restoring test files...' -ForegroundColor Yellow`n"
$restore += "if (Test-Path 'tests/*.test.ts') {`n"
$restore += "    Copy-Item 'tests/*.test.ts' `"`$RootDir/packages/core/src/context/__tests__/`" -Force`n"
$restore += "}`n`n"
$restore += "Write-Host 'Legacy system restored' -ForegroundColor Green`n"
$restore += "Write-Host 'Run npm run build to rebuild' -ForegroundColor Cyan"

Set-Content -Path "$BackupDir/restore.ps1" -Value $restore

# Create VERIFICATION.md
Write-Host "Creating VERIFICATION.md..." -ForegroundColor Yellow

$verification = "# Backup Verification Checklist`n`n"
$verification += "## Pre-Backup Verification`n`n"
$verification += "- [ ] All files exist in source locations`n"
$verification += "- [ ] Git status is clean (or changes committed)`n"
$verification += "- [ ] Tests are passing`n"
$verification += "- [ ] Build is successful`n`n"
$verification += "## Post-Backup Verification`n`n"
$verification += "- [ ] All 6 core files backed up`n"
$verification += "- [ ] All test files backed up`n"
$verification += "- [ ] MANIFEST.md created`n"
$verification += "- [ ] restore.ps1 created`n"
$verification += "- [ ] File sizes match originals`n"
$verification += "- [ ] No corruption in backed up files`n`n"
$verification += "## Backup Integrity`n`n"
$verification += "Run these commands to verify:`n`n"
$verification += "``````powershell`n"
$verification += "Get-ChildItem core/*.ts | Measure-Object`n"
$verification += "Get-ChildItem services/*.ts | Measure-Object`n"
$verification += "Get-ChildItem tests/*.test.ts | Measure-Object`n"
$verification += "``````"

Set-Content -Path "$BackupDir/VERIFICATION.md" -Value $verification

# Summary
Write-Host ""
Write-Host "Backup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Backup location: $BackupDir" -ForegroundColor Cyan
Write-Host "Files backed up:" -ForegroundColor Cyan
$coreCount = (Get-ChildItem "$BackupDir/core/*.ts" -ErrorAction SilentlyContinue).Count
$serviceCount = (Get-ChildItem "$BackupDir/services/*.ts" -ErrorAction SilentlyContinue).Count
$testCount = (Get-ChildItem "$BackupDir/tests/*.test.ts" -ErrorAction SilentlyContinue).Count
Write-Host "   Core files: $coreCount" -ForegroundColor White
Write-Host "   Service files: $serviceCount" -ForegroundColor White
Write-Host "   Test files: $testCount" -ForegroundColor White
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "   - MANIFEST.md: Backup details" -ForegroundColor White
Write-Host "   - restore.ps1: Restoration script" -ForegroundColor White
Write-Host "   - VERIFICATION.md: Verification checklist" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review $BackupDir/VERIFICATION.md" -ForegroundColor White
Write-Host "2. Commit backup to git" -ForegroundColor White
Write-Host "3. Begin implementation" -ForegroundColor White
