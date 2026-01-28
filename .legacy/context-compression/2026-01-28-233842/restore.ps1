# Restoration script for legacy context compression system

Write-Host 'WARNING: This will restore the legacy context compression system' -ForegroundColor Red
Write-Host 'This will overwrite the new implementation!' -ForegroundColor Red
$confirm = Read-Host 'Are you sure? (yes/no)'

if ($confirm -ne 'yes') {
    Write-Host 'Restoration cancelled' -ForegroundColor Yellow
    exit 1
}

# Get the root directory
$RootDir = (Get-Item (Split-Path -Parent $PSScriptRoot)).Parent.Parent.FullName

# Restore core files
Write-Host 'Restoring core files...' -ForegroundColor Yellow
if (Test-Path 'core/*.ts') {
    Copy-Item 'core/*.ts' "$RootDir/packages/core/src/context/" -Force
}

# Restore service files
Write-Host 'Restoring service files...' -ForegroundColor Yellow
if (Test-Path 'services/*.ts') {
    Copy-Item 'services/*.ts' "$RootDir/packages/core/src/services/" -Force
}

# Restore tests
Write-Host 'Restoring test files...' -ForegroundColor Yellow
if (Test-Path 'tests/*.test.ts') {
    Copy-Item 'tests/*.test.ts' "$RootDir/packages/core/src/context/__tests__/" -Force
}

Write-Host 'Legacy system restored' -ForegroundColor Green
Write-Host 'Run npm run build to rebuild' -ForegroundColor Cyan
