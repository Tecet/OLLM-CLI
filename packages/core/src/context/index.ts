/**
 * Context Management System
 * 
 * This module provides memory-efficient conversation management for local LLMs
 * through VRAM monitoring, dynamic context sizing, snapshots, compression,
 * and memory safety guards.
 */

// Export all types and interfaces
export * from './types.js';

// Export GPU detector
export * from './gpuDetector.js';

// Export VRAM monitor
export * from './vramMonitor.js';

// Export token counter
export * from './tokenCounter.js';

// Export context pool
export * from './contextPool.js';

// Export snapshot storage
export * from './snapshotStorage.js';

// Export snapshot manager
export * from './snapshotManager.js';

// Export compression service
export * from './compressionService.js';

// Export memory guard
export * from './memoryGuard.js';

// Export context manager
export * from './contextManager.js';
