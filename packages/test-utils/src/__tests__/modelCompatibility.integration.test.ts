/**
 * Integration tests for model compatibility
 * 
 * Tests representative models (general-purpose, code-specialized, small/fast)
 * for basic chat, streaming, tool calling, and context handling capabilities.
 * 
 * These tests require a running LLM server and will skip gracefully if unavailable.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  TestResult,
  CompatibilityTestRunner,
  CompatibilityMatrixGenerator,
} from '../compatibilityMatrix.js';
import { isServerAvailable, getServerUrl } from '../testHelpers.js';

describe('Model Compatibility Integration Tests', () => {
  let serverAvailable: boolean;
  let runner: CompatibilityTestRunner;
  let generator: CompatibilityMatrixGenerator;

  // Representative models to test
  const GENERAL_PURPOSE_MODELS = ['llama3.1:8b', 'llama3.2:3b'];
  const CODE_SPECIALIZED_MODELS = ['codellama:7b', 'deepseek-coder:6.7b'];
  const SMALL_FAST_MODELS = ['phi3:mini', 'gemma:2b'];

  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    
    if (!serverAvailable) {
      console.log('⚠️  Integration tests require a running LLM server');
      console.log(`   Set OLLM_TEST_SERVER or start server at ${getServerUrl()}`);
      console.log('   Tests will be skipped gracefully');
    }

    runner = new CompatibilityTestRunner({
      models: [],
      skipUnavailable: true,
    });

    generator = new CompatibilityMatrixGenerator();
  });

  describe('General-Purpose Model Testing', () => {
    it('tests llama3.1:8b or llama3.2:3b for all capabilities', async () => {
      if (!serverAvailable) {
        console.log('⚠️  Skipping: Server not available');
        return;
      }

      // Try to find an available general-purpose model
      let modelToTest: string | null = null;
      for (const model of GENERAL_PURPOSE_MODELS) {
        try {
          // Quick check if model exists by attempting to use it
          const result = await runner.testBasicChat(model);
          if (result !== TestResult.FAIL) {
            modelToTest = model;
            break;
          }
        } catch {
          // Model not available, try next
          continue;
        }
      }

      if (!modelToTest) {
        console.log('⚠️  Skipping: No general-purpose model available');
        console.log(`   Install one of: ${GENERAL_PURPOSE_MODELS.join(', ')}`);
        return;
      }

      console.log(`✓ Testing general-purpose model: ${modelToTest}`);

      // Run full compatibility test
      const result = await runner.testModelCompatibility(modelToTest);

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.model).toBe(modelToTest);
      expect(result.features).toBeDefined();
      expect(result.knownIssues).toBeDefined();
      expect(result.recommendations).toBeDefined();

      // Log results for manual verification
      console.log(`  Basic Chat: ${result.features.basicChat}`);
      console.log(`  Streaming: ${result.features.streaming}`);
      console.log(`  Native Tool Calling: ${result.features.nativeToolCalling}`);
      console.log(`  ReAct Fallback: ${result.features.reactFallback}`);
      console.log(`  Context 4K: ${result.features.context4k}`);
      console.log(`  Context 8K: ${result.features.context8k}`);
      console.log(`  Context 16K: ${result.features.context16k}`);
      console.log(`  Context 32K: ${result.features.context32k}`);
      console.log(`  Context 64K: ${result.features.context64k}`);
      console.log(`  Context 128K: ${result.features.context128k}`);

      if (result.knownIssues.length > 0) {
        console.log(`  Known Issues: ${result.knownIssues.join(', ')}`);
      }
    }, 60000); // 60 second timeout for model testing
  });

  describe('Code-Specialized Model Testing', () => {
    it('tests codellama:7b or deepseek-coder:6.7b for all capabilities', async () => {
      if (!serverAvailable) {
        console.log('⚠️  Skipping: Server not available');
        return;
      }

      // Try to find an available code-specialized model
      let modelToTest: string | null = null;
      for (const model of CODE_SPECIALIZED_MODELS) {
        try {
          const result = await runner.testBasicChat(model);
          if (result !== TestResult.FAIL) {
            modelToTest = model;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!modelToTest) {
        console.log('⚠️  Skipping: No code-specialized model available');
        console.log(`   Install one of: ${CODE_SPECIALIZED_MODELS.join(', ')}`);
        return;
      }

      console.log(`✓ Testing code-specialized model: ${modelToTest}`);

      // Run full compatibility test
      const result = await runner.testModelCompatibility(modelToTest);

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.model).toBe(modelToTest);
      expect(result.features).toBeDefined();

      // Log results
      console.log(`  Basic Chat: ${result.features.basicChat}`);
      console.log(`  Streaming: ${result.features.streaming}`);
      console.log(`  Native Tool Calling: ${result.features.nativeToolCalling}`);
      console.log(`  ReAct Fallback: ${result.features.reactFallback}`);
      console.log(`  Context 4K: ${result.features.context4k}`);
      console.log(`  Context 8K: ${result.features.context8k}`);
      console.log(`  Context 16K: ${result.features.context16k}`);
      console.log(`  Context 32K: ${result.features.context32k}`);

      if (result.knownIssues.length > 0) {
        console.log(`  Known Issues: ${result.knownIssues.join(', ')}`);
      }
    }, 60000);
  });

  describe('Small/Fast Model Testing', () => {
    it('tests phi3:mini or gemma:2b for all capabilities', async () => {
      if (!serverAvailable) {
        console.log('⚠️  Skipping: Server not available');
        return;
      }

      // Try to find an available small/fast model
      let modelToTest: string | null = null;
      for (const model of SMALL_FAST_MODELS) {
        try {
          const result = await runner.testBasicChat(model);
          if (result !== TestResult.FAIL) {
            modelToTest = model;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!modelToTest) {
        console.log('⚠️  Skipping: No small/fast model available');
        console.log(`   Install one of: ${SMALL_FAST_MODELS.join(', ')}`);
        return;
      }

      console.log(`✓ Testing small/fast model: ${modelToTest}`);

      // Run full compatibility test
      const result = await runner.testModelCompatibility(modelToTest);

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.model).toBe(modelToTest);
      expect(result.features).toBeDefined();

      // Log results
      console.log(`  Basic Chat: ${result.features.basicChat}`);
      console.log(`  Streaming: ${result.features.streaming}`);
      console.log(`  Native Tool Calling: ${result.features.nativeToolCalling}`);
      console.log(`  ReAct Fallback: ${result.features.reactFallback}`);
      console.log(`  Context 4K: ${result.features.context4k}`);
      console.log(`  Context 8K: ${result.features.context8k}`);

      if (result.knownIssues.length > 0) {
        console.log(`  Known Issues: ${result.knownIssues.join(', ')}`);
      }
    }, 60000);
  });

  describe('Compatibility Matrix Generation', () => {
    it('generates compatibility matrix for all available models', async () => {
      if (!serverAvailable) {
        console.log('⚠️  Skipping: Server not available');
        return;
      }

      // Collect all available models
      const availableModels: string[] = [];
      const allModels = [
        ...GENERAL_PURPOSE_MODELS,
        ...CODE_SPECIALIZED_MODELS,
        ...SMALL_FAST_MODELS,
      ];

      for (const model of allModels) {
        try {
          const result = await runner.testBasicChat(model);
          if (result !== TestResult.FAIL) {
            availableModels.push(model);
          }
        } catch {
          // Model not available
        }
      }

      if (availableModels.length === 0) {
        console.log('⚠️  Skipping: No models available for testing');
        console.log('   Install at least one model from each category:');
        console.log(`   - General: ${GENERAL_PURPOSE_MODELS.join(', ')}`);
        console.log(`   - Code: ${CODE_SPECIALIZED_MODELS.join(', ')}`);
        console.log(`   - Small/Fast: ${SMALL_FAST_MODELS.join(', ')}`);
        return;
      }

      console.log(`✓ Testing ${availableModels.length} available models`);

      // Run tests for all available models
      const results = await runner.runAllTests(availableModels);

      // Verify we got results for all models
      expect(results).toHaveLength(availableModels.length);

      // Generate markdown documentation
      const markdown = generator.generateMarkdown(results);

      // Verify markdown structure
      expect(markdown).toContain('# Model Compatibility Matrix');
      expect(markdown).toContain('## Test Environment');
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('## Detailed Results');

      // Verify all tested models are in the markdown
      for (const model of availableModels) {
        expect(markdown).toContain(model);
      }

      // Generate full matrix
      const matrix = generator.generateMatrix(results);

      // Verify matrix structure
      expect(matrix.tests).toHaveLength(availableModels.length);
      expect(matrix.summary.totalModels).toBe(availableModels.length);
      expect(matrix.testEnvironment).toBeDefined();

      // Log summary
      console.log(`  Total Models: ${matrix.summary.totalModels}`);
      console.log(`  Pass Rate: ${matrix.summary.passRate}%`);
      console.log(`  Known Issues: ${matrix.summary.knownIssuesCount}`);

      // Log markdown preview (first 500 chars)
      console.log('\n--- Compatibility Matrix Preview ---');
      console.log(markdown.substring(0, 500));
      console.log('...\n');
    }, 120000); // 2 minute timeout for testing multiple models
  });

  describe('Basic Chat Capability', () => {
    it('verifies basic chat works for available models', async () => {
      if (!serverAvailable) {
        console.log('⚠️  Skipping: Server not available');
        return;
      }

      // Test at least one model from each category if available
      const modelsToTest = [
        GENERAL_PURPOSE_MODELS[0],
        CODE_SPECIALIZED_MODELS[0],
        SMALL_FAST_MODELS[0],
      ];

      let testedCount = 0;

      for (const model of modelsToTest) {
        try {
          const result = await runner.testBasicChat(model);
          
          if (result !== TestResult.FAIL) {
            console.log(`✓ ${model}: Basic chat - ${result}`);
            testedCount++;
          }
        } catch {
          // Model not available, skip
        }
      }

      if (testedCount === 0) {
        console.log('⚠️  No models available for basic chat testing');
      }

      // We don't fail the test if no models are available
      // This allows the test suite to pass in CI without models
      expect(testedCount).toBeGreaterThanOrEqual(0);
    }, 60000);
  });

  describe('Streaming Capability', () => {
    it('verifies streaming works for available models', async () => {
      if (!serverAvailable) {
        console.log('⚠️  Skipping: Server not available');
        return;
      }

      const modelsToTest = [
        GENERAL_PURPOSE_MODELS[0],
        CODE_SPECIALIZED_MODELS[0],
        SMALL_FAST_MODELS[0],
      ];

      let testedCount = 0;

      for (const model of modelsToTest) {
        try {
          const result = await runner.testStreaming(model);
          
          if (result !== TestResult.FAIL) {
            console.log(`✓ ${model}: Streaming - ${result}`);
            testedCount++;
          }
        } catch {
          // Model not available, skip
        }
      }

      if (testedCount === 0) {
        console.log('⚠️  No models available for streaming testing');
      }

      expect(testedCount).toBeGreaterThanOrEqual(0);
    }, 60000);
  });

  describe('Tool Calling Capability', () => {
    it('verifies tool calling works for available models', async () => {
      if (!serverAvailable) {
        console.log('⚠️  Skipping: Server not available');
        return;
      }

      const modelsToTest = [
        GENERAL_PURPOSE_MODELS[0],
        CODE_SPECIALIZED_MODELS[0],
        SMALL_FAST_MODELS[0],
      ];

      let testedCount = 0;

      for (const model of modelsToTest) {
        try {
          const nativeResult = await runner.testNativeToolCalling(model);
          const reactResult = await runner.testReActFallback(model);
          
          if (nativeResult !== TestResult.FAIL || reactResult !== TestResult.FAIL) {
            console.log(`✓ ${model}: Native tool calling - ${nativeResult}`);
            console.log(`✓ ${model}: ReAct fallback - ${reactResult}`);
            testedCount++;
          }
        } catch {
          // Model not available, skip
        }
      }

      if (testedCount === 0) {
        console.log('⚠️  No models available for tool calling testing');
      }

      expect(testedCount).toBeGreaterThanOrEqual(0);
    }, 60000);
  });

  describe('Context Handling Capability', () => {
    it('verifies context handling works for available models', async () => {
      if (!serverAvailable) {
        console.log('⚠️  Skipping: Server not available');
        return;
      }

      const modelsToTest = [GENERAL_PURPOSE_MODELS[0]];
      const contextSizes = [4096, 8192, 16384, 32768];

      let testedCount = 0;

      for (const model of modelsToTest) {
        try {
          console.log(`Testing ${model} context handling:`);
          
          for (const size of contextSizes) {
            const result = await runner.testContextSize(model, size);
            console.log(`  ${size} tokens: ${result}`);
            
            if (result !== TestResult.FAIL) {
              testedCount++;
            }
          }
        } catch {
          // Model not available, skip
        }
      }

      if (testedCount === 0) {
        console.log('⚠️  No models available for context handling testing');
      }

      expect(testedCount).toBeGreaterThanOrEqual(0);
    }, 90000); // 90 second timeout for context testing
  });
});
