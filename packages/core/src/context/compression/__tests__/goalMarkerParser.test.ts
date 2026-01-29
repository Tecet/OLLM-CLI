/**
 * Unit Tests for Goal Marker Parser
 *
 * Tests parsing of goal markers from LLM summaries.
 *
 * Requirements: FR-10
 */

import { describe, it, expect } from 'vitest';
import { GoalMarkerParser } from '../goalMarkerParser.js';

describe('GoalMarkerParser', () => {
  describe('parse', () => {
    it('should parse checkpoint markers', () => {
      const parser = new GoalMarkerParser();
      const summary = `
        Summary of work completed.
        [CHECKPOINT] Implement authentication - COMPLETED
        [CHECKPOINT] Add database schema - IN-PROGRESS
        [CHECKPOINT] Write unit tests - PENDING
      `;

      const updates = parser.parse(summary);

      expect(updates).toHaveLength(3);
      expect(updates[0]).toEqual({
        type: 'checkpoint',
        description: 'Implement authentication',
        status: 'completed',
      });
      expect(updates[1]).toEqual({
        type: 'checkpoint',
        description: 'Add database schema',
        status: 'in-progress',
      });
      expect(updates[2]).toEqual({
        type: 'checkpoint',
        description: 'Write unit tests',
        status: 'pending',
      });
    });

    it('should parse decision markers', () => {
      const parser = new GoalMarkerParser();
      const summary = `
        Summary of decisions made.
        [DECISION] Use PostgreSQL database - LOCKED
        [DECISION] Deploy on AWS
      `;

      const updates = parser.parse(summary);

      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({
        type: 'decision',
        description: 'Use PostgreSQL database',
        locked: true,
      });
      expect(updates[1]).toEqual({
        type: 'decision',
        description: 'Deploy on AWS',
        locked: false,
      });
    });

    it('should parse artifact markers', () => {
      const parser = new GoalMarkerParser();
      const summary = `
        Summary of artifacts.
        [ARTIFACT] Created src/auth/login.ts
        [ARTIFACT] Modified tests/auth.test.ts
        [ARTIFACT] Deleted config/old-config.json
      `;

      const updates = parser.parse(summary);

      expect(updates).toHaveLength(3);
      expect(updates[0]).toEqual({
        type: 'artifact',
        action: 'created',
        path: 'src/auth/login.ts',
      });
      expect(updates[1]).toEqual({
        type: 'artifact',
        action: 'modified',
        path: 'tests/auth.test.ts',
      });
      expect(updates[2]).toEqual({
        type: 'artifact',
        action: 'deleted',
        path: 'config/old-config.json',
      });
    });

    it('should parse mixed markers', () => {
      const parser = new GoalMarkerParser();
      const summary = `
        Summary of work completed.
        [CHECKPOINT] Implement authentication - COMPLETED
        [DECISION] Use JWT tokens - LOCKED
        [ARTIFACT] Created src/auth/login.ts
        Some additional text here.
        [CHECKPOINT] Add tests - IN-PROGRESS
      `;

      const updates = parser.parse(summary);

      expect(updates).toHaveLength(4);
      expect(updates[0].type).toBe('checkpoint');
      expect(updates[1].type).toBe('decision');
      expect(updates[2].type).toBe('artifact');
      expect(updates[3].type).toBe('checkpoint');
    });

    it('should handle empty summary', () => {
      const parser = new GoalMarkerParser();
      const updates = parser.parse('');

      expect(updates).toHaveLength(0);
    });

    it('should handle summary with no markers', () => {
      const parser = new GoalMarkerParser();
      const summary = 'This is a regular summary with no markers.';

      const updates = parser.parse(summary);

      expect(updates).toHaveLength(0);
    });

    it('should ignore malformed markers', () => {
      const parser = new GoalMarkerParser();
      const summary = `
        [CHECKPOINT] Missing status
        [DECISION]
        [ARTIFACT] Missing action
        [CHECKPOINT] Valid checkpoint - COMPLETED
      `;

      const updates = parser.parse(summary);

      // Only the valid checkpoint should be parsed
      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual({
        type: 'checkpoint',
        description: 'Valid checkpoint',
        status: 'completed',
      });
    });

    it('should handle case-insensitive status', () => {
      const parser = new GoalMarkerParser();
      const summary = `
        [CHECKPOINT] Task 1 - completed
        [CHECKPOINT] Task 2 - COMPLETED
        [CHECKPOINT] Task 3 - Completed
      `;

      const updates = parser.parse(summary);

      expect(updates).toHaveLength(3);
      expect(updates[0].type).toBe('checkpoint');
      expect(updates[1].type).toBe('checkpoint');
      expect(updates[2].type).toBe('checkpoint');
      
      // Type guard to access status property
      if (updates[0].type === 'checkpoint') {
        expect(updates[0].status).toBe('completed');
      }
      if (updates[1].type === 'checkpoint') {
        expect(updates[1].status).toBe('completed');
      }
      if (updates[2].type === 'checkpoint') {
        expect(updates[2].status).toBe('completed');
      }
    });

    it('should handle case-insensitive actions', () => {
      const parser = new GoalMarkerParser();
      const summary = `
        [ARTIFACT] created file1.ts
        [ARTIFACT] Created file2.ts
        [ARTIFACT] CREATED file3.ts
      `;

      const updates = parser.parse(summary);

      expect(updates).toHaveLength(3);
      expect(updates[0].type).toBe('artifact');
      expect(updates[1].type).toBe('artifact');
      expect(updates[2].type).toBe('artifact');
      
      // Type guard to access action property
      if (updates[0].type === 'artifact') {
        expect(updates[0].action).toBe('created');
      }
      if (updates[1].type === 'artifact') {
        expect(updates[1].action).toBe('created');
      }
      if (updates[2].type === 'artifact') {
        expect(updates[2].action).toBe('created');
      }
    });
  });

  describe('hasMarkers', () => {
    it('should return true if summary has checkpoint markers', () => {
      const parser = new GoalMarkerParser();
      const summary = 'Some text [CHECKPOINT] Task - COMPLETED';

      expect(parser.hasMarkers(summary)).toBe(true);
    });

    it('should return true if summary has decision markers', () => {
      const parser = new GoalMarkerParser();
      const summary = 'Some text [DECISION] Use PostgreSQL';

      expect(parser.hasMarkers(summary)).toBe(true);
    });

    it('should return true if summary has artifact markers', () => {
      const parser = new GoalMarkerParser();
      const summary = 'Some text [ARTIFACT] Created file.ts';

      expect(parser.hasMarkers(summary)).toBe(true);
    });

    it('should return false if summary has no markers', () => {
      const parser = new GoalMarkerParser();
      const summary = 'This is a regular summary with no markers.';

      expect(parser.hasMarkers(summary)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should count markers by type', () => {
      const parser = new GoalMarkerParser();
      const summary = `
        [CHECKPOINT] Task 1 - COMPLETED
        [CHECKPOINT] Task 2 - IN-PROGRESS
        [DECISION] Decision 1 - LOCKED
        [ARTIFACT] Created file1.ts
        [ARTIFACT] Modified file2.ts
        [ARTIFACT] Deleted file3.ts
      `;

      const stats = parser.getStats(summary);

      expect(stats.checkpoints).toBe(2);
      expect(stats.decisions).toBe(1);
      expect(stats.artifacts).toBe(3);
      expect(stats.total).toBe(6);
    });

    it('should return zeros for summary with no markers', () => {
      const parser = new GoalMarkerParser();
      const summary = 'No markers here.';

      const stats = parser.getStats(summary);

      expect(stats.checkpoints).toBe(0);
      expect(stats.decisions).toBe(0);
      expect(stats.artifacts).toBe(0);
      expect(stats.total).toBe(0);
    });
  });
});
