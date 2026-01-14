/**
 * Property-based tests for Project Profile Service
 * Feature: stage-07-model-management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ProjectProfileService, type ProjectProfile } from '../projectProfileService.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Project Profile Service Properties', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `ollm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
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
   * Property 43: Project type detection
   * For any workspace containing characteristic files (package.json with TypeScript,
   * requirements.txt, Cargo.toml, go.mod), detectProfile should identify the correct project type
   * Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5
   */
  it('Property 43: Project type detection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          {
            name: 'typescript',
            files: [
              {
                path: 'package.json',
                content: JSON.stringify({
                  name: 'test-project',
                  devDependencies: { typescript: '^5.0.0' },
                }),
              },
            ],
          },
          {
            name: 'python',
            files: [{ path: 'requirements.txt', content: 'flask==2.0.0\nrequests==2.28.0' }],
          },
          {
            name: 'python',
            files: [
              {
                path: 'pyproject.toml',
                content: '[tool.poetry]\nname = "test-project"\nversion = "0.1.0"',
              },
            ],
          },
          {
            name: 'python',
            files: [
              {
                path: 'setup.py',
                content: 'from setuptools import setup\nsetup(name="test-project")',
              },
            ],
          },
          {
            name: 'rust',
            files: [
              {
                path: 'Cargo.toml',
                content: '[package]\nname = "test-project"\nversion = "0.1.0"',
              },
            ],
          },
          {
            name: 'go',
            files: [
              {
                path: 'go.mod',
                content: 'module github.com/test/project\n\ngo 1.21',
              },
            ],
          }
        ),
        async (projectType) => {
          // Create a fresh temp directory for this iteration
          const iterationTempDir = join(
            tmpdir(),
            `ollm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
          );
          await fs.mkdir(iterationTempDir, { recursive: true });

          try {
            // Create the characteristic files
            for (const file of projectType.files) {
              const filePath = join(iterationTempDir, file.path);
              await fs.writeFile(filePath, file.content, 'utf-8');
            }

            // Detect profile
            const service = new ProjectProfileService();
            const profile = await service.detectProfile(iterationTempDir);

            // Should detect the correct profile
            expect(profile).not.toBeNull();
            if (profile) {
              expect(profile.name).toBe(projectType.name);
            }
          } finally {
            // Clean up iteration temp directory
            try {
              await fs.rm(iterationTempDir, { recursive: true, force: true });
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 44: Project settings precedence
   * For any setting that exists in both global and project configuration,
   * the system should use the project setting
   * Validates: Requirements 22.1, 22.2
   */
  it('Property 44: Project settings precedence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          globalModel: fc.string({ minLength: 1, maxLength: 50 }),
          projectModel: fc.string({ minLength: 1, maxLength: 50 }),
          globalSystemPrompt: fc.string({ minLength: 10, maxLength: 100 }),
          projectSystemPrompt: fc.string({ minLength: 10, maxLength: 100 }),
        }),
        async ({ globalModel, projectModel, globalSystemPrompt, projectSystemPrompt }) => {
          const service = new ProjectProfileService();

          const globalSettings: Partial<ProjectProfile> = {
            name: 'global',
            model: globalModel,
            systemPrompt: globalSystemPrompt,
          };

          const projectSettings: ProjectProfile = {
            name: 'project',
            model: projectModel,
            systemPrompt: projectSystemPrompt,
          };

          // Apply profile with both settings
          const merged = service.applyProfile(projectSettings, globalSettings);

          // Project settings should take precedence
          expect(merged.model).toBe(projectModel);
          expect(merged.systemPrompt).toBe(projectSystemPrompt);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 45: Profile setting application
   * For any project profile with specified model, system prompt, or tool restrictions,
   * those settings should be applied when the profile is loaded
   * Validates: Requirements 22.3, 22.4, 22.5
   */
  it('Property 45: Profile setting application', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          model: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          systemPrompt: fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: undefined }),
          enabledTools: fc.option(
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
            { nil: undefined }
          ),
          disabledTools: fc.option(
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
            { nil: undefined }
          ),
          defaultProfile: fc.option(
            fc.constantFrom('fast', 'general', 'code', 'creative'),
            { nil: undefined }
          ),
        }),
        async ({ model, systemPrompt, enabledTools, disabledTools, defaultProfile }) => {
          const service = new ProjectProfileService();

          const profile: ProjectProfile = {
            name: 'test-profile',
            model,
            systemPrompt,
            tools: {
              enabled: enabledTools,
              disabled: disabledTools,
            },
            routing: {
              defaultProfile,
            },
          };

          // Apply profile
          const applied = service.applyProfile(profile);

          // All specified settings should be present
          if (model !== undefined) {
            expect(applied.model).toBe(model);
          }
          if (systemPrompt !== undefined) {
            expect(applied.systemPrompt).toBe(systemPrompt);
          }
          if (enabledTools !== undefined) {
            expect(applied.tools?.enabled).toEqual(enabledTools);
          }
          if (disabledTools !== undefined) {
            expect(applied.tools?.disabled).toEqual(disabledTools);
          }
          if (defaultProfile !== undefined) {
            expect(applied.routing?.defaultProfile).toBe(defaultProfile);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 46: Manual profile override
   * For any manually selected profile, it should take precedence over auto-detected profile
   * Validates: Requirements 24.4
   */
  it('Property 46: Manual profile override', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('typescript', 'python', 'rust', 'go', 'documentation'),
        async (manualProfile) => {
          // Create a TypeScript project (should auto-detect as typescript)
          const packageJson = {
            name: 'test-project',
            devDependencies: { typescript: '^5.0.0' },
          };
          await fs.writeFile(
            join(tempDir, 'package.json'),
            JSON.stringify(packageJson),
            'utf-8'
          );

          // Create service with manual override
          const service = new ProjectProfileService({
            manualProfile,
          });

          // Detect profile
          const profile = await service.detectProfile(tempDir);

          // Should use manual profile, not auto-detected
          expect(profile).not.toBeNull();
          if (profile) {
            expect(profile.name).toBe(manualProfile);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 47: Project initialization
   * For any project initialization with a selected profile, a workspace configuration file
   * should be created with the profile settings
   * Validates: Requirements 24.3
   */
  it('Property 47: Project initialization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('typescript', 'python', 'rust', 'go', 'documentation'),
        async (profileName) => {
          const service = new ProjectProfileService();

          // Initialize project
          await service.initializeProject(tempDir, profileName);

          // Configuration file should exist
          const configPath = join(tempDir, '.ollm', 'project.yaml');
          const exists = await fs
            .access(configPath)
            .then(() => true)
            .catch(() => false);
          expect(exists).toBe(true);

          // Load and verify profile
          const content = await fs.readFile(configPath, 'utf-8');
          const config = JSON.parse(content);

          expect(config.name).toBe(profileName);

          // Should have expected settings based on profile
          const builtInProfiles = service.listBuiltInProfiles();
          const builtIn = builtInProfiles.find((p) => p.name === profileName);
          expect(builtIn).toBeDefined();

          if (builtIn) {
            // Verify key settings are present
            if (builtIn.defaultSettings.routing?.defaultProfile) {
              expect(config.routing?.defaultProfile).toBe(
                builtIn.defaultSettings.routing.defaultProfile
              );
            }
            if (builtIn.defaultSettings.systemPrompt) {
              expect(config.systemPrompt).toBe(builtIn.defaultSettings.systemPrompt);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
