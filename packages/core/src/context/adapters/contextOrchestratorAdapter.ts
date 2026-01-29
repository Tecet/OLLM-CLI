/**
 * Context Orchestrator Adapter
 *
 * Adapts the new ContextOrchestrator to implement the legacy ContextManager interface.
 * This allows the CLI to use the new system without changes.
 *
 * @module contextOrchestratorAdapter
 */

import { EventEmitter } from 'events';
import { ContextOrchestrator } from '../orchestration/contextOrchestrator.js';
import { OperationalMode, ContextTier } from '../types.js';

import type { 
  ContextManager, 
  ContextConfig, 
  ContextUsage, 
  ContextSnapshot, 
  ContextBudget,
  Message 
} from '../types.js';

/**
 * Calculate context tier based on context size
 */
function calculateTier(contextSize: number): ContextTier {
  if (contextSize <= 4096) return ContextTier.TIER_1_MINIMAL;
  if (contextSize <= 8192) return ContextTier.TIER_2_BASIC;
  if (contextSize <= 16384) return ContextTier.TIER_3_STANDARD;
  if (contextSize <= 32768) return ContextTier.TIER_4_PREMIUM;
  return ContextTier.TIER_5_ULTRA;
}

/**
 * Adapter that makes ContextOrchestrator compatible with legacy ContextManager interface
 */
export class ContextOrchestratorAdapter extends EventEmitter implements ContextManager {
  private orchestrator: ContextOrchestrator;
  public config: ContextConfig;
  public activeSkills: string[] = [];
  public activeTools: string[] = [
    'read-file',
    'write-file', 
    'edit-file',
    'shell',
    'web-fetch',
    'web-search',
    'memory',
    'git',
  ];
  private currentMode: OperationalMode;
  private currentTier: ContextTier;
  private systemPromptText: string = '';

  constructor(orchestrator: ContextOrchestrator, config: ContextConfig, initialMode?: OperationalMode, initialTier?: ContextTier) {
    super();
    this.orchestrator = orchestrator;
    this.config = config;
    this.currentMode = initialMode || OperationalMode.ASSISTANT;
    this.currentTier = initialTier || calculateTier(config.targetSize || 8192);
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  async start(): Promise<void> {
    // Emit started event with correct tier
    this.emit('started', {
      tier: this.currentTier,
      autoSizeEnabled: this.config.autoSize ?? true,
    });
  }

  async stop(): Promise<void> {
    this.emit('stopped');
  }

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  updateConfig(config: Partial<ContextConfig>): void {
    const oldSize = this.config.targetSize || 8192;
    this.config = { ...this.config, ...config };
    const newSize = this.config.targetSize || 8192;
    
    // If context size changed, recalculate and emit tier change
    if (oldSize !== newSize) {
      const newTier = calculateTier(newSize);
      this.currentTier = newTier;
      this.orchestrator.updateTier(newTier);
      this.orchestrator.updateContextSize(newSize);
      this.emit('tier-changed', { tier: newTier });
    }
    
    this.emit('config-updated', config);
  }

  // ============================================================================
  // Usage and Budget Methods
  // ============================================================================

  getUsage(): ContextUsage {
    const state = this.orchestrator.getState();
    const fullContextSize = this.config.targetSize || 8192;
    
    return {
      currentTokens: state.activeContext.tokenCount.total,
      maxTokens: fullContextSize, // Show full context size in UI, not ollama limit
      percentage: Math.round((state.activeContext.tokenCount.total / fullContextSize) * 100),
      vramUsed: 0, // Orchestrator doesn't track VRAM
      vramTotal: 0,
    };
  }

  getBudget(): ContextBudget {
    const state = this.orchestrator.getState();
    const fullContextSize = this.config.targetSize || 8192;
    
    return {
      totalOllamaSize: fullContextSize, // Show full context size, not reduced ollama limit
      systemPromptTokens: state.activeContext.tokenCount.system,
      checkpointTokens: state.activeContext.tokenCount.checkpoints,
      availableBudget: fullContextSize - state.activeContext.tokenCount.total,
      conversationTokens: state.activeContext.tokenCount.recent,
      budgetPercentage: Math.round((state.activeContext.tokenCount.total / fullContextSize) * 100),
    };
  }

  /**
   * Get the Ollama context limit (reduced value sent to Ollama)
   * This is the pre-calculated value from the model's context profiles
   * that gets sent to Ollama as num_ctx parameter.
   * 
   * This value comes from the LLM_profiles.json file's ollama_context_size field,
   * or is calculated as 85% of the context size if not found in the profiles.
   * 
   * @returns Ollama context limit in tokens
   */
  getOllamaContextLimit(): number {
    return this.orchestrator.getOllamaLimit();
  }

  // ============================================================================
  // Message Methods
  // ============================================================================

  async addMessage(message: Message): Promise<void> {
    const result = await this.orchestrator.addMessage(message);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to add message');
    }

    this.emit('message-added', message);
    
    if (result.compressionTriggered) {
      this.emit('compression-complete', {
        tokensFreed: result.tokensFreed,
      });
    }
  }

  async getMessages(): Promise<Message[]> {
    const state = this.orchestrator.getState();
    return [
      state.activeContext.systemPrompt,
      ...state.activeContext.checkpoints.map(cp => ({
        id: cp.id,
        role: 'assistant' as const,
        content: cp.summary,
        timestamp: new Date(cp.timestamp),
      })),
      ...state.activeContext.recentMessages,
    ];
  }

  // ============================================================================
  // Snapshot Methods
  // ============================================================================

  async createSnapshot(): Promise<ContextSnapshot> {
    const snapshotId = await this.orchestrator.createSnapshot('recovery');
    const state = this.orchestrator.getState();
    
    return {
      id: snapshotId,
      sessionId: 'default', // TODO: Get from orchestrator
      timestamp: new Date(),
      tokenCount: state.activeContext.tokenCount.total,
      summary: 'Snapshot created',
      userMessages: [],
      archivedUserMessages: [],
      messages: state.activeContext.recentMessages,
      metadata: {
        model: 'unknown',
        contextSize: state.health.tokenLimit,
        compressionRatio: 1.0,
        totalUserMessages: 0,
        totalGoalsCompleted: 0,
        totalCheckpoints: state.activeContext.checkpoints.length,
      },
    };
  }

  async restoreSnapshot(snapshotId: string): Promise<void> {
    await this.orchestrator.restoreSnapshot(snapshotId);
    this.emit('snapshot-restored', { snapshotId });
  }

  async listSnapshots(): Promise<ContextSnapshot[]> {
    // Orchestrator doesn't have listSnapshots yet
    // Return empty array for now
    return [];
  }

  // ============================================================================
  // Compression Methods
  // ============================================================================

  async compress(): Promise<void> {
    const result = await this.orchestrator.compress();
    
    if (!result.success) {
      throw new Error(result.error || 'Compression failed');
    }

    this.emit('compression-complete', {
      tokensFreed: result.freedTokens,
    });
  }

  // ============================================================================
  // Skills and Tools Methods
  // ============================================================================

  setActiveSkills(skills: string[]): void {
    this.activeSkills = skills;
    this.emit('skills-changed', { skills });
  }

  // ============================================================================
  // System Prompt Methods
  // ============================================================================

  setSystemPrompt(prompt: string): void {
    this.systemPromptText = prompt;
    this.emit('system-prompt-changed', { prompt });
  }

  getSystemPrompt(): string {
    return this.systemPromptText || this.orchestrator.getState().activeContext.systemPrompt.content;
  }

  // ============================================================================
  // Mode Methods
  // ============================================================================

  setMode(mode: OperationalMode): void {
    const oldMode = this.currentMode;
    this.currentMode = mode;
    this.orchestrator.updateMode(mode);
    
    // Emit mode-changed event with both old and new mode
    this.emit('mode-changed', { 
      mode,
      oldMode,
    });
  }

  getMode(): OperationalMode {
    return this.currentMode;
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  async validateAndBuildPrompt(newMessage?: Message): Promise<{
    valid: boolean;
    prompt: Message[];
    totalTokens: number;
    ollamaLimit: number;
    warnings: string[];
    emergencyAction?: 'compression' | 'rollover';
  }> {
    const prompt = this.orchestrator.buildPrompt(newMessage);
    const state = this.orchestrator.getState();
    
    const totalTokens = state.activeContext.tokenCount.total + 
      (newMessage ? this.countTokens(newMessage.content) : 0);
    
    const valid = totalTokens <= state.health.tokenLimit;
    const warnings: string[] = [];
    
    if (!valid) {
      warnings.push(`Context exceeds limit: ${totalTokens} > ${state.health.tokenLimit}`);
    }
    
    if (state.health.utilizationPercent > 80) {
      warnings.push(`High context utilization: ${state.health.utilizationPercent}%`);
    }

    return {
      valid,
      prompt,
      totalTokens,
      ollamaLimit: state.health.tokenLimit,
      warnings,
      emergencyAction: !valid ? 'compression' : undefined,
    };
  }

  // ============================================================================
  // Summarization Status Methods
  // ============================================================================

  isSummarizationInProgress(): boolean {
    // Orchestrator handles this internally
    return false;
  }

  async waitForSummarization(timeoutMs: number = 30000): Promise<void> {
    // Orchestrator handles this internally
    return Promise.resolve();
  }

  // ============================================================================
  // Token Tracking Methods
  // ============================================================================

  reportInflightTokens(delta: number): void {
    // Orchestrator doesn't need this
  }

  clearInflightTokens(): void {
    // Orchestrator doesn't need this
  }

  getTokenMetrics(): {
    cacheHitRate: string;
    cacheHits: number;
    cacheMisses: number;
    recalculations: number;
    totalTokensCounted: number;
    largestMessage: number;
    avgTokensPerMessage: number;
    uptimeSeconds: number;
  } {
    // Return dummy metrics for now
    return {
      cacheHitRate: '100%',
      cacheHits: 0,
      cacheMisses: 0,
      recalculations: 0,
      totalTokensCounted: 0,
      largestMessage: 0,
      avgTokensPerMessage: 0,
      uptimeSeconds: 0,
    };
  }

  resetTokenMetrics(): void {
    // No-op for orchestrator
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  async clear(): Promise<void> {
    await this.createSnapshot();
    this.emit('cleared');
  }

  private countTokens(text: string): number {
    // Simple approximation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get orchestrator state (for debugging)
   */
  getState() {
    return this.orchestrator.getState();
  }
}
