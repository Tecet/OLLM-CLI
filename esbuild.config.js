/**
 * esbuild configuration for OLLM CLI bundling
 * Bundles the CLI entry point into a single executable file
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  entryPoints: ['packages/cli/src/cli.tsx'],
  outfile: 'packages/cli/dist/cli.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Alias workspace packages to their source directories
  alias: {
    '@ollm/core': join(__dirname, 'packages/core/src'),
    '@ollm/ollm-cli-core': join(__dirname, 'packages/core/src'),
    '@ollm/ollm-bridge': join(__dirname, 'packages/ollm-bridge/src'),
    '@ollm/test-utils': join(__dirname, 'packages/test-utils/src'),
  },
  // Keep node_modules external
  external: [
    'ink',
    'react',
    'react-devtools-core',
    'yargs',
    'yargs/helpers',
    'ajv',
    'ajv-formats',
    'yaml',
    'fdir',
    'glob',
    'ignore',
    'picomatch',
    'ink-image',
    'jimp',
    'terminal-image',
  ],
};
