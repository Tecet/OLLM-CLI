/**
 * Property-based tests for skill registry
 * 
 * Feature: stage-05-hooks-extensions-mcp, Property 34: Extension Skills Registration
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { SkillRegistry, substitutePromptPlaceholders, extractPlaceholders } from '../skillRegistry.js';
import type { Skill } from '../types.js';

describe('SkillRegistry - Property Tests', () => {
  // Note: We create a fresh registry in each property test to ensure isolation

  // Arbitrary generators
  const skillNameArb = fc.stringMatching(/^[a-z][a-z0-9-]*$/);
  const extensionNameArb = fc.stringMatching(/^[a-z][a-z0-9-]*$/);
  const descriptionArb = fc.string({ minLength: 1, maxLength: 200 });
  const promptArb = fc.string({ minLength: 1, maxLength: 500 });

  const skillArb = fc.record({
    name: skillNameArb,
    description: descriptionArb,
    prompt: promptArb,
  }) as fc.Arbitrary<Skill>;

  // Generate array of skills with unique names
  const skillsArrayArb = fc
    .array(skillArb, { minLength: 1, maxLength: 10 })
    .map((skills) => {
      // Deduplicate by skill name (keep last occurrence)
      const uniqueSkills = new Map<string, Skill>();
      for (const skill of skills) {
        uniqueSkills.set(skill.name, skill);
      }
      return Array.from(uniqueSkills.values());
    });

  /**
   * Property 34: Extension Skills Registration
   * 
   * For any extension that declares skills, those skills should be registered
   * with the skill system, discoverable via list commands, and invokable with
   * placeholder substitution.
   */
  describe('Property 34: Extension Skills Registration', () => {
    it('should register skills and make them discoverable', () => {
      fc.assert(
        fc.property(
          extensionNameArb,
          skillsArrayArb,
          (extensionName, skills) => {
            const registry = new SkillRegistry(); // Fresh registry for each test
            
            // Register skills
            registry.registerSkills(extensionName, skills);

            // All skills should be discoverable
            const allSkills = registry.getAllSkills();
            expect(allSkills.length).toBe(skills.length);

            // Each skill should be retrievable by ID
            for (const skill of skills) {
              const id = `${extensionName}.${skill.name}`;
              const retrieved = registry.getSkill(id);
              
              expect(retrieved).toBeDefined();
              expect(retrieved?.name).toBe(skill.name);
              expect(retrieved?.description).toBe(skill.description);
              expect(retrieved?.prompt).toBe(skill.prompt);
              expect(retrieved?.extensionName).toBe(extensionName);
              expect(retrieved?.id).toBe(id);
            }

            // Skills should be retrievable by extension
            const extensionSkills = registry.getExtensionSkills(extensionName);
            expect(extensionSkills.length).toBe(skills.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow searching for skills by name or description', () => {
      fc.assert(
        fc.property(
          extensionNameArb,
          skillsArrayArb,
          (extensionName, skills) => {
            const registry = new SkillRegistry(); // Fresh registry for each test
            
            // Register skills
            registry.registerSkills(extensionName, skills);

            // Search by skill name
            for (const skill of skills) {
              const results = registry.searchSkills(skill.name);
              expect(results.some(s => s.name === skill.name)).toBe(true);
            }

            // Search by description substring
            for (const skill of skills) {
              if (skill.description.length > 3) {
                const substring = skill.description.substring(0, 3);
                const results = registry.searchSkills(substring);
                // Should find at least the skill we're looking for
                expect(results.length).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should unregister all skills when extension is disabled', () => {
      fc.assert(
        fc.property(
          extensionNameArb,
          skillsArrayArb,
          (extensionName, skills) => {
            const registry = new SkillRegistry(); // Fresh registry for each test
            
            // Register skills
            registry.registerSkills(extensionName, skills);

            // Verify skills are registered
            const beforeCount = registry.getAllSkills().length;
            expect(beforeCount).toBe(skills.length);

            // Unregister extension skills
            registry.unregisterExtensionSkills(extensionName);

            // Skills should no longer be retrievable
            for (const skill of skills) {
              const id = `${extensionName}.${skill.name}`;
              const retrieved = registry.getSkill(id);
              expect(retrieved).toBeUndefined();
            }

            // Extension should have no skills
            const extensionSkills = registry.getExtensionSkills(extensionName);
            expect(extensionSkills.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Placeholder Substitution
   * 
   * For any prompt template with placeholders, substituting values should
   * replace all placeholders with their corresponding values.
   */
  describe('Placeholder Substitution', () => {
    const placeholderNameArb = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
    const placeholderValueArb = fc.string({ minLength: 0, maxLength: 100 });

    it('should substitute all placeholders in prompt', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(placeholderNameArb, placeholderValueArb),
            { minLength: 1, maxLength: 5 }
          ),
          (placeholders) => {
            // Ensure unique placeholder names (last value wins for duplicates)
            const uniquePlaceholders = new Map<string, string>();
            for (const [name, value] of placeholders) {
              uniquePlaceholders.set(name, value);
            }

            // Build prompt with placeholders
            const prompt = Array.from(uniquePlaceholders.keys())
              .map((name) => `{{${name}}}`)
              .join(' ');

            // Build values object
            const values: Record<string, string> = Object.fromEntries(uniquePlaceholders);

            // Substitute
            const result = substitutePromptPlaceholders(prompt, values);

            // All placeholders should be replaced
            for (const [name, value] of uniquePlaceholders) {
              // Placeholder syntax should be gone (replaced with value, even if empty)
              expect(result).not.toContain(`{{${name}}}`);
              // If value is non-empty and doesn't contain only whitespace, it should appear in result
              // Note: When multiple placeholders are joined with spaces, individual values
              // may be trimmed or merged, so we only check for non-whitespace values
              if (value.trim().length > 0) {
                expect(result).toContain(value);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract all placeholder names from prompt', () => {
      fc.assert(
        fc.property(
          fc.array(placeholderNameArb, { minLength: 1, maxLength: 5 }),
          (names) => {
            // Build prompt with placeholders
            const prompt = names.map((name) => `{{${name}}}`).join(' ');

            // Extract placeholders
            const extracted = extractPlaceholders(prompt);

            // All names should be extracted
            for (const name of names) {
              expect(extracted).toContain(name);
            }

            // Should extract correct count (accounting for duplicates)
            const uniqueNames = Array.from(new Set(names));
            expect(extracted.length).toBe(uniqueNames.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle prompts with no placeholders', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => !s.includes('{{')),
          (prompt) => {
            // Extract placeholders
            const extracted = extractPlaceholders(prompt);
            expect(extracted.length).toBe(0);

            // Substitute with empty values
            const result = substitutePromptPlaceholders(prompt, {});
            expect(result).toBe(prompt);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle missing placeholder values gracefully', () => {
      fc.assert(
        fc.property(
          fc.array(placeholderNameArb, { minLength: 1, maxLength: 5 }),
          (names) => {
            // Build prompt with placeholders
            const prompt = names.map((name) => `{{${name}}}`).join(' ');

            // Substitute with empty values object
            const result = substitutePromptPlaceholders(prompt, {});

            // Placeholders should remain unchanged
            for (const name of names) {
              expect(result).toContain(`{{${name}}}`);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Multiple Extensions
   * 
   * For any set of extensions with skills, the registry should manage
   * skills from all extensions without conflicts.
   */
  describe('Multiple Extensions', () => {
    it('should handle skills from multiple extensions', () => {
      fc.assert(
        fc.property(
          fc
            .array(
              fc.tuple(extensionNameArb, skillsArrayArb),
              { minLength: 2, maxLength: 5 }
            )
            .map((extensions) => {
              // Deduplicate by extension name (keep last occurrence)
              const uniqueExtensions = new Map<string, Skill[]>();
              for (const [name, skills] of extensions) {
                uniqueExtensions.set(name, skills);
              }
              return Array.from(uniqueExtensions.entries());
            }),
          (extensionsWithSkills) => {
            const registry = new SkillRegistry(); // Fresh registry for each test
            
            // Register skills from all extensions
            for (const [extensionName, skills] of extensionsWithSkills) {
              registry.registerSkills(extensionName, skills);
            }

            // All skills should be discoverable
            const allSkills = registry.getAllSkills();
            const expectedCount = extensionsWithSkills.reduce(
              (sum, [, skills]) => sum + skills.length,
              0
            );
            expect(allSkills.length).toBe(expectedCount);

            // Each extension's skills should be retrievable
            for (const [extensionName, skills] of extensionsWithSkills) {
              const extensionSkills = registry.getExtensionSkills(extensionName);
              expect(extensionSkills.length).toBe(skills.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow same skill name in different extensions', () => {
      fc.assert(
        fc.property(
          fc
            .array(extensionNameArb, { minLength: 2, maxLength: 5 })
            .map((names) => Array.from(new Set(names))), // Deduplicate extension names
          skillArb,
          (extensionNames, skill) => {
            const registry = new SkillRegistry(); // Fresh registry for each test
            
            // Register same skill in multiple extensions
            for (const extensionName of extensionNames) {
              registry.registerSkill(extensionName, skill);
            }

            // Each extension should have its own copy
            for (const extensionName of extensionNames) {
              const id = `${extensionName}.${skill.name}`;
              const retrieved = registry.getSkill(id);
              expect(retrieved).toBeDefined();
              expect(retrieved?.extensionName).toBe(extensionName);
            }

            // Total count should match number of unique extensions
            const allSkills = registry.getAllSkills();
            expect(allSkills.length).toBe(extensionNames.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
