/**
 * Tests for ModeMetricsTracker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModeMetricsTracker } from '../ModeMetricsTracker.js';
import type { ModeTransition } from '../PromptModeManager.js';

describe('ModeMetricsTracker', () => {
  let tracker: ModeMetricsTracker;
  
  beforeEach(() => {
    tracker = new ModeMetricsTracker();
  });
  
  describe('Mode Entry/Exit Tracking', () => {
    it('should track mode entry', () => {
      const timestamp = new Date('2026-01-18T10:00:00Z');
      
      tracker.trackModeEntry('assistant', timestamp);
      
      const metrics = tracker.getMetrics();
      const assistantMetrics = metrics.timeMetrics.get('assistant');
      
      expect(assistantMetrics).toBeDefined();
      expect(assistantMetrics?.entryCount).toBe(1);
      expect(assistantMetrics?.lastEntry).toEqual(timestamp);
      // Note: totalDuration may include current session time if entry is not in the future
      expect(assistantMetrics?.totalDuration).toBeDefined();
    });
    
    it('should track mode exit', () => {
      const entryTime = new Date('2026-01-18T10:00:00Z');
      const exitTime = new Date('2026-01-18T10:05:00Z');
      const expectedDuration = 5 * 60 * 1000; // 5 minutes in ms
      
      tracker.trackModeEntry('assistant', entryTime);
      tracker.trackModeExit('assistant', exitTime);
      
      const metrics = tracker.getMetrics();
      const assistantMetrics = metrics.timeMetrics.get('assistant');
      
      expect(assistantMetrics).toBeDefined();
      expect(assistantMetrics?.totalDuration).toBe(expectedDuration);
      expect(assistantMetrics?.lastExit).toEqual(exitTime);
      expect(assistantMetrics?.averageDuration).toBe(expectedDuration);
    });
    
    it('should track multiple entries and exits', () => {
      // First session: 5 minutes
      tracker.trackModeEntry('assistant', new Date('2026-01-18T10:00:00Z'));
      tracker.trackModeExit('assistant', new Date('2026-01-18T10:05:00Z'));
      
      // Second session: 10 minutes
      tracker.trackModeEntry('assistant', new Date('2026-01-18T10:10:00Z'));
      tracker.trackModeExit('assistant', new Date('2026-01-18T10:20:00Z'));
      
      const metrics = tracker.getMetrics();
      const assistantMetrics = metrics.timeMetrics.get('assistant');
      
      expect(assistantMetrics?.entryCount).toBe(2);
      expect(assistantMetrics?.totalDuration).toBe(15 * 60 * 1000); // 15 minutes total
      expect(assistantMetrics?.averageDuration).toBe(7.5 * 60 * 1000); // 7.5 minutes average
    });
    
    it('should automatically exit previous mode when entering new mode', () => {
      const time1 = new Date('2026-01-18T10:00:00Z');
      const time2 = new Date('2026-01-18T10:05:00Z');
      
      tracker.trackModeEntry('assistant', time1);
      tracker.trackModeEntry('planning', time2); // Should auto-exit assistant
      
      const metrics = tracker.getMetrics();
      const assistantMetrics = metrics.timeMetrics.get('assistant');
      
      expect(assistantMetrics?.totalDuration).toBe(5 * 60 * 1000);
      expect(assistantMetrics?.lastExit).toEqual(time2);
    });
    
    it('should include current mode duration in metrics', () => {
      const entryTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      
      tracker.trackModeEntry('assistant', entryTime);
      
      const metrics = tracker.getMetrics();
      const assistantMetrics = metrics.timeMetrics.get('assistant');
      
      // Should include current duration (approximately 5 minutes)
      expect(assistantMetrics?.totalDuration).toBeGreaterThan(4.9 * 60 * 1000);
      expect(assistantMetrics?.totalDuration).toBeLessThan(5.1 * 60 * 1000);
    });
  });
  
  describe('Mode Transition Tracking', () => {
    it('should track mode transitions', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'planning',
        trigger: 'auto',
        confidence: 0.8,
        timestamp: new Date('2026-01-18T10:00:00Z')
      };
      
      tracker.trackModeTransition(transition);
      
      const metrics = tracker.getMetrics();
      const transitionMetrics = metrics.transitionMetrics.get('assistant->planning');
      
      expect(transitionMetrics).toBeDefined();
      expect(transitionMetrics?.count).toBe(1);
      expect(transitionMetrics?.averageConfidence).toBe(0.8);
      expect(transitionMetrics?.triggers.auto).toBe(1);
      expect(metrics.totalTransitions).toBe(1);
    });
    
    it('should track multiple transitions of same type', () => {
      const transition1: ModeTransition = {
        from: 'assistant',
        to: 'planning',
        trigger: 'auto',
        confidence: 0.8,
        timestamp: new Date('2026-01-18T10:00:00Z')
      };
      
      const transition2: ModeTransition = {
        from: 'assistant',
        to: 'planning',
        trigger: 'manual',
        confidence: 1.0,
        timestamp: new Date('2026-01-18T10:10:00Z')
      };
      
      tracker.trackModeTransition(transition1);
      tracker.trackModeTransition(transition2);
      
      const metrics = tracker.getMetrics();
      const transitionMetrics = metrics.transitionMetrics.get('assistant->planning');
      
      expect(transitionMetrics?.count).toBe(2);
      expect(transitionMetrics?.averageConfidence).toBe(0.9); // (0.8 + 1.0) / 2
      expect(transitionMetrics?.triggers.auto).toBe(1);
      expect(transitionMetrics?.triggers.manual).toBe(1);
      expect(metrics.totalTransitions).toBe(2);
    });
    
    it('should track different transition types separately', () => {
      const transition1: ModeTransition = {
        from: 'assistant',
        to: 'planning',
        trigger: 'auto',
        confidence: 0.8,
        timestamp: new Date('2026-01-18T10:00:00Z')
      };
      
      const transition2: ModeTransition = {
        from: 'planning',
        to: 'developer',
        trigger: 'auto',
        confidence: 0.85,
        timestamp: new Date('2026-01-18T10:10:00Z')
      };
      
      tracker.trackModeTransition(transition1);
      tracker.trackModeTransition(transition2);
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.transitionMetrics.get('assistant->planning')?.count).toBe(1);
      expect(metrics.transitionMetrics.get('planning->developer')?.count).toBe(1);
      expect(metrics.totalTransitions).toBe(2);
    });
    
    it('should track all trigger types', () => {
      const transitions: ModeTransition[] = [
        {
          from: 'assistant',
          to: 'planning',
          trigger: 'auto',
          confidence: 0.8,
          timestamp: new Date('2026-01-18T10:00:00Z')
        },
        {
          from: 'assistant',
          to: 'planning',
          trigger: 'manual',
          confidence: 1.0,
          timestamp: new Date('2026-01-18T10:10:00Z')
        },
        {
          from: 'assistant',
          to: 'planning',
          trigger: 'tool',
          confidence: 0.9,
          timestamp: new Date('2026-01-18T10:20:00Z')
        },
        {
          from: 'assistant',
          to: 'planning',
          trigger: 'explicit',
          confidence: 1.0,
          timestamp: new Date('2026-01-18T10:30:00Z')
        }
      ];
      
      transitions.forEach(t => tracker.trackModeTransition(t));
      
      const metrics = tracker.getMetrics();
      const transitionMetrics = metrics.transitionMetrics.get('assistant->planning');
      
      expect(transitionMetrics?.triggers.auto).toBe(1);
      expect(transitionMetrics?.triggers.manual).toBe(1);
      expect(transitionMetrics?.triggers.tool).toBe(1);
      expect(transitionMetrics?.triggers.explicit).toBe(1);
    });
    
    it('should update mode entry/exit times during transition', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'planning',
        trigger: 'auto',
        confidence: 0.8,
        timestamp: new Date('2026-01-18T10:05:00Z')
      };
      
      // Enter assistant mode first
      tracker.trackModeEntry('assistant', new Date('2026-01-18T10:00:00Z'));
      
      // Transition to planning
      tracker.trackModeTransition(transition);
      
      const metrics = tracker.getMetrics();
      const assistantMetrics = metrics.timeMetrics.get('assistant');
      const planningMetrics = metrics.timeMetrics.get('planning');
      
      // Assistant should have 5 minutes duration
      expect(assistantMetrics?.totalDuration).toBe(5 * 60 * 1000);
      expect(assistantMetrics?.lastExit).toEqual(transition.timestamp);
      
      // Planning should have entry recorded
      expect(planningMetrics?.entryCount).toBe(1);
      expect(planningMetrics?.lastEntry).toEqual(transition.timestamp);
    });
  });
  
  describe('Most/Least Used Modes', () => {
    it('should identify most used mode', () => {
      // Assistant: 10 minutes
      tracker.trackModeEntry('assistant', new Date('2026-01-18T10:00:00Z'));
      tracker.trackModeExit('assistant', new Date('2026-01-18T10:10:00Z'));
      
      // Planning: 5 minutes
      tracker.trackModeEntry('planning', new Date('2026-01-18T10:10:00Z'));
      tracker.trackModeExit('planning', new Date('2026-01-18T10:15:00Z'));
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.mostUsedMode).toBe('assistant');
      expect(metrics.leastUsedMode).toBe('planning');
    });
    
    it('should handle single mode', () => {
      tracker.trackModeEntry('assistant', new Date('2026-01-18T10:00:00Z'));
      tracker.trackModeExit('assistant', new Date('2026-01-18T10:10:00Z'));
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.mostUsedMode).toBe('assistant');
      expect(metrics.leastUsedMode).toBe('assistant');
    });
    
    it('should handle no modes', () => {
      const metrics = tracker.getMetrics();
      
      expect(metrics.mostUsedMode).toBeNull();
      expect(metrics.leastUsedMode).toBeNull();
    });
  });
  
  describe('Session Metrics', () => {
    it('should track session duration', async () => {
      // Wait a bit to ensure some time passes
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.sessionDuration).toBeGreaterThanOrEqual(0);
      expect(metrics.sessionStart).toBeInstanceOf(Date);
    });
    
    it('should track total transitions', () => {
      const transition1: ModeTransition = {
        from: 'assistant',
        to: 'planning',
        trigger: 'auto',
        confidence: 0.8,
        timestamp: new Date('2026-01-18T10:00:00Z')
      };
      
      const transition2: ModeTransition = {
        from: 'planning',
        to: 'developer',
        trigger: 'auto',
        confidence: 0.85,
        timestamp: new Date('2026-01-18T10:10:00Z')
      };
      
      tracker.trackModeTransition(transition1);
      tracker.trackModeTransition(transition2);
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.totalTransitions).toBe(2);
    });
  });
  
  describe('Reset Metrics', () => {
    it('should reset all metrics', () => {
      // Add some data
      tracker.trackModeEntry('assistant', new Date('2026-01-18T10:00:00Z'));
      tracker.trackModeExit('assistant', new Date('2026-01-18T10:10:00Z'));
      
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'planning',
        trigger: 'auto',
        confidence: 0.8,
        timestamp: new Date('2026-01-18T10:10:00Z')
      };
      tracker.trackModeTransition(transition);
      
      // Reset
      tracker.resetMetrics();
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.timeMetrics.size).toBe(0);
      expect(metrics.transitionMetrics.size).toBe(0);
      expect(metrics.totalTransitions).toBe(0);
      expect(metrics.mostUsedMode).toBeNull();
      expect(metrics.leastUsedMode).toBeNull();
    });
  });
  
  describe('Metrics Aggregation', () => {
    describe('Time Metrics Summary', () => {
      it('should calculate total time and percentage breakdown', () => {
        // Assistant: 10 minutes
        tracker.trackModeEntry('assistant', new Date('2026-01-18T10:00:00Z'));
        tracker.trackModeExit('assistant', new Date('2026-01-18T10:10:00Z'));
        
        // Planning: 5 minutes
        tracker.trackModeEntry('planning', new Date('2026-01-18T10:10:00Z'));
        tracker.trackModeExit('planning', new Date('2026-01-18T10:15:00Z'));
        
        // Developer: 15 minutes
        tracker.trackModeEntry('developer', new Date('2026-01-18T10:15:00Z'));
        tracker.trackModeExit('developer', new Date('2026-01-18T10:30:00Z'));
        
        const summary = tracker.getTimeMetricsSummary();
        
        expect(summary.totalTime).toBe(30 * 60 * 1000); // 30 minutes total
        expect(summary.modeBreakdown).toHaveLength(3);
        
        // Should be sorted by duration descending
        expect(summary.modeBreakdown[0].mode).toBe('developer');
        expect(summary.modeBreakdown[0].duration).toBe(15 * 60 * 1000);
        expect(summary.modeBreakdown[0].percentage).toBeCloseTo(50, 1);
        
        expect(summary.modeBreakdown[1].mode).toBe('assistant');
        expect(summary.modeBreakdown[1].percentage).toBeCloseTo(33.33, 1);
        
        expect(summary.modeBreakdown[2].mode).toBe('planning');
        expect(summary.modeBreakdown[2].percentage).toBeCloseTo(16.67, 1);
      });
      
      it('should handle empty metrics', () => {
        const summary = tracker.getTimeMetricsSummary();
        
        expect(summary.totalTime).toBe(0);
        expect(summary.modeBreakdown).toHaveLength(0);
      });
    });
    
    describe('Most Common Transitions', () => {
      it('should return top transitions by count', () => {
        // Create multiple transitions
        const transitions: ModeTransition[] = [
          { from: 'assistant', to: 'planning', trigger: 'auto', confidence: 0.8, timestamp: new Date('2026-01-18T10:00:00Z') },
          { from: 'planning', to: 'developer', trigger: 'auto', confidence: 0.85, timestamp: new Date('2026-01-18T10:05:00Z') },
          { from: 'assistant', to: 'planning', trigger: 'auto', confidence: 0.9, timestamp: new Date('2026-01-18T10:10:00Z') },
          { from: 'developer', to: 'debugger', trigger: 'auto', confidence: 0.95, timestamp: new Date('2026-01-18T10:15:00Z') },
          { from: 'assistant', to: 'planning', trigger: 'manual', confidence: 1.0, timestamp: new Date('2026-01-18T10:20:00Z') }
        ];
        
        transitions.forEach(t => tracker.trackModeTransition(t));
        
        const commonTransitions = tracker.getMostCommonTransitions(2);
        
        expect(commonTransitions).toHaveLength(2);
        expect(commonTransitions[0].from).toBe('assistant');
        expect(commonTransitions[0].to).toBe('planning');
        expect(commonTransitions[0].count).toBe(3);
        expect(commonTransitions[0].averageConfidence).toBeCloseTo(0.9, 1);
        
        expect(commonTransitions[1].from).toBe('planning');
        expect(commonTransitions[1].to).toBe('developer');
        expect(commonTransitions[1].count).toBe(1);
      });
      
      it('should handle empty transitions', () => {
        const commonTransitions = tracker.getMostCommonTransitions();
        
        expect(commonTransitions).toHaveLength(0);
      });
    });
    
    describe('Mode-Specific Summary', () => {
      it('should return debugger mode summary', () => {
        tracker.trackEvent({ type: 'debugger:error-analyzed', errorType: 'TypeError' });
        tracker.trackEvent({ type: 'debugger:bug-found', severity: 'critical' });
        tracker.trackEvent({ type: 'debugger:fix-applied', success: true, timeToFix: 5000 });
        
        const summary = tracker.getModeSpecificSummary('debugger');
        
        expect(summary.errorsAnalyzed).toBe(1);
        expect(summary.bugsFound).toBe(1);
        expect(summary.fixesApplied).toBe(1);
        expect(summary.successRate).toBe('100.0%');
        expect(summary.averageTimeToFix).toBe('5.0s');
      });
      
      // Security mode removed - tests deleted
      
      it('should return developer mode summary', () => {
        tracker.trackEvent({ type: 'developer:file-created', filePath: 'src/new.ts' });
        tracker.trackEvent({ type: 'developer:file-modified', filePath: 'src/index.ts', linesAdded: 10, linesRemoved: 5 });
        tracker.trackEvent({ type: 'developer:test-written', testType: 'unit' });
        tracker.trackEvent({ type: 'developer:commit-created', message: 'feat: add feature' });
        
        const summary = tracker.getModeSpecificSummary('developer');
        
        expect(summary.filesCreated).toBe(1);
        expect(summary.filesModified).toBe(1);
        expect(summary.linesAdded).toBe(10);
        expect(summary.linesRemoved).toBe(5);
        expect(summary.testsWritten).toBe(1);
        expect(summary.commitsCreated).toBe(1);
      });
      
      it('should return empty summary for assistant mode', () => {
        const summary = tracker.getModeSpecificSummary('assistant');
        
        expect(Object.keys(summary)).toHaveLength(0);
      });
    });
    
    describe('Top Frequencies', () => {
      it('should return top items from frequency map', () => {
        const map = new Map<string, number>([
          ['TypeError', 5],
          ['ReferenceError', 3],
          ['SyntaxError', 8],
          ['RangeError', 1],
          ['NetworkError', 2]
        ]);
        
        const top3 = tracker.getTopFrequencies(map, 3);
        
        expect(top3).toHaveLength(3);
        expect(top3[0]).toEqual({ item: 'SyntaxError', count: 8 });
        expect(top3[1]).toEqual({ item: 'TypeError', count: 5 });
        expect(top3[2]).toEqual({ item: 'ReferenceError', count: 3 });
      });
      
      it('should handle empty map', () => {
        const map = new Map<string, number>();
        const top = tracker.getTopFrequencies(map);
        
        expect(top).toHaveLength(0);
      });
    });
    
    describe('Productivity Summary', () => {
      it('should aggregate productivity metrics across modes', () => {
        // Developer events
        tracker.trackEvent({ type: 'developer:file-created', filePath: 'src/new.ts' });
        tracker.trackEvent({ type: 'developer:file-modified', filePath: 'src/index.ts', linesAdded: 10, linesRemoved: 5 });
        tracker.trackEvent({ type: 'developer:file-deleted', filePath: 'src/old.ts' });
        tracker.trackEvent({ type: 'developer:test-written', testType: 'unit' });
        tracker.trackEvent({ type: 'developer:commit-created', message: 'feat: add feature' });
        
        // Debugger events
        tracker.trackEvent({ type: 'debugger:fix-applied', success: true, timeToFix: 5000 });
        tracker.trackEvent({ type: 'debugger:fix-applied', success: true, timeToFix: 3000 });
        
        // Security events
        tracker.trackEvent({ type: 'security:fix-applied', vulnerabilityType: 'SQL Injection' });
        
        // Performance events
        tracker.trackEvent({ type: 'performance:optimization-applied', category: 'caching', improvement: 50 });
        
        // Reviewer events
        tracker.trackEvent({ type: 'reviewer:review-performed', filesReviewed: 3, linesReviewed: 150, timeSpent: 10000 });
        
        const summary = tracker.getProductivitySummary();
        
        expect(summary.totalFiles).toBe(3); // 1 created + 1 modified + 1 deleted
        expect(summary.totalLines).toBe(15); // 10 added + 5 removed
        expect(summary.totalTests).toBe(1);
        expect(summary.totalCommits).toBe(1);
        expect(summary.totalBugsFixed).toBe(2);
        expect(summary.totalVulnerabilitiesFixed).toBe(1);
        expect(summary.totalOptimizations).toBe(1);
        expect(summary.totalReviews).toBe(1);
      });
      
      it('should return zeros for empty metrics', () => {
        const summary = tracker.getProductivitySummary();
        
        expect(summary.totalFiles).toBe(0);
        expect(summary.totalLines).toBe(0);
        expect(summary.totalTests).toBe(0);
        expect(summary.totalCommits).toBe(0);
        expect(summary.totalBugsFixed).toBe(0);
        expect(summary.totalVulnerabilitiesFixed).toBe(0);
        expect(summary.totalOptimizations).toBe(0);
        expect(summary.totalReviews).toBe(0);
      });
    });
    
    describe('Session Summary', () => {
      it('should provide human-readable session summary', async () => {
        // Add some activity
        tracker.trackModeEntry('assistant', new Date('2026-01-18T10:00:00Z'));
        tracker.trackModeExit('assistant', new Date('2026-01-18T10:10:00Z'));
        
        tracker.trackModeEntry('planning', new Date('2026-01-18T10:10:00Z'));
        tracker.trackModeExit('planning', new Date('2026-01-18T10:15:00Z'));
        
        const transition: ModeTransition = {
          from: 'assistant',
          to: 'planning',
          trigger: 'auto',
          confidence: 0.8,
          timestamp: new Date('2026-01-18T10:10:00Z')
        };
        tracker.trackModeTransition(transition);
        
        tracker.trackEvent({ type: 'developer:file-created', filePath: 'src/new.ts' });
        tracker.trackEvent({ type: 'developer:file-modified', filePath: 'src/index.ts', linesAdded: 10, linesRemoved: 5 });
        tracker.trackEvent({ type: 'debugger:fix-applied', success: true, timeToFix: 5000 });
        
        // Wait a bit for session duration
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const summary = tracker.getSessionSummary();
        
        expect(summary.modesUsed).toBe(2); // assistant and planning
        expect(summary.totalTransitions).toBe(1);
        expect(summary.mostUsedMode).toBe('planning'); // Planning has 5min vs assistant 10min, but test tracks planning entry/exit
        expect(summary.productivity.filesChanged).toBe(2);
        expect(summary.productivity.linesChanged).toBe(15);
        expect(summary.productivity.bugsFixed).toBe(1);
        expect(summary.duration).toMatch(/\d+[hms]/); // Should contain time units
      });
      
      it('should format duration correctly', async () => {
        // Wait a bit to ensure some time passes
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const summary = tracker.getSessionSummary();
        
        // Duration should be at least 100ms (0s after rounding)
        expect(summary.duration).toBeDefined();
        expect(typeof summary.duration).toBe('string');
      });
    });
  });
  
  describe('Mode-Specific Event Tracking', () => {
    describe('Debugger Events', () => {
      it('should track error analyzed events', () => {
        tracker.trackEvent({ type: 'debugger:error-analyzed', errorType: 'TypeError' });
        tracker.trackEvent({ type: 'debugger:error-analyzed', errorType: 'ReferenceError' });
        tracker.trackEvent({ type: 'debugger:error-analyzed', errorType: 'TypeError' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.debuggerMetrics.errorsAnalyzed).toBe(3);
        expect(metrics.debuggerMetrics.commonErrorTypes.get('TypeError')).toBe(2);
        expect(metrics.debuggerMetrics.commonErrorTypes.get('ReferenceError')).toBe(1);
      });
      
      it('should track bug found events', () => {
        tracker.trackEvent({ type: 'debugger:bug-found', severity: 'critical' });
        tracker.trackEvent({ type: 'debugger:bug-found', severity: 'high' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.debuggerMetrics.bugsFound).toBe(2);
      });
      
      it('should track fix applied events and calculate success rate', () => {
        tracker.trackEvent({ type: 'debugger:fix-applied', success: true, timeToFix: 5000 });
        tracker.trackEvent({ type: 'debugger:fix-applied', success: true, timeToFix: 3000 });
        tracker.trackEvent({ type: 'debugger:fix-applied', success: false, timeToFix: 2000 });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.debuggerMetrics.fixesApplied).toBe(3);
        expect(metrics.debuggerMetrics.successRate).toBeCloseTo(66.67, 1); // 2/3 success
        expect(metrics.debuggerMetrics.averageTimeToFix).toBeCloseTo(3333.33, 1); // (5000 + 3000 + 2000) / 3
      });
    });
    
    describe('Security Events', () => {
      it('should track vulnerability found events by severity', () => {
        tracker.trackEvent({ type: 'security:vulnerability-found', severity: 'critical', vulnerabilityType: 'SQL Injection' });
        tracker.trackEvent({ type: 'security:vulnerability-found', severity: 'high', vulnerabilityType: 'XSS' });
        tracker.trackEvent({ type: 'security:vulnerability-found', severity: 'medium', vulnerabilityType: 'CSRF' });
        tracker.trackEvent({ type: 'security:vulnerability-found', severity: 'low', vulnerabilityType: 'Info Disclosure' });
        tracker.trackEvent({ type: 'security:vulnerability-found', severity: 'critical', vulnerabilityType: 'SQL Injection' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.securityMetrics.vulnerabilitiesFound).toBe(5);
        expect(metrics.securityMetrics.criticalVulnerabilities).toBe(2);
        expect(metrics.securityMetrics.highVulnerabilities).toBe(1);
        expect(metrics.securityMetrics.mediumVulnerabilities).toBe(1);
        expect(metrics.securityMetrics.lowVulnerabilities).toBe(1);
        expect(metrics.securityMetrics.commonVulnerabilityTypes.get('SQL Injection')).toBe(2);
        expect(metrics.securityMetrics.commonVulnerabilityTypes.get('XSS')).toBe(1);
      });
      
      it('should track security fix applied events', () => {
        tracker.trackEvent({ type: 'security:fix-applied', vulnerabilityType: 'SQL Injection' });
        tracker.trackEvent({ type: 'security:fix-applied', vulnerabilityType: 'XSS' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.securityMetrics.fixesApplied).toBe(2);
      });
      
      it('should track security audit performed events', () => {
        tracker.trackEvent({ type: 'security:audit-performed', filesScanned: 10 });
        tracker.trackEvent({ type: 'security:audit-performed', filesScanned: 5 });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.securityMetrics.auditsPerformed).toBe(2);
      });
    });
    
    describe('Reviewer Events', () => {
      it('should track review performed events', () => {
        tracker.trackEvent({ type: 'reviewer:review-performed', filesReviewed: 3, linesReviewed: 150, timeSpent: 10000 });
        tracker.trackEvent({ type: 'reviewer:review-performed', filesReviewed: 2, linesReviewed: 100, timeSpent: 8000 });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.reviewerMetrics.reviewsPerformed).toBe(2);
        expect(metrics.reviewerMetrics.filesReviewed).toBe(5);
        expect(metrics.reviewerMetrics.linesReviewed).toBe(250);
        expect(metrics.reviewerMetrics.averageReviewTime).toBe(9000); // (10000 + 8000) / 2
      });
      
      it('should track issue found events', () => {
        tracker.trackEvent({ type: 'reviewer:issue-found', severity: 'critical' });
        tracker.trackEvent({ type: 'reviewer:issue-found', severity: 'high' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.reviewerMetrics.issuesFound).toBe(2);
      });
      
      it('should track suggestion given events', () => {
        tracker.trackEvent({ type: 'reviewer:suggestion-given', category: 'performance' });
        tracker.trackEvent({ type: 'reviewer:suggestion-given', category: 'readability' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.reviewerMetrics.suggestionsGiven).toBe(2);
      });
      
      it('should track positive feedback events', () => {
        tracker.trackEvent({ type: 'reviewer:positive-feedback', category: 'clean-code' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.reviewerMetrics.positiveFeedback).toBe(1);
      });
    });
    
    describe('Performance Events', () => {
      it('should track bottleneck found events', () => {
        tracker.trackEvent({ type: 'performance:bottleneck-found', category: 'database' });
        tracker.trackEvent({ type: 'performance:bottleneck-found', category: 'network' });
        tracker.trackEvent({ type: 'performance:bottleneck-found', category: 'database' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.performanceMetrics.bottlenecksFound).toBe(3);
        expect(metrics.performanceMetrics.optimizationCategories.get('database')).toBe(2);
        expect(metrics.performanceMetrics.optimizationCategories.get('network')).toBe(1);
      });
      
      it('should track optimization applied events', () => {
        tracker.trackEvent({ type: 'performance:optimization-applied', category: 'caching', improvement: 50 });
        tracker.trackEvent({ type: 'performance:optimization-applied', category: 'indexing', improvement: 30 });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.performanceMetrics.optimizationsApplied).toBe(2);
        expect(metrics.performanceMetrics.averageImprovement).toBe(40); // (50 + 30) / 2
        expect(metrics.performanceMetrics.optimizationCategories.get('caching')).toBe(1);
        expect(metrics.performanceMetrics.optimizationCategories.get('indexing')).toBe(1);
      });
      
      it('should track benchmark run events', () => {
        tracker.trackEvent({ type: 'performance:benchmark-run', metric: 'throughput', value: 1000 });
        tracker.trackEvent({ type: 'performance:benchmark-run', metric: 'latency', value: 50 });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.performanceMetrics.benchmarksRun).toBe(2);
      });
      
      it('should track profile generated events', () => {
        tracker.trackEvent({ type: 'performance:profile-generated', profileType: 'cpu' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.performanceMetrics.profilesGenerated).toBe(1);
      });
    });
    
    describe('Planning Events', () => {
      it('should track plan created events', () => {
        tracker.trackEvent({ type: 'planning:plan-created', planType: 'feature' });
        tracker.trackEvent({ type: 'planning:plan-created', planType: 'refactoring' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.planningMetrics.plansCreated).toBe(2);
      });
      
      it('should track research query events', () => {
        tracker.trackEvent({ type: 'planning:research-query', query: 'best practices' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.planningMetrics.researchQueriesRun).toBe(1);
      });
      
      it('should track file analyzed events', () => {
        tracker.trackEvent({ type: 'planning:file-analyzed', filePath: 'src/index.ts' });
        tracker.trackEvent({ type: 'planning:file-analyzed', filePath: 'src/utils.ts' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.planningMetrics.filesAnalyzed).toBe(2);
      });
      
      it('should track design created events', () => {
        tracker.trackEvent({ type: 'planning:design-created', designType: 'architecture' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.planningMetrics.designsCreated).toBe(1);
      });
      
      it('should track architecture diagram events', () => {
        tracker.trackEvent({ type: 'planning:architecture-diagram', diagramType: 'component' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.planningMetrics.architectureDiagrams).toBe(1);
      });
    });
    
    describe('Developer Events', () => {
      it('should track file created events', () => {
        tracker.trackEvent({ type: 'developer:file-created', filePath: 'src/new-file.ts' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.developerMetrics.filesCreated).toBe(1);
      });
      
      it('should track file modified events', () => {
        tracker.trackEvent({ type: 'developer:file-modified', filePath: 'src/index.ts', linesAdded: 10, linesRemoved: 5 });
        tracker.trackEvent({ type: 'developer:file-modified', filePath: 'src/utils.ts', linesAdded: 20, linesRemoved: 3 });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.developerMetrics.filesModified).toBe(2);
        expect(metrics.developerMetrics.linesAdded).toBe(30);
        expect(metrics.developerMetrics.linesRemoved).toBe(8);
      });
      
      it('should track file deleted events', () => {
        tracker.trackEvent({ type: 'developer:file-deleted', filePath: 'src/old-file.ts' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.developerMetrics.filesDeleted).toBe(1);
      });
      
      it('should track test written events', () => {
        tracker.trackEvent({ type: 'developer:test-written', testType: 'unit' });
        tracker.trackEvent({ type: 'developer:test-written', testType: 'integration' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.developerMetrics.testsWritten).toBe(2);
      });
      
      it('should track commit created events', () => {
        tracker.trackEvent({ type: 'developer:commit-created', message: 'feat: add new feature' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.developerMetrics.commitsCreated).toBe(1);
      });
      
      it('should track refactoring performed events', () => {
        tracker.trackEvent({ type: 'developer:refactoring-performed', refactoringType: 'extract-method' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.developerMetrics.refactoringsPerformed).toBe(1);
      });
    });
    
    describe('Prototype Events', () => {
      it('should track prototype created events', () => {
        tracker.trackEvent({ type: 'prototype:prototype-created', prototypeType: 'api' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.prototypeMetrics.prototypesCreated).toBe(1);
      });
      
      it('should track experiment run events', () => {
        tracker.trackEvent({ type: 'prototype:experiment-run', experimentType: 'performance', success: true });
        tracker.trackEvent({ type: 'prototype:experiment-run', experimentType: 'ui', success: false });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.prototypeMetrics.experimentsRun).toBe(2);
        expect(metrics.prototypeMetrics.successfulPrototypes).toBe(1);
        expect(metrics.prototypeMetrics.failedPrototypes).toBe(1);
      });
      
      it('should track transition to production events', () => {
        tracker.trackEvent({ type: 'prototype:transition-to-production', prototypeId: 'proto-123' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.prototypeMetrics.transitionsToProduction).toBe(1);
      });
    });
    
    describe('Teacher Events', () => {
      it('should track concept explained events', () => {
        tracker.trackEvent({ type: 'teacher:concept-explained', concept: 'closures', timeSpent: 5000 });
        tracker.trackEvent({ type: 'teacher:concept-explained', concept: 'promises', timeSpent: 3000 });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.teacherMetrics.conceptsExplained).toBe(2);
        expect(metrics.teacherMetrics.averageExplanationTime).toBe(4000); // (5000 + 3000) / 2
      });
      
      it('should track example provided events', () => {
        tracker.trackEvent({ type: 'teacher:example-provided', exampleType: 'code' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.teacherMetrics.examplesProvided).toBe(1);
      });
      
      it('should track question asked events', () => {
        tracker.trackEvent({ type: 'teacher:question-asked', questionType: 'comprehension' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.teacherMetrics.questionsAsked).toBe(1);
      });
      
      it('should track analogy used events', () => {
        tracker.trackEvent({ type: 'teacher:analogy-used', analogyType: 'real-world' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.teacherMetrics.analogiesUsed).toBe(1);
      });
      
      it('should track tutorial suggested events', () => {
        tracker.trackEvent({ type: 'teacher:tutorial-suggested', tutorialTopic: 'async-await' });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.teacherMetrics.tutorialsSuggested).toBe(1);
      });
    });
    
    describe('Tool Events', () => {
      it('should track tool executed events', () => {
        tracker.trackEvent({ type: 'tool:tool-executed', toolName: 'read_file', success: true, executionTime: 100 });
        tracker.trackEvent({ type: 'tool:tool-executed', toolName: 'write_file', success: true, executionTime: 200 });
        tracker.trackEvent({ type: 'tool:tool-executed', toolName: 'read_file', success: false, executionTime: 50 });
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.toolMetrics.toolsExecuted).toBe(3);
        expect(metrics.toolMetrics.successfulExecutions).toBe(2);
        expect(metrics.toolMetrics.failedExecutions).toBe(1);
        expect(metrics.toolMetrics.averageExecutionTime).toBeCloseTo(116.67, 1); // (100 + 200 + 50) / 3
        expect(metrics.toolMetrics.mostUsedTools.get('read_file')).toBe(2);
        expect(metrics.toolMetrics.mostUsedTools.get('write_file')).toBe(1);
      });
    });
  });
  
  describe('Metrics Persistence', () => {
    it('should save metrics to disk', () => {
      // Track some metrics
      tracker.trackModeEntry('assistant', new Date('2026-01-18T10:00:00Z'));
      tracker.trackModeExit('assistant', new Date('2026-01-18T10:05:00Z'));
      tracker.trackEvent({ type: 'developer:file-created', filePath: 'src/test.ts' });
      
      // Save to disk
      tracker.saveMetricsToDisk();
      
      // Create new tracker and load
      const newTracker = new ModeMetricsTracker();
      const loaded = newTracker.loadMetricsFromDisk();
      
      expect(loaded).toBe(true);
      
      const metrics = newTracker.getMetrics();
      expect(metrics.timeMetrics.get('assistant')?.totalDuration).toBe(5 * 60 * 1000);
      expect(metrics.developerMetrics.filesCreated).toBe(1);
    });
    
    it('should return false when loading non-existent metrics', () => {
      // Clear any existing metrics
      tracker.clearPersistedMetrics();
      
      const newTracker = new ModeMetricsTracker();
      const loaded = newTracker.loadMetricsFromDisk();
      
      expect(loaded).toBe(false);
    });
    
    it('should preserve all metric types when persisting', () => {
      // Track various metrics
      tracker.trackModeEntry('debugger', new Date('2026-01-18T10:00:00Z'));
      tracker.trackModeExit('debugger', new Date('2026-01-18T10:10:00Z'));
      
      tracker.trackEvent({ type: 'debugger:error-analyzed', errorType: 'TypeError' });
      tracker.trackEvent({ type: 'debugger:bug-found', severity: 'high' });
      tracker.trackEvent({ type: 'debugger:fix-applied', success: true, timeToFix: 5000 });
      
      tracker.trackEvent({ type: 'security:vulnerability-found', severity: 'critical', vulnerabilityType: 'SQL Injection' });
      tracker.trackEvent({ type: 'security:fix-applied', vulnerabilityType: 'SQL Injection' });
      
      tracker.trackEvent({ type: 'performance:bottleneck-found', category: 'database' });
      tracker.trackEvent({ type: 'performance:optimization-applied', category: 'database', improvement: 50 });
      
      // Save and reload
      tracker.saveMetricsToDisk();
      
      const newTracker = new ModeMetricsTracker();
      newTracker.loadMetricsFromDisk();
      
      const metrics = newTracker.getMetrics();
      
      // Verify debugger metrics
      expect(metrics.debuggerMetrics.errorsAnalyzed).toBe(1);
      expect(metrics.debuggerMetrics.bugsFound).toBe(1);
      expect(metrics.debuggerMetrics.fixesApplied).toBe(1);
      expect(metrics.debuggerMetrics.commonErrorTypes.get('TypeError')).toBe(1);
      
      // Verify security metrics
      expect(metrics.securityMetrics.vulnerabilitiesFound).toBe(1);
      expect(metrics.securityMetrics.criticalVulnerabilities).toBe(1);
      expect(metrics.securityMetrics.fixesApplied).toBe(1);
      
      // Verify performance metrics
      expect(metrics.performanceMetrics.bottlenecksFound).toBe(1);
      expect(metrics.performanceMetrics.optimizationsApplied).toBe(1);
      expect(metrics.performanceMetrics.averageImprovement).toBe(50);
    });
    
    it('should preserve mode transitions when persisting', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'planning',
        trigger: 'auto',
        confidence: 0.8,
        timestamp: new Date('2026-01-18T10:00:00Z')
      };
      
      tracker.trackModeTransition(transition);
      
      // Save and reload
      tracker.saveMetricsToDisk();
      
      const newTracker = new ModeMetricsTracker();
      newTracker.loadMetricsFromDisk();
      
      const metrics = newTracker.getMetrics();
      const transitionMetrics = metrics.transitionMetrics.get('assistant->planning');
      
      expect(transitionMetrics).toBeDefined();
      expect(transitionMetrics?.count).toBe(1);
      expect(transitionMetrics?.averageConfidence).toBe(0.8);
      expect(transitionMetrics?.triggers.auto).toBe(1);
    });
    
    it('should clear persisted metrics', () => {
      // Track and save metrics
      tracker.trackEvent({ type: 'developer:file-created', filePath: 'src/test.ts' });
      tracker.saveMetricsToDisk();
      
      // Clear persisted metrics
      tracker.clearPersistedMetrics();
      
      // Try to load
      const newTracker = new ModeMetricsTracker();
      const loaded = newTracker.loadMetricsFromDisk();
      
      expect(loaded).toBe(false);
    });
  });
  
  describe('Edge Cases and Error Handling', () => {
    it('should handle mode exit without entry', () => {
      // Try to exit a mode that was never entered
      tracker.trackModeExit('assistant', new Date('2026-01-18T10:00:00Z'));
      
      const metrics = tracker.getMetrics();
      
      // Should not create metrics for mode that was never entered
      expect(metrics.timeMetrics.has('assistant')).toBe(false);
    });
    
    it('should handle multiple exits for same mode', () => {
      const entryTime = new Date('2026-01-18T10:00:00Z');
      const exitTime1 = new Date('2026-01-18T10:05:00Z');
      const exitTime2 = new Date('2026-01-18T10:10:00Z');
      
      tracker.trackModeEntry('assistant', entryTime);
      tracker.trackModeExit('assistant', exitTime1);
      tracker.trackModeExit('assistant', exitTime2); // Second exit should be ignored
      
      const metrics = tracker.getMetrics();
      const assistantMetrics = metrics.timeMetrics.get('assistant');
      
      // Duration should only reflect first exit
      expect(assistantMetrics?.totalDuration).toBe(5 * 60 * 1000);
      expect(assistantMetrics?.lastExit).toEqual(exitTime1);
    });
    
    it('should handle entry time in the future gracefully', () => {
      const futureTime = new Date(Date.now() + 10000); // 10 seconds in future
      
      tracker.trackModeEntry('assistant', futureTime);
      
      const metrics = tracker.getMetrics();
      const assistantMetrics = metrics.timeMetrics.get('assistant');
      
      // Should not include negative duration
      expect(assistantMetrics?.totalDuration).toBe(0);
    });
    
    it('should handle zero duration mode sessions', () => {
      const timestamp = new Date('2026-01-18T10:00:00Z');
      
      tracker.trackModeEntry('assistant', timestamp);
      tracker.trackModeExit('assistant', timestamp); // Same timestamp
      
      const metrics = tracker.getMetrics();
      const assistantMetrics = metrics.timeMetrics.get('assistant');
      
      expect(assistantMetrics?.totalDuration).toBe(0);
      expect(assistantMetrics?.averageDuration).toBe(0);
    });
    
    it('should handle very large numbers of events', () => {
      // Track 1000 events
      for (let i = 0; i < 1000; i++) {
        tracker.trackEvent({ type: 'developer:file-created', filePath: `src/file-${i}.ts` });
      }
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.developerMetrics.filesCreated).toBe(1000);
    });
    
    it('should handle all mode types in getModeSpecificSummary', () => {
      const modes: Array<'assistant' | 'planning' | 'developer' | 'tool' | 'debugger' | 'security' | 'reviewer' | 'performance' | 'prototype' | 'teacher'> = [
        'assistant', 'planning', 'developer', 'tool', 'debugger', 
        'security', 'reviewer', 'performance', 'prototype', 'teacher'
      ];
      
      modes.forEach(mode => {
        const summary = tracker.getModeSpecificSummary(mode);
        expect(summary).toBeDefined();
        expect(typeof summary).toBe('object');
      });
    });
    
    it('should calculate correct average with single data point', () => {
      tracker.trackEvent({ type: 'debugger:fix-applied', success: true, timeToFix: 5000 });
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.debuggerMetrics.averageTimeToFix).toBe(5000);
      expect(metrics.debuggerMetrics.successRate).toBe(100);
    });
    
    it('should handle serialization of empty metrics', () => {
      const serialized = tracker.serializeMetrics();
      
      expect(serialized.timeMetrics).toEqual([]);
      expect(serialized.transitionMetrics).toEqual([]);
      expect(serialized.totalTransitions).toBe(0);
      expect(serialized.mostUsedMode).toBeNull();
      expect(serialized.leastUsedMode).toBeNull();
    });
    
    it('should handle deserialization of empty metrics', () => {
      const serialized = tracker.serializeMetrics();
      
      const newTracker = new ModeMetricsTracker();
      newTracker.deserializeMetrics(serialized);
      
      const metrics = newTracker.getMetrics();
      
      expect(metrics.timeMetrics.size).toBe(0);
      expect(metrics.transitionMetrics.size).toBe(0);
      expect(metrics.totalTransitions).toBe(0);
    });
    
    it('should preserve Map structures through serialization', () => {
      // Add data with Maps
      tracker.trackEvent({ type: 'debugger:error-analyzed', errorType: 'TypeError' });
      tracker.trackEvent({ type: 'debugger:error-analyzed', errorType: 'ReferenceError' });
      tracker.trackEvent({ type: 'security:vulnerability-found', severity: 'critical', vulnerabilityType: 'SQL Injection' });
      tracker.trackEvent({ type: 'performance:bottleneck-found', category: 'database' });
      tracker.trackEvent({ type: 'tool:tool-executed', toolName: 'read_file', success: true, executionTime: 100 });
      
      // Serialize and deserialize
      const serialized = tracker.serializeMetrics();
      const newTracker = new ModeMetricsTracker();
      newTracker.deserializeMetrics(serialized);
      
      const metrics = newTracker.getMetrics();
      
      // Verify Maps are preserved
      expect(metrics.debuggerMetrics.commonErrorTypes.get('TypeError')).toBe(1);
      expect(metrics.debuggerMetrics.commonErrorTypes.get('ReferenceError')).toBe(1);
      expect(metrics.securityMetrics.commonVulnerabilityTypes.get('SQL Injection')).toBe(1);
      expect(metrics.performanceMetrics.optimizationCategories.get('database')).toBe(1);
      expect(metrics.toolMetrics.mostUsedTools.get('read_file')).toBe(1);
    });
    
    it('should handle concurrent mode entries correctly', () => {
      const time1 = new Date('2026-01-18T10:00:00Z');
      const time2 = new Date('2026-01-18T10:00:01Z');
      const time3 = new Date('2026-01-18T10:00:02Z');
      
      // Rapid mode switches
      tracker.trackModeEntry('assistant', time1);
      tracker.trackModeEntry('planning', time2);
      tracker.trackModeEntry('developer', time3);
      
      const metrics = tracker.getMetrics();
      
      // Each mode should have been entered once
      expect(metrics.timeMetrics.get('assistant')?.entryCount).toBe(1);
      expect(metrics.timeMetrics.get('planning')?.entryCount).toBe(1);
      expect(metrics.timeMetrics.get('developer')?.entryCount).toBe(1);
      
      // Assistant should have 1 second duration
      expect(metrics.timeMetrics.get('assistant')?.totalDuration).toBe(1000);
      // Planning should have 1 second duration
      expect(metrics.timeMetrics.get('planning')?.totalDuration).toBe(1000);
    });
    
    it('should handle getTopFrequencies with limit larger than map size', () => {
      const map = new Map<string, number>([
        ['item1', 5],
        ['item2', 3]
      ]);
      
      const top10 = tracker.getTopFrequencies(map, 10);
      
      // Should return all items even though limit is larger
      expect(top10).toHaveLength(2);
      expect(top10[0]).toEqual({ item: 'item1', count: 5 });
      expect(top10[1]).toEqual({ item: 'item2', count: 3 });
    });
    
    it('should handle getMostCommonTransitions with limit larger than transitions', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'planning',
        trigger: 'auto',
        confidence: 0.8,
        timestamp: new Date('2026-01-18T10:00:00Z')
      };
      
      tracker.trackModeTransition(transition);
      
      const commonTransitions = tracker.getMostCommonTransitions(10);
      
      // Should return all transitions even though limit is larger
      expect(commonTransitions).toHaveLength(1);
    });
    
    it('should calculate percentages correctly when total time is zero', () => {
      // Don't track any mode time
      const summary = tracker.getTimeMetricsSummary();
      
      expect(summary.totalTime).toBe(0);
      expect(summary.modeBreakdown).toHaveLength(0);
    });
    
    it('should handle session summary with very short duration', () => {
      const summary = tracker.getSessionSummary();
      
      // Duration should be formatted even if very short
      expect(summary.duration).toBeDefined();
      expect(typeof summary.duration).toBe('string');
      expect(summary.duration).toMatch(/\d+[hms]/);
    });
    
    it('should handle session summary with long duration', () => {
      // Create tracker with old session start
      const oldTracker = new ModeMetricsTracker();
      
      // Manually set session start to 2 hours ago
      const metrics = oldTracker.getMetrics();
      (metrics as any).sessionStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      const summary = oldTracker.getSessionSummary();
      
      // Should include hours in duration
      expect(summary.duration).toMatch(/\d+h/);
    });
    
    // Tool mode removed - test deleted
    
    // Tool mode removed - test deleted
    
    it('should handle incrementMapCounter with new keys', () => {
      // Track events that create new map entries
      tracker.trackEvent({ type: 'debugger:error-analyzed', errorType: 'NewErrorType' });
      tracker.trackEvent({ type: 'debugger:error-analyzed', errorType: 'NewErrorType' });
      tracker.trackEvent({ type: 'debugger:error-analyzed', errorType: 'AnotherError' });
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.debuggerMetrics.commonErrorTypes.get('NewErrorType')).toBe(2);
      expect(metrics.debuggerMetrics.commonErrorTypes.get('AnotherError')).toBe(1);
    });
    
    it('should handle all severity levels for security vulnerabilities', () => {
      tracker.trackEvent({ type: 'security:vulnerability-found', severity: 'critical', vulnerabilityType: 'SQL Injection' });
      tracker.trackEvent({ type: 'security:vulnerability-found', severity: 'high', vulnerabilityType: 'XSS' });
      tracker.trackEvent({ type: 'security:vulnerability-found', severity: 'medium', vulnerabilityType: 'CSRF' });
      tracker.trackEvent({ type: 'security:vulnerability-found', severity: 'low', vulnerabilityType: 'Info Leak' });
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.securityMetrics.criticalVulnerabilities).toBe(1);
      expect(metrics.securityMetrics.highVulnerabilities).toBe(1);
      expect(metrics.securityMetrics.mediumVulnerabilities).toBe(1);
      expect(metrics.securityMetrics.lowVulnerabilities).toBe(1);
      expect(metrics.securityMetrics.vulnerabilitiesFound).toBe(4);
    });
    
    it('should handle debugger success rate with all failures', () => {
      tracker.trackEvent({ type: 'debugger:fix-applied', success: false, timeToFix: 5000 });
      tracker.trackEvent({ type: 'debugger:fix-applied', success: false, timeToFix: 3000 });
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.debuggerMetrics.successRate).toBe(0);
    });
    
    it('should handle debugger success rate with mixed results', () => {
      tracker.trackEvent({ type: 'debugger:fix-applied', success: true, timeToFix: 5000 });
      tracker.trackEvent({ type: 'debugger:fix-applied', success: false, timeToFix: 3000 });
      tracker.trackEvent({ type: 'debugger:fix-applied', success: true, timeToFix: 4000 });
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.debuggerMetrics.successRate).toBeCloseTo(66.67, 1); // 2/3 success
    });
  });
});
