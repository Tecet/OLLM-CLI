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

// Export mock provider and utilities
export {
  MockProvider,
  createSimpleMockProvider,
  createToolCallMockProvider,
  createErrorMockProvider,
  createDelayedMockProvider,
  type MockProviderConfig,
} from './mockProvider.js';

// Export test helpers
export {
  isServerAvailable,
  getServerUrl,
  skipIfNoServer,
  measureTestTime,
  assertTestSpeed,
  delay,
  waitFor,
  createCleanupTracker,
  createResourceTracker,
  DEFAULT_SERVER_URL,
  type ServerDetection,
  type TestExecutionResult,
  type TestFailure,
  type ResourceTracker,
} from './testHelpers.js';

// Export test fixtures
export {
  createTestMessage as createFixtureMessage,
  createTestToolCall,
  createTestModel,
  createCoreMessage,
  createImageMessage,
  createToolResultMessage,
  createCoreToolCall,
  fixtureMessages,
  fixtureTools,
  fixtureModels,
  fixtureStreamEvents,
  extendedFixtureMessages,
  extendedFixtureTools,
  extendedFixtureModels,
  createTextChunkSequence,
  createToolCallSequence,
  generateRandomString,
  generateRandomMessage,
  generateMessageSequence,
  generateRandomToolCall,
  generateRandomModel,
  assertValidMessage,
  assertValidToolCall,
  assertValidModelInfo,
  assertValidToolSchema,
  messagesEqual,
  toolCallsEqual,
  type TestMessage,
  type TestToolCall,
} from './fixtures.js';

// Export UI test helpers
export {
  stripAnsi,
  getTextContent,
  frameContains,
  frameMatches,
  countOccurrences,
  getLines,
  getLine,
  isEmptyFrame,
  KeyboardInput,
  typeText,
  typeAndSubmit,
  waitForCondition,
  waitForText,
  waitForPattern,
  waitForFrameUpdate,
  mockTheme,
  mockKeybinds,
  createTestWrapper,
  UIAssertions,
  UIPerformance,
  UISnapshot,
  UIState,
  UITestHelpers,
} from './uiTestHelpers.js';

// Export compatibility matrix infrastructure
export {
  TestResult,
  CompatibilityTestRunner,
  CompatibilityMatrixGenerator,
  createCompatibilityTestRunner,
  createCompatibilityMatrixGenerator,
  type CompatibilityTest,
  type CompatibilityMatrix,
  type CompatibilityTestConfig,
  type CapabilityTestFn,
} from './compatibilityMatrix.js';
