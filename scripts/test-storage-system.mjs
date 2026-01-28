/**
 * Test Storage System
 *
 * Tests the storage initialization, path validation, and migration utilities.
 */

import {
  getDefaultStorageLocations,
  logAllStorageLocations,
  validateStoragePath,
  needsMigration,
  initializeStorage,
} from './packages/core/dist/index.js';

console.log('='.repeat(80));
console.log('STORAGE SYSTEM TEST');
console.log('='.repeat(80));
console.log();

// Test 1: Get default storage locations
console.log('Test 1: Default Storage Locations');
console.log('-'.repeat(80));
const locations = getDefaultStorageLocations();
console.log('Sessions:', locations.sessions);
console.log('Context Snapshots:', locations.contextSnapshots);
console.log('Config:', locations.config);
console.log('Cache:', locations.cache);
console.log();

// Test 2: Log all storage locations
console.log('Test 2: Log All Storage Locations');
console.log('-'.repeat(80));
logAllStorageLocations();
console.log();

// Test 3: Validate storage paths
console.log('Test 3: Path Validation');
console.log('-'.repeat(80));
const sessionsResult = validateStoragePath(locations.sessions, false);
console.log('Sessions path validation:');
console.log('  Valid:', sessionsResult.valid);
console.log('  Resolved:', sessionsResult.resolved);
console.log('  Exists:', sessionsResult.exists);
console.log('  Writable:', sessionsResult.writable);
if (sessionsResult.error) {
  console.log('  Error:', sessionsResult.error);
}
console.log();

const snapshotsResult = validateStoragePath(locations.contextSnapshots, false);
console.log('Context snapshots path validation:');
console.log('  Valid:', snapshotsResult.valid);
console.log('  Resolved:', snapshotsResult.resolved);
console.log('  Exists:', snapshotsResult.exists);
console.log('  Writable:', snapshotsResult.writable);
if (snapshotsResult.error) {
  console.log('  Error:', snapshotsResult.error);
}
console.log();

// Test 4: Check if migration is needed
console.log('Test 4: Migration Check');
console.log('-'.repeat(80));
const migrationNeeded = await needsMigration();
console.log('Migration needed:', migrationNeeded);
console.log();

// Test 5: Initialize storage (includes migration if needed)
console.log('Test 5: Storage Initialization');
console.log('-'.repeat(80));
try {
  await initializeStorage();
  console.log('✓ Storage initialization completed successfully');
} catch (error) {
  console.error('✗ Storage initialization failed:', error.message);
}
console.log();

// Test 6: Verify directories were created
console.log('Test 6: Verify Directories Created');
console.log('-'.repeat(80));
const sessionsResultAfter = validateStoragePath(locations.sessions, false);
const snapshotsResultAfter = validateStoragePath(locations.contextSnapshots, false);
console.log('Sessions directory exists:', sessionsResultAfter.exists);
console.log('Context snapshots directory exists:', snapshotsResultAfter.exists);
console.log();

console.log('='.repeat(80));
console.log('TEST COMPLETE');
console.log('='.repeat(80));
