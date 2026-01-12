/**
 * Services module exports
 */

// Export all types
export * from './types.js';

// Export configuration utilities
export {
  servicesConfigSchema,
  DEFAULT_SERVICES_CONFIG,
  mergeServicesConfig,
  validateServicesConfig,
  getLoopDetectionConfig,
  getSanitizationConfig,
} from './config.js';

// Export services (will be added as they are implemented)
export { ShellExecutionService } from './shellExecutionService.js';
export { ChatRecordingService } from './chatRecordingService.js';
export { EnvironmentSanitizationService } from './environmentSanitization.js';
export { FileDiscoveryService } from './fileDiscoveryService.js';
export { ContextManager } from './contextManager.js';
export { ChatCompressionService } from './chatCompressionService.js';
export { LoopDetectionService } from './loopDetectionService.js';

// Export error sanitization utilities
export {
  sanitizeErrorMessage,
  sanitizeError,
  sanitizeValue,
  containsSensitiveData,
} from './errorSanitization.js';
