/**
 * Tests for Prompt Mode Manager
 * 
 * Tests mode state tracking, transitions, tool filtering, prompt building,
 * hysteresis, cooldown, and event emission.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptModeManager, type ModeTransition } from '../PromptModeManager.js';
import { ContextAnalyzer, type ContextAnalysis, type ModeType } from '../ContextAnalyzer.js';
import { PromptRegistry } from '../PromptRegistry.js';
import { SystemPromptBuilder } from '../../context/SystemPromptBuilder.js';

describe('PromptModeManager', () => {
  let manager: PromptModeManager;
  let promptRegistry: PromptRegistry;
  let promptBuilder: SystemPromptBuilder;
  let contextAnalyzer: ContextAnalyzer;

  beforeEach(() => {
    promptRegistry = new PromptRegistry();
    promptBuilder = new SystemPromptBuilder(promptRegistry);
    contextAnalyzer = new ContextAnalyzer();
    manager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
  });

  describe('Mode State Tracking', () => {
    it('should initialize with assistant mode', () => {
      expect(manager.getCurrentMode()).toBe('assistant');
    });

    it('should track current mode', () => {
      manager.switchMode('developer', 'manual', 1.0);
      expect(manager.getCurrentMode()).toBe('developer');
    });

    it('should track previous mode', () => {
      manager.switchMode('developer', 'manual', 1.0);
      expect(manager.getPreviousMode()).toBe('assistant');
      
      manager.switchMode('planning', 'manual', 1.0);
      expect(manager.getPreviousMode()).toBe('developer');
    });

    it('should track auto-switch enabled state', () => {
      expect(manager.isAutoSwitchEnabled()).toBe(true);
      
      manager.setAutoSwitch(false);
      expect(manager.isAutoSwitchEnabled()).toBe(false);
      
      manager.setAutoSwitch(true);
      expect(manager.isAutoSwitchEnabled()).toBe(true);
    });

    it('should track active skills', () => {
      expect(manager.getActiveSkills()).toEqual([]);
      
      manager.updateSkills(['skill1', 'skill2']);
      expect(manager.getActiveSkills()).toEqual(['skill1', 'skill2']);
    });
  });

  describe('Mode Transitions', () => {
    it('should switch modes', () => {
      manager.switchMode('developer', 'manual', 1.0);
      expect(manager.getCurrentMode()).toBe('developer');
    });

    it('should record mode transitions', () => {
      manager.switchMode('developer', 'manual', 1.0);
      
      const history = manager.getModeHistory();
      expect(history.length).toBe(1);
      expect(history[0].from).toBe('assistant');
      expect(history[0].to).toBe('developer');
      expect(history[0].trigger).toBe('manual');
      expect(history[0].confidence).toBe(1.0);
    });

    it('should emit mode-changed event', () => {
      const callback = vi.fn();
      manager.onModeChange(callback);
      
      manager.switchMode('developer', 'manual', 1.0);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'assistant',
          to: 'developer',
          trigger: 'manual',
          confidence: 1.0
        })
      );
    });

    it('should support multiple mode change listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      manager.onModeChange(callback1);
      manager.onModeChange(callback2);
      
      manager.switchMode('developer', 'manual', 1.0);
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should remove mode change listeners', () => {
      const callback = vi.fn();
      
      manager.onModeChange(callback);
      manager.offModeChange(callback);
      
      manager.switchMode('developer', 'manual', 1.0);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should force mode and disable auto-switch', () => {
      expect(manager.isAutoSwitchEnabled()).toBe(true);
      
      manager.forceMode('developer');
      
      expect(manager.getCurrentMode()).toBe('developer');
      expect(manager.isAutoSwitchEnabled()).toBe(false);
    });
  });

  describe('Mode History', () => {
    it('should maintain mode history', () => {
      manager.switchMode('planning', 'manual', 1.0);
      manager.switchMode('developer', 'auto', 0.8);
      manager.switchMode('debugger', 'auto', 0.9);
      
      const history = manager.getModeHistory();
      expect(history.length).toBe(3);
      expect(history[0].to).toBe('planning');
      expect(history[1].to).toBe('developer');
      expect(history[2].to).toBe('debugger');
    });

    it('should limit history to 100 transitions', () => {
      // Add 150 transitions
      for (let i = 0; i < 150; i++) {
        const mode: ModeType = i % 2 === 0 ? 'developer' : 'planning';
        manager.switchMode(mode, 'manual', 1.0);
      }
      
      const history = manager.getModeHistory();
      expect(history.length).toBe(100);
    });

    it('should get recent history', () => {
      manager.switchMode('planning', 'manual', 1.0);
      manager.switchMode('developer', 'auto', 0.8);
      manager.switchMode('debugger', 'auto', 0.9);
      
      const recent = manager.getRecentHistory(2);
      expect(recent.length).toBe(2);
      expect(recent[0].to).toBe('developer');
      expect(recent[1].to).toBe('debugger');
    });

    it('should return all history if count exceeds history size', () => {
      manager.switchMode('planning', 'manual', 1.0);
      manager.switchMode('developer', 'auto', 0.8);
      
      const recent = manager.getRecentHistory(10);
      expect(recent.length).toBe(2);
    });
  });

  describe('Mode Transition Logic', () => {
    it('should not switch if auto-switch is disabled', () => {
      manager.setAutoSwitch(false);
      
      const analysis: ContextAnalysis = {
        mode: 'developer',
        confidence: 0.9,
        triggers: ['implement'],
        metadata: {
          keywords: ['implement'],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: false
        }
      };
      
      const shouldSwitch = manager.shouldSwitchMode('assistant', analysis);
      expect(shouldSwitch).toBe(false);
    });

    it('should not switch to the same mode', () => {
      const analysis: ContextAnalysis = {
        mode: 'assistant',
        confidence: 0.9,
        triggers: [],
        metadata: {
          keywords: [],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: false
        }
      };
      
      const shouldSwitch = manager.shouldSwitchMode('assistant', analysis);
      expect(shouldSwitch).toBe(false);
    });

    it('should not switch if confidence is below threshold', () => {
      const analysis: ContextAnalysis = {
        mode: 'developer',
        confidence: 0.5,  // Below default threshold of 0.7
        triggers: ['implement'],
        metadata: {
          keywords: ['implement'],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: false
        }
      };
      
      const shouldSwitch = manager.shouldSwitchMode('assistant', analysis);
      expect(shouldSwitch).toBe(false);
    });

    it('should switch if confidence exceeds threshold', () => {
      const analysis: ContextAnalysis = {
        mode: 'developer',
        confidence: 0.85,
        triggers: ['implement'],
        metadata: {
          keywords: ['implement'],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: false
        }
      };
      
      // Wait for hysteresis and cooldown
      vi.useFakeTimers();
      manager.switchMode('assistant', 'manual', 1.0);
      vi.advanceTimersByTime(35000); // 35 seconds
      
      const shouldSwitch = manager.shouldSwitchMode('assistant', analysis);
      expect(shouldSwitch).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('Hysteresis (Minimum Duration)', () => {
    it('should not switch before minimum duration (30s)', () => {
      vi.useFakeTimers();
      
      manager.switchMode('assistant', 'manual', 1.0);
      
      const analysis: ContextAnalysis = {
        mode: 'developer',
        confidence: 0.9,
        triggers: ['implement'],
        metadata: {
          keywords: ['implement'],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: false
        }
      };
      
      // Try to switch after 20 seconds (before minimum)
      vi.advanceTimersByTime(20000);
      expect(manager.shouldSwitchMode('assistant', analysis)).toBe(false);
      
      // Try to switch after 30 seconds (at minimum)
      vi.advanceTimersByTime(10000);
      expect(manager.shouldSwitchMode('assistant', analysis)).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('Cooldown Period', () => {
    it('should not switch during cooldown period (10s)', () => {
      vi.useFakeTimers();
      
      // First switch
      manager.switchMode('developer', 'manual', 1.0);
      vi.advanceTimersByTime(35000); // Wait for hysteresis
      
      // Second switch
      manager.switchMode('planning', 'manual', 1.0);
      
      const analysis: ContextAnalysis = {
        mode: 'developer',
        confidence: 0.9,
        triggers: ['implement'],
        metadata: {
          keywords: ['implement'],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: false
        }
      };
      
      // Try to switch after 5 seconds (during cooldown)
      vi.advanceTimersByTime(5000);
      expect(manager.shouldSwitchMode('planning', analysis)).toBe(false);
      
      // Try to switch after 10 seconds (cooldown passed, but still need hysteresis)
      vi.advanceTimersByTime(5000);
      expect(manager.shouldSwitchMode('planning', analysis)).toBe(false);
      
      // Try to switch after 30 seconds total (hysteresis passed)
      vi.advanceTimersByTime(20000);
      expect(manager.shouldSwitchMode('planning', analysis)).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('Tool Filtering', () => {
    const mockTools = [
      { name: 'read_file' },
      { name: 'write_file' },
      { name: 'grep_search' },
      { name: 'execute_pwsh' },
      { name: 'git_commit' },
      { name: 'git_diff' },
      { name: 'web_search' }
    ];

    it('should allow no tools in assistant mode', () => {
      const filtered = manager.filterToolsForMode(mockTools, 'assistant');
      expect(filtered.length).toBe(0);
    });

    it('should allow only read-only tools in planning mode', () => {
      const filtered = manager.filterToolsForMode(mockTools, 'planning');
      
      expect(filtered.some(t => t.name === 'read_file')).toBe(true);
      expect(filtered.some(t => t.name === 'grep_search')).toBe(true);
      expect(filtered.some(t => t.name === 'web_search')).toBe(true);
      expect(filtered.some(t => t.name === 'write_file')).toBe(false);
      expect(filtered.some(t => t.name === 'execute_pwsh')).toBe(false);
    });

    it('should allow all tools in developer mode', () => {
      const filtered = manager.filterToolsForMode(mockTools, 'developer');
      expect(filtered.length).toBe(mockTools.length);
    });

    it('should allow all tools in tool mode', () => {
      const filtered = manager.filterToolsForMode(mockTools, 'tool');
      expect(filtered.length).toBe(mockTools.length);
    });

    it('should filter tools for debugger mode', () => {
      const filtered = manager.filterToolsForMode(mockTools, 'debugger');
      
      expect(filtered.some(t => t.name === 'read_file')).toBe(true);
      expect(filtered.some(t => t.name === 'write_file')).toBe(true);
      expect(filtered.some(t => t.name === 'git_diff')).toBe(true);
      expect(filtered.some(t => t.name === 'git_commit')).toBe(false);
    });

    it('should filter tools for reviewer mode', () => {
      const filtered = manager.filterToolsForMode(mockTools, 'reviewer');
      
      expect(filtered.some(t => t.name === 'read_file')).toBe(true);
      expect(filtered.some(t => t.name === 'git_diff')).toBe(true);
      expect(filtered.some(t => t.name === 'write_file')).toBe(false);
      expect(filtered.some(t => t.name === 'git_commit')).toBe(false);
    });

    it('should handle wildcard patterns', () => {
      const gitTools = [
        { name: 'git_commit' },
        { name: 'git_diff' },
        { name: 'git_log' },
        { name: 'git_status' }
      ];
      
      // Debugger mode allows git_diff and git_log but not git_commit
      const filtered = manager.filterToolsForMode(gitTools, 'debugger');
      
      expect(filtered.some(t => t.name === 'git_diff')).toBe(true);
      expect(filtered.some(t => t.name === 'git_log')).toBe(true);
      expect(filtered.some(t => t.name === 'git_commit')).toBe(false);
    });
  });

  describe('Tool Allowed Check', () => {
    it('should check if tool is allowed in mode', () => {
      expect(manager.isToolAllowed('read_file', 'planning')).toBe(true);
      expect(manager.isToolAllowed('write_file', 'planning')).toBe(false);
      expect(manager.isToolAllowed('write_file', 'developer')).toBe(true);
    });

    it('should allow all tools in developer mode', () => {
      expect(manager.isToolAllowed('any_tool', 'developer')).toBe(true);
      expect(manager.isToolAllowed('another_tool', 'developer')).toBe(true);
    });

    it('should handle wildcard patterns in tool check', () => {
      expect(manager.isToolAllowed('git_diff', 'debugger')).toBe(true);
      expect(manager.isToolAllowed('git_log', 'debugger')).toBe(true);
      expect(manager.isToolAllowed('git_commit', 'debugger')).toBe(false);
    });
  });

  describe('Get Allowed Tools', () => {
    it('should return empty array for assistant mode', () => {
      const allowed = manager.getAllowedTools('assistant');
      expect(allowed).toEqual([]);
    });

    it('should return read-only tools for planning mode', () => {
      const allowed = manager.getAllowedTools('planning');
      
      expect(allowed).toContain('read_file');
      expect(allowed).toContain('grep_search');
      expect(allowed).toContain('web_search');
      expect(allowed).not.toContain('write_file');
    });

    it('should return wildcard for developer mode', () => {
      const allowed = manager.getAllowedTools('developer');
      expect(allowed).toEqual(['*']);
    });

    it('should return specific tools for specialized modes', () => {
      const debuggerTools = manager.getAllowedTools('debugger');
      expect(debuggerTools).toContain('read_file');
      expect(debuggerTools).toContain('write_file');
      expect(debuggerTools).toContain('git_diff');
    });
  });

  describe('Get Denied Tools', () => {
    it('should return wildcard for assistant mode', () => {
      const denied = manager.getDeniedTools('assistant');
      expect(denied).toEqual(['*']);
    });

    it('should return write tools for planning mode', () => {
      const denied = manager.getDeniedTools('planning');
      
      expect(denied).toContain('write_file');
      expect(denied).toContain('execute_pwsh');
      expect(denied).toContain('git_*');
    });

    it('should return empty array for developer mode', () => {
      const denied = manager.getDeniedTools('developer');
      expect(denied).toEqual([]);
    });

    it('should return specific denied tools for specialized modes', () => {
      const debuggerDenied = manager.getDeniedTools('debugger');
      expect(debuggerDenied).toContain('delete_file');
      expect(debuggerDenied).toContain('git_commit');
    });
  });

  describe('Prompt Building', () => {
    it('should build prompt for mode', () => {
      const prompt = manager.buildPrompt({
        mode: 'developer',
        tools: [{ name: 'read_file' }, { name: 'write_file' }],
        skills: [],
        workspace: { path: '/test/workspace' }
      });
      
      expect(prompt).toContain('Mode: Developer');
      expect(prompt).toContain('Available Tools');
      expect(prompt).toContain('read_file');
      expect(prompt).toContain('write_file');
      expect(prompt).toContain('Workspace Context');
      expect(prompt).toContain('/test/workspace');
    });

    it('should include skills in prompt', () => {
      // Register a test skill
      promptRegistry.register({
        id: 'test-skill',
        name: 'Test Skill',
        content: 'This is a test skill',
        source: 'static',
        tags: ['skill']
      });
      
      const prompt = manager.buildPrompt({
        mode: 'developer',
        tools: [],
        skills: ['test-skill']
      });
      
      expect(prompt).toContain('Active Skills');
      expect(prompt).toContain('This is a test skill');
    });

    it('should include workspace context in prompt', () => {
      const prompt = manager.buildPrompt({
        mode: 'developer',
        tools: [],
        workspace: {
          path: '/test/workspace',
          files: ['file1.ts', 'file2.ts']
        }
      });
      
      expect(prompt).toContain('Workspace Context');
      expect(prompt).toContain('/test/workspace');
      expect(prompt).toContain('2 files');
    });

    it('should include additional instructions in prompt', () => {
      const prompt = manager.buildPrompt({
        mode: 'developer',
        tools: [],
        additionalInstructions: 'Use TypeScript strict mode'
      });
      
      expect(prompt).toContain('Additional Instructions');
      expect(prompt).toContain('Use TypeScript strict mode');
    });

    it('should filter tools based on mode', () => {
      const prompt = manager.buildPrompt({
        mode: 'planning',
        tools: [
          { name: 'read_file' },
          { name: 'write_file' },
          { name: 'grep_search' }
        ]
      });
      
      expect(prompt).toContain('read_file');
      expect(prompt).toContain('grep_search');
      expect(prompt).not.toContain('write_file');
    });

    it('should build different prompts for different modes', () => {
      const assistantPrompt = manager.buildPrompt({
        mode: 'assistant',
        tools: []
      });
      
      const developerPrompt = manager.buildPrompt({
        mode: 'developer',
        tools: []
      });
      
      expect(assistantPrompt).toContain('Assistant');
      expect(developerPrompt).toContain('Developer');
      expect(assistantPrompt).not.toEqual(developerPrompt);
    });
  });

  describe('Confidence Thresholds', () => {
    it('should use higher threshold for specialized modes', () => {
      vi.useFakeTimers();
      
      manager.switchMode('assistant', 'manual', 1.0);
      vi.advanceTimersByTime(35000);
      
      // Debugger requires 0.85 confidence
      const debuggerAnalysis: ContextAnalysis = {
        mode: 'debugger',
        confidence: 0.80,
        triggers: ['debug'],
        metadata: {
          keywords: ['debug'],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: false
        }
      };
      
      expect(manager.shouldSwitchMode('assistant', debuggerAnalysis)).toBe(false);
      
      debuggerAnalysis.confidence = 0.90;
      expect(manager.shouldSwitchMode('assistant', debuggerAnalysis)).toBe(true);
      
      vi.useRealTimers();
    });

    it('should use lower threshold for stepping back', () => {
      vi.useFakeTimers();
      
      manager.switchMode('developer', 'manual', 1.0);
      vi.advanceTimersByTime(35000);
      
      // Developer -> Planning requires only 0.6 confidence
      const planningAnalysis: ContextAnalysis = {
        mode: 'planning',
        confidence: 0.65,
        triggers: ['plan'],
        metadata: {
          keywords: ['plan'],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: false
        }
      };
      
      expect(manager.shouldSwitchMode('developer', planningAnalysis)).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tools array', () => {
      const prompt = manager.buildPrompt({
        mode: 'developer',
        tools: []
      });
      
      expect(prompt).toBeDefined();
      expect(prompt).not.toContain('Available Tools');
    });

    it('should handle undefined workspace', () => {
      const prompt = manager.buildPrompt({
        mode: 'developer',
        tools: []
      });
      
      expect(prompt).toBeDefined();
      expect(prompt).not.toContain('Workspace Context');
    });

    it('should handle undefined skills', () => {
      const prompt = manager.buildPrompt({
        mode: 'developer',
        tools: []
      });
      
      expect(prompt).toBeDefined();
      expect(prompt).not.toContain('Active Skills');
    });

    it('should handle rapid mode switches', () => {
      manager.switchMode('planning', 'manual', 1.0);
      manager.switchMode('developer', 'manual', 1.0);
      manager.switchMode('debugger', 'manual', 1.0);
      
      expect(manager.getCurrentMode()).toBe('debugger');
      expect(manager.getModeHistory().length).toBe(3);
    });

    it('should handle switching to all mode types', () => {
      const modes: ModeType[] = [
        'assistant', 'planning', 'developer', 'tool',
        'debugger', 'security', 'reviewer', 'performance'
      ];
      
      for (const mode of modes) {
        manager.switchMode(mode, 'manual', 1.0);
        expect(manager.getCurrentMode()).toBe(mode);
      }
    });
  });
});
