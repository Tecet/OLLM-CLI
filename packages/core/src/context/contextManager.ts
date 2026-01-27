/**
 * Context Manager
 * 
 * Manages conversation context: messages, token counting, VRAM monitoring.
 * Does ONE job: context management.
 * 
 * Does NOT:
 * - Build prompts (that's PromptOrchestrator)
 * - Create snapshots (that's SnapshotCoordinator)
 * - Compress messages (that's CompressionCoordinator)
 * 
 * Emits events for other systems to react to.
 */

import { EventEmitter } from 'events';

import { DEFAULT_CONTEXT_CONFIG } from './contextDefaults.js';
import { createContextModules } from './contextModules.js';
import { createContextPool } from './contextPool.js';
import * as ContextSizeCalculator from './ContextSizeCalculator.js';
import { PromptOrchestrator } from './promptOrchestrator.js';
import { createTokenCounter } from './tokenCounter.js';
import { 
  ContextTier,
  TIER_CONFIGS,
  OperationalMode,
  MODE_PROFILES
} from './types.js';
import { createVRAMMonitor } from './vramMonitor.js';

import type { ContextModuleOverrides, ContextModules } from './contextModules.js';
import type { MessageStore } from './messageStore.js';
import type {
  ContextManager,
  ContextConfig,
  ContextUsage,
  ContextBudget,
  Message,
  ContextSnapshot,
  ConversationContext,
  VRAMMonitor,
  TokenCounter,
  ContextPool,
  MemoryGuard,
  ModelInfo
} from './types.js';

const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

/**
 * Context Manager Implementation
 * 
 * Manages conversation context and coordinates context-related services.
 */
export class ConversationContextManager extends EventEmitter implements ContextManager {
  public config: ContextConfig;
  public activeSkills: string[] = [];
  public activeTools: string[] = [];
  
  private vramMonitor: VRAMMonitor;
  private tokenCounter: TokenCounter;
  private contextPool: ContextPool;
  private memoryGuard: MemoryGuard;
  private messageStore: MessageStore;
  private contextModules: ContextModules;
  private promptOrchestrator: PromptOrchestrator;
  
  private currentContext: ConversationContext;
  private modelInfo: ModelInfo;
  private isStarted: boolean = false;
  private sessionId: string;
  
  // Tier and mode tracking
  private currentTier: ContextTier = ContextTier.TIER_3_STANDARD;
  private currentMode: OperationalMode = OperationalMode.ASSISTANT;
  
  // Expose snapshot/compression methods (bound from coordinators)
  public createSnapshot: () => Promise<ContextSnapshot>;
  public restoreSnapshot: (snapshotId: string) => Promise<void>;
  public listSnapshots: () => Promise<ContextSnapshot[]>;
  public getSnapshot: (snapshotId: string) => Promise<ContextSnapshot | null>;
  public compress: () => Promise<void>;
  public isSummarizationInProgress: () => boolean;
  public waitForSummarization: (timeoutMs?: number) => Promise<void>;

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
    
    // Calculate Ollama context size from user's target size
    const ollamaContextSize = ContextSizeCalculator.getOllamaContextSize(
      this.config.targetSize,
      this.modelInfo.contextProfiles || []
    );
    
    // Initialize services
    this.vramMonitor = services?.vramMonitor || createVRAMMonitor();
    this.tokenCounter = services?.tokenCounter || createTokenCounter();
    this.promptOrchestrator = new PromptOrchestrator({ tokenCounter: this.tokenCounter });
    
    // Create context pool
    this.contextPool = services?.contextPool || createContextPool(
      {
        minContextSize: ContextSizeCalculator.getOllamaContextSize(this.config.minSize, this.modelInfo.contextProfiles || []),
        maxContextSize: ContextSizeCalculator.getOllamaContextSize(this.config.maxSize, this.modelInfo.contextProfiles || []),
        targetContextSize: ollamaContextSize,
        reserveBuffer: this.config.vramBuffer,
        kvCacheQuantization: this.config.kvQuantization,
        autoSize: this.config.autoSize
      },
      async (newSize: number) => {
        // Resize callback
        this.currentContext.maxTokens = newSize;
        this.currentContext.metadata.contextSize = newSize;
        
        // Update tier based on new size
        const userSize = ContextSizeCalculator.getUserSizeFromOllama(newSize, this.modelInfo.contextProfiles || []);
        const newTier = ContextSizeCalculator.determineTier(userSize);
        const previousTier = this.currentTier;
        this.currentTier = newTier;
        
        this.emit('context-resized', { 
          newSize,
          previousTier,
          newTier
        });
        
        if (previousTier !== newTier) {
          this.emit('tier-changed', { 
            tier: newTier,
            config: TIER_CONFIGS[newTier]
          });
        }
      }
    );
    
    this.contextPool.setUserContextSize(this.config.targetSize);
    
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
      checkpoints: [],
      architectureDecisions: [],
      neverCompressed: [],
      metadata: {
        model: modelInfo.parameters.toString(),
        contextSize: this.contextPool.currentSize,
        compressionHistory: []
      }
    };
    
    // Detect initial tier
    this.currentTier = ContextSizeCalculator.determineTier(this.config.targetSize);
    
    // Create context modules
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
      getBudget: () => this.getBudget(),
      getTierConfig: () => TIER_CONFIGS[this.currentTier],
      getModeProfile: () => MODE_PROFILES[this.currentMode],
      emit: this.emit.bind(this),
      isTestEnv,
      services
    });

    this.memoryGuard = this.contextModules.memoryGuard;
    this.messageStore = this.contextModules.messageStore;
    this.memoryGuard.setContext(this.currentContext);

    // Bind snapshot and compression methods
    const snapshotCoordinator = this.contextModules.snapshotCoordinator;
    const compressionCoordinator = this.contextModules.compressionCoordinator;

    this.createSnapshot = snapshotCoordinator.createSnapshot.bind(snapshotCoordinator);
    this.restoreSnapshot = snapshotCoordinator.restoreSnapshot.bind(snapshotCoordinator);
    this.listSnapshots = snapshotCoordinator.listSnapshots.bind(snapshotCoordinator);
    this.getSnapshot = snapshotCoordinator.getSnapshot.bind(snapshotCoordinator);
    this.compress = compressionCoordinator.compress.bind(compressionCoordinator);
    this.isSummarizationInProgress = compressionCoordinator.isSummarizationInProgress.bind(compressionCoordinator);
    this.waitForSummarization = compressionCoordinator.waitForSummarization.bind(compressionCoordinator);
    
    this.messageStore.setCompress(() => this.compress());
    
    // Set up event coordination
    this.setupEventCoordination();
  }

  /**
   * Set up event coordination between services
   */
  private setupEventCoordination(): void {
    this.vramMonitor.onLowMemory(async (vramInfo) => {
      this.emit('low-memory', vramInfo);
      this.contextPool.updateVRAMInfo(vramInfo);
      
      const usagePercent = Math.round((vramInfo.used / vramInfo.total) * 100);
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
    this.vramMonitor.startMonitoring(5000);
    
    // Get initial VRAM info
    const vramInfo = await this.vramMonitor.getInfo();
    this.contextPool.updateVRAMInfo(vramInfo);
    
    if (this.config.autoSize) {
      // Auto-size based on available VRAM
      const maxPossibleContext = this.contextPool.calculateOptimalSize(vramInfo, this.modelInfo);
      const availableTiers = ContextSizeCalculator.calculateAvailableTiers(
        vramInfo.available / (1024 * 1024 * 1024), // Convert to GB
        this.modelInfo.contextProfiles || [],
        this.modelInfo.contextLimit
      );
      
      // Use largest available tier that fits in VRAM
      const selectedTier = availableTiers.options[availableTiers.options.length - 1];
      const recommendedSize = Math.min(selectedTier.ollamaSize, maxPossibleContext);
      const userFacingSize = selectedTier.size;
      
      this.config.targetSize = userFacingSize;
      await this.contextPool.resize(recommendedSize, userFacingSize);
      this.contextPool.updateConfig({ targetContextSize: recommendedSize });
      
      this.currentContext.maxTokens = this.contextPool.currentSize;
      this.currentContext.metadata.contextSize = this.contextPool.currentSize;
      
      this.currentTier = selectedTier.tier;
      
      this.emit('tier-changed', { 
        tier: this.currentTier,
        config: TIER_CONFIGS[this.currentTier]
      });
    } else {
      // Manual sizing
      this.currentTier = ContextSizeCalculator.determineTier(this.config.targetSize);
    }
    
    // Apply initial system prompt based on tier and mode
    this.promptOrchestrator.updateSystemPrompt({
      mode: this.currentMode,
      tier: this.currentTier,
      activeSkills: this.activeSkills,
      currentContext: this.currentContext,
      contextPool: this.contextPool,
      emit: this.emit.bind(this)
    });
    
    this.isStarted = true;
    this.emit('started', {
      tier: this.currentTier,
      autoSizeEnabled: this.config.autoSize
    });
  }

  /**
   * Stop context management services
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }
    
    this.vramMonitor.stopMonitoring();
    this.isStarted = false;
    this.emit('stopped');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.targetSize !== undefined) {
      const ollamaSize = ContextSizeCalculator.getOllamaContextSize(
        config.targetSize,
        this.modelInfo.contextProfiles || []
      );
      
      this.contextPool.updateConfig({
        targetContextSize: ollamaSize
      });
      
      this.contextPool.setUserContextSize(config.targetSize);
      this.currentContext.maxTokens = ollamaSize;
      
      const newTier = ContextSizeCalculator.determineTier(config.targetSize);
      if (newTier !== this.currentTier) {
        this.currentTier = newTier;
        this.emit('tier-changed', {
          tier: this.currentTier,
          config: TIER_CONFIGS[this.currentTier]
        });
      }
    }
    
    this.contextModules.updateConfig(this.config);
    this.emit('config-updated', this.config);
  }

  /**
   * Get current context usage
   */
  getUsage(): ContextUsage {
    return this.contextPool.getUsage();
  }

  /**
   * Get dynamic budget information
   */
  getBudget(): ContextBudget {
    const context = this.getContext();
    const ollamaSize = this.contextPool.getCurrentSize();
    
    const systemPromptTokens = context.messages
      .filter(m => m.role === 'system')
      .reduce((sum, m) => sum + (m.tokenCount || 0), 0);
    
    const checkpointTokens = (context.checkpoints || [])
      .reduce((sum, cp) => sum + cp.currentTokens, 0);
    
    const availableBudget = Math.max(0, ollamaSize - systemPromptTokens - checkpointTokens);
    const conversationTokens = context.tokenCount - systemPromptTokens - checkpointTokens;
    const budgetPercentage = availableBudget > 0
      ? Math.min(100, Math.max(0, (conversationTokens / availableBudget) * 100))
      : 100;
    
    return {
      totalOllamaSize: ollamaSize,
      systemPromptTokens,
      checkpointTokens,
      availableBudget,
      conversationTokens,
      budgetPercentage
    };
  }

  /**
   * Add message to context
   */
  async addMessage(message: Message): Promise<void> {
    await this.messageStore.addMessage(message);
  }

  /**
   * Set operational mode
   */
  public setMode(mode: OperationalMode): void {
    const previousMode = this.currentMode;
    this.currentMode = mode;
    
    // Update system prompt for new mode
    this.promptOrchestrator.updateSystemPrompt({
      mode: this.currentMode,
      tier: this.currentTier,
      activeSkills: this.activeSkills,
      currentContext: this.currentContext,
      contextPool: this.contextPool,
      emit: this.emit.bind(this)
    });
    
    this.emit('mode-changed', { 
      previousMode,
      mode,
      profile: MODE_PROFILES[mode]
    });
  }

  /**
   * Get current operational mode
   */
  public getMode(): OperationalMode {
    return this.currentMode;
  }

  /**
   * Get current tier
   */
  public getTier(): ContextTier {
    return this.currentTier;
  }

  /**
   * Report in-flight (streaming) token delta
   */
  reportInflightTokens(delta: number): void {
    this.messageStore.reportInflightTokens(delta);
  }

  /**
   * Clear inflight token accounting
   */
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
   * Get current context
   */
  getContext(): ConversationContext {
    return { ...this.currentContext };
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
    
    // Remove old system prompt
    this.currentContext.messages = this.currentContext.messages.filter(
      m => m.role !== 'system'
    );
    
    // Add new system prompt
    this.currentContext.messages.unshift(systemPrompt);
    this.currentContext.systemPrompt = systemPrompt;
    
    // Recalculate token count
    this.currentContext.tokenCount = this.tokenCounter.countConversationTokens(
      this.currentContext.messages
    );
    
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
   * Get current messages
   */
  async getMessages(): Promise<Message[]> {
    return this.currentContext.messages;
  }

  /**
   * Get token counting metrics
   */
  getTokenMetrics() {
    return this.tokenCounter.getMetrics();
  }

  /**
   * Reset token counting metrics
   */
  resetTokenMetrics(): void {
    this.tokenCounter.resetMetrics();
  }

  /**
   * Set active skills
   */
  setActiveSkills(skills: string[]): void {
    this.activeSkills = skills;
    this.emit('active-skills-updated', { skills });
  }

  /**
   * Validate and build prompt before sending to Ollama
   */
  async validateAndBuildPrompt(newMessage?: Message): Promise<{
    valid: boolean;
    prompt: Message[];
    totalTokens: number;
    ollamaLimit: number;
    warnings: string[];
    emergencyAction?: 'compression' | 'rollover';
  }> {
    const warnings: string[] = [];
    let emergencyAction: 'compression' | 'rollover' | undefined;
    
    const budget = this.getBudget();
    const ollamaLimit = budget.totalOllamaSize;
    
    let newMessageTokens = 0;
    if (newMessage) {
      newMessageTokens = this.tokenCounter.countTokensCached(
        newMessage.id,
        newMessage.content
      );
    }
    
    const totalTokens = budget.systemPromptTokens + 
                       budget.checkpointTokens + 
                       budget.conversationTokens + 
                       newMessageTokens;
    
    const usagePercentage = (totalTokens / ollamaLimit) * 100;
    
    // Check thresholds
    if (usagePercentage >= 100) {
      warnings.push(
        `CRITICAL: Context at ${usagePercentage.toFixed(1)}% (${totalTokens}/${ollamaLimit} tokens)`,
        'Triggering emergency rollover'
      );
      emergencyAction = 'rollover';
      
      // Create snapshot and rollover
      try {
        const snapshot = await this.createSnapshot();
        
        const recentMessages = this.currentContext.messages
          .filter(m => m.role === 'user')
          .slice(-10);
        
        const summaryContent = `[EMERGENCY ROLLOVER - Context exceeded limit]
Snapshot ID: ${snapshot.id}
Previous conversation: ${this.currentContext.messages.length} messages
Total tokens before rollover: ${totalTokens}`;
        
        const summaryMessage: Message = {
          id: `rollover-summary-${Date.now()}`,
          role: 'system',
          content: summaryContent,
          timestamp: new Date(),
          tokenCount: this.tokenCounter.countTokensCached(
            `rollover-summary-${Date.now()}`,
            summaryContent
          )
        };
        
        this.currentContext.messages = [
          this.currentContext.systemPrompt,
          summaryMessage,
          ...recentMessages
        ];
        this.currentContext.checkpoints = [];
        this.currentContext.tokenCount = this.tokenCounter.countConversationTokens(
          this.currentContext.messages
        );
        
        this.contextPool.setCurrentTokens(this.currentContext.tokenCount);
        
        this.emit('emergency-rollover', {
          snapshotId: snapshot.id,
          previousTokens: totalTokens,
          newTokens: this.currentContext.tokenCount
        });
      } catch (error) {
        warnings.push(`Emergency rollover failed: ${(error as Error).message}`);
        return {
          valid: false,
          prompt: [],
          totalTokens,
          ollamaLimit,
          warnings,
          emergencyAction
        };
      }
    } else if (usagePercentage >= 95) {
      warnings.push(
        `WARNING: Context at ${usagePercentage.toFixed(1)}% (${totalTokens}/${ollamaLimit} tokens)`,
        'Triggering emergency compression'
      );
      emergencyAction = 'compression';
      
      try {
        await this.compress();
      } catch (error) {
        warnings.push(`Emergency compression failed: ${(error as Error).message}`);
        return {
          valid: false,
          prompt: [],
          totalTokens,
          ollamaLimit,
          warnings,
          emergencyAction
        };
      }
    } else if (usagePercentage >= 80) {
      warnings.push(
        `INFO: Context at ${usagePercentage.toFixed(1)}% (${totalTokens}/${ollamaLimit} tokens)`
      );
    }
    
    const prompt = [...this.currentContext.messages];
    if (newMessage) {
      prompt.push(newMessage);
    }
    
    return {
      valid: true,
      prompt,
      totalTokens,
      ollamaLimit,
      warnings,
      emergencyAction
    };
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
