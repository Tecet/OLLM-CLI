/**
 * Unit tests for compatibility matrix infrastructure
 * 
 * Tests the compatibility test runner, result data structures,
 * and markdown documentation generator.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TestResult,
  CompatibilityTestRunner,
  CompatibilityMatrixGenerator,
  createCompatibilityTestRunner,
  createCompatibilityMatrixGenerator,
  type CompatibilityTest,
  type CompatibilityTestConfig,
} from '../compatibilityMatrix.js';
import { isServerAvailable } from '../testHelpers.js';

// Mock the server availability check
vi.mock('../testHelpers.js', async () => {
  const actual = await vi.importActual('../testHelpers.js');
  return {
    ...actual,
    isServerAvailable: vi.fn(),
  };
});

describe('Compatibility Matrix Infrastructure', () => {
  describe('TestResult enum', () => {
    it('has correct values', () => {
      expect(TestResult.PASS).toBe('✅ Pass');
      expect(TestResult.FAIL).toBe('❌ Fail');
      expect(TestResult.PARTIAL).toBe('⚠️  Partial');
      expect(TestResult.NOT_TESTED).toBe('⊘ Not Tested');
    });
  });

  describe('CompatibilityTestRunner', () => {
    let config: CompatibilityTestConfig;
    let runner: CompatibilityTestRunner;

    beforeEach(() => {
      config = {
        models: ['llama3.1:8b', 'codellama:7b', 'phi3:mini'],
        serverUrl: 'http://localhost:11434',
        timeout: 30000,
        skipUnavailable: true,
      };
      runner = new CompatibilityTestRunner(config);
      vi.clearAllMocks();
    });

    describe('constructor', () => {
      it('creates runner with provided config', () => {
        expect(runner).toBeInstanceOf(CompatibilityTestRunner);
      });

      it('uses default values when not provided', () => {
        const minimalConfig: CompatibilityTestConfig = {
          models: ['test-model'],
        };
        const minimalRunner = new CompatibilityTestRunner(minimalConfig);
        expect(minimalRunner).toBeInstanceOf(CompatibilityTestRunner);
      });
    });

    describe('checkServerAvailability', () => {
      it('returns true when server is available', async () => {
        vi.mocked(isServerAvailable).mockResolvedValue(true);
        const available = await runner.checkServerAvailability();
        expect(available).toBe(true);
      });

      it('returns false when server is unavailable', async () => {
        vi.mocked(isServerAvailable).mockResolvedValue(false);
        const available = await runner.checkServerAvailability();
        expect(available).toBe(false);
      });
    });

    describe('testBasicChat', () => {
      it('returns NOT_TESTED for placeholder implementation', async () => {
        const result = await runner.testBasicChat('llama3.1:8b');
        expect(result).toBe(TestResult.NOT_TESTED);
      });
    });

    describe('testStreaming', () => {
      it('returns NOT_TESTED for placeholder implementation', async () => {
        const result = await runner.testStreaming('llama3.1:8b');
        expect(result).toBe(TestResult.NOT_TESTED);
      });
    });

    describe('testNativeToolCalling', () => {
      it('returns NOT_TESTED for placeholder implementation', async () => {
        const result = await runner.testNativeToolCalling('llama3.1:8b');
        expect(result).toBe(TestResult.NOT_TESTED);
      });
    });

    describe('testReActFallback', () => {
      it('returns NOT_TESTED for placeholder implementation', async () => {
        const result = await runner.testReActFallback('llama3.1:8b');
        expect(result).toBe(TestResult.NOT_TESTED);
      });
    });

    describe('testContextSize', () => {
      it('returns NOT_TESTED for placeholder implementation', async () => {
        const result = await runner.testContextSize('llama3.1:8b', 4096);
        expect(result).toBe(TestResult.NOT_TESTED);
      });

      it('accepts different context sizes', async () => {
        const sizes = [4096, 8192, 16384, 32768, 65536, 131072];
        for (const size of sizes) {
          const result = await runner.testContextSize('llama3.1:8b', size);
          expect(result).toBe(TestResult.NOT_TESTED);
        }
      });
    });

    describe('testModelCompatibility', () => {
      it('returns all NOT_TESTED when server unavailable and skipUnavailable is true', async () => {
        vi.mocked(isServerAvailable).mockResolvedValue(false);
        const result = await runner.testModelCompatibility('llama3.1:8b');

        expect(result.model).toBe('llama3.1:8b');
        expect(result.features.basicChat).toBe(TestResult.NOT_TESTED);
        expect(result.features.streaming).toBe(TestResult.NOT_TESTED);
        expect(result.features.nativeToolCalling).toBe(TestResult.NOT_TESTED);
        expect(result.features.reactFallback).toBe(TestResult.NOT_TESTED);
        expect(result.features.context4k).toBe(TestResult.NOT_TESTED);
        expect(result.features.context8k).toBe(TestResult.NOT_TESTED);
        expect(result.features.context16k).toBe(TestResult.NOT_TESTED);
        expect(result.features.context32k).toBe(TestResult.NOT_TESTED);
        expect(result.features.context64k).toBe(TestResult.NOT_TESTED);
        expect(result.features.context128k).toBe(TestResult.NOT_TESTED);
        expect(result.knownIssues).toContain('Server unavailable - tests not run');
      });

      it('runs all tests when server is available', async () => {
        vi.mocked(isServerAvailable).mockResolvedValue(true);
        const result = await runner.testModelCompatibility('llama3.1:8b');

        expect(result.model).toBe('llama3.1:8b');
        expect(result.features).toHaveProperty('basicChat');
        expect(result.features).toHaveProperty('streaming');
        expect(result.features).toHaveProperty('nativeToolCalling');
        expect(result.features).toHaveProperty('reactFallback');
        expect(result.features).toHaveProperty('context4k');
        expect(result.features).toHaveProperty('context8k');
        expect(result.features).toHaveProperty('context16k');
        expect(result.features).toHaveProperty('context32k');
        expect(result.features).toHaveProperty('context64k');
        expect(result.features).toHaveProperty('context128k');
      });

      it('includes model name in result', async () => {
        vi.mocked(isServerAvailable).mockResolvedValue(true);
        const result = await runner.testModelCompatibility('codellama:7b');
        expect(result.model).toBe('codellama:7b');
      });

      it('initializes empty known issues and recommendations', async () => {
        vi.mocked(isServerAvailable).mockResolvedValue(true);
        const result = await runner.testModelCompatibility('llama3.1:8b');
        expect(Array.isArray(result.knownIssues)).toBe(true);
        expect(typeof result.recommendations).toBe('string');
      });
    });

    describe('runAllTests', () => {
      it('runs tests for all provided models', async () => {
        vi.mocked(isServerAvailable).mockResolvedValue(true);
        const models = ['llama3.1:8b', 'codellama:7b', 'phi3:mini'];
        const results = await runner.runAllTests(models);

        expect(results).toHaveLength(3);
        expect(results[0].model).toBe('llama3.1:8b');
        expect(results[1].model).toBe('codellama:7b');
        expect(results[2].model).toBe('phi3:mini');
      });

      it('returns empty array for empty model list', async () => {
        const results = await runner.runAllTests([]);
        expect(results).toHaveLength(0);
      });

      it('handles single model', async () => {
        vi.mocked(isServerAvailable).mockResolvedValue(true);
        const results = await runner.runAllTests(['llama3.1:8b']);
        expect(results).toHaveLength(1);
        expect(results[0].model).toBe('llama3.1:8b');
      });
    });
  });

  describe('CompatibilityMatrixGenerator', () => {
    let generator: CompatibilityMatrixGenerator;
    let sampleTests: CompatibilityTest[];

    beforeEach(() => {
      generator = new CompatibilityMatrixGenerator();
      sampleTests = [
        {
          model: 'llama3.1:8b',
          features: {
            basicChat: TestResult.PASS,
            streaming: TestResult.PASS,
            nativeToolCalling: TestResult.PASS,
            reactFallback: TestResult.NOT_TESTED,
            context4k: TestResult.PASS,
            context8k: TestResult.PASS,
            context16k: TestResult.PASS,
            context32k: TestResult.PARTIAL,
            context64k: TestResult.FAIL,
            context128k: TestResult.FAIL,
          },
          knownIssues: ['Performance degrades at 32K+ context'],
          recommendations: 'Best for general-purpose tasks with moderate context',
        },
        {
          model: 'codellama:7b',
          features: {
            basicChat: TestResult.PASS,
            streaming: TestResult.PASS,
            nativeToolCalling: TestResult.FAIL,
            reactFallback: TestResult.PASS,
            context4k: TestResult.PASS,
            context8k: TestResult.PASS,
            context16k: TestResult.PASS,
            context32k: TestResult.PASS,
            context64k: TestResult.PARTIAL,
            context128k: TestResult.FAIL,
          },
          knownIssues: ['No native tool calling support', 'Requires ReAct fallback'],
          recommendations: 'Best for code-related tasks',
        },
      ];
    });

    describe('generateMarkdown', () => {
      it('generates valid markdown', () => {
        const markdown = generator.generateMarkdown(sampleTests);
        expect(markdown).toContain('# Model Compatibility Matrix');
        expect(markdown).toContain('## Test Environment');
        expect(markdown).toContain('## Summary');
        expect(markdown).toContain('## Legend');
        expect(markdown).toContain('## Detailed Results');
      });

      it('includes all test results', () => {
        const markdown = generator.generateMarkdown(sampleTests);
        expect(markdown).toContain('llama3.1:8b');
        expect(markdown).toContain('codellama:7b');
      });

      it('includes test environment information', () => {
        const markdown = generator.generateMarkdown(sampleTests);
        expect(markdown).toContain('OLLM CLI Version:');
        expect(markdown).toContain('Test Date:');
        expect(markdown).toContain('Server:');
      });

      it('includes summary statistics', () => {
        const markdown = generator.generateMarkdown(sampleTests);
        expect(markdown).toContain('Total Models Tested:');
        expect(markdown).toContain('Overall Pass Rate:');
        expect(markdown).toContain('Known Issues:');
      });

      it('includes legend for test results', () => {
        const markdown = generator.generateMarkdown(sampleTests);
        expect(markdown).toContain(TestResult.PASS);
        expect(markdown).toContain(TestResult.FAIL);
        expect(markdown).toContain(TestResult.PARTIAL);
        expect(markdown).toContain(TestResult.NOT_TESTED);
      });

      it('includes feature tables for each model', () => {
        const markdown = generator.generateMarkdown(sampleTests);
        expect(markdown).toContain('| Feature | Status | Notes |');
        expect(markdown).toContain('Basic Chat');
        expect(markdown).toContain('Streaming');
        expect(markdown).toContain('Native Tool Calling');
      });

      it('includes known issues when present', () => {
        const markdown = generator.generateMarkdown(sampleTests);
        expect(markdown).toContain('**Known Issues:**');
        expect(markdown).toContain('Performance degrades at 32K+ context');
        expect(markdown).toContain('No native tool calling support');
      });

      it('includes recommendations when present', () => {
        const markdown = generator.generateMarkdown(sampleTests);
        expect(markdown).toContain('**Recommendations:**');
        expect(markdown).toContain('Best for general-purpose tasks');
        expect(markdown).toContain('Best for code-related tasks');
      });

      it('handles empty test array', () => {
        const markdown = generator.generateMarkdown([]);
        expect(markdown).toContain('# Model Compatibility Matrix');
        expect(markdown).toContain('**Total Models Tested:** 0');
      });

      it('formats feature names correctly', () => {
        const markdown = generator.generateMarkdown(sampleTests);
        expect(markdown).toContain('Basic Chat');
        expect(markdown).toContain('Native Tool Calling');
        expect(markdown).toContain('React Fallback');
        expect(markdown).toContain('Context 4k');
        expect(markdown).toContain('Context 128k');
      });
    });

    describe('generateMatrix', () => {
      it('generates complete compatibility matrix', () => {
        const matrix = generator.generateMatrix(sampleTests);
        expect(matrix).toHaveProperty('tests');
        expect(matrix).toHaveProperty('summary');
        expect(matrix).toHaveProperty('testEnvironment');
      });

      it('includes all test results', () => {
        const matrix = generator.generateMatrix(sampleTests);
        expect(matrix.tests).toHaveLength(2);
        expect(matrix.tests[0].model).toBe('llama3.1:8b');
        expect(matrix.tests[1].model).toBe('codellama:7b');
      });

      it('calculates summary statistics', () => {
        const matrix = generator.generateMatrix(sampleTests);
        expect(matrix.summary.totalModels).toBe(2);
        expect(matrix.summary.passRate).toBeGreaterThanOrEqual(0);
        expect(matrix.summary.passRate).toBeLessThanOrEqual(100);
        expect(matrix.summary.knownIssuesCount).toBe(3); // Total from both models
      });

      it('includes test environment details', () => {
        const matrix = generator.generateMatrix(sampleTests);
        expect(matrix.testEnvironment.cliVersion).toBeDefined();
        expect(matrix.testEnvironment.serverVersion).toBeDefined();
        expect(matrix.testEnvironment.testDate).toBeDefined();
      });

      it('calculates correct pass rate', () => {
        const matrix = generator.generateMatrix(sampleTests);
        // Count PASS results: llama3.1 has 7 PASS, codellama has 6 PASS
        // Total tests: 10 features × 2 models = 20 tests
        // Expected pass rate: 13/20 = 65%
        expect(matrix.summary.passRate).toBe(65);
      });

      it('handles empty test array', () => {
        const matrix = generator.generateMatrix([]);
        expect(matrix.tests).toHaveLength(0);
        expect(matrix.summary.totalModels).toBe(0);
        expect(matrix.summary.passRate).toBe(0);
        expect(matrix.summary.knownIssuesCount).toBe(0);
      });
    });
  });

  describe('Helper functions', () => {
    describe('createCompatibilityTestRunner', () => {
      it('creates a CompatibilityTestRunner instance', () => {
        const config: CompatibilityTestConfig = {
          models: ['test-model'],
        };
        const runner = createCompatibilityTestRunner(config);
        expect(runner).toBeInstanceOf(CompatibilityTestRunner);
      });
    });

    describe('createCompatibilityMatrixGenerator', () => {
      it('creates a CompatibilityMatrixGenerator instance', () => {
        const generator = createCompatibilityMatrixGenerator();
        expect(generator).toBeInstanceOf(CompatibilityMatrixGenerator);
      });
    });
  });

  describe('Data structure validation', () => {
    it('CompatibilityTest has all required fields', () => {
      const test: CompatibilityTest = {
        model: 'test-model',
        features: {
          basicChat: TestResult.PASS,
          streaming: TestResult.PASS,
          nativeToolCalling: TestResult.PASS,
          reactFallback: TestResult.PASS,
          context4k: TestResult.PASS,
          context8k: TestResult.PASS,
          context16k: TestResult.PASS,
          context32k: TestResult.PASS,
          context64k: TestResult.PASS,
          context128k: TestResult.PASS,
        },
        knownIssues: [],
        recommendations: '',
      };

      expect(test.model).toBeDefined();
      expect(test.features).toBeDefined();
      expect(test.knownIssues).toBeDefined();
      expect(test.recommendations).toBeDefined();
    });

    it('features object has all required capabilities', () => {
      const test: CompatibilityTest = {
        model: 'test-model',
        features: {
          basicChat: TestResult.PASS,
          streaming: TestResult.PASS,
          nativeToolCalling: TestResult.PASS,
          reactFallback: TestResult.PASS,
          context4k: TestResult.PASS,
          context8k: TestResult.PASS,
          context16k: TestResult.PASS,
          context32k: TestResult.PASS,
          context64k: TestResult.PASS,
          context128k: TestResult.PASS,
        },
        knownIssues: [],
        recommendations: '',
      };

      const requiredFeatures = [
        'basicChat',
        'streaming',
        'nativeToolCalling',
        'reactFallback',
        'context4k',
        'context8k',
        'context16k',
        'context32k',
        'context64k',
        'context128k',
      ];

      for (const feature of requiredFeatures) {
        expect(test.features).toHaveProperty(feature);
      }
    });
  });
});
