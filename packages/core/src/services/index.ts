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
export { DynamicContextInjector } from './dynamicContextInjector.js';
export { ChatCompressionService } from './chatCompressionService.js';
export { LoopDetectionService } from './loopDetectionService.js';
export {
  createGPUMonitor,
  DefaultGPUMonitor,
  type GPUMonitor,
  type GPUInfo,
  type GPUVendor,
} from './gpuMonitor.js';

// Export error sanitization utilities
export {
  sanitizeErrorMessage,
  sanitizeError,
  sanitizeValue,
  containsSensitiveData,
} from './errorSanitization.js';

// Export reasoning parser
export {
  ReasoningParser,
  type ReasoningBlock,
  type ParserState,
  type ParseResult,
} from './reasoningParser.js';

// Export metrics collector
export {
  MetricsCollector,
  type ProviderMetadata,
} from './metricsCollector.js';

// Export model management service
export {
  ModelManagementService,
  type ExtendedModelInfo,
  type ModelCapabilities,
  type ModelStatus,
  type ProgressEvent,
  type ProgressCallback,
  type ModelManagementServiceConfig,
} from './modelManagementService.js';

// Export memory service
export {
  MemoryService,
  type MemoryEntry,
  type MemoryCategory,
  type MemorySource,
  type RememberOptions,
  type MemoryServiceConfig,
} from './memoryService.js';

// Export template service
export {
  TemplateService,
  type Template,
  type TemplateInfo,
  type VariableDefinition,
  type TemplateServiceConfig,
} from './templateService.js';

// Export comparison service
export {
  ComparisonService,
  type ComparisonResult,
  type ModelResult,
} from './comparisonService.js';

// Export project profile service
export {
  ProjectProfileService,
  type ProjectProfile,
  type BuiltInProfile,
  type ProjectProfileServiceConfig,
} from './projectProfileService.js';

// Export hook service
export {
  HookService,
  type HookServiceConfig,
} from './hookService.js';

// Export service container
export {
  ServiceContainer,
  createServiceContainer,
  type ServiceContainerConfig,
  type CoreConfig,
  type ModelManagementConfig,
  type MemoryConfig,
  type ProjectConfig,
  type HookConfig,
} from './serviceContainer.js';
