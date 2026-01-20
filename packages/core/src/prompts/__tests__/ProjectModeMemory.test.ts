/**
 * Tests for ProjectModeMemory
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectModeMemory } from '../ProjectModeMemory.js';
import type { ModeType } from '../ContextAnalyzer.js';

describe('ProjectModeMemory', () => {
  const testProjectPath = path.join(process.cwd(), 'test-project-mode-memory');
  const preferencesPath = path.join(testProjectPath, '.ollm', 'mode-preferences.json');
  let memory: ProjectModeMemory;

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    
    // Create test directory
    await fs.mkdir(testProjectPath, { recursive: true });
    
    memory = new ProjectModeMemory(testProjectPath);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe('Initialization', () => {
    it('should create instance with project path', () => {
      expect(memory).toBeDefined();
      expect(memory.getFilePath()).toBe(preferencesPath);
    });

    it('should load default preferences when file does not exist', async () => {
      const prefs = await memory.load();
      
      expect(prefs.defaultMode).toBe('assistant');
      expect(prefs.autoSwitchEnabled).toBe(true);
      expect(prefs.customThresholds).toEqual({});
      expect(prefs.disabledModes).toEqual([]);
      expect(prefs.preferredWorkflows).toEqual([]);
    });

    it('should check if preferences file exists', async () => {
      expect(await memory.exists()).toBe(false);
      
      await memory.load();
      await memory.save();
      
      expect(await memory.exists()).toBe(true);
    });
  });

  describe('Default Mode', () => {
    beforeEach(async () => {
      await memory.load();
    });

    it('should get default mode', () => {
      expect(memory.getDefaultMode()).toBe('assistant');
    });

    it('should set default mode', async () => {
      await memory.setDefaultMode('developer');
      expect(memory.getDefaultMode()).toBe('developer');
    });

    it('should persist default mode to disk', async () => {
      await memory.setDefaultMode('planning');
      
      // Create new instance and load
      const memory2 = new ProjectModeMemory(testProjectPath);
      await memory2.load();
      
      expect(memory2.getDefaultMode()).toBe('planning');
    });

    it('should throw error if not loaded', () => {
      const unloadedMemory = new ProjectModeMemory(testProjectPath);
      expect(() => unloadedMemory.getDefaultMode()).toThrow('not loaded');
    });
  });

  describe('Auto-Switch', () => {
    beforeEach(async () => {
      await memory.load();
    });

    it('should get auto-switch enabled state', () => {
      expect(memory.isAutoSwitchEnabled()).toBe(true);
    });

    it('should set auto-switch enabled state', async () => {
      await memory.setAutoSwitchEnabled(false);
      expect(memory.isAutoSwitchEnabled()).toBe(false);
    });

    it('should persist auto-switch state to disk', async () => {
      await memory.setAutoSwitchEnabled(false);
      
      // Create new instance and load
      const memory2 = new ProjectModeMemory(testProjectPath);
      await memory2.load();
      
      expect(memory2.isAutoSwitchEnabled()).toBe(false);
    });
  });

  describe('Custom Thresholds', () => {
    beforeEach(async () => {
      await memory.load();
    });

    it('should return undefined for unset threshold', () => {
      expect(memory.getCustomThreshold('developer')).toBeUndefined();
    });

    it('should set custom threshold', async () => {
      await memory.setCustomThreshold('developer', 0.85);
      expect(memory.getCustomThreshold('developer')).toBe(0.85);
    });

    it('should validate threshold range', async () => {
      await expect(memory.setCustomThreshold('developer', 1.5)).rejects.toThrow('between 0.0 and 1.0');
      await expect(memory.setCustomThreshold('developer', -0.1)).rejects.toThrow('between 0.0 and 1.0');
    });

    it('should remove custom threshold', async () => {
      await memory.setCustomThreshold('developer', 0.85);
      expect(memory.getCustomThreshold('developer')).toBe(0.85);
      
      await memory.removeCustomThreshold('developer');
      expect(memory.getCustomThreshold('developer')).toBeUndefined();
    });

    it('should persist custom thresholds to disk', async () => {
      await memory.setCustomThreshold('developer', 0.85);
      await memory.setCustomThreshold('planning', 0.75);
      
      // Create new instance and load
      const memory2 = new ProjectModeMemory(testProjectPath);
      await memory2.load();
      
      expect(memory2.getCustomThreshold('developer')).toBe(0.85);
      expect(memory2.getCustomThreshold('planning')).toBe(0.75);
    });

    it('should handle multiple thresholds', async () => {
      const thresholds: Record<ModeType, number> = {
        assistant: 0.6,
        planning: 0.7,
        developer: 0.8,
        tool: 0.9,
        debugger: 0.85,
        security: 0.85,
        reviewer: 0.8,
        performance: 0.8,
        prototype: 0.75,
        teacher: 0.7,
      };

      for (const [mode, threshold] of Object.entries(thresholds)) {
        await memory.setCustomThreshold(mode as ModeType, threshold);
      }

      for (const [mode, threshold] of Object.entries(thresholds)) {
        expect(memory.getCustomThreshold(mode as ModeType)).toBe(threshold);
      }
    });
  });

  describe('Disabled Modes', () => {
    beforeEach(async () => {
      await memory.load();
    });

    it('should check if mode is disabled', () => {
      expect(memory.isModeDisabled('prototype')).toBe(false);
    });

    it('should disable a mode', async () => {
      await memory.disableMode('prototype');
      expect(memory.isModeDisabled('prototype')).toBe(true);
    });

    it('should enable a mode', async () => {
      await memory.disableMode('prototype');
      expect(memory.isModeDisabled('prototype')).toBe(true);
      
      await memory.enableMode('prototype');
      expect(memory.isModeDisabled('prototype')).toBe(false);
    });

    it('should not duplicate disabled modes', async () => {
      await memory.disableMode('prototype');
      await memory.disableMode('prototype');
      
      const prefs = memory.getPreferences();
      expect(prefs.disabledModes.filter(m => m === 'prototype')).toHaveLength(1);
    });

    it('should persist disabled modes to disk', async () => {
      await memory.disableMode('prototype');
      await memory.disableMode('teacher');
      
      // Create new instance and load
      const memory2 = new ProjectModeMemory(testProjectPath);
      await memory2.load();
      
      expect(memory2.isModeDisabled('prototype')).toBe(true);
      expect(memory2.isModeDisabled('teacher')).toBe(true);
      expect(memory2.isModeDisabled('developer')).toBe(false);
    });

    it('should handle multiple disabled modes', async () => {
      const modesToDisable: ModeType[] = ['prototype', 'teacher', 'security'];
      
      for (const mode of modesToDisable) {
        await memory.disableMode(mode);
      }

      for (const mode of modesToDisable) {
        expect(memory.isModeDisabled(mode)).toBe(true);
      }

      expect(memory.isModeDisabled('developer')).toBe(false);
    });
  });

  describe('Preferred Workflows', () => {
    beforeEach(async () => {
      await memory.load();
    });

    it('should get empty workflows initially', () => {
      expect(memory.getPreferredWorkflows()).toEqual([]);
    });

    it('should add preferred workflow', async () => {
      await memory.addPreferredWorkflow('feature_development');
      expect(memory.getPreferredWorkflows()).toContain('feature_development');
    });

    it('should not duplicate workflows', async () => {
      await memory.addPreferredWorkflow('feature_development');
      await memory.addPreferredWorkflow('feature_development');
      
      const workflows = memory.getPreferredWorkflows();
      expect(workflows.filter(w => w === 'feature_development')).toHaveLength(1);
    });

    it('should remove preferred workflow', async () => {
      await memory.addPreferredWorkflow('feature_development');
      await memory.addPreferredWorkflow('bug_fix');
      
      expect(memory.getPreferredWorkflows()).toHaveLength(2);
      
      await memory.removePreferredWorkflow('feature_development');
      
      const workflows = memory.getPreferredWorkflows();
      expect(workflows).toHaveLength(1);
      expect(workflows).toContain('bug_fix');
      expect(workflows).not.toContain('feature_development');
    });

    it('should persist workflows to disk', async () => {
      await memory.addPreferredWorkflow('feature_development');
      await memory.addPreferredWorkflow('bug_fix');
      await memory.addPreferredWorkflow('security_hardening');
      
      // Create new instance and load
      const memory2 = new ProjectModeMemory(testProjectPath);
      await memory2.load();
      
      const workflows = memory2.getPreferredWorkflows();
      expect(workflows).toHaveLength(3);
      expect(workflows).toContain('feature_development');
      expect(workflows).toContain('bug_fix');
      expect(workflows).toContain('security_hardening');
    });
  });

  describe('Persistence', () => {
    it('should create .ollm directory if it does not exist', async () => {
      // Clean up first
      await fs.rm(testProjectPath, { recursive: true, force: true });
      await fs.mkdir(testProjectPath, { recursive: true });
      const freshMemory = new ProjectModeMemory(testProjectPath);
      
      await freshMemory.load();
      await freshMemory.setDefaultMode('developer');
      
      const ollmDir = path.join(testProjectPath, '.ollm');
      const stats = await fs.stat(ollmDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should save and load complete preferences', async () => {
      // Clean up first
      await fs.rm(testProjectPath, { recursive: true, force: true });
      await fs.mkdir(testProjectPath, { recursive: true });
      const freshMemory = new ProjectModeMemory(testProjectPath);
      
      await freshMemory.load();
      
      // Set various preferences
      await freshMemory.setDefaultMode('developer');
      await freshMemory.setAutoSwitchEnabled(false);
      await freshMemory.setCustomThreshold('planning', 0.75);
      await freshMemory.setCustomThreshold('debugger', 0.85);
      await freshMemory.disableMode('prototype');
      await freshMemory.addPreferredWorkflow('feature_development');
      
      // Create new instance and load
      const memory2 = new ProjectModeMemory(testProjectPath);
      const prefs = await memory2.load();
      
      expect(prefs.defaultMode).toBe('developer');
      expect(prefs.autoSwitchEnabled).toBe(false);
      expect(prefs.customThresholds.planning).toBe(0.75);
      expect(prefs.customThresholds.debugger).toBe(0.85);
      expect(prefs.disabledModes).toContain('prototype');
      expect(prefs.preferredWorkflows).toContain('feature_development');
    });

    it('should update lastUpdated timestamp on save', async () => {
      // Clean up first
      await fs.rm(testProjectPath, { recursive: true, force: true });
      await fs.mkdir(testProjectPath, { recursive: true });
      const freshMemory = new ProjectModeMemory(testProjectPath);
      
      await freshMemory.load();
      
      const before = Date.now();
      await freshMemory.setDefaultMode('developer');
      const after = Date.now();
      
      const prefs = freshMemory.getPreferences();
      expect(prefs.lastUpdated).toBeDefined();
      expect(prefs.lastUpdated!).toBeGreaterThanOrEqual(before);
      expect(prefs.lastUpdated!).toBeLessThanOrEqual(after);
    });

    it('should handle corrupted preferences file', async () => {
      // Clean up first
      await fs.rm(testProjectPath, { recursive: true, force: true });
      await fs.mkdir(testProjectPath, { recursive: true });
      const freshMemory = new ProjectModeMemory(testProjectPath);
      
      // Create corrupted file
      const ollmDir = path.dirname(preferencesPath);
      await fs.mkdir(ollmDir, { recursive: true });
      await fs.writeFile(preferencesPath, 'invalid json{', 'utf-8');
      
      // Should throw error
      await expect(freshMemory.load()).rejects.toThrow('Failed to load mode preferences');
    });

    it('should merge loaded preferences with defaults', async () => {
      // Use unique test directory
      const uniquePath = path.join(process.cwd(), 'test-project-mode-memory-merge');
      const uniquePrefsPath = path.join(uniquePath, '.ollm', 'mode-preferences.json');
      
      // Clean up first
      await fs.rm(uniquePath, { recursive: true, force: true });
      await fs.mkdir(uniquePath, { recursive: true });
      const freshMemory = new ProjectModeMemory(uniquePath);
      
      // Create partial preferences file
      const ollmDir = path.dirname(uniquePrefsPath);
      await fs.mkdir(ollmDir, { recursive: true });
      await fs.writeFile(
        uniquePrefsPath,
        JSON.stringify({ defaultMode: 'developer' }),
        'utf-8'
      );
      
      const prefs = await freshMemory.load();
      
      // Should have loaded value
      expect(prefs.defaultMode).toBe('developer');
      
      // Should have default values for missing fields
      expect(prefs.autoSwitchEnabled).toBe(true);
      expect(prefs.customThresholds).toEqual({});
      expect(prefs.disabledModes).toEqual([]);
      expect(prefs.preferredWorkflows).toEqual([]);
      
      // Clean up
      await fs.rm(uniquePath, { recursive: true, force: true });
    });
  });

  describe('Reset', () => {
    it('should reset preferences to defaults', async () => {
      // Use unique test directory
      const uniquePath = path.join(process.cwd(), 'test-project-mode-memory-reset');
      
      // Clean up first
      await fs.rm(uniquePath, { recursive: true, force: true });
      await fs.mkdir(uniquePath, { recursive: true });
      const freshMemory = new ProjectModeMemory(uniquePath);
      
      await freshMemory.load();
      
      // Set various preferences
      await freshMemory.setDefaultMode('developer');
      await freshMemory.setAutoSwitchEnabled(false);
      await freshMemory.setCustomThreshold('planning', 0.75);
      await freshMemory.disableMode('prototype');
      await freshMemory.addPreferredWorkflow('feature_development');
      
      // Reset
      await freshMemory.reset();
      
      const prefs = freshMemory.getPreferences();
      expect(prefs.defaultMode).toBe('assistant');
      expect(prefs.autoSwitchEnabled).toBe(true);
      expect(prefs.customThresholds).toEqual({});
      expect(prefs.disabledModes).toEqual([]);
      expect(prefs.preferredWorkflows).toEqual([]);
      
      // Clean up
      await fs.rm(uniquePath, { recursive: true, force: true });
    });

    it('should persist reset to disk', async () => {
      // Use unique test directory
      const uniquePath = path.join(process.cwd(), 'test-project-mode-memory-reset-persist');
      
      // Clean up first
      await fs.rm(uniquePath, { recursive: true, force: true });
      await fs.mkdir(uniquePath, { recursive: true });
      const freshMemory = new ProjectModeMemory(uniquePath);
      
      await freshMemory.load();
      await freshMemory.setDefaultMode('developer');
      await freshMemory.reset();
      
      // Create new instance and load
      const memory2 = new ProjectModeMemory(uniquePath);
      const prefs = await memory2.load();
      
      expect(prefs.defaultMode).toBe('assistant');
      
      // Clean up
      await fs.rm(uniquePath, { recursive: true, force: true });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when accessing preferences before loading', () => {
      const unloadedMemory = new ProjectModeMemory(testProjectPath);
      
      expect(() => unloadedMemory.getPreferences()).toThrow('not loaded');
      expect(() => unloadedMemory.getDefaultMode()).toThrow('not loaded');
      expect(() => unloadedMemory.isAutoSwitchEnabled()).toThrow('not loaded');
      expect(() => unloadedMemory.getCustomThreshold('developer')).toThrow('not loaded');
      expect(() => unloadedMemory.isModeDisabled('prototype')).toThrow('not loaded');
      expect(() => unloadedMemory.getPreferredWorkflows()).toThrow('not loaded');
    });

    it('should throw error when modifying preferences before loading', async () => {
      const unloadedMemory = new ProjectModeMemory(testProjectPath);
      
      await expect(unloadedMemory.setDefaultMode('developer')).rejects.toThrow('not loaded');
      await expect(unloadedMemory.setAutoSwitchEnabled(false)).rejects.toThrow('not loaded');
      await expect(unloadedMemory.setCustomThreshold('developer', 0.8)).rejects.toThrow('not loaded');
      await expect(unloadedMemory.disableMode('prototype')).rejects.toThrow('not loaded');
      await expect(unloadedMemory.addPreferredWorkflow('test')).rejects.toThrow('not loaded');
    });
  });

  describe('getPreferences', () => {
    it('should return a copy of preferences', async () => {
      await memory.load();
      
      const prefs1 = memory.getPreferences();
      const prefs2 = memory.getPreferences();
      
      // Should be equal but not the same object
      expect(prefs1).toEqual(prefs2);
      expect(prefs1).not.toBe(prefs2);
      
      // Modifying returned object should not affect internal state
      prefs1.defaultMode = 'developer';
      expect(memory.getDefaultMode()).toBe('assistant');
    });
  });
});
