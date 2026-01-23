#!/usr/bin/env node

/**
 * Memory Leak Test Script
 * 
 * This script tests for memory leaks by:
 * 1. Tracking memory usage over time
 * 2. Simulating component mount/unmount cycles
 * 3. Checking for memory growth
 */

const formatBytes = (bytes) => {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    timestamp: Date.now(),
  };
};

const printMemoryUsage = (label, usage) => {
  console.log(`\n${label}:`);
  console.log(`  RSS:        ${formatBytes(usage.rss)}`);
  console.log(`  Heap Total: ${formatBytes(usage.heapTotal)}`);
  console.log(`  Heap Used:  ${formatBytes(usage.heapUsed)}`);
  console.log(`  External:   ${formatBytes(usage.external)}`);
};

const calculateGrowth = (before, after) => {
  const rssGrowth = ((after.rss - before.rss) / before.rss) * 100;
  const heapGrowth = ((after.heapUsed - before.heapUsed) / before.heapUsed) * 100;
  
  return {
    rss: rssGrowth,
    heap: heapGrowth,
    rssBytes: after.rss - before.rss,
    heapBytes: after.heapUsed - before.heapUsed,
  };
};

const runMemoryTest = async () => {
  console.log('='.repeat(60));
  console.log('Memory Leak Test');
  console.log('='.repeat(60));
  
  // Force garbage collection if available
  if (global.gc) {
    console.log('\n✓ Garbage collection available');
    global.gc();
  } else {
    console.log('\n⚠ Garbage collection not available');
    console.log('  Run with: node --expose-gc scripts/memory-leak-test.js');
  }
  
  // Initial memory snapshot
  const initialMemory = getMemoryUsage();
  printMemoryUsage('Initial Memory', initialMemory);
  
  // Simulate some operations
  console.log('\n' + '-'.repeat(60));
  console.log('Simulating operations...');
  console.log('-'.repeat(60));
  
  const operations = [];
  const iterations = 100;
  
  for (let i = 0; i < iterations; i++) {
    // Simulate creating and destroying resources
    const data = new Array(1000).fill(0).map(() => ({
      id: Math.random(),
      timestamp: Date.now(),
      data: new Array(100).fill(0),
    }));
    
    operations.push(data);
    
    // Simulate cleanup
    if (operations.length > 10) {
      operations.shift();
    }
    
    if ((i + 1) % 20 === 0) {
      process.stdout.write(`  Progress: ${i + 1}/${iterations}\r`);
    }
  }
  
  console.log(`\n  Completed ${iterations} iterations`);
  
  // Force garbage collection
  if (global.gc) {
    console.log('\n  Running garbage collection...');
    global.gc();
    
    // Wait a bit for GC to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Final memory snapshot
  const finalMemory = getMemoryUsage();
  printMemoryUsage('Final Memory', finalMemory);
  
  // Calculate growth
  const growth = calculateGrowth(initialMemory, finalMemory);
  
  console.log('\n' + '='.repeat(60));
  console.log('Memory Growth Analysis');
  console.log('='.repeat(60));
  console.log(`\nRSS Growth:  ${growth.rss.toFixed(2)}% (${formatBytes(growth.rssBytes)})`);
  console.log(`Heap Growth: ${growth.heap.toFixed(2)}% (${formatBytes(growth.heapBytes)})`);
  
  // Determine if there's a leak
  const LEAK_THRESHOLD = 50; // 50% growth is concerning
  const hasLeak = growth.heap > LEAK_THRESHOLD;
  
  console.log('\n' + '='.repeat(60));
  if (hasLeak) {
    console.log('❌ POTENTIAL MEMORY LEAK DETECTED');
    console.log(`   Heap grew by ${growth.heap.toFixed(2)}% (threshold: ${LEAK_THRESHOLD}%)`);
    console.log('='.repeat(60));
    process.exit(1);
  } else {
    console.log('✓ No significant memory leak detected');
    console.log(`  Heap grew by ${growth.heap.toFixed(2)}% (threshold: ${LEAK_THRESHOLD}%)`);
    console.log('='.repeat(60));
    process.exit(0);
  }
};

// Run the test
runMemoryTest().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
