#!/usr/bin/env node
// Simple echo shim used in tests to avoid shell built-in differences.
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log();
  process.exit(0);
}

// Print joined arguments and exit
console.log(args.join(' '));
process.exit(0);
