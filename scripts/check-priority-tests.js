/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

 
const files = [
  'packages/core/src/context/__tests__/contextManager.test.ts',
  'packages/core/src/core/__tests__/chatClient.test.ts',
  'packages/core/src/context/__tests__/snapshotStorage.test.ts',
  'packages/core/src/provider/__tests__/providerRegistry.test.ts',
  'packages/core/src/provider/__tests__/providerFactory.test.ts',
  'packages/ollm-bridge/src/__tests__/modelManagement.integration.test.ts',
  'packages/ollm-bridge/src/__tests__/streaming.integration.test.ts',
  'packages/cli/src/commands/__tests__/commandRegistry.test.ts',
  'packages/cli/src/commands/__tests__/slashCommandParsing.test.ts',
  'packages/cli/src/services/__tests__/mcpMarketplace.integration.test.ts',
  'packages/test-utils/src/__tests__/mockProvider.test.ts',
  'packages/test-utils/src/__tests__/uiTestHelpers.test.ts',
  'packages/core/src/core/__tests__/messageHistory.test.ts',
  'packages/core/src/context/__tests__/tokenCounter.test.ts',
  'packages/core/src/context/__tests__/memoryGuard.test.ts',
  'packages/cli/src/features/context/__tests__/ModelContext.test.tsx',
  'packages/cli/src/services/__tests__/mcpConfigService.test.ts',
];

const root = path.resolve(__dirname, '..');
console.log('Checking priority test files under:', root);
const present = [];
const missing = [];

for (const f of files) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) present.push(f);
  else missing.push(f);
}

console.log('\nPresent files:');
present.forEach(x => console.log('  ', x));
console.log('\nMissing files:');
missing.forEach(x => console.log('  ', x));
process.exit(missing.length === 0 ? 0 : 2);
