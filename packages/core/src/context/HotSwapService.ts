import { ContextManager, Message as ContextMessage } from './types.js';
import { ProviderAdapter, Message as ProviderMessage } from '../provider/types.js';
import { PromptRegistry } from '../prompts/PromptRegistry.js';
import { SnapshotParser } from './SnapshotParser.js';
import { SystemPromptBuilder } from './SystemPromptBuilder.js';
import { STATE_SNAPSHOT_PROMPT } from '../prompts/templates/stateSnapshot.js';
import { PromptModeManager } from '../prompts/PromptModeManager.js';
import { SnapshotManager } from '../prompts/SnapshotManager.js';

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
  async swap(newSkills?: string[], preserveHistory: boolean = true): Promise<void> {
    const messages = await this.contextManager.getMessages();
    const userMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
    
    // Get current mode before clearing
    const currentMode = this.modeManager?.getCurrentMode() || 'assistant';
    
    // 1. Create mode transition snapshot if managers are available
    // Snapshotting is always good, but only if we have enough history
    if (!preserveHistory && this.modeManager && this.snapshotManager && userMessages.length >= 3) {
      try {
        const snapshot = this.snapshotManager.createTransitionSnapshot(
          currentMode,
          'developer', // HotSwap defaults to developer mode
          {
            messages: messages.map(m => ({
              role: m.role,
              parts: [{ type: 'text', text: m.content }]
            })),
            activeSkills: this.modeManager.getActiveSkills(),
            activeTools: [], // Will be populated by tool registry
            currentTask: undefined
          }
        );
        
        // Store snapshot before clearing
        await this.snapshotManager.storeSnapshot(snapshot, true);
        console.log('[HotSwap] Mode transition snapshot created and stored');
      } catch (error) {
        console.error('[HotSwap] Failed to create transition snapshot:', error);
        // Continue with swap even if snapshot fails
      }
    }
    
    // 2. Generate XML snapshot with Hallucination Guard
    let snapshotXml = '';
    // Only snapshot if we are clearing history and have a meaningful conversation (3+ turns)
    if (!preserveHistory && userMessages.length >= 3) {
      snapshotXml = await this.generateSnapshot(messages);
    } else {
      console.log(`[HotSwap] Skipping XML snapshot (preserveHistory=${preserveHistory}, messages=${userMessages.length}).`);
    }
    
    // 3. Clear Context (Only if NOT preserving history)
    if (!preserveHistory) {
      console.log('[HotSwap] Clearing context for fresh start');
      await this.contextManager.clear();
    } else {
      console.log('[HotSwap] Preserving conversation history (Soft Swap)');
    }

    // 4. Update skills in ModeManager if available
    if (this.modeManager && newSkills) {
      this.modeManager.updateSkills(newSkills);
    }

    // 5. Switch to developer mode (skills imply implementation)
    if (this.modeManager) {
      this.modeManager.switchMode('developer', 'manual', 1.0);
      console.log('[HotSwap] Switched to developer mode');
    }

    // 6. Build System Prompt with ModeManager or fallback to SystemPromptBuilder
    let newSystemPrompt: string;
    
    if (this.modeManager) {
      // Use ModeManager to build prompt
      newSystemPrompt = this.modeManager.buildPrompt({
        mode: 'developer',
        skills: newSkills,
        tools: [], // Will be populated by tool registry
        workspace: {
          path: process.cwd()
        }
      });
    } else {
      // Fallback to SystemPromptBuilder
      const systemPromptBuilder = new SystemPromptBuilder(this.promptRegistry);
      newSystemPrompt = systemPromptBuilder.build({
        interactive: true,
        skills: newSkills
      });
    }
    
    this.contextManager.setSystemPrompt(newSystemPrompt);

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
      console.log('[HotSwap] Switching to new skills:', newSkills);
      // Emit custom event for UI updates
      this.contextManager.emit('active-skills-updated', { skills: newSkills });
    }
    
    // Note: mode-changed event is already emitted by ModeManager.switchMode()
  }

  private async generateSnapshot(messages: ContextMessage[]): Promise<string> {
      const systemPrompt = STATE_SNAPSHOT_PROMPT.content;
      
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
