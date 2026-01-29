/**
 * Property-Based Tests for Mode-Aware Compression
 *
 * **Property 24: Mode-Specific Preservation**
 * **Validates: Requirements FR-12**
 *
 * Tests that mode-aware compression correctly preserves content based on
 * operational mode and applies appropriate summarization strategies.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ModeAwareCompression } from '../modeAwareCompression.js';
import { OperationalMode } from '../../types.js';

describe('Property 24: Mode-Specific Preservation', () => {
  const modeAware = new ModeAwareCompression();

  describe('Summarization Prompts', () => {
    it('should always include base prompt and mode-specific instructions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(OperationalMode)),
          fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
          (mode, level) => {
            const prompt = modeAware.getSummarizationPrompt(mode, level);

            // Must be non-empty
            expect(prompt.length).toBeGreaterThan(0);

            // Must contain summarization instruction
            expect(prompt.toLowerCase()).toMatch(/summarize|summary/);

            // Must contain mode-specific keywords
            const profile = modeAware.getModeProfile(mode);
            const hasRelevantKeywords = profile.neverCompress.some(keyword =>
              prompt.toLowerCase().includes(keyword.toLowerCase().replace('_', ' '))
            );

            expect(hasRelevantKeywords).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different prompts for different modes', () => {
      fc.assert(
        fc.property(fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>, level => {
          const modes = Object.values(OperationalMode);
          const prompts = modes.map(mode => modeAware.getSummarizationPrompt(mode, level));

          // All prompts should be unique
          const uniquePrompts = new Set(prompts);
          expect(uniquePrompts.size).toBe(modes.length);
        }),
        { numRuns: 10 }
      );
    });

    it('should produce different prompts for different compression levels', () => {
      fc.assert(
        fc.property(fc.constantFrom(...Object.values(OperationalMode)), mode => {
          const levels: (1 | 2 | 3)[] = [1, 2, 3];
          const prompts = levels.map(level => modeAware.getSummarizationPrompt(mode, level));

          // All prompts should be unique
          const uniquePrompts = new Set(prompts);
          expect(uniquePrompts.size).toBe(levels.length);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Preservation Strategy', () => {
    it('should preserve code in developer and debugger modes', () => {
      fc.assert(
        fc.property(fc.constantFrom(...Object.values(OperationalMode)), mode => {
          const strategy = modeAware.getPreservationStrategy(mode);

          if (mode === OperationalMode.DEVELOPER || mode === OperationalMode.DEBUGGER) {
            expect(strategy.preserveCode).toBe(true);
          } else {
            expect(strategy.preserveCode).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve goals in planning mode', () => {
      fc.assert(
        fc.property(fc.constantFrom(...Object.values(OperationalMode)), mode => {
          const strategy = modeAware.getPreservationStrategy(mode);

          if (mode === OperationalMode.PLANNING) {
            expect(strategy.preserveGoals).toBe(true);
          } else {
            expect(strategy.preserveGoals).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve errors in debugger mode', () => {
      fc.assert(
        fc.property(fc.constantFrom(...Object.values(OperationalMode)), mode => {
          const strategy = modeAware.getPreservationStrategy(mode);

          if (mode === OperationalMode.DEBUGGER) {
            expect(strategy.preserveErrors).toBe(true);
          } else {
            expect(strategy.preserveErrors).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should always preserve decisions regardless of mode', () => {
      fc.assert(
        fc.property(fc.constantFrom(...Object.values(OperationalMode)), mode => {
          const strategy = modeAware.getPreservationStrategy(mode);
          expect(strategy.preserveDecisions).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should include mode-specific never-compress items', () => {
      fc.assert(
        fc.property(fc.constantFrom(...Object.values(OperationalMode)), mode => {
          const strategy = modeAware.getPreservationStrategy(mode);
          const profile = modeAware.getModeProfile(mode);

          expect(strategy.additionalPreservation).toEqual(profile.neverCompress);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Content Detection', () => {
    it('should detect code blocks in developer/debugger modes', () => {
      const codeExamples = [
        '```typescript\nfunction test() {}\n```',
        'function myFunc() { return 42; }',
        'const x = 10;',
        'import { foo } from "bar";',
        'class MyClass {}',
        'interface ITest {}',
        'src/components/Button.tsx',
      ];

      fc.assert(
        fc.property(fc.constantFrom(...codeExamples), code => {
          const shouldPreserveDev = modeAware.shouldPreserveContent(
            code,
            OperationalMode.DEVELOPER
          );
          const shouldPreserveDebug = modeAware.shouldPreserveContent(
            code,
            OperationalMode.DEBUGGER
          );

          expect(shouldPreserveDev).toBe(true);
          expect(shouldPreserveDebug).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('should detect errors in debugger mode', () => {
      const errorExamples = [
        'Error: Something went wrong',
        'TypeError: Cannot read property',
        'Exception: Failed to execute',
        'Stack trace: at myFunc (file.ts:10:5)',
        'ReferenceError: x is not defined',
      ];

      fc.assert(
        fc.property(fc.constantFrom(...errorExamples), error => {
          const shouldPreserve = modeAware.shouldPreserveContent(
            error,
            OperationalMode.DEBUGGER
          );

          expect(shouldPreserve).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('should detect goals in planning mode', () => {
      const goalExamples = [
        '[GOAL] Implement user authentication',
        '[CHECKPOINT] Database schema created',
        '[DECISION] Use PostgreSQL for storage',
        'Goal: Complete the feature by Friday',
        'Objective: Improve performance by 50%',
        'Requirement: Must support 1000 concurrent users',
      ];

      fc.assert(
        fc.property(fc.constantFrom(...goalExamples), goal => {
          const shouldPreserve = modeAware.shouldPreserveContent(goal, OperationalMode.PLANNING);

          expect(shouldPreserve).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('should not preserve generic content in wrong mode', () => {
      const genericContent = 'This is just a regular conversation message.';

      fc.assert(
        fc.property(fc.constantFrom(...Object.values(OperationalMode)), mode => {
          const shouldPreserve = modeAware.shouldPreserveContent(genericContent, mode);

          // Generic content should not be automatically preserved
          expect(shouldPreserve).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Mode Transitions', () => {
    it('should allow all mode transitions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(OperationalMode)),
          fc.constantFrom(...Object.values(OperationalMode)),
          (fromMode, toMode) => {
            const isValid = modeAware.validateModeTransition(fromMode, toMode);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Compression Levels', () => {
    it('should recommend appropriate compression levels for each mode', () => {
      fc.assert(
        fc.property(fc.constantFrom(...Object.values(OperationalMode)), mode => {
          const level = modeAware.getRecommendedCompressionLevel(mode);

          // Level must be 1, 2, or 3
          expect([1, 2, 3]).toContain(level);

          // Developer and Debugger should prefer detailed (3)
          if (mode === OperationalMode.DEVELOPER || mode === OperationalMode.DEBUGGER) {
            expect(level).toBe(3);
          }

          // Planning and Assistant should prefer moderate (2)
          if (mode === OperationalMode.PLANNING || mode === OperationalMode.ASSISTANT) {
            expect(level).toBe(2);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Information Extraction', () => {
    it('should extract mode-specific information using extraction rules', () => {
      const testCases = [
        {
          mode: OperationalMode.DEVELOPER,
          content: 'We decided to use TypeScript because of type safety.',
          expectedPattern: /architecture_decision/,
        },
        {
          mode: OperationalMode.PLANNING,
          content: 'Task: Implement user authentication by Friday.',
          expectedPattern: /task/,
        },
        {
          mode: OperationalMode.DEBUGGER,
          content: 'Error: Connection timeout occurred.',
          expectedPattern: /error/,
        },
      ];

      fc.assert(
        fc.property(fc.constantFrom(...testCases), testCase => {
          const extracted = modeAware.extractImportantInfo(testCase.content, testCase.mode);

          if (extracted.length > 0) {
            const hasExpectedPattern = extracted.some(item =>
              testCase.expectedPattern.test(item)
            );
            expect(hasExpectedPattern).toBe(true);
          }
        }),
        { numRuns: 30 }
      );
    });
  });

  describe('Compression Priority', () => {
    it('should return non-empty compression priority for all modes', () => {
      fc.assert(
        fc.property(fc.constantFrom(...Object.values(OperationalMode)), mode => {
          const priority = modeAware.getCompressionPriority(mode);

          expect(priority.length).toBeGreaterThan(0);
          expect(Array.isArray(priority)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return different priorities for different modes', () => {
      const modes = Object.values(OperationalMode);
      const priorities = modes.map(mode => modeAware.getCompressionPriority(mode).join(','));

      // At least some modes should have different priorities
      const uniquePriorities = new Set(priorities);
      expect(uniquePriorities.size).toBeGreaterThan(1);
    });
  });
});
