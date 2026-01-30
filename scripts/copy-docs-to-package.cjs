#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs/promises');
const path = require('path');

(async () => {
  const targetArg = process.argv[2] || '.';
  const repoRoot = path.resolve(__dirname, '..');
  const src = path.join(repoRoot, 'docs');
  const dest = path.resolve(targetArg, 'docs');

  try {
    await fs.rm(dest, { recursive: true, force: true });
  } catch (_e) {
    // ignore
  }

  try {
    await fs.cp(src, dest, { recursive: true });
    console.log(`Copied docs -> ${dest}`);
  } catch (err) {
    console.error('Copy failed:', err);
    process.exit(1);
  }
})();
