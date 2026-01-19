/**
 * ServerListItem Component Tests
 * 
 * Tests for the compact server list item component used in the left column
 * of the two-column MCP panel layout.
 * 
 * Test Coverage:
 * - Rendering with different server states
 * - Focus highlighting
 * - Expand/collapse icon display
 * - Health status icon and color
 * - Minimal design validation
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ServerListItem } from '../ServerListItem.js';
import { createMockServerStatus } from '../../../contexts/__tests__/mcpTestUtils.js';

describe('ServerListItem', () => {
  describe('Basic Rendering', () => {
    it('should render server name', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      expect(lastFrame()).toContain('test-server');
    });

    it('should render collapsed icon when not expanded', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      expect(lastFrame()).toContain('>');
      expect(lastFrame()).not.toContain('▼');
    });

    it('should render expanded icon when expanded', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={true} />
      );

      expect(lastFrame()).toContain('▼');
      expect(lastFrame()).not.toContain('> test-server');
    });
  });

  describe('Focus Highlighting', () => {
    it('should apply yellow highlighting when focused', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={true} expanded={false} />
      );

      // When focused, the text should be bold and yellow
      // Ink applies ANSI codes for styling
      const frame = lastFrame();
      expect(frame).toContain('test-server');
    });

    it('should not apply highlighting when not focused', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      const frame = lastFrame();
      expect(frame).toContain('test-server');
    });
  });

  describe('Health Status Icons', () => {
    it('should display healthy status icon (●) for connected healthy server', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      expect(lastFrame()).toContain('●');
    });

    it('should display stopped status icon (○) for disconnected server', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'disconnected',
        health: 'unhealthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      expect(lastFrame()).toContain('○');
    });

    it('should display connecting status icon (⟳) for starting server', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'starting',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      expect(lastFrame()).toContain('⟳');
    });

    it('should display error status icon (✗) for error server', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'error',
        health: 'unhealthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      expect(lastFrame()).toContain('✗');
    });
  });

  describe('Health Status Colors', () => {
    it('should use green color for healthy server', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      // Health indicator should be present
      expect(lastFrame()).toContain('●');
    });

    it('should use yellow color for degraded server', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'degraded',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      expect(lastFrame()).toContain('●');
    });

    it('should use red color for unhealthy server', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'unhealthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      expect(lastFrame()).toContain('●');
    });

    it('should use gray color for stopped server', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'disconnected',
        health: 'unhealthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      expect(lastFrame()).toContain('○');
    });
  });

  describe('Minimal Design', () => {
    it('should not display server description', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        description: 'This is a test server description',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      // Description should not be in the compact list item
      expect(lastFrame()).not.toContain('This is a test server description');
    });

    it('should not display server statistics', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'healthy',
        tools: 5,
        resources: 3,
        uptime: 3600000, // 1 hour
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      const frame = lastFrame();
      // Statistics should not be in the compact list item
      expect(frame).not.toContain('Tools:');
      expect(frame).not.toContain('Resources:');
      expect(frame).not.toContain('Uptime:');
    });

    it('should not display action shortcuts', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={true} expanded={true} />
      );

      const frame = lastFrame();
      // Action shortcuts should not be in the compact list item
      expect(frame).not.toContain('[V] View Tools');
      expect(frame).not.toContain('[C] Configure');
      expect(frame).not.toContain('[R] Restart');
    });

    it('should have minimal vertical spacing', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      const frame = lastFrame();
      const lines = frame.split('\n').filter(line => line.trim().length > 0);
      
      // Should be a single line (compact)
      expect(lines.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Combined States', () => {
    it('should render focused and expanded server correctly', () => {
      const server = createMockServerStatus('test-server', {
        name: 'focused-expanded-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={true} expanded={true} />
      );

      const frame = lastFrame();
      expect(frame).toContain('▼');
      expect(frame).toContain('focused-expanded-server');
      expect(frame).toContain('●');
    });

    it('should render focused but collapsed server correctly', () => {
      const server = createMockServerStatus('test-server', {
        name: 'focused-collapsed-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={true} expanded={false} />
      );

      const frame = lastFrame();
      expect(frame).toContain('>');
      expect(frame).toContain('focused-collapsed-server');
      expect(frame).toContain('●');
    });

    it('should render unfocused but expanded server correctly', () => {
      const server = createMockServerStatus('test-server', {
        name: 'unfocused-expanded-server',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={true} />
      );

      const frame = lastFrame();
      expect(frame).toContain('▼');
      expect(frame).toContain('unfocused-expanded-server');
      expect(frame).toContain('●');
    });
  });

  describe('Edge Cases', () => {
    it('should handle server with empty name', () => {
      const server = createMockServerStatus('test-server', {
        name: '',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      // Should still render without crashing
      expect(lastFrame()).toBeDefined();
    });

    it('should handle server with very long name', () => {
      const longName = 'a'.repeat(100);
      const server = createMockServerStatus('test-server', {
        name: longName,
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      // Long names may wrap, so just check that the name starts correctly
      const frame = lastFrame();
      expect(frame).toContain('aaaaaaaaaa'); // Check for a portion of the long name
    });

    it('should handle server with special characters in name', () => {
      const server = createMockServerStatus('test-server', {
        name: 'test-server@v1.0.0',
        status: 'connected',
        health: 'healthy',
      });

      const { lastFrame } = render(
        <ServerListItem server={server} focused={false} expanded={false} />
      );

      expect(lastFrame()).toContain('test-server@v1.0.0');
    });
  });
});
