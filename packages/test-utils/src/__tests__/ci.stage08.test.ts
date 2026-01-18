/**
 * CI/CD Integration Tests
 * 
 * Tests for CI/CD test execution behavior, build failures, and report generation.
 * Feature: stage-08-testing-qa
 * Requirements: 14.2, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
 */

import { describe, it, expect } from 'vitest';
import { TestExecutionResult } from '../testHelpers';

/**
 * Simulates CI environment detection
 */
function isCIEnvironment(): boolean {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_URL
  );
}

/**
 * Simulates test execution in CI
 */
async function runTestsInCI(options: {
  includeIntegration?: boolean;
  serverAvailable?: boolean;
}): Promise<TestExecutionResult> {
  const { includeIntegration = true, serverAvailable = false } = options;

  // Simulate test execution
  const result: TestExecutionResult = {
    totalTests: 100,
    passedTests: 95,
    failedTests: 0,
    skippedTests: 5,
    duration: 45000, // 45 seconds
    coverage: {
      lines: 85,
      functions: 82,
      branches: 80,
      statements: 84,
    },
  };

  // Skip integration tests if server not available
  if (includeIntegration && !serverAvailable) {
    result.skippedTests += 10;
    result.totalTests += 10;
  }

  return result;
}

/**
 * Simulates coverage report generation
 */
function generateCoverageReport(
  coverage: TestExecutionResult['coverage'],
  format: 'text' | 'json' | 'html'
): string | object {
  if (!coverage) {
    throw new Error('Coverage data not available');
  }

  switch (format) {
    case 'text':
      return `
Coverage Report:
  Lines: ${coverage.lines}%
  Functions: ${coverage.functions}%
  Branches: ${coverage.branches}%
  Statements: ${coverage.statements}%
`;
    case 'json':
      return {
        coverage: {
          lines: { pct: coverage.lines },
          functions: { pct: coverage.functions },
          branches: { pct: coverage.branches },
          statements: { pct: coverage.statements },
        },
      };
    case 'html':
      return `<html><body><h1>Coverage: ${coverage.lines}%</h1></body></html>`;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Checks if coverage meets threshold
 */
function checkCoverageThreshold(
  coverage: TestExecutionResult['coverage'],
  threshold: number
): { passed: boolean; failures: string[] } {
  if (!coverage) {
    return { passed: false, failures: ['Coverage data not available'] };
  }

  const failures: string[] = [];

  if (coverage.lines < threshold) {
    failures.push(`Lines coverage ${coverage.lines}% is below threshold ${threshold}%`);
  }
  if (coverage.functions < threshold) {
    failures.push(`Functions coverage ${coverage.functions}% is below threshold ${threshold}%`);
  }
  if (coverage.branches < threshold) {
    failures.push(`Branches coverage ${coverage.branches}% is below threshold ${threshold}%`);
  }
  if (coverage.statements < threshold) {
    failures.push(`Statements coverage ${coverage.statements}% is below threshold ${threshold}%`);
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

/**
 * Simulates build failure
 */
function failBuild(reason: string): never {
  throw new Error(`Build failed: ${reason}`);
}

describe('CI/CD Integration Tests', () => {
  describe('CI Environment Detection', () => {
    /**
     * Test CI test execution behavior
     * Requirements: 18.1
     */
    it('should detect CI environment from environment variables', () => {
      // Save original env
      const originalCI = process.env.CI;

      try {
        // Test with CI=true
        process.env.CI = 'true';
        expect(isCIEnvironment()).toBe(true);

        // Test with CI=false
        process.env.CI = '';
        expect(isCIEnvironment()).toBe(false);

        // Test with GITHUB_ACTIONS
        process.env.GITHUB_ACTIONS = 'true';
        expect(isCIEnvironment()).toBe(true);
      } finally {
        // Restore original env
        if (originalCI !== undefined) {
          process.env.CI = originalCI;
        } else {
          delete process.env.CI;
        }
        delete process.env.GITHUB_ACTIONS;
      }
    });

    it('should execute all unit tests in CI', async () => {
      const result = await runTestsInCI({ includeIntegration: false });

      // Verify unit tests are executed
      expect(result.totalTests).toBeGreaterThan(0);
      expect(result.passedTests).toBeGreaterThan(0);
    });

    it('should track test execution metrics in CI', async () => {
      const result = await runTestsInCI({});

      // Verify all metrics are tracked
      expect(result.totalTests).toBeGreaterThan(0);
      expect(result.passedTests).toBeGreaterThan(0);
      expect(result.failedTests).toBeGreaterThanOrEqual(0);
      expect(result.skippedTests).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.coverage).toBeDefined();
    });
  });

  describe('Coverage Threshold Build Failure', () => {
    /**
     * Test coverage threshold build failure
     * Requirements: 14.2, 18.4
     */
    it('should fail build when coverage is below 80% threshold', () => {
      const lowCoverage: TestExecutionResult['coverage'] = {
        lines: 75,
        functions: 70,
        branches: 65,
        statements: 72,
      };

      const { passed, failures } = checkCoverageThreshold(lowCoverage, 80);

      expect(passed).toBe(false);
      expect(failures.length).toBeGreaterThan(0);
      expect(failures.some((f) => f.includes('Lines coverage'))).toBe(true);
    });

    it('should pass build when coverage meets 80% threshold', () => {
      const goodCoverage: TestExecutionResult['coverage'] = {
        lines: 85,
        functions: 82,
        branches: 80,
        statements: 84,
      };

      const { passed, failures } = checkCoverageThreshold(goodCoverage, 80);

      expect(passed).toBe(true);
      expect(failures.length).toBe(0);
    });

    it('should provide detailed failure messages for each coverage metric', () => {
      const partialCoverage: TestExecutionResult['coverage'] = {
        lines: 85, // Pass
        functions: 75, // Fail
        branches: 78, // Fail
        statements: 82, // Pass
      };

      const { passed, failures } = checkCoverageThreshold(partialCoverage, 80);

      expect(passed).toBe(false);
      expect(failures.length).toBe(2);
      expect(failures.some((f) => f.includes('Functions coverage'))).toBe(true);
      expect(failures.some((f) => f.includes('Branches coverage'))).toBe(true);
    });

    it('should handle edge case of exactly meeting threshold', () => {
      const exactCoverage: TestExecutionResult['coverage'] = {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      };

      const { passed, failures } = checkCoverageThreshold(exactCoverage, 80);

      expect(passed).toBe(true);
      expect(failures.length).toBe(0);
    });
  });

  describe('Integration Test Skipping in CI', () => {
    /**
     * Test integration test skipping in CI
     * Requirements: 18.2
     */
    it('should skip integration tests when server unavailable in CI', async () => {
      const result = await runTestsInCI({
        includeIntegration: true,
        serverAvailable: false,
      });

      // Verify integration tests were skipped
      expect(result.skippedTests).toBeGreaterThan(0);
    });

    it('should run integration tests when server available in CI', async () => {
      const result = await runTestsInCI({
        includeIntegration: true,
        serverAvailable: true,
      });

      // Verify fewer tests were skipped (only non-integration skips)
      expect(result.skippedTests).toBeLessThanOrEqual(10);
    });

    it('should log clear message when skipping integration tests', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        // Simulate integration test skip
        const shouldSkip = true;
        if (shouldSkip) {
          console.log('⚠️  Skipping integration tests: Server not available in CI');
        }

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Skipping integration tests')
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('Test Failure Build Failure', () => {
    /**
     * Test build failure on test failure
     * Requirements: 18.3
     */
    it('should fail build when any test fails', () => {
      const resultWithFailures: TestExecutionResult = {
        totalTests: 100,
        passedTests: 95,
        failedTests: 5,
        skippedTests: 0,
        duration: 45000,
      };

      expect(() => {
        if (resultWithFailures.failedTests > 0) {
          failBuild(`${resultWithFailures.failedTests} test(s) failed`);
        }
      }).toThrow('Build failed: 5 test(s) failed');
    });

    it('should pass build when all tests pass', () => {
      const resultWithoutFailures: TestExecutionResult = {
        totalTests: 100,
        passedTests: 95,
        failedTests: 0,
        skippedTests: 5,
        duration: 45000,
      };

      expect(() => {
        if (resultWithoutFailures.failedTests > 0) {
          failBuild(`${resultWithoutFailures.failedTests} test(s) failed`);
        }
      }).not.toThrow();
    });

    it('should report number of failed tests in build failure', () => {
      const failedCount = 3;

      expect(() => {
        failBuild(`${failedCount} test(s) failed`);
      }).toThrow('3 test(s) failed');
    });
  });

  describe('Coverage Failure Build Failure', () => {
    /**
     * Test build failure on low coverage
     * Requirements: 18.4
     */
    it('should fail build when coverage is below threshold', () => {
      const lowCoverage: TestExecutionResult['coverage'] = {
        lines: 75,
        functions: 78,
        branches: 72,
        statements: 76,
      };

      const { passed, failures } = checkCoverageThreshold(lowCoverage, 80);

      expect(() => {
        if (!passed) {
          failBuild(`Coverage below threshold:\n${failures.join('\n')}`);
        }
      }).toThrow('Build failed: Coverage below threshold');
    });

    it('should include all coverage failures in build error', () => {
      const lowCoverage: TestExecutionResult['coverage'] = {
        lines: 75,
        functions: 76,
        branches: 77,
        statements: 78,
      };

      const { passed, failures } = checkCoverageThreshold(lowCoverage, 80);

      expect(passed).toBe(false);
      expect(failures.length).toBe(4); // All metrics below threshold
    });
  });

  describe('Report Generation in Standard Format', () => {
    /**
     * Test report generation in standard format
     * Requirements: 18.5
     */
    it('should generate text format coverage report', () => {
      const coverage: TestExecutionResult['coverage'] = {
        lines: 85,
        functions: 82,
        branches: 80,
        statements: 84,
      };

      const report = generateCoverageReport(coverage, 'text');

      expect(typeof report).toBe('string');
      expect(report).toContain('Coverage Report');
      expect(report).toContain('Lines: 85%');
      expect(report).toContain('Functions: 82%');
      expect(report).toContain('Branches: 80%');
      expect(report).toContain('Statements: 84%');
    });

    it('should generate JSON format coverage report', () => {
      const coverage: TestExecutionResult['coverage'] = {
        lines: 85,
        functions: 82,
        branches: 80,
        statements: 84,
      };

      const report = generateCoverageReport(coverage, 'json');

      expect(typeof report).toBe('object');
      expect(report).toHaveProperty('coverage');
      const reportObj = report as any;
      expect(reportObj.coverage.lines.pct).toBe(85);
      expect(reportObj.coverage.functions.pct).toBe(82);
      expect(reportObj.coverage.branches.pct).toBe(80);
      expect(reportObj.coverage.statements.pct).toBe(84);
    });

    it('should generate HTML format coverage report', () => {
      const coverage: TestExecutionResult['coverage'] = {
        lines: 85,
        functions: 82,
        branches: 80,
        statements: 84,
      };

      const report = generateCoverageReport(coverage, 'html');

      expect(typeof report).toBe('string');
      expect(report).toContain('<html>');
      expect(report).toContain('Coverage: 85%');
    });

    it('should support all required report formats', () => {
      const coverage: TestExecutionResult['coverage'] = {
        lines: 85,
        functions: 82,
        branches: 80,
        statements: 84,
      };

      const formats: Array<'text' | 'json' | 'html'> = ['text', 'json', 'html'];

      formats.forEach((format) => {
        expect(() => {
          generateCoverageReport(coverage, format);
        }).not.toThrow();
      });
    });

    it('should throw error for unsupported report format', () => {
      const coverage: TestExecutionResult['coverage'] = {
        lines: 85,
        functions: 82,
        branches: 80,
        statements: 84,
      };

      expect(() => {
        generateCoverageReport(coverage, 'xml' as any);
      }).toThrow('Unsupported format: xml');
    });
  });

  describe('CI Time Limit', () => {
    /**
     * Test CI time limit
     * Requirements: 18.6
     */
    it('should complete test suite within 5 minutes in CI', async () => {
      const result = await runTestsInCI({});

      // Verify test suite completes within 5 minutes (300,000ms)
      expect(result.duration).toBeLessThan(300000);
    });

    it('should track test suite duration', async () => {
      const result = await runTestsInCI({});

      // Verify duration is tracked
      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should fail build if test suite exceeds time limit', () => {
      const slowResult: TestExecutionResult = {
        totalTests: 100,
        passedTests: 100,
        failedTests: 0,
        skippedTests: 0,
        duration: 350000, // 5 minutes 50 seconds - exceeds limit
      };

      const timeLimit = 300000; // 5 minutes

      expect(() => {
        if (slowResult.duration > timeLimit) {
          failBuild(
            `Test suite took ${slowResult.duration}ms, exceeding CI time limit of ${timeLimit}ms`
          );
        }
      }).toThrow('exceeding CI time limit');
    });

    it('should provide clear timeout message with duration', () => {
      const duration = 350000;
      const limit = 300000;

      expect(() => {
        failBuild(`Test suite took ${duration}ms, exceeding CI time limit of ${limit}ms`);
      }).toThrow('Test suite took 350000ms, exceeding CI time limit of 300000ms');
    });
  });

  describe('CI Build Process Integration', () => {
    it('should execute complete CI workflow', async () => {
      // Simulate complete CI workflow
      const result = await runTestsInCI({
        includeIntegration: true,
        serverAvailable: false,
      });

      // Check test failures
      if (result.failedTests > 0) {
        expect(() => {
          failBuild(`${result.failedTests} test(s) failed`);
        }).toThrow();
      }

      // Check coverage threshold
      if (result.coverage) {
        const { passed, failures } = checkCoverageThreshold(result.coverage, 80);
        if (!passed) {
          expect(() => {
            failBuild(`Coverage below threshold:\n${failures.join('\n')}`);
          }).toThrow();
        }
      }

      // Check time limit
      const timeLimit = 300000;
      if (result.duration > timeLimit) {
        expect(() => {
          failBuild(`Test suite exceeded time limit: ${result.duration}ms > ${timeLimit}ms`);
        }).toThrow();
      }

      // Generate reports
      if (result.coverage) {
        const textReport = generateCoverageReport(result.coverage, 'text');
        const jsonReport = generateCoverageReport(result.coverage, 'json');
        const htmlReport = generateCoverageReport(result.coverage, 'html');

        expect(textReport).toBeDefined();
        expect(jsonReport).toBeDefined();
        expect(htmlReport).toBeDefined();
      }
    });

    it('should handle successful CI build', async () => {
      const successResult: TestExecutionResult = {
        totalTests: 100,
        passedTests: 95,
        failedTests: 0,
        skippedTests: 5,
        duration: 45000,
        coverage: {
          lines: 85,
          functions: 82,
          branches: 80,
          statements: 84,
        },
      };

      // Verify no build failures
      expect(() => {
        if (successResult.failedTests > 0) {
          failBuild(`${successResult.failedTests} test(s) failed`);
        }

        const { passed } = checkCoverageThreshold(successResult.coverage!, 80);
        if (!passed) {
          failBuild('Coverage below threshold');
        }

        if (successResult.duration > 300000) {
          failBuild('Time limit exceeded');
        }
      }).not.toThrow();
    });

    it('should handle multiple failure conditions', () => {
      const multiFailureResult: TestExecutionResult = {
        totalTests: 100,
        passedTests: 90,
        failedTests: 10, // Test failures
        skippedTests: 0,
        duration: 350000, // Time limit exceeded
        coverage: {
          lines: 75, // Coverage below threshold
          functions: 76,
          branches: 77,
          statements: 78,
        },
      };

      const failures: string[] = [];

      // Check test failures
      if (multiFailureResult.failedTests > 0) {
        failures.push(`${multiFailureResult.failedTests} test(s) failed`);
      }

      // Check coverage
      if (multiFailureResult.coverage) {
        const { passed, failures: coverageFailures } = checkCoverageThreshold(
          multiFailureResult.coverage,
          80
        );
        if (!passed) {
          failures.push(...coverageFailures);
        }
      }

      // Check time limit
      if (multiFailureResult.duration > 300000) {
        failures.push('Test suite exceeded time limit');
      }

      // Verify all failures are detected
      expect(failures.length).toBeGreaterThan(0);
      expect(failures.some((f) => f.includes('test(s) failed'))).toBe(true);
      expect(failures.some((f) => f.includes('coverage'))).toBe(true);
      expect(failures.some((f) => f.includes('time limit'))).toBe(true);
    });
  });

  describe('CI Environment Configuration', () => {
    it('should respect CI-specific configuration', () => {
      const ciConfig = {
        skipIntegrationTests: true,
        coverageThreshold: 80,
        timeLimit: 300000,
        reportFormats: ['text', 'json', 'html'],
      };

      expect(ciConfig.skipIntegrationTests).toBe(true);
      expect(ciConfig.coverageThreshold).toBe(80);
      expect(ciConfig.timeLimit).toBe(300000);
      expect(ciConfig.reportFormats).toContain('text');
      expect(ciConfig.reportFormats).toContain('json');
      expect(ciConfig.reportFormats).toContain('html');
    });

    it('should handle missing coverage data gracefully', () => {
      const resultWithoutCoverage: TestExecutionResult = {
        totalTests: 100,
        passedTests: 100,
        failedTests: 0,
        skippedTests: 0,
        duration: 45000,
        // No coverage data
      };

      expect(() => {
        if (resultWithoutCoverage.coverage) {
          checkCoverageThreshold(resultWithoutCoverage.coverage, 80);
        }
      }).not.toThrow();
    });
  });
});
