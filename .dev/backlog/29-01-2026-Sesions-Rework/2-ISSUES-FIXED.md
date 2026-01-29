# Issues Fixed - 2026-01-29

## Critical Issues

### 1. Provider Validation Missing
**Problem**: Factory didn't validate provider parameter  
**Fix**: Added validation, throws error if missing  
**Impact**: Prevents silent failures

### 2. Wrong Tier Calculation
**Problem**: 8K context calculated as TIER_1_MINIMAL  
**Fix**: Correct calculation (8K = TIER_2_BASIC)  
**Impact**: Correct tier-specific prompts loaded

### 3. Context Size Display Wrong
**Problem**: UI showed 6963 (ollama limit) instead of 8K  
**Fix**: Display full size, use ollama limit internally  
**Impact**: User sees correct context size

### 4. Empty System Prompts
**Problem**: System prompts not loading  
**Fix**: Integrated real PromptOrchestrator  
**Impact**: Tier-specific prompts load correctly

### 5. Ollama Limit Not Exposed
**Problem**: No way to get pre-calculated 85% value  
**Fix**: Added getOllamaContextLimit() method  
**Impact**: /test prompt uses correct limit

## ContextOrchestrator Issues

### 6. Snapshot Restoration Not Implemented
**Problem**: Method only logged, didn't restore  
**Fix**: Properly restores messages and checkpoints  
**Impact**: Core feature (FR-3, FR-9) now works

### 7. Snapshot Count Hardcoded
**Problem**: Returned 0 instead of actual count  
**Fix**: Queries actual count from storage  
**Impact**: Monitoring shows correct info

### 8. Emergency Actions Incomplete
**Problem**: Didn't update active context  
**Fix**: Properly logs success (lifecycle handles updates)  
**Impact**: Emergency situations handled correctly

## ChatClient Issues

### 9. Manual Message Management
**Problem**: ChatClient managed messages directly  
**Fix**: Delegates to ContextOrchestrator  
**Impact**: Single source of truth

### 10. Duplicate Context Logic
**Problem**: Token counting in multiple places  
**Fix**: Removed duplicates  
**Impact**: Cleaner, less bugs

### 11. Input Preprocessing Never Used
**Problem**: 80 lines of dead code  
**Fix**: Removed  
**Impact**: Cleaner codebase

### 12. Pre-Send Validation Duplicate
**Problem**: Validation in both ChatClient and ContextOrchestrator  
**Fix**: Removed from ChatClient  
**Impact**: Single validation point

## TypeScript Errors

### 13. Missing contextModules Import
**Problem**: Moved to legacy but still imported  
**Fix**: Defined ContextModuleOverrides locally  
**Impact**: No import errors

### 14. Legacy Exports in index.ts
**Problem**: Exported removed functions  
**Fix**: Removed createSnapshotManager, CompressionService exports  
**Impact**: Clean exports

### 15. CLI Using Removed Function
**Problem**: ContextManagerContext used createSnapshotManager  
**Fix**: Removed old code, uses PromptsSnapshotManager  
**Impact**: No errors

## Total Issues Fixed: 15
