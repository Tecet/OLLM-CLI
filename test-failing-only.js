#!/usr/bin/env node

/**
 * Standalone test runner for failing tests only
 * Run with: node test-failing-only.js
 */

import { execSync } from 'child_process';

const failingTests = [
  'packages/cli/src/ui/components/layout/__tests__/InputBox.property.test.tsx',
  'packages/cli/src/ui/components/layout/__tests__/InputBox.test.tsx',
  'packages/cli/src/ui/components/layout/__tests__/StatusBar.test.tsx',
  'packages/cli/src/ui/components/chat/__tests__/ChatHistory.diffThreshold.property.test.tsx',
  'packages/cli/src/ui/components/layout/__tests__/SidePanel.persistence.property.test.tsx',
];

console.log('Running failing tests individually...\n');

for (const testFile of failingTests) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${testFile}`);
  console.log('='.repeat(80));
  
  try {
    const output = execSync(`npm test -- ${testFile}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
    });
    
    // Extract only FAIL lines and assertion errors
    const lines = output.split('\n');
    const relevantLines = lines.filter(line => 
      line.includes('FAIL') || 
      line.includes('AssertionError') ||
      line.includes('expected') ||
      line.includes('Error:')
    );
    
    if (relevantLines.length > 0) {
      console.log('\nFailures:');
      relevantLines.slice(0, 20).forEach(line => console.log(line));
    } else {
      console.log('✓ All tests passed');
    }
  } catch (error) {
    // Test failed, extract error info
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    const lines = output.split('\n');
    
    // Find FAIL lines
    const failLines = lines.filter(line => 
      line.includes('FAIL') || 
      line.includes('AssertionError') ||
      (line.includes('expected') && line.includes('to'))
    );
    
    console.log('\nFailures:');
    failLines.slice(0, 15).forEach(line => console.log(line.trim()));
  }
}

console.log('\n' + '='.repeat(80));
console.log('Test run complete');
console.log('='.repeat(80));
