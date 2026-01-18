/**
 * Unit tests for Project Profile Service
 * Feature: stage-07-model-management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectProfileService } from '../projectProfileService.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ProjectProfileService', () => {
  let tempDir: string;
  let service: ProjectProfileService;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `ollm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    service = new ProjectProfileService();
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore
    }
  });

  describe('Built-in Profiles', () => {
    /**
     * Test that TypeScript, Python, Rust, Go, and documentation profiles exist
     * Requirements: 23.1, 23.2, 23.3, 23.4, 23.5
     */
    it('should have TypeScript profile', () => {
      const profiles = service.listBuiltInProfiles();
      const typescript = profiles.find((p) => p.name === 'typescript');

      expect(typescript).toBeDefined();
      expect(typescript?.description).toContain('TypeScript');
      expect(typescript?.defaultSettings.routing?.defaultProfile).toBe('code');
      expect(typescript?.defaultSettings.systemPrompt).toContain('TypeScript');
    });

    it('should have Python profile', () => {
      const profiles = service.listBuiltInProfiles();
      const python = profiles.find((p) => p.name === 'python');

      expect(python).toBeDefined();
      expect(python?.description).toContain('Python');
      expect(python?.defaultSettings.routing?.defaultProfile).toBe('code');
      expect(python?.defaultSettings.systemPrompt).toContain('Python');
    });

    it('should have Rust profile', () => {
      const profiles = service.listBuiltInProfiles();
      const rust = profiles.find((p) => p.name === 'rust');

      expect(rust).toBeDefined();
      expect(rust?.description).toContain('Rust');
      expect(rust?.defaultSettings.routing?.defaultProfile).toBe('code');
      expect(rust?.defaultSettings.systemPrompt).toContain('Rust');
    });

    it('should have Go profile', () => {
      const profiles = service.listBuiltInProfiles();
      const go = profiles.find((p) => p.name === 'go');

      expect(go).toBeDefined();
      expect(go?.description).toContain('Go');
      expect(go?.defaultSettings.routing?.defaultProfile).toBe('code');
      expect(go?.defaultSettings.systemPrompt).toContain('Go');
    });

    it('should have documentation profile', () => {
      const profiles = service.listBuiltInProfiles();
      const documentation = profiles.find((p) => p.name === 'documentation');

      expect(documentation).toBeDefined();
      expect(documentation?.description).toContain('Documentation');
      expect(documentation?.defaultSettings.routing?.defaultProfile).toBe('creative');
      expect(documentation?.defaultSettings.systemPrompt).toContain('documentation');
    });

    it('should have all 5 built-in profiles', () => {
      const profiles = service.listBuiltInProfiles();
      expect(profiles.length).toBe(5);

      const names = profiles.map((p) => p.name);
      expect(names).toContain('typescript');
      expect(names).toContain('python');
      expect(names).toContain('rust');
      expect(names).toContain('go');
      expect(names).toContain('documentation');
    });

    it('should have valid metadata for all profiles', () => {
      const profiles = service.listBuiltInProfiles();

      for (const profile of profiles) {
        // Check required fields
        expect(profile.name).toBeTruthy();
        expect(profile.description).toBeTruthy();
        expect(profile.detectionFiles).toBeDefined();
        expect(profile.detectionFiles.length).toBeGreaterThan(0);
        expect(profile.defaultSettings).toBeDefined();
        expect(profile.defaultSettings.name).toBe(profile.name);

        // Check default settings structure
        expect(profile.defaultSettings.routing).toBeDefined();
        expect(profile.defaultSettings.routing?.defaultProfile).toBeTruthy();
        expect(profile.defaultSettings.systemPrompt).toBeTruthy();
      }
    });

    it('should have code routing profile for code-related profiles', () => {
      const profiles = service.listBuiltInProfiles();
      const codeProfiles = ['typescript', 'python', 'rust', 'go'];

      for (const name of codeProfiles) {
        const profile = profiles.find((p) => p.name === name);
        expect(profile?.defaultSettings.routing?.defaultProfile).toBe('code');
      }
    });

    it('should have creative routing profile for documentation', () => {
      const profiles = service.listBuiltInProfiles();
      const documentation = profiles.find((p) => p.name === 'documentation');

      expect(documentation?.defaultSettings.routing?.defaultProfile).toBe('creative');
    });

    it('should have appropriate tools enabled for each profile', () => {
      const profiles = service.listBuiltInProfiles();

      for (const profile of profiles) {
        expect(profile.defaultSettings.tools).toBeDefined();
        expect(profile.defaultSettings.tools?.enabled).toBeDefined();
        expect(Array.isArray(profile.defaultSettings.tools?.enabled)).toBe(true);
        expect(profile.defaultSettings.tools?.enabled?.length).toBeGreaterThan(0);

        // All profiles should have basic file tools
        const enabled = profile.defaultSettings.tools?.enabled || [];
        expect(enabled).toContain('read-file');
        expect(enabled).toContain('write-file');
        expect(enabled).toContain('edit-file');
      }
    });
  });

  describe('Profile Detection', () => {
    it('should detect TypeScript project from package.json with typescript dependency', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          typescript: '^5.0.0',
        },
      };

      await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson), 'utf-8');

      const profile = await service.detectProfile(tempDir);
      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('typescript');
    });

    it('should detect Python project from requirements.txt', async () => {
      await fs.writeFile(join(tempDir, 'requirements.txt'), 'flask==2.0.0\nrequests==2.28.0', 'utf-8');

      const profile = await service.detectProfile(tempDir);
      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('python');
    });

    it('should detect Python project from pyproject.toml', async () => {
      await fs.writeFile(
        join(tempDir, 'pyproject.toml'),
        '[tool.poetry]\nname = "test-project"\nversion = "0.1.0"',
        'utf-8'
      );

      const profile = await service.detectProfile(tempDir);
      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('python');
    });

    it('should detect Rust project from Cargo.toml', async () => {
      await fs.writeFile(
        join(tempDir, 'Cargo.toml'),
        '[package]\nname = "test-project"\nversion = "0.1.0"',
        'utf-8'
      );

      const profile = await service.detectProfile(tempDir);
      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('rust');
    });

    it('should detect Go project from go.mod', async () => {
      await fs.writeFile(
        join(tempDir, 'go.mod'),
        'module github.com/test/project\n\ngo 1.21',
        'utf-8'
      );

      const profile = await service.detectProfile(tempDir);
      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('go');
    });

    it('should return null when no characteristic files are found', async () => {
      const profile = await service.detectProfile(tempDir);
      expect(profile).toBeNull();
    });

    it('should respect manual profile override', async () => {
      // Create a TypeScript project
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          typescript: '^5.0.0',
        },
      };
      await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson), 'utf-8');

      // Create service with manual override
      const serviceWithOverride = new ProjectProfileService({
        manualProfile: 'python',
      });

      const profile = await serviceWithOverride.detectProfile(tempDir);
      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('python');
    });

    it('should return null when auto-detect is disabled', async () => {
      // Create a TypeScript project
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          typescript: '^5.0.0',
        },
      };
      await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson), 'utf-8');

      // Create service with auto-detect disabled
      const serviceWithoutAutoDetect = new ProjectProfileService({
        autoDetect: false,
      });

      const profile = await serviceWithoutAutoDetect.detectProfile(tempDir);
      expect(profile).toBeNull();
    });
  });

  describe('Profile Loading', () => {
    it('should load profile from .ollm/project.yaml', async () => {
      const ollmDir = join(tempDir, '.ollm');
      await fs.mkdir(ollmDir, { recursive: true });

      const profileConfig = {
        name: 'custom',
        model: 'llama3.1:8b',
        systemPrompt: 'Custom system prompt',
        routing: {
          defaultProfile: 'code',
        },
      };

      await fs.writeFile(
        join(ollmDir, 'project.yaml'),
        JSON.stringify(profileConfig),
        'utf-8'
      );

      const profile = await service.loadProfile(tempDir);
      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('custom');
      expect(profile?.model).toBe('llama3.1:8b');
      expect(profile?.systemPrompt).toBe('Custom system prompt');
      expect(profile?.routing?.defaultProfile).toBe('code');
    });

    it('should fall back to auto-detection when config file does not exist', async () => {
      // Create a TypeScript project
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          typescript: '^5.0.0',
        },
      };
      await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson), 'utf-8');

      const profile = await service.loadProfile(tempDir);
      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('typescript');
    });
  });

  describe('Profile Application', () => {
    it('should merge project and global settings with project taking precedence', () => {
      const globalSettings = {
        name: 'global',
        model: 'global-model',
        systemPrompt: 'Global prompt',
        routing: {
          defaultProfile: 'general' as const,
        },
      };

      const projectSettings = {
        name: 'project',
        model: 'project-model',
        systemPrompt: 'Project prompt',
        routing: {
          defaultProfile: 'code' as const,
        },
      };

      const merged = service.applyProfile(projectSettings, globalSettings);

      expect(merged.model).toBe('project-model');
      expect(merged.systemPrompt).toBe('Project prompt');
      expect(merged.routing?.defaultProfile).toBe('code');
    });

    it('should use global settings when project settings are undefined', () => {
      const globalSettings = {
        name: 'global',
        model: 'global-model',
        systemPrompt: 'Global prompt',
      };

      const projectSettings = {
        name: 'project',
      };

      const merged = service.applyProfile(projectSettings, globalSettings);

      expect(merged.model).toBe('global-model');
      expect(merged.systemPrompt).toBe('Global prompt');
    });

    it('should merge options objects', () => {
      const globalSettings = {
        name: 'global',
        options: {
          temperature: 0.7,
          maxTokens: 4096,
        },
      };

      const projectSettings = {
        name: 'project',
        options: {
          temperature: 0.9,
        },
      };

      const merged = service.applyProfile(projectSettings, globalSettings);

      expect(merged.options?.temperature).toBe(0.9);
      expect(merged.options?.maxTokens).toBe(4096);
    });
  });

  describe('Project Initialization', () => {
    it('should create .ollm/project.yaml with profile settings', async () => {
      await service.initializeProject(tempDir, 'typescript');

      const configPath = join(tempDir, '.ollm', 'project.yaml');
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.name).toBe('typescript');
      expect(config.routing?.defaultProfile).toBe('code');
      expect(config.systemPrompt).toContain('TypeScript');
    });

    it('should throw error for unknown profile', async () => {
      await expect(service.initializeProject(tempDir, 'unknown-profile')).rejects.toThrow(
        "Profile 'unknown-profile' not found"
      );
    });

    it('should set current profile after initialization', async () => {
      await service.initializeProject(tempDir, 'python');

      const currentProfile = service.getCurrentProfile();
      expect(currentProfile).not.toBeNull();
      expect(currentProfile?.name).toBe('python');
    });
  });

  describe('Manual Profile Management', () => {
    it('should set and get manual profile', () => {
      service.setManualProfile('rust');
      expect(service.getManualProfile()).toBe('rust');
    });

    it('should clear manual profile', () => {
      service.setManualProfile('rust');
      service.setManualProfile(null);
      expect(service.getManualProfile()).toBeNull();
    });
  });

  describe('Service Configuration', () => {
    it('should return null when service is disabled', async () => {
      const disabledService = new ProjectProfileService({ enabled: false });

      const profile = await disabledService.detectProfile(tempDir);
      expect(profile).toBeNull();
    });

    it('should throw error when initializing with disabled service', async () => {
      const disabledService = new ProjectProfileService({ enabled: false });

      await expect(disabledService.initializeProject(tempDir, 'typescript')).rejects.toThrow(
        'Project profile service is disabled'
      );
    });
  });
});
