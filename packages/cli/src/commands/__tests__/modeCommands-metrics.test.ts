/**
 * Tests for Mode Commands with Metrics Integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { modeCommand } from '../modeCommands.js';
import type { PromptModeManager } from '@ollm/core';

// Mock the context manager
const mockModeManager = {
  getCurrentMode: vi.fn(),
  getPreviousMode: vi.fn(),
  isAutoSwitchEnabled: vi.fn(),
  getAllowedTools: vi.fn(),
  getRecentHistory: vi.fn(),
  getMetricsTracker: vi.fn(),
} as unknown as PromptModeManager;

const mockContextManager = {
  getModeManager: vi.fn(() => mockModeManager),
  switchMode: vi.fn(),
  setAutoSwitch: vi.fn(),
};

vi.mock('../../features/context/ContextManagerContext.js', () => ({
  getGlobalContextManager: vi.fn(() => mockContextManager),
}));

describe('Mode Commands - Metrics Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock returns
    mockModeManager.getCurrentMode = vi.fn(() => 'developer');
    mockModeManager.getPreviousMode = vi.fn(() => 'planning');
    mockModeManager.isAutoSwitchEnabled = vi.fn(() => true);
    mockModeManager.getAllowedTools = vi.fn(() => ['*']);
    mockModeManager.getRecentHistory = vi.fn(() => []);
  });
  
  describe('/mode status with metrics', () => {
    it('should display session metrics when available', async () => {
      const mockMetricsTracker = {
        getSessionSummary: vi.fn(() => ({
          duration: '5m 30s',
          modesUsed: 3,
          totalTransitions: 5,
          mostUsedMode: 'developer' as const,
          productivity: {
            filesChanged: 10,
            linesChanged: 250,
            bugsFixed: 2,
          },
        })),
        getTimeMetricsSummary: vi.fn(() => ({
          totalTime: 330000, // 5.5 minutes
          modeBreakdown: [
            {
              mode: 'developer' as const,
              duration: 180000, // 3 minutes
              percentage: 54.5,
              entryCount: 2,
            },
            {
              mode: 'planning' as const,
              duration: 150000, // 2.5 minutes
              percentage: 45.5,
              entryCount: 1,
            },
          ],
        })),
        getModeSpecificSummary: vi.fn(() => ({
          filesCreated: 3,
          filesModified: 5,
          filesDeleted: 2,
          linesAdded: 200,
          linesRemoved: 50,
          testsWritten: 4,
          commitsCreated: 2,
        })),
        getProductivitySummary: vi.fn(() => ({
          totalFiles: 10,
          totalLines: 250,
          totalTests: 4,
          totalCommits: 2,
          totalBugsFixed: 2,
          totalVulnerabilitiesFixed: 1,
          totalOptimizations: 3,
          totalReviews: 1,
        })),
      };
      
      mockModeManager.getMetricsTracker = vi.fn(() => mockMetricsTracker);
      
      const result = await modeCommand.handler(['status']);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Session Metrics');
      expect(result.message).toContain('Duration: 5m 30s');
      expect(result.message).toContain('Modes Used: 3');
      expect(result.message).toContain('Transitions: 5');
      expect(result.message).toContain('Most Used: 👨‍💻 developer');
      expect(result.message).toContain('Time in developer: 3m 0s (54.5%)');
      expect(result.message).toContain('Developer Mode Metrics');
      expect(result.message).toContain('Files Created: 3');
      expect(result.message).toContain('Productivity');
      expect(result.message).toContain('Files Changed: 10');
      expect(result.message).toContain('Bugs Fixed: 2');
    });
    
    it('should handle metrics display errors gracefully', async () => {
      const mockMetricsTracker = {
        getSessionSummary: vi.fn(() => {
          throw new Error('Metrics error');
        }),
        getTimeMetricsSummary: vi.fn(() => {
          throw new Error('Metrics error');
        }),
        getModeSpecificSummary: vi.fn(() => {
          throw new Error('Metrics error');
        }),
        getProductivitySummary: vi.fn(() => {
          throw new Error('Metrics error');
        }),
      };
      
      mockModeManager.getMetricsTracker = vi.fn(() => mockMetricsTracker);
      
      const result = await modeCommand.handler(['status']);
      
      // Should still succeed even if metrics fail
      expect(result.success).toBe(true);
      expect(result.message).toContain('Current: 👨‍💻 developer');
      // Should not contain metrics sections
      expect(result.message).not.toContain('Session Metrics');
    });
    
    it('should display mode-specific metrics for debugger mode', async () => {
      mockModeManager.getCurrentMode = vi.fn(() => 'debugger');
      
      const mockMetricsTracker = {
        getSessionSummary: vi.fn(() => ({
          duration: '10m 0s',
          modesUsed: 2,
          totalTransitions: 3,
          mostUsedMode: 'debugger' as const,
          productivity: {
            filesChanged: 5,
            linesChanged: 100,
            bugsFixed: 5,
          },
        })),
        getTimeMetricsSummary: vi.fn(() => ({
          totalTime: 600000,
          modeBreakdown: [
            {
              mode: 'debugger' as const,
              duration: 600000,
              percentage: 100,
              entryCount: 1,
            },
          ],
        })),
        getModeSpecificSummary: vi.fn(() => ({
          errorsAnalyzed: 10,
          bugsFound: 8,
          fixesApplied: 5,
          successRate: '62.5%',
          averageTimeToFix: '45.2s',
        })),
        getProductivitySummary: vi.fn(() => ({
          totalFiles: 5,
          totalLines: 100,
          totalTests: 0,
          totalCommits: 0,
          totalBugsFixed: 5,
          totalVulnerabilitiesFixed: 0,
          totalOptimizations: 0,
          totalReviews: 0,
        })),
      };
      
      mockModeManager.getMetricsTracker = vi.fn(() => mockMetricsTracker);
      
      const result = await modeCommand.handler(['status']);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Debugger Mode Metrics');
      expect(result.message).toContain('Errors Analyzed: 10');
      expect(result.message).toContain('Bugs Found: 8');
      expect(result.message).toContain('Fixes Applied: 5');
      expect(result.message).toContain('Success Rate: 62.5%');
      expect(result.message).toContain('Average Time To Fix: 45.2s');
    });
    
    it('should display mode-specific metrics for security mode', async () => {
      mockModeManager.getCurrentMode = vi.fn(() => 'security');
      
      const mockMetricsTracker = {
        getSessionSummary: vi.fn(() => ({
          duration: '15m 0s',
          modesUsed: 1,
          totalTransitions: 0,
          mostUsedMode: 'security' as const,
          productivity: {
            filesChanged: 3,
            linesChanged: 50,
            bugsFixed: 0,
          },
        })),
        getTimeMetricsSummary: vi.fn(() => ({
          totalTime: 900000,
          modeBreakdown: [
            {
              mode: 'security' as const,
              duration: 900000,
              percentage: 100,
              entryCount: 1,
            },
          ],
        })),
        getModeSpecificSummary: vi.fn(() => ({
          vulnerabilitiesFound: 12,
          criticalVulnerabilities: 2,
          highVulnerabilities: 4,
          fixesApplied: 8,
          auditsPerformed: 3,
        })),
        getProductivitySummary: vi.fn(() => ({
          totalFiles: 3,
          totalLines: 50,
          totalTests: 0,
          totalCommits: 0,
          totalBugsFixed: 0,
          totalVulnerabilitiesFixed: 8,
          totalOptimizations: 0,
          totalReviews: 0,
        })),
      };
      
      mockModeManager.getMetricsTracker = vi.fn(() => mockMetricsTracker);
      
      const result = await modeCommand.handler(['status']);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Security Mode Metrics');
      expect(result.message).toContain('Vulnerabilities Found: 12');
      expect(result.message).toContain('Critical Vulnerabilities: 2');
      expect(result.message).toContain('High Vulnerabilities: 4');
      expect(result.message).toContain('Fixes Applied: 8');
      expect(result.message).toContain('Audits Performed: 3');
      expect(result.message).toContain('Vulnerabilities Fixed: 8');
    });
    
    it('should not display productivity section when no activity', async () => {
      const mockMetricsTracker = {
        getSessionSummary: vi.fn(() => ({
          duration: '2m 0s',
          modesUsed: 1,
          totalTransitions: 0,
          mostUsedMode: 'assistant' as const,
          productivity: {
            filesChanged: 0,
            linesChanged: 0,
            bugsFixed: 0,
          },
        })),
        getTimeMetricsSummary: vi.fn(() => ({
          totalTime: 120000,
          modeBreakdown: [
            {
              mode: 'assistant' as const,
              duration: 120000,
              percentage: 100,
              entryCount: 1,
            },
          ],
        })),
        getModeSpecificSummary: vi.fn(() => ({})),
        getProductivitySummary: vi.fn(() => ({
          totalFiles: 0,
          totalLines: 0,
          totalTests: 0,
          totalCommits: 0,
          totalBugsFixed: 0,
          totalVulnerabilitiesFixed: 0,
          totalOptimizations: 0,
          totalReviews: 0,
        })),
      };
      
      mockModeManager.getMetricsTracker = vi.fn(() => mockMetricsTracker);
      mockModeManager.getCurrentMode = vi.fn(() => 'assistant');
      
      const result = await modeCommand.handler(['status']);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Session Metrics');
      expect(result.message).not.toContain('Productivity');
    });
    
    it('should display limited metrics when only 5 or fewer', async () => {
      mockModeManager.getCurrentMode = vi.fn(() => 'reviewer');
      
      const mockMetricsTracker = {
        getSessionSummary: vi.fn(() => ({
          duration: '8m 0s',
          modesUsed: 1,
          totalTransitions: 0,
          mostUsedMode: 'reviewer' as const,
          productivity: {
            filesChanged: 0,
            linesChanged: 0,
            bugsFixed: 0,
          },
        })),
        getTimeMetricsSummary: vi.fn(() => ({
          totalTime: 480000,
          modeBreakdown: [
            {
              mode: 'reviewer' as const,
              duration: 480000,
              percentage: 100,
              entryCount: 1,
            },
          ],
        })),
        getModeSpecificSummary: vi.fn(() => ({
          reviewsPerformed: 3,
          issuesFound: 8,
          suggestionsGiven: 12,
          filesReviewed: 5,
          linesReviewed: 450,
        })),
        getProductivitySummary: vi.fn(() => ({
          totalFiles: 0,
          totalLines: 0,
          totalTests: 0,
          totalCommits: 0,
          totalBugsFixed: 0,
          totalVulnerabilitiesFixed: 0,
          totalOptimizations: 0,
          totalReviews: 3,
        })),
      };
      
      mockModeManager.getMetricsTracker = vi.fn(() => mockMetricsTracker);
      
      const result = await modeCommand.handler(['status']);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Reviewer Mode Metrics');
      expect(result.message).toContain('Reviews Performed: 3');
      expect(result.message).toContain('Issues Found: 8');
      expect(result.message).toContain('Suggestions Given: 12');
      expect(result.message).toContain('Files Reviewed: 5');
      expect(result.message).toContain('Lines Reviewed: 450');
      // Should not show "... and X more metrics" since we have exactly 5 metrics
      expect(result.message).not.toMatch(/\.\.\. and \d+ more metrics/);
    });
    
    it('should truncate metrics display when more than 5', async () => {
      mockModeManager.getCurrentMode = vi.fn(() => 'performance');
      
      const mockMetricsTracker = {
        getSessionSummary: vi.fn(() => ({
          duration: '12m 0s',
          modesUsed: 1,
          totalTransitions: 0,
          mostUsedMode: 'performance' as const,
          productivity: {
            filesChanged: 0,
            linesChanged: 0,
            bugsFixed: 0,
          },
        })),
        getTimeMetricsSummary: vi.fn(() => ({
          totalTime: 720000,
          modeBreakdown: [
            {
              mode: 'performance' as const,
              duration: 720000,
              percentage: 100,
              entryCount: 1,
            },
          ],
        })),
        getModeSpecificSummary: vi.fn(() => ({
          bottlenecksFound: 8,
          optimizationsApplied: 6,
          averageImprovement: '45.5%',
          benchmarksRun: 12,
          profilesGenerated: 4,
          extraMetric1: 10,
          extraMetric2: 20,
        })),
        getProductivitySummary: vi.fn(() => ({
          totalFiles: 0,
          totalLines: 0,
          totalTests: 0,
          totalCommits: 0,
          totalBugsFixed: 0,
          totalVulnerabilitiesFixed: 0,
          totalOptimizations: 6,
          totalReviews: 0,
        })),
      };
      
      mockModeManager.getMetricsTracker = vi.fn(() => mockMetricsTracker);
      
      const result = await modeCommand.handler(['status']);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Performance Mode Metrics');
      // Should show first 5 metrics
      expect(result.message).toContain('Bottlenecks Found: 8');
      expect(result.message).toContain('Optimizations Applied: 6');
      expect(result.message).toContain('Average Improvement: 45.5%');
      expect(result.message).toContain('Benchmarks Run: 12');
      expect(result.message).toContain('Profiles Generated: 4');
      // Should show truncation message
      expect(result.message).toMatch(/\.\.\. and \d+ more metrics/);
    });
  });
});
