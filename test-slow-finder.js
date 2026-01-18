/**
 * Script to identify slow tests by running test files individually
 * and measuring their execution time
 */

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const testFiles = [];
const slowTests = [];
const SLOW_THRESHOLD_MS = 10000; // 10 seconds

// Find all test files
function findTestFiles(dir) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('dist')) {
      findTestFiles(fullPath);
    } else if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
      testFiles.push(fullPath);
    }
  }
}

// Run a single test file and measure time
function runTestFile(filePath) {
  console.log(`Testing: ${filePath}`);
  const start = Date.now();
  
  try {
    execSync(`npm test -- ${filePath} --reporter=basic --no-coverage`, {
      stdio: 'pipe',
      timeout: 30000, // 30 second timeout per file
    });
    const duration = Date.now() - start;
    
    if (duration > SLOW_THRESHOLD_MS) {
      slowTests.push({ file: filePath, duration });
      console.log(`  ⚠️  SLOW: ${duration}ms`);
    } else {
      console.log(`  ✓ ${duration}ms`);
    }
    
    return { file: filePath, duration, status: 'pass' };
  } catch (_error) {
    const duration = Date.now() - start;
    console.log(`  ✗ FAILED/TIMEOUT: ${duration}ms`);
    return { file: filePath, duration, status: 'fail' };
  }
}

// Main execution
console.log('Finding test files...');
findTestFiles('./packages');

console.log(`\nFound ${testFiles.length} test files\n`);
console.log('Running tests individually to identify slow ones...\n');

const results = [];
for (let i = 0; i < Math.min(20, testFiles.length); i++) {
  const result = runTestFile(testFiles[i]);
  results.push(result);
}

// Report slow tests
console.log('\n\n=== SLOW TESTS REPORT ===\n');
if (slowTests.length > 0) {
  console.log(`Found ${slowTests.length} slow test files (>${SLOW_THRESHOLD_MS}ms):\n`);
  slowTests.sort((a, b) => b.duration - a.duration);
  slowTests.forEach(({ file, duration }) => {
    console.log(`  ${(duration / 1000).toFixed(2)}s - ${file}`);
  });
} else {
  console.log('No slow tests found in the sample.');
}

console.log('\n\n=== SUMMARY ===\n');
console.log(`Total files tested: ${results.length}`);
console.log(`Slow files: ${slowTests.length}`);
console.log(`Average time: ${(results.reduce((sum, r) => sum + r.duration, 0) / results.length / 1000).toFixed(2)}s`);
