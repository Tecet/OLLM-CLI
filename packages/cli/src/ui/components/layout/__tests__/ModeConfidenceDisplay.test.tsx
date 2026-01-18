/**
 * Tests for ModeConfidenceDisplay component
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ModeConfidenceDisplay } from '../ModeConfidenceDisplay.js';
import type { ModeType } from '@ollm/ollm-cli-core';

describe('ModeConfidenceDisplay', () => {
  it('should render current mode with icon and confidence', () => {
    const { lastFrame } = render(
      <ModeConfidenceDisplay
        currentMode="developer"
        currentModeIcon="👨‍💻"
        currentModeConfidence={0.85}
        modeDuration={60000} // 1 minute
        suggestedModes={[]}
      />
    );

    const output = lastFrame();
    
    // Should show current mode
    expect(output).toContain('Current Mode');
    expect(output).toContain('👨‍💻');
    expect(output).toContain('Developer');
    
    // Should show confidence
    expect(output).toContain('Confidence:');
    expect(output).toContain('85%');
    
    // Should show duration
    expect(output).toContain('Duration:');
    expect(output).toContain('1m');
  });

  it('should render confidence bar correctly', () => {
    const { lastFrame } = render(
      <ModeConfidenceDisplay
        currentMode="developer"
        currentModeIcon="👨‍💻"
        currentModeConfidence={0.5}
        modeDuration={0}
        suggestedModes={[]}
      />
    );

    const output = lastFrame();
    
    // Should show confidence bar (50% = 5 filled, 5 empty)
    expect(output).toContain('█████░░░░░');
  });

  it('should render suggested modes when provided', () => {
    const suggestedModes = [
      {
        mode: 'debugger' as ModeType,
        icon: '🐛',
        confidence: 0.72,
        reason: 'Multiple errors detected'
      },
      {
        mode: 'planning' as ModeType,
        icon: '📋',
        confidence: 0.45,
        reason: 'Consider planning first'
      }
    ];

    const { lastFrame } = render(
      <ModeConfidenceDisplay
        currentMode="developer"
        currentModeIcon="👨‍💻"
        currentModeConfidence={0.85}
        modeDuration={0}
        suggestedModes={suggestedModes}
      />
    );

    const output = lastFrame();
    
    // Should show suggested modes section
    expect(output).toContain('Suggested Modes');
    
    // Should show first suggestion
    expect(output).toContain('🐛');
    expect(output).toContain('Debugger');
    expect(output).toContain('72%');
    expect(output).toContain('Multiple errors detected');
    
    // Should show second suggestion
    expect(output).toContain('📋');
    expect(output).toContain('Planning');
    expect(output).toContain('45%');
    expect(output).toContain('Consider planning first');
  });

  it('should not render suggested modes section when empty', () => {
    const { lastFrame } = render(
      <ModeConfidenceDisplay
        currentMode="developer"
        currentModeIcon="👨‍💻"
        currentModeConfidence={0.85}
        modeDuration={0}
        suggestedModes={[]}
      />
    );

    const output = lastFrame();
    
    // Should not show suggested modes section
    expect(output).not.toContain('Suggested Modes');
  });

  it('should format duration correctly for seconds', () => {
    const { lastFrame } = render(
      <ModeConfidenceDisplay
        currentMode="developer"
        currentModeIcon="👨‍💻"
        currentModeConfidence={0.85}
        modeDuration={30000} // 30 seconds
        suggestedModes={[]}
      />
    );

    const output = lastFrame();
    expect(output).toContain('30s');
  });

  it('should format duration correctly for minutes', () => {
    const { lastFrame } = render(
      <ModeConfidenceDisplay
        currentMode="developer"
        currentModeIcon="👨‍💻"
        currentModeConfidence={0.85}
        modeDuration={150000} // 2 minutes 30 seconds
        suggestedModes={[]}
      />
    );

    const output = lastFrame();
    expect(output).toContain('2m 30s');
  });

  it('should format duration correctly for hours', () => {
    const { lastFrame } = render(
      <ModeConfidenceDisplay
        currentMode="developer"
        currentModeIcon="👨‍💻"
        currentModeConfidence={0.85}
        modeDuration={3900000} // 1 hour 5 minutes
        suggestedModes={[]}
      />
    );

    const output = lastFrame();
    expect(output).toContain('1h 5m');
  });

  it('should render full confidence bar for 100%', () => {
    const { lastFrame } = render(
      <ModeConfidenceDisplay
        currentMode="developer"
        currentModeIcon="👨‍💻"
        currentModeConfidence={1.0}
        modeDuration={0}
        suggestedModes={[]}
      />
    );

    const output = lastFrame();
    
    // Should show full confidence bar
    expect(output).toContain('██████████');
    expect(output).toContain('100%');
  });

  it('should render empty confidence bar for 0%', () => {
    const { lastFrame } = render(
      <ModeConfidenceDisplay
        currentMode="developer"
        currentModeIcon="👨‍💻"
        currentModeConfidence={0.0}
        modeDuration={0}
        suggestedModes={[]}
      />
    );

    const output = lastFrame();
    
    // Should show empty confidence bar
    expect(output).toContain('░░░░░░░░░░');
    expect(output).toContain('0%');
  });

  it('should capitalize mode names correctly', () => {
    const modes: ModeType[] = ['assistant', 'planning', 'developer', 'debugger'];
    
    modes.forEach(mode => {
      const { lastFrame } = render(
        <ModeConfidenceDisplay
          currentMode={mode}
          currentModeIcon="💬"
          currentModeConfidence={0.5}
          modeDuration={0}
          suggestedModes={[]}
        />
      );

      const output = lastFrame();
      const capitalized = mode.charAt(0).toUpperCase() + mode.slice(1);
      expect(output).toContain(capitalized);
    });
  });

  it('should render multiple suggested modes correctly', () => {
    const suggestedModes = [
      {
        mode: 'debugger' as ModeType,
        icon: '🐛',
        confidence: 0.72,
        reason: 'Error detected'
      },
      {
        mode: 'security' as ModeType,
        icon: '🔒',
        confidence: 0.65,
        reason: 'Security check needed'
      },
      {
        mode: 'planning' as ModeType,
        icon: '📋',
        confidence: 0.45,
        reason: 'Planning suggested'
      }
    ];

    const { lastFrame } = render(
      <ModeConfidenceDisplay
        currentMode="developer"
        currentModeIcon="👨‍💻"
        currentModeConfidence={0.85}
        modeDuration={0}
        suggestedModes={suggestedModes}
      />
    );

    const output = lastFrame();
    
    // Should show all three suggestions
    expect(output).toContain('Debugger');
    expect(output).toContain('Security');
    expect(output).toContain('Planning');
    
    // Should show all reasons
    expect(output).toContain('Error detected');
    expect(output).toContain('Security check needed');
    expect(output).toContain('Planning suggested');
  });
});
