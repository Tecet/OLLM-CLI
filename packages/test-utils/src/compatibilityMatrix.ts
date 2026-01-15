/**
 * Compatibility Matrix Infrastructure
 * 
 * Provides infrastructure for testing model compatibility across different
 * capabilities and generating documentation of test results.
 */

import { isServerAvailable, getServerUrl } from './testHelpers.js';

/**
 * Test result status for a capability
 */
export enum TestResult {
  PASS = '✅ Pass',
  FAIL = '❌ Fail',
  PARTIAL = '⚠️  Partial',
  NOT_TESTED = '⊘ Not Tested',
}

/**
 * Compatibility test results for a single model
 */
export interface CompatibilityTest {
  model: string;
  features: {
    basicChat: TestResult;
    streaming: TestResult;
    nativeToolCalling: TestResult;
    reactFallback: TestResult;
    context4k: TestResult;
    context8k: TestResult;
    context16k: TestResult;
    context32k: TestResult;
    context64k: TestResult;
    context128k: TestResult;
  };
  knownIssues: string[];
  recommendations: string;
}

/**
 * Complete compatibility matrix with all tested models
 */
export interface CompatibilityMatrix {
  tests: CompatibilityTest[];
  summary: {
    totalModels: number;
    passRate: number;
    knownIssuesCount: number;
  };
  testEnvironment: {
    cliVersion: string;
    serverVersion: string;
    testDate: string;
  };
}

/**
 * Configuration for compatibility testing
 */
export interface CompatibilityTestConfig {
  models: string[];
  serverUrl?: string;
  timeout?: number;
  skipUnavailable?: boolean;
}

/**
 * Test a single capability for a model
 */
export type CapabilityTestFn = (modelName: string) => Promise<TestResult>;

/**
 * Compatibility test runner
 * 
 * Runs compatibility tests for specified models and capabilities.
 */
export class CompatibilityTestRunner {
  private serverUrl: string;
  private timeout: number;
  private skipUnavailable: boolean;

  constructor(config: CompatibilityTestConfig) {
    this.serverUrl = config.serverUrl || getServerUrl();
    this.timeout = config.timeout || 30000;
    this.skipUnavailable = config.skipUnavailable ?? true;
  }

  /**
   * Check if the server is available for testing
   */
  async checkServerAvailability(): Promise<boolean> {
    return await isServerAvailable(this.serverUrl);
  }

  /**
   * Test basic chat functionality for a model
   */
  async testBasicChat(modelName: string): Promise<TestResult> {
    try {
      // This is a placeholder - actual implementation would make a real API call
      // For now, we return NOT_TESTED to indicate the test needs implementation
      return TestResult.NOT_TESTED;
    } catch (error) {
      return TestResult.FAIL;
    }
  }

  /**
   * Test streaming functionality for a model
   */
  async testStreaming(modelName: string): Promise<TestResult> {
    try {
      return TestResult.NOT_TESTED;
    } catch (error) {
      return TestResult.FAIL;
    }
  }

  /**
   * Test native tool calling support for a model
   */
  async testNativeToolCalling(modelName: string): Promise<TestResult> {
    try {
      return TestResult.NOT_TESTED;
    } catch (error) {
      return TestResult.FAIL;
    }
  }

  /**
   * Test ReAct fallback for models without native tool calling
   */
  async testReActFallback(modelName: string): Promise<TestResult> {
    try {
      return TestResult.NOT_TESTED;
    } catch (error) {
      return TestResult.FAIL;
    }
  }

  /**
   * Test context handling at a specific size
   */
  async testContextSize(modelName: string, contextSize: number): Promise<TestResult> {
    try {
      return TestResult.NOT_TESTED;
    } catch (error) {
      return TestResult.FAIL;
    }
  }

  /**
   * Run all compatibility tests for a single model
   */
  async testModelCompatibility(modelName: string): Promise<CompatibilityTest> {
    const serverAvailable = await this.checkServerAvailability();

    if (!serverAvailable && this.skipUnavailable) {
      // Return all NOT_TESTED if server is unavailable
      return {
        model: modelName,
        features: {
          basicChat: TestResult.NOT_TESTED,
          streaming: TestResult.NOT_TESTED,
          nativeToolCalling: TestResult.NOT_TESTED,
          reactFallback: TestResult.NOT_TESTED,
          context4k: TestResult.NOT_TESTED,
          context8k: TestResult.NOT_TESTED,
          context16k: TestResult.NOT_TESTED,
          context32k: TestResult.NOT_TESTED,
          context64k: TestResult.NOT_TESTED,
          context128k: TestResult.NOT_TESTED,
        },
        knownIssues: ['Server unavailable - tests not run'],
        recommendations: 'Start LLM server to run compatibility tests',
      };
    }

    // Run all capability tests
    const results: CompatibilityTest = {
      model: modelName,
      features: {
        basicChat: await this.testBasicChat(modelName),
        streaming: await this.testStreaming(modelName),
        nativeToolCalling: await this.testNativeToolCalling(modelName),
        reactFallback: await this.testReActFallback(modelName),
        context4k: await this.testContextSize(modelName, 4096),
        context8k: await this.testContextSize(modelName, 8192),
        context16k: await this.testContextSize(modelName, 16384),
        context32k: await this.testContextSize(modelName, 32768),
        context64k: await this.testContextSize(modelName, 65536),
        context128k: await this.testContextSize(modelName, 131072),
      },
      knownIssues: [],
      recommendations: '',
    };

    return results;
  }

  /**
   * Run compatibility tests for all configured models
   */
  async runAllTests(models: string[]): Promise<CompatibilityTest[]> {
    const results: CompatibilityTest[] = [];

    for (const model of models) {
      const result = await this.testModelCompatibility(model);
      results.push(result);
    }

    return results;
  }
}

/**
 * Generate markdown documentation from compatibility test results
 */
export class CompatibilityMatrixGenerator {
  /**
   * Format a feature name for display
   */
  private formatFeatureName(feature: string): string {
    // Convert camelCase to Title Case with spaces
    // Handle special case for context sizes (e.g., context4k -> Context 4k)
    return feature
      .replace(/([A-Z])/g, ' $1')
      .replace(/([a-z])(\d)/g, '$1 $2') // Add space before numbers
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Get CLI version from package.json
   */
  private getCliVersion(): string {
    // This would normally read from package.json
    // For now, return a placeholder
    return '0.1.0';
  }

  /**
   * Get server version (placeholder)
   */
  private getServerVersion(): string {
    // This would normally query the server
    return 'Unknown';
  }

  /**
   * Calculate summary statistics from test results
   */
  private calculateSummary(tests: CompatibilityTest[]): CompatibilityMatrix['summary'] {
    const totalModels = tests.length;
    let totalTests = 0;
    let passedTests = 0;
    let knownIssuesCount = 0;

    for (const test of tests) {
      // Count all feature tests
      const features = Object.values(test.features);
      totalTests += features.length;
      passedTests += features.filter((result) => result === TestResult.PASS).length;
      knownIssuesCount += test.knownIssues.length;
    }

    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return {
      totalModels,
      passRate: Math.round(passRate * 100) / 100, // Round to 2 decimal places
      knownIssuesCount,
    };
  }

  /**
   * Generate markdown documentation from compatibility test results
   */
  generateMarkdown(tests: CompatibilityTest[]): string {
    const testDate = new Date().toISOString().split('T')[0];
    const cliVersion = this.getCliVersion();
    const serverVersion = this.getServerVersion();

    let markdown = '# Model Compatibility Matrix\n\n';
    markdown += '## Test Environment\n\n';
    markdown += `- **OLLM CLI Version:** ${cliVersion}\n`;
    markdown += `- **Test Date:** ${testDate}\n`;
    markdown += `- **Server:** Ollama ${serverVersion}\n\n`;

    // Add summary
    const summary = this.calculateSummary(tests);
    markdown += '## Summary\n\n';
    markdown += `- **Total Models Tested:** ${summary.totalModels}\n`;
    markdown += `- **Overall Pass Rate:** ${summary.passRate}%\n`;
    markdown += `- **Known Issues:** ${summary.knownIssuesCount}\n\n`;

    // Add legend
    markdown += '## Legend\n\n';
    markdown += `- ${TestResult.PASS} - Feature works as expected\n`;
    markdown += `- ${TestResult.FAIL} - Feature does not work\n`;
    markdown += `- ${TestResult.PARTIAL} - Feature works with limitations\n`;
    markdown += `- ${TestResult.NOT_TESTED} - Feature not yet tested\n\n`;

    // Add detailed results for each model
    markdown += '## Detailed Results\n\n';

    for (const test of tests) {
      markdown += `### ${test.model}\n\n`;
      markdown += '| Feature | Status | Notes |\n';
      markdown += '|---------|--------|-------|\n';

      for (const [feature, result] of Object.entries(test.features)) {
        const featureName = this.formatFeatureName(feature);
        markdown += `| ${featureName} | ${result} | |\n`;
      }

      markdown += '\n';

      if (test.knownIssues.length > 0) {
        markdown += '**Known Issues:**\n\n';
        for (const issue of test.knownIssues) {
          markdown += `- ${issue}\n`;
        }
        markdown += '\n';
      }

      if (test.recommendations) {
        markdown += `**Recommendations:** ${test.recommendations}\n\n`;
      }

      markdown += '---\n\n';
    }

    return markdown;
  }

  /**
   * Generate a complete compatibility matrix with summary
   */
  generateMatrix(tests: CompatibilityTest[]): CompatibilityMatrix {
    const testDate = new Date().toISOString().split('T')[0];
    const cliVersion = this.getCliVersion();
    const serverVersion = this.getServerVersion();

    return {
      tests,
      summary: this.calculateSummary(tests),
      testEnvironment: {
        cliVersion,
        serverVersion,
        testDate,
      },
    };
  }
}

/**
 * Helper function to create a compatibility test runner
 */
export function createCompatibilityTestRunner(
  config: CompatibilityTestConfig
): CompatibilityTestRunner {
  return new CompatibilityTestRunner(config);
}

/**
 * Helper function to create a compatibility matrix generator
 */
export function createCompatibilityMatrixGenerator(): CompatibilityMatrixGenerator {
  return new CompatibilityMatrixGenerator();
}
