import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

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
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // Exclude documentation-related tests and doc folders
    exclude: [
      // Tests placed under any `docs` or `documentation` folders
      '**/docs/**',
      '**/documentation/**',
      // Tests with `doc`/`docs` in filename
      '**/*doc*.test.*',
      '**/*docs*.test.*',
    ],
    testTimeout: 120000, // 2 minutes for integration tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    // Memory optimization settings
    pool: 'forks', // Use forks instead of threads for better memory isolation
    poolOptions: {
      forks: {
        singleFork: false, // Allow multiple forks
        maxForks: 4, // Limit concurrent forks to reduce memory usage (was unlimited)
        minForks: 1,
        execArgv: ['--max-old-space-size=4096'], // 4GB per worker
      },
    },
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
