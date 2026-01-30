import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { PromptRegistry } from '../prompts/PromptRegistry.js';
import { REALITY_CHECK_PROMPT } from '../prompts/templates/sanity.js';

export interface SystemPromptConfig {
  interactive: boolean;
  useSanityChecks?: boolean;
  agentName?: string;
  additionalInstructions?: string;
  skills?: string[];
}

export class SystemPromptBuilder {
  private baseDir: string;

  constructor(private registry: PromptRegistry) {
    // Register sanity checks (still in TypeScript for now)
    this.registry.register(REALITY_CHECK_PROMPT);

    // Set base directory for template files
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    this.baseDir = path.resolve(moduleDir, '../prompts/templates');
  }

  /**
   * Load a template file from the templates directory
   */
  private loadTemplate(relativePath: string): string {
    const filePath = path.join(this.baseDir, relativePath);
    try {
      return fs.readFileSync(filePath, 'utf8').trim();
    } catch (error) {
      console.warn(`[SystemPromptBuilder] Failed to load template: ${filePath}`, error);
      return '';
    }
  }

  /**
   * Check if a template file exists
   */
  private templateExists(relativePath: string): boolean {
    const filePath = path.join(this.baseDir, relativePath);
    return fs.existsSync(filePath);
  }

  /**
   * Builds the final system prompt string based on configuration and active layers.
   */
  build(config: SystemPromptConfig): string {
    const sections: string[] = [];

    // 1. Core Mandates (loaded from file)
    const mandates = this.loadTemplate('system/CoreMandates.txt');
    if (mandates) {
      sections.push(mandates);
    }

    // 2. Active Skills (Tier 2)
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

    // 3. Sanity Checks (Tier 2/3 - Optional)
    if (config.useSanityChecks) {
      const sanity = this.registry.get('sanity-reality-check');
      if (sanity) {
        sections.push(sanity.content);
      }
    }

    // 4. Custom/Additional Instructions
    if (config.additionalInstructions) {
      sections.push('# Additional Instructions\n' + config.additionalInstructions);
    }

    return sections.join('\n\n');
  }
}
