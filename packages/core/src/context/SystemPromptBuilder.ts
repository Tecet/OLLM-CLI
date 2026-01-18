import { PromptRegistry } from '../prompts/PromptRegistry.js';
import { IDENTITY_PROMPT } from '../prompts/templates/identity.js';
import { MANDATES_PROMPT } from '../prompts/templates/mandates.js';
import { REALITY_CHECK_PROMPT } from '../prompts/templates/sanity.js';

export interface SystemPromptConfig {
  interactive: boolean;
  useSanityChecks?: boolean;
  agentName?: string;
  additionalInstructions?: string;
  skills?: string[];
}

export class SystemPromptBuilder {
  constructor(private registry: PromptRegistry) {
    // Register core prompts by default
    this.registry.register(IDENTITY_PROMPT);
    this.registry.register(MANDATES_PROMPT);
    this.registry.register(REALITY_CHECK_PROMPT);
  }

  /**
   * Builds the final system prompt string based on configuration and active layers.
   */
  build(config: SystemPromptConfig): string {
    const sections: string[] = [];

    // 1. Identity (Tier 1)
    const identity = this.registry.get('core-identity');
    if (identity) {
      const agentType = config.interactive ? 'an interactive ' : 'a non-interactive ';
      sections.push(identity.content.replace('{{agentType}}', agentType));
    }

    // 2. Mandates (Tier 1)
    const mandates = this.registry.get('core-mandates');
    if (mandates) {
      sections.push(mandates.content);
    }

    // 3. Active Skills (Tier 2)
    if (config.skills && config.skills.length > 0) {
      const skillsContent: string[] = [];
      for (const skillId of config.skills) {
        const skill = this.registry.get(skillId);
        if (skill) {
          skillsContent.push(skill.content);
        }
      }
      if (skillsContent.length > 0) {
        sections.push('# Active Skills\n' + skillsContent.join('\n\n'));
      }
    }

    // 4. Sanity Checks (Tier 2/3 - Optional)
    if (config.useSanityChecks) {
      const sanity = this.registry.get('sanity-reality-check');
      if (sanity) {
        sections.push(sanity.content);
      }
    }

    // 5. Custom/Additional Instructions
    if (config.additionalInstructions) {
      sections.push('# Additional Instructions\n' + config.additionalInstructions);
    }

    return sections.join('\n\n');
  }
}
