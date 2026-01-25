import { createLogger } from '../utils/logger.js';
import { SnapshotParser } from './snapshotParser.js';
import { ContextManager, Message as ContextMessage, OperationalMode } from './types.js';
import { SnapshotManager } from '../prompts/modeSnapshotManager.js';
import { PromptModeManager } from '../prompts/PromptModeManager.js';
import { PromptRegistry } from '../prompts/PromptRegistry.js';
import { STATE_SNAPSHOT_PROMPT } from '../prompts/templates/stateSnapshot.js';
import { ProviderAdapter, Message as ProviderMessage } from '../provider/types.js';
import { modelDatabase } from '../routing/modelDatabase.js';
import { ReasoningParser } from '../services/reasoningParser.js';

import type { ModeType } from '../prompts/ContextAnalyzer.js';

export class HotSwapService {
  constructor(
    private contextManager: ContextManager,
    private promptRegistry: PromptRegistry,
    private provider: ProviderAdapter,
    private model: string,
    private modeManager?: PromptModeManager,
    private snapshotManager?: SnapshotManager
  ) {
    // Ensure snapshot prompt is registered
    this.promptRegistry.register(STATE_SNAPSHOT_PROMPT);
  }

  /**
   * Performs a hot swap: Snapshot -> Clear -> Reseed.
   * @param newSkills Optional list of skill IDs to activate in the new session.
   * @param preserveHistory Whether to keep existing message history (Soft Swap).
   */
  async swap(newSkills?: string[], preserveHistory: boolean = true, toMode?: ModeType): Promise<void> {
    const messages = await this.contextManager.getMessages();
    const userMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
    
    // Get current mode before clearing
    const currentMode = this.modeManager?.getCurrentMode() || ('assistant' as ModeType);
    const targetMode: ModeType = (toMode as ModeType) || currentMode;
    
    // 1. Create mode transition snapshot if managers are available
    // Snapshotting is always good, but only if we have enough history
    if (!preserveHistory && this.modeManager && this.snapshotManager && userMessages.length >= 3) {
      try {
        // Collect reasoning traces (if any) using ReasoningParser
        const reasoningParser = new ReasoningParser();
        const reasoningTraces: Array<{content: string; tokenCount?: number; duration?: number; complete?: boolean}> = [];
        for (const m of messages) {
          // Only parse assistant outputs for reasoning traces
          if (m.role === 'assistant' || m.role === 'system') {
            try {
              const parsed = reasoningParser.parse(m.content || '');
              if (parsed && parsed.reasoning) {
                // Normalize reasoning trace to expected snapshot shape
                const traceContent = typeof parsed.reasoning === 'string' ? parsed.reasoning : JSON.stringify(parsed.reasoning);
                reasoningTraces.push({ content: traceContent });
              }
            } catch (_e) {
              // ignore parsing errors
            }
          }
        }

        const snapshot = this.snapshotManager.createTransitionSnapshot(
          currentMode,
          targetMode,
          {
            messages: messages.map(m => ({
              role: m.role,
              parts: [{ type: 'text', text: m.content }]
            })),
            activeSkills: this.modeManager.getActiveSkills(),
            activeTools: [], // Will be populated by tool registry
            currentTask: undefined,
            reasoningTraces
          }
        );
        
        // Store snapshot before clearing
        await this.snapshotManager.storeSnapshot(snapshot, true);
        logger.info('[HotSwap] Mode transition snapshot created and stored');
      } catch (error) {
        logger.error('[HotSwap] Failed to create transition snapshot:', error);
        // Continue with swap even if snapshot fails
      }
    }
    
    // 2. Generate XML snapshot with Hallucination Guard
    let snapshotXml = '';
    // Only snapshot if we are clearing history and have a meaningful conversation (3+ turns)
    if (!preserveHistory && userMessages.length >= 3) {
      snapshotXml = await this.generateSnapshot(messages);
    } else {
      logger.info(`[HotSwap] Skipping XML snapshot (preserveHistory=${preserveHistory}, messages=${userMessages.length}).`);
    }
    
    // 3. Clear Context (Only if NOT preserving history)
    if (!preserveHistory) {
      logger.info('[HotSwap] Clearing context for fresh start');
      await this.contextManager.clear();
    } else {
      logger.info('[HotSwap] Preserving conversation history (Soft Swap)');
    }

    // 4. Update skills if available
    if (newSkills) {
      this.modeManager?.updateSkills(newSkills);

const logger = createLogger('HotSwapService');
      this.contextManager.setActiveSkills?.(newSkills);
    }

    // 5. Switch to target mode (respect UI / caller intent)
    if (this.modeManager) {
      this.modeManager.switchMode(targetMode, 'manual', 1.0);
      logger.info(`[HotSwap] Switched to mode: ${targetMode}`);
    }

    // 6. Update system prompt via core routing
    if (this.contextManager.setMode) {
      this.contextManager.setMode(targetMode as OperationalMode);
    }

    // 7. Reseed with XML Snapshot (if available)
    if (snapshotXml) {
      const parsed = SnapshotParser.parse(snapshotXml);
      const seedContent = SnapshotParser.toSystemContext(parsed);
      
      await this.contextManager.addMessage({
        id: `seed-${Date.now()}`,
        role: 'system',
        content: seedContent,
        timestamp: new Date()
      });
    }
    
    // 8. Emit events for UI
    if (newSkills) {
      logger.info('[HotSwap] Switching to new skills:', newSkills);
      // Emit custom event for UI updates
      this.contextManager.emit('active-skills-updated', { skills: newSkills });
    }
    
    // Note: mode-changed event is already emitted by ModeManager.switchMode()
  }

  private async generateSnapshot(messages: ContextMessage[]): Promise<string> {
      // Build system prompt for snapshot generation. If the model supports reasoning,
      // prepend an instruction to preserve reasoning traces.
      const modelCaps = modelDatabase.getCapabilities(this.model || '');
      let systemPrompt = STATE_SNAPSHOT_PROMPT.content;
      if (modelCaps?.reasoning) {
        systemPrompt = '[REASONING MODE] Preserve internal reasoning traces enclosed in <think>...</think>. Include them in a <reasoning_traces> section of the snapshot.\n\n' + systemPrompt;
      }
      
      const providerMessages: ProviderMessage[] = messages.map(msg => ({
          role: msg.role,
          parts: [{ type: 'text', text: msg.content }]
      }));

      const request = {
          model: this.model,
          messages: providerMessages,
          systemPrompt: systemPrompt
      };

      let fullResponse = '';
      try {
        for await (const event of this.provider.chatStream(request)) {
            if (event.type === 'text') {
                fullResponse += event.value;
            } else if (event.type === 'error') {
                throw new Error(event.error.message);
            }
        }
      } catch (err) {
          throw new Error(`Failed to generate state snapshot: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      return fullResponse;
  }
  
  /**
   * Reseeds the context from a raw XML string
   */
  async reseedFromXml(xml: string): Promise<void> {
     const parsed = SnapshotParser.parse(xml);
     const seedContent = SnapshotParser.toSystemContext(parsed);
     
     await this.contextManager.addMessage({
       id: `seed-${Date.now()}`,
       role: 'system',
       content: seedContent,
       timestamp: new Date()
     });
  }
}
