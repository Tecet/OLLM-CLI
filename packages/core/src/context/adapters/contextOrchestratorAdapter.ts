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
import { OperationalMode } from '../types.js';

import type { 
  ContextManager, 
  ContextConfig, 
  ContextUsage, 
  ContextSnapshot, 
  ContextBudget,
  Message 
} from '../types.js';

/**
 * Adapter that makes ContextOrchestrator compatible with legacy ContextManager interface
 */
export class ContextOrchestratorAdapter extends EventEmitter implements ContextManager {
  private orchestrator: ContextOrchestrator;
  public config: ContextConfig;
  public activeSkills: string[] = [];
  public activeTools: string[] = [];
  private currentMode: OperationalMode = OperationalMode.ASSISTANT;
  private systemPromptText: string = '';

  constructor(orchestrator: ContextOrchestrator, config: ContextConfig) {
    super();
    this.orchestrator = orchestrator;
    this.config = config;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  async start(): Promise<void> {
    // Emit started event with initial state
    // Use tier from config or default to TIER_3_STANDARD
    const tier = (this.config as any).tier || 3; // ContextTier.TIER_3_STANDARD = 3
    this.emit('started', {
      tier,
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
    this.config = { ...this.config, ...config };
    this.emit('config-updated', config);
  }

  // ============================================================================
  // Usage and Budget Methods
  // ============================================================================

  getUsage(): ContextUsage {
    const state = this.orchestrator.getState();
    
    return {
      currentTokens: state.activeContext.tokenCount.total,
      maxTokens: state.health.tokenLimit,
      percentage: state.health.utilizationPercent,
      vramUsed: 0, // Orchestrator doesn't track VRAM
      vramTotal: 0,
    };
  }

  getBudget(): ContextBudget {
    const state = this.orchestrator.getState();
    
    return {
      totalOllamaSize: state.health.tokenLimit,
      systemPromptTokens: state.activeContext.tokenCount.system,
      checkpointTokens: state.activeContext.tokenCount.checkpoints,
      availableBudget: state.health.tokenLimit - state.activeContext.tokenCount.total,
      conversationTokens: state.activeContext.tokenCount.recent,
      budgetPercentage: state.health.utilizationPercent,
    };
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
    this.currentMode = mode;
    this.emit('mode-changed', { mode });
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
