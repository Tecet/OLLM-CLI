/**
 * Model-Aware Compression Tests
 *
 * Tests model size detection, reliability calculation, and warning thresholds.
 *
 * Requirements: FR-13
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import {
  ModelAwareCompression,
  extractModelSize,
} from '../modelAwareCompression.js';

describe('ModelAwareCompression', () => {
  const compression = new ModelAwareCompression();

  describe('extractModelSize', () => {
    it('should extract size from model name', () => {
      expect(extractModelSize('llama3.2:3b')).toBe(3);
      expect(extractModelSize('mistral:7b')).toBe(7);
      expect(extractModelSize('llama3:13b')).toBe(13);
      expect(extractModelSize('mixtral:70b')).toBe(70);
    });

    it('should handle decimal sizes', () => {
      expect(extractModelSize('llama3.2:3.2b')).toBe(3.2);
      expect(extractModelSize('qwen:1.5b')).toBe(1.5);
    });

    it('should be case insensitive', () => {
      expect(extractModelSize('llama3:7B')).toBe(7);
      expect(extractModelSize('mistral:13B')).toBe(13);
    });

    it('should default to 7B if no size found', () => {
      expect(extractModelSize('llama3')).toBe(7);
      expect(extractModelSize('mistral')).toBe(7);
      expect(extractModelSize('')).toBe(7);
    });
  });

  describe('getModelSize', () => {
    it('should return model size from identifier', () => {
      expect(compression.getModelSize('llama3.2:3b')).toBe(3);
      expect(compression.getModelSize('mistral:7b')).toBe(7);
    });
  });

  describe('calculateReliability', () => {
    it('should return higher reliability for larger models', () => {
      const small = compression.calculateReliability(3, 0);
      const medium = compression.calculateReliability(7, 0);
      const large = compression.calculateReliability(13, 0);
      const xlarge = compression.calculateReliability(70, 0);

      expect(small).toBeLessThan(medium);
      expect(medium).toBeLessThan(large);
      expect(large).toBeLessThan(xlarge);
    });

    it('should decrease reliability with more compressions', () => {
      const zero = compression.calculateReliability(13, 0);
      const three = compression.calculateReliability(13, 3);
      const five = compression.calculateReliability(13, 5);

      expect(three).toBeLessThan(zero);
      expect(five).toBeLessThan(three);
    });

    it('should return correct model factors', () => {
      // 70B+ models: 0.95
      expect(compression.calculateReliability(70, 0)).toBe(0.95);
      expect(compression.calculateReliability(100, 0)).toBe(0.95);

      // 30B models: 0.85
      expect(compression.calculateReliability(30, 0)).toBe(0.85);
      expect(compression.calculateReliability(50, 0)).toBe(0.85);

      // 13B models: 0.7
      expect(compression.calculateReliability(13, 0)).toBe(0.7);
      expect(compression.calculateReliability(20, 0)).toBe(0.7);

      // 7B models: 0.5
      expect(compression.calculateReliability(7, 0)).toBe(0.5);
      expect(compression.calculateReliability(10, 0)).toBe(0.5);

      // 3B and below: 0.3
      expect(compression.calculateReliability(3, 0)).toBe(0.3);
      expect(compression.calculateReliability(1, 0)).toBe(0.3);
    });

    it('should apply exponential compression penalty', () => {
      const modelSize = 13;
      const base = compression.calculateReliability(modelSize, 0);

      // Each compression reduces by 10% (multiply by 0.9)
      expect(compression.calculateReliability(modelSize, 1)).toBeCloseTo(base * 0.9);
      expect(compression.calculateReliability(modelSize, 2)).toBeCloseTo(base * 0.9 * 0.9);
      expect(compression.calculateReliability(modelSize, 3)).toBeCloseTo(base * 0.9 * 0.9 * 0.9);
    });
  });

  describe('getWarningThreshold', () => {
    it('should return lower thresholds for smaller models', () => {
      expect(compression.getWarningThreshold(3)).toBe(3);
      expect(compression.getWarningThreshold(7)).toBe(5);
      expect(compression.getWarningThreshold(13)).toBe(7);
      expect(compression.getWarningThreshold(70)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(compression.getWarningThreshold(1)).toBe(3);
      expect(compression.getWarningThreshold(3)).toBe(3);
      expect(compression.getWarningThreshold(7)).toBe(5);
      expect(compression.getWarningThreshold(13)).toBe(7);
      expect(compression.getWarningThreshold(30)).toBe(10);
      expect(compression.getWarningThreshold(100)).toBe(10);
    });
  });

  describe('getReliabilityLevel', () => {
    it('should return correct levels', () => {
      expect(compression.getReliabilityLevel(0.95).level).toBe('excellent');
      expect(compression.getReliabilityLevel(0.85).level).toBe('excellent');
      expect(compression.getReliabilityLevel(0.75).level).toBe('good');
      expect(compression.getReliabilityLevel(0.60).level).toBe('moderate');
      expect(compression.getReliabilityLevel(0.45).level).toBe('low');
      expect(compression.getReliabilityLevel(0.30).level).toBe('critical');
    });

    it('should include emoji and description', () => {
      const excellent = compression.getReliabilityLevel(0.90);
      expect(excellent.emoji).toBe('🟢');
      expect(excellent.description).toContain('Excellent');

      const critical = compression.getReliabilityLevel(0.30);
      expect(critical.emoji).toBe('🔴');
      expect(critical.description).toContain('Critical');
    });
  });

  describe('shouldWarn', () => {
    it('should warn when threshold exceeded', () => {
      expect(compression.shouldWarn(3, 3)).toBe(true);
      expect(compression.shouldWarn(3, 4)).toBe(true);
      expect(compression.shouldWarn(7, 5)).toBe(true);
      expect(compression.shouldWarn(13, 7)).toBe(true);
    });

    it('should not warn before threshold', () => {
      expect(compression.shouldWarn(3, 2)).toBe(false);
      expect(compression.shouldWarn(7, 4)).toBe(false);
      expect(compression.shouldWarn(13, 6)).toBe(false);
    });
  });

  describe('getRecommendedCompressionLevel', () => {
    it('should recommend aggressive compression for large models', () => {
      expect(compression.getRecommendedCompressionLevel(70)).toBe(1);
      expect(compression.getRecommendedCompressionLevel(30)).toBe(1);
    });

    it('should recommend moderate compression for medium models', () => {
      expect(compression.getRecommendedCompressionLevel(13)).toBe(2);
      expect(compression.getRecommendedCompressionLevel(20)).toBe(2);
    });

    it('should recommend detailed compression for small models', () => {
      expect(compression.getRecommendedCompressionLevel(7)).toBe(3);
      expect(compression.getRecommendedCompressionLevel(3)).toBe(3);
    });
  });

  /**
   * Unit Tests for Different Model Sizes
   *
   * **Validates: Requirements FR-13**
   *
   * Tests specific model size categories:
   * - Small models (<7B)
   * - Medium models (7B-13B)
   * - Large models (>13B)
   */
  describe('Model Size Categories', () => {
    describe('Small models (<7B)', () => {
      it('should have low reliability factor (0.3)', () => {
        expect(compression.calculateReliability(3, 0)).toBe(0.3);
        expect(compression.calculateReliability(1, 0)).toBe(0.3);
        expect(compression.calculateReliability(1.5, 0)).toBe(0.3);
      });

      it('should have early warning threshold (3 compressions)', () => {
        expect(compression.getWarningThreshold(3)).toBe(3);
        expect(compression.getWarningThreshold(1)).toBe(3);
      });

      it('should recommend detailed compression (level 3)', () => {
        expect(compression.getRecommendedCompressionLevel(3)).toBe(3);
        expect(compression.getRecommendedCompressionLevel(1)).toBe(3);
      });

      it('should reach critical reliability quickly', () => {
        // 3B model with 5 compressions
        const reliability = compression.calculateReliability(3, 5);
        // 0.3 * (0.9^5) = 0.3 * 0.59049 = 0.177
        expect(reliability).toBeCloseTo(0.177, 2);
        expect(compression.getReliabilityLevel(reliability).level).toBe('critical');
      });
    });

    describe('Medium models (7B-13B)', () => {
      it('should have moderate reliability factor for 7B (0.5)', () => {
        expect(compression.calculateReliability(7, 0)).toBe(0.5);
        expect(compression.calculateReliability(10, 0)).toBe(0.5);
      });

      it('should have good reliability factor for 13B (0.7)', () => {
        expect(compression.calculateReliability(13, 0)).toBe(0.7);
        expect(compression.calculateReliability(20, 0)).toBe(0.7);
      });

      it('should have moderate warning thresholds', () => {
        expect(compression.getWarningThreshold(7)).toBe(5);
        expect(compression.getWarningThreshold(13)).toBe(7);
      });

      it('should recommend moderate to detailed compression', () => {
        expect(compression.getRecommendedCompressionLevel(7)).toBe(3);
        expect(compression.getRecommendedCompressionLevel(13)).toBe(2);
      });

      it('should maintain moderate reliability after several compressions', () => {
        // 13B model with 3 compressions
        const reliability = compression.calculateReliability(13, 3);
        // 0.7 * (0.9^3) = 0.7 * 0.729 = 0.5103
        expect(reliability).toBeCloseTo(0.5103, 2);
        expect(compression.getReliabilityLevel(reliability).level).toBe('moderate');
      });
    });

    describe('Large models (>13B)', () => {
      it('should have high reliability factor for 30B (0.85)', () => {
        expect(compression.calculateReliability(30, 0)).toBe(0.85);
        expect(compression.calculateReliability(50, 0)).toBe(0.85);
      });

      it('should have excellent reliability factor for 70B+ (0.95)', () => {
        expect(compression.calculateReliability(70, 0)).toBe(0.95);
        expect(compression.calculateReliability(100, 0)).toBe(0.95);
      });

      it('should have late warning threshold (10 compressions)', () => {
        expect(compression.getWarningThreshold(30)).toBe(10);
        expect(compression.getWarningThreshold(70)).toBe(10);
      });

      it('should recommend aggressive compression (level 1)', () => {
        expect(compression.getRecommendedCompressionLevel(30)).toBe(1);
        expect(compression.getRecommendedCompressionLevel(70)).toBe(1);
      });

      it('should maintain good reliability after many compressions', () => {
        // 70B model with 5 compressions
        const reliability = compression.calculateReliability(70, 5);
        // 0.95 * (0.9^5) = 0.95 * 0.59049 = 0.561
        expect(reliability).toBeCloseTo(0.561, 2);
        expect(compression.getReliabilityLevel(reliability).level).toBe('moderate');
      });

      it('should handle 10+ compressions gracefully', () => {
        // 70B model with 10 compressions
        const reliability = compression.calculateReliability(70, 10);
        // 0.95 * (0.9^10) = 0.95 * 0.3487 = 0.331
        expect(reliability).toBeCloseTo(0.331, 2);
        // Still above critical threshold
        expect(reliability).toBeGreaterThan(0.3);
      });
    });
  });

  /**
   * Property 25: Model Size Adaptation
   *
   * **Validates: Requirements FR-13**
   *
   * Universal properties that must hold for all model sizes and compression counts:
   * 1. Reliability decreases monotonically with compression count
   * 2. Larger models always have higher reliability than smaller models
   * 3. Reliability is always between 0 and 1
   * 4. Warning thresholds are consistent with model size
   */
  describe('Property 25: Model Size Adaptation', () => {
    it('reliability decreases monotonically with compression count', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 100, noNaN: true }), // model size
          fc.integer({ min: 0, max: 20 }), // compression count
          (modelSize, compressionCount) => {
            if (compressionCount === 0) return true;

            const current = compression.calculateReliability(modelSize, compressionCount);
            const previous = compression.calculateReliability(modelSize, compressionCount - 1);

            // Current reliability should be less than or equal to previous
            return current <= previous;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('larger models always have higher reliability than smaller models', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 50, noNaN: true }),  // smaller model size
          fc.double({ min: 51, max: 100, noNaN: true }), // larger model size
          fc.integer({ min: 0, max: 20 }),  // compression count
          (smallerSize, largerSize, compressionCount) => {
            const smallerReliability = compression.calculateReliability(smallerSize, compressionCount);
            const largerReliability = compression.calculateReliability(largerSize, compressionCount);

            // Larger model should have higher or equal reliability
            return largerReliability >= smallerReliability;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('reliability is always between 0 and 1', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 100, noNaN: true }), // model size
          fc.integer({ min: 0, max: 50 }),   // compression count
          (modelSize, compressionCount) => {
            const reliability = compression.calculateReliability(modelSize, compressionCount);

            // Reliability must be in valid range
            return reliability >= 0 && reliability <= 1;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('warning thresholds are consistent with model size', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 50, noNaN: true }),  // smaller model size
          fc.double({ min: 51, max: 100, noNaN: true }), // larger model size
          (smallerSize, largerSize) => {
            const smallerThreshold = compression.getWarningThreshold(smallerSize);
            const largerThreshold = compression.getWarningThreshold(largerSize);

            // Larger models should have higher or equal warning thresholds
            return largerThreshold >= smallerThreshold;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('model size extraction is idempotent', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'llama3.2:3b',
            'mistral:7b',
            'llama3:13b',
            'mixtral:70b',
            'qwen:1.5b'
          ),
          (modelId) => {
            const size1 = extractModelSize(modelId);
            const size2 = extractModelSize(modelId);

            // Should always return same size
            return size1 === size2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('reliability level boundaries are consistent', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1, noNaN: true }),
          (reliability) => {
            const level = compression.getReliabilityLevel(reliability);

            // Check level matches reliability value
            if (reliability >= 0.85) {
              return level.level === 'excellent';
            } else if (reliability >= 0.70) {
              return level.level === 'good';
            } else if (reliability >= 0.50) {
              return level.level === 'moderate';
            } else if (reliability >= 0.40) {
              return level.level === 'low';
            } else {
              return level.level === 'critical';
            }
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('compression penalty is exponential decay', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 100, noNaN: true }), // model size
          fc.integer({ min: 1, max: 20 }),  // compression count
          (modelSize, compressionCount) => {
            const reliability = compression.calculateReliability(modelSize, compressionCount);
            const baseReliability = compression.calculateReliability(modelSize, 0);

            // Reliability should be base * (0.9 ^ compressionCount)
            const expected = baseReliability * Math.pow(0.9, compressionCount);

            // Allow small floating point error
            return Math.abs(reliability - expected) < 0.0001;
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});
