/**
 * Context Management System
 *
 * This module provides memory-efficient conversation management for local LLMs
 * through VRAM monitoring, dynamic context sizing, snapshots, compression,
 * and memory safety guards.
 * 
 * NEW SYSTEM (v0.1.1+): Uses ContextOrchestrator with LLM-based compression
 * LEGACY SYSTEM: Available for backward compatibility (set feature flags to false)
 */

// Export all types and interfaces
export * from './types.js';

// Export GPU detector
export * from './gpuDetector.js';

// Export VRAM monitor
export * from './vramMonitor.js';

// Export token counter
export * from './tokenCounter.js';

// Export GPU hint helpers
export * from './gpuHints.js';

// Export context pool
export * from './contextPool.js';

// Export snapshot storage
export * from './snapshotStorage.js';

// Export snapshot manager
export * from './snapshotManager.js';

// Export compression service (legacy - for backward compatibility)
export * from './compressionService.js';

// Export memory guard
export * from './memoryGuard.js';

// Export context manager (legacy - for backward compatibility)
// Note: Legacy createContextManager is NOT exported to avoid conflicts with factory
// Use the factory createContextManager from contextManagerFactory.js instead
export { ConversationContextManager } from './contextManager.js';

// Export hot swap service
export * from './HotSwapService.js';

// Export new system components (v0.1.1+)
// Note: Some types may conflict with legacy exports - use explicit imports if needed
export { ContextOrchestrator } from './orchestration/contextOrchestrator.js';
export type { ContextOrchestratorConfig } from './orchestration/contextOrchestrator.js';

export { ActiveContextManager } from './storage/activeContextManager.js';
export { SessionHistoryManager } from './storage/sessionHistoryManager.js';
export { SnapshotLifecycle } from './storage/snapshotLifecycle.js';
export { StorageBoundariesImpl as StorageBoundaries } from './storage/storageBoundaries.js';

export { CompressionEngine } from './compression/compressionEngine.js';
export { CompressionPipeline } from './compression/compressionPipeline.js';
export { SummarizationService } from './compression/summarizationService.js';
export { ValidationService } from './compression/validationService.js';

export { CheckpointLifecycle } from './checkpoints/checkpointLifecycle.js';
export { EmergencyActions } from './checkpoints/emergencyActions.js';

// Export storage types (avoiding conflicts)
export type {
  ActiveContext,
  CheckpointSummary,
  SnapshotData,
  SessionHistory,
  CheckpointRecord,
  StorageBoundaries as IStorageBoundaries,
} from './types/storageTypes.js';

// Export context manager factory (handles feature flags)
export { createContextManager } from './contextManagerFactory.js';
export type { ContextManagerFactoryConfig, ContextManagerFactoryResult } from './contextManagerFactory.js';

// Export migration utilities
export * from './migration/index.js';

// Export adapters
export { LegacyContextAdapter } from './adapters/legacyContextAdapter.js';
export { ContextOrchestratorAdapter } from './adapters/contextOrchestratorAdapter.js';
