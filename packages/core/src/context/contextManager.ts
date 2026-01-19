/**
 * Context Manager
 * 
 * Main orchestration layer that coordinates all context management services:
 * - VRAM Monitor: Tracks GPU memory availability
 * - Token Counter: Measures context usage
 * - Context Pool: Manages dynamic sizing
 * - Snapshot Manager: Handles conversation checkpoints
 * - Compression Service: Reduces context size
 * - Memory Guard: Prevents OOM errors
 */

import { EventEmitter } from 'events';
import type {
  ContextManager,
  ContextConfig,
  ContextUsage,
  Message,
  ContextSnapshot,
  ConversationContext,
  VRAMMonitor,
  TokenCounter,
  ContextPool,
  SnapshotManager,
  ICompressionService,
  MemoryGuard,
  SnapshotStorage,
  ModelInfo
} from './types.js';
import { MemoryLevel } from './types.js';
import { createVRAMMonitor } from './vramMonitor.js';
import { createTokenCounter } from './tokenCounter.js';
import { createContextPool } from './contextPool.js';
import { createSnapshotManager } from './snapshotManager.js';
import { CompressionService as CompressionServiceImpl } from './compressionService.js';
import { createMemoryGuard } from './memoryGuard.js';
import { createSnapshotStorage } from './snapshotStorage.js';
import { loadJitContext } from './jitDiscovery.js';

/**
 * Default context configuration
 */
const DEFAULT_CONFIG: ContextConfig = {
  targetSize: 8192,
  minSize: 2048,
  maxSize: 131072,
  autoSize: true,
  vramBuffer: 512 * 1024 * 1024, // 512MB
  kvQuantization: 'q8_0',
  compression: {
    enabled: true,
    threshold: 0.8,
    strategy: 'hybrid',
    preserveRecent: 4096,
    summaryMaxTokens: 1024
  },
  snapshots: {
    enabled: true,
    maxCount: 5,
    autoCreate: true,
    autoThreshold: 0.8
  }
};

/**
 * Conversation Context Manager Implementation
 * 
 * Orchestrates all context management services and provides a unified API
 * for conversation context operations including messages, VRAM monitoring,
 * token counting, compression, and snapshot management.
 */
export class ConversationContextManager extends EventEmitter implements ContextManager {
  public config: ContextConfig;
  public activeSkills: string[] = [];
  public activeTools: string[] = [];
  public activeHooks: string[] = [];
  public activeMcpServers: string[] = [];
  public activePrompts: string[] = [];
  
  private vramMonitor: VRAMMonitor;
  private tokenCounter: TokenCounter;
  private contextPool: ContextPool;
  private snapshotManager: SnapshotManager;
  private compressionService: ICompressionService;
  private memoryGuard: MemoryGuard;
  private snapshotStorage: SnapshotStorage;
  
  private currentContext: ConversationContext;
  private modelInfo: ModelInfo;
  private isStarted: boolean = false;
  private sessionId: string;

  constructor(
    sessionId: string,
    modelInfo: ModelInfo,
    config: Partial<ContextConfig> = {},
    services?: {
      vramMonitor?: VRAMMonitor;
      tokenCounter?: TokenCounter;
      contextPool?: ContextPool;
      snapshotStorage?: SnapshotStorage;
      snapshotManager?: SnapshotManager;
      compressionService?: ICompressionService;
      memoryGuard?: MemoryGuard;
    }
  ) {
    super();
    
    this.sessionId = sessionId;
    this.modelInfo = modelInfo;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize services (use provided or create new)
    this.vramMonitor = services?.vramMonitor || createVRAMMonitor();
    this.tokenCounter = services?.tokenCounter || createTokenCounter();
    
    // Create context pool with resize callback
    this.contextPool = services?.contextPool || createContextPool(
      {
        minContextSize: this.config.minSize,
        maxContextSize: this.config.maxSize,
        targetContextSize: this.config.targetSize,
        reserveBuffer: this.config.vramBuffer,
        kvCacheQuantization: this.config.kvQuantization,
        autoSize: this.config.autoSize
      },
      async (newSize: number) => {
        // Resize callback - update current context max tokens
        this.currentContext.maxTokens = newSize;
        this.currentContext.metadata.contextSize = newSize;
        this.emit('context-resized', { newSize });
      }
    );
    
    // Create snapshot storage and manager
    this.snapshotStorage = services?.snapshotStorage || createSnapshotStorage(sessionId);
    this.snapshotManager = services?.snapshotManager || createSnapshotManager(
      this.snapshotStorage,
      this.config.snapshots
    );
    this.snapshotManager.setSessionId(sessionId);
    
    // Create compression service
    this.compressionService = services?.compressionService || new CompressionServiceImpl();
    
    // Create memory guard
    this.memoryGuard = services?.memoryGuard || createMemoryGuard(
      this.vramMonitor,
      this.contextPool,
      {
        safetyBuffer: this.config.vramBuffer,
        thresholds: {
          soft: 0.8,
          hard: 0.9,
          critical: 0.95
        }
      }
    );
    
    // Set up memory guard with services
    this.memoryGuard.setServices({ 
      snapshot: this.snapshotManager, 
      compression: this.compressionService 
    });
    
    // Initialize current context
    this.currentContext = {
      sessionId,
      messages: [],
      systemPrompt: {
        id: `system-${Date.now()}`,
        role: 'system',
        content: '',
        timestamp: new Date()
      },
      tokenCount: 0,
      maxTokens: this.contextPool.currentSize,
      metadata: {
        model: modelInfo.parameters.toString(),
        contextSize: this.contextPool.currentSize,
        compressionHistory: []
      }
    };
    
    // Set context in memory guard
    this.memoryGuard.setContext(this.currentContext);
    
    // Set up event coordination
    this.setupEventCoordination();
  }

  /**
   * Set up event coordination between services
   */
  private setupEventCoordination(): void {
    // VRAM Monitor low memory events
    this.vramMonitor.onLowMemory(async (vramInfo) => {
      this.emit('low-memory', vramInfo);
      
      // Update context pool with new VRAM info
      this.contextPool.updateVRAMInfo(vramInfo);
      
      // If auto-size is enabled, recalculate optimal size
      if (this.config.autoSize) {
        const optimalSize = this.contextPool.calculateOptimalSize(
          vramInfo,
          this.modelInfo
        );
        
        if (optimalSize !== this.contextPool.currentSize) {
          await this.contextPool.resize(optimalSize);
        }
      }
    });
    
    // Snapshot Manager threshold callbacks
    if (this.config.snapshots.autoCreate) {
      this.snapshotManager.onContextThreshold(
        this.config.snapshots.autoThreshold,
        async () => {
          try {
            const snapshot = await this.snapshotManager.createSnapshot(
              this.currentContext
            );
            this.emit('auto-snapshot-created', snapshot);
          } catch (error) {
            this.emit('snapshot-error', error);
          }
        }
      );
    }
    
    // Snapshot Manager pre-overflow callbacks
    this.snapshotManager.onBeforeOverflow(async () => {
      this.emit('pre-overflow', {
        usage: this.getUsage(),
        context: this.currentContext
      });
    });
    
    // Memory Guard threshold callbacks
    this.memoryGuard.onThreshold(MemoryLevel.WARNING, async () => {
      this.emit('memory-warning', { level: MemoryLevel.WARNING });
      
      // Trigger compression if enabled
      if (this.config.compression.enabled) {
        await this.compress();
      }
    });
    
    this.memoryGuard.onThreshold(MemoryLevel.CRITICAL, async () => {
      this.emit('memory-critical', { level: MemoryLevel.CRITICAL });
    });
    
    this.memoryGuard.onThreshold(MemoryLevel.EMERGENCY, async () => {
      this.emit('memory-emergency', { level: MemoryLevel.EMERGENCY });
    });
    
    // Forward memory guard emergency events
    this.memoryGuard.on('emergency', (data) => {
      this.emit('emergency', data);
    });
  }

  /**
   * Start context management services
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }
    
    // Start VRAM monitoring
    this.vramMonitor.startMonitoring(5000); // Poll every 5 seconds
    
    // Get initial VRAM info and calculate optimal context size
    const vramInfo = await this.vramMonitor.getInfo();
    this.contextPool.updateVRAMInfo(vramInfo);
    
    if (this.config.autoSize) {
      const optimalSize = this.contextPool.calculateOptimalSize(
        vramInfo,
        this.modelInfo
      );
      await this.contextPool.resize(optimalSize);
      
      // Update current context
      this.currentContext.maxTokens = this.contextPool.currentSize;
      this.currentContext.metadata.contextSize = this.contextPool.currentSize;
    }
    
    this.isStarted = true;
    this.emit('started');
  }

  /**
   * Stop context management services
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }
    
    // Stop VRAM monitoring
    this.vramMonitor.stopMonitoring();
    
    this.isStarted = false;
    this.emit('stopped');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update context pool config
    if (config.targetSize !== undefined ||
        config.minSize !== undefined ||
        config.maxSize !== undefined ||
        config.autoSize !== undefined ||
        config.vramBuffer !== undefined ||
        config.kvQuantization !== undefined) {
      this.contextPool.updateConfig({
        targetContextSize: this.config.targetSize,
        minContextSize: this.config.minSize,
        maxContextSize: this.config.maxSize,
        autoSize: this.config.autoSize,
        reserveBuffer: this.config.vramBuffer,
        kvCacheQuantization: this.config.kvQuantization
      });
    }
    
    // Update snapshot manager config
    if (config.snapshots !== undefined) {
      this.snapshotManager.updateConfig(this.config.snapshots);
    }
    
    // Update memory guard config
    if (config.vramBuffer !== undefined) {
      this.memoryGuard.updateConfig({
        safetyBuffer: this.config.vramBuffer
      });
    }
    
    this.emit('config-updated', this.config);
  }

  /**
   * Get current context usage
   */
  getUsage(): ContextUsage {
    return this.contextPool.getUsage();
  }

  /**
   * Add message to context
   */
  async addMessage(message: Message): Promise<void> {
    // Count tokens in message
    const tokenCount = this.tokenCounter.countTokensCached(
      message.id,
      message.content
    );
    message.tokenCount = tokenCount;
    
    // Check if allocation is safe
    if (!this.memoryGuard.canAllocate(tokenCount)) {
      // Check memory level and trigger actions (compression, resizing, etc.)
      await this.memoryGuard.checkMemoryLevelAndAct();
      
      // Try again after memory management actions
      if (!this.memoryGuard.canAllocate(tokenCount)) {
        // FIFO Fallback: Remove oldest messages (preserving system prompt) until space is available
        // This is a "hard" truncation used when compression is disabled or insufficient
        const systemPrompt = this.currentContext.messages.find(m => m.role === 'system');
        const nonSystemMessages = this.currentContext.messages.filter(m => m.role !== 'system');
        
        while (nonSystemMessages.length > 0 && !this.memoryGuard.canAllocate(tokenCount)) {
          nonSystemMessages.shift();
          
          // Reconstruct messages to check allocation again
          this.currentContext.messages = [
            ...(systemPrompt ? [systemPrompt] : []),
            ...nonSystemMessages
          ];
          
          // Update tokens for canAllocate check
          this.currentContext.tokenCount = this.tokenCounter.countConversationTokens(
            this.currentContext.messages
          );
          this.contextPool.setCurrentTokens(this.currentContext.tokenCount);
        }

        // Final check after emergency truncation
        if (!this.memoryGuard.canAllocate(tokenCount)) {
          throw new Error(
            'Cannot add message: would exceed memory safety limit even after truncation. ' +
            'The message itself might be too large for the current context window.'
          );
        }
      }
    }
    
    // Add message to context
    this.currentContext.messages.push(message);
    this.currentContext.tokenCount += tokenCount;
    
    // Update context pool token count
    this.contextPool.setCurrentTokens(this.currentContext.tokenCount);
    
    // Check thresholds
    this.snapshotManager.checkThresholds(
      this.currentContext.tokenCount,
      this.currentContext.maxTokens
    );
    
    // Check if compression is needed (proactive check)
    if (this.config.compression.enabled) {
      const usage = this.getUsage();
      if (usage.percentage >= this.config.compression.threshold * 100) {
        await this.compress();
      }
    }
    
    this.emit('message-added', { message, usage: this.getUsage() });
  }

  /**
   * Create manual snapshot
   */
  async createSnapshot(): Promise<ContextSnapshot> {
    const snapshot = await this.snapshotManager.createSnapshot(
      this.currentContext
    );
    this.emit('snapshot-created', snapshot);
    return snapshot;
  }

  /**
   * Restore from snapshot
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const context = await this.snapshotManager.restoreSnapshot(snapshotId);
    
    // Replace current context
    this.currentContext = context;
    
    // Update context pool
    this.contextPool.setCurrentTokens(context.tokenCount);
    
    // Update memory guard
    this.memoryGuard.setContext(context);
    
    this.emit('snapshot-restored', { snapshotId, context });
  }

  /**
   * List available snapshots
   */
  async listSnapshots(): Promise<ContextSnapshot[]> {
    return await this.snapshotManager.listSnapshots(this.sessionId);
  }

  private loadedPaths: Set<string> = new Set();

  /**
   * Discover and load context for a specific path
   */
  async discoverContext(targetPath: string): Promise<void> {
    const roots = [this.snapshotStorage.getBasePath()]; // Simple root for now
    
    const result = await loadJitContext(
      targetPath,
      roots,
      this.loadedPaths
    );

    if (result.files.length === 0) {
      return;
    }

    // Add discovered instructions as a system-level message
    const discoveryMessage: Message = {
      id: `jit-discovery-${Date.now()}`,
      role: 'system',
      content: result.instructions,
      timestamp: new Date()
    };

    await this.addMessage(discoveryMessage);
    
    this.emit('context-discovered', {
      path: targetPath,
      files: result.files.map((f: { path: string }) => f.path)
    });
  }

  /**
   * Trigger manual compression
   */
  async compress(): Promise<void> {
    if (this.currentContext.messages.length === 0) {
      return;
    }
    
    const strategy = {
      type: this.config.compression.strategy,
      preserveRecent: this.config.compression.preserveRecent,
      summaryMaxTokens: this.config.compression.summaryMaxTokens
    };
    
    const compressed = await this.compressionService.compress(
      this.currentContext.messages,
      strategy
    );

    // Inflation Guard: Skip update if compression actually increased token count
    if (compressed.status === 'inflated') {
      this.emit('compression-skipped', {
        reason: 'inflation',
        originalTokens: compressed.originalTokens,
        compressedTokens: compressed.compressedTokens
      });
      return;
    }
    
    // Replace messages with compressed version
    const systemMessages = this.currentContext.messages.filter(
      m => m.role === 'system'
    );
    
    this.currentContext.messages = [
      ...systemMessages,
      compressed.summary,
      ...compressed.preserved
    ];
    
    // Update token count
    const newTokenCount = this.tokenCounter.countConversationTokens(
      this.currentContext.messages
    );
    this.currentContext.tokenCount = newTokenCount;
    
    // Update context pool
    this.contextPool.setCurrentTokens(newTokenCount);
    
    // Record compression event
    this.currentContext.metadata.compressionHistory.push({
      timestamp: new Date(),
      strategy: strategy.type,
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
      ratio: compressed.compressionRatio
    });
    
    this.emit('compressed', {
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
      ratio: compressed.compressionRatio
    });
  }

  /**
   * Clear context (except system prompt)
   */
  async clear(): Promise<void> {
    const systemPrompt = this.currentContext.messages.find(
      m => m.role === 'system'
    );
    
    this.currentContext.messages = systemPrompt ? [systemPrompt] : [];
    this.currentContext.tokenCount = systemPrompt?.tokenCount || 0;
    
    // Update context pool
    this.contextPool.setCurrentTokens(this.currentContext.tokenCount);
    
    // Clear token counter cache
    this.tokenCounter.clearCache();
    
    this.emit('cleared');
  }

  /**
   * Get current context (for testing/debugging)
   */
  getContext(): ConversationContext {
    return { ...this.currentContext };
  }

  /**
   * Set active skills and corresponding tools
   */
  setActiveSkills(skills: string[]): void {
    this.activeSkills = skills;
    this.emit('active-skills-updated', { skills });
  }

  /**
   * Set active hooks
   */
  setActiveHooks(hooks: string[]): void {
    this.activeHooks = hooks;
    this.emit('active-hooks-updated', { hooks });
  }

  /**
   * Set active MCP servers
   */
  setActiveMcpServers(servers: string[]): void {
    this.activeMcpServers = servers;
    this.emit('active-mcp-updated', { servers });
  }

  /**
   * Set active tools
   */
  setActiveTools(tools: string[]): void {
    this.activeTools = tools;
    this.emit('active-tools-updated', { tools });
  }

  /**
   * Set system prompt
   */
  setSystemPrompt(content: string): void {
    const systemPrompt: Message = {
      id: `system-${Date.now()}`,
      role: 'system',
      content,
      timestamp: new Date(),
      tokenCount: this.tokenCounter.countTokensCached(
        `system-${Date.now()}`,
        content
      )
    };
    
    // Track prompts if it's a registered prompt
    if (content) {
        // This is a simplified tracking, ideally we check against a registry
        // but for now we just emit that system prompt changed
    }
    
    // Remove old system prompt if exists
    this.currentContext.messages = this.currentContext.messages.filter(
      m => m.role !== 'system'
    );
    
    // Add new system prompt at the beginning
    this.currentContext.messages.unshift(systemPrompt);
    this.currentContext.systemPrompt = systemPrompt;
    
    // Recalculate token count
    this.currentContext.tokenCount = this.tokenCounter.countConversationTokens(
      this.currentContext.messages
    );
    
    // Update context pool
    this.contextPool.setCurrentTokens(this.currentContext.tokenCount);
    
    this.emit('system-prompt-updated', { content });
  }

  /**
   * Get current system prompt
   */
  getSystemPrompt(): string {
    return this.currentContext.systemPrompt.content;
  }

  /**
   * Get current messages in context
   */
  async getMessages(): Promise<Message[]> {
    return this.currentContext.messages;
  }
}

/**
 * Create a new context manager instance
 */
export function createContextManager(
  sessionId: string,
  modelInfo: ModelInfo,
  config?: Partial<ContextConfig>
): ContextManager {
  return new ConversationContextManager(sessionId, modelInfo, config);
}
