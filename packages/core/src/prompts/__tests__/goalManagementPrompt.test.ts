/**
 * Goal Management Marker Parser Tests
 * 
 * Tests for parsing structured text markers from non-tool models
 */

import { describe, it, expect } from 'vitest';
import { GoalManagementParser } from '../goalManagementPrompt.js';

describe('GoalManagementParser', () => {
  describe('NEW_GOAL Marker', () => {
    it('should parse NEW_GOAL marker', () => {
      const text = 'NEW_GOAL: Fix authentication bug | high';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.newGoals).toHaveLength(1);
      expect(markers.newGoals[0].description).toBe('Fix authentication bug');
      expect(markers.newGoals[0].priority).toBe('high');
    });

    it('should parse multiple NEW_GOAL markers', () => {
      const text = `
        NEW_GOAL: First goal | high
        NEW_GOAL: Second goal | medium
        NEW_GOAL: Third goal | low
      `;
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.newGoals).toHaveLength(3);
      expect(markers.newGoals[0].priority).toBe('high');
      expect(markers.newGoals[1].priority).toBe('medium');
      expect(markers.newGoals[2].priority).toBe('low');
    });

    it('should be case-insensitive', () => {
      const text = 'new_goal: Test goal | HIGH';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.newGoals).toHaveLength(1);
      expect(markers.newGoals[0].priority).toBe('high');
    });
  });

  describe('CHECKPOINT Marker', () => {
    it('should parse CHECKPOINT marker', () => {
      const text = 'CHECKPOINT: Completed phase 1';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.checkpoints).toHaveLength(1);
      expect(markers.checkpoints[0].description).toBe('Completed phase 1');
    });

    it('should parse multiple checkpoints', () => {
      const text = `
        CHECKPOINT: Step 1 complete
        CHECKPOINT: Step 2 complete
      `;
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.checkpoints).toHaveLength(2);
    });
  });

  describe('DECISION Marker', () => {
    it('should parse DECISION marker', () => {
      const text = 'DECISION: Use TypeScript | Better type safety';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.decisions).toHaveLength(1);
      expect(markers.decisions[0].description).toBe('Use TypeScript');
      expect(markers.decisions[0].rationale).toBe('Better type safety');
      expect(markers.decisions[0].locked).toBe(false);
    });

    it('should parse DECISION_LOCKED marker', () => {
      const text = 'DECISION_LOCKED: Use bcrypt | Industry standard';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.decisions).toHaveLength(1);
      expect(markers.decisions[0].locked).toBe(true);
    });

    it('should parse multiple decisions', () => {
      const text = `
        DECISION: Decision 1 | Rationale 1
        DECISION_LOCKED: Decision 2 | Rationale 2
      `;
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.decisions).toHaveLength(2);
      expect(markers.decisions[0].locked).toBe(false);
      expect(markers.decisions[1].locked).toBe(true);
    });
  });

  describe('ARTIFACT Marker', () => {
    it('should parse ARTIFACT marker', () => {
      const text = 'ARTIFACT: src/auth.ts | modified';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.artifacts).toHaveLength(1);
      expect(markers.artifacts[0].path).toBe('src/auth.ts');
      expect(markers.artifacts[0].action).toBe('modified');
    });

    it('should parse all artifact actions', () => {
      const text = `
        ARTIFACT: file1.ts | created
        ARTIFACT: file2.ts | modified
        ARTIFACT: file3.ts | deleted
      `;
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.artifacts).toHaveLength(3);
      expect(markers.artifacts[0].action).toBe('created');
      expect(markers.artifacts[1].action).toBe('modified');
      expect(markers.artifacts[2].action).toBe('deleted');
    });
  });

  describe('GOAL_COMPLETE Marker', () => {
    it('should parse GOAL_COMPLETE marker', () => {
      const text = 'GOAL_COMPLETE: Successfully fixed the bug';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.goalComplete).toBe('Successfully fixed the bug');
    });

    it('should only keep last GOAL_COMPLETE', () => {
      const text = `
        GOAL_COMPLETE: First completion
        GOAL_COMPLETE: Second completion
      `;
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.goalComplete).toBe('Second completion');
    });
  });

  describe('GOAL_PAUSE Marker', () => {
    it('should parse GOAL_PAUSE marker', () => {
      const text = 'GOAL_PAUSE';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.goalPause).toBe(true);
    });

    it('should be case-insensitive', () => {
      const text = 'goal_pause';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.goalPause).toBe(true);
    });
  });

  describe('Mixed Markers', () => {
    it('should parse multiple marker types', () => {
      const text = `
        I'll start working on this task.
        
        NEW_GOAL: Fix authentication bug | high
        
        Let me analyze the code...
        
        CHECKPOINT: Found the bug in validateUser()
        DECISION: Add null check | Prevents crash on undefined user
        
        Now implementing the fix...
        
        ARTIFACT: src/auth/login.ts | modified
        ARTIFACT: tests/login.test.ts | created
        
        All done!
        
        GOAL_COMPLETE: Fixed authentication bug with tests
      `;
      
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.newGoals).toHaveLength(1);
      expect(markers.checkpoints).toHaveLength(1);
      expect(markers.decisions).toHaveLength(1);
      expect(markers.artifacts).toHaveLength(2);
      expect(markers.goalComplete).toBe('Fixed authentication bug with tests');
    });
  });

  describe('Marker Removal', () => {
    it('should remove markers from text', () => {
      const text = `
        I'll start working on this.
        NEW_GOAL: Test goal | high
        Let me analyze...
        CHECKPOINT: Step 1 done
        All finished!
        GOAL_COMPLETE: Done
      `;
      
      const cleaned = GoalManagementParser.removeMarkers(text);
      
      expect(cleaned).not.toContain('NEW_GOAL');
      expect(cleaned).not.toContain('CHECKPOINT');
      expect(cleaned).not.toContain('GOAL_COMPLETE');
      expect(cleaned).toContain('I\'ll start working on this.');
      expect(cleaned).toContain('Let me analyze...');
      expect(cleaned).toContain('All finished!');
    });

    it('should preserve non-marker content', () => {
      const text = `
        This is regular text.
        NEW_GOAL: Test | high
        More regular text.
      `;
      
      const cleaned = GoalManagementParser.removeMarkers(text);
      
      expect(cleaned).toContain('This is regular text.');
      expect(cleaned).toContain('More regular text.');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', () => {
      const markers = GoalManagementParser.parse('');
      
      expect(markers.newGoals).toHaveLength(0);
      expect(markers.checkpoints).toHaveLength(0);
      expect(markers.decisions).toHaveLength(0);
      expect(markers.artifacts).toHaveLength(0);
      expect(markers.goalComplete).toBeNull();
      expect(markers.goalPause).toBe(false);
    });

    it('should handle text with no markers', () => {
      const text = 'This is just regular text with no markers.';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.newGoals).toHaveLength(0);
      expect(markers.checkpoints).toHaveLength(0);
    });

    it('should handle malformed markers', () => {
      const text = `
        NEW_GOAL: Missing priority
        DECISION: Missing rationale
        ARTIFACT: Missing action
      `;
      
      const markers = GoalManagementParser.parse(text);
      
      // Malformed markers should be ignored
      expect(markers.newGoals).toHaveLength(0);
      expect(markers.decisions).toHaveLength(0);
      expect(markers.artifacts).toHaveLength(0);
    });

    it('should handle markers with extra whitespace', () => {
      const text = '  NEW_GOAL:   Test goal   |   high  ';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.newGoals).toHaveLength(1);
      expect(markers.newGoals[0].description).toBe('Test goal');
      expect(markers.newGoals[0].priority).toBe('high');
    });

    it('should handle markers with special characters', () => {
      const text = 'CHECKPOINT: Fixed bug in user.validate() method';
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.checkpoints).toHaveLength(1);
      expect(markers.checkpoints[0].description).toContain('user.validate()');
    });

    it('should handle multiline text', () => {
      const text = `Line 1
Line 2
NEW_GOAL: Test | high
Line 3
CHECKPOINT: Done
Line 4`;
      
      const markers = GoalManagementParser.parse(text);
      
      expect(markers.newGoals).toHaveLength(1);
      expect(markers.checkpoints).toHaveLength(1);
    });
  });
});
