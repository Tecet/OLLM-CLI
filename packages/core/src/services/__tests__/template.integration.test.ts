/**
 * Integration Tests for Template Service
 * 
 * Tests template loading from multiple directories and variable substitution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TemplateService } from '../templateService.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Template Service Integration', () => {
  let tempDir: string;
  let userTemplatesDir: string;
  let workspaceTemplatesDir: string;
  
  beforeEach(async () => {
    // Create temp directories for test
    tempDir = join(tmpdir(), `template-test-${Date.now()}`);
    userTemplatesDir = join(tempDir, 'user');
    workspaceTemplatesDir = join(tempDir, 'workspace');
    
    await fs.mkdir(userTemplatesDir, { recursive: true });
    await fs.mkdir(workspaceTemplatesDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Cleanup
          try {
            await fs.rm(tempDir, { recursive: true, force: true });
          } catch (_error) {
            // Ignore cleanup errors
          }  });
  
  describe('Template Loading from Multiple Directories', () => {
    it('should load templates from user directory', async () => {
      // Create a template in user directory
      await fs.writeFile(
        join(userTemplatesDir, 'user_template.yaml'),
        `name: user_template
description: A user template
template: "Hello {name}!"
variables:
  - name: name
    required: true
`,
        'utf-8'
      );
      
      const service = new TemplateService({ userTemplatesDir });
      await service.loadTemplates();
      
      const templates = service.listTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('user_template');
    });
    
    it('should load templates from workspace directory', async () => {
      // Create templates in both directories
      await fs.writeFile(
        join(userTemplatesDir, 'user_template.yaml'),
        `name: user_template
description: User template
template: "User: {text}"
variables:
  - name: text
    required: true
`,
        'utf-8'
      );
      
      await fs.writeFile(
        join(workspaceTemplatesDir, 'workspace_template.yaml'),
        `name: workspace_template
description: Workspace template
template: "Workspace: {text}"
variables:
  - name: text
    required: true
`,
        'utf-8'
      );
      
      const service = new TemplateService({ userTemplatesDir, workspaceTemplatesDir });
      await service.loadTemplates();
      
      const templates = service.listTemplates();
      expect(templates).toHaveLength(2);
      expect(templates.map(t => t.name)).toContain('user_template');
      expect(templates.map(t => t.name)).toContain('workspace_template');
    });
    
    it('should allow workspace templates to override user templates', async () => {
      // Create same template in both directories
      await fs.writeFile(
        join(userTemplatesDir, 'shared.yaml'),
        `name: shared
description: User version
template: "User: {text}"
variables:
  - name: text
    required: true
`,
        'utf-8'
      );
      
      await fs.writeFile(
        join(workspaceTemplatesDir, 'shared.yaml'),
        `name: shared
description: Workspace version
template: "Workspace: {text}"
variables:
  - name: text
    required: true
`,
        'utf-8'
      );
      
      const service = new TemplateService({ userTemplatesDir, workspaceTemplatesDir });
      await service.loadTemplates();
      
      const template = service.getTemplate('shared');
      expect(template).toBeDefined();
      expect(template?.description).toBe('Workspace version');
      expect(template?.template).toContain('Workspace:');
    });
  });
  
  describe('Template Variable Substitution', () => {
    beforeEach(async () => {
      // Create test templates
      await fs.writeFile(
        join(userTemplatesDir, 'simple.yaml'),
        `name: simple
description: Simple template
template: "Hello {name}!"
variables:
  - name: name
    required: true
`,
        'utf-8'
      );
      
      await fs.writeFile(
        join(userTemplatesDir, 'with_defaults.yaml'),
        `name: with_defaults
description: Template with defaults
template: "Hello {name:World}, you are {age:unknown} years old"
variables:
  - name: name
    required: false
    default: "World"
  - name: age
    required: false
    default: "unknown"
`,
        'utf-8'
      );
      
      await fs.writeFile(
        join(userTemplatesDir, 'complex.yaml'),
        `name: complex
description: Complex template
template: "Review this {language} code for {focus:bugs and security}:\\n\\n{code}"
variables:
  - name: language
    required: true
    description: "Programming language"
  - name: focus
    required: false
    default: "bugs and security"
    description: "Review focus areas"
  - name: code
    required: true
    description: "Code to review"
`,
        'utf-8'
      );
    });
    
    it('should substitute all variables', async () => {
      const service = new TemplateService({ userTemplatesDir });
      await service.loadTemplates();
      
      const result = service.applyTemplate('simple', { name: 'Alice' });
      expect(result).toBe('Hello Alice!');
    });
    
    it('should use default values when variables not provided', async () => {
      const service = new TemplateService({ userTemplatesDir });
      await service.loadTemplates();
      
      const result = service.applyTemplate('with_defaults', {});
      expect(result).toBe('Hello World, you are unknown years old');
    });
    
    it('should override defaults when variables provided', async () => {
      const service = new TemplateService({ userTemplatesDir });
      await service.loadTemplates();
      
      const result = service.applyTemplate('with_defaults', {
        name: 'Bob',
        age: '25',
      });
      expect(result).toBe('Hello Bob, you are 25 years old');
    });
    
    it('should handle complex templates with multiple variables', async () => {
      const service = new TemplateService({ userTemplatesDir });
      await service.loadTemplates();
      
      const result = service.applyTemplate('complex', {
        language: 'TypeScript',
        code: 'function test() { return 42; }',
      });
      
      expect(result).toContain('TypeScript');
      expect(result).toContain('bugs and security');
      expect(result).toContain('function test()');
    });
    
    it('should throw error for missing required variables', async () => {
      const service = new TemplateService({ userTemplatesDir });
      await service.loadTemplates();
      
      expect(() => {
        service.applyTemplate('simple', {});
      }).toThrow();
    });
  });
  
  describe('Template CRUD Operations', () => {
    it('should create new templates', async () => {
      const service = new TemplateService({ userTemplatesDir });
      await service.loadTemplates();
      
      const newTemplate = {
        name: 'new_template',
        description: 'A new template',
        template: 'Test {var}',
        variables: [
          { name: 'var', required: true },
        ],
      };
      
      await service.createTemplate(newTemplate);
      
      // Verify template was created
      const template = service.getTemplate('new_template');
      expect(template).toBeDefined();
      expect(template?.name).toBe('new_template');
      
      // Verify file was written
      const filePath = join(userTemplatesDir, 'new_template.yaml');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });
    
    it('should delete templates', async () => {
      // Create a template
      await fs.writeFile(
        join(userTemplatesDir, 'to_delete.yaml'),
        `name: to_delete
description: Will be deleted
template: "Test"
variables: []
`,
        'utf-8'
      );
      
      const service = new TemplateService({ userTemplatesDir });
      await service.loadTemplates();
      
      // Verify template exists
      expect(service.getTemplate('to_delete')).toBeDefined();
      
      // Delete template
      await service.deleteTemplate('to_delete');
      
      // Verify template was deleted
      expect(service.getTemplate('to_delete')).toBeNull();
      
      // Verify file was deleted
      const filePath = join(userTemplatesDir, 'to_delete.yaml');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });
    
    it('should list all templates with metadata', async () => {
      await fs.writeFile(
        join(userTemplatesDir, 'template1.yaml'),
        `name: template1
description: First template
template: "Test {var1} {var2}"
variables:
  - name: var1
    required: true
  - name: var2
    required: false
`,
        'utf-8'
      );
      
      await fs.writeFile(
        join(userTemplatesDir, 'template2.yaml'),
        `name: template2
description: Second template
template: "Test {var1}"
variables:
  - name: var1
    required: true
`,
        'utf-8'
      );
      
      const service = new TemplateService({ userTemplatesDir });
      await service.loadTemplates();
      
      const templates = service.listTemplates();
      expect(templates).toHaveLength(2);
      
      const template1 = templates.find(t => t.name === 'template1');
      expect(template1).toBeDefined();
      expect(template1?.description).toBe('First template');
      expect(template1?.variableCount).toBe(2);
      
      const template2 = templates.find(t => t.name === 'template2');
      expect(template2).toBeDefined();
      expect(template2?.variableCount).toBe(1);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid YAML files', async () => {
      await fs.writeFile(
        join(userTemplatesDir, 'invalid.yaml'),
        'invalid: yaml: content: {{{',
        'utf-8'
      );
      
      const service = new TemplateService({ userTemplatesDir });
      
      // Should not throw, but skip invalid file
      await service.loadTemplates();
      
      const templates = service.listTemplates();
      expect(templates.map(t => t.name)).not.toContain('invalid');
    });
    
    it('should handle missing template directory', async () => {
      const nonexistentDir = join(tempDir, 'nonexistent');
      const service = new TemplateService({ userTemplatesDir: nonexistentDir });
      
      // Should not throw
      await service.loadTemplates();
      
      const templates = service.listTemplates();
      expect(templates).toHaveLength(0);
    });
    
    it('should handle template not found', async () => {
      const service = new TemplateService({ userTemplatesDir });
      await service.loadTemplates();
      
      const template = service.getTemplate('nonexistent');
      expect(template).toBeNull();
    });
  });
});
