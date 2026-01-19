/**
 * MarketplacePreview Component Tests
 * 
 * Tests the MarketplacePreview component functionality including:
 * - Rendering top 3 servers
 * - Displaying server details (name, description, rating, install count)
 * - OAuth requirement indicators
 * - Marketplace hint message
 * - Empty state handling
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { MarketplacePreview } from '../MarketplacePreview.js';
import type { MCPMarketplaceServer } from '../../../../services/mcpMarketplace.js';

describe('MarketplacePreview', () => {
  const mockServers: MCPMarketplaceServer[] = [
    {
      id: 'filesystem',
      name: 'filesystem',
      description: 'Secure file system operations',
      rating: 5.0,
      installCount: 10000,
      requiresOAuth: false,
      requirements: ['Node.js 18+'],
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      category: 'File System',
    },
    {
      id: 'github',
      name: 'github',
      description: 'GitHub API integration',
      rating: 4.8,
      installCount: 8500,
      requiresOAuth: true,
      requirements: ['Node.js 18+', 'GitHub Token'],
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      category: 'Development',
    },
    {
      id: 'postgres',
      name: 'postgres',
      description: 'PostgreSQL database integration',
      rating: 4.7,
      installCount: 7200,
      requiresOAuth: false,
      requirements: ['Node.js 18+'],
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      category: 'Database',
    },
    {
      id: 'slack',
      name: 'slack',
      description: 'Slack workspace integration',
      rating: 4.6,
      installCount: 6800,
      requiresOAuth: true,
      requirements: ['Node.js 18+'],
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      category: 'Communication',
    },
  ];

  it('should render section header', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers} />);
    
    expect(lastFrame()).toContain('Marketplace Preview');
  });

  it('should display only top 3 servers', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers} />);
    const output = lastFrame();
    
    // Should show first 3 servers
    expect(output).toContain('filesystem');
    expect(output).toContain('github');
    expect(output).toContain('postgres');
    
    // Should NOT show 4th server
    expect(output).not.toContain('slack');
  });

  it('should display server names', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers} />);
    const output = lastFrame();
    
    expect(output).toContain('filesystem');
    expect(output).toContain('github');
    expect(output).toContain('postgres');
  });

  it('should display server descriptions', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers} />);
    const output = lastFrame();
    
    expect(output).toContain('Secure file system operations');
    expect(output).toContain('GitHub API integration');
    expect(output).toContain('PostgreSQL database integration');
  });

  it('should display star ratings', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers} />);
    const output = lastFrame();
    
    // Should show stars for ratings
    expect(output).toContain('★★★★★'); // 5.0 rating
    expect(output).toContain('★★★★'); // 4.8 and 4.7 ratings
  });

  it('should display numeric ratings', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers} />);
    const output = lastFrame();
    
    expect(output).toContain('(5.0)');
    expect(output).toContain('(4.8)');
    expect(output).toContain('(4.7)');
  });

  it('should display formatted install counts', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers} />);
    const output = lastFrame();
    
    expect(output).toContain('10K installs');
    expect(output).toContain('8.5K installs');
    expect(output).toContain('7.2K installs');
  });

  it('should show OAuth requirement indicator for OAuth servers', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers} />);
    const output = lastFrame();
    
    // GitHub requires OAuth
    const lines = output.split('\n');
    const githubLine = lines.find(line => line.includes('github'));
    expect(githubLine).toContain('[OAuth Required]');
  });

  it('should not show OAuth indicator for non-OAuth servers', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers} />);
    const output = lastFrame();
    
    // Filesystem does not require OAuth
    const lines = output.split('\n');
    const filesystemSection = lines.slice(
      lines.findIndex(line => line.includes('filesystem')),
      lines.findIndex(line => line.includes('github'))
    ).join('\n');
    
    expect(filesystemSection).not.toContain('[OAuth Required]');
  });

  it('should display marketplace hint', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers} />);
    const output = lastFrame();
    
    expect(output).toContain('Press');
    expect(output).toContain('M');
    expect(output).toContain('for full marketplace');
  });

  it('should handle empty server list', () => {
    const { lastFrame } = render(<MarketplacePreview servers={[]} />);
    const output = lastFrame();
    
    expect(output).toContain('No marketplace servers available');
    expect(output).toContain('Press');
    expect(output).toContain('M');
  });

  it('should handle less than 3 servers', () => {
    const twoServers = mockServers.slice(0, 2);
    const { lastFrame } = render(<MarketplacePreview servers={twoServers} />);
    const output = lastFrame();
    
    expect(output).toContain('filesystem');
    expect(output).toContain('github');
    expect(output).not.toContain('postgres');
  });

  it('should apply focus styling when focused', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers} focused={true} />);
    const output = lastFrame();
    
    // Header should be present (focus styling is applied via color which we can't easily test)
    expect(output).toContain('Marketplace Preview');
  });

  it('should format half-star ratings correctly', () => {
    const serversWithHalfStar: MCPMarketplaceServer[] = [
      {
        id: 'test',
        name: 'test-server',
        description: 'Test server',
        rating: 4.5,
        installCount: 1000,
        requiresOAuth: false,
        requirements: [],
        command: 'test',
      },
    ];

    const { lastFrame } = render(<MarketplacePreview servers={serversWithHalfStar} />);
    const output = lastFrame();
    
    expect(output).toContain('★★★★½');
  });

  it('should format install counts under 1000 without K suffix', () => {
    const serversWithLowInstalls: MCPMarketplaceServer[] = [
      {
        id: 'test',
        name: 'test-server',
        description: 'Test server',
        rating: 4.0,
        installCount: 500,
        requiresOAuth: false,
        requirements: [],
        command: 'test',
      },
    ];

    const { lastFrame } = render(<MarketplacePreview servers={serversWithLowInstalls} />);
    const output = lastFrame();
    
    expect(output).toContain('500 installs');
    expect(output).not.toContain('K');
  });

  it('should display all required information for each server', () => {
    const { lastFrame } = render(<MarketplacePreview servers={mockServers.slice(0, 1)} />);
    const output = lastFrame();
    
    // Check all required elements are present
    expect(output).toContain('filesystem'); // Name
    expect(output).toContain('Secure file system operations'); // Description
    expect(output).toContain('★'); // Rating stars
    expect(output).toContain('(5.0)'); // Numeric rating
    expect(output).toContain('10K installs'); // Install count
  });
});
