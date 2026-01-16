import { ContextManager, Message as ContextMessage } from './types.js';
import { ProviderAdapter, Message as ProviderMessage } from '../provider/types.js';
import { PromptRegistry } from '../prompts/PromptRegistry.js';
import { SnapshotParser } from './SnapshotParser.js';
import { SystemPromptBuilder } from './SystemPromptBuilder.js';
import { STATE_SNAPSHOT_PROMPT } from '../prompts/templates/stateSnapshot.js';

export class HotSwapService {
  constructor(
    private contextManager: ContextManager,
    private promptRegistry: PromptRegistry,
    private provider: ProviderAdapter,
    private model: string
  ) {
    // Ensure snapshot prompt is registered
    this.promptRegistry.register(STATE_SNAPSHOT_PROMPT);
  }

  /**
   * Performs a hot swap: Snapshot -> Clear -> Reseed.
   * @param newSkills Optional list of skill IDs to activate in the new session.
   */
  async swap(newSkills?: string[]): Promise<void> {
    // 1. Snapshot with Hallucination Guard
    const messages = await this.contextManager.getMessages();
    const userMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
    
    let snapshotXml = '';
    // Only snapshot if we have a meaningful conversation (3+ turns)
    if (userMessages.length >= 3) {
      snapshotXml = await this.generateSnapshot(messages);
    } else {
      console.log(`[HotSwap] Skipping snapshot due to short conversation (${userMessages.length} messages).`);
    }
    
    // 2. Clear Context
    await this.contextManager.clear();

    // 3. Update System Prompt with new skills
    const systemPromptBuilder = new SystemPromptBuilder(this.promptRegistry);
    
    const newSystemPrompt = systemPromptBuilder.build({
      interactive: true,
      skills: newSkills
    });
    
    this.contextManager.setSystemPrompt(newSystemPrompt);

    // 4. Reseed with Snapshot (if available)
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
    
    // 5. Emit event for UI
    if (newSkills) {
      console.log('[HotSwap] Switching to new skills:', newSkills);
      // Emit custom event for UI updates
      this.contextManager.emit('active-skills-updated', newSkills);
    }
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
