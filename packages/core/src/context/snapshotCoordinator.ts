/**
 * SnapshotCoordinator
 *
 * Orchestrates snapshot storage, restore, and runtime config updates.
 */
import type {
  ContextSnapshot,
  ConversationContext,
  MemoryGuard,
  SnapshotConfig,
  SnapshotManager,
  SnapshotStorage,
  ContextPool,
} from './types.js';

type EmitFn = (event: string, payload?: unknown) => void;

interface SnapshotCoordinatorOptions {
  snapshotManager: SnapshotManager;
  snapshotStorage: SnapshotStorage;
  contextPool: ContextPool;
  memoryGuard: MemoryGuard;
  getContext: () => ConversationContext;
  setContext: (context: ConversationContext) => void;
  emit: EmitFn;
  sessionId: string;
}

export class SnapshotCoordinator {
  private readonly snapshotManager: SnapshotManager;
  private readonly snapshotStorage: SnapshotStorage;
  private readonly contextPool: ContextPool;
  private readonly memoryGuard: MemoryGuard;
  private readonly getContext: () => ConversationContext;
  private readonly setContext: (context: ConversationContext) => void;
  private readonly emit: EmitFn;
  private readonly sessionId: string;

  constructor(options: SnapshotCoordinatorOptions) {
    this.snapshotManager = options.snapshotManager;
    this.snapshotStorage = options.snapshotStorage;
    this.contextPool = options.contextPool;
    this.memoryGuard = options.memoryGuard;
    this.getContext = options.getContext;
    this.setContext = options.setContext;
    this.emit = options.emit;
    this.sessionId = options.sessionId;
  }

  /**
   * Persist a snapshot of the current context.
   */
  async createSnapshot(): Promise<ContextSnapshot> {
    const snapshot = await this.snapshotManager.createSnapshot(this.getContext());
    this.emit('snapshot-created', snapshot);
    return snapshot;
  }

  /**
   * Restore a snapshot and rehydrate pool + guard state.
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const context = await this.snapshotManager.restoreSnapshot(snapshotId);
    this.setContext(context);

    this.contextPool.setCurrentTokens(context.tokenCount);
    this.memoryGuard.setContext(context);

    this.emit('snapshot-restored', { snapshotId, context });
  }

  /**
   * Enumerate persisted snapshots for the current session.
   */
  async listSnapshots(): Promise<ContextSnapshot[]> {
    return await this.snapshotManager.listSnapshots(this.sessionId);
  }

  /**
   * Load a snapshot payload for inspection or debugging.
   */
  async getSnapshot(snapshotId: string): Promise<ContextSnapshot | null> {
    try {
      return await this.snapshotStorage.load(snapshotId);
    } catch (error) {
      console.error(`Failed to load snapshot ${snapshotId}:`, error);
      return null;
    }
  }

  /**
   * Update snapshot manager configuration at runtime.
   */
  updateConfig(config: SnapshotConfig): void {
    this.snapshotManager.updateConfig(config);
  }
}
