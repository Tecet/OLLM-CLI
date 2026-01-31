#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync } = require('fs');
const { mkdir, cp } = require('fs/promises');
const os = require('os');
const path = require('path');

(async function main(){
  try {
    const pkgScriptsDir = __dirname; // packages/cli/scripts
    const pkgRoot = path.join(pkgScriptsDir, '..');
    const bundledDocs = path.join(pkgRoot, 'docs');
    const userDocs = path.join(os.homedir(), '.ollm', 'docs');

    console.log('[install-docs] bundledDocs=%s', bundledDocs);
    console.log('[install-docs] userDocs=%s', userDocs);

    if (!existsSync(bundledDocs)) {
      console.log('[install-docs] no bundled docs found, skipping');
      return;
    }

    // Ensure user docs directory exists, then copy/merge bundled docs into it.
    // We intentionally merge so existing user files aren't overwritten but
    // missing bundled files are populated.
    await mkdir(path.join(os.homedir(), '.ollm'), { recursive: true });
    await mkdir(userDocs, { recursive: true });

    // Use fs.promises.cp with force: false so existing files are not overwritten.
    await cp(bundledDocs, userDocs, { recursive: true, force: false });
    console.log('[install-docs] merged bundled docs into user folder');
  } catch (err) {
    console.error('[install-docs] failed to copy docs:', err);
  }
})();
