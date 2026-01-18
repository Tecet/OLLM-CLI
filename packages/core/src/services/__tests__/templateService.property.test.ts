/**
 * Property-based tests for Template Service
 * Feature: stage-07-model-management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { TemplateService, type Template, type VariableDefinition } from '../templateService.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Template Service Properties', () => {
  let tempDir: string;
  let userTemplatesDir: string;
  let workspaceTemplatesDir: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `ollm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    userTemplatesDir = join(tempDir, 'user-templates');
    workspaceTemplatesDir = join(tempDir, 'workspace-templates');
    
    // Clean up if directory already exists (shouldn't happen but be safe)
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore
    }
    
    await fs.mkdir(userTemplatesDir, { recursive: true });
    await fs.mkdir(workspaceTemplatesDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Property 32: Template loading from directories
   * For any valid template file in the user or workspace configuration directory,
   * loadTemplates should parse and make it available
   * Validates: Requirements 16.1, 16.2, 16.3
   */
  it('Property 32: Template loading from directories', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 30 })
              .filter(s => {
                // Filter out invalid filename characters
                const invalidChars = /[<>:"|?*\\/]/;
                return s.trim().length > 0 && !invalidChars.test(s);
              }),
            description: fc.string({ minLength: 1, maxLength: 100 }),
            template: fc.string({ minLength: 1, maxLength: 200 }),
            variables: fc.array(
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 20 })
                  .filter(s => s.trim().length > 0),
                required: fc.boolean(),
                default: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
                description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
              }),
              { maxLength: 5 }
            ),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (templatesRaw) => {
          // Clean directories before each iteration
          try {
            const userFiles = await fs.readdir(userTemplatesDir);
            for (const file of userFiles) {
              await fs.unlink(join(userTemplatesDir, file));
            }
          } catch (_error) {
            // Ignore if directory doesn't exist or is empty
          }
          
          try {
            const workspaceFiles = await fs.readdir(workspaceTemplatesDir);
            for (const file of workspaceFiles) {
              await fs.unlink(join(workspaceTemplatesDir, file));
            }
          } catch (_error) {
            // Ignore if directory doesn't exist or is empty
          }

          // Ensure unique template names (case-insensitive for Windows filesystem)
          const templates = Array.from(
            new Map(templatesRaw.map(t => [t.name.toLowerCase(), t])).values()
          );

          // Write templates to user directory
          for (const template of templates) {
            const filePath = join(userTemplatesDir, `${template.name}.yaml`);
            const content = JSON.stringify({
              name: template.name,
              description: template.description,
              template: template.template,
              variables: template.variables,
            }, null, 2);
            await fs.writeFile(filePath, content, 'utf-8');
          }

          // Load templates
          const service = new TemplateService({
            userTemplatesDir,
            workspaceTemplatesDir,
          });
          await service.loadTemplates();

          // All templates should be available
          for (const template of templates) {
            const loaded = service.getTemplate(template.name);
            expect(loaded).not.toBeNull();
            if (loaded) {
              expect(loaded.name).toBe(template.name);
              expect(loaded.description).toBe(template.description);
              expect(loaded.template).toBe(template.template);
              expect(loaded.variables.length).toBe(template.variables.length);
            }
          }

          // Template count should match
          expect(service.count()).toBe(templates.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 37: Template persistence
   * For any template created via createTemplate, it should be saved to disk
   * and available in subsequent listTemplates calls
   * Validates: Requirements 18.3
   */
  it('Property 37: Template persistence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => {
              // Filter out invalid filename characters
              const invalidChars = /[<>:"|?*\\/]/;
              return s.trim().length > 0 && !invalidChars.test(s);
            }),
          description: fc.string({ minLength: 1, maxLength: 100 }),
          template: fc.string({ minLength: 1, maxLength: 200 }),
          variables: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 })
                .filter(s => s.trim().length > 0),
              required: fc.boolean(),
              default: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
              description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            }),
            { maxLength: 5 }
          ),
        }),
        async (template) => {
          // Create service
          const service1 = new TemplateService({
            userTemplatesDir,
            workspaceTemplatesDir,
          });
          await service1.loadTemplates();

          // Create template
          await service1.createTemplate(template);

          // Verify it's in the list
          const listed = service1.listTemplates();
          const found = listed.find(t => t.name === template.name);
          expect(found).toBeDefined();

          // Create new service instance and load
          const service2 = new TemplateService({
            userTemplatesDir,
            workspaceTemplatesDir,
          });
          await service2.loadTemplates();

          // Template should be available after reload
          const loaded = service2.getTemplate(template.name);
          expect(loaded).not.toBeNull();
          if (loaded) {
            expect(loaded.name).toBe(template.name);
            expect(loaded.description).toBe(template.description);
            expect(loaded.template).toBe(template.template);
            expect(loaded.variables.length).toBe(template.variables.length);
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 30000); // 30 second timeout for property test with file I/O

  /**
   * Property 33: Template metadata preservation
   * For any loaded template, it should include name, description, and variable definitions
   * Validates: Requirements 16.4
   */
  it('Property 33: Template metadata preservation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => {
              // Filter out invalid filename characters
              const invalidChars = /[<>:"|?*\\/]/;
              return s.trim().length > 0 && !invalidChars.test(s);
            }),
          description: fc.string({ minLength: 1, maxLength: 100 }),
          template: fc.string({ minLength: 1, maxLength: 200 }),
          variables: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 })
                .filter(s => s.trim().length > 0),
              required: fc.boolean(),
              default: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
              description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            }),
            { maxLength: 5 }
          ),
        }),
        async (template) => {
          // Write template to file
          const filePath = join(userTemplatesDir, `${template.name}.yaml`);
          const content = JSON.stringify({
            name: template.name,
            description: template.description,
            template: template.template,
            variables: template.variables,
          }, null, 2);
          await fs.writeFile(filePath, content, 'utf-8');

          // Load templates
          const service = new TemplateService({
            userTemplatesDir,
            workspaceTemplatesDir,
          });
          await service.loadTemplates();

          // Get template
          const loaded = service.getTemplate(template.name);
          expect(loaded).not.toBeNull();

          if (loaded) {
            // Verify all metadata is preserved
            expect(loaded.name).toBe(template.name);
            expect(loaded.description).toBe(template.description);
            expect(loaded.template).toBe(template.template);
            expect(loaded.variables.length).toBe(template.variables.length);

            // Verify each variable definition
            for (let i = 0; i < template.variables.length; i++) {
              const original = template.variables[i];
              const loadedVar = loaded.variables[i];

              expect(loadedVar.name).toBe(original.name);
              expect(loadedVar.required).toBe(original.required);
              expect(loadedVar.default).toBe(original.default);
              expect(loadedVar.description).toBe(original.description);
            }
          }

          // Verify listTemplates includes metadata
          const listed = service.listTemplates();
          const listedTemplate = listed.find(t => t.name === template.name);
          expect(listedTemplate).toBeDefined();
          if (listedTemplate) {
            expect(listedTemplate.name).toBe(template.name);
            expect(listedTemplate.description).toBe(template.description);
            expect(listedTemplate.variableCount).toBe(template.variables.length);
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 30000); // 30 second timeout for property test with file I/O

  /**
   * Property 34: Variable substitution
   * For any template with variables and provided values, applyTemplate should
   * replace all variable placeholders with the provided values
   * Validates: Requirements 17.1
   */
  it('Property 34: Variable substitution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          templateName: fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => {
              // Filter out invalid filename characters
              const invalidChars = /[<>:"|?*\\/]/;
              return s.trim().length > 0 && !invalidChars.test(s);
            }),
          variables: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 })
                .filter(s => {
                  // Filter out characters that would conflict with template syntax
                  const invalidChars = /[{}:]/;
                  // Filter out special JavaScript properties
                  const specialProps = ['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString', 'valueOf'];
                  return s.trim().length > 0 && !invalidChars.test(s) && !specialProps.includes(s.trim());
                })
                .map(s => s.trim()), // Trim whitespace from variable names
              value: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ templateName, variables }) => {
          // Ensure test setup is complete
          if (!userTemplatesDir || !workspaceTemplatesDir) {
            throw new Error('Test setup incomplete: directories not initialized');
          }
          // Ensure unique variable names
          const uniqueVars = Array.from(
            new Map(variables.map(v => [v.name, v])).values()
          );

          // Build template string with variables
          const templateStr = uniqueVars.map(v => `{${v.name}}`).join(' ');

          // Create template
          const template: Template = {
            name: templateName,
            description: 'Test template',
            template: templateStr,
            variables: uniqueVars.map(v => ({
              name: v.name,
              required: false,
              default: undefined,
            })),
          };

          // Write template to file
          const filePath = join(userTemplatesDir, `${templateName}.yaml`);
          const content = JSON.stringify(template, null, 2);
          await fs.writeFile(filePath, content, 'utf-8');

          // Load templates
          const service = new TemplateService({
            userTemplatesDir,
            workspaceTemplatesDir,
          });
          await service.loadTemplates();

          // Apply template with variables
          const variableMap: Record<string, string> = {};
          for (const v of uniqueVars) {
            variableMap[v.name] = v.value;
          }

          const result = service.applyTemplate(templateName, variableMap);

          // All variable placeholders should be replaced
          for (const v of uniqueVars) {
            expect(result).toContain(v.value);
            expect(result).not.toContain(`{${v.name}}`);
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 30000); // 30 second timeout for property test with file I/O

  /**
   * Property 35: Default value usage
   * For any template variable with a default value, when no value is provided,
   * applyTemplate should use the default
   * Validates: Requirements 17.2
   */
  it('Property 35: Default value usage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          templateName: fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => {
              // Filter out invalid filename characters
              const invalidChars = /[<>:"|?*\\/]/;
              return s.trim().length > 0 && !invalidChars.test(s);
            }),
          varName: fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => {
              // Filter out characters that would conflict with template syntax
              const invalidChars = /[{}:]/;
              return s.trim().length > 0 && !invalidChars.test(s);
            })
            .map(s => s.trim()), // Trim whitespace from variable names
          defaultValue: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async ({ templateName, varName, defaultValue }) => {
          // Ensure test setup is complete
          if (!userTemplatesDir || !workspaceTemplatesDir) {
            throw new Error('Test setup incomplete: directories not initialized');
          }
          // Create template with default value
          const template: Template = {
            name: templateName,
            description: 'Test template',
            template: `Value: {${varName}}`,
            variables: [
              {
                name: varName,
                required: false,
                default: defaultValue,
              },
            ],
          };

          // Write template to file
          const filePath = join(userTemplatesDir, `${templateName}.yaml`);
          const content = JSON.stringify(template, null, 2);
          await fs.writeFile(filePath, content, 'utf-8');

          // Load templates
          const service = new TemplateService({
            userTemplatesDir,
            workspaceTemplatesDir,
          });
          await service.loadTemplates();

          // Apply template without providing variable value
          const result = service.applyTemplate(templateName, {});

          // Should use default value
          expect(result).toContain(defaultValue);
          expect(result).not.toContain(`{${varName}}`);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 36: Required variable validation
   * For any template with required variables, applyTemplate should fail or prompt
   * when required variables are missing
   * Validates: Requirements 17.3
   */
  it('Property 36: Required variable validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          templateName: fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => {
              // Filter out invalid filename characters
              const invalidChars = /[<>:"|?*\\/]/;
              return s.trim().length > 0 && !invalidChars.test(s);
            }),
          requiredVarName: fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => {
              // Filter out characters that would conflict with template syntax
              const invalidChars = /[{}:]/;
              return s.trim().length > 0 && !invalidChars.test(s);
            })
            .map(s => s.trim()), // Trim whitespace from variable names
        }),
        async ({ templateName, requiredVarName }) => {
          // Ensure test setup is complete
          if (!userTemplatesDir || !workspaceTemplatesDir) {
            throw new Error('Test setup incomplete: directories not initialized');
          }
          // Create template with required variable (no default)
          const template: Template = {
            name: templateName,
            description: 'Test template',
            template: `Value: {${requiredVarName}}`,
            variables: [
              {
                name: requiredVarName,
                required: true,
                default: undefined,
              },
            ],
          };

          // Write template to file
          const filePath = join(userTemplatesDir, `${templateName}.yaml`);
          const content = JSON.stringify(template, null, 2);
          await fs.writeFile(filePath, content, 'utf-8');

          // Load templates
          const service = new TemplateService({
            userTemplatesDir,
            workspaceTemplatesDir,
          });
          await service.loadTemplates();

          // Apply template without providing required variable should throw
          expect(() => {
            service.applyTemplate(templateName, {});
          }).toThrow();

          // Apply template with required variable should succeed
          const result = service.applyTemplate(templateName, {
            [requiredVarName]: 'test-value',
          });
          expect(result).toContain('test-value');
        }
      ),
      { numRuns: 50 }
    );
  }, 30000); // 30 second timeout for property test with file I/O
});