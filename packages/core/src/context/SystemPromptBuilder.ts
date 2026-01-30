import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { PromptRegistry } from '../prompts/PromptRegistry.js';

export interface SystemPromptConfig {
  interactive: boolean;
  mode?: string; // Current operational mode (optional for backward compatibility)
  tier?: number; // Context tier (1-5) (optional for backward compatibility)
  modelSupportsTools?: boolean; // Whether model supports function calling (optional for backward compatibility)
  allowedTools?: string[]; // Tools enabled for this mode (optional for backward compatibility)
  useSanityChecks?: boolean;
  agentName?: string;
  additionalInstructions?: string;
  skills?: string[]; // Legacy - will be replaced by mode-specific skills
}

export class SystemPromptBuilder {
  private baseDir: string;

  constructor(private registry: PromptRegistry) {
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

    // 2. Mode-Specific Skills (if mode is provided)
    if (config.mode) {
      const skillsFile = `system/skills/Skills${this.capitalize(config.mode)}.txt`;
      if (this.templateExists(skillsFile)) {
        const skills = this.loadTemplate(skillsFile);
        if (skills) {
          sections.push(skills);
        }
      }
    }

    // 3. Available Tools (only if model supports tools and tools are provided)
    if (config.modelSupportsTools && config.allowedTools && config.allowedTools.length > 0) {
      const toolsSection = this.buildToolsSection(config.allowedTools);
      if (toolsSection) {
        sections.push(toolsSection);
      }
    }

    // 4. Sanity Checks (Optional, loaded from file)
    if (config.useSanityChecks) {
      const sanity = this.loadTemplate('system/SanityChecks.txt');
      if (sanity) {
        sections.push(sanity);
      }
    }

    // 5. Legacy Skills (Tier 2 - for backward compatibility)
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

    // 6. Custom/Additional Instructions
    if (config.additionalInstructions) {
      sections.push('# Additional Instructions\n' + config.additionalInstructions);
    }

    return sections.join('\n\n');
  }

  /**
   * Build tools section with filtered tool descriptions
   */
  private buildToolsSection(allowedTools: string[]): string {
    const allToolDescriptions = this.loadTemplate('system/ToolDescriptions.txt');
    if (!allToolDescriptions) {
      return '';
    }

    // Filter to only show allowed tools
    return this.filterToolDescriptions(allToolDescriptions, allowedTools);
  }

  /**
   * Filter tool descriptions to only include allowed tools
   */
  private filterToolDescriptions(fullText: string, allowedTools: string[]): string {
    // If wildcard, return all
    if (allowedTools.includes('*')) {
      return fullText;
    }

    const lines = fullText.split('\n');
    const filtered: string[] = [];
    let inSection = false;
    let currentSection = '';

    for (const line of lines) {
      // Keep title and section headers
      if (line.startsWith('# ') || line.startsWith('## ')) {
        filtered.push(line);
        currentSection = line;
        inSection = true;
        continue;
      }

      // Check if this is a tool description line
      if (line.startsWith('- **')) {
        const match = line.match(/- \*\*([^:]+):/);
        if (match) {
          const toolName = match[1];

          // Check if tool is allowed
          const isAllowed = allowedTools.some((allowed) => {
            if (allowed === '*') return true;
            if (allowed.endsWith(':*')) {
              // Wildcard pattern like "mcp:*"
              const prefix = allowed.slice(0, -1);
              return toolName.startsWith(prefix);
            }
            if (allowed.includes('_*')) {
              // Wildcard pattern like "git_*"
              const prefix = allowed.slice(0, -1);
              return toolName.startsWith(prefix);
            }
            return toolName === allowed;
          });

          if (isAllowed) {
            filtered.push(line);
          }
        }
      } else if (inSection && line.trim() === '') {
        // Keep empty lines within sections
        filtered.push(line);
      } else if (!line.startsWith('- **')) {
        // Keep non-tool lines (like guidelines)
        filtered.push(line);
      }
    }

    return filtered.join('\n');
  }

  /**
   * Capitalize first letter of string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
