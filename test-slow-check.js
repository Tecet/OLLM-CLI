#!/usr/bin/env node

/**
 * Quick check for slow failing tests
 */

import { execSync } from 'child_process';

const failingTests = [
  'packages/cli/src/ui/components/layout/__tests__/InputBox.property.test.tsx',
  'packages/cli/src/ui/components/layout/__tests__/StatusBar.reviewCount.property.test.tsx',
  'packages/cli/src/ui/components/chat/__tests__/ChatHistory.diffThreshold.property.test.tsx',
  'packages/cli/src/ui/components/layout/__tests__/SidePanel.persistence.property.test.tsx',
];

console.log('Testing failing test files for speed...\n');

for (const testFile of failingTests) {
  const start = Date.now();
  
  try {
    execSync(`npm test -- ${testFile}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000,
    });
    const duration = Date.now() - start;
    console.log(`✓ ${testFile.split('/').pop()} - ${(duration / 1000).toFixed(2)}s`);
  } catch (_error) {
    const duration = Date.now() - start;
    const status = duration > 10000 ? '🐌 SLOW' : '⚡ FAST';
    console.log(`${status} ${testFile.split('/').pop()} - ${(duration / 1000).toFixed(2)}s (FAILED)`);
  }
}
