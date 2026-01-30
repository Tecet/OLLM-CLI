# Files Tab Fix - Files Not Showing

## Problem

Files tab was showing only folders, not files. Folders weren't expanding to show subfolders and files when selected.

## Root Cause

The issue was with React's memoization and state synchronization:

1. **Memo dependency missing**: The `visibleNodes` memo in `FileTreeView.tsx` wasn't recalculating when directories were expanded because it didn't depend on `treeState.expandedPaths`
2. **Initialization order**: Root was being set before children were loaded, so the initial tree had no children
3. **State sync**: The context's `expandedPaths` Set and the node's `expanded` property needed to be updated in the correct order

## Solution

### 1. Fixed Initialization Order (FilesTab.tsx)

```typescript
// OLD: Set root first, then expand
setRoot(rootNode);
await fileTreeService.expandDirectory(rootNode, ...);
expandDirectory(rootNode.path);

// NEW: Expand first, then set root
await fileTreeService.expandDirectory(rootNode, ...);
expandDirectory(rootNode.path);
setRoot(rootNode);
```

### 2. Added Memo Dependency (FileTreeView.tsx)

```typescript
// OLD: Missing expandedPaths dependency
const visibleNodes = React.useMemo(() => {
  // ...
}, [treeState.root, treeState.scrollOffset, treeState.windowSize, fileTreeService]);

// NEW: Added expandedPaths to trigger recalculation
const visibleNodes = React.useMemo(() => {
  // ...
}, [
  treeState.root,
  treeState.scrollOffset,
  treeState.windowSize,
  treeState.expandedPaths,
  fileTreeService,
]);
```

### 3. Fixed Expansion Order (FileTreeView.tsx)

```typescript
// OLD: Mark as expanded first (optimistic)
expandDirectory(selectedNode.path);
await fileTreeService.expandDirectory(selectedNode, ...);

// NEW: Load children first, then mark as expanded
await fileTreeService.expandDirectory(selectedNode, ...);
expandDirectory(selectedNode.path);
```

## How It Works Now

1. **Initial Load**:
   - Build tree with empty children arrays
   - Expand root directory (loads children from filesystem)
   - Mark root as expanded in context
   - Set root in context (triggers render with children)

2. **User Expands Folder**:
   - User presses Enter on folder
   - `fileTreeService.expandDirectory()` loads children and sets `node.expanded = true`
   - `expandDirectory()` adds path to context's `expandedPaths` Set
   - Context state change triggers re-render
   - `visibleNodes` memo recalculates (because `expandedPaths` changed)
   - `getFlattenedTree()` includes children (because `node.expanded = true`)
   - UI shows files and subfolders

## Files Modified

- `packages/cli/src/ui/components/tabs/FilesTab.tsx`
- `packages/cli/src/ui/components/file-explorer/FileTreeView.tsx`

## Testing

- [x] Files tab shows root directory
- [x] Root directory shows files and folders
- [x] Folders expand on Enter key
- [x] Expanded folders show subfolders and files
- [x] Arrow keys navigate through tree
- [x] Left arrow collapses folders
- [x] Right arrow expands folders
