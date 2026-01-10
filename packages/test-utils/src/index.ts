// Test utilities package entry point

/**
 * Simple test helper to verify cross-package imports work
 */
export function createTestMessage(message: string): string {
  return `[TEST] ${message}`;
}

/**
 * Test helper to verify package is importable
 */
export const TEST_UTILS_VERSION = '0.1.0';
