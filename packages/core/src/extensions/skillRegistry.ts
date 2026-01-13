/**
 * Skill Registry
 * 
 * Manages registration and discovery of skills from extensions.
 * Skills are pre-defined prompts that users can invoke for common tasks.
 */

import type { Skill } from './types.js';

/**
 * Registered skill with extension context
 */
export interface RegisteredSkill extends Skill {
  /** Extension that provides this skill */
  extensionName: string;
  /** Full skill identifier (extensionName.skillName) */
  id: string;
}

/**
 * Registry for managing extension skills
 */
export class SkillRegistry {
  private skills: Map<string, RegisteredSkill> = new Map();

  /**
   * Register a skill from an extension
   */
  registerSkill(extensionName: string, skill: Skill): void {
    const id = `${extensionName}.${skill.name}`;
    
    const registeredSkill: RegisteredSkill = {
      ...skill,
      extensionName,
      id,
    };

    this.skills.set(id, registeredSkill);
  }

  /**
   * Register multiple skills from an extension
   */
  registerSkills(extensionName: string, skills: Skill[]): void {
    for (const skill of skills) {
      this.registerSkill(extensionName, skill);
    }
  }

  /**
   * Unregister all skills from an extension
   */
  unregisterExtensionSkills(extensionName: string): void {
    const toRemove: string[] = [];
    
    for (const [id, skill] of this.skills.entries()) {
      if (skill.extensionName === extensionName) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.skills.delete(id);
    }
  }

  /**
   * Get a skill by its full ID (extensionName.skillName)
   */
  getSkill(id: string): RegisteredSkill | undefined {
    return this.skills.get(id);
  }

  /**
   * Get all registered skills
   */
  getAllSkills(): RegisteredSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills from a specific extension
   */
  getExtensionSkills(extensionName: string): RegisteredSkill[] {
    return Array.from(this.skills.values()).filter(
      (skill) => skill.extensionName === extensionName
    );
  }

  /**
   * Search for skills by name or description
   */
  searchSkills(query: string): RegisteredSkill[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.skills.values()).filter(
      (skill) =>
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Clear all registered skills
   */
  clear(): void {
    this.skills.clear();
  }
}

/**
 * Substitute placeholders in a skill prompt
 * 
 * Placeholders use the format {{placeholder_name}}
 * 
 * @param prompt - Prompt template with placeholders
 * @param values - Values to substitute
 * @returns Rendered prompt with placeholders replaced
 */
export function substitutePromptPlaceholders(
  prompt: string,
  values: Record<string, string>
): string {
  let result = prompt;

  // Replace all {{placeholder}} with values
  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value);
  }

  return result;
}

/**
 * Extract placeholder names from a prompt template
 * 
 * @param prompt - Prompt template
 * @returns Array of unique placeholder names
 */
export function extractPlaceholders(prompt: string): string[] {
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  const placeholders = new Set<string>();
  let match;

  while ((match = placeholderRegex.exec(prompt)) !== null) {
    // Only add if it doesn't contain additional braces (malformed)
    const name = match[1];
    if (!name.includes('{') && !name.includes('}')) {
      placeholders.add(name);
    }
  }

  return Array.from(placeholders);
}
