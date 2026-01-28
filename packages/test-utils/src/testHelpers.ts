/**
 * Test helper utilities for common test operations.
 */

/**
 * Server detection for integration tests.
 */
export interface ServerDetection {
  isServerAvailable(): Promise<boolean>;
  getServerUrl(): string;
  skipIfNoServer(): () => Promise<boolean>;
}

/**
 * Default server URL for integration tests.
 */
export const DEFAULT_SERVER_URL = process.env.OLLM_TEST_SERVER || 'http://localhost:11434';

/**
 * Check if a local LLM server is available.
 */
export async function isServerAvailable(serverUrl: string = DEFAULT_SERVER_URL): Promise<boolean> {
  try {
    const response = await fetch(`${serverUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the server URL for integration tests.
 */
export function getServerUrl(): string {
  return DEFAULT_SERVER_URL;
}

/**
 * Create a skip condition function for integration tests.
 * Returns a function that checks server availability and logs skip message.
 */
export function skipIfNoServer(serverUrl: string = DEFAULT_SERVER_URL) {
  return async () => {
    const available = await isServerAvailable(serverUrl);
    if (!available) {
      console.log(
        'DEBUG: skipIfNoServer called, available=false, NODE_ENV=' +
          process.env.NODE_ENV +
          ', VITEST=' +
          process.env.VITEST
      );
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        console.log('⚠️  Skipping: Local LLM server not available');
        console.log(`   Set OLLM_TEST_SERVER or start server at ${serverUrl}`);
      }
      return true;
    }
    return false;
  };
}

/**
 * Test execution result tracking.
 */
export interface TestExecutionResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number; // milliseconds
  coverage?: {
    lines: number; // percentage
    functions: number; // percentage
    branches: number; // percentage
    statements: number; // percentage
  };
}

/**
 * Test failure information.
 */
export interface TestFailure {
  testName: string;
  testFile: string;
  errorMessage: string;
  stackTrace: string;
  expected: unknown;
  actual: unknown;
}

/**
 * Helper to measure test execution time.
 */
export async function measureTestTime<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Helper to verify test execution speed.
 */
export function assertTestSpeed(duration: number, maxMs: number, testName: string): void {
  if (duration > maxMs) {
    throw new Error(
      `Test "${testName}" took ${duration.toFixed(2)}ms, exceeding limit of ${maxMs}ms`
    );
  }
}

/**
 * Helper to create a delay for testing async operations.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to wait for a condition to be true.
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await delay(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Helper to create a cleanup function that tracks cleanup calls.
 */
export function createCleanupTracker(): {
  cleanup: () => void;
  wasCleanedUp: () => boolean;
  reset: () => void;
} {
  let cleanedUp = false;

  return {
    cleanup: () => {
      cleanedUp = true;
    },
    wasCleanedUp: () => cleanedUp,
    reset: () => {
      cleanedUp = false;
    },
  };
}

/**
 * Helper to verify resource cleanup.
 */
export interface ResourceTracker {
  track(resource: { cleanup: () => void | Promise<void> }): void;
  cleanupAll(): Promise<void>;
  hasUncleaned(): boolean;
}

export function createResourceTracker(): ResourceTracker {
  const resources: Array<{ cleanup: () => void | Promise<void>; cleaned: boolean }> = [];

  return {
    track(resource) {
      resources.push({ cleanup: resource.cleanup, cleaned: false });
    },
    async cleanupAll() {
      for (const resource of resources) {
        // Only cleanup if not already cleaned (idempotency)
        if (!resource.cleaned) {
          await resource.cleanup();
          resource.cleaned = true;
        }
      }
    },
    hasUncleaned() {
      return resources.some((r) => !r.cleaned);
    },
  };
}
