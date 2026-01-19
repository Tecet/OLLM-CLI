/**
 * ServerDetails Component Tests
 * 
 * Tests for the ServerDetails component that displays detailed information
 * about a selected MCP server in the right column of the two-column layout.
 * 
 * Validates: Requirements 1.1-1.6, NFR-7
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ServerDetails } from '../ServerDetails.js';
import type { ExtendedMCPServerStatus } from '../../../contexts/MCPContext.js';

/**
 * Helper function to create a mock server
 */
function createMockServer(overrides: Partial<ExtendedMCPServerStatus> = {}): ExtendedMCPServerStatus {
  return {
    name: 'test-server',
    description: 'Test server description',
    status: 'connected',
    health: 'healthy',
    uptime: 3600000, // 1 hour
    error: undefined,
    tools: 5,
    toolsList: [],
    resources: 3,
    config: {
      command: 'test-command',
      args: [],
      disabled: false,
    },
    oauthStatus: undefined,
    ...overrides,
  };
}

describe('ServerDetails Component', () => {
  describe('No Server Selected', () => {
    it('should display placeholder text when server is undefined', () => {
      const { lastFrame } = render(
        <ServerDetails server={undefined} expanded={false} />
      );
      
      expect(lastFrame()).toContain('Select a server to view details');
    });
    
    it('should use dimmed color for placeholder text', () => {
      const { lastFrame } = render(
        <ServerDetails server={undefined} expanded={false} />
      );
      
      const output = lastFrame();
      expect(output).toContain('Select a server to view details');
    });
  });
  
  describe('Basic Server Information', () => {
    it('should display server name in bold', () => {
      const server = createMockServer({ name: 'my-server' });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      expect(lastFrame()).toContain('my-server');
    });
    
    it('should display server name in yellow when focused', () => {
      const server = createMockServer({ name: 'my-server' });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} focused={true} />
      );
      
      expect(lastFrame()).toContain('my-server');
    });
    
    it('should display server description', () => {
      const server = createMockServer({ description: 'Custom description' });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      expect(lastFrame()).toContain('Custom description');
    });
    
    it('should display default description when none provided', () => {
      const server = createMockServer({ description: undefined });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      expect(lastFrame()).toContain('No description available');
    });
  });
  
  describe('Status Display', () => {
    it('should display enabled status for enabled server', () => {
      const server = createMockServer({ config: { command: 'test', args: [], disabled: false } });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      expect(lastFrame()).toContain('● Enabled');
    });
    
    it('should display disabled status for disabled server', () => {
      const server = createMockServer({ config: { command: 'test', args: [], disabled: true } });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      expect(lastFrame()).toContain('○ Disabled');
    });
    
    it('should display health status', () => {
      const server = createMockServer({ health: 'healthy', status: 'connected' });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      expect(lastFrame()).toContain('healthy');
    });
  });
  
  describe('Health Status Icons and Colors', () => {
    it('should display healthy status with green color', () => {
      const server = createMockServer({ health: 'healthy', status: 'connected' });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      const output = lastFrame();
      expect(output).toContain('●');
      expect(output).toContain('healthy');
    });
    
    it('should display degraded status with yellow color', () => {
      const server = createMockServer({ health: 'degraded', status: 'connected' });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      const output = lastFrame();
      expect(output).toContain('●');
      expect(output).toContain('degraded');
    });
    
    it('should display unhealthy status with red color', () => {
      const server = createMockServer({ health: 'unhealthy', status: 'error' });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      const output = lastFrame();
      expect(output).toContain('✗');
      expect(output).toContain('unhealthy');
    });
    
    it('should display stopped status when disconnected', () => {
      const server = createMockServer({ status: 'disconnected' });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      const output = lastFrame();
      expect(output).toContain('○');
      expect(output).toContain('stopped');
    });
    
    it('should display connecting status when starting', () => {
      const server = createMockServer({ status: 'starting' });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      const output = lastFrame();
      expect(output).toContain('⟳');
      expect(output).toContain('connecting');
    });
  });
  
  describe('Expanded Details', () => {
    it('should not display statistics when not expanded', () => {
      const server = createMockServer({ tools: 5, resources: 3 });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      const output = lastFrame();
      expect(output).not.toContain('Tools: 5');
      expect(output).not.toContain('Resources: 3');
    });
    
    it('should display tools count when expanded', () => {
      const server = createMockServer({ tools: 5 });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      expect(lastFrame()).toContain('Tools: 5');
    });
    
    it('should display resources count when expanded', () => {
      const server = createMockServer({ resources: 3 });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      expect(lastFrame()).toContain('Resources: 3');
    });
    
    it('should display uptime when expanded and uptime > 0', () => {
      const server = createMockServer({ uptime: 3600000 }); // 1 hour
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      const output = lastFrame();
      expect(output).toContain('Uptime:');
      expect(output).toContain('1h');
    });
    
    it('should not display uptime when uptime is 0', () => {
      const server = createMockServer({ uptime: 0 });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      expect(lastFrame()).not.toContain('Uptime:');
    });
    
    it('should not display uptime when uptime is undefined', () => {
      const server = createMockServer({ uptime: undefined });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      expect(lastFrame()).not.toContain('Uptime:');
    });
    
    it('should use toolsList length if available', () => {
      const server = createMockServer({ 
        tools: 5,
        toolsList: [
          { name: 'tool1', description: 'Tool 1', inputSchema: {}, autoApproved: false },
          { name: 'tool2', description: 'Tool 2', inputSchema: {}, autoApproved: false },
        ]
      });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      expect(lastFrame()).toContain('Tools: 2');
    });
  });
  
  describe('OAuth Status', () => {
    it('should not display OAuth status when not expanded', () => {
      const server = createMockServer({
        config: {
          command: 'test',
          args: [],
          disabled: false,
          oauth: {
            provider: 'github',
            clientId: 'test-client-id',
            scopes: ['read'],
          },
        },
      });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      expect(lastFrame()).not.toContain('OAuth:');
    });
    
    it('should display OAuth status when expanded and OAuth configured', () => {
      const server = createMockServer({
        config: {
          command: 'test',
          args: [],
          disabled: false,
          oauth: {
            provider: 'github',
            clientId: 'test-client-id',
            scopes: ['read'],
          },
        },
      });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      expect(lastFrame()).toContain('OAuth:');
    });
    
    it('should display "Not configured" when OAuth not configured', () => {
      const server = createMockServer({
        config: {
          command: 'test',
          args: [],
          disabled: false,
        },
      });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      // OAuth section should not be displayed at all when not configured
      expect(lastFrame()).not.toContain('OAuth:');
    });
    
    it('should display "Connected" when OAuth is connected', () => {
      const server = createMockServer({
        config: {
          command: 'test',
          args: [],
          disabled: false,
          oauth: {
            provider: 'github',
            clientId: 'test-client-id',
            scopes: ['read'],
          },
        },
        oauthStatus: {
          connected: true,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      expect(lastFrame()).toContain('OAuth: Connected');
    });
    
    it('should display "Not connected" when OAuth is not connected', () => {
      const server = createMockServer({
        config: {
          command: 'test',
          args: [],
          disabled: false,
          oauth: {
            provider: 'github',
            clientId: 'test-client-id',
            scopes: ['read'],
          },
        },
        oauthStatus: {
          connected: false,
        },
      });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      expect(lastFrame()).toContain('OAuth: Not connected');
    });
  });
  
  describe('Error and Warning Messages', () => {
    it('should not display error messages when not expanded', () => {
      const server = createMockServer({
        health: 'unhealthy',
        error: 'Connection failed',
      });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      expect(lastFrame()).not.toContain('Connection failed');
    });
    
    it('should display error message when expanded and error exists', () => {
      const server = createMockServer({
        health: 'unhealthy',
        status: 'error',
        error: 'Connection failed',
      });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      const output = lastFrame();
      expect(output).toContain('Error:');
      expect(output).toContain('Connection failed');
    });
    
    it('should display warning message for degraded health', () => {
      const server = createMockServer({
        health: 'degraded',
        status: 'connected',
        error: 'Slow response time',
      });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      const output = lastFrame();
      expect(output).toContain('Warning:');
      expect(output).toContain('Slow response time');
    });
    
    it('should not display error section when no error exists', () => {
      const server = createMockServer({
        health: 'healthy',
        error: undefined,
      });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      expect(lastFrame()).not.toContain('Error:');
      expect(lastFrame()).not.toContain('Warning:');
    });
  });
  
  describe('Action Shortcuts', () => {
    it('should not display action shortcuts when not expanded', () => {
      const server = createMockServer();
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      expect(lastFrame()).not.toContain('[V] View Tools');
    });
    
    it('should display all action shortcuts when expanded', () => {
      const server = createMockServer();
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      const output = lastFrame();
      expect(output).toContain('[V] View Tools');
      expect(output).toContain('[C] Configure');
      expect(output).toContain('[R] Restart');
      expect(output).toContain('[L] Logs');
      expect(output).toContain('[U] Uninstall');
    });
  });
  
  describe('Uptime Formatting', () => {
    it('should format uptime in seconds', () => {
      const server = createMockServer({ uptime: 30000 }); // 30 seconds
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      expect(lastFrame()).toContain('30s');
    });
    
    it('should format uptime in minutes and seconds', () => {
      const server = createMockServer({ uptime: 150000 }); // 2 minutes 30 seconds
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      const output = lastFrame();
      expect(output).toContain('2m');
      expect(output).toContain('30s');
    });
    
    it('should format uptime in hours and minutes', () => {
      const server = createMockServer({ uptime: 7200000 }); // 2 hours
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      const output = lastFrame();
      expect(output).toContain('2h');
      expect(output).toContain('0m');
    });
    
    it('should format uptime in days and hours', () => {
      const server = createMockServer({ uptime: 90000000 }); // 25 hours
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      const output = lastFrame();
      expect(output).toContain('1d');
      expect(output).toContain('1h');
    });
  });
  
  describe('Integration with Two-Column Layout', () => {
    it('should render correctly when server is undefined (Exit item selected)', () => {
      const { lastFrame } = render(
        <ServerDetails server={undefined} expanded={false} />
      );
      
      expect(lastFrame()).toContain('Select a server to view details');
    });
    
    it('should render correctly when server is selected but not expanded', () => {
      const server = createMockServer({ name: 'test-server' });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={false} />
      );
      
      const output = lastFrame();
      expect(output).toContain('test-server');
      expect(output).not.toContain('[V] View Tools');
    });
    
    it('should render correctly when server is selected and expanded', () => {
      const server = createMockServer({ name: 'test-server', tools: 5 });
      const { lastFrame } = render(
        <ServerDetails server={server} expanded={true} />
      );
      
      const output = lastFrame();
      expect(output).toContain('test-server');
      expect(output).toContain('Tools: 5');
      expect(output).toContain('[V] View Tools');
    });
  });
});
