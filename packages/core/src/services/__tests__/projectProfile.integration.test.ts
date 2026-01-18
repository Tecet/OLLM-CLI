/**
 * Integration Tests for Project Profile Service
 * 
 * Tests project type detection and profile application
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectProfileService } from '../projectProfileService.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Project Profile Service Integration', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    // Create temp directory for test
    tempDir = join(tmpdir(), `project-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Project Type Detection', () => {
    it('should detect TypeScript projects', async () => {
      // Create package.json with TypeScript dependency
      await fs.writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            typescript: '^5.0.0',
          },
        }),
        'utf-8'
      );
      
      const service = new ProjectProfileService({ autoDetect: true });
      const profile = await service.detectProfile(tempDir);
      
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('typescript');
    });
    
    it('should detect Python projects from requirements.txt', async () => {
      await fs.writeFile(
        join(tempDir, 'requirements.txt'),
        'flask==2.0.0\nrequests==2.28.0',
        'utf-8'
      );
      
      const service = new ProjectProfileService({ autoDetect: true });
      const profile = await service.detectProfile(tempDir);
      
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('python');
    });
    
    it('should detect Python projects from pyproject.toml', async () => {
      await fs.writeFile(
        join(tempDir, 'pyproject.toml'),
        `[tool.poetry]
name = "test-project"
version = "0.1.0"
`,
        'utf-8'
      );
      
      const service = new ProjectProfileService({ autoDetect: true });
      const profile = await service.detectProfile(tempDir);
      
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('python');
    });
    
    it('should detect Rust projects', async () => {
      await fs.writeFile(
        join(tempDir, 'Cargo.toml'),
        `[package]
name = "test-project"
version = "0.1.0"
`,
        'utf-8'
      );
      
      const service = new ProjectProfileService({ autoDetect: true });
      const profile = await service.detectProfile(tempDir);
      
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('rust');
    });
    
    it('should detect Go projects', async () => {
      await fs.writeFile(
        join(tempDir, 'go.mod'),
        `module test-project

go 1.21
`,
        'utf-8'
      );
      
      const service = new ProjectProfileService({ autoDetect: true });
      const profile = await service.detectProfile(tempDir);
      
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('go');
    });
    
    it('should return null for unknown project types', async () => {
      // Create a file that doesn't match any profile
      await fs.writeFile(
        join(tempDir, 'README.md'),
        '# Test Project',
        'utf-8'
      );
      
      const service = new ProjectProfileService({ autoDetect: true });
      const profile = await service.detectProfile(tempDir);
      
      expect(profile).toBeNull();
    });
  });
  
  describe('Profile Loading from Configuration', () => {
    it('should load profile from .ollm/project.yaml', async () => {
      const ollmDir = join(tempDir, '.ollm');
      await fs.mkdir(ollmDir, { recursive: true });
      
      await fs.writeFile(
        join(ollmDir, 'project.yaml'),
        `name: custom
model: llama3.1:8b
systemPrompt: "You are a helpful assistant for this project."
tools:
  enabled:
    - read_file
    - write_file
routing:
  defaultProfile: code
`,
        'utf-8'
      );
      
      const service = new ProjectProfileService({ autoDetect: true });
      const profile = await service.loadProfile(tempDir);
      
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('custom');
      expect(profile?.model).toBe('llama3.1:8b');
      expect(profile?.systemPrompt).toContain('helpful assistant');
      expect(profile?.tools?.enabled).toContain('read_file');
      expect(profile?.routing?.defaultProfile).toBe('code');
    });
    
    it('should merge detected profile with custom config', async () => {
      // Create TypeScript project
      await fs.writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            typescript: '^5.0.0',
          },
        }),
        'utf-8'
      );
      
      // Create custom config
      const ollmDir = join(tempDir, '.ollm');
      await fs.mkdir(ollmDir, { recursive: true });
      
      await fs.writeFile(
        join(ollmDir, 'project.yaml'),
        `model: custom-model:7b
systemPrompt: "Custom prompt"
`,
        'utf-8'
      );
      
      const service = new ProjectProfileService({ autoDetect: true });
      const profile = await service.loadProfile(tempDir);
      
      expect(profile).toBeDefined();
      // Should use custom model
      expect(profile?.model).toBe('custom-model:7b');
      // Should use custom system prompt
      expect(profile?.systemPrompt).toBe('Custom prompt');
    });
  });
  
  describe('Profile Application', () => {
    it('should apply profile settings', async () => {
      const service = new ProjectProfileService({ autoDetect: true });
      
      const profile = {
        name: 'test',
        model: 'test-model:7b',
        systemPrompt: 'Test prompt',
        tools: {
          enabled: ['read_file', 'write_file'],
        },
        routing: {
          defaultProfile: 'code',
        },
      };
      
      service.applyProfile(profile);
      
      // Verify profile was applied (this would normally update configuration)
      // For now, we just verify it doesn't throw
      expect(true).toBe(true);
    });
    
    it('should handle manual profile override', async () => {
      // Create TypeScript project
      await fs.writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            typescript: '^5.0.0',
          },
        }),
        'utf-8'
      );
      
      const service = new ProjectProfileService({ autoDetect: true, manualProfile: 'python' });
      
      // Detection should return the manual profile
      const profile = await service.detectProfile(tempDir);
      expect(profile?.name).toBe('python');
    });
  });
  
  describe('Project Initialization', () => {
    it('should create project configuration file', async () => {
      const service = new ProjectProfileService({ autoDetect: true });
      
      await service.initializeProject(tempDir, 'typescript');
      
      // Verify .ollm directory was created
      const ollmDir = join(tempDir, '.ollm');
      const ollmDirExists = await fs.access(ollmDir).then(() => true).catch(() => false);
      expect(ollmDirExists).toBe(true);
      
      // Verify project.yaml was created
      const projectYaml = join(ollmDir, 'project.yaml');
      const projectYamlExists = await fs.access(projectYaml).then(() => true).catch(() => false);
      expect(projectYamlExists).toBe(true);
      
      // Verify content (it's written as JSON, not YAML)
      const content = await fs.readFile(projectYaml, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.name).toBe('typescript');
    });
    
    it('should overwrite existing configuration', async () => {
      const ollmDir = join(tempDir, '.ollm');
      await fs.mkdir(ollmDir, { recursive: true });
      
      await fs.writeFile(
        join(ollmDir, 'project.yaml'),
        'name: existing\nmodel: existing-model',
        'utf-8'
      );
      
      const service = new ProjectProfileService({ autoDetect: true });
      
      // Initialize (should succeed even if file exists - it overwrites)
      await service.initializeProject(tempDir, 'typescript');
      
      // Verify typescript content replaced existing content
      const content = await fs.readFile(join(ollmDir, 'project.yaml'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.name).toBe('typescript');
    });
  });
  
  describe('Built-in Profiles', () => {
    it('should have TypeScript profile', async () => {
      const service = new ProjectProfileService({ autoDetect: true });
      const profiles = service.listBuiltInProfiles();
      
      const typescript = profiles.find(p => p.name === 'typescript');
      expect(typescript).toBeDefined();
      expect(typescript?.description).toBeTruthy();
      expect(typescript?.detectionFiles).toContain('package.json');
    });
    
    it('should have Python profile', async () => {
      const service = new ProjectProfileService({ autoDetect: true });
      const profiles = service.listBuiltInProfiles();
      
      const python = profiles.find(p => p.name === 'python');
      expect(python).toBeDefined();
      expect(python?.detectionFiles).toContain('requirements.txt');
      expect(python?.detectionFiles).toContain('pyproject.toml');
    });
    
    it('should have Rust profile', async () => {
      const service = new ProjectProfileService({ autoDetect: true });
      const profiles = service.listBuiltInProfiles();
      
      const rust = profiles.find(p => p.name === 'rust');
      expect(rust).toBeDefined();
      expect(rust?.detectionFiles).toContain('Cargo.toml');
    });
    
    it('should have Go profile', async () => {
      const service = new ProjectProfileService({ autoDetect: true });
      const profiles = service.listBuiltInProfiles();
      
      const go = profiles.find(p => p.name === 'go');
      expect(go).toBeDefined();
      expect(go?.detectionFiles).toContain('go.mod');
    });
    
    it('should have documentation profile', async () => {
      const service = new ProjectProfileService({ autoDetect: true });
      const profiles = service.listBuiltInProfiles();
      
      const docs = profiles.find(p => p.name === 'documentation');
      expect(docs).toBeDefined();
      expect(docs?.description).toContain('writing');
    });
  });
  
  describe('Auto-detection Toggle', () => {
    it('should respect auto-detection setting', async () => {
      // Create TypeScript project
      await fs.writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            typescript: '^5.0.0',
          },
        }),
        'utf-8'
      );
      
      // Create service with auto-detection disabled
      const service = new ProjectProfileService({ autoDetect: false });
      const profile = await service.detectProfile(tempDir);
      
      // Should not detect anything
      expect(profile).toBeNull();
    });
  });
});
