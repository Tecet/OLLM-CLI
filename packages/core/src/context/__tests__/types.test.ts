/**
 * Context Management Types - Basic Tests
 * 
 * These tests verify that the type definitions are properly exported
 * and can be used in the codebase.
 */

import { describe, it, expect } from 'vitest';
import * as ContextTypes from '../types.js';

describe('Context Management Types', () => {
  it('should export GPUType enum', () => {
    expect(ContextTypes.GPUType).toBeDefined();
    expect(ContextTypes.GPUType.NVIDIA).toBe('nvidia');
    expect(ContextTypes.GPUType.AMD).toBe('amd');
    expect(ContextTypes.GPUType.APPLE_SILICON).toBe('apple');
    expect(ContextTypes.GPUType.CPU_ONLY).toBe('cpu');
  });

  it('should export MemoryLevel enum', () => {
    expect(ContextTypes.MemoryLevel).toBeDefined();
    expect(ContextTypes.MemoryLevel.NORMAL).toBe('normal');
    expect(ContextTypes.MemoryLevel.WARNING).toBe('warning');
    expect(ContextTypes.MemoryLevel.CRITICAL).toBe('critical');
    expect(ContextTypes.MemoryLevel.EMERGENCY).toBe('emergency');
  });

  it('should have valid KVQuantization types', () => {
    // Type test - these should compile without errors
    const f16: ContextTypes.KVQuantization = 'f16';
    const q8: ContextTypes.KVQuantization = 'q8_0';
    const q4: ContextTypes.KVQuantization = 'q4_0';
    
    expect(f16).toBe('f16');
    expect(q8).toBe('q8_0');
    expect(q4).toBe('q4_0');
  });

  it('should have valid CompressionStrategyType types', () => {
    // Type test - these should compile without errors
    const summarize: ContextTypes.CompressionStrategyType = 'summarize';
    const truncate: ContextTypes.CompressionStrategyType = 'truncate';
    const hybrid: ContextTypes.CompressionStrategyType = 'hybrid';
    
    expect(summarize).toBe('summarize');
    expect(truncate).toBe('truncate');
    expect(hybrid).toBe('hybrid');
  });
});
