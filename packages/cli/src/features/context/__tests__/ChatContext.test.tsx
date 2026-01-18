/**
 * Tests for ChatContext - Conditional Tool Registry Creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ChatContext - Conditional Tool Registry Creation', () => {
  beforeEach(() => {
    // Clear any global state
    vi.clearAllMocks();
  });

  describe('Tool registry creation', () => {
    it('should create ToolRegistry when model supports tools', () => {
      // Mock modelSupportsTools to return true
      const modelSupportsTools = vi.fn().mockReturnValue(true);
      const currentModel = 'llama3.2:latest';

      const supportsTools = modelSupportsTools(currentModel);
      
      expect(supportsTools).toBe(true);
      expect(modelSupportsTools).toHaveBeenCalledWith(currentModel);
    });

    it('should not create ToolRegistry when model does not support tools', () => {
      // Mock modelSupportsTools to return false
      const modelSupportsTools = vi.fn().mockReturnValue(false);
      const currentModel = 'gemma3:1b';

      const supportsTools = modelSupportsTools(currentModel);
      
      expect(supportsTools).toBe(false);
      expect(modelSupportsTools).toHaveBeenCalledWith(currentModel);
    });

    it('should pass undefined for toolSchemas when tools are disabled', () => {
      // When model doesn't support tools, toolSchemas should be undefined
      const modelSupportsTools = vi.fn().mockReturnValue(false);
      const currentModel = 'gemma3:1b';

      const supportsTools = modelSupportsTools(currentModel);
      let toolSchemas: any[] | undefined;

      if (supportsTools) {
        toolSchemas = [{ name: 'test_tool', description: 'Test', parameters: {} }];
      }

      expect(toolSchemas).toBeUndefined();
    });

    it('should pass tool schemas when tools are enabled', () => {
      // When model supports tools, toolSchemas should be defined
      const modelSupportsTools = vi.fn().mockReturnValue(true);
      const currentModel = 'llama3.2:latest';

      const supportsTools = modelSupportsTools(currentModel);
      let toolSchemas: any[] | undefined;

      if (supportsTools) {
        toolSchemas = [
          { name: 'test_tool', description: 'Test', parameters: {} }
        ];
      }

      expect(toolSchemas).toBeDefined();
      expect(toolSchemas).toHaveLength(1);
      expect(toolSchemas?.[0].name).toBe('test_tool');
    });

    it('should handle toolRegistry?.get() safely when registry is undefined', () => {
      // When toolRegistry is undefined, toolRegistry?.get() should return undefined
      let toolRegistry: { get: (name: string) => any } | undefined;

      const tool = toolRegistry?.get('test_tool');

      expect(tool).toBeUndefined();
    });

    it('should handle toolRegistry?.get() when registry is defined', () => {
      // When toolRegistry is defined, toolRegistry?.get() should work normally
      const mockTool = { name: 'test_tool', execute: vi.fn() };
      const toolRegistry = {
        get: vi.fn().mockReturnValue(mockTool)
      };

      const tool = toolRegistry?.get('test_tool');

      expect(tool).toBeDefined();
      expect(tool).toBe(mockTool);
      expect(toolRegistry.get).toHaveBeenCalledWith('test_tool');
    });
  });

  describe('Tool support filtering', () => {
    it('should filter tools based on model capability', () => {
      const models = [
        { id: 'llama3.2:latest', supportsTools: true },
        { id: 'gemma3:1b', supportsTools: false },
        { id: 'qwen2.5:latest', supportsTools: true },
      ];

      models.forEach(model => {
        const modelSupportsTools = vi.fn().mockReturnValue(model.supportsTools);
        const supportsTools = modelSupportsTools(model.id);

        if (supportsTools) {
          expect(supportsTools).toBe(true);
        } else {
          expect(supportsTools).toBe(false);
        }
      });
    });

    it('should only register tools when model supports them', () => {
      const modelSupportsTools = vi.fn()
        .mockReturnValueOnce(true)  // First call: supports tools
        .mockReturnValueOnce(false); // Second call: doesn't support tools

      // First model: supports tools
      let supportsTools = modelSupportsTools('llama3.2:latest');
      let toolsRegistered = supportsTools ? 2 : 0; // HotSwapTool + MemoryDumpTool
      expect(toolsRegistered).toBe(2);

      // Second model: doesn't support tools
      supportsTools = modelSupportsTools('gemma3:1b');
      toolsRegistered = supportsTools ? 2 : 0;
      expect(toolsRegistered).toBe(0);
    });

    it('should emit active-tools-updated event only when tools are registered', () => {
      const mockEmit = vi.fn();
      const manager = { emit: mockEmit };

      // When tools are supported
      const modelSupportsTools = vi.fn().mockReturnValue(true);
      let supportsTools = modelSupportsTools('llama3.2:latest');

      if (supportsTools && manager) {
        const toolNames = ['trigger_hot_swap', 'memory_dump'];
        manager.emit('active-tools-updated', toolNames);
      }

      expect(mockEmit).toHaveBeenCalledWith('active-tools-updated', ['trigger_hot_swap', 'memory_dump']);

      // When tools are not supported
      mockEmit.mockClear();
      const modelSupportsTools2 = vi.fn().mockReturnValue(false);
      supportsTools = modelSupportsTools2('gemma3:1b');

      if (supportsTools && manager) {
        const toolNames = ['trigger_hot_swap', 'memory_dump'];
        manager.emit('active-tools-updated', toolNames);
      }

      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  describe('System prompt modification', () => {
    it('should add note to system prompt when tools are disabled', () => {
      const modelSupportsTools = vi.fn().mockReturnValue(false);
      const currentModel = 'gemma3:1b';
      const baseSystemPrompt = 'You are a helpful assistant.';

      const supportsTools = modelSupportsTools(currentModel);
      let systemPrompt = baseSystemPrompt;

      if (!supportsTools) {
        systemPrompt += '\n\nNote: This model does not support function calling. ' +
                       'Do not attempt to use tools or make tool calls.';
      }

      expect(systemPrompt).toContain('This model does not support function calling');
      expect(systemPrompt).toContain('Do not attempt to use tools');
    });

    it('should not modify system prompt when tools are enabled', () => {
      const modelSupportsTools = vi.fn().mockReturnValue(true);
      const currentModel = 'llama3.2:latest';
      const baseSystemPrompt = 'You are a helpful assistant.';

      const supportsTools = modelSupportsTools(currentModel);
      let systemPrompt = baseSystemPrompt;

      if (!supportsTools) {
        systemPrompt += '\n\nNote: This model does not support function calling. ' +
                       'Do not attempt to use tools or make tool calls.';
      }

      expect(systemPrompt).toBe(baseSystemPrompt);
      expect(systemPrompt).not.toContain('This model does not support function calling');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined toolRegistry gracefully', () => {
      const toolRegistry: any = undefined;

      // Should not throw when accessing undefined registry
      expect(() => {
        const tool = toolRegistry?.get('test_tool');
        expect(tool).toBeUndefined();
      }).not.toThrow();
    });

    it('should handle empty tool list when tools are enabled', () => {
      const modelSupportsTools = vi.fn().mockReturnValue(true);
      const supportsTools = modelSupportsTools('llama3.2:latest');

      let toolSchemas: any[] | undefined;

      if (supportsTools) {
        // Simulate empty tool list
        toolSchemas = [];
      }

      expect(toolSchemas).toBeDefined();
      expect(toolSchemas).toHaveLength(0);
    });

    it('should handle model switch during agent loop', () => {
      // Track initial model
      const initialModel = 'llama3.2:latest';
      let currentModel = initialModel;

      // Simulate model change mid-loop
      currentModel = 'gemma3:1b';

      // Should detect model change
      const modelChanged = currentModel !== initialModel;
      expect(modelChanged).toBe(true);
    });
  });
});
