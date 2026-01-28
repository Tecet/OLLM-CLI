/**
 * Performance Profiler Utility
 *
 * Provides utilities for profiling React component render performance.
 * Helps identify unnecessary re-renders and expensive computations.
 *
 * Usage:
 * ```typescript
 * import { profileRender, measureTime } from './utils/performanceProfiler';
 *
 * // Profile component renders
 * function MyComponent(props) {
 *   profileRender('MyComponent', props);
 *   // ... component logic
 * }
 *
 * // Measure expensive operations
 * const result = measureTime('expensiveOperation', () => {
 *   return doExpensiveWork();
 * });
 * ```
 */

interface RenderProfile {
  componentName: string;
  renderCount: number;
  lastRenderTime: number;
  totalRenderTime: number;
  averageRenderTime: number;
  propsChanges: number;
}

const renderProfiles = new Map<string, RenderProfile>();
const ENABLE_PROFILING = process.env.OLLM_PROFILE_RENDERS === 'true';

/**
 * Profile a component render
 *
 * Tracks render count, timing, and props changes for a component.
 * Only active when OLLM_PROFILE_RENDERS=true environment variable is set.
 *
 * @param componentName - Name of the component being profiled
 * @param props - Component props (used to detect changes)
 */
export function profileRender(componentName: string, props?: Record<string, unknown>): void {
  if (!ENABLE_PROFILING) return;

  const startTime = performance.now();

  // Get or create profile
  let profile = renderProfiles.get(componentName);
  if (!profile) {
    profile = {
      componentName,
      renderCount: 0,
      lastRenderTime: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      propsChanges: 0,
    };
    renderProfiles.set(componentName, profile);
  }

  // Track render
  profile.renderCount++;

  // Detect props changes (simple shallow comparison)
  if (props) {
    const prevProps = (profile as any)._prevProps;
    if (prevProps) {
      const changed = Object.keys(props).some((key) => props[key] !== prevProps[key]);
      if (changed) {
        profile.propsChanges++;
      }
    }
    (profile as any)._prevProps = props;
  }

  // Schedule timing update for after render
  queueMicrotask(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    profile!.lastRenderTime = renderTime;
    profile!.totalRenderTime += renderTime;
    profile!.averageRenderTime = profile!.totalRenderTime / profile!.renderCount;
  });
}

/**
 * Measure execution time of a function
 *
 * @param label - Label for the measurement
 * @param fn - Function to measure
 * @returns Result of the function
 */
export function measureTime<T>(label: string, fn: () => T): T {
  if (!ENABLE_PROFILING) return fn();

  const startTime = performance.now();
  const result = fn();
  const endTime = performance.now();
  const duration = endTime - startTime;

  if (duration > 10) {
    // Only log if > 10ms
    console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
  }

  return result;
}

/**
 * Get render profile for a component
 *
 * @param componentName - Name of the component
 * @returns Render profile or undefined if not found
 */
export function getRenderProfile(componentName: string): RenderProfile | undefined {
  return renderProfiles.get(componentName);
}

/**
 * Get all render profiles
 *
 * @returns Map of all render profiles
 */
export function getAllRenderProfiles(): Map<string, RenderProfile> {
  return new Map(renderProfiles);
}

/**
 * Print render statistics to console
 *
 * Useful for debugging performance issues.
 * Shows components with high render counts or slow render times.
 */
export function printRenderStats(): void {
  if (!ENABLE_PROFILING) {
    console.log('[Performance] Profiling is disabled. Set OLLM_PROFILE_RENDERS=true to enable.');
    return;
  }

  console.log('\n=== Render Performance Statistics ===\n');

  const profiles = Array.from(renderProfiles.values()).sort(
    (a, b) => b.renderCount - a.renderCount
  );

  for (const profile of profiles) {
    console.log(`${profile.componentName}:`);
    console.log(`  Renders: ${profile.renderCount}`);
    console.log(`  Props Changes: ${profile.propsChanges}`);
    console.log(`  Avg Time: ${profile.averageRenderTime.toFixed(2)}ms`);
    console.log(`  Last Time: ${profile.lastRenderTime.toFixed(2)}ms`);
    console.log(`  Total Time: ${profile.totalRenderTime.toFixed(2)}ms`);

    // Warn about potential issues
    if (profile.renderCount > 100) {
      console.log(`  ⚠️  High render count - consider memoization`);
    }
    if (profile.averageRenderTime > 16) {
      console.log(`  ⚠️  Slow renders - consider optimization`);
    }
    if (profile.renderCount > profile.propsChanges * 2) {
      console.log(`  ⚠️  Many renders without props changes - check dependencies`);
    }

    console.log('');
  }
}

/**
 * Reset all render profiles
 *
 * Useful for starting fresh measurements.
 */
export function resetRenderProfiles(): void {
  renderProfiles.clear();
}

/**
 * Hook to profile a component's renders
 *
 * @param componentName - Name of the component
 * @param props - Component props
 */
export function useRenderProfile(componentName: string, props?: Record<string, unknown>): void {
  profileRender(componentName, props);
}
