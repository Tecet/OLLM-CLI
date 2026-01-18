/**
 * Tests for Mode Shortcuts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  assistCommand,
  planCommand,
  devCommand,
  protoCommand,
  teachCommand,
  debugCommand,
  secureCommand,
  reviewCommand,
  perfCommand,
  MODE_SHORTCUTS,
  MODE_ACTION_SHORTCUTS,
} from '../modeShortcuts.js';

// Mock the global context manager
const mockSwitchMode = vi.fn();
const mockContextManager = {
  switchMode: mockSwitchMode,
  getModeManager: vi.fn(() => ({
    getCurrentMode: vi.fn(() => 'assistant'),
    isAutoSwitchEnabled: vi.fn(() => true),
  })),
};

vi.mock('../../features/context/ContextManagerContext.js', () => ({
  getGlobalContextManager: () => mockContextManager,
}));

describe('Mode Shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MODE_SHORTCUTS mapping', () => {
    it('should define all mode switching shortcuts', () => {
      expect(MODE_SHORTCUTS).toEqual({
        '/assist': 'assistant',
        '/plan': 'planning',
        '/dev': 'developer',
        '/proto': 'prototype',
        '/teach': 'teacher',
      });
    });
  });

  describe('MODE_ACTION_SHORTCUTS mapping', () => {
    it('should define debug action shortcuts', () => {
      expect(MODE_ACTION_SHORTCUTS.debug).toHaveProperty('trace');
      expect(MODE_ACTION_SHORTCUTS.debug).toHaveProperty('reproduce');
      expect(MODE_ACTION_SHORTCUTS.debug).toHaveProperty('bisect');
    });

    it('should define security action shortcuts', () => {
      expect(MODE_ACTION_SHORTCUTS.secure).toHaveProperty('scan');
      expect(MODE_ACTION_SHORTCUTS.secure).toHaveProperty('audit');
      expect(MODE_ACTION_SHORTCUTS.secure).toHaveProperty('cve');
    });

    it('should define review action shortcuts', () => {
      expect(MODE_ACTION_SHORTCUTS.review).toHaveProperty('checklist');
      expect(MODE_ACTION_SHORTCUTS.review).toHaveProperty('diff');
      expect(MODE_ACTION_SHORTCUTS.review).toHaveProperty('quality');
    });

    it('should define performance action shortcuts', () => {
      expect(MODE_ACTION_SHORTCUTS.perf).toHaveProperty('profile');
      expect(MODE_ACTION_SHORTCUTS.perf).toHaveProperty('benchmark');
      expect(MODE_ACTION_SHORTCUTS.perf).toHaveProperty('analyze');
    });
  });

  describe('/assist command', () => {
    it('should switch to assistant mode', async () => {
      const result = await assistCommand.handler([]);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('assistant');
      expect(result.success).toBe(true);
      expect(result.message).toContain('assistant mode');
    });

    it('should have correct metadata', () => {
      expect(assistCommand.name).toBe('/assist');
      expect(assistCommand.aliases).toContain('/a');
      expect(assistCommand.description).toContain('assistant mode');
    });
  });

  describe('/plan command', () => {
    it('should switch to planning mode', async () => {
      const result = await planCommand.handler([]);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('planning');
      expect(result.success).toBe(true);
      expect(result.message).toContain('planning mode');
    });

    it('should have correct metadata', () => {
      expect(planCommand.name).toBe('/plan');
      expect(planCommand.aliases).toContain('/p');
      expect(planCommand.description).toContain('planning mode');
    });
  });

  describe('/dev command', () => {
    it('should switch to developer mode', async () => {
      const result = await devCommand.handler([]);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('developer');
      expect(result.success).toBe(true);
      expect(result.message).toContain('developer mode');
    });

    it('should have correct metadata', () => {
      expect(devCommand.name).toBe('/dev');
      expect(devCommand.aliases).toContain('/d');
      expect(devCommand.description).toContain('developer mode');
    });
  });

  describe('/proto command', () => {
    it('should switch to prototype mode', async () => {
      const result = await protoCommand.handler([]);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('prototype');
      expect(result.success).toBe(true);
      expect(result.message).toContain('prototype mode');
    });

    it('should have correct metadata', () => {
      expect(protoCommand.name).toBe('/proto');
      expect(protoCommand.description).toContain('prototype mode');
    });
  });

  describe('/teach command', () => {
    it('should switch to teacher mode', async () => {
      const result = await teachCommand.handler([]);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('teacher');
      expect(result.success).toBe(true);
      expect(result.message).toContain('teacher mode');
    });

    it('should have correct metadata', () => {
      expect(teachCommand.name).toBe('/teach');
      expect(teachCommand.description).toContain('teacher mode');
    });
  });

  describe('/debug command', () => {
    it('should switch to debugger mode with no args', async () => {
      const result = await debugCommand.handler([]);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('debugger');
      expect(result.success).toBe(true);
      expect(result.message).toContain('debugger mode');
      expect(result.message).toContain('trace');
      expect(result.message).toContain('reproduce');
      expect(result.message).toContain('bisect');
    });

    it('should handle trace subcommand', async () => {
      const result = await debugCommand.handler(['trace']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('debugger');
      expect(result.success).toBe(true);
      expect(result.message).toContain('trace');
      expect(result.data).toEqual({
        mode: 'debugger',
        action: 'trace',
        instruction: MODE_ACTION_SHORTCUTS.debug.trace,
      });
    });

    it('should handle reproduce subcommand', async () => {
      const result = await debugCommand.handler(['reproduce']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('debugger');
      expect(result.success).toBe(true);
      expect(result.message).toContain('reproduce');
      expect(result.data).toEqual({
        mode: 'debugger',
        action: 'reproduce',
        instruction: MODE_ACTION_SHORTCUTS.debug.reproduce,
      });
    });

    it('should handle bisect subcommand', async () => {
      const result = await debugCommand.handler(['bisect']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('debugger');
      expect(result.success).toBe(true);
      expect(result.message).toContain('bisect');
      expect(result.data).toEqual({
        mode: 'debugger',
        action: 'bisect',
        instruction: MODE_ACTION_SHORTCUTS.debug.bisect,
      });
    });

    it('should handle unknown subcommand', async () => {
      const result = await debugCommand.handler(['unknown']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('debugger');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown debug command');
    });

    it('should have correct metadata', () => {
      expect(debugCommand.name).toBe('/debug');
      expect(debugCommand.description).toContain('Debugger mode');
    });
  });

  describe('/secure command', () => {
    it('should switch to security mode with no args', async () => {
      const result = await secureCommand.handler([]);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('security');
      expect(result.success).toBe(true);
      expect(result.message).toContain('security mode');
      expect(result.message).toContain('scan');
      expect(result.message).toContain('audit');
      expect(result.message).toContain('cve');
    });

    it('should handle scan subcommand', async () => {
      const result = await secureCommand.handler(['scan']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('security');
      expect(result.success).toBe(true);
      expect(result.message).toContain('scan');
      expect(result.data).toEqual({
        mode: 'security',
        action: 'scan',
        instruction: MODE_ACTION_SHORTCUTS.secure.scan,
      });
    });

    it('should handle audit subcommand', async () => {
      const result = await secureCommand.handler(['audit']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('security');
      expect(result.success).toBe(true);
      expect(result.message).toContain('audit');
      expect(result.data).toEqual({
        mode: 'security',
        action: 'audit',
        instruction: MODE_ACTION_SHORTCUTS.secure.audit,
      });
    });

    it('should handle cve subcommand', async () => {
      const result = await secureCommand.handler(['cve']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('security');
      expect(result.success).toBe(true);
      expect(result.message).toContain('cve');
      expect(result.data).toEqual({
        mode: 'security',
        action: 'cve',
        instruction: MODE_ACTION_SHORTCUTS.secure.cve,
      });
    });

    it('should handle unknown subcommand', async () => {
      const result = await secureCommand.handler(['unknown']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('security');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown security command');
    });

    it('should have correct metadata', () => {
      expect(secureCommand.name).toBe('/secure');
      expect(secureCommand.description).toContain('Security mode');
    });
  });

  describe('/review command', () => {
    it('should switch to reviewer mode with no args', async () => {
      const result = await reviewCommand.handler([]);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('reviewer');
      expect(result.success).toBe(true);
      expect(result.message).toContain('reviewer mode');
      expect(result.message).toContain('checklist');
      expect(result.message).toContain('diff');
      expect(result.message).toContain('quality');
    });

    it('should handle checklist subcommand', async () => {
      const result = await reviewCommand.handler(['checklist']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('reviewer');
      expect(result.success).toBe(true);
      expect(result.message).toContain('checklist');
      expect(result.data).toEqual({
        mode: 'reviewer',
        action: 'checklist',
        instruction: MODE_ACTION_SHORTCUTS.review.checklist,
      });
    });

    it('should handle diff subcommand', async () => {
      const result = await reviewCommand.handler(['diff']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('reviewer');
      expect(result.success).toBe(true);
      expect(result.message).toContain('diff');
      expect(result.data).toEqual({
        mode: 'reviewer',
        action: 'diff',
        instruction: MODE_ACTION_SHORTCUTS.review.diff,
      });
    });

    it('should handle quality subcommand', async () => {
      const result = await reviewCommand.handler(['quality']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('reviewer');
      expect(result.success).toBe(true);
      expect(result.message).toContain('quality');
      expect(result.data).toEqual({
        mode: 'reviewer',
        action: 'quality',
        instruction: MODE_ACTION_SHORTCUTS.review.quality,
      });
    });

    it('should handle unknown subcommand', async () => {
      const result = await reviewCommand.handler(['unknown']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('reviewer');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown review command');
    });

    it('should have correct metadata', () => {
      expect(reviewCommand.name).toBe('/review');
      expect(reviewCommand.description).toContain('Reviewer mode');
    });
  });

  describe('/perf command', () => {
    it('should switch to performance mode with no args', async () => {
      const result = await perfCommand.handler([]);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('performance');
      expect(result.success).toBe(true);
      expect(result.message).toContain('performance mode');
      expect(result.message).toContain('profile');
      expect(result.message).toContain('benchmark');
      expect(result.message).toContain('analyze');
    });

    it('should handle profile subcommand', async () => {
      const result = await perfCommand.handler(['profile']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('performance');
      expect(result.success).toBe(true);
      expect(result.message).toContain('profile');
      expect(result.data).toEqual({
        mode: 'performance',
        action: 'profile',
        instruction: MODE_ACTION_SHORTCUTS.perf.profile,
      });
    });

    it('should handle benchmark subcommand', async () => {
      const result = await perfCommand.handler(['benchmark']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('performance');
      expect(result.success).toBe(true);
      expect(result.message).toContain('benchmark');
      expect(result.data).toEqual({
        mode: 'performance',
        action: 'benchmark',
        instruction: MODE_ACTION_SHORTCUTS.perf.benchmark,
      });
    });

    it('should handle analyze subcommand', async () => {
      const result = await perfCommand.handler(['analyze']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('performance');
      expect(result.success).toBe(true);
      expect(result.message).toContain('analyze');
      expect(result.data).toEqual({
        mode: 'performance',
        action: 'analyze',
        instruction: MODE_ACTION_SHORTCUTS.perf.analyze,
      });
    });

    it('should handle unknown subcommand', async () => {
      const result = await perfCommand.handler(['unknown']);
      
      expect(mockSwitchMode).toHaveBeenCalledWith('performance');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown performance command');
    });

    it('should have correct metadata', () => {
      expect(perfCommand.name).toBe('/perf');
      expect(perfCommand.description).toContain('Performance mode');
    });
  });

  describe('Error handling', () => {
    it('should handle context manager not available', async () => {
      // Temporarily mock getGlobalContextManager to return null
      const originalMock = vi.mocked(await import('../../features/context/ContextManagerContext.js')).getGlobalContextManager;
      vi.mocked(await import('../../features/context/ContextManagerContext.js')).getGlobalContextManager = vi.fn(() => null);
      
      const result = await assistCommand.handler([]);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Context Manager is not initialized');
      
      // Restore original mock
      vi.mocked(await import('../../features/context/ContextManagerContext.js')).getGlobalContextManager = originalMock;
    });
  });

  describe('Command aliases', () => {
    it('should have short aliases for common commands', () => {
      expect(assistCommand.aliases).toContain('/a');
      expect(planCommand.aliases).toContain('/p');
      expect(devCommand.aliases).toContain('/d');
    });
  });

  describe('Command descriptions', () => {
    it('should have clear descriptions for all commands', () => {
      const commands = [
        assistCommand,
        planCommand,
        devCommand,
        protoCommand,
        teachCommand,
        debugCommand,
        secureCommand,
        reviewCommand,
        perfCommand,
      ];

      for (const command of commands) {
        expect(command.description).toBeTruthy();
        expect(command.description.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Command usage strings', () => {
    it('should have usage strings for all commands', () => {
      const commands = [
        assistCommand,
        planCommand,
        devCommand,
        protoCommand,
        teachCommand,
        debugCommand,
        secureCommand,
        reviewCommand,
        perfCommand,
      ];

      for (const command of commands) {
        expect(command.usage).toBeTruthy();
        expect(command.usage).toContain(command.name);
      }
    });
  });
});
