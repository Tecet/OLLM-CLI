#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');

(async () => {
  const targetArg = process.argv[2] || '.';
  const dest = path.resolve(targetArg, 'docs');

  try {
    await fs.rm(dest, { recursive: true, force: true });
    console.log(`Removed ${dest}`);
  } catch (err) {
    console.error('Remove failed:', err);
    process.exit(1);
  }
})();
