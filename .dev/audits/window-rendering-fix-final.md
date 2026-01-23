# Window Rendering Optimization - Final Fix

## Summary
Successfully fixed the "Rendered more hooks than during the previous render" error and applied performance optimizations to ChatTab component.

## Root Cause
The bug was introduced in commit d42c0aa (UI components cleanup) when the `packages/cli/src/ui/hooks/index.ts` file was rewritten to export new shared hooks but **removed** the exports for existing hooks:
- `useGlobalKeyboardShortcuts`
- `useTabEscapeHandler`
- `useMouse` / `MouseProvider`

Even though these hooks weren't imported from the index file directly, removing them from the barrel export caused module resolution issues that manifested as React hooks errors.

## Solution
The working solution is in commit **9f7a083** on branch `fix/window-rendering-optimization`:

1. **Restored hooks/index.ts to original state** - Only exports the three original hooks, not the new ones
2. **Applied ChatTab optimizations**:
   - Added React.memo with custom comparison function
   - Memoized layout calculations (layoutMetrics)
   - Memoized expensive buildChatLines operation
   - Memoized selected line data calculations
   - Memoized window switcher component
3. **Created performanceProfiler utility** for render profiling

## Files Changed
- `packages/cli/src/ui/hooks/index.ts` - Restored original exports
- `packages/cli/src/ui/components/tabs/ChatTab.tsx` - Applied performance optimizations
- `packages/cli/src/ui/utils/performanceProfiler.ts` - New profiling utility

## Performance Improvements
- Eliminated unnecessary re-renders with React.memo
- Reduced expensive computations with useMemo
- Stable config references prevent cascading re-renders
- Optional profiling with OLLM_PROFILE_RENDERS=true

## Testing
- ✅ Build succeeds without errors
- ✅ Application runs without hooks error
- ✅ All optimizations applied and working

## Branch Information
- Working branch: `fix/window-rendering-optimization`
- Working commit: `9f7a083`
- Pushed to GitHub: Yes

## Next Steps
1. Merge `fix/window-rendering-optimization` into `cleanup/debugging-and-polishing`
2. Mark task 21 as complete
3. Continue with remaining performance optimization tasks

## Lessons Learned
1. Barrel exports (index.ts files) can cause subtle module resolution issues
2. When debugging React hooks errors, check for:
   - Conditional hook calls
   - Hook ordering violations
   - Module loading issues from barrel exports
3. Always test after modifying barrel exports
4. Git bisect is invaluable for finding regression commits
