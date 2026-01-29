import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@ollm/core': resolve(__dirname, './packages/core/src/index.ts'),
      '@ollm/ollm-cli-core': resolve(__dirname, './packages/core/src'),
      '@ollm/ollm-bridge': resolve(__dirname, './packages/ollm-bridge/src/index.ts'),
      '@ollm/test-utils': resolve(__dirname, './packages/test-utils/src/index.ts'),
    },
  },
  test: {
    // Global setup: configure fast-check runs and reduce noisy logs
    setupFiles: ['.vitest.setup.ts'],
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // Exclude documentation-related tests and doc folders
    exclude: [
      '**/docs/**',
      '**/documentation/**',
      '**/node_modules/**',
      '**/.legacy/**',
      '**/*doc*.test.*',
      '**/*docs*.test.*',
    ],
    testTimeout: 120000, // 2 minutes for integration tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    maxConcurrency: 4, // Limit concurrent tests within a file
    isolate: true, // Isolate test environments
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
