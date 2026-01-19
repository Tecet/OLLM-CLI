/**
 * Tests for UICallbacksContext
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { UICallbacksProvider, useUICallbacks, type UICallbacks } from '../UICallbacksContext.js';

// Test component that uses the hook
function TestComponent({ onMount }: { onMount?: (callbacks: UICallbacks) => void }) {
  const callbacks = useUICallbacks();
  
  React.useEffect(() => {
    if (onMount) {
      onMount(callbacks);
    }
  }, [callbacks, onMount]);
  
  return <Text>Test</Text>;
}

describe('UICallbacksContext', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn<Console, 'warn'>>;
  
  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });
  
  describe('Default Callbacks', () => {
    it('should provide default callbacks when no provider is used', () => {
      let capturedCallbacks: UICallbacks | undefined;
      
      render(
        <TestComponent onMount={(cb) => { capturedCallbacks = cb; }} />
      );
      
      expect(capturedCallbacks).toBeDefined();
      expect(capturedCallbacks?.promptUser).toBeInstanceOf(Function);
      expect(capturedCallbacks?.addSystemMessage).toBeInstanceOf(Function);
      expect(capturedCallbacks?.clearContext).toBeInstanceOf(Function);
      expect(capturedCallbacks?.openModelMenu).toBeInstanceOf(Function);
    });
    
    it('should return last option when promptUser is called without provider', async () => {
      let capturedCallbacks: UICallbacks | undefined;
      
      render(
        <TestComponent onMount={(cb) => { capturedCallbacks = cb; }} />
      );
      
      const result = await capturedCallbacks!.promptUser('Test?', ['Yes', 'No', 'Cancel']);
      
      expect(result).toBe('Cancel'); // Last option
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[UICallbacks] promptUser called but no callback registered:',
        'Test?'
      );
    });
    
    it('should log warning when addSystemMessage is called without provider', () => {
      let capturedCallbacks: UICallbacks | undefined;
      
      render(
        <TestComponent onMount={(cb) => { capturedCallbacks = cb; }} />
      );
      
      capturedCallbacks!.addSystemMessage('Test message');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[UICallbacks] addSystemMessage called but no callback registered:',
        'Test message'
      );
    });
    
    it('should log warning when clearContext is called without provider', () => {
      let capturedCallbacks: UICallbacks | undefined;
      
      render(
        <TestComponent onMount={(cb) => { capturedCallbacks = cb; }} />
      );
      
      capturedCallbacks!.clearContext();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[UICallbacks] clearContext called but no callback registered'
      );
    });
    
    it('should log warning when openModelMenu is called without provider', () => {
      let capturedCallbacks: UICallbacks | undefined;
      
      render(
        <TestComponent onMount={(cb) => { capturedCallbacks = cb; }} />
      );
      
      capturedCallbacks!.openModelMenu();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[UICallbacks] openModelMenu called but no callback registered'
      );
    });
  });
  
  describe('Custom Callbacks', () => {
    it('should provide custom callbacks when provider is used', () => {
      const mockCallbacks: UICallbacks = {
        promptUser: vi.fn().mockResolvedValue('Yes'),
        addSystemMessage: vi.fn(),
        clearContext: vi.fn(),
        openModelMenu: vi.fn(),
      };
      
      let capturedCallbacks: UICallbacks | undefined;
      
      render(
        <UICallbacksProvider callbacks={mockCallbacks}>
          <TestComponent onMount={(cb) => { capturedCallbacks = cb; }} />
        </UICallbacksProvider>
      );
      
      expect(capturedCallbacks).toBe(mockCallbacks);
    });
    
    it('should call custom promptUser callback', async () => {
      const mockPromptUser = vi.fn().mockResolvedValue('Yes');
      const mockCallbacks: UICallbacks = {
        promptUser: mockPromptUser,
        addSystemMessage: vi.fn(),
        clearContext: vi.fn(),
        openModelMenu: vi.fn(),
      };
      
      let capturedCallbacks: UICallbacks | undefined;
      
      render(
        <UICallbacksProvider callbacks={mockCallbacks}>
          <TestComponent onMount={(cb) => { capturedCallbacks = cb; }} />
        </UICallbacksProvider>
      );
      
      const result = await capturedCallbacks!.promptUser('Test?', ['Yes', 'No']);
      
      expect(result).toBe('Yes');
      expect(mockPromptUser).toHaveBeenCalledWith('Test?', ['Yes', 'No']);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
    
    it('should call custom addSystemMessage callback', () => {
      const mockAddSystemMessage = vi.fn();
      const mockCallbacks: UICallbacks = {
        promptUser: vi.fn().mockResolvedValue('Yes'),
        addSystemMessage: mockAddSystemMessage,
        clearContext: vi.fn(),
        openModelMenu: vi.fn(),
      };
      
      let capturedCallbacks: UICallbacks | undefined;
      
      render(
        <UICallbacksProvider callbacks={mockCallbacks}>
          <TestComponent onMount={(cb) => { capturedCallbacks = cb; }} />
        </UICallbacksProvider>
      );
      
      capturedCallbacks!.addSystemMessage('Test message');
      
      expect(mockAddSystemMessage).toHaveBeenCalledWith('Test message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
    
    it('should call custom clearContext callback', () => {
      const mockClearContext = vi.fn();
      const mockCallbacks: UICallbacks = {
        promptUser: vi.fn().mockResolvedValue('Yes'),
        addSystemMessage: vi.fn(),
        clearContext: mockClearContext,
        openModelMenu: vi.fn(),
      };
      
      let capturedCallbacks: UICallbacks | undefined;
      
      render(
        <UICallbacksProvider callbacks={mockCallbacks}>
          <TestComponent onMount={(cb) => { capturedCallbacks = cb; }} />
        </UICallbacksProvider>
      );
      
      capturedCallbacks!.clearContext();
      
      expect(mockClearContext).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
    
    it('should call custom openModelMenu callback', () => {
      const mockOpenModelMenu = vi.fn();
      const mockCallbacks: UICallbacks = {
        promptUser: vi.fn().mockResolvedValue('Yes'),
        addSystemMessage: vi.fn(),
        clearContext: vi.fn(),
        openModelMenu: mockOpenModelMenu,
      };
      
      let capturedCallbacks: UICallbacks | undefined;
      
      render(
        <UICallbacksProvider callbacks={mockCallbacks}>
          <TestComponent onMount={(cb) => { capturedCallbacks = cb; }} />
        </UICallbacksProvider>
      );
      
      capturedCallbacks!.openModelMenu();
      
      expect(mockOpenModelMenu).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('Nested Providers', () => {
    it('should use innermost provider callbacks', () => {
      const outerCallbacks: UICallbacks = {
        promptUser: vi.fn().mockResolvedValue('Outer'),
        addSystemMessage: vi.fn(),
        clearContext: vi.fn(),
        openModelMenu: vi.fn(),
      };
      
      const innerCallbacks: UICallbacks = {
        promptUser: vi.fn().mockResolvedValue('Inner'),
        addSystemMessage: vi.fn(),
        clearContext: vi.fn(),
        openModelMenu: vi.fn(),
      };
      
      let capturedCallbacks: UICallbacks | undefined;
      
      render(
        <UICallbacksProvider callbacks={outerCallbacks}>
          <UICallbacksProvider callbacks={innerCallbacks}>
            <TestComponent onMount={(cb) => { capturedCallbacks = cb; }} />
          </UICallbacksProvider>
        </UICallbacksProvider>
      );
      
      expect(capturedCallbacks).toBe(innerCallbacks);
    });
  });
  
  describe('Multiple Components', () => {
    it('should provide same callbacks to multiple components', () => {
      const mockCallbacks: UICallbacks = {
        promptUser: vi.fn().mockResolvedValue('Yes'),
        addSystemMessage: vi.fn(),
        clearContext: vi.fn(),
        openModelMenu: vi.fn(),
      };
      
      let callbacks1: UICallbacks | undefined;
      let callbacks2: UICallbacks | undefined;
      
      render(
        <UICallbacksProvider callbacks={mockCallbacks}>
          <TestComponent onMount={(cb) => { callbacks1 = cb; }} />
          <TestComponent onMount={(cb) => { callbacks2 = cb; }} />
        </UICallbacksProvider>
      );
      
      expect(callbacks1).toBe(mockCallbacks);
      expect(callbacks2).toBe(mockCallbacks);
      expect(callbacks1).toBe(callbacks2);
    });
  });
});
