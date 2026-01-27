import { CheckpointManager } from './checkpointManager.js';
import { CompressionCoordinator } from './compressionCoordinator.js';
import { CompressionService as CompressionServiceImpl } from './compressionService.js';
import { createMemoryGuard } from './memoryGuard.js';
import { MessageStore } from './messageStore.js';
import { SnapshotCoordinator } from './snapshotCoordinator.js';
import { createSnapshotManager } from './snapshotManager.js';
import { createSnapshotStorage } from './snapshotStorage.js';

import type {
  ContextConfig,
  ContextPool,
  ContextUsage,
  ConversationContext,
  ICompressionService,
  MemoryGuard,
  ModeProfile,
  SnapshotManager,
  SnapshotStorage,
  ContextTier,
  TokenCounter,
  VRAMMonitor,
} from './types.js';

type EmitFn = (event: string, payload?: unknown) => void;

export interface ContextModules {
  checkpointManager: CheckpointManager;
  compressionCoordinator: CompressionCoordinator;
  compressionService: ICompressionService;
  memoryGuard: MemoryGuard;
  messageStore: MessageStore;
  snapshotCoordinator: SnapshotCoordinator;
  snapshotManager: SnapshotManager;
  snapshotStorage: SnapshotStorage;
  /** Provide root paths for JIT discovery and persistence lookups. */
  getPersistenceRoots: () => string[];
  /** Register handlers that bridge lifecycle events to context services. */
  registerHandlers: (config: ContextConfig) => void;
  /** Apply runtime config changes to modules. */
  updateConfig: (config: ContextConfig) => void;
}

export interface ContextModuleOverrides {
  snapshotStorage?: SnapshotStorage;
  snapshotManager?: SnapshotManager;
  compressionService?: ICompressionService;
  memoryGuard?: MemoryGuard;
}

interface ContextModuleOptions {
  sessionId: string;
  config: ContextConfig;
  vramMonitor: VRAMMonitor;
  tokenCounter: TokenCounter;
  contextPool: ContextPool;
  getContext: () => ConversationContext;
  setContext: (context: ConversationContext) => void;
  getUsage: () => ContextUsage;
  getBudget: () => import('./types.js').ContextBudget;
  getTierConfig: () => { tier: ContextTier; strategy: string; maxCheckpoints: number };
  getModeProfile: () => ModeProfile;
  emit: EmitFn;
  isTestEnv: boolean;
  services?: ContextModuleOverrides;
}

/**
 * Create snapshot/compression related modules as a group so the manager stays lean.
 */
export function createContextModules(options: ContextModuleOptions): ContextModules {
  const snapshotStorage = options.services?.snapshotStorage || createSnapshotStorage();
  const snapshotManager = options.services?.snapshotManager || createSnapshotManager(
    snapshotStorage,
    options.config.snapshots
  );
  snapshotManager.setSessionId(options.sessionId);

  const compressionService = options.services?.compressionService || new CompressionServiceImpl();

  const memoryGuard = options.services?.memoryGuard || createMemoryGuard(
    options.vramMonitor,
    options.contextPool,
    {
      safetyBuffer: options.config.vramBuffer,
      thresholds: {
        soft: 0.8,
        hard: 0.9,
        critical: 0.95
      }
    }
  );

  memoryGuard.setServices({
    snapshot: snapshotManager,
    compression: compressionService
  });

  const checkpointManager = new CheckpointManager({
    getContext: options.getContext,
    tokenCounter: options.tokenCounter,
    emit: options.emit
  });

  const compressionCoordinator = new CompressionCoordinator({
    config: options.config,
    getContext: options.getContext,
    getUsage: options.getUsage,
    getTierConfig: options.getTierConfig,
    getModeProfile: options.getModeProfile,
    snapshotManager,
    compressionService,
    tokenCounter: options.tokenCounter,
    contextPool: options.contextPool,
    emit: options.emit,
    checkpointManager,
    isTestEnv: options.isTestEnv
  });

  const messageStore = new MessageStore({
    config: options.config,
    getContext: options.getContext,
    getUsage: options.getUsage,
    getBudget: options.getBudget,
    tokenCounter: options.tokenCounter,
    contextPool: options.contextPool,
    memoryGuard,
    snapshotManager,
    emit: options.emit,
    compress: () => compressionCoordinator.compress(),
    isAutoSummaryRunning: () => compressionCoordinator.isAutoSummaryRunning(),
    createSnapshot: () => Promise.resolve(),
    isTestEnv: options.isTestEnv
  });

  const snapshotCoordinator = new SnapshotCoordinator({
    snapshotManager,
    snapshotStorage,
    contextPool: options.contextPool,
    memoryGuard,
    getContext: options.getContext,
    setContext: (context: ConversationContext) => {
      options.setContext(context);
      messageStore.resetSnapshotTracking();
    },
    emit: options.emit,
    sessionId: options.sessionId
  });

  messageStore.setCreateSnapshot(() => snapshotCoordinator.createSnapshot());

  return {
    checkpointManager,
    compressionCoordinator,
    compressionService,
    memoryGuard,
    messageStore,
    snapshotCoordinator,
    snapshotManager,
    snapshotStorage,
    getPersistenceRoots: () => [snapshotStorage.getBasePath()],
    registerHandlers: (config) => {
      compressionCoordinator.registerSnapshotHandlers(config.snapshots);
      compressionCoordinator.registerMemoryGuard(memoryGuard);
    },
    updateConfig: (config) => {
      snapshotCoordinator.updateConfig(config.snapshots);
    }
  };
}
