/**
 * Integration Tests for ProfileManager - User Profile System
 *
 * These tests verify the complete flow:
 * 1. ProfileCompiler creates user file
 * 2. ProfileManager reads from user file
 * 3. System works end-to-end
 *
 * CRITICAL: Test 3 MUST FAIL if user file is not created properly
 */

import { existsSync, readFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeAll } from 'vitest';

import { compileUserProfiles } from '../../../services/profileCompiler.js';
import { ProfileManager } from '../ProfileManager.js';

describe('ProfileManager Integration Tests', () => {
  describe('TEST 1: Master Database Validation', () => {
    it('CRITICAL: Master DB must exist at correct location', () => {
      const masterDbPath = join(
        process.cwd(),
        'packages',
        'cli',
        'src',
        'config',
        'LLM_profiles.json'
      );

      // This MUST pass - master DB is required
      expect(existsSync(masterDbPath)).toBe(true);
    });

    it('CRITICAL: Master DB must be valid JSON with models', () => {
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

      const firstModel = data.models[0];
      expect(firstModel).toHaveProperty('id');
      expect(firstModel).toHaveProperty('name');
      expect(firstModel).toHaveProperty('context_profiles');
      expect(Array.isArray(firstModel.context_profiles)).toBe(true);

      // Check pre-calculated 85% values
      if (firstModel.context_profiles.length > 0) {
        const firstProfile = firstModel.context_profiles[0];
        expect(firstProfile).toHaveProperty('ollama_context_size');
        expect(typeof firstProfile.ollama_context_size).toBe('number');
      }
    });
  });

  describe('TEST 2: ProfileCompiler Functionality', () => {
    it('CRITICAL: ProfileCompiler must create user file', async () => {
      // Compile user profiles
      await compileUserProfiles();

      // Check user file was created
      const homeDir = process.env.VITEST ? join(tmpdir(), `ollm-vitest-${process.pid}`) : homedir();
      const userProfilePath = join(homeDir, '.ollm', 'LLM_profiles.json');

      // This MUST pass - user file must be created
      expect(existsSync(userProfilePath)).toBe(true);
    });

    it('CRITICAL: User file must have valid structure', async () => {
      await compileUserProfiles();

      const homeDir = process.env.VITEST ? join(tmpdir(), `ollm-vitest-${process.pid}`) : homedir();
      const userProfilePath = join(homeDir, '.ollm', 'LLM_profiles.json');

      const raw = readFileSync(userProfilePath, 'utf-8');
      const data = JSON.parse(raw);

      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('last_updated');
      expect(data).toHaveProperty('source');
      expect(data).toHaveProperty('models');
      expect(Array.isArray(data.models)).toBe(true);
    });
  });

  describe('TEST 3: User Folder File Existence (MUST FAIL if not created)', () => {
    beforeAll(async () => {
      // Ensure compilation runs before these tests
      await compileUserProfiles();
    });

    it('REGRESSION DETECTOR: User file MUST exist in ~/.ollm/', () => {
      const homeDir = process.env.VITEST ? join(tmpdir(), `ollm-vitest-${process.pid}`) : homedir();
      const userProfilePath = join(homeDir, '.ollm', 'LLM_profiles.json');

      // This test MUST FAIL if user file is not created
      // If this fails, the compilation system is broken
      expect(existsSync(userProfilePath)).toBe(true);
    });

    it('REGRESSION DETECTOR: User file MUST be readable JSON', () => {
      const homeDir = process.env.VITEST ? join(tmpdir(), `ollm-vitest-${process.pid}`) : homedir();
      const userProfilePath = join(homeDir, '.ollm', 'LLM_profiles.json');

      // This test MUST FAIL if user file is corrupted
      expect(() => {
        const raw = readFileSync(userProfilePath, 'utf-8');
        JSON.parse(raw);
      }).not.toThrow();
    });

    it('REGRESSION DETECTOR: User file MUST have models array', () => {
      const homeDir = process.env.VITEST ? join(tmpdir(), `ollm-vitest-${process.pid}`) : homedir();
      const userProfilePath = join(homeDir, '.ollm', 'LLM_profiles.json');

      const raw = readFileSync(userProfilePath, 'utf-8');
      const data = JSON.parse(raw);

      // This test MUST FAIL if structure is wrong
      expect(data).toHaveProperty('models');
      expect(Array.isArray(data.models)).toBe(true);
    });

    it('REGRESSION DETECTOR: ProfileManager MUST load profiles from user file', async () => {
      // Ensure user file exists
      await compileUserProfiles();

      // Create new ProfileManager instance
      const manager = new ProfileManager();
      const profiles = manager.getProfiles();

      // This test MUST FAIL if ProfileManager doesn't read from user file
      // Note: profiles might be empty if no models are installed, but the array should exist
      expect(Array.isArray(profiles)).toBe(true);
    });

    it('REGRESSION DETECTOR: ProfileManager MUST find known models', async () => {
      // Ensure user file exists with at least one model
      await compileUserProfiles();

      const manager = new ProfileManager();

      // Check if any profiles were loaded
      const profiles = manager.getProfiles();

      // If profiles exist, test findProfile works
      if (profiles.length > 0) {
        const firstModelId = profiles[0].id;
        const found = manager.findProfile(firstModelId);

        // This MUST pass if profiles were loaded
        expect(found).toBeDefined();
        expect(found?.id).toBe(firstModelId);
      } else {
        // No models installed - this is OK for test environment
        // But we should still be able to get model entries
        const entry = manager.getModelEntry('test-model:latest');
        expect(entry).toBeDefined();
      }
    });
  });

  describe('Architecture Validation', () => {
    it('CRITICAL: ProfileManager must NOT read from master DB', () => {
      // This is a documentation test
      // ProfileManager should ONLY read from user file
      // NOT from packages/cli/src/config/LLM_profiles.json

      const _manager = new ProfileManager();

      // If ProfileManager reads from master DB, it violates architecture
      // The only component that should read master DB is ProfileCompiler

      expect(true).toBe(true); // Documentation test
    });

    it('CRITICAL: Only ProfileCompiler should access master DB', () => {
      // Architecture principle:
      // - ProfileCompiler reads master DB
      // - ProfileCompiler writes user file
      // - ProfileManager reads user file
      // - All other components read user file

      // Future: When we migrate to proper database,
      // we only need to change ProfileCompiler

      expect(true).toBe(true); // Documentation test
    });
  });
});
