/**
 * Tests for Mode Templates
 * 
 * Tests that all mode templates are properly defined and contain expected content.
 */

import { describe, it, expect } from 'vitest';
import {
  ASSISTANT_MODE_TEMPLATE,
  PLANNING_MODE_TEMPLATE,
  DEVELOPER_MODE_TEMPLATE,
  DEBUGGER_MODE_TEMPLATE,
  REVIEWER_MODE_TEMPLATE,
  MODE_TEMPLATES,
  MODE_METADATA
} from '../index.js';

describe('Mode Templates', () => {
  describe('Template Exports', () => {
    it('should export all mode templates', () => {
      expect(ASSISTANT_MODE_TEMPLATE).toBeDefined();
      expect(PLANNING_MODE_TEMPLATE).toBeDefined();
      expect(DEVELOPER_MODE_TEMPLATE).toBeDefined();
      expect(DEBUGGER_MODE_TEMPLATE).toBeDefined();
      expect(REVIEWER_MODE_TEMPLATE).toBeDefined();
    });

    it('should export MODE_TEMPLATES map', () => {
      expect(MODE_TEMPLATES).toBeDefined();
      expect(MODE_TEMPLATES.assistant).toBe(ASSISTANT_MODE_TEMPLATE);
      expect(MODE_TEMPLATES.planning).toBe(PLANNING_MODE_TEMPLATE);
      expect(MODE_TEMPLATES.developer).toBe(DEVELOPER_MODE_TEMPLATE);
      expect(MODE_TEMPLATES.debugger).toBe(DEBUGGER_MODE_TEMPLATE);
      expect(MODE_TEMPLATES.reviewer).toBe(REVIEWER_MODE_TEMPLATE);
    });

    it('should export MODE_METADATA', () => {
      expect(MODE_METADATA).toBeDefined();
      expect(Object.keys(MODE_METADATA)).toHaveLength(5);
    });
  });

  describe('Template Content', () => {
    it('should have non-empty templates', () => {
      expect(ASSISTANT_MODE_TEMPLATE.length).toBeGreaterThan(0);
      expect(PLANNING_MODE_TEMPLATE.length).toBeGreaterThan(0);
      expect(DEVELOPER_MODE_TEMPLATE.length).toBeGreaterThan(0);
      expect(DEBUGGER_MODE_TEMPLATE.length).toBeGreaterThan(0);
      expect(REVIEWER_MODE_TEMPLATE.length).toBeGreaterThan(0);
    });

    it('should have string templates', () => {
      expect(typeof ASSISTANT_MODE_TEMPLATE).toBe('string');
      expect(typeof PLANNING_MODE_TEMPLATE).toBe('string');
      expect(typeof DEVELOPER_MODE_TEMPLATE).toBe('string');
      expect(typeof DEBUGGER_MODE_TEMPLATE).toBe('string');
      expect(typeof REVIEWER_MODE_TEMPLATE).toBe('string');
    });
  });

  describe('Assistant Mode Template', () => {
    it('should contain assistant persona', () => {
      expect(ASSISTANT_MODE_TEMPLATE).toContain('helpful AI assistant');
    });

    it('should mention conversation capabilities', () => {
      expect(ASSISTANT_MODE_TEMPLATE).toContain('answer questions');
      expect(ASSISTANT_MODE_TEMPLATE).toContain('explain concepts');
    });

    it('should suggest mode switching for implementation', () => {
      expect(ASSISTANT_MODE_TEMPLATE).toContain('Developer mode');
    });
  });

  describe('Planning Mode Template', () => {
    it('should contain planning persona', () => {
      expect(PLANNING_MODE_TEMPLATE).toContain('architect');
    });

    it('should mention research and design', () => {
      expect(PLANNING_MODE_TEMPLATE).toContain('research');
      expect(PLANNING_MODE_TEMPLATE).toContain('design');
    });

    it('should mention restrictions', () => {
      expect(PLANNING_MODE_TEMPLATE).toContain('CANNOT');
    });

    it('should suggest switching to developer mode', () => {
      expect(PLANNING_MODE_TEMPLATE).toContain('Developer mode');
    });
  });

  describe('Developer Mode Template', () => {
    it('should contain developer persona', () => {
      expect(DEVELOPER_MODE_TEMPLATE).toContain('senior software engineer');
    });

    it('should mention core mandates', () => {
      expect(DEVELOPER_MODE_TEMPLATE).toContain('Core Mandates');
      expect(DEVELOPER_MODE_TEMPLATE).toContain('project conventions');
    });

    it('should mention development workflow', () => {
      expect(DEVELOPER_MODE_TEMPLATE).toContain('Development Workflow');
      expect(DEVELOPER_MODE_TEMPLATE).toContain('Read files before modifying');
    });

    it('should mention code quality practices', () => {
      expect(DEVELOPER_MODE_TEMPLATE).toContain('Follow existing patterns');
      expect(DEVELOPER_MODE_TEMPLATE).toContain('Test');
    });
  });

  describe('Debugger Mode Template', () => {
    it('should contain debugger persona', () => {
      expect(DEBUGGER_MODE_TEMPLATE).toContain('debugging specialist');
    });

    it('should mention debugging methodology', () => {
      expect(DEBUGGER_MODE_TEMPLATE).toContain('Debugging Methodology');
      expect(DEBUGGER_MODE_TEMPLATE).toContain('Reproduce');
    });

    it('should mention debugging principles', () => {
      expect(DEBUGGER_MODE_TEMPLATE).toContain('Debugging Principles');
      expect(DEBUGGER_MODE_TEMPLATE).toContain('verify');
    });

    it('should mention common bug categories', () => {
      expect(DEBUGGER_MODE_TEMPLATE).toContain('Bug Categories');
    });
  });

  describe('Reviewer Mode Template', () => {
    it('should contain reviewer persona', () => {
      expect(REVIEWER_MODE_TEMPLATE).toContain('code reviewer');
    });

    it('should mention code review checklist', () => {
      expect(REVIEWER_MODE_TEMPLATE).toContain('Code Review Checklist');
      expect(REVIEWER_MODE_TEMPLATE).toContain('Functionality');
    });

    it('should mention review approach', () => {
      expect(REVIEWER_MODE_TEMPLATE).toContain('Review Approach');
    });

    it('should mention feedback format', () => {
      expect(REVIEWER_MODE_TEMPLATE).toContain('Feedback Format');
    });
  });

  describe('Mode Metadata', () => {
    it('should have metadata for all modes', () => {
      const modes = ['assistant', 'planning', 'developer', 'debugger', 'reviewer'];
      
      for (const mode of modes) {
        expect(MODE_METADATA[mode as keyof typeof MODE_METADATA]).toBeDefined();
      }
    });

    it('should have complete metadata for each mode', () => {
      const modes = Object.keys(MODE_METADATA);
      
      for (const mode of modes) {
        const metadata = MODE_METADATA[mode as keyof typeof MODE_METADATA];
        
        expect(metadata.name).toBeDefined();
        expect(metadata.persona).toBeDefined();
        expect(metadata.icon).toBeDefined();
        expect(metadata.color).toBeDefined();
        expect(metadata.description).toBeDefined();
        
        expect(typeof metadata.name).toBe('string');
        expect(typeof metadata.persona).toBe('string');
        expect(typeof metadata.icon).toBe('string');
        expect(typeof metadata.color).toBe('string');
        expect(typeof metadata.description).toBe('string');
      }
    });

    it('should have unique icons for each mode', () => {
      const icons = Object.values(MODE_METADATA).map(m => m.icon);
      const uniqueIcons = new Set(icons);
      
      expect(uniqueIcons.size).toBe(icons.length);
    });

    it('should have unique colors for each mode', () => {
      const colors = Object.values(MODE_METADATA).map(m => m.color);
      const uniqueColors = new Set(colors);
      
      expect(uniqueColors.size).toBe(colors.length);
    });

    it('should have correct icons', () => {
      expect(MODE_METADATA.assistant.icon).toBe('💬');
      expect(MODE_METADATA.planning.icon).toBe('📋');
      expect(MODE_METADATA.developer.icon).toBe('👨‍💻');
      expect(MODE_METADATA.debugger.icon).toBe('🐛');
      expect(MODE_METADATA.reviewer.icon).toBe('👀');
    });

    it('should have correct colors', () => {
      expect(MODE_METADATA.assistant.color).toBe('blue');
      expect(MODE_METADATA.planning.color).toBe('yellow');
      expect(MODE_METADATA.developer.color).toBe('green');
      expect(MODE_METADATA.debugger.color).toBe('red');
      expect(MODE_METADATA.reviewer.color).toBe('orange');
    });

    it('should have correct personas', () => {
      expect(MODE_METADATA.assistant.persona).toBe('Helpful AI Assistant');
      expect(MODE_METADATA.planning.persona).toBe('Technical Architect & Planner');
      expect(MODE_METADATA.developer.persona).toBe('Senior Software Engineer');
      expect(MODE_METADATA.debugger.persona).toBe('Senior Debugging Specialist');
      expect(MODE_METADATA.reviewer.persona).toBe('Senior Code Reviewer');
    });
  });

  describe('Template Consistency', () => {
    it('should have templates matching MODE_TEMPLATES keys', () => {
      const templateKeys = Object.keys(MODE_TEMPLATES);
      const metadataKeys = Object.keys(MODE_METADATA);
      
      expect(templateKeys.sort()).toEqual(metadataKeys.sort());
    });

    it('should have all templates as non-empty strings', () => {
      for (const [mode, template] of Object.entries(MODE_TEMPLATES)) {
        expect(typeof template).toBe('string');
        expect(template.length).toBeGreaterThan(0);
      }
    });

    it('should have reasonable template lengths', () => {
      for (const [mode, template] of Object.entries(MODE_TEMPLATES)) {
        // Templates should be at least 50 characters
        expect(template.length).toBeGreaterThan(50);
        // Templates should be less than 10000 characters
        expect(template.length).toBeLessThan(10000);
      }
    });
  });

  describe('Template Rendering', () => {
    it('should render templates without errors', () => {
      for (const [mode, template] of Object.entries(MODE_TEMPLATES)) {
        expect(() => {
          const rendered = template.toString();
          expect(rendered).toBeDefined();
        }).not.toThrow();
      }
    });

    it('should preserve newlines in templates', () => {
      // Most templates should have multiple lines
      expect(DEVELOPER_MODE_TEMPLATE.split('\n').length).toBeGreaterThan(5);
      expect(DEBUGGER_MODE_TEMPLATE.split('\n').length).toBeGreaterThan(5);
      expect(REVIEWER_MODE_TEMPLATE.split('\n').length).toBeGreaterThan(5);
    });

    it('should not have leading/trailing excessive whitespace', () => {
      for (const [mode, template] of Object.entries(MODE_TEMPLATES)) {
        // Should not start with more than 2 newlines
        expect(template).not.toMatch(/^\n{3,}/);
        // Should not end with more than 2 newlines
        expect(template).not.toMatch(/\n{3,}$/);
      }
    });
  });

  describe('Template Accessibility', () => {
    it('should be accessible via MODE_TEMPLATES map', () => {
      expect(MODE_TEMPLATES['assistant']).toBe(ASSISTANT_MODE_TEMPLATE);
      expect(MODE_TEMPLATES['planning']).toBe(PLANNING_MODE_TEMPLATE);
      expect(MODE_TEMPLATES['developer']).toBe(DEVELOPER_MODE_TEMPLATE);
      expect(MODE_TEMPLATES['debugger']).toBe(DEBUGGER_MODE_TEMPLATE);
      expect(MODE_TEMPLATES['reviewer']).toBe(REVIEWER_MODE_TEMPLATE);
    });

    it('should support dynamic mode lookup', () => {
      const modes = ['assistant', 'planning', 'developer', 'debugger', 'reviewer'];
      
      for (const mode of modes) {
        const template = MODE_TEMPLATES[mode as keyof typeof MODE_TEMPLATES];
        expect(template).toBeDefined();
        expect(typeof template).toBe('string');
        expect(template.length).toBeGreaterThan(0);
      }
    });
  });
});
