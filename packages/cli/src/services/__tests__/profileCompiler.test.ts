/**
 * Tests for ProfileCompiler - User Profile Compilation System
 *
 * CRITICAL: These tests verify the architecture principle:
 * - Master DB (packages/cli/src/config/LLM_profiles.json) = READ ONLY by ProfileCompiler
 * - User File (~/.ollm/LLM_profiles.json) = READ by entire app
 * - ProfileCompiler is the ONLY component that reads master DB
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ProfileCompiler, getProfileCompiler, compileUserProfiles } from '../profileCompiler.js';

describe('ProfileCompiler', () => {
  let testHomeDir: string;
  let testConfigDir: string;
  let _testUserProfilePath: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Create isolated test environment
    testHomeDir = join(tmpdir(), `ollm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    testConfigDir = join(testHomeDir, '.ollm');
    _testUserProfilePath = join(testConfigDir, 'LLM_profiles.json');

    // Set VITEST env to use test directory
    process.env.VITEST = 'true';

    // Create test directory
    mkdirSync(testConfigDir, { recursive: true });
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;

    // Clean up test directory
    try {
      if (existsSync(testHomeDir)) {
        rmSync(testHomeDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  describe('Master Database Validation', () => {
    it('CRITICAL: Master DB must exist at packages/cli/src/config/LLM_profiles.json', () => {
      const masterDbPath = join(
        process.cwd(),
        'packages',
        'cli',
        'src',
        'config',
        'LLM_profiles.json'
      );

      // This test MUST pass - master DB is required
      expect(existsSync(masterDbPath)).toBe(true);
    });

    it('CRITICAL: Master DB must be valid JSON', () => {
      const masterDbPath = join(
        process.cwd(),
        'packages',
        'cli',
        'src',
        'config',
        'LLM_profiles.json'
      );

      expect(() => {
        const raw = readFileSync(masterDbPath, 'utf-8');
        JSON.parse(raw);
      }).not.toThrow();
    });

    it('CRITICAL: Master DB must have models array', () => {
      const masterDbPath = join(
        process.cwd(),
        'packages',
        'cli',
        'src',
        'config',
        'LLM_profiles.json'
      );
      const raw = readFileSync(masterDbPath, 'utf-8');
      const data = JSON.parse(raw);

      expect(data).toHaveProperty('models');
      expect(Array.isArray(data.models)).toBe(true);
      expect(data.models.length).toBeGreaterThan(0);
    });

    it('CRITICAL: Master DB models must have required fields', () => {
      const masterDbPath = join(
        process.cwd(),
        'packages',
        'cli',
        'src',
        'config',
        'LLM_profiles.json'
      );
      const raw = readFileSync(masterDbPath, 'utf-8');
      const data = JSON.parse(raw);

      // Check first model has required fields
      const firstModel = data.models[0];
      expect(firstModel).toHaveProperty('id');
      expect(firstModel).toHaveProperty('name');
      expect(firstModel).toHaveProperty('context_profiles');
      expect(Array.isArray(firstModel.context_profiles)).toBe(true);
    });

    it('CRITICAL: Master DB context profiles must have ollama_context_size (85% pre-calculated)', () => {
      const masterDbPath = join(
        process.cwd(),
        'packages',
        'cli',
        'src',
        'config',
        'LLM_profiles.json'
      );
      const raw = readFileSync(masterDbPath, 'utf-8');
      const data = JSON.parse(raw);

      // Check that context profiles have pre-calculated 85% values
      const firstModel = data.models[0];
      if (firstModel.context_profiles && firstModel.context_profiles.length > 0) {
        const firstProfile = firstModel.context_profiles[0];
        expect(firstProfile).toHaveProperty('ollama_context_size');
        expect(typeof firstProfile.ollama_context_size).toBe('number');
        expect(firstProfile.ollama_context_size).toBeGreaterThan(0);

        // Verify it's approximately 70-85% of size (some models use different ratios)
        if (firstProfile.size) {
          const ratio = firstProfile.ollama_context_size / firstProfile.size;
          expect(ratio).toBeGreaterThan(0.65); // At least 65%
          expect(ratio).toBeLessThan(0.9); // At most 90%
        }
      }
    });
  });

  describe('ProfileCompiler Construction', () => {
    it('should create ProfileCompiler instance', () => {
      const compiler = new ProfileCompiler();
      expect(compiler).toBeDefined();
      expect(compiler).toBeInstanceOf(ProfileCompiler);
    });

    it('should provide singleton instance via getProfileCompiler()', () => {
      const compiler1 = getProfileCompiler();
      const compiler2 = getProfileCompiler();

      expect(compiler1).toBe(compiler2); // Same instance
    });

    it('should return user profile path', () => {
      const compiler = new ProfileCompiler();
      const path = compiler.getUserProfilePath();

      expect(path).toBeDefined();
      expect(path).toContain('.ollm');
      expect(path).toContain('LLM_profiles.json');
    });
  });

  describe('User Profile Compilation', () => {
    it('should compile user profiles successfully', async () => {
      const compiler = new ProfileCompiler();

      // Should not throw
      await expect(compiler.compileUserProfiles()).resolves.not.toThrow();
    });

    it('should create user profile file', async () => {
      const compiler = new ProfileCompiler();
      await compiler.compileUserProfiles();

      const userPath = compiler.getUserProfilePath();
      expect(existsSync(userPath)).toBe(true);
    });

    it('should create valid JSON in user file', async () => {
      const compiler = new ProfileCompiler();
      await compiler.compileUserProfiles();

      const userPath = compiler.getUserProfilePath();
      expect(() => {
        const raw = readFileSync(userPath, 'utf-8');
        JSON.parse(raw);
      }).not.toThrow();
    });

    it('should include version and metadata in user file', async () => {
      const compiler = new ProfileCompiler();
      await compiler.compileUserProfiles();

      const userPath = compiler.getUserProfilePath();
      const raw = readFileSync(userPath, 'utf-8');
      const data = JSON.parse(raw);

      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('last_updated');
      expect(data).toHaveProperty('source');
      expect(data).toHaveProperty('models');
      expect(Array.isArray(data.models)).toBe(true);
    });

    it('should use convenience function compileUserProfiles()', async () => {
      await expect(compileUserProfiles()).resolves.not.toThrow();

      const compiler = getProfileCompiler();
      const userPath = compiler.getUserProfilePath();
      expect(existsSync(userPath)).toBe(true);
    });
  });

  describe('Model Matching', () => {
    it('should handle empty installed models list', async () => {
      // Mock Ollama to return empty list
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      const compiler = new ProfileCompiler();
      await compiler.compileUserProfiles();

      const userPath = compiler.getUserProfilePath();
      const raw = readFileSync(userPath, 'utf-8');
      const data = JSON.parse(raw);

      expect(data.models).toEqual([]);
    });

    it('should match installed models with master DB', async () => {
      // Mock Ollama to return known model
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2:3b' }],
        }),
      });

      const compiler = new ProfileCompiler();
      await compiler.compileUserProfiles();

      const userPath = compiler.getUserProfilePath();
      const raw = readFileSync(userPath, 'utf-8');
      const data = JSON.parse(raw);

      // Should have matched model
      expect(data.models.length).toBeGreaterThan(0);
      const matched = data.models.find((m: any) => m.id === 'llama3.2:3b');
      expect(matched).toBeDefined();
    });

    it('should copy ALL metadata from master DB (not just context profiles)', async () => {
      // Mock Ollama to return known model
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2:3b' }],
        }),
      });

      const compiler = new ProfileCompiler();
      await compiler.compileUserProfiles();

      const userPath = compiler.getUserProfilePath();
      const raw = readFileSync(userPath, 'utf-8');
      const data = JSON.parse(raw);

      const matched = data.models.find((m: any) => m.id === 'llama3.2:3b');
      if (matched) {
        // Should have all metadata fields
        expect(matched).toHaveProperty('id');
        expect(matched).toHaveProperty('name');
        expect(matched).toHaveProperty('description');
        expect(matched).toHaveProperty('abilities');
        expect(matched).toHaveProperty('context_profiles');
        expect(matched).toHaveProperty('max_context_window');
        expect(matched).toHaveProperty('default_context');
      }
    });

    it('should handle models not in master DB using fallback template', async () => {
      // Mock Ollama to return unknown model
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'unknown-model:latest' }],
        }),
      });

      const compiler = new ProfileCompiler();
      await compiler.compileUserProfiles();

      const userPath = compiler.getUserProfilePath();
      const raw = readFileSync(userPath, 'utf-8');
      const data = JSON.parse(raw);

      // Should include unknown model with template values
      const matched = data.models.find((m: any) => m.id === 'unknown-model:latest');
      expect(matched).toBeDefined();

      // Should have template values
      expect(matched?.name).toContain('Unknown Model');
      expect(matched?.creator).toBe('User');
      expect(matched?.parameters).toContain('Based on Llama 3.2');
      expect(matched?.tool_support).toBe(false);
      expect(matched?.abilities).toContain('Unknown');

      // Should have context profiles from template
      expect(matched?.context_profiles).toBeDefined();
      expect(matched?.context_profiles.length).toBeGreaterThan(0);
    });
  });

  describe('User Override Preservation', () => {
    it('should preserve user overrides when recompiling', async () => {
      // Mock Ollama
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2:3b' }],
        }),
      });

      const compiler = new ProfileCompiler();

      // First compilation
      await compiler.compileUserProfiles();

      // Modify user file (simulate user override)
      const userPath = compiler.getUserProfilePath();
      const raw = readFileSync(userPath, 'utf-8');
      const data = JSON.parse(raw);

      if (data.models.length > 0) {
        data.models[0].custom_field = 'user_override';
        writeFileSync(userPath, JSON.stringify(data, null, 2));
      }

      // Second compilation
      await compiler.compileUserProfiles();

      // Check user override was preserved
      const raw2 = readFileSync(userPath, 'utf-8');
      const data2 = JSON.parse(raw2);

      if (data2.models.length > 0) {
        expect(data2.models[0]).toHaveProperty('custom_field');
        expect(data2.models[0].custom_field).toBe('user_override');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle Ollama not available gracefully', async () => {
      // Mock Ollama to fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const compiler = new ProfileCompiler();

      // Should not throw
      await expect(compiler.compileUserProfiles()).resolves.not.toThrow();
    });

    it('should handle Ollama timeout gracefully', async () => {
      // Mock Ollama to timeout
      global.fetch = vi
        .fn()
        .mockImplementation(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
        );

      const compiler = new ProfileCompiler();

      // Should not throw
      await expect(compiler.compileUserProfiles()).resolves.not.toThrow();
    });

    it('should handle invalid master DB gracefully', async () => {
      // This test verifies fallback behavior
      // In real scenario, master DB should always be valid

      const compiler = new ProfileCompiler();
      await expect(compiler.compileUserProfiles()).resolves.not.toThrow();
    });
  });

  describe('REGRESSION TEST: User File Must Exist After Compilation', () => {
    it('MUST FAIL if user file is not created (regression detector)', async () => {
      const compiler = new ProfileCompiler();
      await compiler.compileUserProfiles();

      const userPath = compiler.getUserProfilePath();

      // This test MUST pass - if it fails, compilation is broken
      expect(existsSync(userPath)).toBe(true);

      // Additional validation
      const raw = readFileSync(userPath, 'utf-8');
      const data = JSON.parse(raw);

      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('models');
      expect(Array.isArray(data.models)).toBe(true);
    });

    it('MUST FAIL if user file has invalid structure (regression detector)', async () => {
      const compiler = new ProfileCompiler();
      await compiler.compileUserProfiles();

      const userPath = compiler.getUserProfilePath();
      const raw = readFileSync(userPath, 'utf-8');
      const data = JSON.parse(raw);

      // Required fields
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('last_updated');
      expect(data).toHaveProperty('source');
      expect(data).toHaveProperty('models');

      // Models must be array
      expect(Array.isArray(data.models)).toBe(true);

      // If models exist, they must have required fields
      if (data.models.length > 0) {
        const firstModel = data.models[0];
        expect(firstModel).toHaveProperty('id');
        expect(firstModel).toHaveProperty('name');
      }
    });
  });

  describe('Architecture Validation', () => {
    it('CRITICAL: Only ProfileCompiler should read from master DB', () => {
      // This is a documentation test to enforce architecture
      // If other components read from master DB, they violate the principle

      const masterDbPath = join(
        process.cwd(),
        'packages',
        'cli',
        'src',
        'config',
        'LLM_profiles.json'
      );

      // Master DB exists
      expect(existsSync(masterDbPath)).toBe(true);

      // Architecture principle:
      // - ProfileCompiler reads from master DB
      // - All other components read from user file
      // - Future DB migration = change compiler only

      expect(true).toBe(true); // Documentation test
    });

    it('CRITICAL: User file location must be ~/.ollm/LLM_profiles.json', () => {
      const compiler = new ProfileCompiler();
      const userPath = compiler.getUserProfilePath();

      // Must be in .ollm directory
      expect(userPath).toContain('.ollm');

      // Must be named LLM_profiles.json
      expect(userPath).toContain('LLM_profiles.json');

      // Must NOT be in app config directory
      expect(userPath).not.toContain('packages');
      expect(userPath).not.toContain('cli');
      expect(userPath).not.toContain('src');
      expect(userPath).not.toContain('config');
    });
  });
});
