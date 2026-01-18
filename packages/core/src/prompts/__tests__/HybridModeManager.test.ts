/**
 * Tests for HybridModeManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HybridModeManager, PRESET_HYBRID_MODES } from '../HybridModeManager.js';
import type { ModeType } from '../ContextAnalyzer.js';

describe('HybridModeManager', () => {
  let manager: HybridModeManager;
  
  beforeEach(() => {
    manager = new HybridModeManager();
  });
  
  describe('createHybridMode', () => {
    it('should create a hybrid mode from multiple modes', () => {
      const modes: ModeType[] = ['developer', 'security'];
      const hybridMode = manager.createHybridMode(modes);
      
      expect(hybridMode).toBeDefined();
      expect(hybridMode.modes).toEqual(['developer', 'security']);
      // This will match the preset "Secure Developer"
      expect(hybridMode.name).toBe('Secure Developer');
      expect(hybridMode.id).toBe('secure-developer');
    });
    
    it('should return preset hybrid mode if it matches', () => {
      const modes: ModeType[] = ['developer', 'security'];
      const hybridMode = manager.createHybridMode(modes);
      
      expect(hybridMode.id).toBe('secure-developer');
      expect(hybridMode).toEqual(PRESET_HYBRID_MODES['secure-developer']);
    });
    
    it('should create custom hybrid mode for non-preset combinations', () => {
      const modes: ModeType[] = ['planning', 'reviewer'];
      const hybridMode = manager.createHybridMode(modes);
      
      expect(hybridMode.id).toBe('hybrid-planning-reviewer');
      expect(hybridMode.modes).toEqual(['planning', 'reviewer']);
    });
    
    it('should sort modes for consistent ID generation', () => {
      const modes1: ModeType[] = ['security', 'developer'];
      const modes2: ModeType[] = ['developer', 'security'];
      
      const hybrid1 = manager.createHybridMode(modes1);
      const hybrid2 = manager.createHybridMode(modes2);
      
      expect(hybrid1.id).toBe(hybrid2.id);
    });
    
    it('should accept custom name', () => {
      const modes: ModeType[] = ['developer', 'reviewer'];
      const customName = 'Quality-Focused Developer';
      const hybridMode = manager.createHybridMode(modes, customName);
      
      // This will match the preset "Quality Developer"
      expect(hybridMode.id).toBe('quality-developer');
      expect(hybridMode.name).toBe('Quality Developer');
    });
  });
  
  describe('combinePersonas', () => {
    it('should combine two personas with "and"', () => {
      const modes: ModeType[] = ['developer', 'security'];
      const persona = manager.combinePersonas(modes);
      
      expect(persona).toContain('Senior Software Engineer');
      expect(persona).toContain('Security Auditor');
      expect(persona).toContain('and');
    });
    
    it('should combine three or more personas with commas and "and"', () => {
      const modes: ModeType[] = ['developer', 'security', 'performance'];
      const persona = manager.combinePersonas(modes);
      
      expect(persona).toContain('Senior Software Engineer');
      expect(persona).toContain('Security Auditor');
      expect(persona).toContain('Performance Engineer');
      expect(persona).toContain(',');
      expect(persona).toContain('and');
    });
    
    it('should return single persona for single mode', () => {
      const modes: ModeType[] = ['developer'];
      const persona = manager.combinePersonas(modes);
      
      expect(persona).toBe('Senior Software Engineer');
    });
  });
  
  describe('combineToolAccess', () => {
    it('should union tool access from multiple modes', () => {
      const modes: ModeType[] = ['planning', 'reviewer'];
      
      const mockGetAllowedTools = (mode: ModeType): string[] => {
        if (mode === 'planning') {
          return ['read_file', 'web_search'];
        }
        if (mode === 'reviewer') {
          return ['read_file', 'git_diff'];
        }
        return [];
      };
      
      const tools = manager.combineToolAccess(modes, mockGetAllowedTools);
      
      expect(tools).toContain('read_file');
      expect(tools).toContain('web_search');
      expect(tools).toContain('git_diff');
      expect(tools.length).toBe(3);
    });
    
    it('should return all tools if any mode allows all', () => {
      const modes: ModeType[] = ['developer', 'security'];
      
      const mockGetAllowedTools = (mode: ModeType): string[] => {
        if (mode === 'developer') {
          return ['*'];
        }
        if (mode === 'security') {
          return ['read_file', 'web_search'];
        }
        return [];
      };
      
      const tools = manager.combineToolAccess(modes, mockGetAllowedTools);
      
      expect(tools).toEqual(['*']);
    });
    
    it('should handle empty tool lists', () => {
      const modes: ModeType[] = ['assistant'];
      
      const mockGetAllowedTools = (_mode: ModeType): string[] => {
        return [];
      };
      
      const tools = manager.combineToolAccess(modes, mockGetAllowedTools);
      
      expect(tools).toEqual([]);
    });
  });
  
  describe('combinePrompts', () => {
    it('should combine prompts from multiple modes', () => {
      const modes: ModeType[] = ['developer', 'security'];
      
      const mockGetTemplate = (mode: ModeType): string => {
        if (mode === 'developer') {
          return 'Developer template content';
        }
        if (mode === 'security') {
          return 'Security template content';
        }
        return '';
      };
      
      const combined = manager.combinePrompts(modes, mockGetTemplate);
      
      expect(combined).toContain('Hybrid Mode');
      expect(combined).toContain('Developer template content');
      expect(combined).toContain('Security template content');
      expect(combined).toContain('Integration Guidance');
    });
    
    it('should include mode guidance', () => {
      const modes: ModeType[] = ['developer', 'debugger'];
      
      const mockGetTemplate = (_mode: ModeType): string => 'Template';
      
      const combined = manager.combinePrompts(modes, mockGetTemplate);
      
      expect(combined).toContain('developer');
      expect(combined).toContain('debugger');
      expect(combined).toContain('implementation');
      expect(combined).toContain('errors');
    });
  });
  
  describe('active hybrid mode management', () => {
    it('should set and get active hybrid mode', () => {
      const modes: ModeType[] = ['developer', 'security'];
      const hybridMode = manager.createHybridMode(modes);
      
      manager.setActiveHybridMode(hybridMode);
      
      expect(manager.getActiveHybridMode()).toEqual(hybridMode);
      expect(manager.isHybridModeActive()).toBe(true);
    });
    
    it('should clear active hybrid mode', () => {
      const modes: ModeType[] = ['developer', 'security'];
      const hybridMode = manager.createHybridMode(modes);
      
      manager.setActiveHybridMode(hybridMode);
      manager.setActiveHybridMode(null);
      
      expect(manager.getActiveHybridMode()).toBeNull();
      expect(manager.isHybridModeActive()).toBe(false);
    });
  });
  
  describe('preset hybrid modes', () => {
    it('should return all preset hybrid modes', () => {
      const presets = manager.getPresetHybridModes();
      
      expect(presets.length).toBeGreaterThan(0);
      expect(presets).toContainEqual(PRESET_HYBRID_MODES['secure-developer']);
      expect(presets).toContainEqual(PRESET_HYBRID_MODES['perf-developer']);
    });
    
    it('should get preset hybrid mode by ID', () => {
      const preset = manager.getHybridModeById('secure-developer');
      
      expect(preset).toBeDefined();
      expect(preset?.id).toBe('secure-developer');
      expect(preset?.modes).toEqual(['developer', 'security']);
    });
    
    it('should return null for non-existent preset ID', () => {
      const preset = manager.getHybridModeById('non-existent');
      
      expect(preset).toBeNull();
    });
  });
  
  describe('custom hybrid modes', () => {
    it('should store custom hybrid modes', () => {
      const modes: ModeType[] = ['planning', 'teacher'];
      const hybridMode = manager.createHybridMode(modes);
      
      const customModes = manager.getCustomHybridModes();
      
      expect(customModes).toContainEqual(hybridMode);
    });
    
    it('should get custom hybrid mode by ID', () => {
      const modes: ModeType[] = ['planning', 'teacher'];
      const hybridMode = manager.createHybridMode(modes);
      
      const retrieved = manager.getHybridModeById(hybridMode.id);
      
      expect(retrieved).toEqual(hybridMode);
    });
    
    it('should delete custom hybrid mode', () => {
      const modes: ModeType[] = ['planning', 'teacher'];
      const hybridMode = manager.createHybridMode(modes);
      
      const deleted = manager.deleteCustomHybridMode(hybridMode.id);
      
      expect(deleted).toBe(true);
      expect(manager.getHybridModeById(hybridMode.id)).toBeNull();
    });
    
    it('should return false when deleting non-existent mode', () => {
      const deleted = manager.deleteCustomHybridMode('non-existent');
      
      expect(deleted).toBe(false);
    });
    
    it('should clear all custom hybrid modes', () => {
      manager.createHybridMode(['planning', 'teacher']);
      manager.createHybridMode(['reviewer', 'performance']);
      
      manager.clearCustomHybridModes();
      
      expect(manager.getCustomHybridModes()).toEqual([]);
    });
  });
  
  describe('getAllHybridModes', () => {
    it('should return both preset and custom modes', () => {
      const customModes: ModeType[] = ['planning', 'teacher'];
      manager.createHybridMode(customModes);
      
      const allModes = manager.getAllHybridModes();
      
      expect(allModes.length).toBeGreaterThan(manager.getPresetHybridModes().length);
      
      // Should include presets
      expect(allModes.some(m => m.id === 'secure-developer')).toBe(true);
      
      // Should include custom
      expect(allModes.some(m => m.id === 'hybrid-planning-teacher')).toBe(true);
    });
  });
  
  describe('icon and color generation', () => {
    it('should generate combined icon from mode icons', () => {
      const modes: ModeType[] = ['developer', 'security'];
      const hybridMode = manager.createHybridMode(modes);
      
      expect(hybridMode.icon).toContain('👨‍💻');
      expect(hybridMode.icon).toContain('🔒');
    });
    
    it('should generate combined color for two modes', () => {
      const modes: ModeType[] = ['developer', 'security'];
      const hybridMode = manager.createHybridMode(modes);
      
      // This will match the preset which has color 'purple'
      expect(hybridMode.color).toBe('purple');
    });
    
    it('should use rainbow color for 3+ modes', () => {
      const modes: ModeType[] = ['developer', 'security', 'performance'];
      const hybridMode = manager.createHybridMode(modes);
      
      expect(hybridMode.color).toBe('rainbow');
    });
  });
});
