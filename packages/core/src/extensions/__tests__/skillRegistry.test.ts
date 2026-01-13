/**
 * Unit tests for skill registry
 * 
 * Tests skill registration, discovery, placeholder substitution, and invocation.
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry, substitutePromptPlaceholders, extractPlaceholders } from '../skillRegistry.js';
import type { Skill } from '../types.js';

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  describe('Skill Registration', () => {
    it('should register a single skill', () => {
      const skill: Skill = {
        name: 'create-pr',
        description: 'Create a pull request',
        prompt: 'Create a pull request with the following changes...',
      };

      registry.registerSkill('github-ext', skill);

      const retrieved = registry.getSkill('github-ext.create-pr');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('create-pr');
      expect(retrieved?.description).toBe('Create a pull request');
      expect(retrieved?.extensionName).toBe('github-ext');
      expect(retrieved?.id).toBe('github-ext.create-pr');
    });

    it('should register multiple skills from same extension', () => {
      const skills: Skill[] = [
        {
          name: 'create-pr',
          description: 'Create a pull request',
          prompt: 'Create a pull request...',
        },
        {
          name: 'review-pr',
          description: 'Review a pull request',
          prompt: 'Review the pull request...',
        },
      ];

      registry.registerSkills('github-ext', skills);

      const allSkills = registry.getAllSkills();
      expect(allSkills.length).toBe(2);

      const extensionSkills = registry.getExtensionSkills('github-ext');
      expect(extensionSkills.length).toBe(2);
    });

    it('should handle skills from multiple extensions', () => {
      registry.registerSkill('github-ext', {
        name: 'create-pr',
        description: 'Create a pull request',
        prompt: 'Create a pull request...',
      });

      registry.registerSkill('jira-ext', {
        name: 'create-ticket',
        description: 'Create a Jira ticket',
        prompt: 'Create a ticket...',
      });

      const allSkills = registry.getAllSkills();
      expect(allSkills.length).toBe(2);

      const githubSkills = registry.getExtensionSkills('github-ext');
      expect(githubSkills.length).toBe(1);

      const jiraSkills = registry.getExtensionSkills('jira-ext');
      expect(jiraSkills.length).toBe(1);
    });

    it('should allow same skill name in different extensions', () => {
      registry.registerSkill('ext1', {
        name: 'deploy',
        description: 'Deploy to production',
        prompt: 'Deploy...',
      });

      registry.registerSkill('ext2', {
        name: 'deploy',
        description: 'Deploy to staging',
        prompt: 'Deploy...',
      });

      const skill1 = registry.getSkill('ext1.deploy');
      const skill2 = registry.getSkill('ext2.deploy');

      expect(skill1).toBeDefined();
      expect(skill2).toBeDefined();
      expect(skill1?.extensionName).toBe('ext1');
      expect(skill2?.extensionName).toBe('ext2');
    });

    it('should overwrite skill if registered twice with same name', () => {
      registry.registerSkill('ext', {
        name: 'test',
        description: 'First version',
        prompt: 'First prompt',
      });

      registry.registerSkill('ext', {
        name: 'test',
        description: 'Second version',
        prompt: 'Second prompt',
      });

      const skill = registry.getSkill('ext.test');
      expect(skill?.description).toBe('Second version');
      expect(skill?.prompt).toBe('Second prompt');

      // Should only have one skill
      const allSkills = registry.getAllSkills();
      expect(allSkills.length).toBe(1);
    });
  });

  describe('Skill Discovery', () => {
    beforeEach(() => {
      registry.registerSkills('github-ext', [
        {
          name: 'create-pr',
          description: 'Create a pull request',
          prompt: 'Create a pull request...',
        },
        {
          name: 'review-pr',
          description: 'Review a pull request',
          prompt: 'Review the pull request...',
        },
      ]);

      registry.registerSkills('jira-ext', [
        {
          name: 'create-ticket',
          description: 'Create a Jira ticket',
          prompt: 'Create a ticket...',
        },
      ]);
    });

    it('should list all skills', () => {
      const allSkills = registry.getAllSkills();
      expect(allSkills.length).toBe(3);
    });

    it('should get skills by extension', () => {
      const githubSkills = registry.getExtensionSkills('github-ext');
      expect(githubSkills.length).toBe(2);
      expect(githubSkills.every(s => s.extensionName === 'github-ext')).toBe(true);

      const jiraSkills = registry.getExtensionSkills('jira-ext');
      expect(jiraSkills.length).toBe(1);
      expect(jiraSkills[0].extensionName).toBe('jira-ext');
    });

    it('should search skills by name', () => {
      const results = registry.searchSkills('create');
      expect(results.length).toBe(2); // create-pr and create-ticket
      expect(results.some(s => s.name === 'create-pr')).toBe(true);
      expect(results.some(s => s.name === 'create-ticket')).toBe(true);
    });

    it('should search skills by description', () => {
      const results = registry.searchSkills('pull request');
      expect(results.length).toBe(2); // create-pr and review-pr
      expect(results.every(s => s.extensionName === 'github-ext')).toBe(true);
    });

    it('should return empty array for non-existent extension', () => {
      const skills = registry.getExtensionSkills('non-existent');
      expect(skills.length).toBe(0);
    });

    it('should return undefined for non-existent skill', () => {
      const skill = registry.getSkill('non-existent.skill');
      expect(skill).toBeUndefined();
    });
  });

  describe('Skill Unregistration', () => {
    beforeEach(() => {
      registry.registerSkills('ext1', [
        { name: 'skill1', description: 'Skill 1', prompt: 'Prompt 1' },
        { name: 'skill2', description: 'Skill 2', prompt: 'Prompt 2' },
      ]);

      registry.registerSkills('ext2', [
        { name: 'skill3', description: 'Skill 3', prompt: 'Prompt 3' },
      ]);
    });

    it('should unregister all skills from an extension', () => {
      registry.unregisterExtensionSkills('ext1');

      const ext1Skills = registry.getExtensionSkills('ext1');
      expect(ext1Skills.length).toBe(0);

      const skill1 = registry.getSkill('ext1.skill1');
      expect(skill1).toBeUndefined();

      const skill2 = registry.getSkill('ext1.skill2');
      expect(skill2).toBeUndefined();

      // ext2 skills should still be there
      const ext2Skills = registry.getExtensionSkills('ext2');
      expect(ext2Skills.length).toBe(1);
    });

    it('should handle unregistering non-existent extension', () => {
      registry.unregisterExtensionSkills('non-existent');
      // Should not throw error
      const allSkills = registry.getAllSkills();
      expect(allSkills.length).toBe(3); // All skills still there
    });

    it('should clear all skills', () => {
      registry.clear();

      const allSkills = registry.getAllSkills();
      expect(allSkills.length).toBe(0);
    });
  });

  describe('Placeholder Substitution', () => {
    it('should substitute single placeholder', () => {
      const prompt = 'Create a PR for {{branch}}';
      const result = substitutePromptPlaceholders(prompt, { branch: 'feature-123' });
      expect(result).toBe('Create a PR for feature-123');
    });

    it('should substitute multiple placeholders', () => {
      const prompt = 'Deploy {{app}} to {{environment}}';
      const result = substitutePromptPlaceholders(prompt, {
        app: 'my-app',
        environment: 'production',
      });
      expect(result).toBe('Deploy my-app to production');
    });

    it('should substitute same placeholder multiple times', () => {
      const prompt = '{{name}} is {{name}}';
      const result = substitutePromptPlaceholders(prompt, { name: 'test' });
      expect(result).toBe('test is test');
    });

    it('should leave unmatched placeholders unchanged', () => {
      const prompt = 'Hello {{name}}, welcome to {{place}}';
      const result = substitutePromptPlaceholders(prompt, { name: 'Alice' });
      expect(result).toBe('Hello Alice, welcome to {{place}}');
    });

    it('should handle empty values', () => {
      const prompt = 'Value: {{value}}';
      const result = substitutePromptPlaceholders(prompt, { value: '' });
      expect(result).toBe('Value: ');
    });

    it('should handle prompts with no placeholders', () => {
      const prompt = 'This is a plain prompt';
      const result = substitutePromptPlaceholders(prompt, {});
      expect(result).toBe('This is a plain prompt');
    });

    it('should handle empty prompt', () => {
      const result = substitutePromptPlaceholders('', { key: 'value' });
      expect(result).toBe('');
    });
  });

  describe('Placeholder Extraction', () => {
    it('should extract single placeholder', () => {
      const prompt = 'Create a PR for {{branch}}';
      const placeholders = extractPlaceholders(prompt);
      expect(placeholders).toEqual(['branch']);
    });

    it('should extract multiple placeholders', () => {
      const prompt = 'Deploy {{app}} to {{environment}}';
      const placeholders = extractPlaceholders(prompt);
      expect(placeholders).toEqual(['app', 'environment']);
    });

    it('should extract duplicate placeholders only once', () => {
      const prompt = '{{name}} is {{name}}';
      const placeholders = extractPlaceholders(prompt);
      expect(placeholders).toEqual(['name']);
    });

    it('should handle prompts with no placeholders', () => {
      const prompt = 'This is a plain prompt';
      const placeholders = extractPlaceholders(prompt);
      expect(placeholders).toEqual([]);
    });

    it('should handle empty prompt', () => {
      const placeholders = extractPlaceholders('');
      expect(placeholders).toEqual([]);
    });

    it('should handle placeholders with underscores and numbers', () => {
      const prompt = '{{user_name}} {{item_1}} {{value2}}';
      const placeholders = extractPlaceholders(prompt);
      expect(placeholders).toEqual(['user_name', 'item_1', 'value2']);
    });

    it('should not extract malformed placeholders', () => {
      const prompt = '{single} {{valid}} {{{triple}}}';
      const placeholders = extractPlaceholders(prompt);
      expect(placeholders).toEqual(['valid']);
    });
  });

  describe('Skill Invocation', () => {
    it('should provide complete skill information for invocation', () => {
      const skill: Skill = {
        name: 'create-pr',
        description: 'Create a pull request with title and description',
        prompt: 'Create a pull request with title "{{title}}" and description "{{description}}"',
      };

      registry.registerSkill('github-ext', skill);

      const retrieved = registry.getSkill('github-ext.create-pr');
      expect(retrieved).toBeDefined();

      // Extract placeholders
      const placeholders = extractPlaceholders(retrieved!.prompt);
      expect(placeholders).toEqual(['title', 'description']);

      // Substitute values
      const rendered = substitutePromptPlaceholders(retrieved!.prompt, {
        title: 'Fix bug',
        description: 'This fixes the critical bug',
      });

      expect(rendered).toBe(
        'Create a pull request with title "Fix bug" and description "This fixes the critical bug"'
      );
    });
  });
});
