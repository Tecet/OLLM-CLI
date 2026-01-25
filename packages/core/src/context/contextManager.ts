import { createLogger } from '../utils/logger.js';

const logger = createLogger('contextManager');
/**
 * Context Manager
 * 
 * Main orchestration layer that coordinates all context management services:
 * - VRAM Monitor: Tracks GPU memory availability
 * - Token Counter: Measures context usage
 * - Context Pool: Manages dynamic sizing
 * - Memory Guard: Prevents OOM errors
 */

import { EventEmitter } from 'events';

import { DEFAULT_CONTEXT_CONFIG } from './contextDefaults.js';
import { createContextModules } from './contextModules.js';
import { createContextPool } from './contextPool.js';
import { loadJitContext } from './jitDiscovery.js';
import { PromptOrchestrator } from './promptOrchestrator.js';
import { createTokenCounter } from './tokenCounter.js';
import { 
  ContextTier,
  TIER_CONFIGS,
  OperationalMode,
  MODE_PROFILES
} from './types.js';
import { createVRAMMonitor } from './vramMonitor.js';

import type { CheckpointManager } from './checkpointManager.js';
import type { ContextModuleOverrides, ContextModules } from './contextModules.js';
import type { MessageStore } from './messageStore.js';
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
  MemoryGuard,
  ModelInfo
} from './types.js';

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
 * token counting, and conversation state management.
 */
export class ConversationContextManager extends EventEmitter implements ContextManager {
  public config: ContextConfig;
  public activeSkills: string[] = [];
  public activeTools: string[] = [];
  public activeHooks: string[] = [];
  public activeMcpServers: string[] = [];
  
  private vramMonitor: VRAMMonitor;
  private tokenCounter: TokenCounter;
  private contextPool: ContextPool;
  private memoryGuard: MemoryGuard;
  private promptOrchestrator: PromptOrchestrator;
  private messageStore: MessageStore;
  private checkpointManager: CheckpointManager;
  private contextModules: ContextModules;
  
  private currentContext: ConversationContext;
  private modelInfo: ModelInfo;
  private isStarted: boolean = false;
  private sessionId: string;
  public createSnapshot: () => Promise<ContextSnapshot>;
  public restoreSnapshot: (snapshotId: string) => Promise<void>;
  public listSnapshots: () => Promise<ContextSnapshot[]>;
  public getSnapshot: (snapshotId: string) => Promise<ContextSnapshot | null>;
  public compress: () => Promise<void>;

  constructor(
    sessionId: string,
    modelInfo: ModelInfo,
    config: Partial<ContextConfig> = {},
    services?: ContextModuleOverrides & {
      vramMonitor?: VRAMMonitor;
      tokenCounter?: TokenCounter;
      contextPool?: ContextPool;
    }
  ) {
    super();
    
    this.sessionId = sessionId;
    this.modelInfo = modelInfo;
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
    
    // Initialize services (use provided or create new)
    this.vramMonitor = services?.vramMonitor || createVRAMMonitor();
    this.tokenCounter = services?.tokenCounter || createTokenCounter();
    this.promptOrchestrator = new PromptOrchestrator({ tokenCounter: this.tokenCounter });
    
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
          promptTierStable: !this.config.autoSize
        });
        
        // Update prompt if the effective tier changed (auto-sizing can shift context tiers)
        if (previousActualTier !== this.actualContextTier) {
          this.updateSystemPrompt();
        }
      }
    );
    
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
    
    this.contextModules = createContextModules({
      sessionId,
      config: this.config,
      vramMonitor: this.vramMonitor,
      tokenCounter: this.tokenCounter,
      contextPool: this.contextPool,
      getContext: () => this.currentContext,
      setContext: (context) => {
        this.currentContext = context;
      },
      getUsage: () => this.getUsage(),
      getTierConfig: () => this.tierConfig,
      getModeProfile: () => this.modeProfile,
      emit: this.emit.bind(this),
      isTestEnv,
      services
    });

    this.memoryGuard = this.contextModules.memoryGuard;
    this.messageStore = this.contextModules.messageStore;
    this.checkpointManager = this.contextModules.checkpointManager;

    this.memoryGuard.setContext(this.currentContext);

    const snapshotCoordinator = this.contextModules.snapshotCoordinator;
    const compressionCoordinator = this.contextModules.compressionCoordinator;

    this.createSnapshot = snapshotCoordinator.createSnapshot.bind(snapshotCoordinator);
    this.restoreSnapshot = snapshotCoordinator.restoreSnapshot.bind(snapshotCoordinator);
    this.listSnapshots = snapshotCoordinator.listSnapshots.bind(snapshotCoordinator);
    this.getSnapshot = snapshotCoordinator.getSnapshot.bind(snapshotCoordinator);
    this.compress = compressionCoordinator.compress.bind(compressionCoordinator);
    this.messageStore.setCompress(() => this.compress());
    
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
        const maxPossibleContext = this.contextPool.calculateOptimalSize(
          vramInfo,
          this.modelInfo
        );
        const recommendedSize = this.getRecommendedAutoSize(maxPossibleContext);
        
        if (recommendedSize !== this.contextPool.currentSize) {
          await this.contextPool.resize(recommendedSize);
          this.contextPool.updateConfig({ targetContextSize: recommendedSize });
        }
      }
    });
    
    this.contextModules.registerHandlers(this.config);
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
    logger.info('[ContextManager] Hardware capability tier:', this.hardwareCapabilityTier);
    
    if (this.config.autoSize) {
      const maxPossibleContext = this.contextPool.calculateOptimalSize(
        vramInfo,
        this.modelInfo
      );
      const recommendedSize = this.getRecommendedAutoSize(maxPossibleContext);
      await this.contextPool.resize(recommendedSize);
      this.contextPool.updateConfig({ targetContextSize: recommendedSize });
      
      // Update current context
      this.currentContext.maxTokens = this.contextPool.currentSize;
      this.currentContext.metadata.contextSize = this.contextPool.currentSize;
      
      // Detect actual context tier after resize
      const newTierConfig = this.detectContextTier();
      this.currentTier = newTierConfig.tier;
      this.tierConfig = newTierConfig;
      this.actualContextTier = newTierConfig.tier;
      
      // With auto-sizing, prompt tier follows actual context size
      logger.info('[ContextManager] Auto-sizing enabled - prompt tier follows actual context size');
      logger.info('[ContextManager] Actual context tier:', this.actualContextTier);
      logger.info('[ContextManager] Effective prompt tier:', this.getEffectivePromptTier());
      
      this.emit('tier-changed', { 
        tier: this.currentTier, 
        config: this.tierConfig,
        actualContextTier: this.actualContextTier,
        hardwareCapabilityTier: this.hardwareCapabilityTier,
        effectivePromptTier: this.getEffectivePromptTier(),
        promptTierLocked: false
      });
    } else {
      // Even without autoSize, detect the actual context tier
      const tierConfig = this.detectContextTier();
      this.actualContextTier = tierConfig.tier;
      this.currentTier = tierConfig.tier;
      this.tierConfig = tierConfig;
      
      logger.info('[ContextManager] Manual context sizing - using actual context tier');
      logger.info('[ContextManager] Actual context tier:', this.actualContextTier);
      logger.info('[ContextManager] Effective prompt tier:', this.getEffectivePromptTier());
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
      promptTierLocked: false
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
          logger.info(`[ContextManager] Tier changed: actual ${oldTier} → ${this.actualContextTier}, effective ${oldEffectiveTier} → ${newEffectiveTier}`);
          
          this.emit('tier-changed', {
            tier: this.currentTier,
            config: this.tierConfig,
            actualContextTier: this.actualContextTier,
            hardwareCapabilityTier: this.hardwareCapabilityTier,
            effectivePromptTier: newEffectiveTier,
            promptTierLocked: this.config.autoSize
          });
          
          logger.info('[ContextManager] Updating system prompt to match new tier');
          this.updateSystemPrompt();
          
          this.emit('system-prompt-updated', {
            tier: newEffectiveTier,
            mode: this.currentMode,
            prompt: this.getSystemPrompt()
          });
        }
      }
    }
    
    this.contextModules.updateConfig(this.config);
    
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
    await this.messageStore.addMessage(message);
  }

  private loadedPaths: Set<string> = new Set();
  
  // Adaptive Context System fields
  private currentTier: ContextTier = ContextTier.TIER_3_STANDARD;
  private tierConfig: import('./types.js').TierConfig = TIER_CONFIGS[ContextTier.TIER_3_STANDARD];
  private currentMode: OperationalMode = OperationalMode.ASSISTANT;
  private modeProfile: import('./types.js').ModeProfile = MODE_PROFILES[OperationalMode.ASSISTANT];
  
  // Hardware capability tier (based on VRAM) - determines prompt quality
  private hardwareCapabilityTier: ContextTier = ContextTier.TIER_3_STANDARD;
  // Actual context tier (based on user selection) - determines context window size
  private actualContextTier: ContextTier = ContextTier.TIER_3_STANDARD;

  private getTierForSize(size: number): ContextTier {
    const tiers: Array<{ size: number; tier: ContextTier }> = [
      { size: 4096, tier: ContextTier.TIER_1_MINIMAL },
      { size: 8192, tier: ContextTier.TIER_2_BASIC },
      { size: 16384, tier: ContextTier.TIER_3_STANDARD },
      { size: 32768, tier: ContextTier.TIER_4_PREMIUM },
      { size: 65536, tier: ContextTier.TIER_5_ULTRA }
    ];

    let selected = ContextTier.TIER_1_MINIMAL;
    for (const entry of tiers) {
      if (size >= entry.size) {
        selected = entry.tier;
      }
    }
    return selected;
  }

  private getTierTargetSize(tier: ContextTier): number {
    const sizes: Record<ContextTier, number> = {
      [ContextTier.TIER_1_MINIMAL]: 4096,
      [ContextTier.TIER_2_BASIC]: 8192,
      [ContextTier.TIER_3_STANDARD]: 16384,
      [ContextTier.TIER_4_PREMIUM]: 32768,
      [ContextTier.TIER_5_ULTRA]: 65536
    };
    return sizes[tier];
  }

  private getLowerTier(tier: ContextTier): ContextTier {
    const order: ContextTier[] = [
      ContextTier.TIER_1_MINIMAL,
      ContextTier.TIER_2_BASIC,
      ContextTier.TIER_3_STANDARD,
      ContextTier.TIER_4_PREMIUM,
      ContextTier.TIER_5_ULTRA
    ];
    const index = order.indexOf(tier);
    if (index <= 0) {
      return ContextTier.TIER_1_MINIMAL;
    }
    return order[index - 1];
  }

  private getRecommendedAutoSize(maxPossibleContext: number): number {
    const maxTier = this.getTierForSize(maxPossibleContext);
    const recommendedTier = this.getLowerTier(maxTier);
    const recommendedSize = this.getTierTargetSize(recommendedTier);
    return Math.min(recommendedSize, maxPossibleContext);
  }

  /**
   * Detect context tier based on max tokens (actual context window)
   */
  private detectContextTier(): import('./types.js').TierConfig {
    const maxTokens = this.currentContext.maxTokens;
    return TIER_CONFIGS[this.getTierForSize(maxTokens)];
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
      
      logger.info('[ContextManager] Hardware can support context size:', maxPossibleContext);
      
      // Map the possible context size to a tier
      return this.getTierForSize(maxPossibleContext);
    } catch (error) {
      logger.warn('[ContextManager] Failed to detect hardware capability, defaulting to Tier 3', error);
      // Default to Tier 3 if detection fails
      return ContextTier.TIER_3_STANDARD;
    }
  }

  /**
   * Get the effective tier for prompt selection
   * Prompt tier follows the actual context size for both auto and manual sizing.
   */
  private getEffectivePromptTier(): ContextTier {
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
   * Uses effective prompt tier (actual context size)
   */
  private getSystemPromptForTierAndMode(): string {
    const tier = this.getEffectivePromptTier();
    return this.promptOrchestrator.getSystemPromptForTierAndMode(this.currentMode, tier);
  }

  /**
   * Get system prompt token budget for current tier and mode
   * Uses effective prompt tier (actual context size)
   */
  private getSystemPromptTokenBudget(): number {
    const tier = this.getEffectivePromptTier();
    return this.promptOrchestrator.getSystemPromptTokenBudget(tier);
  }

  /**
   * Update system prompt based on current tier and mode
   */
  private updateSystemPrompt(): void {
    const tier = this.getEffectivePromptTier();
    const { message, tokenBudget } = this.promptOrchestrator.updateSystemPrompt({
      mode: this.currentMode,
      tier,
      activeSkills: this.activeSkills,
      currentContext: this.currentContext,
      contextPool: this.contextPool,
    });

    this.emit('system-prompt-updated', {
      tier,
      actualContextTier: this.actualContextTier,
      hardwareCapabilityTier: this.hardwareCapabilityTier,
      mode: this.currentMode,
      tokenBudget,
      content: message.content
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
    this.checkpointManager.setTaskDefinition(task);
  }

  /**
   * Add architecture decision (never compressed)
   */
  public addArchitectureDecision(decision: import('./types.js').ArchitectureDecision): void {
    this.checkpointManager.addArchitectureDecision(decision);
  }

  /**
   * Add never-compressed section
   */
  public addNeverCompressed(section: import('./types.js').NeverCompressedSection): void {
    this.checkpointManager.addNeverCompressed(section);
  }


  /**
   * Discover and load context for a specific path
   */
  async discoverContext(targetPath: string): Promise<void> {
    const roots = this.contextModules.getPersistenceRoots();
    
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

  /** Report in-flight (streaming) token delta to the manager (can be positive or negative) */
  reportInflightTokens(delta: number): void {
    this.messageStore.reportInflightTokens(delta);
  }

  /** Clear inflight token accounting (call when generation completes or is aborted) */
  clearInflightTokens(): void {
    this.messageStore.clearInflightTokens();
  }

  /**
   * Clear context (except system prompt)
   */
  async clear(): Promise<void> {
    this.messageStore.clear();
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
    logger.info('[ContextManager] Setting system prompt:');
    logger.info(`  - Effective Prompt Tier: ${this.getEffectivePromptTier()}`);
    logger.info(`  - Actual Context Tier: ${this.actualContextTier}`);
    logger.info(`  - Current Mode: ${this.currentMode}`);
    logger.info(`  - Auto-sizing: ${this.config.autoSize ? 'enabled (prompt follows context size)' : 'disabled (manual context size)'}`);
    logger.info(`  - Prompt length: ${content.length} chars, ${systemPrompt.tokenCount} tokens`);
    logger.info(`  - Prompt preview: ${content.substring(0, 200)}...`);
    
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
