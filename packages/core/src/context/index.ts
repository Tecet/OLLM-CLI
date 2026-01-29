/**
 * Context Management System
 *
 * This module provides memory-efficient conversation management for local LLMs
 * through VRAM monitoring, dynamic context sizing, snapshots, compression,
 * and memory safety guards.
 * 
 * SYSTEM (v0.1.1+): Uses ContextOrchestrator with LLM-based compression
 * 
 * @status REWORK - Cleaned (2026-01-29)
 * @date 2026-01-29
 * @changes Removed all legacy system exports, only exports new ContextOrchestrator system
 */

// Export all types and interfaces
export * from './types.js';

// Export shared utilities (used by both old and new systems)
export * from './gpuDetector.js';
export * from './vramMonitor.js';
export * from './tokenCounter.js';
export * from './gpuHints.js';
export * from './contextPool.js';
export * from './snapshotStorage.js';
export * from './memoryGuard.js';
export * from './HotSwapService.js';

// Export NEW SYSTEM components (v0.1.1+)
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

// Export storage types
export type {
  ActiveContext,
  CheckpointSummary,
  SnapshotData,
  SessionHistory,
  CheckpointRecord,
  StorageBoundaries as IStorageBoundaries,
} from './types/storageTypes.js';

// Export context manager factory
export { createContextManager } from './contextManagerFactory.js';
export type { ContextManagerFactoryConfig, ContextManagerFactoryResult } from './contextManagerFactory.js';

// Export migration utilities
export * from './migration/index.js';

// Export adapters
export { ContextOrchestratorAdapter } from './adapters/contextOrchestratorAdapter.js';

// Note: Legacy system (ConversationContextManager) has been moved to .legacy/
// Use migration utilities if you need to migrate old sessions/snapshots

