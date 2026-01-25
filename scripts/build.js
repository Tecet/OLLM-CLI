#!/usr/bin/env node

/**
 * Build script for OLLM CLI
 * Bundles the CLI using esbuild configuration
 */

import { spawn } from 'child_process';
import { cp, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed (${command} ${args.join(' ')}): exit ${code}`));
      }
    });
  });
}

async function build() {
  try {
    console.log('Building OLLM CLI...');

    const npmExecPath = process.env.npm_execpath;
    if (!npmExecPath) {
      throw new Error('npm_execpath is not available; please run via npm.');
    }
    await runCommand(process.execPath, [npmExecPath, 'run', 'build', '-w', 'packages/ollm-bridge'], {
      cwd: join(__dirname, '..'),
    });

    // Load esbuild config
    const configPath = join(__dirname, '..', 'esbuild.config.js');
    // Convert to file:// URL for Windows compatibility
    const configUrl = new URL(`file:///${configPath.replace(/\\/g, '/')}`);
    const { default: config } = await import(configUrl.href);

    // Run esbuild
    await esbuild.build(config);

    // Copy llama sprite assets for runtime usage
    const assetsSource = join(__dirname, '..', 'packages', 'cli', 'src', 'ui', 'components', 'animations', 'lama', 'lama_sprite');
    const assetsTarget = join(__dirname, '..', 'packages', 'cli', 'dist', 'lama_sprite');
    await mkdir(assetsTarget, { recursive: true });
    await cp(assetsSource, assetsTarget, { recursive: true });

    console.log('✓ Build completed successfully');
    console.log(`  Output: ${config.outfile}`);
  } catch (error) {
    console.error('✗ Build failed:');
    console.error(error.message);

    if (error.errors && error.errors.length > 0) {
      console.error('\nBuild errors:');
      error.errors.forEach((err) => {
        console.error(`  ${err.location?.file}:${err.location?.line}:${err.location?.column}`);
        console.error(`    ${err.text}`);
      });
    }

    process.exit(1);
  }
}

build();
