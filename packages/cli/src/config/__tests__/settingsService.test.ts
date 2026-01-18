import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsService } from '../settingsService.js';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

// Mock os module to control homedir
vi.mock('os', async (importOriginal) => {
  const mod = await importOriginal<typeof import('os')>();
  return {
    ...mod,
    homedir: vi.fn(),
  };
});

describe('SettingsService - Tool State Management', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    testDir = join(tmpdir(), `ollm-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    
    // Mock homedir to use test directory
    vi.mocked(homedir).mockReturnValue(testDir);
    
    // Reset singleton instance
    // @ts-expect-error - accessing private static field for testing
    SettingsService.instance = undefined;
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    // Reset singleton instance
    // @ts-expect-error - accessing private static field for testing
    SettingsService.instance = undefined;
    
    vi.clearAllMocks();
  });

  describe('getToolState', () => {
    it('should return true by default for any tool', () => {
      const service = SettingsService.getInstance();
      expect(service.getToolState('read-file')).toBe(true);
      expect(service.getToolState('write-file')).toBe(true);
      expect(service.getToolState('shell')).toBe(true);
    });

    it('should return true for unknown tools by default', () => {
      const service = SettingsService.getInstance();
      expect(service.getToolState('non-existent-tool')).toBe(true);
    });

    it('should return false for explicitly disabled tools', () => {
      const service = SettingsService.getInstance();
      service.setToolState('write-file', false);
      expect(service.getToolState('write-file')).toBe(false);
    });

    it('should return true for explicitly enabled tools', () => {
      const service = SettingsService.getInstance();
      service.setToolState('read-file', true);
      expect(service.getToolState('read-file')).toBe(true);
    });
  });

  describe('setToolState', () => {
    it('should persist tool state to settings file', () => {
      const service = SettingsService.getInstance();
      service.setToolState('shell', false);
      
      // Create new instance to verify persistence
      // @ts-expect-error - accessing private static field for testing
      SettingsService.instance = undefined;
      const newService = SettingsService.getInstance();
      
      expect(newService.getToolState('shell')).toBe(false);
    });

    it('should handle multiple tool states', () => {
      const service = SettingsService.getInstance();
      service.setToolState('read-file', true);
      service.setToolState('write-file', false);
      service.setToolState('shell', false);
      
      expect(service.getToolState('read-file')).toBe(true);
      expect(service.getToolState('write-file')).toBe(false);
      expect(service.getToolState('shell')).toBe(false);
    });

    it('should allow toggling tool state', () => {
      const service = SettingsService.getInstance();
      
      service.setToolState('web-fetch', false);
      expect(service.getToolState('web-fetch')).toBe(false);
      
      service.setToolState('web-fetch', true);
      expect(service.getToolState('web-fetch')).toBe(true);
    });
  });

  describe('settings persistence', () => {
    it('should preserve other settings when updating tool state', () => {
      const service = SettingsService.getInstance();
      
      // Set some other settings
      service.setTheme('dark');
      service.setModel('llama3.2:3b');
      service.setContextSize(8192);
      
      // Set tool state
      service.setToolState('read-file', false);
      
      // Verify all settings are preserved
      expect(service.getTheme()).toBe('dark');
      expect(service.getModel()).toBe('llama3.2:3b');
      expect(service.getContextSize()).toBe(8192);
      expect(service.getToolState('read-file')).toBe(false);
    });

    it('should load existing tool states from settings file', () => {
      // Create settings file with tool states
      const settingsDir = join(testDir, '.ollm');
      mkdirSync(settingsDir, { recursive: true });
      const settingsPath = join(settingsDir, 'settings.json');
      
      writeFileSync(settingsPath, JSON.stringify({
        ui: { theme: 'default' },
        llm: { model: 'llama3.2:3b' },
        tools: {
          'read-file': true,
          'write-file': false,
          'shell': false,
        }
      }, null, 2));
      
      // Create service instance
      const service = SettingsService.getInstance();
      
      // Verify tool states are loaded
      expect(service.getToolState('read-file')).toBe(true);
      expect(service.getToolState('write-file')).toBe(false);
      expect(service.getToolState('shell')).toBe(false);
      expect(service.getToolState('web-fetch')).toBe(true); // default
    });
  });

  describe('edge cases', () => {
    it('should handle empty tools object', () => {
      const service = SettingsService.getInstance();
      // Initially no tools are set
      expect(service.getToolState('any-tool')).toBe(true);
    });

    it('should handle undefined tools field in loaded settings', () => {
      // Create settings file without tools field
      const settingsDir = join(testDir, '.ollm');
      mkdirSync(settingsDir, { recursive: true });
      const settingsPath = join(settingsDir, 'settings.json');
      
      writeFileSync(settingsPath, JSON.stringify({
        ui: { theme: 'default' },
        llm: { model: 'llama3.2:3b' }
      }, null, 2));
      
      const service = SettingsService.getInstance();
      
      // Should default to true
      expect(service.getToolState('read-file')).toBe(true);
      
      // Should be able to set tool state
      service.setToolState('write-file', false);
      expect(service.getToolState('write-file')).toBe(false);
    });
  });
});
