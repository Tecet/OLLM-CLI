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

import { CompressionService as CompressionServiceImpl } from './compressionService.js';
import { createContextPool } from './contextPool.js';
import { loadJitContext } from './jitDiscovery.js';
import { createMemoryGuard } from './memoryGuard.js';
import { createSnapshotManager } from './snapshotManager.js';
import { createSnapshotStorage } from './snapshotStorage.js';
import { createTokenCounter } from './tokenCounter.js';
import { 
  MemoryLevel,
  ContextTier,
  TIER_CONFIGS,
  OperationalMode,
  MODE_PROFILES,
  SYSTEM_PROMPT_TEMPLATES
} from './types.js';
import { createVRAMMonitor } from './vramMonitor.js';

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
    threshold: 0.95,
    strategy: 'hybrid',
    preserveRecent: 4096,
    summaryMaxTokens: 1024
  },
  snapshots: {
    enabled: true,
    maxCount: 5,
    autoCreate: true,
    autoThreshold: 0.85 // Aligned with Ollama's 85% context limit
  }
};

// During test runs silence verbose context-manager logs unless overridden.
if (process.env.NODE_ENV === 'test' || !!process.env.VITEST) {
  if (!process.env.CONTEXT_DEBUG) {
    try {
      (console as any).debug = () => {};
      (console as any).log = () => {};
    } catch (_e) {
      // ignore
    }
  }
}

// During test runs silence verbose context-manager logs unless overridden.
if (process.env.NODE_ENV === 'test' || !!process.env.VITEST) {
  if (!process.env.CONTEXT_DEBUG) {
    try {
      (console as any).debug = () => {};
      (console as any).log = () => {};
    } catch (_e) {
      // ignore
    }
  }
}

// During test runs we silence verbose context-manager logs to keep test output clean.
// Keep warnings/errors so real failures are still visible. Use CONTEXT_DEBUG=1 to override.
if (process.env.NODE_ENV === 'test' || !!process.env.VITEST) {
  if (!process.env.CONTEXT_DEBUG) {
    try {
      (console as any).debug = () => {};
      (console as any).log = () => {};
    } catch (_e) {
      // ignore
    }
  }
}

const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

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
  private inflightTokens: number = 0;
  private modelInfo: ModelInfo;
  private isStarted: boolean = false;
  private sessionId: string;
  private autoSummaryRunning: boolean = false;
  private lastAutoSummaryAt: number | null = null;
  private AUTO_SUMMARY_COOLDOWN_MS: number = 60000; // EMERGENCY FIX #3: Increased from 5000 to 60000 (60 seconds)
  private lastSnapshotTokens: number = 0;
  private messagesSinceLastSnapshot: number = 0;

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
        
        // Update actual context tier based on new size
        const newTierConfig = this.detectContextTier();
        const previousActualTier = this.actualContextTier;
        this.actualContextTier = newTierConfig.tier;
        this.currentTier = newTierConfig.tier;
        this.tierConfig = newTierConfig;
        
        // Emit resize event with tier information
        this.emit('context-resized', { 
          newSize,
          previousActualTier,
          newActualTier: this.actualContextTier,
          effectivePromptTier: this.getEffectivePromptTier(),
          promptTierStable: this.config.autoSize // Prompt tier is stable when auto-sizing
        });
        
        // Note: We do NOT call updateSystemPrompt() here
        // When auto-sizing is enabled, effective prompt tier stays locked to hardware capability
        // When auto-sizing is disabled, user manually controls context size so no auto-resize happens
      }
    );
    
    // Create snapshot storage and manager
    // Don't pass sessionId as baseDir - let it use default ~/.ollm/context-snapshots
    this.snapshotStorage = services?.snapshotStorage || createSnapshotStorage();
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
      checkpoints: [], // Initialize checkpoint array
      architectureDecisions: [], // Initialize architecture decisions
      neverCompressed: [], // Initialize never-compressed sections
      metadata: {
        model: modelInfo.parameters.toString(),
        contextSize: this.contextPool.currentSize,
        compressionHistory: []
      }
    };
    
    // Detect initial tier and set up adaptive system
    this.tierConfig = this.detectContextTier();
    this.currentTier = this.tierConfig.tier;
    
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
          // Prevent re-entrant or rapid repeated auto-summary triggers
          const now = Date.now();
          if (this.autoSummaryRunning) {
            console.debug('[ContextManager] autoThreshold reached but auto-summary already running; skipping');
            return;
          }
          if (this.lastAutoSummaryAt && (now - this.lastAutoSummaryAt) < this.AUTO_SUMMARY_COOLDOWN_MS) {
            console.debug('[ContextManager] autoThreshold reached but within cooldown; skipping');
            return;
          }
          
          this.autoSummaryRunning = true;
          this.lastAutoSummaryAt = now;

          console.log('[ContextManager] autoThreshold reached, starting snapshot and summarization checks', { usage: this.getUsage() });
          // Emit a high-level summarizing event so UI can show progress
          this.emit('summarizing', { usage: this.getUsage() });

          // 1) Create a snapshot for recovery (store full context pre-summary)
          // MOVED UP: Create snapshot BEFORE checking if we can compress
          let snapshot: ContextSnapshot | null = null;
          try {
            snapshot = await this.snapshotManager.createSnapshot(
              this.currentContext
            );
            this.emit('auto-snapshot-created', snapshot);
            console.log('[ContextManager] auto-snapshot-created', { id: snapshot.id, tokenCount: snapshot.tokenCount });
          } catch (error) {
            console.error('[ContextManager] snapshot creation failed', error);
            this.emit('snapshot-error', error);
            // continue - summarization can still proceed even if snapshot failed
          }

          // EMERGENCY FIX #1: Check if there are enough compressible messages
          const checkpointIds = new Set((this.currentContext.checkpoints || []).map(cp => cp.summary.id));
          const compressibleMessages = this.currentContext.messages.filter(m => 
            m.role !== 'system' && 
            !checkpointIds.has(m.id)
          );
          
          const MIN_MESSAGES_TO_COMPRESS = 10; // Need at least 10 messages
          if (compressibleMessages.length < MIN_MESSAGES_TO_COMPRESS) {
            console.log('[ContextManager] Not enough compressible messages, skipping compression', {
              compressible: compressibleMessages.length,
              minimum: MIN_MESSAGES_TO_COMPRESS,
              total: this.currentContext.messages.length,
              checkpoints: this.currentContext.checkpoints?.length || 0
            });
            this.autoSummaryRunning = false; // RELEASE LOCK since we are aborting compression
            return;
          }

          // 2) Perform an LLM-based summary of the current conversation and replace
          // the context with only the system prompt + checkpoints + summary + recent (additive)
          try {
            const strategy: import('./types.js').CompressionStrategy = {
              type: 'summarize',
              preserveRecent: this.config.compression.preserveRecent,
              summaryMaxTokens: this.config.compression.summaryMaxTokens
            };

            console.log('[ContextManager] invoking compressionService.compress', { strategy });
            const compressed = await this.compressionService.compress(
              this.currentContext.messages,
              strategy
            );
            console.log('[ContextManager] compressionService.compress completed', { originalTokens: compressed.originalTokens, compressedTokens: compressed.compressedTokens, status: compressed.status });

            // EMERGENCY FIX #5: Don't create checkpoint if compression was skipped
            if (compressed.status === 'inflated') {
              console.log('[ContextManager] Compression skipped - no messages to compress', { status: compressed.status });
              this.emit('compression-skipped', { reason: compressed.status });
              return; // EXIT - don't create checkpoint!
            }

            // If summarization produced a summary message, create checkpoint and update context
            if (compressed && compressed.summary) {
              // Keep system messages
              const systemMessages = this.currentContext.messages.filter(
                m => m.role === 'system'
              );

              // Create new checkpoint from this compression
              const checkpoint: import('./types.js').CompressionCheckpoint = {
                id: `checkpoint-${Date.now()}`,
                level: 3, // Start as DETAILED (CheckpointLevel.DETAILED)
                range: `Messages 1-${this.currentContext.messages.length - compressed.preserved.length}`,
                summary: compressed.summary,
                createdAt: new Date(),
                originalTokens: compressed.originalTokens,
                currentTokens: compressed.compressedTokens,
                compressionCount: 1,
                keyDecisions: compressed.checkpoint?.keyDecisions,
                filesModified: compressed.checkpoint?.filesModified,
                nextSteps: compressed.checkpoint?.nextSteps
              };

              // Initialize checkpoints array if not exists
              if (!this.currentContext.checkpoints) {
                this.currentContext.checkpoints = [];
              }

              // Add new checkpoint to history (ADDITIVE!)
              this.currentContext.checkpoints.push(checkpoint);

              // EMERGENCY FIX #4: Enforce hard limit on checkpoint count
              const MAX_CHECKPOINTS = 10;
              if (this.currentContext.checkpoints.length > MAX_CHECKPOINTS) {
                // Remove oldest checkpoints, keeping only the most recent
                const removed = this.currentContext.checkpoints.length - MAX_CHECKPOINTS;
                this.currentContext.checkpoints = this.currentContext.checkpoints.slice(-MAX_CHECKPOINTS);
                console.log('[ContextManager] Checkpoint limit reached, removed oldest checkpoints', {
                  removed,
                  remaining: this.currentContext.checkpoints.length
                });
              }

              // Hierarchical compression: compress old checkpoints
              await this.compressOldCheckpoints();

              // Reconstruct context: system + checkpoint summaries + recent messages
              const checkpointMessages = this.currentContext.checkpoints.map(cp => cp.summary);
              
              this.currentContext.messages = [
                ...systemMessages,
                ...checkpointMessages,  // All checkpoint summaries (additive history!)
                ...compressed.preserved  // Recent messages preserved
              ];

              // Update token count and context pool
              const newTokenCount = this.tokenCounter.countConversationTokens(
                this.currentContext.messages
              );
              this.currentContext.tokenCount = newTokenCount;
              this.contextPool.setCurrentTokens(newTokenCount);

              // Record compression history (as a summarization event)
              this.currentContext.metadata.compressionHistory.push({
                timestamp: new Date(),
                strategy: 'summarize',
                originalTokens: compressed.originalTokens,
                compressedTokens: compressed.compressedTokens,
                ratio: compressed.compressionRatio
              });

              // Emit an event with the summary so UI layers can surface it
              this.emit('auto-summary-created', {
                summary: compressed.summary,
                checkpoint,
                snapshot: snapshot || null,
                originalTokens: compressed.originalTokens,
                compressedTokens: compressed.compressedTokens,
                ratio: compressed.compressionRatio
              });
              } else {
                // No summary produced; emit a warning
                console.warn('[ContextManager] compression returned no summary');
                this.emit('auto-summary-failed', { reason: 'no-summary' });
              }
          } catch (error) {
            console.error('[ContextManager] auto-summary failed', error);
            this.emit('auto-summary-failed', { error });
          } finally {
            // allow future auto-summaries after cooldown
            this.autoSummaryRunning = false;
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
    
    // Detect hardware capability tier (for prompt selection)
    // This is locked at startup and won't change during the session
    this.hardwareCapabilityTier = await this.detectHardwareCapabilityTier();
    console.log('[ContextManager] Hardware capability tier:', this.hardwareCapabilityTier);
    
    if (this.config.autoSize) {
      const optimalSize = this.contextPool.calculateOptimalSize(
        vramInfo,
        this.modelInfo
      );
      await this.contextPool.resize(optimalSize);
      
      // Update current context
      this.currentContext.maxTokens = this.contextPool.currentSize;
      this.currentContext.metadata.contextSize = this.contextPool.currentSize;
      
      // Detect actual context tier after resize
      const newTierConfig = this.detectContextTier();
      this.currentTier = newTierConfig.tier;
      this.tierConfig = newTierConfig;
      this.actualContextTier = newTierConfig.tier;
      
      // With auto-sizing, prompt tier is locked to hardware capability
      // This prevents mid-conversation prompt changes when context auto-adjusts
      console.log('[ContextManager] Auto-sizing enabled - prompt tier locked to hardware capability');
      console.log('[ContextManager] Actual context tier:', this.actualContextTier);
      console.log('[ContextManager] Effective prompt tier:', this.getEffectivePromptTier());
      
      this.emit('tier-changed', { 
        tier: this.currentTier, 
        config: this.tierConfig,
        actualContextTier: this.actualContextTier,
        hardwareCapabilityTier: this.hardwareCapabilityTier,
        effectivePromptTier: this.getEffectivePromptTier(),
        promptTierLocked: true
      });
    } else {
      // Even without autoSize, detect the actual context tier
      const tierConfig = this.detectContextTier();
      this.actualContextTier = tierConfig.tier;
      this.currentTier = tierConfig.tier;
      this.tierConfig = tierConfig;
      
      console.log('[ContextManager] Manual context sizing - using higher of hardware or actual tier');
      console.log('[ContextManager] Actual context tier:', this.actualContextTier);
      console.log('[ContextManager] Effective prompt tier:', this.getEffectivePromptTier());
    }
    
    // Apply initial system prompt based on effective tier (hardware capability) and mode
    // This prompt will remain stable throughout the session when auto-sizing is enabled
    this.updateSystemPrompt();
    
    this.isStarted = true;
    this.emit('started', {
      actualContextTier: this.actualContextTier,
      hardwareCapabilityTier: this.hardwareCapabilityTier,
      effectivePromptTier: this.getEffectivePromptTier(),
      autoSizeEnabled: this.config.autoSize,
      promptTierLocked: this.config.autoSize
    });
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
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    
    // Track if we're transitioning from auto to manual mode
    const wasAutoSize = oldConfig.autoSize;
    const isNowManual = config.autoSize === false;
    
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
      
      // If target size changed OR switching from auto to manual, update tier
      if ((config.targetSize !== undefined && config.targetSize !== oldConfig.targetSize) ||
          (wasAutoSize && isNowManual)) {
        
        // Update context max tokens if size changed
        if (config.targetSize !== undefined) {
          this.currentContext.maxTokens = config.targetSize;
        }
        
        // Detect new tier based on current context size
        const oldTier = this.actualContextTier;
        const oldEffectiveTier = this.getEffectivePromptTier();
        const newTierConfig = this.detectContextTier();
        this.actualContextTier = newTierConfig.tier;
        this.currentTier = newTierConfig.tier;
        this.tierConfig = newTierConfig;
        
        // Get new effective tier (will be different in manual mode)
        const newEffectiveTier = this.getEffectivePromptTier();
        
        // Emit tier-changed event if tier actually changed OR if effective tier changed
        if (oldTier !== this.actualContextTier || oldEffectiveTier !== newEffectiveTier) {
          console.log(`[ContextManager] Tier changed: actual ${oldTier} → ${this.actualContextTier}, effective ${oldEffectiveTier} → ${newEffectiveTier}`);
          
          this.emit('tier-changed', {
            tier: this.currentTier,
            config: this.tierConfig,
            actualContextTier: this.actualContextTier,
            hardwareCapabilityTier: this.hardwareCapabilityTier,
            effectivePromptTier: newEffectiveTier,
            promptTierLocked: this.config.autoSize
          });
          
          // Update system prompt if not using auto-sizing OR if we just switched to manual
          // (with auto-sizing, prompt stays locked to hardware capability)
          if (!this.config.autoSize) {
            console.log('[ContextManager] Manual context sizing - updating system prompt to match new tier');
            this.updateSystemPrompt();
            
            this.emit('system-prompt-updated', {
              tier: newEffectiveTier,
              mode: this.currentMode,
              prompt: this.getSystemPrompt()
            });
          }
        }
      }
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
    // Debug logging for token/accounting issues — suppress during tests
    try {
      const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
      if (!isTestEnv) {
        console.debug('[ContextManager] addMessage: tokenCount=', tokenCount, 'currentContext.tokenCount=', this.currentContext?.tokenCount, 'currentContext.maxTokens=', this.currentContext?.maxTokens);
      }
    } catch (_e) {
      // ignore logging errors
    }
    
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
    
    // Check for "Safety Snapshot" on USER messages (Proactive Data Protection)
    // We snapshot if we cross the 85% threshold (aligning with Ollama context cap)
    // This ensures we save the user's input before risking an LLM call that might fail/timeout.
    if (message.role === 'user') {
        const usage = this.getUsage();
        const usageFraction = usage.percentage / 100;
        
        // If we are over 85% and haven't snapshotted recently (debounce by 2% change or if no snapshot yet)
        const lastSnapTokens = this.lastSnapshotTokens || 0;
        const tokenDiff = Math.abs(this.currentContext.tokenCount - lastSnapTokens);
        const significantChange = tokenDiff > (this.currentContext.maxTokens * 0.02); // 2% change
        
        // Periodic Snapshot Logic (Turn-based backup)
        // Ensure we save progress every 5 user messages regardless of token usage
        this.messagesSinceLastSnapshot++;
        const turnBasedSnapshotNeeded = this.config.snapshots.enabled && 
                                        this.config.snapshots.autoCreate && 
                                        this.messagesSinceLastSnapshot >= 5;

        // Safety Snapshot (High Usage)
        const safetySnapshotNeeded = usageFraction >= 0.85 && significantChange;

        if (safetySnapshotNeeded || turnBasedSnapshotNeeded) {
            const reason = safetySnapshotNeeded ? 'User Input > 85%' : 'Periodic Backup (5 turns)';
            console.log(`[ContextManager] Safety Snapshot Triggered (${reason}) - Pre-generation backup`);
            
            this.createSnapshot().catch(err => 
                console.error('[ContextManager] Snapshot failed:', err)
            );
            
            // Updates state to reflect recent snapshot
            this.lastSnapshotTokens = this.currentContext.tokenCount;
            this.messagesSinceLastSnapshot = 0;
        }
    }

    // Check thresholds and compression - ONLY ON OLLAMA RESPONSE (assistant messages)
    // This defers the "Context is full" or "Summarizing..." events until after the LLM has responded.
    // We rely on the 85% safety buffer (targetSize vs hardware max) to handle user input overflow safely.
    if (message.role === 'assistant') {
      try {
        console.debug('[ContextManager] calling snapshotManager.checkThresholds', { currentTokens: this.currentContext.tokenCount, maxTokens: this.currentContext.maxTokens });
      } catch (_e) {
        // ignore logging errors
      }
      this.snapshotManager.checkThresholds(
        this.currentContext.tokenCount + this.inflightTokens,
        this.currentContext.maxTokens
      );
      
      // Update last snapshot tracking if snapshot manager triggered one (heuristic)
      // Ideally snapshotManager would emit an event, but we can also track it here loosely
      if (this.currentContext.tokenCount > (this.lastSnapshotTokens || 0)) {
           // We don't update here to force specific debouncing, we let the Safety Logic handle the user side
      }

      // Check if compression is needed (proactive check)
      if (this.config.compression.enabled) {
        const usage = this.getUsage();
        // Normalize to fraction (0.0-1.0) for consistent comparison
        const usageFraction = usage.percentage / 100;
        if (usageFraction >= this.config.compression.threshold) {
          await this.compress();
        }
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
    this.messagesSinceLastSnapshot = 0;
    
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

  /**
   * Get a specific snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<ContextSnapshot | null> {
    try {
      return await this.snapshotStorage.load(snapshotId);
    } catch (error) {
      console.error(`Failed to load snapshot ${snapshotId}:`, error);
      return null;
    }
  }

  private loadedPaths: Set<string> = new Set();
  
  // Adaptive Context System fields
  private currentTier: ContextTier = ContextTier.TIER_3_STANDARD;
  private tierConfig: import('./types.js').TierConfig = TIER_CONFIGS[ContextTier.TIER_3_STANDARD];
  private currentMode: OperationalMode = OperationalMode.DEVELOPER;
  private modeProfile: import('./types.js').ModeProfile = MODE_PROFILES[OperationalMode.DEVELOPER];
  
  // Hardware capability tier (based on VRAM) - determines prompt quality
  private hardwareCapabilityTier: ContextTier = ContextTier.TIER_3_STANDARD;
  // Actual context tier (based on user selection) - determines context window size
  private actualContextTier: ContextTier = ContextTier.TIER_3_STANDARD;

  /**
   * Detect context tier based on max tokens (actual context window)
   */
  private detectContextTier(): import('./types.js').TierConfig {
    const maxTokens = this.currentContext.maxTokens;
    
    if (maxTokens <= 4096) {
      return TIER_CONFIGS[ContextTier.TIER_1_MINIMAL];
    }
    if (maxTokens <= 8192) {
      return TIER_CONFIGS[ContextTier.TIER_2_BASIC];
    }
    if (maxTokens <= 32768) {
      return TIER_CONFIGS[ContextTier.TIER_3_STANDARD];
    }
    if (maxTokens <= 65536) {
      return TIER_CONFIGS[ContextTier.TIER_4_PREMIUM];
    }
    return TIER_CONFIGS[ContextTier.TIER_5_ULTRA];
  }

  /**
   * Detect hardware capability tier based on what context size the hardware can actually support
   * This uses the existing contextPool calculation which accounts for:
   * - Model size (already loaded in VRAM)
   * - Available VRAM (after model is loaded)
   * - KV cache quantization
   * - Safety buffer
   */
  private async detectHardwareCapabilityTier(): Promise<ContextTier> {
    try {
      const vramInfo = await this.vramMonitor.getInfo();
      
      // Use the existing contextPool logic to calculate what context size is actually possible
      const maxPossibleContext = this.contextPool.calculateOptimalSize(
        vramInfo,
        this.modelInfo
      );
      
      console.log('[ContextManager] Hardware can support context size:', maxPossibleContext);
      
      // Map the possible context size to a tier
      if (maxPossibleContext <= 4096) {
        return ContextTier.TIER_1_MINIMAL;
      }
      if (maxPossibleContext <= 8192) {
        return ContextTier.TIER_2_BASIC;
      }
      if (maxPossibleContext <= 32768) {
        return ContextTier.TIER_3_STANDARD;
      }
      if (maxPossibleContext <= 65536) {
        return ContextTier.TIER_4_PREMIUM;
      }
      return ContextTier.TIER_5_ULTRA;
    } catch (error) {
      console.warn('[ContextManager] Failed to detect hardware capability, defaulting to Tier 3', error);
      // Default to Tier 3 if detection fails
      return ContextTier.TIER_3_STANDARD;
    }
  }

  /**
   * Get the effective tier for prompt selection
   * When auto-context is enabled, we lock to hardware capability tier at startup
   * to prevent mid-conversation prompt changes when context size adjusts.
   * When auto-context is disabled, we use the actual context tier (user's manual selection).
   */
  private getEffectivePromptTier(): ContextTier {
    // If auto-sizing is enabled, always use hardware capability tier
    // This prevents prompt changes when context auto-adjusts during conversation
    if (this.config.autoSize) {
      return this.hardwareCapabilityTier;
    }
    
    // Manual mode: use the actual context tier (what user manually selected)
    // This allows users to explicitly choose a smaller context and get the appropriate prompt
    return this.actualContextTier;
  }

  /**
   * Set operational mode
   */
  public setMode(mode: OperationalMode): void {
    const previousMode = this.currentMode;
    this.currentMode = mode;
    this.modeProfile = MODE_PROFILES[mode];
    
    // Update system prompt for new mode
    this.updateSystemPrompt();
    
    this.emit('mode-changed', { 
      previousMode,
      mode, 
      profile: this.modeProfile 
    });
  }

  /**
   * Get current operational mode
   */
  public getMode(): OperationalMode {
    return this.currentMode;
  }

  /**
   * Get system prompt for current tier and mode
   * Uses effective prompt tier (hardware capability) not actual context tier
   */
  private getSystemPromptForTierAndMode(): string {
    const tier = this.getEffectivePromptTier(); // Use hardware capability tier
    const mode = this.currentMode;
    
    // Map tier string to tier number (e.g., "8-32K" -> "tier3")
    const tierMap: Record<string, string> = {
      '2-4K': 'tier1',
      '4-8K': 'tier2',
      '8-32K': 'tier3',
      '32-64K': 'tier4',
      '64K+': 'tier5'
    };
    
    const tierKey = tierMap[tier] || 'tier3';
    const key = `${tierKey}-${mode}`;
    
    const template = SYSTEM_PROMPT_TEMPLATES[key];
    
    if (!template) {
      // Fallback to tier3-developer
      console.warn(`[ContextManager] No prompt template found for ${key}, using fallback`);
      return SYSTEM_PROMPT_TEMPLATES['tier3-developer'].template;
    }
    
    return template.template;
  }

  /**
   * Get system prompt token budget for current tier and mode
   * Uses effective prompt tier (hardware capability) not actual context tier
   */
  private getSystemPromptTokenBudget(): number {
    const tier = this.getEffectivePromptTier(); // Use hardware capability tier
    const mode = this.currentMode;
    
    // Map tier string to tier number (e.g., "8-32K" -> "tier3")
    const tierMap: Record<string, string> = {
      '2-4K': 'tier1',
      '4-8K': 'tier2',
      '8-32K': 'tier3',
      '32-64K': 'tier4',
      '64K+': 'tier5'
    };
    
    const tierKey = tierMap[tier] || 'tier3';
    const key = `${tierKey}-${mode}`;
    
    const template = SYSTEM_PROMPT_TEMPLATES[key];
    return template?.tokenBudget || 1000;
  }

  /**
   * Update system prompt based on current tier and mode
   */
  private updateSystemPrompt(): void {
    const newPrompt = this.getSystemPromptForTierAndMode();
    
    // Set the prompt without emitting event
    const systemPrompt: Message = {
      id: `system-${Date.now()}`,
      role: 'system',
      content: newPrompt,
      timestamp: new Date(),
      tokenCount: this.tokenCounter.countTokensCached(
        `system-${Date.now()}`,
        newPrompt
      )
    };
    
    // Remove old system prompt if exists (only the main one, preserve summaries/checkpoints)
    this.currentContext.messages = this.currentContext.messages.filter(
      m => !m.id.startsWith('system-')
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
    
    // Emit detailed event with tier and mode info
    this.emit('system-prompt-updated', {
      tier: this.getEffectivePromptTier(), // Report effective tier used for prompts
      actualContextTier: this.actualContextTier,
      hardwareCapabilityTier: this.hardwareCapabilityTier,
      mode: this.currentMode,
      tokenBudget: this.getSystemPromptTokenBudget(),
      content: newPrompt
    });
  }

  /**
   * Handle tier or mode change
   */
  private onTierOrModeChange(): void {
    this.updateSystemPrompt();
    
    // Recalculate available tokens
    const usage = this.getUsage();
    this.emit('context-recalculated', { usage });
  }

  /**
   * Set task definition (never compressed)
   */
  public setTaskDefinition(task: import('./types.js').TaskDefinition): void {
    if (!this.currentContext.taskDefinition) {
      this.currentContext.taskDefinition = task;
      this.emit('task-defined', { task });
    }
  }

  /**
   * Add architecture decision (never compressed)
   */
  public addArchitectureDecision(decision: import('./types.js').ArchitectureDecision): void {
    if (!this.currentContext.architectureDecisions) {
      this.currentContext.architectureDecisions = [];
    }
    this.currentContext.architectureDecisions.push(decision);
    this.emit('architecture-decision', { decision });
  }

  /**
   * Add never-compressed section
   */
  public addNeverCompressed(section: import('./types.js').NeverCompressedSection): void {
    if (!this.currentContext.neverCompressed) {
      this.currentContext.neverCompressed = [];
    }
    this.currentContext.neverCompressed.push(section);
    this.emit('never-compressed-added', { section });
  }

  /**
   * Preserve never-compressed sections
   */
  private preserveNeverCompressed(context: ConversationContext): import('./types.js').NeverCompressedSection[] {
    const preserved: import('./types.js').NeverCompressedSection[] = [];
    
    // Add task definition
    if (context.taskDefinition) {
      preserved.push({
        type: 'task_definition',
        content: JSON.stringify(context.taskDefinition),
        timestamp: context.taskDefinition.timestamp
      });
    }
    
    // Add architecture decisions
    if (context.architectureDecisions) {
      for (const decision of context.architectureDecisions) {
        preserved.push({
          type: 'architecture_decision',
          content: JSON.stringify(decision),
          timestamp: decision.timestamp,
          metadata: { id: decision.id }
        });
      }
    }
    
    // Add explicit never-compressed sections
    if (context.neverCompressed) {
      preserved.push(...context.neverCompressed);
    }
    
    return preserved;
  }

  /**
   * Reconstruct never-compressed sections as messages
   */
  private reconstructNeverCompressed(sections: import('./types.js').NeverCompressedSection[]): Message[] {
    return sections.map(section => ({
      id: `never-compressed-${section.type}-${section.timestamp?.getTime() || Date.now()}`,
      role: 'system' as const,
      content: `[${section.type}]\n${section.content}`,
      timestamp: section.timestamp || new Date()
    }));
  }

  /**
   * Merge multiple checkpoints into one
   */
  private mergeCheckpoints(
    oldCheckpoints: import('./types.js').CompressionCheckpoint[],
    targetCheckpoint: import('./types.js').CompressionCheckpoint
  ): import('./types.js').CompressionCheckpoint {
    // Combine all checkpoint summaries
    const allSummaries = [
      ...oldCheckpoints.map(cp => cp.summary.content),
      targetCheckpoint.summary.content
    ].join('\n\n---\n\n');
    
    // Combine key decisions and files
    const allDecisions = [
      ...oldCheckpoints.flatMap(cp => cp.keyDecisions || []),
      ...(targetCheckpoint.keyDecisions || [])
    ];
    const allFiles = [
      ...oldCheckpoints.flatMap(cp => cp.filesModified || []),
      ...(targetCheckpoint.filesModified || [])
    ];
    
    // Calculate combined range
    const firstRange = oldCheckpoints[0]?.range || targetCheckpoint.range;
    const lastRange = targetCheckpoint.range;
    const combinedRange = `${firstRange} to ${lastRange}`;
    
    // Calculate total tokens
    const totalOriginalTokens = oldCheckpoints.reduce((sum, cp) => sum + cp.originalTokens, 0) + targetCheckpoint.originalTokens;
    const totalCurrentTokens = oldCheckpoints.reduce((sum, cp) => sum + cp.currentTokens, 0) + targetCheckpoint.currentTokens;
    
    // Create merged checkpoint
    return {
      id: `merged-${Date.now()}`,
      level: Math.min(...oldCheckpoints.map(cp => cp.level), targetCheckpoint.level), // Use lowest level (most compressed)
      range: combinedRange,
      summary: {
        id: `merged-summary-${Date.now()}`,
        role: 'system' as const,
        content: `[MERGED CHECKPOINT]\n${allSummaries}`,
        timestamp: new Date()
      },
      createdAt: oldCheckpoints[0]?.createdAt || targetCheckpoint.createdAt,
      compressedAt: new Date(),
      originalTokens: totalOriginalTokens,
      currentTokens: totalCurrentTokens,
      compressionCount: Math.max(...oldCheckpoints.map(cp => cp.compressionCount), targetCheckpoint.compressionCount) + 1,
      keyDecisions: Array.from(new Set(allDecisions)).slice(0, 10),
      filesModified: Array.from(new Set(allFiles)).slice(0, 20)
    };
  }

  /**
   * Compress for Tier 1 (2-8K) - Rollover strategy
   * Creates snapshot and starts fresh with ultra-compact summary
   */
  private async compressForTier1(): Promise<void> {
    console.log('[ContextManager] Tier 1 rollover compression triggered');
    
    // 1. Create snapshot for recovery
    let snapshot: import('./types.js').ContextSnapshot | null = null;
    try {
      snapshot = await this.snapshotManager.createSnapshot(this.currentContext);
      this.emit('rollover-snapshot-created', { snapshot });
      console.log('[ContextManager] Rollover snapshot created', { id: snapshot.id });
    } catch (error) {
      if (!isTestEnv) console.error('[ContextManager] Rollover snapshot creation failed', error);
      this.emit('snapshot-error', error);
    }
    
    // 2. Generate ultra-compact summary (200-300 tokens)
    const recentMessages = this.currentContext.messages.slice(-10); // Last 10 messages
    const summaryContent = this.generateCompactSummary(recentMessages);
    
    const summaryMessage: Message = {
      id: `rollover-summary-${Date.now()}`,
      role: 'system',
      content: summaryContent,
      timestamp: new Date()
    };
    
    // 3. Reset context with system prompt + summary
    const systemMessages = this.currentContext.messages.filter(m => m.role === 'system');
    
    this.currentContext.messages = [
      ...systemMessages,
      summaryMessage
    ];
    
    // 4. Update token count
    const newTokenCount = this.tokenCounter.countConversationTokens(this.currentContext.messages);
    this.currentContext.tokenCount = newTokenCount;
    this.contextPool.setCurrentTokens(newTokenCount);
    
    // 5. Record rollover event
    this.currentContext.metadata.compressionHistory.push({
      timestamp: new Date(),
      strategy: 'rollover',
      originalTokens: snapshot?.tokenCount || 0,
      compressedTokens: newTokenCount,
      ratio: snapshot ? newTokenCount / snapshot.tokenCount : 0
    });
    
    this.emit('rollover-complete', {
      snapshot,
      summary: summaryMessage,
      originalTokens: snapshot?.tokenCount || 0,
      compressedTokens: newTokenCount
    });
  }
  
  /**
   * Generate ultra-compact summary for Tier 1
   */
  private generateCompactSummary(messages: Message[]): string {
    const keyPoints = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => `${m.role}: ${m.content.substring(0, 100)}...`)
      .join('\n');
    
    return `[Previous conversation summary - ${messages.length} messages]\n${keyPoints}`;
  }
  
  /**
   * Compress for Tier 2 (8-16K) - Smart compression
   * Creates ONE detailed checkpoint + preserves critical info
   */
  private async compressForTier2(): Promise<void> {
    console.log('[ContextManager] Tier 2 smart compression triggered');
    
    // 1. Preserve never-compressed sections
    const preserved = this.preserveNeverCompressed(this.currentContext);
    
    // 2. Extract critical information based on mode
    const critical = this.extractCriticalInfo(this.currentContext.messages);
    
    // 3. Identify messages to compress
    // We need to compress messages that:
    // - Are NOT system messages
    // - Are NOT checkpoint summaries (already compressed)
    // - Are NOT in the recent window
    // - Have NOT been compressed before (not in never-compressed sections)
    
    const systemMessages = this.currentContext.messages.filter(m => m.role === 'system');
    const checkpointIds = new Set((this.currentContext.checkpoints || []).map(cp => cp.summary.id));
    const neverCompressedMessages = this.reconstructNeverCompressed(preserved);
    const neverCompressedIds = new Set(neverCompressedMessages.map(m => m.id));
    
    // Get all messages excluding system, checkpoints, and never-compressed
    const compressibleMessages = this.currentContext.messages.filter(m => 
      m.role !== 'system' && 
      !checkpointIds.has(m.id) &&
      !neverCompressedIds.has(m.id)
    );
    
    // For Tier 2, keep last 10 messages as recent (not 20 like Tier 3+)
    // This allows compression to happen with fewer total messages
    // We need at least a few messages to compress to make it worthwhile
    const recentCount = 10;
    const minToCompress = 3; // Reduced from 5 to allow earlier compression
    
    if (compressibleMessages.length < recentCount + minToCompress) {
      console.log('[ContextManager] Tier 2: Not enough messages to compress', {
        compressibleCount: compressibleMessages.length,
        needed: recentCount + minToCompress
      });
      return;
    }
    
    const messagesToCompress = compressibleMessages.slice(0, -recentCount);
    const recentMessages = compressibleMessages.slice(-recentCount);
    
    // 4. Use compression service to create summary
    const strategy = {
      type: 'summarize' as const,
      preserveRecent: 0, // We're handling recent messages separately
      summaryMaxTokens: 700 // Detailed checkpoint for Tier 2
    };
    
    const compressed = await this.compressionService.compress(messagesToCompress, strategy);
    
    if (compressed.status === 'inflated') {
      this.emit('compression-skipped', { reason: 'inflation', tier: 'tier2' });
      return;
    }
    
    // 5. Create ONE detailed checkpoint
    // Use a unique ID with random component to avoid duplicates
    const checkpointId = `checkpoint-tier2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get current compression number for age tracking
    const compressionNumber = this.currentContext.metadata.compressionHistory.length;
    
    const checkpoint: import('./types.js').CompressionCheckpoint = {
      id: checkpointId,
      level: 3, // DETAILED
      range: `Messages 1-${messagesToCompress.length}`,
      summary: compressed.summary,
      createdAt: new Date(),
      originalTokens: compressed.originalTokens,
      currentTokens: compressed.compressedTokens,
      compressionCount: 1,
      compressionNumber, // Track when this checkpoint was created
      keyDecisions: critical.decisions,
      filesModified: critical.files
    };
    
    // 6. Store checkpoint FIRST (ADDITIVE - preserve history)
    if (!this.currentContext.checkpoints) {
      this.currentContext.checkpoints = [];
    }
    
    // Add new checkpoint to history
    this.currentContext.checkpoints.push(checkpoint);
    
    // 7. Reconstruct context with ALL checkpoint summaries
    // Include ALL checkpoint summaries (not just the new one!)
    // This is critical - on subsequent compressions, we need to preserve the history
    const checkpointMessages = this.currentContext.checkpoints.map(cp => cp.summary);
    
    this.currentContext.messages = [
      ...systemMessages,
      ...neverCompressedMessages,
      ...checkpointMessages,  // ALL checkpoints, not just the new one
      ...recentMessages
    ];
    
    // 8. Hierarchical compression: compress old checkpoints
    await this.compressOldCheckpoints();
    
    // 8.5. Recalculate token count after hierarchical compression
    // (checkpoint summaries were modified, need to recount)
    const tokensAfterHierarchical = this.tokenCounter.countConversationTokens(this.currentContext.messages);
    this.currentContext.tokenCount = tokensAfterHierarchical;
    this.contextPool.setCurrentTokens(tokensAfterHierarchical);
    
    // 9. For Tier 2, allow some checkpoints to accumulate for hierarchy
    // But merge more aggressively to keep token count down
    const softLimit = Math.max(5, this.tierConfig.maxCheckpoints * 5); // At least 5, or 5x the limit
    if (this.currentContext.checkpoints.length > softLimit) {
      // Merge oldest checkpoints, keeping only the most recent ones
      const toKeep = Math.max(3, this.tierConfig.maxCheckpoints * 3); // Keep at least 3
      const toMerge = this.currentContext.checkpoints.slice(0, -toKeep);
      const recent = this.currentContext.checkpoints.slice(-toKeep);
      
      if (toMerge.length > 1) {
        const merged = this.mergeCheckpoints(toMerge.slice(0, -1), toMerge[toMerge.length - 1]);
        this.currentContext.checkpoints = [merged, ...recent];
        
        // Rebuild messages array with merged checkpoints
        const systemMessages = this.currentContext.messages.filter(m => m.role === 'system');
        const neverCompressedMessages = this.reconstructNeverCompressed(preserved);
        const checkpointMessages = this.currentContext.checkpoints.map(cp => cp.summary);
        const recentMessages = compressibleMessages.slice(-recentCount);
        
        this.currentContext.messages = [
          ...systemMessages,
          ...neverCompressedMessages,
          ...checkpointMessages,
          ...recentMessages
        ];
      }
    }
    
    // 10. Update token count
    const newTokenCount = this.tokenCounter.countConversationTokens(this.currentContext.messages);
    this.currentContext.tokenCount = newTokenCount;
    this.contextPool.setCurrentTokens(newTokenCount);
    
    // 10. Record compression event
    this.currentContext.metadata.compressionHistory.push({
      timestamp: new Date(),
      strategy: 'smart',
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
      ratio: compressed.compressionRatio
    });
    
    this.emit('tier2-compressed', {
      checkpoint,
      critical,
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens
    });
  }
  
  /**
   * Extract critical information based on current mode
   */
  private extractCriticalInfo(messages: Message[]): { decisions: string[]; files: string[] } {
    const decisions: string[] = [];
    const files: string[] = [];
    
    const rules = this.modeProfile.extractionRules;
    if (!rules) {
      return { decisions, files };
    }
    
    for (const message of messages) {
      // Extract based on mode-specific rules
      for (const [type, pattern] of Object.entries(rules)) {
        const matches = message.content.match(pattern);
        if (matches && this.modeProfile.neverCompress.includes(type)) {
          decisions.push(matches[0]);
        }
      }
      
      // Extract file changes
      const filePattern = /(?:created|modified|updated|changed)\s+([^\s]+\.\w+)/gi;
      let fileMatch;
      while ((fileMatch = filePattern.exec(message.content)) !== null) {
        files.push(fileMatch[1]);
      }
    }
    
    return { 
      decisions: Array.from(new Set(decisions)).slice(0, 5), // Top 5 unique
      files: Array.from(new Set(files)).slice(0, 10) // Top 10 unique
    };
  }
  
  /**
   * Compress for Tier 3 (16-32K) - Progressive checkpoints (ENHANCED)
   * Creates 3-5 checkpoints with hierarchical compression + never-compressed sections
   */
  private async compressForTier3(): Promise<void> {
    console.log('[ContextManager] Tier 3 progressive compression triggered');
    
    // 1. Preserve never-compressed sections
    const preserved = this.preserveNeverCompressed(this.currentContext);
    
    // 2. Use existing compression logic but with mode-aware extraction
    const strategy = {
      type: this.config.compression.strategy,
      preserveRecent: this.config.compression.preserveRecent,
      summaryMaxTokens: this.config.compression.summaryMaxTokens
    };
    
    const compressed = await this.compressionService.compress(
      this.currentContext.messages,
      strategy
    );
    
    if (compressed.status === 'inflated') {
      this.emit('compression-skipped', { reason: 'inflation', tier: 'tier3' });
      return;
    }
    
    // 3. Extract mode-aware information
    const extracted = this.extractCriticalInfo(this.currentContext.messages);
    
    // 4. Create new checkpoint with mode-aware data
    const checkpointId = `checkpoint-tier3-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const compressionNumber = this.currentContext.metadata.compressionHistory.length;
    
    const checkpoint: import('./types.js').CompressionCheckpoint = {
      id: checkpointId,
      level: 3, // DETAILED
      range: `Messages 1-${this.currentContext.messages.length - compressed.preserved.length}`,
      summary: compressed.summary,
      createdAt: new Date(),
      originalTokens: compressed.originalTokens,
      currentTokens: compressed.compressedTokens,
      compressionCount: 1,
      compressionNumber, // Track when this checkpoint was created
      keyDecisions: extracted.decisions,
      filesModified: extracted.files,
      nextSteps: compressed.checkpoint?.nextSteps
    };
    
    // 5. Initialize checkpoints array if not exists
    if (!this.currentContext.checkpoints) {
      this.currentContext.checkpoints = [];
    }
    
    // 6. Add new checkpoint (ADDITIVE!)
    this.currentContext.checkpoints.push(checkpoint);
    
    // 7. Hierarchical compression: compress old checkpoints
    await this.compressOldCheckpoints();
    
    // 8. Limit to max 5 checkpoints for Tier 3
    if (this.currentContext.checkpoints.length > this.tierConfig.maxCheckpoints) {
      const excess = this.currentContext.checkpoints.length - this.tierConfig.maxCheckpoints;
      const toMerge = this.currentContext.checkpoints.slice(0, excess + 1);
      const remaining = this.currentContext.checkpoints.slice(excess + 1);
      
      const mergedCheckpoint: import('./types.js').CompressionCheckpoint = {
        id: `checkpoint-merged-${Date.now()}`,
        level: 1, // COMPACT
        range: `${toMerge[0].range} to ${toMerge[toMerge.length - 1].range}`,
        summary: {
          id: `summary-merged-${Date.now()}`,
          role: 'system',
          content: `[Merged checkpoint: ${toMerge.length} earlier checkpoints]`,
          timestamp: new Date()
        },
        createdAt: toMerge[0].createdAt,
        compressedAt: new Date(),
        originalTokens: toMerge.reduce((sum, cp) => sum + cp.originalTokens, 0),
        currentTokens: 50,
        compressionCount: Math.max(...toMerge.map(cp => cp.compressionCount)) + 1
      };
      
      this.currentContext.checkpoints = [mergedCheckpoint, ...remaining];
    }
    
    // 9. Reconstruct context
    const systemMessages = this.currentContext.messages.filter(m => m.role === 'system');
    const neverCompressedMessages = this.reconstructNeverCompressed(preserved);
    const checkpointMessages = this.currentContext.checkpoints.map(cp => cp.summary);
    
    this.currentContext.messages = [
      ...systemMessages,
      ...neverCompressedMessages,
      ...checkpointMessages,
      ...compressed.preserved
    ];
    
    // 10. Update token count
    const newTokenCount = this.tokenCounter.countConversationTokens(this.currentContext.messages);
    this.currentContext.tokenCount = newTokenCount;
    this.contextPool.setCurrentTokens(newTokenCount);
    
    // 11. Record compression event
    this.currentContext.metadata.compressionHistory.push({
      timestamp: new Date(),
      strategy: 'progressive',
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
      ratio: compressed.compressionRatio
    });
    
    this.emit('tier3-compressed', {
      checkpoint,
      checkpointCount: this.currentContext.checkpoints.length,
      neverCompressedCount: preserved.length,
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens
    });
  }
  
  /**
   * Compress for Tier 4 (32K+) - Structured checkpoints
   * Creates up to 10 checkpoints with rich metadata and semantic merging
   */
  private async compressForTier4(): Promise<void> {
    console.log('[ContextManager] Tier 4 structured compression triggered');
    
    // 1. Preserve never-compressed sections (more extensive for Tier 4)
    const preserved = this.preserveNeverCompressed(this.currentContext);
    
    // 2. Extract rich metadata
    const extracted = this.extractCriticalInfo(this.currentContext.messages);
    
    // 3. Use compression service with larger summary budget
    const strategy = {
      type: 'summarize' as const,
      preserveRecent: this.config.compression.preserveRecent,
      summaryMaxTokens: 1500 // Larger budget for Tier 4
    };
    
    const compressed = await this.compressionService.compress(
      this.currentContext.messages,
      strategy
    );
    
    if (compressed.status === 'inflated') {
      this.emit('compression-skipped', { reason: 'inflation', tier: 'tier4' });
      return;
    }
    
    // 4. Create rich checkpoint with extensive metadata
    const checkpointId = `checkpoint-tier4-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const compressionNumber = this.currentContext.metadata.compressionHistory.length;
    
    const checkpoint: import('./types.js').CompressionCheckpoint = {
      id: checkpointId,
      level: 3, // DETAILED
      range: `Messages 1-${this.currentContext.messages.length - compressed.preserved.length}`,
      summary: compressed.summary,
      createdAt: new Date(),
      originalTokens: compressed.originalTokens,
      currentTokens: compressed.compressedTokens,
      compressionCount: 1,
      compressionNumber, // Track when this checkpoint was created
      keyDecisions: extracted.decisions,
      filesModified: extracted.files,
      nextSteps: compressed.checkpoint?.nextSteps
    };
    
    // 5. Initialize checkpoints array
    if (!this.currentContext.checkpoints) {
      this.currentContext.checkpoints = [];
    }
    
    // 6. Add new checkpoint
    this.currentContext.checkpoints.push(checkpoint);
    
    // 7. Hierarchical compression with semantic merging
    this.compressOldCheckpoints();
    
    // 8. Limit to max 10 checkpoints for Tier 4
    if (this.currentContext.checkpoints.length > this.tierConfig.maxCheckpoints) {
      const excess = this.currentContext.checkpoints.length - this.tierConfig.maxCheckpoints;
      const toMerge = this.currentContext.checkpoints.slice(0, excess + 1);
      const remaining = this.currentContext.checkpoints.slice(excess + 1);
      
      // Semantic merging: combine related checkpoints
      const mergedContent = toMerge
        .map(cp => cp.summary.content)
        .join('\n\n---\n\n');
      
      const mergedCheckpoint: import('./types.js').CompressionCheckpoint = {
        id: `checkpoint-merged-tier4-${Date.now()}`,
        level: 1, // COMPACT
        range: `${toMerge[0].range} to ${toMerge[toMerge.length - 1].range}`,
        summary: {
          id: `summary-merged-tier4-${Date.now()}`,
          role: 'system',
          content: `[Merged ${toMerge.length} checkpoints]\n${mergedContent.substring(0, 500)}...`,
          timestamp: new Date()
        },
        createdAt: toMerge[0].createdAt,
        compressedAt: new Date(),
        originalTokens: toMerge.reduce((sum, cp) => sum + cp.originalTokens, 0),
        currentTokens: 200, // Larger merged checkpoint for Tier 4
        compressionCount: Math.max(...toMerge.map(cp => cp.compressionCount)) + 1,
        keyDecisions: toMerge.flatMap(cp => cp.keyDecisions || []).slice(0, 10),
        filesModified: toMerge.flatMap(cp => cp.filesModified || []).slice(0, 20)
      };
      
      this.currentContext.checkpoints = [mergedCheckpoint, ...remaining];
    }
    
    // 9. Reconstruct context with all preserved sections
    const systemMessages = this.currentContext.messages.filter(m => m.role === 'system');
    const neverCompressedMessages = this.reconstructNeverCompressed(preserved);
    const checkpointMessages = this.currentContext.checkpoints.map(cp => cp.summary);
    
    this.currentContext.messages = [
      ...systemMessages,
      ...neverCompressedMessages,
      ...checkpointMessages,
      ...compressed.preserved
    ];
    
    // 10. Update token count
    const newTokenCount = this.tokenCounter.countConversationTokens(this.currentContext.messages);
    this.currentContext.tokenCount = newTokenCount;
    this.contextPool.setCurrentTokens(newTokenCount);
    
    // 11. Record compression event
    this.currentContext.metadata.compressionHistory.push({
      timestamp: new Date(),
      strategy: 'structured',
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
      ratio: compressed.compressionRatio
    });
    
    this.emit('tier4-compressed', {
      checkpoint,
      checkpointCount: this.currentContext.checkpoints.length,
      neverCompressedCount: preserved.length,
      richMetadata: {
        decisions: extracted.decisions.length,
        files: extracted.files.length
      },
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens
    });
  }

  /**
   * Compress for Tier 5 (64K+) - Ultra structured checkpoints
   * Creates up to 15 checkpoints with maximum preservation and rich metadata
   */
  private async compressForTier5(): Promise<void> {
    console.log('[ContextManager] Tier 5 ultra structured compression triggered');
    
    // 1. Preserve never-compressed sections (maximum preservation for Tier 5)
    const preserved = this.preserveNeverCompressed(this.currentContext);
    
    // 2. Extract rich metadata
    const extracted = this.extractCriticalInfo(this.currentContext.messages);
    
    // 3. Use compression service with maximum summary budget
    const strategy = {
      type: 'summarize' as const,
      preserveRecent: this.config.compression.preserveRecent,
      summaryMaxTokens: 2000 // Maximum budget for Tier 5
    };
    
    const compressed = await this.compressionService.compress(
      this.currentContext.messages,
      strategy
    );
    
    if (compressed.status === 'inflated') {
      this.emit('compression-skipped', { reason: 'inflation', tier: 'tier5' });
      return;
    }
    
    // 4. Create ultra-rich checkpoint with maximum metadata
    const checkpointId = `checkpoint-tier5-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const compressionNumber = this.currentContext.metadata.compressionHistory.length;
    
    const checkpoint: import('./types.js').CompressionCheckpoint = {
      id: checkpointId,
      level: 3, // DETAILED
      range: `Messages 1-${this.currentContext.messages.length - compressed.preserved.length}`,
      summary: compressed.summary,
      createdAt: new Date(),
      originalTokens: compressed.originalTokens,
      currentTokens: compressed.compressedTokens,
      compressionCount: 1,
      compressionNumber, // Track when this checkpoint was created
      keyDecisions: extracted.decisions,
      filesModified: extracted.files,
      nextSteps: compressed.checkpoint?.nextSteps
    };
    
    // 5. Initialize checkpoints array
    if (!this.currentContext.checkpoints) {
      this.currentContext.checkpoints = [];
    }
    
    // 6. Add new checkpoint
    this.currentContext.checkpoints.push(checkpoint);
    
    // 7. Hierarchical compression with semantic merging
    await this.compressOldCheckpoints();
    
    // 8. Limit to max 15 checkpoints for Tier 5
    if (this.currentContext.checkpoints.length > this.tierConfig.maxCheckpoints) {
      const excess = this.currentContext.checkpoints.length - this.tierConfig.maxCheckpoints;
      const toMerge = this.currentContext.checkpoints.slice(0, excess + 1);
      const remaining = this.currentContext.checkpoints.slice(excess + 1);
      
      // Semantic merging with maximum preservation
      const mergedContent = toMerge
        .map(cp => cp.summary.content)
        .join('\n\n---\n\n');
      
      const mergedCheckpoint: import('./types.js').CompressionCheckpoint = {
        id: `checkpoint-merged-tier5-${Date.now()}`,
        level: 1, // COMPACT
        range: `${toMerge[0].range} to ${toMerge[toMerge.length - 1].range}`,
        summary: {
          id: `summary-merged-tier5-${Date.now()}`,
          role: 'system',
          content: `[Merged ${toMerge.length} checkpoints - Ultra tier]\n${mergedContent.substring(0, 800)}...`,
          timestamp: new Date()
        },
        createdAt: toMerge[0].createdAt,
        compressedAt: new Date(),
        originalTokens: toMerge.reduce((sum, cp) => sum + cp.originalTokens, 0),
        currentTokens: 300, // Largest merged checkpoint for Tier 5
        compressionCount: Math.max(...toMerge.map(cp => cp.compressionCount)) + 1,
        keyDecisions: toMerge.flatMap(cp => cp.keyDecisions || []).slice(0, 15),
        filesModified: toMerge.flatMap(cp => cp.filesModified || []).slice(0, 30)
      };
      
      this.currentContext.checkpoints = [mergedCheckpoint, ...remaining];
    }
    
    // 9. Reconstruct context with all preserved sections
    const systemMessages = this.currentContext.messages.filter(m => m.role === 'system');
    const neverCompressedMessages = this.reconstructNeverCompressed(preserved);
    const checkpointMessages = this.currentContext.checkpoints.map(cp => cp.summary);
    
    this.currentContext.messages = [
      ...systemMessages,
      ...neverCompressedMessages,
      ...checkpointMessages,
      ...compressed.preserved
    ];
    
    // 10. Update token count
    const newTokenCount = this.tokenCounter.countConversationTokens(this.currentContext.messages);
    this.currentContext.tokenCount = newTokenCount;
    this.contextPool.setCurrentTokens(newTokenCount);
    
    // 11. Record compression event
    this.currentContext.metadata.compressionHistory.push({
      timestamp: new Date(),
      strategy: 'structured', // Same as Tier 4
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
      ratio: compressed.compressionRatio
    });
    
    this.emit('tier5-compressed', {
      checkpoint,
      checkpointCount: this.currentContext.checkpoints.length,
      neverCompressedCount: preserved.length,
      richMetadata: {
        decisions: extracted.decisions.length,
        files: extracted.files.length
      },
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens
    });
  }

  /**
   * Compress old checkpoints hierarchically
   * - Checkpoints 3+ compressions old: Compress to MODERATE level
   * - Checkpoints 6+ compressions old: Compress to COMPACT level
   * - Age is calculated as: (total compressions) - (checkpoint's compression number)
   */
  private async compressOldCheckpoints(): Promise<void> {
    if (!this.currentContext.checkpoints || this.currentContext.checkpoints.length === 0) {
      return;
    }

    const MODERATE_AGE = 3; // Compress to moderate after 3 more compressions
    const COMPACT_AGE = 6; // Compress to compact after 6 more compressions

    // Calculate how many compressions have happened total
    const totalCompressions = this.currentContext.metadata.compressionHistory.length;

    console.log('[ContextManager] compressOldCheckpoints:', {
      totalCompressions,
      checkpointCount: this.currentContext.checkpoints.length
    });

    for (const checkpoint of this.currentContext.checkpoints) {
      // Calculate age: how many compressions happened AFTER this checkpoint was created
      // Use the checkpoint's compressionNumber field (set when checkpoint is created)
      // If not set (old checkpoints), estimate from creation time
      let age = 0;
      
      if (checkpoint.compressionNumber !== undefined) {
        // Simple and reliable: age = total compressions - checkpoint's compression number
        age = totalCompressions - checkpoint.compressionNumber;
      } else {
        // Fallback for old checkpoints without compressionNumber
        // Find the compression that created this checkpoint
        const checkpointIndex = this.currentContext.metadata.compressionHistory.findIndex(
          h => h.timestamp >= checkpoint.createdAt
        );
        age = checkpointIndex >= 0 ? totalCompressions - checkpointIndex : totalCompressions;
      }

      console.log('[ContextManager] Checkpoint age:', {
        checkpointId: checkpoint.id,
        level: checkpoint.level,
        age,
        compressionNumber: checkpoint.compressionNumber,
        totalCompressions
      });

      // Compress to COMPACT level if very old (from any level)
      if (age >= COMPACT_AGE && checkpoint.level !== 1) {
        console.log('[ContextManager] Compressing checkpoint to COMPACT:', checkpoint.id);
        checkpoint.level = 1; // CheckpointLevel.COMPACT
        checkpoint.compressedAt = new Date();
        checkpoint.compressionCount++;
        
        // Ultra-compact summary - just the essentials
        const originalContent = checkpoint.summary.content;
        checkpoint.summary.content = this.createCompactSummary(originalContent, checkpoint);
        
        // Update token count (use non-cached to get accurate count after modification)
        const newTokens = await this.tokenCounter.countTokens(checkpoint.summary.content);
        checkpoint.currentTokens = newTokens;
      }
      // Compress to MODERATE level if old (only from DETAILED level)
      else if (age >= MODERATE_AGE && checkpoint.level === 3) {
        console.log('[ContextManager] Compressing checkpoint to MODERATE:', checkpoint.id);
        checkpoint.level = 2; // CheckpointLevel.MODERATE
        checkpoint.compressedAt = new Date();
        checkpoint.compressionCount++;
        
        // Moderate summary - keep key decisions
        const originalContent = checkpoint.summary.content;
        checkpoint.summary.content = this.createModerateSummary(originalContent, checkpoint);
        
        // Update token count (use non-cached to get accurate count after modification)
        const newTokens = await this.tokenCounter.countTokens(checkpoint.summary.content);
        checkpoint.currentTokens = newTokens;
      }
    }
  }

  /**
   * Create a compact summary (ultra-compressed)
   */
  private createCompactSummary(originalContent: string, checkpoint: import('./types.js').CompressionCheckpoint): string {
    const lines = originalContent.split('\n');
    const firstLine = lines[0] || '';
    
    return `[Checkpoint ${checkpoint.range}] ${firstLine.substring(0, 100)}...`;
  }

  /**
   * Create a moderate summary (medium compression)
   */
  private createModerateSummary(originalContent: string, checkpoint: import('./types.js').CompressionCheckpoint): string {
    const lines = originalContent.split('\n');
    const summary = lines.slice(0, 5).join('\n'); // Keep first 5 lines
    
    let result = `[Checkpoint ${checkpoint.range}]\n${summary}`;
    
    // Preserve key decisions if available
    if (checkpoint.keyDecisions && checkpoint.keyDecisions.length > 0) {
      result += `\n\nKey Decisions:\n${checkpoint.keyDecisions.slice(0, 3).join('\n')}`;
    }
    
    return result;
  }

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
   * Dispatches to tier-specific compression strategy
   */
  async compress(): Promise<void> {
    if (this.currentContext.messages.length === 0) {
      return;
    }
    
    // Dispatch to tier-specific compression
    const tier = this.tierConfig;
    console.log('[ContextManager] compress invoked', { 
      tier: tier.tier, 
      strategy: tier.strategy,
      messageCount: this.currentContext.messages.length 
    });
    
    try {
      switch (tier.strategy) {
        case 'rollover':
          await this.compressForTier1();
          break;
        case 'smart':
          await this.compressForTier2();
          break;
        case 'progressive':
          await this.compressForTier3();
          break;
        case 'structured':
          // Tier 4 and 5 both use structured strategy
          // Differentiate by maxCheckpoints
          if (tier.maxCheckpoints >= 15) {
            await this.compressForTier5();
          } else {
            await this.compressForTier4();
          }
          break;
        default:
          // Fallback to Tier 3 progressive
          console.warn(`[ContextManager] Unknown strategy ${tier.strategy}, using progressive`);
          await this.compressForTier3();
      }
      
      console.log('[ContextManager] compression complete', {
        tier: tier.tier,
        newTokenCount: this.currentContext.tokenCount,
        checkpointCount: this.currentContext.checkpoints?.length || 0
      });
    } catch (error) {
      console.error('[ContextManager] compression failed', error);
      this.emit('compression-error', { error, tier: tier.tier });
      throw error;
    }
  }

  /** Report in-flight (streaming) token delta to the manager (can be positive or negative) */
  reportInflightTokens(delta: number): void {
    try {
      this.inflightTokens = Math.max(0, this.inflightTokens + delta);
      // Update context pool with temporary token count including inflight
      this.contextPool.setCurrentTokens(this.currentContext.tokenCount + this.inflightTokens);
      // Re-check thresholds with inflight included
      this.snapshotManager.checkThresholds(this.currentContext.tokenCount + this.inflightTokens, this.currentContext.maxTokens);
    } catch (e) {
      console.error('[ContextManager] reportInflightTokens failed', e);
    }
  }

  /** Clear inflight token accounting (call when generation completes or is aborted) */
  clearInflightTokens(): void {
    try {
      this.inflightTokens = 0;
      this.contextPool.setCurrentTokens(this.currentContext.tokenCount);
    } catch (e) {
      console.error('[ContextManager] clearInflightTokens failed', e);
    }
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
    
    // Log prompt details for verification
    console.log('[ContextManager] Setting system prompt:');
    console.log(`  - Effective Prompt Tier: ${this.getEffectivePromptTier()}`);
    console.log(`  - Actual Context Tier: ${this.actualContextTier}`);
    console.log(`  - Current Mode: ${this.currentMode}`);
    console.log(`  - Auto-sizing: ${this.config.autoSize ? 'enabled (prompt locked to hardware)' : 'disabled (prompt follows context)'}`);
    console.log(`  - Prompt length: ${content.length} chars, ${systemPrompt.tokenCount} tokens`);
    console.log(`  - Prompt preview: ${content.substring(0, 200)}...`);
    
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

  /**
   * Get current checkpoints
   */
  getCheckpoints(): import('./types.js').CompressionCheckpoint[] {
    return this.currentContext.checkpoints || [];
  }

  /**
   * Get checkpoint statistics
   */
  getCheckpointStats(): {
    total: number;
    byLevel: { compact: number; moderate: number; detailed: number };
    totalTokens: number;
    oldestDate: Date | null;
    newestDate: Date | null;
  } {
    const checkpoints = this.currentContext.checkpoints || [];
    
    const stats = {
      total: checkpoints.length,
      byLevel: {
        compact: checkpoints.filter(cp => cp.level === 1).length,
        moderate: checkpoints.filter(cp => cp.level === 2).length,
        detailed: checkpoints.filter(cp => cp.level === 3).length
      },
      totalTokens: checkpoints.reduce((sum, cp) => {
        const tokens = Number(cp.currentTokens) || 0;
        return sum + tokens;
      }, 0),
      oldestDate: checkpoints.length > 0 ? checkpoints[0].createdAt : null,
      newestDate: checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].createdAt : null
    };

    return stats;
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
