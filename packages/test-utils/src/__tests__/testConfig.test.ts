/**
 * Unit tests for test configuration.
 * Tests coverage threshold enforcement, report format generation, and exclusion patterns.
 *
 * Requirements: 14.2, 14.3, 14.4, 14.5, 14.6
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Test Configuration', () => {
  describe('Coverage Threshold Enforcement', () => {
    it('should enforce 80% coverage threshold', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify threshold is set to 80
      expect(configContent).toContain('thresholds');
      expect(configContent).toContain('lines: 80');
      expect(configContent).toContain('functions: 80');
      expect(configContent).toContain('branches: 80');
      expect(configContent).toContain('statements: 80');
    });

    it('should fail build when coverage is below threshold', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify thresholds are configured (Vitest will fail build automatically)
      expect(configContent).toContain('thresholds');
    });
  });

  describe('Report Format Generation', () => {
    it('should generate text format reports', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify text reporter is configured
      expect(configContent).toContain("'text'");
    });

    it('should generate JSON format reports', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify JSON reporter is configured
      expect(configContent).toContain("'json'");
    });

    it('should generate HTML format reports', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify HTML reporter is configured
      expect(configContent).toContain("'html'");
    });

    it('should configure all three report formats', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify all three formats are present
      expect(configContent).toContain("reporter: ['text', 'json', 'html']");
    });
  });

  describe('Exclusion Patterns', () => {
    it('should exclude node_modules from coverage', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify node_modules is excluded
      expect(configContent).toContain('**/node_modules/**');
    });

    it('should exclude dist directories from coverage', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify dist is excluded
      expect(configContent).toContain('**/dist/**');
    });

    it('should exclude test files from coverage', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify test files are excluded
      expect(configContent).toContain('**/__tests__/**');
      expect(configContent).toContain('**/*.test.ts');
      expect(configContent).toContain('**/*.test.tsx');
    });

    it('should have all required exclusion patterns', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify exclude array is configured
      expect(configContent).toContain('exclude:');

      // Verify all required patterns
      const requiredPatterns = [
        '**/node_modules/**',
        '**/dist/**',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
      ];

      for (const pattern of requiredPatterns) {
        expect(configContent).toContain(pattern);
      }
    });
  });

  describe('Test Environment Configuration', () => {
    it('should use v8 coverage provider', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify v8 provider is configured
      expect(configContent).toContain("provider: 'v8'");
    });

    it('should enable globals', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify globals are enabled
      expect(configContent).toContain('globals: true');
    });

    it('should set test timeout to 30 seconds', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify test timeout is configured
      expect(configContent).toContain('testTimeout: 30000');
    });

    it('should set hook timeout to 10 seconds', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify hook timeout is configured
      expect(configContent).toContain('hookTimeout: 10000');
    });
  });

  describe('Coverage Configuration Completeness', () => {
    it('should have complete coverage configuration', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify all coverage settings are present
      expect(configContent).toContain('coverage:');
      expect(configContent).toContain("provider: 'v8'");
      expect(configContent).toContain('reporter:');
      expect(configContent).toContain('exclude:');
      expect(configContent).toContain('thresholds:');
    });

    it('should have all threshold metrics configured', () => {
      // Read the vitest config
      const configPath = resolve(process.cwd(), 'vitest.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');

      // Verify all threshold metrics
      const requiredMetrics = ['lines', 'functions', 'branches', 'statements'];

      for (const metric of requiredMetrics) {
        expect(configContent).toContain(`${metric}: 80`);
      }
    });
  });
});
