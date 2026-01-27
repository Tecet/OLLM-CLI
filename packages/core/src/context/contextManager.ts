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
        
        // Update selected tier based on new size
        const newTierConfig = this.detectContextTier();
        const previousTier = this.selectedTier;
        this.selectedTier = newTierConfig.tier;
        this.currentTier = newTierConfig.tier;
        this.tierConfig = newTierConfig;
        
        // Emit resize event with tier information
        this.emit('context-resized', { 
          newSize,
          previousTier,
          newTier: this.selectedTier,
          promptTierStable: !this.config.autoSize
        });
        
        // Update prompt if the tier changed (auto-sizing can shift context tiers)
        if (previousTier !== this.selectedTier) {
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
      
      // Show warning - context size stays FIXED for session
      // Do NOT resize mid-conversation as it breaks session stability
      const usagePercent = Math.round((vramInfo.used / vramInfo.total) * 100);
      const usedMB = Math.round(vramInfo.used / (1024 * 1024));
      const totalMB = Math.round(vramInfo.total / (1024 * 1024));
      
      console.warn('[ContextManager] ⚠️ Low memory detected');
      console.warn(`  VRAM Usage: ${usedMB}MB / ${totalMB}MB (${usagePercent}%)`);
      console.warn(`  Current context size: ${this.contextPool.currentSize} tokens`);
      console.warn('  Your current context size may cause performance issues.');
      console.warn('  Consider restarting with a smaller context size.');
      
      // Emit warning event for UI to display
      this.emit('low-memory-warning', {
        vramInfo,
        currentContextSize: this.contextPool.currentSize,
        usagePercent,
        message: 'Low memory detected. Consider restarting with smaller context size.'
      });
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
      
      // Detect selected tier after resize
      const newTierConfig = this.detectContextTier();
      this.currentTier = newTierConfig.tier;
      this.tierConfig = newTierConfig;
      this.selectedTier = newTierConfig.tier;
      
      // With auto-sizing, prompt tier follows context size
      console.log('[ContextManager] Auto-sizing enabled - prompt tier follows context size');
      console.log('[ContextManager] Selected tier:', this.selectedTier);
      
      this.emit('tier-changed', { 
        tier: this.currentTier, 
        config: this.tierConfig,
        selectedTier: this.selectedTier,
        promptTierLocked: false
      });
    } else {
      // Manual sizing - detect the selected tier based on configured size
      const tierConfig = this.detectContextTier();
      this.selectedTier = tierConfig.tier;
      this.currentTier = tierConfig.tier;
      this.tierConfig = tierConfig;
      
      console.log('[ContextManager] Manual context sizing - using selected tier');
      console.log('[ContextManager] Selected tier:', this.selectedTier);
    }
    
    // Apply initial system prompt based on selected tier and mode
    // This prompt will remain stable throughout the session when auto-sizing is enabled
    this.updateSystemPrompt();
    
    this.isStarted = true;
    this.emit('started', {
      selectedTier: this.selectedTier,
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
        const oldTier = this.selectedTier;
        const newTierConfig = this.detectContextTier();
        this.selectedTier = newTierConfig.tier;
        this.currentTier = newTierConfig.tier;
        this.tierConfig = newTierConfig;
        
        // Emit tier-changed event if tier actually changed
        if (oldTier !== this.selectedTier) {
          console.log(`[ContextManager] Tier changed: ${oldTier} → ${this.selectedTier}`);
          
          this.emit('tier-changed', {
            tier: this.currentTier,
            config: this.tierConfig,
            selectedTier: this.selectedTier,
            promptTierLocked: this.config.autoSize
          });
          
          console.log('[ContextManager] Updating system prompt to match new tier');
          this.updateSystemPrompt();
          
          this.emit('system-prompt-updated', {
            tier: this.selectedTier,
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
  
  // Selected tier (based on context size) - single source of truth for tier label
  // Used for both context window sizing and prompt selection
  private selectedTier: ContextTier = ContextTier.TIER_3_STANDARD;

  private getTierForSize(size: number): ContextTier {
    // Use model-specific context profiles if available
    if (this.modelInfo.contextProfiles && this.modelInfo.contextProfiles.length > 0) {
      const profiles = this.modelInfo.contextProfiles;
      const maxWindow = this.modelInfo.contextLimit;
      
      // Find the profile that matches or exceeds the requested size
      const matchingProfile = profiles.find(p => p.size >= size);
      if (matchingProfile) {
        const profileSize = matchingProfile.size;
        
        // Map size to tier based on model's capabilities
        if (profileSize >= 65536 && maxWindow >= 65536) return ContextTier.TIER_5_ULTRA;
        if (profileSize >= 32768 && maxWindow >= 32768) return ContextTier.TIER_4_PREMIUM;
        if (profileSize >= 16384) return ContextTier.TIER_3_STANDARD;
        if (profileSize >= 8192) return ContextTier.TIER_2_BASIC;
        return ContextTier.TIER_1_MINIMAL;
      }
    }
    
    // Fallback to hardcoded tiers if no profiles available
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
    // Use model-specific context profiles if available
    if (this.modelInfo.contextProfiles && this.modelInfo.contextProfiles.length > 0) {
      const profiles = this.modelInfo.contextProfiles;
      
      // Map tier to target size
      const tierSizes: Record<ContextTier, number> = {
        [ContextTier.TIER_1_MINIMAL]: 4096,
        [ContextTier.TIER_2_BASIC]: 8192,
        [ContextTier.TIER_3_STANDARD]: 16384,
        [ContextTier.TIER_4_PREMIUM]: 32768,
        [ContextTier.TIER_5_ULTRA]: 65536
      };
      
      const targetSize = tierSizes[tier];
      
      // Find closest profile that meets or exceeds target
      const matchingProfile = profiles.find(p => p.size >= targetSize);
      if (matchingProfile) {
        return matchingProfile.size;
      }
      
      // If no profile meets target, return largest available
      if (profiles.length > 0) {
        return profiles[profiles.length - 1].size;
      }
    }
    
    // Fallback to hardcoded sizes if no profiles available
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
   * Uses selected tier (based on context size)
   */
  private getSystemPromptForTierAndMode(): string {
    return this.promptOrchestrator.getSystemPromptForTierAndMode(this.currentMode, this.selectedTier);
  }

  /**
   * Get system prompt token budget for current tier and mode
   * Uses selected tier (based on context size)
   */
  private getSystemPromptTokenBudget(): number {
    return this.promptOrchestrator.getSystemPromptTokenBudget(this.selectedTier);
  }

  /**
   * Update system prompt based on current tier and mode
   */
  private updateSystemPrompt(): void {
    const { message, tokenBudget } = this.promptOrchestrator.updateSystemPrompt({
      mode: this.currentMode,
      tier: this.selectedTier,
      activeSkills: this.activeSkills,
      currentContext: this.currentContext,
      contextPool: this.contextPool,
    });

    this.emit('system-prompt-updated', {
      tier: this.selectedTier,
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
    console.log('[ContextManager] Setting system prompt:');
    console.log(`  - Selected Tier: ${this.selectedTier}`);
    console.log(`  - Current Mode: ${this.currentMode}`);
    console.log(`  - Auto-sizing: ${this.config.autoSize ? 'enabled (prompt follows context size)' : 'disabled (manual context size)'}`);
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
